<?php
// ИИ-агент путеводителя: прокси между страницей /ai и DeepSeek API.
// Работает на обычном PHP-хостинге (reg.ru) — без VDS и Node.js. Ключ API
// хранится только на сервере и в браузер не попадает. Где лежит ключ,
// как проверить и как поменять модель — deploy/ai-agent.md.
// Совместим с PHP 7.4+, нужны расширения curl и json (на reg.ru есть).

declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const AI_DEFAULTS = [
    'api_key' => '',
    'model' => 'deepseek-v4-flash',
    'endpoint' => 'https://api.deepseek.com/chat/completions',
    'max_tokens' => 800,
    'temperature' => 0.6,
    // Бюджет: $2 в месяц на ~200 человек. Каждый ответ считается по
    // настоящему расходу токенов (usage от DeepSeek) и ценам ниже — за
    // 1 млн токенов, по дорогому «пиковому» тарифу Flash. Месячный бюджет
    // делится на дни; когда дневная доля потрачена, агент отдыхает до полуночи
    // (по Москве). Подробный расчёт — deploy/ai-agent.md.
    'monthly_budget_usd' => 2.0,
    'price_input_miss' => 0.30,
    'price_input_hit' => 0.006,
    'price_output' => 1.20,
    // Лимиты на человека (по IP): сообщений в день, из них «Подумать
    // глубже», и не больше per_ip_limit сообщений за 10 минут.
    'per_ip_daily' => 8,
    'deep_per_ip_daily' => 2,
    'per_ip_limit' => 5,
    // Жёсткий потолок сообщений за сутки на весь сайт — страховка, если
    // DeepSeek не прислал расход.
    'daily_limit' => 250,
    'college_site' => 'https://xn--c1abcfrgadvgb0b.xn--p1ai',
    'college_cache_hours' => 12,
    'college_max_chars' => 15000,
    // Картинки: пробуем отправить их модели; если DeepSeek их не принимает,
    // агент ответит без них и честно скажет, что не видит изображение.
    // vision_model — отдельная модель для запросов с картинками (если есть).
    'vision' => true,
    'vision_model' => '',
    // «Подумать глубже»: режим рассуждений DeepSeek, отвечает дольше и точнее.
    'deep_max_tokens' => 2500,
];

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1500000;

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

// Состояние лимитов на сегодня — файл с блокировкой, без базы данных:
// потрачено долларов, сообщений всего и по каждому IP (обезличенный хеш).
function with_limits(callable $change)
{
    $handle = @fopen(storage_dir() . '/limits.json', 'c+');
    if (!$handle) { $none = null; return $change($none); }
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    $day = date('Y-m-d');
    if (!is_array($state) || ($state['day'] ?? '') !== $day) $state = ['day' => $day, 'total' => 0, 'spent' => 0.0, 'ips' => []];
    $result = $change($state);
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

function daily_budget(array $config): float
{
    return (float) $config['monthly_budget_usd'] / (int) date('t');
}

function visitor_key(): string
{
    return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . __DIR__), 0, 16);
}

// Проверка до запроса к DeepSeek. Возвращает [ошибка или '', осталось сообщений].
function take_limit(array $config, bool $deep): array
{
    return with_limits(function (&$state) use ($config, $deep) {
        if ($state === null) return ['', null];
        $now = time();
        $key = visitor_key();
        $me = $state['ips'][$key] ?? ['r' => [], 'n' => 0, 'd' => 0];
        $me['r'] = array_values(array_filter($me['r'], function ($t) use ($now) { return $now - $t < 600; }));
        $left = (int) $config['per_ip_daily'] - $me['n'];
        // Запас на один ответ: обычный ≈ $0.0015, «глубже» ≈ $0.005.
        $reserve = $deep ? 0.005 : 0.0015;
        if ($state['spent'] + $reserve > daily_budget($config) || $state['total'] >= (int) $config['daily_limit']) {
            return ['Лимит ИИ-агента на сегодня исчерпан — он отдыхает до полуночи. Загляните завтра!', 0];
        }
        if ($left <= 0) return ['Вы задали все ' . (int) $config['per_ip_daily'] . ' вопросов на сегодня. Новые — завтра, после полуночи.', 0];
        if ($deep && $me['d'] >= (int) $config['deep_per_ip_daily']) return ['«Подумать глубже» на сегодня закончилось. Выключите его — обычный режим ещё работает.', $left];
        if (count($me['r']) >= (int) $config['per_ip_limit']) return ['Слишком много сообщений подряд. Подождите несколько минут.', $left];
        $me['r'][] = $now;
        $me['n'] += 1;
        if ($deep) $me['d'] += 1;
        $state['ips'][$key] = $me;
        $state['total'] += 1;
        return ['', $left - 1];
    });
}

