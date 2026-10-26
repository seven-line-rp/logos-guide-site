<?php
// Обезличенная статистика посещений для панели /admin: сколько человек
// пришло и сколько раз отсканировали QR-таблички. Страницы шлют сюда только
// путь раздела (view) или id помещения с таблички (qr). Ни IP, ни cookie,
// ни идентификаторов в сохранённых данных нет: «уникальный посетитель за
// день» считается по отпечатку IP + браузера, который живёт только в течение
// текущих суток и стирается в полночь. Просмотр — по ключу notices_key
// (deploy/stats.md). Совместим с PHP 7.4+.

declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const STATS_KEEP_DAYS = 1100;
const STATS_EVENTS_PER_VISITOR_DAY = 400;
const STATS_MAX_VISITORS_DAY = 20000;
const STATS_MAX_PATHS_DAY = 40;
const ADMIN_FAILS_PER_HOUR = 10;

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

function stats_dir(): string
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
    $handle = @fopen(stats_dir() . '/' . $name, 'c+');
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

function same_site_request(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $hosts = [];
    foreach ([$_SERVER['HTTP_HOST'] ?? '', explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '')[0], $_SERVER['SERVER_NAME'] ?? ''] as $candidate) {
        $candidate = preg_replace('/^www\./', '', strtolower(trim(preg_replace('/:\d+$/', '', $candidate) ?? '')));
        if ($candidate !== '') $hosts[] = $candidate;
    }
    $originHost = preg_replace('/^www\./', '', strtolower((string) parse_url($origin, PHP_URL_HOST)));
    $sameSite = in_array($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '', ['same-origin', 'same-site'], true);
    return $sameSite || in_array($originHost, $hosts, true);
}

// Неверный ключ: не больше ADMIN_FAILS_PER_HOUR попыток в час с одного адреса.
function too_many_fails(bool $failed): bool
{
    return (bool) with_file('stats-admin-fails.json', function (&$state) use ($failed) {
        if ($state === null) return false;
        $hour = date('Y-m-d H');
        if (($state['hour'] ?? '') !== $hour) $state = ['hour' => $hour, 'ips' => []];
        $me = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__), 0, 16);
        if ($failed) $state['ips'][$me] = ($state['ips'][$me] ?? 0) + 1;
        return ($state['ips'][$me] ?? 0) > ADMIN_FAILS_PER_HOUR;
    });
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $config = load_config();
    if ((string) $config['notices_key'] === '') respond(503, ['error' => 'Панель не настроена: задайте notices_key (deploy/stats.md).']);
    if (too_many_fails(false)) respond(429, ['error' => 'Слишком много неверных попыток. Подождите час.']);
    $key = (string) ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '');
    if (!hash_equals(trim((string) $config['notices_key']), trim($key))) {
        too_many_fails(true);
        respond(403, ['error' => 'Неверный ключ.']);
    }
    $file = stats_dir() . '/stats.json';
    $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : [];
    $days = is_array($data) && is_array($data['days'] ?? null) ? $data['days'] : [];
    respond(200, ['today' => date('Y-m-d'), 'days' => (object) $days, 'since' => $data['since'] ?? null]);
}
if ($method !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);
if (!same_site_request()) respond(403, ['error' => 'Запрос с другого сайта.']);

$ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|uptime|curl|wget|python|go-http/i', $ua)) respond(200, ['ok' => true]);

$data = json_decode((string) file_get_contents('php://input', false, null, 0, 1024), true);
$type = is_array($data) && is_string($data['t'] ?? null) ? $data['t'] : '';
$path = '';
$room = '';
if ($type === 'view') {
    $path = is_string($data['p'] ?? null) ? strtolower($data['p']) : '';
    if (!preg_match('~^/[a-z0-9-]{0,30}(?:/[a-z0-9-]{1,30})?$~', $path)) respond(400, ['error' => 'Неверный путь.']);
    if (strpos($path, '/admin') === 0) respond(200, ['ok' => true]);
} elseif ($type === 'qr') {
    $room = is_string($data['room'] ?? null) ? $data['room'] : '';
    if (!preg_match('/^[a-z0-9-]{1,60}$/', $room)) respond(400, ['error' => 'Неверное помещение.']);
} else {
    respond(400, ['error' => 'Неизвестное событие.']);
}

$today = date('Y-m-d');
$hour = (int) date('G');

// Отпечаток посетителя на сутки: после полуночи файл начинается заново, прошлые отпечатки не хранятся.
$visitor = substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $ua . '|' . $today . '|' . __DIR__), 0, 14);
$status = with_file('stats-visitors.json', function (&$state) use ($today, $visitor) {
    if ($state === null) return 'new';
    if (($state['day'] ?? '') !== $today) $state = ['day' => $today, 'ids' => []];
    $count = (int) ($state['ids'][$visitor] ?? 0);
    if ($count >= STATS_EVENTS_PER_VISITOR_DAY) return 'limit';
    if ($count === 0 && count($state['ids']) >= STATS_MAX_VISITORS_DAY) return 'limit';
    $state['ids'][$visitor] = $count + 1;
    return $count === 0 ? 'new' : 'seen';
});
if ($status === 'limit') respond(429, ['error' => 'Слишком много событий.']);

with_file('stats.json', function (&$state) use ($type, $path, $room, $today, $hour, $status) {
    if ($state === null) return;
    if (!isset($state['since'])) $state['since'] = $today;
    if (!isset($state['days'][$today])) $state['days'][$today] = ['v' => 0, 'u' => 0, 'q' => [], 'p' => [], 'h' => array_fill(0, 24, 0)];
    $day = &$state['days'][$today];
    if ($type === 'view') {
        $day['v'] = (int) $day['v'] + 1;
        if ($status === 'new') $day['u'] = (int) $day['u'] + 1;
        $day['h'][$hour] = (int) ($day['h'][$hour] ?? 0) + 1;
        if (isset($day['p'][$path]) || count($day['p']) < STATS_MAX_PATHS_DAY) $day['p'][$path] = (int) ($day['p'][$path] ?? 0) + 1;
    } else {
        $day['q'][$room] = (int) ($day['q'][$room] ?? 0) + 1;
    }
    unset($day);
    if (count($state['days']) > STATS_KEEP_DAYS) {
        ksort($state['days']);
        $state['days'] = array_slice($state['days'], -STATS_KEEP_DAYS, null, true);
    }
});

respond(200, ['ok' => true]);
