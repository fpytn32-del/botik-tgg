const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    TELEGRAM_TOKEN: '8334802447:AAGD7H0akQpXgWRlh1xWaXsGmjV7DXJY8eM',
    ADMIN_ID: 7637020943,
    BOT_NAME: '🍓 Клубничка Трекер',
    GIVEAWAY_WORD: 'КЛУБНИЧКА',
    GIVEAWAY_ACTIVE: true
};

// ==================== БАЗА ДАННЫХ ====================
const db = new sqlite3.Database('./bot.db');

// Инициализация базы
function initDatabase() {
    console.log('🔄 Инициализация базы данных...');
    
    db.serialize(() => {
        // Таблица пользователей
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Таблица участников розыгрыша
        db.run(`CREATE TABLE IF NOT EXISTS giveaway_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            username TEXT,
            first_name TEXT,
            entered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✅ База данных готова');
    });
}

// ==================== TELEGRAM БОТ ====================
const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN, { 
    polling: true
});

console.log('🤖 Telegram бот запущен');

// ==================== ВЕБ-СЕРВЕР ====================
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== ФУНКЦИИ ====================

function registerUser(userData) {
    const { id, username, first_name, last_name } = userData;
    db.run(
        'INSERT OR REPLACE INTO users (user_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
        [id, username, first_name, last_name]
    );
}

function addGiveawayParticipant(userData) {
    const { id, username, first_name } = userData;
    db.run(
        'INSERT OR IGNORE INTO giveaway_participants (user_id, username, first_name) VALUES (?, ?, ?)',
        [id, username, first_name]
    );
}

// ==================== КОМАНДЫ БОТА ====================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    registerUser(msg.from);
    
    const mainMenu = {
        reply_markup: {
            keyboard: [
                ['🍓 Ссылки', '📺 Каналы'],
                ['Розыгрыш на стриме🏆', '❓Поддержка']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `🍓 *Добро пожаловать!*\n\n` +
        `Выберите раздел:`,
        { parse_mode: 'Markdown', ...mainMenu }
    );
});

bot.onText(/🍓 Ссылки/, (msg) => {
    const chatId = msg.chat.id;
    
    const linksKeyboard = {
        reply_markup: {
            keyboard: [
                ['🎰 EZcash', '🎰 Vodka.bet'],
                ['🍓 Наш канал', '💬 Чат Клубнички'],
                ['💸 Выплаты Призов', '⬅️ Назад']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `🍓 *Основные ссылки:*\n\n` +
        `Выберите ссылку:`,
        { parse_mode: 'Markdown', ...linksKeyboard }
    );
});

bot.onText(/📺 Каналы/, (msg) => {
    const chatId = msg.chat.id;
    
    const channelsKeyboard = {
        reply_markup: {
            keyboard: [
                ['🎥 YouTube Визавик', '🎮 Kick Клубничка'],
                ['⬅️ Назад']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `📺 *Каналы и стримы:*\n\n` +
        `Выберите платформу:`,
        { parse_mode: 'Markdown', ...channelsKeyboard }
    );
});

bot.onText(/❓Поддержка/, (msg) => {
    const chatId = msg.chat.id;
    
    const supportKeyboard = {
        reply_markup: {
            keyboard: [
                ['Тигран🍓', 'ALlen🍓'],
                ['⬅️ Назад']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `❓ *Поддержка*\n\n` +
        `Выберите администратора:\n\n` +
        `• *Тигран🍓* - @tigrantigranka\n` +
        `• *ALlen🍓* - @MODERKLUBNICHKA`,
        { parse_mode: 'Markdown', ...supportKeyboard }
    );
});

// Обработка ссылок
const links = [
    { name: '🎰 EZcash', url: 'https://ezca.sh/VIZAVIK' },
    { name: '🎰 Vodka.bet', url: 'https://send1.vodka/?id=14412' },
    { name: '🍓 Наш канал', url: 'https://t.me/youtube_klubnichka' },
    { name: '💬 Чат Клубнички', url: 'https://t.me/+OxCS4zHRzLdmMzgy' },
    { name: '💸 Выплаты Призов', url: 'https://t.me/kv_youtube_klubnichka' },
    { name: '🎥 YouTube Визавик', url: 'https://youtube.com/@tgvizavik?si=g3KEpXlflyX_6ASC' },
    { name: '🎮 Kick Клубничка', url: 'https://kick.com/klubnichka-kick' }
];

links.forEach(link => {
    bot.onText(new RegExp(`^${link.name}$`), (msg) => {
        const chatId = msg.chat.id;
        
        const inlineKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { 
                            text: `➡️ Перейти по ссылке`, 
                            url: link.url
                        }
                    ]
                ]
            }
        };
        
        bot.sendMessage(chatId,
            `📍 *${link.name}*\n\n` +
            `Нажмите кнопку ниже:`,
            { parse_mode: 'Markdown', ...inlineKeyboard }
        );
    });
});

// Розыгрыш
let giveawayStates = {};

bot.onText(/Розыгрыш на стриме🏆/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    registerUser(msg.from);
    
    if (!CONFIG.GIVEAWAY_ACTIVE) {
        bot.sendMessage(chatId,
            `⛔️ *РОЗЫГРЫШ ПРИОСТАНОВЛЕН*\n\n` +
            `Ожидайте новых анонсов! 🍓`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Проверяем участника
    db.get('SELECT COUNT(*) as count FROM giveaway_participants WHERE user_id = ?', 
        [userId], (err, row) => {
        if (row.count > 0) {
            bot.sendMessage(chatId,
                `🏆 *Вы уже участвуете!*\n\n` +
                `Ожидайте результатов! 🍓`,
                { parse_mode: 'Markdown' }
            );
        } else {
            giveawayStates[userId] = true;
            bot.sendMessage(chatId,
                `🏆 *РОЗЫГРЫШ НА СТРИМЕ*\n\n` +
                `*Напиши слово:* ${CONFIG.GIVEAWAY_WORD}`,
                { parse_mode: 'Markdown' }
            );
        }
    });
});

// Обработка ответа розыгрыша
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.toUpperCase().trim();
    
    if (giveawayStates[userId] && text === CONFIG.GIVEAWAY_WORD) {
        delete giveawayStates[userId];
        addGiveawayParticipant(msg.from);
        
        bot.sendMessage(chatId,
            `🎉 *ВЫ ДОБАВЛЕНЫ В РОЗЫГРЫШ!* 🏆\n\n` +
            `Ожидайте результатов! 🍓`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.onText(/⬅️ Назад/, (msg) => {
    const chatId = msg.chat.id;
    
    const mainMenu = {
        reply_markup: {
            keyboard: [
                ['🍓 Ссылки', '📺 Каналы'],
                ['Розыгрыш на стриме🏆', '❓Поддержка']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 'Главное меню:', mainMenu);
});

// Админ команды
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) {
        bot.sendMessage(chatId, '❌ Только для администратора');
        return;
    }
    
    const giveawayButton = CONFIG.GIVEAWAY_ACTIVE 
        ? '👑 Остановить розыгрыш' 
        : '👑 Активировать розыгрыш';
    
    const adminKeyboard = {
        reply_markup: {
            keyboard: [
                ['👑 Участники розыгрыша', '👑 Результаты розыгрыша'],
                ['👑 Очистить участников', giveawayButton],
                ['👑 Изменить слово', '👑 Статистика'],
                ['⬅️ В меню']
            ],
            resize_keyboard: true
        }
    };
    
    db.get('SELECT COUNT(*) as count FROM giveaway_participants', (err, row) => {
        bot.sendMessage(chatId,
            `👑 *АДМИН ПАНЕЛЬ*\n\n` +
            `Слово: *${CONFIG.GIVEAWAY_WORD}*\n` +
            `Статус: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}\n` +
            `Участников: *${row.count}*\n\n` +
            `Выберите действие:`,
            { parse_mode: 'Markdown', ...adminKeyboard }
        );
    });
});

bot.onText(/👑 Активировать розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    CONFIG.GIVEAWAY_ACTIVE = true;
    bot.sendMessage(chatId, '✅ *Розыгрыш активирован!* 🟢', { parse_mode: 'Markdown' });
});

bot.onText(/👑 Остановить розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    CONFIG.GIVEAWAY_ACTIVE = false;
    giveawayStates = {};
    bot.sendMessage(chatId, '⛔️ *Розыгрыш остановлен!* 🔴', { parse_mode: 'Markdown' });
});

bot.onText(/👑 Очистить участников/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    db.run('DELETE FROM giveaway_participants', function(err) {
        if (err) {
            bot.sendMessage(chatId, '❌ Ошибка очистки');
        } else {
            bot.sendMessage(chatId, `✅ Участники очищены!`);
        }
    });
});

bot.onText(/👑 Участники розыгрыша/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    db.all('SELECT username, first_name, entered_at FROM giveaway_participants ORDER BY entered_at DESC', 
        [], (err, participants) => {
        let message = `👑 *УЧАСТНИКИ*\n\n`;
        
        if (participants && participants.length > 0) {
            participants.forEach((p, i) => {
                message += `${i+1}. ${p.first_name} (@${p.username || 'нет'})\n`;
            });
        } else {
            message += 'Нет участников';
        }
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
});

// Веб-сервер
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Бот Клубничка 🍓</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 50px;
                    text-align: center;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: rgba(255,255,255,0.1);
                    padding: 40px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                }
                h1 {
                    font-size: 3em;
                    margin-bottom: 20px;
                }
                .stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin: 30px 0;
                }
                .stat-card {
                    background: rgba(255,255,255,0.2);
                    padding: 20px;
                    border-radius: 10px;
                }
                .count {
                    font-size: 2.5em;
                    font-weight: bold;
                    color: #ffeb3b;
                }
                .admin-link {
                    display: inline-block;
                    background: #4CAF50;
                    color: white;
                    padding: 15px 30px;
                    border-radius: 30px;
                    text-decoration: none;
                    margin-top: 20px;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Бот Клубничка</h1>
                <p>Бот для отслеживания ссылок и розыгрышей</p>
                
                <div class="stats">
                    <div class="stat-card">
                        <h3>🍓 Розыгрыш</h3>
                        <div class="count">${CONFIG.GIVEAWAY_ACTIVE ? 'АКТИВЕН' : 'ОСТАНОВЛЕН'}</div>
                        <p>Статус: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Включен' : '🔴 Выключен'}</p>
                    </div>
                    <div class="stat-card">
                        <h3>🔗 Ссылки</h3>
                        <div class="count">7</div>
                        <p>Доступно для отслеживания</p>
                    </div>
                </div>
                
                <p><strong>Слово для розыгрыша:</strong> ${CONFIG.GIVEAWAY_WORD}</p>
                
                <a href="/admin" class="admin-link">📊 Админ панель</a>
                
                <p style="margin-top: 30px; font-size: 0.9em; opacity: 0.8;">
                    Бот работает на Render.com
                </p>
            </div>
        </body>
        </html>
    `);
});

