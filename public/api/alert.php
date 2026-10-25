<?php
// Оповещения владельцу сайта: сообщение уходит в Telegram (лучший вариант: мгновенно
// на телефон и бесплатно), в вебхук (Slack, Discord, Mattermost, свой сервис) и/или
// на почту. Подключается из других скриптов (ai-chat.php, client-error.php),
// напрямую недоступен: api/.htaccess закрывает всё, кроме списка эндпоинтов.
// Настройка — deploy/alerts.md. Совместим с PHP 7.4+.

declare(strict_types=1);

// Тот же конфиг, что у ИИ-агента: рядом с папкой сайта или в api/.
function logos_read_config(): array
{
    foreach ([dirname(__DIR__, 2) . '/logos-ai-config.php', __DIR__ . '/ai-config.php'] as $file) {
        if (is_file($file)) {
            $loaded = include $file;
            return is_array($loaded) ? $loaded : [];
        }
    }
    return [];
}

function logos_alert_dir(): string
{
    $dir = rtrim(sys_get_temp_dir(), '/\\') . '/logos-alerts-' . substr(sha1(__DIR__), 0, 10);
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir;
}

function logos_alerts_enabled(array $config): bool
{
    return (!empty($config['alert_telegram_token']) && !empty($config['alert_telegram_chat']))
        || !empty($config['alert_webhook'])
        || !empty($config['alert_email']);
}

// Не чаще одного раза за $cooldown секунд на один ключ: если сайт лежит час,
// придёт одно сообщение, а не сотня. Возвращает true, если отправка была.
function logos_alert_due(string $key, int $cooldown): bool
{
    $handle = @fopen(logos_alert_dir() . '/alerts.json', 'c+');
    if (!$handle) return true;
    flock($handle, LOCK_EX);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    if (!is_array($state)) $state = [];
    $now = time();
    $due = !isset($state[$key]) || $now - (int) $state[$key] >= $cooldown;
    if ($due) $state[$key] = $now;
    foreach ($state as $old => $at) if ($now - (int) $at > 7 * 86400) unset($state[$old]);
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($state));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $due;
}

function logos_alert_post(string $url, string $body, array $headers): bool
{
    if (!function_exists('curl_init')) return false;
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body,
    ]);
    curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return $status >= 200 && $status < 300;
}

// $level: 'critical' (🚨), 'warning' (⚠️), 'info' (ℹ️). В тексте не должно быть
// секретов и адресов посетителей: только обезличенные ключи и счётчики.
function logos_alert(array $config, string $key, string $level, string $title, string $text, int $cooldown = 3600): bool
{
    try {
        if (!logos_alerts_enabled($config) || !logos_alert_due($key, $cooldown)) return false;
        $icons = ['critical' => '🚨', 'warning' => '⚠️', 'info' => 'ℹ️'];
        $host = (string) ($_SERVER['HTTP_HOST'] ?? 'logos-guide');
        $message = ($icons[$level] ?? 'ℹ️') . ' ЛОГОС: ' . $title . "\n" . $text . "\n\n" . $host . ' · ' . date('d.m.Y H:i') . ' МСК';
        $message = mb_substr($message, 0, 3500);
        $sent = false;
        if (!empty($config['alert_telegram_token']) && !empty($config['alert_telegram_chat'])) {
            $url = 'https://api.telegram.org/bot' . rawurlencode((string) $config['alert_telegram_token']) . '/sendMessage';
            $body = json_encode(['chat_id' => (string) $config['alert_telegram_chat'], 'text' => $message, 'disable_web_page_preview' => true], JSON_UNESCAPED_UNICODE);
            $sent = logos_alert_post($url, (string) $body, ['Content-Type: application/json']) || $sent;
        }
        if (!empty($config['alert_webhook'])) {
            $body = json_encode(['text' => $message, 'content' => $message], JSON_UNESCAPED_UNICODE);
            $sent = logos_alert_post((string) $config['alert_webhook'], (string) $body, ['Content-Type: application/json']) || $sent;
        }
        if (!empty($config['alert_email']) && function_exists('mail')) {
            $subject = '=?UTF-8?B?' . base64_encode(($icons[$level] ?? '') . ' ЛОГОС: ' . $title) . '?=';
            $sent = @mail((string) $config['alert_email'], $subject, $message, "Content-Type: text/plain; charset=UTF-8\r\n") || $sent;
        }
        return $sent;
    } catch (Throwable $error) {
        // Оповещение не должно ломать сам сайт.
        error_log('logos-alert: ' . $error->getMessage());
        return false;
    }
}
