<?php
// «Сообщить о неточности»: принимает короткое сообщение о помещении на карте
// и складывает его в файл на сервере. Без базы данных и без внешних сервисов.
// Где лежат сообщения, как их читать и как включить письма — deploy/reports.md.
// Совместим с PHP 7.4+.

declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const REPORT_KINDS = ['wrong-place', 'closed', 'moved', 'wrong-name', 'other'];
const REPORT_MAX_TEXT = 600;
const REPORT_PER_IP_HOUR = 5;
const REPORT_PER_DAY = 200;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Те же места, что и у ИИ-агента: файл рядом с папкой сайта или в api/.
function load_config(): array
{
    $config = ['reports_key' => '', 'reports_email' => ''];
    foreach ([dirname(__DIR__, 2) . '/logos-ai-config.php', __DIR__ . '/ai-config.php'] as $file) {
        if (is_file($file)) {
            $loaded = include $file;
            if (is_array($loaded)) $config = array_merge($config, $loaded);
            break;
        }
    }
    return $config;
}

// Сообщения храним вне public_html, чтобы их нельзя было скачать по ссылке.
// Если туда писать нельзя — во временной папке хостинга.
function reports_dir(): string
{
    $outside = dirname(__DIR__, 2) . '/logos-reports';
    if (is_dir($outside) || @mkdir($outside, 0700, true)) {
        if (is_writable($outside)) return $outside;
    }
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-reports-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

function visitor_key(): string
{
    return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__), 0, 16);
}

// Лимиты: не больше REPORT_PER_IP_HOUR сообщений в час с одного адреса
// и REPORT_PER_DAY на весь сайт за сутки.
function take_limit(): bool
{
    $handle = @fopen(reports_dir() . '/limits.json', 'c+');
    if (!$handle) return true;
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    $day = date('Y-m-d');
    if (!is_array($state) || ($state['day'] ?? '') !== $day) $state = ['day' => $day, 'total' => 0, 'ips' => []];
    $me = visitor_key();
    $now = time();
    $recent = array_values(array_filter($state['ips'][$me] ?? [], function ($t) use ($now) { return $now - (int) $t < 3600; }));
    $ok = count($recent) < REPORT_PER_IP_HOUR && $state['total'] < REPORT_PER_DAY;
    if ($ok) {
        $recent[] = $now;
        $state['total']++;
    }
    $state['ips'][$me] = $recent;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $ok;
}

function clean_text($value, int $max): string
{
    $text = is_string($value) ? $value : '';
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    return mb_substr(trim($text), 0, $max);
}

$config = load_config();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

// Просмотр: /api/report.php?list&key=… (ключ задаётся в конфиге, см. deploy/reports.md).
if ($method === 'GET' && isset($_GET['list'])) {
    $key = (string) ($_GET['key'] ?? '');
    if ($config['reports_key'] === '' || !hash_equals((string) $config['reports_key'], $key)) respond(403, ['error' => 'Нужен ключ.']);
    $file = reports_dir() . '/reports.jsonl';
    $lines = is_file($file) ? file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
    $items = array_map(function ($line) { return json_decode($line, true); }, array_slice($lines ?: [], -200));
    respond(200, ['count' => count($lines ?: []), 'items' => array_reverse(array_values(array_filter($items)))]);
}
if ($method === 'GET' && isset($_GET['health'])) respond(200, ['ok' => is_writable(reports_dir())]);
if ($method !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) respond(403, ['error' => 'Запрос с другого сайта.']);

$raw = file_get_contents('php://input', false, null, 0, 8192);
$data = json_decode((string) $raw, true);
if (!is_array($data)) respond(400, ['error' => 'Не получилось прочитать сообщение.']);

$room = clean_text($data['room'] ?? '', 60);
$kind = clean_text($data['kind'] ?? '', 20);
$text = clean_text($data['text'] ?? '', REPORT_MAX_TEXT);
$page = clean_text($data['page'] ?? '', 200);
if (!preg_match('/^[a-z0-9-]{1,60}$/', $room)) respond(400, ['error' => 'Не указано помещение.']);
if (!in_array($kind, REPORT_KINDS, true)) respond(400, ['error' => 'Выберите, что не так.']);
if ($kind === 'other' && mb_strlen($text) < 3) respond(400, ['error' => 'Опишите, что не так, хотя бы парой слов.']);
// Ловушка для ботов: поле скрыто от людей.
if (clean_text($data['website'] ?? '', 100) !== '') respond(200, ['ok' => true]);
if (!take_limit()) respond(429, ['error' => 'Слишком много сообщений. Попробуйте позже.']);

$entry = ['at' => date('c'), 'room' => $room, 'kind' => $kind, 'text' => $text, 'page' => $page, 'visitor' => visitor_key()];
$saved = @file_put_contents(reports_dir() . '/reports.jsonl', json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
if ($saved === false) respond(500, ['error' => 'Сервер не смог сохранить сообщение.']);

if ($config['reports_email'] !== '' && function_exists('mail')) {
    $body = "Помещение: {$room}\nЧто не так: {$kind}\nКомментарий: {$text}\nСтраница: {$page}\nВремя: {$entry['at']}\n";
    @mail((string) $config['reports_email'], '=?UTF-8?B?' . base64_encode('ЛОГОС: неточность на карте') . '?=', $body, "Content-Type: text/plain; charset=utf-8\r\n");
}

respond(200, ['ok' => true]);