// Если DeepSeek не ответил, сообщение человеку не засчитываем.
function refund_limit(bool $deep): void
{
    with_limits(function (&$state) use ($deep) {
        $key = visitor_key();
        if ($state === null || !isset($state['ips'][$key])) return;
        $state['ips'][$key]['n'] = max(0, $state['ips'][$key]['n'] - 1);
        if ($deep) $state['ips'][$key]['d'] = max(0, $state['ips'][$key]['d'] - 1);
        array_pop($state['ips'][$key]['r']);
        $state['total'] = max(0, $state['total'] - 1);
    });
}

function request_cost(array $config, array $usage): float
{
    $hit = (int) ($usage['prompt_cache_hit_tokens'] ?? 0);
    $miss = (int) ($usage['prompt_cache_miss_tokens'] ?? max(0, (int) ($usage['prompt_tokens'] ?? 0) - $hit));
    $out = (int) ($usage['completion_tokens'] ?? 0);
    return ($hit * (float) $config['price_input_hit'] + $miss * (float) $config['price_input_miss'] + $out * (float) $config['price_output']) / 1000000;
}

function record_cost(float $usd): void
{
    with_limits(function (&$state) use ($usd) {
        if ($state !== null) $state['spent'] = round($state['spent'] + $usd, 6);
    });
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

// Объявления: сохранённые со страницы /admin (logos-notices.json рядом с папкой
// сайта, см. api/notices.php), иначе public/notices.json в корне сайта.
function notices_text(): string
{
    $file = is_file(dirname(__DIR__, 2) . '/logos-notices.json') ? dirname(__DIR__, 2) . '/logos-notices.json' : dirname(__DIR__) . '/notices.json';
    $list = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    if (!is_array($list)) return '';
    $now = time();
    $lines = [];
    foreach (array_slice($list, 0, 30) as $notice) {
        if (!is_array($notice) || empty($notice['title']) || empty($notice['roomId'])) continue;
        if (!empty($notice['from']) && strtotime((string) $notice['from']) > $now) continue;
        if (!empty($notice['to']) && strtotime((string) $notice['to']) < $now) continue;
        $type = ['closed' => 'ЗАКРЫТО', 'event' => 'СОБЫТИЕ', 'info' => 'ВАЖНО'][$notice['type'] ?? ''] ?? 'ВАЖНО';
        $lines[] = '- ' . $type . ' [id: ' . mb_substr((string) $notice['roomId'], 0, 40) . '] ' . mb_substr((string) $notice['title'], 0, 120) . (empty($notice['text']) ? '' : ' — ' . mb_substr((string) $notice['text'], 0, 240));
    }
    return implode("\n", $lines);
}

function system_prompt(array $config): string
{
    $knowledge = is_file(__DIR__ . '/ai-knowledge.txt') ? (string) file_get_contents(__DIR__ . '/ai-knowledge.txt') : '';
    $college = college_context($config);
    $days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    $today = date('d.m.Y') . ', ' . $days[(int) date('w')] . ', ' . date('H:i');
    $prompt = <<<TXT
Ты — ЛОГОС AI, ИИ-помощник сайта «ЛОГОС: Путеводитель» (тестовая версия). Сейчас {$today} (время московское).
Помогаешь студентам, абитуриентам, родителям и гостям Технического колледжа «Логос» в Боровске: подсказываешь, где находятся кабинеты и как пройти, объясняешь разделы сайта, рассказываешь о колледже, поступлении и специальностях, а также просто поддерживаешь дружескую беседу.

Правила:
- Отвечай на языке собеседника (обычно по-русски), коротко и по делу: 1–5 предложений или короткий список. Используй Markdown только для **жирного**, списков и ссылок.
- Про помещения и сайт опирайся на «Базу знаний путеводителя», про колледж — на «Текст сайта колледжлогос.рф» (он свежее) и затем на базу знаний.
- Давай ссылки на разделы путеводителя относительными адресами, например [маршрут до актового зала](/route?from=entrance-1&to=auditorium-104) или [кабинет 214 на карте](/map?floor=2&room=library-214). Используй только id из базы знаний.
- Если точного ответа в материалах нет (сроки приёма, расписание, стоимость, документы, телефоны), честно скажи об этом и посоветуй уточнить на колледжлогос.рф или в приёмной комиссии. Не выдумывай факты, номера кабинетов, имена и даты.
- Не проси и не собирай персональные данные. Если человек пишет о проблеме со здоровьем или безопасностью, посоветуй обратиться к сотрудникам колледжа, в медпункт или по номеру 112.
- Когда спрашивают, где место или как пройти, ВСЕГДА дай ссылку на маршрут вида [Маршрут до …](/route?from=entrance-1&to=<id>) — на сайте под ответом появится 3D-карта с этим путём. Если человек назвал, откуда идёт, подставь это помещение в from.
- Если прислали фото расписания, перечисли пары списком: «время — предмет — [кабинет N](/route?from=entrance-1&to=<id>)» для каждой пары, где кабинет есть в базе знаний, и предложи добавить пары в «Моё расписание» (/schedule).
- Если прислали другую картинку (объявление, табличку, план, задачу), сначала коротко опиши, что на ней важного, затем ответь на вопрос. Номер кабинета с картинки сразу свяжи с картой и маршрутом.
- Учитывай «Объявления» ниже: если помещение закрыто или там событие, предупреди об этом.
- Помогай и с учёбой: объясняй темы простыми словами и по шагам, но не выдавай готовые работы за студента — подталкивай к решению.
- Ты ИИ и можешь ошибаться — при важных решениях советуй проверить информацию у колледжа.

# База знаний путеводителя
{$knowledge}
TXT;
    $notices = notices_text();
    if ($notices !== '') $prompt .= "\n\n# Объявления на карте (действуют сейчас)\n" . $notices;
    if ($college !== '') $prompt .= "\n\n# Текст сайта колледжлогос.рф (обновляется раз в " . (int) $config['college_cache_hours'] . " ч.)\n" . $college;
    return $prompt;
}

function valid_image($image): bool
{
    return is_string($image) && strlen($image) <= MAX_IMAGE_BYTES * 4 / 3 + 100
        && preg_match('~^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$~', $image) === 1;
}

function read_request(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 6000000);
    if (strlen((string) $raw) >= 6000000) respond(413, ['error' => 'Картинки слишком большие. Попробуйте одну или поменьше.']);
    $body = json_decode($raw ?: '', true);
    if (!is_array($body) || !isset($body['messages']) || !is_array($body['messages'])) respond(400, ['error' => 'Пустой запрос.']);
    $messages = [];
    $images = [];
    $list = array_slice($body['messages'], -MAX_MESSAGES);
    foreach ($list as $index => $message) {
        $role = $message['role'] ?? '';
        $content = $message['content'] ?? '';
        if (!in_array($role, ['user', 'assistant'], true) || !is_string($content)) continue;
        $content = trim(mb_substr($content, 0, MAX_MESSAGE_CHARS));
        $last = $index === count($list) - 1;
        if ($last && $role === 'user' && isset($message['images']) && is_array($message['images'])) {
            $images = array_values(array_filter(array_slice($message['images'], 0, MAX_IMAGES), 'valid_image'));
        }
        if ($content === '' && !($last && $images)) continue;
        $messages[] = ['role' => $role, 'content' => $content];
    }
    while ($messages && $messages[0]['role'] !== 'user') array_shift($messages);
    if (!$messages || end($messages)['role'] !== 'user') respond(400, ['error' => 'Напишите сообщение.']);
    return ['messages' => $messages, 'images' => $images, 'deep' => !empty($body['deep'])];
}

