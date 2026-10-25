<?php
// Настройки ИИ-агента. Скопируйте файл в logos-ai-config.php и положите на хостинг
// РЯДОМ с папкой сайта, а не внутрь неё (подробно — deploy/ai-agent.md):
//   …/www/logos-ai-config.php        ← сюда
//   …/www/logos-guide.ru/index.html  ← корень сайта
// Ключ не коммитьте в репозиторий и не загружайте в публичные релизы.
return [
    'api_key' => 'sk-…',                 // ключ DeepSeek: platform.deepseek.com → API keys
    'model' => 'deepseek-v4-flash',      // или deepseek-v4-pro
    // 'monthly_budget_usd' => 2.0,      // бюджет на месяц, делится на дни
    // 'per_ip_daily' => 15,              // вопросов в день с одного IP
    // 'deep_per_ip_daily' => 4,         // из них «Подумать глубже»
    // 'per_ip_limit' => 8,              // вопросов с одного IP за 10 минут
    // 'max_tokens' => 1400,              // предел длины ответа

    // Оповещения владельцу (deploy/alerts.md): хватит одного способа.
    // 'alert_telegram_token' => '123456:ABC…',   // токен бота от @BotFather
    // 'alert_telegram_chat' => '123456789',      // ваш chat id (узнать у @userinfobot)
    // 'alert_webhook' => 'https://…',            // Slack, Discord, Mattermost: принимает {"text": …}
    // 'alert_email' => 'you@example.com',        // письмо через mail() хостинга

    // Защита (deploy/ai-agent.md, раздел «Защита ИИ»). Всё необязательно.
    // 'reports_key' => 'длинная-случайная-строка', // ключ для ?health&key=… (расход, модель), общий с report.php
    // 'guard_secret' => 'ещё-одна-длинная-случайная-строка', // секрет подписи ответов; по умолчанию берётся из ключа API
    // 'allowed_hosts' => ['www.logos-guide.ru'], // дополнительные адреса сайта (если он открывается не только по основному)
    // За прокси (например, Cloudflare) посетители иначе выглядят одним адресом:
    // 'ip_header' => 'HTTP_CF_CONNECTING_IP',
    // 'trusted_proxies' => ['…адрес прокси…'],
];
