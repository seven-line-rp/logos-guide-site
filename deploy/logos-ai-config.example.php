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
];
