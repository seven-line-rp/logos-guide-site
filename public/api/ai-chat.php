<?php
// ИИ-агент путеводителя: прокси между страницей /ai и DeepSeek API.
// Работает на обычном PHP-хостинге (reg.ru) — без VDS и Node.js. Ключ API
// хранится только на сервере и в браузер не попадает. Где лежит ключ,
// как проверить и как поменять модель — deploy/ai-agent.md.
// Совместим с PHP 7.4+, нужны расширения curl и json (на reg.ru есть).

declare(strict_types=1);

const AI_DEFAULTS = [
    'api_key' => '',
    'model' => 'deepseek-v4-flash',
    'endpoint' => 'https://api.deepseek.com/chat/completions',
    'max_tokens' => 1200,
    'temperature' => 0.6,
    // Ограничения, чтобы чужой скрипт не выжег баланс: запросов с одного IP
    // за 10 минут и всего за сутки.
    'per_ip_limit' => 20,
    'daily_limit' => 1500,
    'college_site' => 'https://xn--c1abcfrgadvgb0b.xn--p1ai',
    'college_cache_hours' => 12,
    'college_max_chars' => 30000,
];

const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 2000;

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
    $config = AI_DEFAULTS;
    // 1) Рядом с папкой сайта (вне public_html) — переживает перезаливку dist.
    // 2) В этой же папке api/ — проще, но файл надо заливать после каждого обновления.
    $candidates = [dirname(__DIR__, 2) . '/logos-ai-config.php', __DIR__ . '/ai-config.php'];
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $loaded = include $file;
            if (is_array($loaded)) $config = array_merge($config, $loaded);
            break;
        }
    }
    $env = getenv('DEEPSEEK_API_KEY');
    if ($env) $config['api_key'] = $env;
    return $config;
}

function storage_dir(): string
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-ai-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

// Скользящее окно запросов в файле с блокировкой: без базы данных.
function within_limits(array $config): bool
{
    $file = storage_dir() . '/limits.json';
    $handle = @fopen($file, 'c+');
    if (!$handle) return true;
    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    $state = json_decode($raw ?: '{}', true);
    if (!is_array($state)) $state = [];
    $now = time();
    $day = gmdate('Y-m-d');
    if (($state['day'] ?? '') !== $day) $state = ['day' => $day, 'total' => 0, 'ips' => []];

    $ip = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__);
    $recent = array_values(array_filter($state['ips'][$ip] ?? [], function ($t) use ($now) { return $now - $t < 600; }));
    $allowed = count($recent) < (int) $config['per_ip_limit'] && $state['total'] < (int) $config['daily_limit'];
    if ($allowed) {
        $recent[] = $now;
        $state['total']++;
    }
    $state['ips'][$ip] = $recent;
    foreach ($state['ips'] as $key => $times) {
        if (!$times || $now - end($times) >= 600) unset($state['ips'][$key]);
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $allowed;
}

function http_get(string $url, int $timeout = 8): string
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_USERAGENT => 'LogosGuideAI/1.0 (+путеводитель колледжа)',
        CURLOPT_HTTPHEADER => ['Accept: text/html,application/json;q=0.9'],
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return is_string($body) && $status >= 200 && $status < 300 ? $body : '';
}

function html_to_text(string $html): string
{
    $html = preg_replace('~<(head|script|style|noscript|svg|iframe|form|header|footer|nav)\b[^>]*>.*?</\1>~is', ' ', $html) ?? '';
    $html = preg_replace('~<(br|/p|/div|/li|/h[1-6]|/tr|/section|/article)\b[^>]*>~i', "\n", $html) ?? '';
    $html = preg_replace('~</(a|span|td|th|strong|b|em|label)>~i', '$0 ', $html) ?? '';
    $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/[ \t\x{00A0}]+/u', ' ', $text) ?? '';
    return trim(preg_replace("/\s*\n\s*/", "\n", $text) ?? '');
}

