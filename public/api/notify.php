<?php
// Push-уведомления (пока тестовые, включаются на странице /testNotification).
// Подписки, ключи VAPID и состояние рассылки лежат в папке logos-push рядом
// с папкой сайта (вне public_html), поэтому переживают перезаливку.
//
// GET                         открытый ключ VAPID для браузера
// POST subscribe / unsubscribe   подписка этого браузера и выбранные темы
// POST test                   пробное уведомление только себе
// POST count / send           панель /admin (ключ notices_key)
// GET ?cron=ключ или php notify.php cron   звонки, события и новая версия сайта
//
// Настройка — deploy/push.md. PHP 7.4+ с openssl и curl.

declare(strict_types=1);

require __DIR__ . '/notify-lib.php';

date_default_timezone_set('Europe/Moscow');

const PUSH_TOPICS = ['lessons', 'events', 'updates', 'news'];
const PUSH_KINDS = ['lesson-start' => 'lessons', 'lesson-end' => 'lessons', 'event' => 'events', 'update' => 'updates', 'news' => 'news'];
const PUSH_MAX_SUBSCRIPTIONS = 5000;
// Сервисы доставки браузеров: Chrome, Яндекс, Edge, Samsung (FCM), Firefox, Safari и iPhone, Windows.
const PUSH_HOSTS = '/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/';
const LESSON_NOTICE_BEFORE = 5; // за сколько минут до пары напоминать
const CRON_WINDOW = 4; // крон может опоздать: сколько минут событие ещё считается свежим

function respond(int $status, $body): void
{
    if (PHP_SAPI !== 'cli') {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
    }
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), PHP_SAPI === 'cli' ? "\n" : '';
    exit($status < 400 ? 0 : 1);
}

function load_config(): array
{
    $config = ['notices_key' => '', 'push_cron_key' => '', 'push_contact' => '', 'push_test_hosts' => []];
    foreach ([dirname(__DIR__, 2) . '/logos-ai-config.php', __DIR__ . '/ai-config.php'] as $file) {
        if (is_file($file)) {
            $loaded = include $file;
            if (is_array($loaded)) $config = array_merge($config, $loaded);
            break;
        }
    }
    return $config;
}

function data_dir(): string
{
    return dirname(__DIR__, 2) . '/logos-push';
}

// Чтение и запись JSON-файла под блокировкой: подписываться могут одновременно.
function with_json(string $name, callable $change)
{
    $dir = data_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) respond(500, ['error' => 'Сервер не смог создать папку logos-push рядом с сайтом.']);
    $handle = @fopen("$dir/$name", 'c+');
    if (!$handle) respond(500, ['error' => "Сервер не смог открыть logos-push/$name."]);
    flock($handle, LOCK_EX);
    $data = json_decode(stream_get_contents($handle) ?: '{}', true);
    if (!is_array($data)) $data = [];
    [$data, $result] = $change($data);
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

function read_json(string $file): array
{
    $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    return is_array($data) ? $data : [];
}

function vapid(): array
{
    try {
        return push_vapid(data_dir() . '/vapid.json');
    } catch (Throwable $error) {
        respond(500, ['error' => $error->getMessage()]);
    }
}

function site_host(): string
{
    $host = explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '')[0] ?: ($_SERVER['HTTP_HOST'] ?? 'logos-guide.ru');
    return preg_replace('/:\d+$/', '', strtolower(trim($host))) ?: 'logos-guide.ru';
}

function contact(array $config): string
{
    $value = trim((string) $config['push_contact']);
    return preg_match('/^(mailto:|https:\/\/)/', $value) ? $value : 'https://' . (PHP_SAPI === 'cli' ? 'logos-guide.ru' : site_host());
}

// Подписку принимаем только на настоящие сервисы доставки, иначе сервер можно
// заставить слать запросы куда угодно. push_test_hosts — для автотестов.
function allowed_endpoint(string $endpoint, array $config): bool
{
    if (strlen($endpoint) > 1000) return false;
    $url = parse_url($endpoint);
    if (!is_array($url) || empty($url['host'])) return false;
    $host = strtolower($url['host']) . (isset($url['port']) ? ':' . $url['port'] : '');
    if (in_array($host, (array) $config['push_test_hosts'], true)) return in_array($url['scheme'] ?? '', ['http', 'https'], true);
    return ($url['scheme'] ?? '') === 'https' && !isset($url['port']) && preg_match(PUSH_HOSTS, $host) === 1;
}

