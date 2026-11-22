<?php
// Настройки сайта из панели /admin/settings: какие темы оформления доступны
// посетителям и где висят Bluetooth-маячки для карты. Сайт читает их отсюда
// при каждом открытии (src/site-settings.js). Файл лежит рядом с папкой сайта
// (вне public_html), поэтому переживает перезаливку. Ключ тот же, что у
// объявлений: notices_key (deploy/notices.md). PHP 7.4+.

declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const SITE_THEMES = ['light', 'dark', 'pickme', 'v2'];
const BEACONS_MAX = 60;
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
    return dirname(__DIR__, 2) . '/logos-settings.json';
}

// Светлая тема есть всегда: её нельзя выключить, иначе сайту нечего показать.
function clean_themes($value): array
{
    $asked = is_array($value) ? $value : SITE_THEMES;
    return array_values(array_filter(SITE_THEMES, fn ($theme) => $theme === 'light' || in_array($theme, $asked, true)));
}

function clean_beacons($value): ?array
{
    if (!is_array($value)) return [];
    if (count($value) > BEACONS_MAX) return null;
    $out = [];
    foreach ($value as $item) {
        if (!is_array($item)) return null;
        $id = preg_replace('/[\x00-\x1F\x7F]/u', '', (string) ($item['id'] ?? '')) ?? '';
        $id = mb_substr(trim($id), 0, 80);
        $room = (string) ($item['roomId'] ?? '');
        $tx = (int) ($item['tx'] ?? -59);
        if ($id === '' || !preg_match('/^[a-z0-9-]{1,60}$/', $room)) return null;
        $out[mb_strtolower($id)] = ['id' => $id, 'roomId' => $room, 'tx' => max(-100, min(-20, $tx))];
    }
    return array_values($out);
}

function current_settings(): array
{
    $saved = is_file(stored_file()) ? json_decode((string) file_get_contents(stored_file()), true) : null;
    if (!is_array($saved)) $saved = [];
    if (isset($saved['themes']) && is_array($saved['themes']) && empty($saved['edition_schema'])) {
        $saved['themes'][] = 'v2';
    }
    return ['themes' => clean_themes($saved['themes'] ?? null), 'beacons' => clean_beacons($saved['beacons'] ?? []) ?? []];
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
if ($method === 'GET') respond(200, current_settings());
if ($method !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

// Запросы только с самого сайта (как в notices.php).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$hosts = [];
foreach ([$_SERVER['HTTP_HOST'] ?? '', explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '')[0], $_SERVER['SERVER_NAME'] ?? ''] as $candidate) {
    $candidate = preg_replace('/^www\./', '', strtolower(trim(preg_replace('/:\d+$/', '', $candidate) ?? '')));
    if ($candidate !== '') $hosts[] = $candidate;
}
$originHost = preg_replace('/^www\./', '', strtolower((string) parse_url($origin, PHP_URL_HOST)));
$sameSite = in_array($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '', ['same-origin', 'same-site'], true);
if ($origin !== '' && !$sameSite && !in_array($originHost, $hosts, true)) respond(403, ['error' => 'Запрос с другого сайта.']);

$config = load_config();
if ((string) $config['notices_key'] === '') respond(503, ['error' => 'Панель не настроена: задайте notices_key (deploy/notices.md).']);
if (too_many_fails(false)) respond(429, ['error' => 'Слишком много неверных попыток. Подождите час.']);
if (!hash_equals(trim((string) $config['notices_key']), trim((string) ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '')))) {
    too_many_fails(true);
    respond(403, ['error' => 'Неверный ключ.']);
}

$data = json_decode((string) file_get_contents('php://input', false, null, 0, 65536), true);
if (!is_array($data)) respond(400, ['error' => 'Пустой запрос.']);
// Меняем только то, что прислали: темы и маячки сохраняются с разных форм.
$settings = current_settings();
if (array_key_exists('themes', $data)) $settings['themes'] = clean_themes($data['themes']);
if (array_key_exists('beacons', $data)) {
    $beacons = clean_beacons($data['beacons']);
    if ($beacons === null) respond(400, ['error' => 'Проверьте маячки: у каждого нужны имя и помещение, не больше ' . BEACONS_MAX . ' штук.']);
    $settings['beacons'] = $beacons;
}
$json = json_encode($settings + ['edition_schema' => 2], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
if (@file_put_contents(stored_file(), $json, LOCK_EX) === false) respond(500, ['error' => 'Сервер не смог сохранить файл рядом с папкой сайта.']);
respond(200, ['ok' => true] + $settings);