// Текст колледжлогос.рф. Сайт на WordPress, поэтому сначала берём страницы
// и свежие записи через REST API, а если он закрыт — главную и ссылки с неё.
// Строки меню и подвала повторяются на каждой странице: оставляем одну копию.
function college_pages(array $config): array
{
    $base = rtrim($config['college_site'], '/');
    $pages = [];
    foreach (['/wp-json/wp/v2/pages?per_page=50&_fields=title,content,link', '/wp-json/wp/v2/posts?per_page=15&_fields=title,content,link,date'] as $path) {
        $items = json_decode(http_get($base . $path), true);
        if (!is_array($items)) continue;
        foreach ($items as $item) {
            if (!is_array($item)) continue;
            $title = html_to_text((string) ($item['title']['rendered'] ?? ''));
            $date = isset($item['date']) ? ' (' . substr((string) $item['date'], 0, 10) . ')' : '';
            $pages[] = ['title' => $title . $date, 'url' => (string) ($item['link'] ?? ''), 'text' => html_to_text((string) ($item['content']['rendered'] ?? ''))];
        }
    }
    if ($pages) return $pages;

    $home = http_get($base . '/');
    if ($home === '') return [];
    $pages[] = ['title' => 'Главная', 'url' => $base . '/', 'text' => html_to_text($home)];
    $host = parse_url($base, PHP_URL_HOST);
    preg_match_all('~href=["\']([^"\'#]+)["\']~i', $home, $matches);
    $links = [];
    foreach ($matches[1] as $href) {
        $href = html_entity_decode($href);
        if (strpos($href, '/') === 0 && strpos($href, '//') !== 0) $href = $base . $href;
        if (parse_url($href, PHP_URL_HOST) !== $host || strpos($href, '?') !== false) continue;
        if (preg_match('~/(wp-|feed|tag/|author/)|\.(pdf|docx?|xlsx?|jpe?g|png|gif|webp|zip|rar)$~i', $href)) continue;
        $links[rtrim($href, '/')] = true;
    }
    unset($links[$base]);
    $started = microtime(true);
    foreach (array_slice(array_keys($links), 0, 15) as $url) {
        if (microtime(true) - $started > 20) break;
        $html = http_get($url, 6);
        if ($html === '') continue;
        preg_match('~<title[^>]*>(.*?)</title>~is', $html, $title);
        $pages[] = ['title' => html_to_text($title[1] ?? $url), 'url' => rawurldecode($url), 'text' => html_to_text($html)];
    }
    return $pages;
}

function college_context(array $config): string
{
    $file = storage_dir() . '/college.txt';
    $fresh = is_file($file) && time() - filemtime($file) < (int) $config['college_cache_hours'] * 3600;
    if ($fresh) return (string) file_get_contents($file);

    $pages = college_pages($config);
    if (!$pages) {
        // Сайт колледжа не ответил: отдаём прошлый кэш и попробуем через час.
        if (is_file($file)) {
            @touch($file, time() - ((int) $config['college_cache_hours'] - 1) * 3600);
            return (string) file_get_contents($file);
        }
        return '';
    }
    $seen = [];
    $out = '';
    foreach ($pages as $page) {
        $lines = [];
        foreach (explode("\n", $page['text']) as $line) {
            $key = mb_strtolower($line);
            if (mb_strlen($line) < 3 || isset($seen[$key])) continue;
            $seen[$key] = true;
            $lines[] = $line;
        }
        if (!$lines) continue;
        $out .= "\n### " . $page['title'] . ($page['url'] ? ' — ' . $page['url'] : '') . "\n" . implode("\n", $lines) . "\n";
        if (mb_strlen($out) >= (int) $config['college_max_chars']) break;
    }
    $out = mb_substr(trim($out), 0, (int) $config['college_max_chars']);
    @file_put_contents($file, $out, LOCK_EX);
    return $out;
}