app.get('/admin', (req, res) => {
    db.get('SELECT COUNT(*) as users FROM users', (err, userStats) => {
        db.get('SELECT COUNT(*) as participants FROM giveaway_participants', (err, giveawayStats) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Админ панель</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 20px;
                            background: #f5f5f5;
                        }
                        .container {
                            max-width: 1200px;
                            margin: 0 auto;
                        }
                        .header {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 20px;
                            border-radius: 10px;
                            margin-bottom: 20px;
                        }
                        .stats-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                            gap: 20px;
                            margin-bottom: 30px;
                        }
                        .card {
                            background: white;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        .controls {
                            background: white;
                            padding: 20px;
                            border-radius: 10px;
                            margin-bottom: 20px;
                        }
                        button {
                            background: #4CAF50;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            margin: 5px;
                            border-radius: 5px;
                            cursor: pointer;
                        }
                        button:hover {
                            background: #45a049;
                        }
                        .btn-danger {
                            background: #f44336;
                        }
                        .btn-danger:hover {
                            background: #d32f2f;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🤖 Админ панель бота</h1>
                            <p>Управление розыгрышем и статистикой</p>
                        </div>
                        
                        <div class="stats-grid">
                            <div class="card">
                                <h3>👥 Пользователи</h3>
                                <p style="font-size: 24px; font-weight: bold;">${userStats?.users || 0}</p>
                                <p>Всего пользователей</p>
                            </div>
                            
                            <div class="card">
                                <h3>🏆 Розыгрыш</h3>
                                <p style="font-size: 24px; font-weight: bold;">${giveawayStats?.participants || 0}</p>
                                <p>Участников</p>
                                <span style="background: ${CONFIG.GIVEAWAY_ACTIVE ? '#4CAF50' : '#f44336'}; 
                                      color: white; padding: 5px 10px; border-radius: 15px;">
                                    ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}
                                </span>
                            </div>
                            
                            <div class="card">
                                <h3>🔗 Ссылки</h3>
                                <p style="font-size: 24px; font-weight: bold;">7</p>
                                <p>Отслеживаемых ссылок</p>
                            </div>
                        </div>
                        
                        <div class="controls">
                            <h3>Управление розыгрышем:</h3>
                            <p><strong>Текущее слово:</strong> ${CONFIG.GIVEAWAY_WORD}</p>
                            
                            <div style="margin: 20px 0;">
                                ${CONFIG.GIVEAWAY_ACTIVE 
                                    ? '<button class="btn-danger">Остановить розыгрыш</button>' 
                                    : '<button>Активировать розыгрыш</button>'
                                }
                                <button class="btn-danger">Очистить участников</button>
                                <button>Изменить слово</button>
                            </div>
                            
                            <p><strong>Примечание:</strong> Для управления используйте команду /admin в Telegram боте</p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="/" style="color: #667eea; text-decoration: none;">← Вернуться на главную</a>
                        </div>
                    </div>
                    
                    <script>
                        // Простые кнопки для демонстрации
                        document.querySelectorAll('button').forEach(btn => {
                            btn.onclick = () => {
                                alert('Эта функция доступна только через Telegram бота (/admin команда)');
                            };
                        });
                    </script>
                </body>
                </html>
            `);
        });
    });
});

// ==================== ЗАПУСК ====================

initDatabase();

// Запуск веб-сервера
app.listen(PORT, () => {
    console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
    console.log(`🔗 Ссылка: http://localhost:${PORT}`);
    console.log(`🔗 Админ панель: http://localhost:${PORT}/admin`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка бота:', error.message);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Остановка бота...');
    db.close();
    process.exit();
});