function deepseek(array $config, array $payload, int $timeout): array
{
    $curl = curl_init($config['endpoint']);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $config['api_key']],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    $data = is_string($raw) ? json_decode($raw, true) : null;
    $message = is_array($data) ? ($data['choices'][0]['message'] ?? []) : [];
    return [
        'status' => $status,
        'reply' => trim((string) ($message['content'] ?? '')),
        'reasoning' => trim((string) ($message['reasoning_content'] ?? '')),
        'usage' => is_array($data['usage'] ?? null) ? $data['usage'] : null,
        'log' => $error ?: substr((string) $raw, 0, 300),
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['health'])) {
    $config = load_config();
    $today = with_limits(function (&$state) { return $state === null ? null : ['messages' => $state['total'], 'spent_usd' => round($state['spent'], 4)]; });
    respond(200, ['ok' => $config['api_key'] !== '', 'model' => $config['model'], 'vision' => (bool) $config['vision'], 'knowledge' => is_file(__DIR__ . '/ai-knowledge.txt'), 'curl' => function_exists('curl_init'), 'today' => $today, 'daily_budget_usd' => round(daily_budget($config), 4)]);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['error' => 'Метод не поддерживается.']);

// Запросы только со своего сайта: чужие страницы не смогут тратить баланс из браузера.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) respond(403, ['error' => 'Запрос с другого сайта.']);

