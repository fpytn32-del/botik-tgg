const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8334802447:AAGD7H0akQpXgWRlh1xWaXsGmjV7DXJY8eM',
    ADMIN_ID: 7637020943,
    BOT_NAME: '🍓 Клубничка Трекер',
    GIVEAWAY_WORD: 'КЛУБНИЧКА',
    GIVEAWAY_ACTIVE: true
};

// ==================== БАЗА ДАННЫХ ====================
const db = new sqlite3.Database('./bot.db');

// Инициализация базы
function initDatabase(callback) {
    console.log('🔄 Инициализация базы данных...');
    
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS giveaway_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE,
            username TEXT,
            first_name TEXT,
            entered_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✅ База данных готова');
        if (callback) callback();
    });
}

// ==================== TELEGRAM БОТ ====================
const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN);

// ==================== ВЕБ-СЕРВЕР ====================
const app = express();
const PORT = process.env.PORT || 10000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegramm-bot-klubnichka.onrender.com';

// ==================== ФУНКЦИИ ====================

function registerUser(userData) {
    const { id, username, first_name, last_name } = userData;
    db.run(
        'INSERT OR REPLACE INTO users (user_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
        [id, username, first_name, last_name],
        (err) => {
            if (err) console.error('Ошибка регистрации пользователя:', err);
        }
    );
}

function addGiveawayParticipant(userData) {
    const { id, username, first_name } = userData;
    db.run(
        'INSERT OR IGNORE INTO giveaway_participants (user_id, username, first_name) VALUES (?, ?, ?)',
        [id, username, first_name],
        (err) => {
            if (err) console.error('Ошибка добавления участника:', err);
        }
    );
}

// ==================== КОМАНДЫ БОТА ====================
// ↓↓↓ ВСТАВЬТЕ ВСЕ ВАШИ КОМАНДЫ ЗДЕСЬ ↓↓↓

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
    ).catch(err => console.error('Ошибка отправки /start:', err.message));
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
    ).catch(err => console.error('Ошибка отправки Ссылки:', err.message));
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
    ).catch(err => console.error('Ошибка отправки Каналы:', err.message));
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
    ).catch(err => console.error('Ошибка отправки Поддержка:', err.message));
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
        ).catch(err => console.error(`Ошибка отправки ${link.name}:`, err.message));
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
        ).catch(err => console.error('Ошибка отправки розыгрыша:', err.message));
        return;
    }
    
    // Проверяем участника
    db.get('SELECT COUNT(*) as count FROM giveaway_participants WHERE user_id = ?', 
        [userId], (err, row) => {
        if (err) {
            console.error('Ошибка проверки участника:', err);
            return;
        }
        
        if (row.count > 0) {
            bot.sendMessage(chatId,
                `🏆 *Вы уже участвуете!*\n\n` +
                `Ожидайте результатов! 🍓`,
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки:', err.message));
        } else {
            giveawayStates[userId] = true;
            bot.sendMessage(chatId,
                `🏆 *РОЗЫГРЫШ НА СТРИМЕ*\n\n` +
                `*Напиши слово:* ${CONFIG.GIVEAWAY_WORD}`,
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки:', err.message));
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
        ).catch(err => console.error('Ошибка отправки подтверждения:', err.message));
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
    
    bot.sendMessage(chatId, 'Главное меню:', mainMenu)
        .catch(err => console.error('Ошибка отправки Назад:', err.message));
});

// Админ команды
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) {
        bot.sendMessage(chatId, '❌ Только для администратора')
            .catch(err => console.error('Ошибка отправки админ:', err.message));
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
        if (err) {
            console.error('Ошибка получения участников:', err);
            row = { count: 0 };
        }
        
        bot.sendMessage(chatId,
            `👑 *АДМИН ПАНЕЛЬ*\n\n` +
            `Слово: *${CONFIG.GIVEAWAY_WORD}*\n` +
            `Статус: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}\n` +
            `Участников: *${row.count}*\n\n` +
            `Выберите действие:`,
            { parse_mode: 'Markdown', ...adminKeyboard }
        ).catch(err => console.error('Ошибка отправки админ панели:', err.message));
    });
});

bot.onText(/👑 Активировать розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    CONFIG.GIVEAWAY_ACTIVE = true;
    bot.sendMessage(chatId, '✅ *Розыгрыш активирован!* 🟢', { parse_mode: 'Markdown' })
        .catch(err => console.error('Ошибка активации розыгрыша:', err.message));
});

bot.onText(/👑 Остановить розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    CONFIG.GIVEAWAY_ACTIVE = false;
    giveawayStates = {};
    bot.sendMessage(chatId, '⛔️ *Розыгрыш остановлен!* 🔴', { parse_mode: 'Markdown' })
        .catch(err => console.error('Ошибка остановки розыгрыша:', err.message));
});