function subscription_id(string $endpoint): string
{
    return substr(hash('sha256', $endpoint), 0, 24);
}

function clean_text($value, int $max): string
{
    $text = is_string($value) ? $value : '';
    $text = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $text) ?? '';
    return mb_substr(trim(preg_replace('/\s+/u', ' ', $text) ?? ''), 0, $max);
}

function clean_url($value): string
{
    $url = is_string($value) ? trim($value) : '';
    return preg_match('/^\/(?![\/\\\\])[\w\-.~%!$&\'()*+,;=:@\/?#]{0,200}$/u', $url) ? $url : '/';
}

function clean_topics($value): array
{
    return array_values(array_intersect(PUSH_TOPICS, is_array($value) ? $value : []));
}

// Счётчик попыток за час на адрес или подписку: защита от перебора ключа и спама.
function rate_limited(string $bucket, string $who, int $limit, bool $count): bool
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-push-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $handle = @fopen("$dir/$bucket.json", 'c+');
    if (!$handle) return false;
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    $hour = date('Y-m-d H');
    if (!is_array($state) || ($state['hour'] ?? '') !== $hour) $state = ['hour' => $hour, 'ids' => []];
    $me = substr(hash('sha256', $who . __DIR__), 0, 16);
    if ($count) $state['ids'][$me] = ($state['ids'][$me] ?? 0) + 1;
    $blocked = ($state['ids'][$me] ?? 0) > $limit;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $blocked;
}

