<?php
// Объявления на карте с правкой из браузера: страница /admin сохраняет список
// сюда, сайт читает его отсюда. Файл лежит рядом с папкой сайта (вне
// public_html), поэтому переживает перезаливку. Пока его нет, отдаём
// public/notices.json. Настройка ключа — deploy/notices.md. PHP 7.4+.

declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const NOTICE_TYPES = ['closed', 'event', 'info'];
const NOTICES_MAX = 50;
const ADMIN_FAILS_PER_HOUR = 10;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');

function respond(int $status, $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function load_config(): array
{
    $config = ['notices_key' => ''];
    foreach ([dirname(__DIR__, 2) . '/logos-ai-config.php', __DIR__ . '/ai-config.php'] as $file) {
        if (is_file($file)) {
            $loaded = include $file;
            if (is_array($loaded)) $config = array_merge($config, $loaded);
            break;
        }
    }
    return $config;
}

function stored_file(): string
{
    return dirname(__DIR__, 2) . '/logos-notices.json';
}

function current_notices(): array
{
    foreach ([stored_file(), dirname(__DIR__) . '/notices.json'] as $file) {
        if (!is_file($file)) continue;
        $list = json_decode((string) file_get_contents($file), true);
        if (is_array($list)) return array_values($list);
    }
    return [];
}

function clean_text($value, int $max): string
{
    $text = is_string($value) ? $value : '';
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $text) ?? '';
    return mb_substr(trim(preg_replace('/\s+/u', ' ', $text) ?? ''), 0, $max);
}

function clean_notice($notice): ?array
{
    if (!is_array($notice)) return null;
    $type = (string) ($notice['type'] ?? '');
    $room = (string) ($notice['roomId'] ?? '');
    $title = clean_text($notice['title'] ?? '', 60);
    if (!in_array($type, NOTICE_TYPES, true) || !preg_match('/^[a-z0-9-]{1,60}$/', $room) || $title === '') return null;
    $out = ['type' => $type, 'roomId' => $room, 'title' => $title];
    $text = clean_text($notice['text'] ?? '', 240);
    if ($text !== '') $out['text'] = $text;
    foreach (['from', 'to'] as $field) {
        $value = (string) ($notice[$field] ?? '');
        if ($value === '') continue;
        $time = strtotime($value);
        if ($time === false) return null;
        $out[$field] = date('c', $time);
    }
    return $out;
}

// Неверный ключ: не больше ADMIN_FAILS_PER_HOUR попыток в час с одного адреса.
function too_many_fails(bool $failed): bool
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-admin-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $handle = @fopen($dir . '/fails.json', 'c+');
    if (!$handle) return false;
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    $hour = date('Y-m-d H');
    if (!is_array($state) || ($state['hour'] ?? '') !== $hour) $state = ['hour' => $hour, 'ips' => []];
    $me = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__), 0, 16);
    if ($failed) $state['ips'][$me] = ($state['ips'][$me] ?? 0) + 1;
    $blocked = ($state['ips'][$me] ?? 0) > ADMIN_FAILS_PER_HOUR;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $blocked;
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') respond(200, current_notices());
if ($method !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Хост сравниваем без порта и без «www.»; за прокси хостинга Host может быть внутренним,
// поэтому учитываем и X-Forwarded-Host, и заголовок Sec-Fetch-Site от браузера.
$hosts = [];
foreach ([$_SERVER['HTTP_HOST'] ?? '', explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '')[0], $_SERVER['SERVER_NAME'] ?? ''] as $candidate) {
    $candidate = preg_replace('/^www\./', '', strtolower(trim(preg_replace('/:\d+$/', '', $candidate) ?? '')));
    if ($candidate !== '') $hosts[] = $candidate;
}
$originHost = preg_replace('/^www\./', '', strtolower((string) parse_url($origin, PHP_URL_HOST)));
$sameSite = in_array($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '', ['same-origin', 'same-site'], true);
if ($origin !== '' && !$sameSite && !in_array($originHost, $hosts, true)) respond(403, ['error' => 'Запрос с другого сайта (' . $originHost . ').']);

$config = load_config();
if ((string) $config['notices_key'] === '') respond(503, ['error' => 'Правка объявлений не настроена: задайте notices_key (deploy/notices.md).']);
if (too_many_fails(false)) respond(429, ['error' => 'Слишком много неверных попыток. Подождите час.']);
$key = (string) ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '');
if (!hash_equals(trim((string) $config['notices_key']), trim($key))) {
    too_many_fails(true);
    respond(403, ['error' => 'Неверный ключ.']);
}

$data = json_decode((string) file_get_contents('php://input', false, null, 0, 65536), true);
if (is_array($data) && !empty($data['check'])) respond(200, ['ok' => true, 'writable' => is_writable(dirname(stored_file()))]);
if (!is_array($data) || !is_array($data['notices'] ?? null)) respond(400, ['error' => 'Нет списка объявлений.']);
if (count($data['notices']) > NOTICES_MAX) respond(400, ['error' => 'Не больше ' . NOTICES_MAX . ' объявлений.']);
$clean = [];
foreach ($data['notices'] as $index => $notice) {
    $item = clean_notice($notice);
    if ($item === null) respond(400, ['error' => 'Объявление №' . ($index + 1) . ': проверьте тип, помещение, заголовок и даты.']);
    $clean[] = $item;
}
$json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
if (@file_put_contents(stored_file(), $json, LOCK_EX) === false) respond(500, ['error' => 'Сервер не смог сохранить файл рядом с папкой сайта.']);
respond(200, ['ok' => true, 'notices' => $clean]);
