<?php
// Настройки ИИ-агента. Скопируйте файл в logos-ai-config.php и положите на хостинг
// РЯДОМ с папкой сайта, а не внутрь неё (подробно — deploy/ai-agent.md):
//   …/www/logos-ai-config.php        ← сюда
//   …/www/logos-guide.ru/index.html  ← корень сайта
// Ключ не коммитьте в репозиторий и не загружайте в публичные релизы.
return [
    'api_key' => 'sk-…',                 // ключ DeepSeek: platform.deepseek.com → API keys
    'model' => 'deepseek-v4-flash',      // или deepseek-v4-pro
    // 'per_ip_limit' => 20,             // сообщений с одного IP за 10 минут
    // 'daily_limit' => 1500,            // сообщений на весь сайт за сутки
    // 'max_tokens' => 1200,             // предел длины ответа
];