function payload(string $kind, string $title, string $body, string $url, array $extra = []): string
{
    return json_encode(['kind' => $kind, 'title' => $title, 'body' => $body, 'url' => $url, 'tag' => $extra['tag'] ?? $kind, 'ts' => time()] + $extra, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// Отправка всем, кто выбрал тему. Подписки, от которых сервис ответил
// 404 или 410 (человек отписался в настройках браузера), удаляются.
function broadcast(string $kind, string $json, ?array $only = null, int $ttl = 3600): array
{
    $config = load_config();
    $topic = PUSH_KINDS[$kind];
    $subscriptions = read_json(data_dir() . '/subscriptions.json');
    $targets = array_filter($subscriptions, function ($item, $id) use ($topic, $only) {
        return $only !== null ? in_array($id, $only, true) : in_array($topic, $item['topics'] ?? [], true);
    }, ARRAY_FILTER_USE_BOTH);
    if (!$targets) return ['total' => 0, 'sent' => 0, 'failed' => 0, 'removed' => 0];
    $urgency = in_array($kind, ['lesson-start', 'lesson-end'], true) ? 'high' : 'normal';
    $codes = push_send_many($targets, $json, vapid(), contact($config), $ttl, $urgency);
    $gone = array_keys(array_filter($codes, fn ($code) => $code === 404 || $code === 410));
    if ($gone) with_json('subscriptions.json', function ($data) use ($gone) {
        foreach ($gone as $id) unset($data[$id]);
        return [$data, null];
    });
    $sent = count(array_filter($codes, fn ($code) => $code >= 200 && $code < 300));
    return ['total' => count($targets), 'sent' => $sent, 'failed' => count($targets) - $sent - count($gone), 'removed' => count($gone)];
}

// ---------- Пробные уведомления для страницы /testNotification ----------

function test_payload(string $kind): string
{
    $meta = read_json(__DIR__ . '/push-meta.json');
    $bell = ['pair' => 2, 'label' => '2-я пара', 'start' => '10:40', 'end' => '12:10'];
    switch ($kind) {
        case 'lesson-start':
            return payload($kind, 'Через 5 минут: 2-я пара', 'Начало в 10:40. Откройте маршрут, чтобы не опоздать.', '/schedule', ['bell' => $bell, 'test' => true]);
        case 'lesson-end':
            return payload($kind, '2-я пара закончилась', 'Перемена до 12:30.', '/schedule', ['bell' => $bell, 'next' => '12:30', 'test' => true]);
        case 'event':
            return payload($kind, 'Концерт в актовом зале', 'Начало в 15:00, вход свободный.', '/map?room=auditorium-104', ['test' => true]);
        case 'update':
            $label = (string) ($meta['versionLabel'] ?? 'новая версия');
            return payload($kind, "ЛОГОС обновился: $label", 'Посмотрите, что нового на сайте.', '/', ['test' => true]);
        default:
            return payload('news', 'Сообщение от команды сайта', 'Так будут выглядеть объявления, которые отправляют из панели.', '/', ['test' => true]);
    }
}

// ---------- Автоматическая рассылка по крону ----------

function lesson_jobs(array $meta, int $now): array
{
    $weekday = (int) date('N', $now);
    if ($weekday === 7) return [];
    $kind = $weekday === 1 ? 'monday' : 'weekday';
    $bells = $meta['bells'][$kind] ?? [];
    $lunch = $meta['lunch'][$kind] ?? [];
    $minutes = fn (string $time) => (int) substr($time, 0, 2) * 60 + (int) substr($time, 3, 2);
    $jobs = [];
    foreach ($bells as $index => $bell) {
        $info = ['pair' => $bell['pair'], 'label' => $bell['label'], 'start' => $bell['start'], 'end' => $bell['end']];
        $jobs[] = ['at' => $minutes($bell['start']) - LESSON_NOTICE_BEFORE, 'kind' => 'lesson-start', 'json' => payload('lesson-start', 'Через ' . LESSON_NOTICE_BEFORE . " минут: {$bell['label']}", "Начало в {$bell['start']}. Откройте маршрут, чтобы не опоздать.", '/schedule', ['bell' => $info])];
        $next = $bells[$index + 1] ?? null;
        $meals = array_values(array_filter($lunch, fn ($item) => $item['start'] === $bell['end']));
        $body = !$next ? 'Пары на сегодня закончились.' : ($meals ? "Обед {$meals[0]['course']} курса до {$meals[0]['end']}. Следующая пара в {$next['start']}." : "Перемена до {$next['start']}.");
        $jobs[] = ['at' => $minutes($bell['end']), 'kind' => 'lesson-end', 'json' => payload('lesson-end', "{$bell['label']} закончилась", $body, '/schedule', ['bell' => $info, 'next' => $next['start'] ?? null])];
    }
    return $jobs;
}

function current_notices(): array
{
    foreach ([dirname(__DIR__, 2) . '/logos-notices.json', dirname(__DIR__) . '/notices.json'] as $file) {
        if (is_file($file)) return array_values(read_json($file));
    }
    return [];
}

function run_cron(int $now): array
{
    $meta = read_json(__DIR__ . '/push-meta.json');
    $today = date('Y-m-d', $now);
    $minute = (int) date('G', $now) * 60 + (int) date('i', $now);
    $jobs = [];
    foreach (lesson_jobs($meta, $now) as $job) {
        if ($minute >= $job['at'] && $minute < $job['at'] + CRON_WINDOW) $jobs["$today {$job['kind']} {$job['at']}"] = $job;
    }
    // События из объявлений: с датой начала — в момент начала, без даты — как только появились.
    $events = [];
    foreach (current_notices() as $notice) {
        if (!is_array($notice) || ($notice['type'] ?? '') !== 'event' || empty($notice['title'])) continue;
        $from = isset($notice['from']) ? strtotime((string) $notice['from']) : false;
        $to = isset($notice['to']) ? strtotime((string) $notice['to']) : false;
        if (($to !== false && $to < $now) || ($from !== false && ($from > $now || $from < $now - CRON_WINDOW * 60))) continue;
        $id = 'event ' . substr(sha1(($notice['roomId'] ?? '') . '|' . $notice['title'] . '|' . ($notice['from'] ?? '')), 0, 16);
        $events[$id] = ['kind' => 'event', 'json' => payload('event', clean_text($notice['title'], 60), clean_text($notice['text'] ?? 'Подробности на карте.', 180), '/map?room=' . rawurlencode((string) ($notice['roomId'] ?? '')), ['tag' => $id])];
    }
    $version = (string) ($meta['version'] ?? '');

    $todo = with_json('state.json', function ($state) use ($jobs, $events, $version, $meta, $today, $now) {
        $first = !isset($state['day']);
        if (($state['day'] ?? '') !== $today) $state['sent'] = [];
        $state['day'] = $today;
        $state['events'] = array_filter($state['events'] ?? [], fn ($time) => $time > $now - 30 * 86400);
        $todo = [];
        foreach ($jobs as $id => $job) {
            if (in_array($id, $state['sent'], true)) continue;
            $state['sent'][] = $id;
            $todo[] = $job;
        }
        foreach ($events as $id => $job) {
            if (isset($state['events'][$id])) continue;
            $state['events'][$id] = $now;
            // При самом первом запуске не рассылаем то, что висело на сайте и раньше.
            if (!$first) $todo[] = $job;
        }
        if ($version !== '' && ($state['version'] ?? '') !== $version) {
            if (!empty($state['version'])) $todo[] = ['kind' => 'update', 'json' => payload('update', 'ЛОГОС обновился: ' . ($meta['versionLabel'] ?? $version), 'Посмотрите, что нового на сайте.', '/')];
            $state['version'] = $version;
        }
        return [$state, $todo];
    });

    $report = [];
    foreach ($todo as $job) $report[] = ['kind' => $job['kind'], 'title' => json_decode($job['json'], true)['title']] + broadcast($job['kind'], $job['json'], null, $job['kind'] === 'event' || $job['kind'] === 'update' ? 86400 : 600);
    return $report;
}

// ---------- Запросы ----------

$config = load_config();

if (PHP_SAPI === 'cli') {
    // Второй аргумент — время в секундах Unix вместо текущего (для проверки).
    if (($argv[1] ?? '') !== 'cron') respond(400, ['error' => 'Использование: php notify.php cron [время]']);
    respond(200, ['ok' => true, 'sent' => run_cron(isset($argv[2]) ? (int) $argv[2] : time())]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET' && isset($_GET['cron'])) {
    $cronKey = trim((string) ($config['push_cron_key'] ?: $config['notices_key']));
    if ($cronKey === '') respond(503, ['error' => 'Задайте push_cron_key (deploy/push.md).']);
    if (rate_limited('cron-fails', $_SERVER['REMOTE_ADDR'] ?? '', 10, false)) respond(429, ['error' => 'Слишком много неверных попыток. Подождите час.']);
    if (!hash_equals($cronKey, trim((string) $_GET['cron']))) {
        rate_limited('cron-fails', $_SERVER['REMOTE_ADDR'] ?? '', 10, true);
        respond(403, ['error' => 'Неверный ключ.']);
    }
    respond(200, ['ok' => true, 'sent' => run_cron(time())]);
}
if ($method === 'GET') respond(200, ['publicKey' => vapid()['public']]);
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

$data = json_decode((string) file_get_contents('php://input', false, null, 0, 16384), true);
if (!is_array($data)) respond(400, ['error' => 'Пустой запрос.']);
$action = (string) ($data['action'] ?? '');
$ip = $_SERVER['REMOTE_ADDR'] ?? '';

if ($action === 'subscribe') {
    $subscription = $data['subscription'] ?? null;
    $endpoint = (string) ($subscription['endpoint'] ?? '');
    $p256dh = (string) ($subscription['keys']['p256dh'] ?? '');
    $auth = (string) ($subscription['keys']['auth'] ?? '');
    if (!allowed_endpoint($endpoint, $config)) respond(400, ['error' => 'Этот браузер использует неизвестный сервис уведомлений.']);
    if (strlen(b64url_decode($p256dh)) !== 65 || strlen(b64url_decode($auth)) !== 16) respond(400, ['error' => 'Неверные ключи подписки.']);
    if (rate_limited('subscribe', $ip, 30, true)) respond(429, ['error' => 'Слишком часто. Попробуйте через час.']);
    $topics = isset($data['topics']) ? clean_topics($data['topics']) : null;
    $platform = in_array($data['platform'] ?? '', ['android', 'ios', 'desktop'], true) ? $data['platform'] : null;
    $id = subscription_id($endpoint);
    // previous — старая подписка, которую браузер сам заменил (pushsubscriptionchange в sw.js).
    $previous = subscription_id((string) ($data['previous'] ?? ''));
    $topics = with_json('subscriptions.json', function ($list) use ($id, $previous, $endpoint, $p256dh, $auth, $topics, $platform) {
        $before = $list[$id] ?? $list[$previous] ?? [];
        if ($previous !== $id) unset($list[$previous]);
        if (!isset($list[$id]) && count($list) >= PUSH_MAX_SUBSCRIPTIONS) return [$list, false];
        $topics = $topics ?? $before['topics'] ?? PUSH_TOPICS;
        $list[$id] = ['endpoint' => $endpoint, 'p256dh' => $p256dh, 'auth' => $auth, 'topics' => $topics, 'platform' => $platform ?? $before['platform'] ?? 'desktop', 'created' => $before['created'] ?? date('c'), 'updated' => date('c')];
        return [$list, $topics];
    });
    if ($topics === false) respond(507, ['error' => 'Подписок слишком много, тест переполнен.']);
    respond(200, ['ok' => true, 'topics' => $topics]);
}

if ($action === 'unsubscribe') {
    $id = subscription_id((string) ($data['endpoint'] ?? ''));
    with_json('subscriptions.json', function ($list) use ($id) {
        unset($list[$id]);
        return [$list, null];
    });
    respond(200, ['ok' => true]);
}

if ($action === 'test') {
    $id = subscription_id((string) ($data['endpoint'] ?? ''));
    if (!isset(read_json(data_dir() . '/subscriptions.json')[$id])) respond(404, ['error' => 'Подписка не найдена. Включите уведомления заново.']);
    if (rate_limited('test', $id, 20, true)) respond(429, ['error' => 'Хватит на этот час: не больше 20 пробных уведомлений.']);
    $kind = array_key_exists($data['kind'] ?? '', PUSH_KINDS) ? $data['kind'] : 'news';
    $result = broadcast($kind, test_payload($kind), [$id], 300);
    if ($result['sent'] !== 1) respond(502, ['error' => $result['removed'] ? 'Браузер отозвал подписку. Включите уведомления заново.' : 'Сервис уведомлений не принял сообщение. Попробуйте ещё раз.'] + $result);
    respond(200, ['ok' => true] + $result);
}

// Дальше — только панель /admin.
if ((string) $config['notices_key'] === '') respond(503, ['error' => 'Панель не настроена: задайте notices_key (deploy/notices.md).']);
if (rate_limited('admin-fails', $ip, 10, false)) respond(429, ['error' => 'Слишком много неверных попыток. Подождите час.']);
if (!hash_equals(trim((string) $config['notices_key']), trim((string) ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '')))) {
    rate_limited('admin-fails', $ip, 10, true);
    respond(403, ['error' => 'Неверный ключ.']);
}

if ($action === 'count') {
    $list = read_json(data_dir() . '/subscriptions.json');
    $topics = array_fill_keys(PUSH_TOPICS, 0);
    $platforms = ['android' => 0, 'ios' => 0, 'desktop' => 0];
    foreach ($list as $item) {
        foreach ($item['topics'] ?? [] as $topic) if (isset($topics[$topic])) $topics[$topic]++;
        $platforms[$item['platform'] ?? 'desktop'] = ($platforms[$item['platform'] ?? 'desktop'] ?? 0) + 1;
    }
    respond(200, ['total' => count($list), 'topics' => $topics, 'platforms' => $platforms, 'cron' => read_json(data_dir() . '/state.json')['day'] ?? null]);
}

if ($action === 'send') {
    $kind = array_key_exists($data['kind'] ?? '', PUSH_KINDS) ? $data['kind'] : 'news';
    $title = clean_text($data['title'] ?? '', 60);
    $body = clean_text($data['body'] ?? '', 180);
    if ($title === '') respond(400, ['error' => 'Напишите заголовок.']);
    $json = payload($kind, $title, $body, clean_url($data['url'] ?? '/'), ['tag' => 'admin-' . time()]);
    respond(200, ['ok' => true] + broadcast($kind, $json, null, 86400));
}

respond(400, ['error' => 'Неизвестное действие.']);