$config = load_config();
if ($config['api_key'] === '' || !function_exists('curl_init')) respond(503, ['error' => 'ИИ-агент ещё не настроен на сервере.']);
$request = read_request();
[$limitError, $left] = take_limit($config, $request['deep']);
if ($limitError !== '') respond(429, ['error' => $limitError, 'left' => $left]);

$messages = $request['messages'];
$images = $config['vision'] ? $request['images'] : [];
$deep = $request['deep'];
$system = ['role' => 'system', 'content' => system_prompt($config)];
$lastIndex = count($messages) - 1;
$question = $messages[$lastIndex]['content'];

// Варианты запроса от полного к простому: если DeepSeek отвечает 400/422
// (не знает параметр thinking или не принимает картинки), пробуем следующий.
$withImages = $messages;
if ($images) {
    $parts = [['type' => 'text', 'text' => $question !== '' ? $question : 'Что на этой картинке?']];
    foreach ($images as $image) $parts[] = ['type' => 'image_url', 'image_url' => ['url' => $image]];
    $withImages[$lastIndex]['content'] = $parts;
}
$textOnly = $messages;
if ($request['images']) {
    $textOnly[$lastIndex]['content'] = trim($question . "\n\n[Пользователь приложил изображение (" . count($request['images']) . " шт.), но ты не можешь его видеть. Скажи об этом одной фразой и попроси описать словами или переписать текст с картинки, затем помоги по описанию.]");
}
$thinking = ['type' => $deep ? 'enabled' : 'disabled'];
$base = [
    'max_tokens' => (int) ($deep ? $config['deep_max_tokens'] : $config['max_tokens']),
    'stream' => false,
];
if (!$deep) $base['temperature'] = (float) $config['temperature'];
$variants = [];
if ($images) {
    $model = $config['vision_model'] ?: $config['model'];
    $variants[] = ['vision' => true, 'payload' => $base + ['model' => $model, 'messages' => array_merge([$system], $withImages), 'thinking' => $thinking]];
    $variants[] = ['vision' => true, 'payload' => $base + ['model' => $model, 'messages' => array_merge([$system], $withImages)]];
}
$variants[] = ['vision' => !$request['images'], 'payload' => $base + ['model' => $config['model'], 'messages' => array_merge([$system], $textOnly), 'thinking' => $thinking]];
$variants[] = ['vision' => !$request['images'], 'payload' => $base + ['model' => $config['model'], 'messages' => array_merge([$system], $textOnly)]];

foreach ($variants as $variant) {
    $result = deepseek($config, $variant['payload'], $deep ? 150 : 90);
    // Платим и за неудачные попытки, если DeepSeek прислал расход.
    if ($result['usage']) record_cost(request_cost($config, $result['usage']));
    elseif ($result['status'] === 200) record_cost($deep ? 0.005 : 0.0015);
    if ($result['status'] === 200 && $result['reply'] !== '') {
        $body = ['reply' => $result['reply'], 'vision' => $variant['vision'], 'left' => $left];
        if ($deep && $result['reasoning'] !== '') $body['reasoning'] = mb_substr($result['reasoning'], 0, 8000);
        respond(200, $body);
    }
    error_log('logos-ai: DeepSeek ' . $result['status'] . ' ' . $result['log']);
    if (!in_array($result['status'], [400, 422], true)) break;
}

refund_limit($deep);
$messagesByStatus = [
    0 => 'Не удалось связаться с DeepSeek. Попробуйте позже.',
    401 => 'Сервер ИИ отклонил ключ API — сообщите команде сайта.',
    402 => 'На счёте DeepSeek закончились средства — сообщите команде сайта.',
    429 => 'ИИ сейчас перегружен. Попробуйте через минуту.',
];
respond(502, ['error' => $messagesByStatus[$result['status']] ?? 'ИИ не ответил. Попробуйте ещё раз.']);
