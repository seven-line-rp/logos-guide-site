<?php
// «Искали и не нашли»: если поиск на сайте ничего не дал, страница присылает
// сюда только текст запроса. Храним счётчики по запросам — без IP и других
// данных о человеке, чтобы команда видела, каких названий не хватает.
// Просмотр и настройка — deploy/reports.md. Совместим с PHP 7.4+.

declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const MISS_MAX_QUERIES = 3000;
const MISS_PER_IP_HOUR = 40;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function load_config(): array
{
    $config = ['reports_key' => ''];
    foreach ([dirname(__DIR__, 2) . '/logos-ai-config.php', __DIR__ . '/ai-config.php'] as $file) {
        if (is_file($file)) {
            $loaded = include $file;
            if (is_array($loaded)) $config = array_merge($config, $loaded);
            break;
        }
    }
    return $config;
}

function reports_dir(): string
{
    $outside = dirname(__DIR__, 2) . '/logos-reports';
    if ((is_dir($outside) || @mkdir($outside, 0700, true)) && is_writable($outside)) return $outside;
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-reports-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

// Файл с блокировкой: читаем, меняем, записываем.
function with_file(string $name, callable $change)
{
    $handle = @fopen(reports_dir() . '/' . $name, 'c+');
    if (!$handle) { $none = null; return $change($none); }
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    if (!is_array($state)) $state = [];
    $result = $change($state);
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state, JSON_UNESCAPED_UNICODE));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

$config = load_config();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET' && isset($_GET['list'])) {
    $key = (string) ($_GET['key'] ?? '');
    if ($config['reports_key'] === '' || !hash_equals((string) $config['reports_key'], $key)) respond(403, ['error' => 'Нужен ключ.']);
    $file = reports_dir() . '/search-misses.json';
    $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : [];
    $items = [];
    foreach (is_array($data) ? $data : [] as $query => $row) $items[] = ['q' => (string) $query, 'count' => (int) ($row['n'] ?? 0), 'last' => (string) ($row['last'] ?? '')];
    usort($items, function ($a, $b) { return $b['count'] <=> $a['count'] ?: strcmp($b['last'], $a['last']); });
    respond(200, ['total' => count($items), 'items' => array_slice($items, 0, 300)]);
}
if ($method !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) respond(403, ['error' => 'Запрос с другого сайта.']);

$data = json_decode((string) file_get_contents('php://input', false, null, 0, 2048), true);
$query = is_array($data) && is_string($data['q'] ?? null) ? $data['q'] : '';
$query = mb_strtolower(trim(preg_replace('/\s+/u', ' ', preg_replace('/[\x00-\x1F\x7F]/u', '', $query) ?? '') ?? ''));
if (mb_strlen($query) < 2 || mb_strlen($query) > 60) respond(400, ['error' => 'Пустой запрос.']);
// Похоже на телефон, почту или ссылку — не храним: это могут быть личные данные.
if (preg_match('/@|https?:|www\.|\d{6,}/u', $query)) respond(200, ['ok' => true]);

// Защита от накрутки: обезличенный отпечаток IP хранится только в течение
// текущего часа (файл перезаписывается) и в файл с запросами не попадает.
$allowed = with_file('search-limits.json', function (&$state) {
    $hour = date('Y-m-d H');
    if ($state === null) return true;
    if (($state['hour'] ?? '') !== $hour) $state = ['hour' => $hour, 'ips' => []];
    $me = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__ . $hour), 0, 12);
    $state['ips'][$me] = ($state['ips'][$me] ?? 0) + 1;
    return $state['ips'][$me] <= MISS_PER_IP_HOUR;
});
if (!$allowed) respond(429, ['error' => 'Слишком много запросов.']);

with_file('search-misses.json', function (&$state) use ($query) {
    if ($state === null) return;
    if (!isset($state[$query]) && count($state) >= MISS_MAX_QUERIES) return;
    $state[$query] = ['n' => (int) ($state[$query]['n'] ?? 0) + 1, 'last' => date('Y-m-d')];
});

respond(200, ['ok' => true]);
