<?php
// Сообщения о сбоях страницы из браузеров посетителей (src/error-report.js): белый
// экран после неудачного обновления, ошибки загрузки файлов сайта, падения в React.
// Сервер ничего не хранит надолго: считает сбои за последние 10 минут и, если они
// массовые (у нескольких разных людей), отправляет оповещение владельцу
// (deploy/alerts.md). Текст сообщения урезается, адрес из него вычищается, адрес
// посетителя не сохраняется (только обезличенный хеш). Совместим с PHP 7.4+.

declare(strict_types=1);

require_once __DIR__ . '/ai-guard.php';
require_once __DIR__ . '/alert.php';

date_default_timezone_set('Europe/Moscow');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const CLIENT_ERROR_KINDS = ['error', 'promise', 'react', 'chunk'];
const CLIENT_ERROR_WINDOW = 600;
const CLIENT_ERROR_MIN_EVENTS = 8;
const CLIENT_ERROR_MIN_VISITORS = 3;
const CLIENT_ERROR_PER_IP_HOUR = 6;

function respond(int $status, array $body = []): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function error_state(callable $change)
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-errors-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $handle = @fopen($dir . '/errors.json', 'c+');
    if (!$handle) { $none = []; return $change($none); }
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    if (!is_array($state)) $state = [];
    $result = $change($state);
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

// Короткий безопасный текст: без адресов с параметрами, переводов строк и длинных хвостов.
function short_text($value, int $limit): string
{
    $text = guard_clean(is_string($value) ? $value : '');
    $text = (string) preg_replace('~https?://[^\s)\'"]+~', '[url]', $text);
    $text = (string) preg_replace('/\s+/u', ' ', $text);
    return mb_substr(trim($text), 0, $limit);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['health'])) respond(200, ['ok' => true]);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

$config = logos_read_config();
$denied = guard_check_request($config);
if ($denied !== null) respond($denied[0], ['error' => $denied[1]]);

$raw = file_get_contents('php://input', false, null, 0, 4096);
$body = json_decode($raw ?: '', true);
if (!is_array($body)) respond(400, ['error' => 'Пустой запрос.']);
$kind = in_array($body['k'] ?? '', CLIENT_ERROR_KINDS, true) ? (string) $body['k'] : 'error';
$message = short_text($body['m'] ?? '', 200);
if ($message === '') respond(400, ['error' => 'Пустой запрос.']);
$source = short_text(basename((string) parse_url((string) ($body['s'] ?? ''), PHP_URL_PATH)), 80);
$page = '/' . ltrim(short_text((string) parse_url((string) ($body['p'] ?? '/'), PHP_URL_PATH), 80), '/');
$visitor = substr(hash('sha256', guard_client_ip($config) . __DIR__), 0, 12);
$signature = substr(sha1($kind . '|' . $message . '|' . $source), 0, 10);

$summary = error_state(function (&$state) use ($visitor, $kind, $message, $source, $page, $signature) {
    $now = time();
    $events = array_values(array_filter((array) ($state['events'] ?? []), function ($event) use ($now) { return $now - (int) $event['t'] < CLIENT_ERROR_WINDOW; }));
    $mine = 0;
    foreach ($events as $event) if ($event['v'] === $visitor && $now - (int) $event['t'] < 3600) $mine += 1;
    if ($mine >= CLIENT_ERROR_PER_IP_HOUR) return null;
    $events[] = ['t' => $now, 'v' => $visitor, 'k' => $kind, 'm' => $message, 's' => $source, 'p' => $page, 'g' => $signature];
    $state['events'] = array_slice($events, -300);
    $visitors = [];
    $groups = [];
    foreach ($state['events'] as $event) {
        $visitors[$event['v']] = true;
        $groups[$event['g']] = ($groups[$event['g']] ?? 0) + 1;
    }
    arsort($groups);
    $top = array_key_first($groups);
    $sample = null;
    foreach ($state['events'] as $event) if ($event['g'] === $top) $sample = $event;
    return ['events' => count($state['events']), 'visitors' => count($visitors), 'sample' => $sample, 'chunk' => count(array_filter($state['events'], function ($event) { return $event['k'] === 'chunk'; }))];
});

if (is_array($summary) && $summary['visitors'] >= CLIENT_ERROR_MIN_VISITORS && ($summary['events'] >= CLIENT_ERROR_MIN_EVENTS || $summary['chunk'] >= CLIENT_ERROR_MIN_VISITORS)) {
    $sample = $summary['sample'];
    $text = 'Сбои страниц у ' . $summary['visitors'] . ' посетителей за 10 минут (всего ' . $summary['events'] . ').'
        . "\nЧаще всего: [" . $sample['k'] . '] ' . $sample['m'] . ($sample['s'] !== '' ? ' (файл ' . $sample['s'] . ')' : '') . ', страница ' . $sample['p'] . '.'
        . "\nЕсли это началось после обновления сайта, откатите сборку или проверьте, что залита вся папка dist (в том числе assets).";
    logos_alert($config, 'client-errors', 'critical', 'Сайт ломается у посетителей', $text, 3600);
}
respond(204);
