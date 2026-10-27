<?php
// Web Push без сторонних библиотек: ключи VAPID (RFC 8292) и шифрование
// aes128gcm (RFC 8291) на расширении openssl, отправка через curl. Хватает
// обычного PHP 7.4+ на хостинге reg.ru. Подключается из notify.php.

declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

// Начало DER-записи открытого ключа P-256: дальше идут 65 байт точки 04||x||y.
const PUSH_P256_SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

function b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    $raw = base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4), true);
    return $raw === false ? '' : $raw;
}

// Открытый ключ из 65 байт точки в объект openssl.
function push_public_key(string $point)
{
    if (strlen($point) !== 65 || $point[0] !== "\x04") return false;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(hex2bin(PUSH_P256_SPKI_PREFIX) . $point), 64, "\n") . "-----END PUBLIC KEY-----\n";
    return openssl_pkey_get_public($pem);
}

function push_new_key()
{
    return openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
}

// 65 байт точки открытого ключа из пары ключей.
function push_point($key): string
{
    $ec = openssl_pkey_get_details($key)['ec'];
    return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
}

// Ключи VAPID создаются один раз и лежат рядом с остальными данными push.
function push_vapid(string $file): array
{
    if (is_file($file)) {
        $saved = json_decode((string) file_get_contents($file), true);
        if (is_array($saved) && !empty($saved['private']) && !empty($saved['public'])) return $saved;
    }
    $key = push_new_key();
    if (!$key || !openssl_pkey_export($key, $pem)) throw new RuntimeException('openssl не смог создать ключ P-256.');
    $saved = ['public' => b64url_encode(push_point($key)), 'private' => $pem, 'created' => date('c')];
    if (!is_dir(dirname($file))) @mkdir(dirname($file), 0700, true);
    if (@file_put_contents($file, json_encode($saved, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) throw new RuntimeException('Не удалось сохранить ключи уведомлений.');
    @chmod($file, 0600);
    return $saved;
}

// Подпись ES256 в DER от openssl → 64 байта r||s, как требует JWT.
function push_der_to_raw(string $der): string
{
    $offset = 3 + (ord($der[1]) & 0x80 ? 1 : 0);
    $parts = [];
    for ($i = 0; $i < 2; $i++) {
        $length = ord($der[$offset]);
        $parts[] = str_pad(ltrim(substr($der, $offset + 1, $length), "\0"), 32, "\0", STR_PAD_LEFT);
        $offset += $length + 2;
    }
    return $parts[0] . $parts[1];
}

function push_vapid_header(string $endpoint, array $vapid, string $contact): string
{
    $url = parse_url($endpoint);
    $audience = $url['scheme'] . '://' . $url['host'] . (isset($url['port']) ? ':' . $url['port'] : '');
    $head = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = b64url_encode(json_encode(['aud' => $audience, 'exp' => time() + 12 * 3600, 'sub' => $contact], JSON_UNESCAPED_SLASHES));
    if (!openssl_sign("$head.$claims", $signature, $vapid['private'], OPENSSL_ALGO_SHA256)) throw new RuntimeException('openssl не смог подписать VAPID.');
    return 'vapid t=' . $head . '.' . $claims . '.' . b64url_encode(push_der_to_raw($signature)) . ', k=' . $vapid['public'];
}

// Тело сообщения для одного браузера: RFC 8291, одна запись aes128gcm.
function push_encrypt(string $payload, string $userPublic, string $authSecret): string
{
    $peer = push_public_key($userPublic);
    if (!$peer || strlen($authSecret) !== 16) throw new InvalidArgumentException('Неверные ключи подписки.');
    $local = push_new_key();
    $localPoint = push_point($local);
    $shared = openssl_pkey_derive($peer, $local, 32);
    if ($shared === false) throw new RuntimeException('openssl не смог вычислить общий ключ.');
    $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . $userPublic . $localPoint, $authSecret);
    $salt = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($cipher === false) throw new RuntimeException('openssl не смог зашифровать сообщение.');
    return $salt . pack('N', 4096) . chr(65) . $localPoint . $cipher . $tag;
}

// Рассылка пачками по 50 параллельных запросов. Возвращает HTTP-код ответа
// сервиса для каждой подписки (0 — не достучались).
function push_send_many(array $subscriptions, string $payload, array $vapid, string $contact, int $ttl = 3600, string $urgency = 'normal'): array
{
    $codes = [];
    foreach (array_chunk($subscriptions, 50, true) as $chunk) {
        $multi = curl_multi_init();
        $handles = [];
        foreach ($chunk as $id => $subscription) {
            try {
                $body = push_encrypt($payload, b64url_decode($subscription['p256dh']), b64url_decode($subscription['auth']));
                $authorization = push_vapid_header($subscription['endpoint'], $vapid, $contact);
            } catch (Throwable $error) {
                $codes[$id] = 0;
                continue;
            }
            $handle = curl_init($subscription['endpoint']);
            curl_setopt_array($handle, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 15,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/octet-stream',
                    'Content-Encoding: aes128gcm',
                    'TTL: ' . $ttl,
                    'Urgency: ' . $urgency,
                    'Authorization: ' . $authorization,
                ],
            ]);
            curl_multi_add_handle($multi, $handle);
            $handles[$id] = $handle;
        }
        do {
            $status = curl_multi_exec($multi, $running);
            if ($running) curl_multi_select($multi, 1.0);
        } while ($running && $status === CURLM_OK);
        foreach ($handles as $id => $handle) {
            $codes[$id] = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            curl_multi_remove_handle($multi, $handle);
            curl_close($handle);
        }
        curl_multi_close($multi);
    }
    return $codes;
}