function system_prompt(array $config): string
{
    $knowledge = is_file(__DIR__ . '/ai-knowledge.txt') ? (string) file_get_contents(__DIR__ . '/ai-knowledge.txt') : '';
    $college = college_context($config);
    $today = date('d.m.Y');
    $prompt = <<<TXT
Ты — ИИ-агент сайта «ЛОГОС: Путеводитель» (тестовая версия). Сегодня {$today}.
Помогаешь студентам, абитуриентам, родителям и гостям Технического колледжа «Логос» в Боровске: подсказываешь, где находятся кабинеты и как пройти, объясняешь разделы сайта, рассказываешь о колледже, поступлении и специальностях, а также просто поддерживаешь дружескую беседу.

Правила:
- Отвечай на языке собеседника (обычно по-русски), коротко и по делу: 1–5 предложений или короткий список. Используй Markdown только для **жирного**, списков и ссылок.
- Про помещения и сайт опирайся на «Базу знаний путеводителя», про колледж — на «Текст сайта колледжлогос.рф» (он свежее) и затем на базу знаний.
- Давай ссылки на разделы путеводителя относительными адресами, например [маршрут до актового зала](/route?from=entrance-1&to=auditorium-104) или [кабинет 214 на карте](/map?floor=2&room=library-214). Используй только id из базы знаний.
- Если точного ответа в материалах нет (сроки приёма, расписание, стоимость, документы, телефоны), честно скажи об этом и посоветуй уточнить на колледжлогос.рф или в приёмной комиссии. Не выдумывай факты, номера кабинетов, имена и даты.
- Не проси и не собирай персональные данные. Если человек пишет о проблеме со здоровьем или безопасностью, посоветуй обратиться к сотрудникам колледжа, в медпункт или по номеру 112.
- Ты ИИ и можешь ошибаться — при важных решениях советуй проверить информацию у колледжа.

# База знаний путеводителя
{$knowledge}
TXT;
    if ($college !== '') $prompt .= "\n\n# Текст сайта колледжлогос.рф (обновляется раз в " . (int) $config['college_cache_hours'] . " ч.)\n" . $college;
    return $prompt;
}

function read_messages(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 200000);
    $body = json_decode($raw ?: '', true);
    if (!is_array($body) || !isset($body['messages']) || !is_array($body['messages'])) respond(400, ['error' => 'Пустой запрос.']);
    $messages = [];
    foreach (array_slice($body['messages'], -MAX_MESSAGES) as $message) {
        $role = $message['role'] ?? '';
        $content = $message['content'] ?? '';
        if (!in_array($role, ['user', 'assistant'], true) || !is_string($content)) continue;
        $content = trim(mb_substr($content, 0, MAX_MESSAGE_CHARS));
        if ($content !== '') $messages[] = ['role' => $role, 'content' => $content];
    }
    while ($messages && $messages[0]['role'] !== 'user') array_shift($messages);
    if (!$messages || end($messages)['role'] !== 'user') respond(400, ['error' => 'Напишите сообщение.']);
    return $messages;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['health'])) {
    $config = load_config();
    respond(200, ['ok' => $config['api_key'] !== '', 'model' => $config['model'], 'knowledge' => is_file(__DIR__ . '/ai-knowledge.txt'), 'curl' => function_exists('curl_init')]);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

// Запросы только со своего сайта: чужие страницы не смогут тратить баланс из браузера.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) respond(403, ['error' => 'Запрос с другого сайта.']);

$config = load_config();
if ($config['api_key'] === '' || !function_exists('curl_init')) respond(503, ['error' => 'ИИ-агент ещё не настроен на сервере.']);
$messages = read_messages();
if (!within_limits($config)) respond(429, ['error' => 'Слишком много сообщений подряд. Подождите несколько минут.']);

array_unshift($messages, ['role' => 'system', 'content' => system_prompt($config)]);
$curl = curl_init($config['endpoint']);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 90,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $config['api_key']],
    CURLOPT_POSTFIELDS => json_encode([
        'model' => $config['model'],
        'messages' => $messages,
        'max_tokens' => (int) $config['max_tokens'],
        'temperature' => (float) $config['temperature'],
        'stream' => false,
    ], JSON_UNESCAPED_UNICODE),
]);
$raw = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

$data = is_string($raw) ? json_decode($raw, true) : null;
$reply = is_array($data) ? trim((string) ($data['choices'][0]['message']['content'] ?? '')) : '';
if ($status === 200 && $reply !== '') respond(200, ['reply' => $reply]);

error_log('logos-ai: DeepSeek ' . $status . ' ' . ($curlError ?: substr((string) $raw, 0, 300)));
$messagesByStatus = [
    0 => 'Не удалось связаться с DeepSeek. Попробуйте позже.',
    401 => 'Сервер ИИ отклонил ключ API — сообщите команде сайта.',
    402 => 'На счёте DeepSeek закончились средства — сообщите команде сайта.',
    429 => 'ИИ сейчас перегружен. Попробуйте через минуту.',
];
respond(502, ['error' => $messagesByStatus[$status] ?? 'ИИ не ответил. Попробуйте ещё раз.']);