bot.onText(/👑 Очистить участников/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    db.run('DELETE FROM giveaway_participants', function(err) {
        if (err) {
            console.error('Ошибка очистки участников:', err);
            bot.sendMessage(chatId, '❌ Ошибка очистки')
                .catch(err => console.error('Ошибка отправки:', err.message));
        } else {
            bot.sendMessage(chatId, `✅ Участники очищены!`)
                .catch(err => console.error('Ошибка отправки:', err.message));
        }
    });
});

bot.onText(/👑 Участники розыгрыша/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId !== CONFIG.ADMIN_ID) return;
    
    db.all('SELECT username, first_name, entered_at FROM giveaway_participants ORDER BY entered_at DESC', 
        [], (err, participants) => {
        if (err) {
            console.error('Ошибка получения участников:', err);
            participants = [];
        }
        
        let message = `👑 *УЧАСТНИКИ*\n\n`;
        
        if (participants && participants.length > 0) {
            participants.forEach((p, i) => {
                message += `${i+1}. ${p.first_name} (@${p.username || 'нет'})\n`;
            });
        } else {
            message += 'Нет участников';
        }
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .catch(err => console.error('Ошибка отправки участников:', err.message));
    });
});

// ↑↑↑ ВСЕ ВАШИ КОМАНДЫ ВСТАВЛЕНЫ ВЫШЕ ↑↑↑

// ==================== ВЕБ-СЕРВЕР ====================
app.use(express.json());

// Главная страница
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Бот Клубничка 🍓</title>
            <style>
                body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 50px; text-align: center; }
                .container { max-width: 600px; margin: 0 auto; background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; }
                h1 { font-size: 2.5em; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Бот Клубничка работает! 🍓</h1>
                <p>Бот успешно запущен на Render.com</p>
                <p><strong>Статус:</strong> 🟢 Активен</p>
                <p style="margin-top: 30px; font-size: 0.9em; opacity: 0.8;">
                    Используйте Telegram для взаимодействия с ботом
                </p>
            </div>
        </body>
        </html>
    `);
});

// Проверка работоспособности
app.get('/health', (req, res) => {
    res.json({ status: 'ok', bot: 'running', timestamp: new Date().toISOString() });
});

// ==================== ВЕБХУК ====================
const WEBHOOK_PATH = '/webhook';

// Обработчик вебхука
app.post(WEBHOOK_PATH, (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Ошибка обработки вебхука:', error.message);
        res.sendStatus(200);
    }
});

// ==================== ЗАПУСК ====================
async function startApp() {
    try {
        console.log('🤖 Инициализация Telegram бота...');
        
        // 1. Инициализация базы данных
        await new Promise((resolve) => {
            initDatabase(() => {
                console.log('✅ База данных инициализирована');
                resolve();
            });
        });
        
        // 2. Удаляем старый вебхук
        console.log('🔄 Очистка старого вебхука...');
        try {
            await bot.deleteWebHook({ drop_pending_updates: true });
            console.log('✅ Старый вебхук удален');
        } catch (error) {
            console.log('ℹ️ Не удалось удалить старый вебхук:', error.message);
        }
        
        // 3. Устанавливаем новый вебхук
        const webhookUrl = `${RENDER_URL}${WEBHOOK_PATH}`;
        console.log(`🔗 Настройка вебхука: ${webhookUrl}`);
        
        try {
            await bot.setWebHook(webhookUrl);
            console.log('✅ Вебхук успешно установлен!');
            console.log(`📊 Вебхук URL: ${webhookUrl}`);
        } catch (error) {
            console.error('❌ Ошибка установки вебхука:', error.message);
            console.log('🔄 Пробуем альтернативный метод...');
            
            bot.setWebHook(webhookUrl, {
                certificate: '',
                max_connections: 40
            }).then(() => {
                console.log('✅ Вебхук установлен через альтернативный метод');
            }).catch(err => {
                console.error('❌ Ошибка альтернативного метода:', err.message);
            });
        }
        
        // 4. Запускаем веб-сервер
        app.listen(PORT, () => {
            console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
            console.log(`🔗 Основной URL: ${RENDER_URL}`);
            console.log(`🔗 Health check: ${RENDER_URL}/health`);
            console.log(`🔗 Вебхук: ${RENDER_URL}${WEBHOOK_PATH}`);
            console.log(`🍓 Бот "${CONFIG.BOT_NAME}" готов к работе!`);
            
            // Проверяем информацию о боте
            bot.getMe().then(botInfo => {
                console.log(`🤖 Информация о боте:`);
                console.log(`   Имя: ${botInfo.first_name}`);
                console.log(`   Username: @${botInfo.username}`);
                console.log(`   ID: ${botInfo.id}`);
            }).catch(err => {
                console.error('❌ Не удалось получить информацию о боте:', err.message);
            });
        });
        
    } catch (error) {
        console.error('❌ Ошибка запуска:', error);
        process.exit(1);
    }
}

// Обработка ошибок
bot.on('error', (error) => {
    console.error('❌ Ошибка Telegram бота:', error.message);
});

// Обработка завершения
process.on('SIGINT', () => {
    console.log('\n🛑 Остановка бота...');
    db.close();
    process.exit();
});

// Запуск
startApp();
