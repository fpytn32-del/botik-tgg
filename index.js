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

// Функция для получения статистики
function getStats(callback) {
    const stats = {};
    
    db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
        if (!err) stats.totalUsers = row.total;
        
        db.get('SELECT COUNT(*) as total FROM giveaway_participants', (err, row) => {
            if (!err) stats.totalParticipants = row.total;
            
            db.get('SELECT COUNT(*) as total FROM users WHERE date(joined_at) = date("now")', (err, row) => {
                if (!err) stats.todayUsers = row.total;
                
                db.get('SELECT COUNT(*) as total FROM giveaway_participants WHERE date(entered_at) = date("now")', (err, row) => {
                    if (!err) stats.todayParticipants = row.total;
                    
                    callback(stats);
                });
            });
        });
    });
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
            // ИЗМЕНЕНИЕ: Не показываем слово, только просим ввести
            bot.sendMessage(chatId,
                `🏆 *РОЗЫГРЫШ НА СТРИМЕ*\n\n` +
                `*Напиши слово для розыгрыша!*`,
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
    
    if (userId != CONFIG.ADMIN_ID) {
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
    
    if (userId != CONFIG.ADMIN_ID) return;
    
    CONFIG.GIVEAWAY_ACTIVE = true;
    bot.sendMessage(chatId, '✅ *Розыгрыш активирован!* 🟢', { parse_mode: 'Markdown' })
        .catch(err => console.error('Ошибка активации розыгрыша:', err.message));
});

bot.onText(/👑 Остановить розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId != CONFIG.ADMIN_ID) return;
    
    CONFIG.GIVEAWAY_ACTIVE = false;
    giveawayStates = {};
    bot.sendMessage(chatId, '⛔️ *Розыгрыш остановлен!* 🔴', { parse_mode: 'Markdown' })
        .catch(err => console.error('Ошибка остановки розыгрыша:', err.message));
});

bot.onText(/👑 Очистить участников/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId != CONFIG.ADMIN_ID) return;
    
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
    
    if (userId != CONFIG.ADMIN_ID) return;
    
    db.all('SELECT username, first_name, entered_at FROM giveaway_participants ORDER BY entered_at DESC', 
        [], (err, participants) => {
        if (err) {
            console.error('Ошибка получения участников:', err);
            participants = [];
        }
        
        let message = `👑 *УЧАСТНИКИ РОЗЫГРЫША*\n\n`;
        
        if (participants && participants.length > 0) {
            participants.forEach((p, i) => {
                const date = new Date(p.entered_at).toLocaleString('ru-RU');
                message += `${i+1}. ${p.first_name} (@${p.username || 'нет'})\n   📅 ${date}\n\n`;
            });
            message += `Всего: *${participants.length}* участников`;
        } else {
            message += 'Нет участников';
        }
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .catch(err => console.error('Ошибка отправки участников:', err.message));
    });
});

// ИЗМЕНЕНИЕ: Добавлена кнопка "Результаты розыгрыша"
bot.onText(/👑 Результаты розыгрыша/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId != CONFIG.ADMIN_ID) return;
    
    db.all('SELECT username, first_name, entered_at FROM giveaway_participants ORDER BY RANDOM() LIMIT 3', 
        [], (err, participants) => {
        if (err) {
            console.error('Ошибка получения результатов:', err);
            participants = [];
        }
        
        let message = `🏆 *РЕЗУЛЬТАТЫ РОЗЫГРЫША*\n\n`;
        
        if (participants && participants.length > 0) {
            message += `🎲 *Случайные победители:*\n\n`;
            participants.forEach((p, i) => {
                message += `${i+1}. ${p.first_name} (@${p.username || 'нет'})\n`;
            });
            message += `\nВсего участников: *${participants.length}*\n`;
            message += `Слово для розыгрыша: *${CONFIG.GIVEAWAY_WORD}*`;
        } else {
            message += 'Нет участников для розыгрыша';
        }
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .catch(err => console.error('Ошибка отправки результатов:', err.message));
    });
});

// ИЗМЕНЕНИЕ: Добавлена кнопка "Статистика"
bot.onText(/👑 Статистика/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId != CONFIG.ADMIN_ID) return;
    
    getStats((stats) => {
        const message = `📊 *СТАТИСТИКА БОТА*\n\n` +
            `👥 *Пользователи:*\n` +
            `   Всего: *${stats.totalUsers || 0}*\n` +
            `   Сегодня: *${stats.todayUsers || 0}*\n\n` +
            `🏆 *Розыгрыш:*\n` +
            `   Участников: *${stats.totalParticipants || 0}*\n` +
            `   Новых сегодня: *${stats.todayParticipants || 0}*\n\n` +
            `🔧 *Настройки:*\n` +
            `   Статус: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}\n` +
            `   Кодовое слово: *${CONFIG.GIVEAWAY_WORD}*`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .catch(err => console.error('Ошибка отправки статистики:', err.message));
    });
});

// ИЗМЕНЕНИЕ: Добавлена кнопка "Изменить слово"
bot.onText(/👑 Изменить слово/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (userId != CONFIG.ADMIN_ID) return;
    
    bot.sendMessage(chatId,
        `✏️ *ИЗМЕНЕНИЕ СЛОВА ДЛЯ РОЗЫГРЫША*\n\n` +
        `Текущее слово: *${CONFIG.GIVEAWAY_WORD}*\n\n` +
        `Отправьте новое слово (только буквы, без пробелов):`,
        { parse_mode: 'Markdown' }
    ).then(() => {
        // Сохраняем состояние для изменения слова
        bot.once('message', (responseMsg) => {
            if (responseMsg.from.id === userId) {
                const newWord = responseMsg.text?.toUpperCase().trim();
                if (newWord && newWord.length > 0 && /^[А-ЯA-Z]+$/.test(newWord)) {
                    CONFIG.GIVEAWAY_WORD = newWord;
                    bot.sendMessage(chatId,
                        `✅ *Слово изменено!*\n\n` +
                        `Новое слово для розыгрыша: *${CONFIG.GIVEAWAY_WORD}*`,
                        { parse_mode: 'Markdown' }
                    ).catch(err => console.error('Ошибка отправки подтверждения:', err.message));
                } else {
                    bot.sendMessage(chatId,
                        `❌ *Неверный формат!*\n\n` +
                        `Используйте только буквы (без пробелов и цифр)`,
                        { parse_mode: 'Markdown' }
                    ).catch(err => console.error('Ошибка отправки:', err.message));
                }
            }
        });
    }).catch(err => console.error('Ошибка отправки запроса на изменение слова:', err.message));
});

// ИЗМЕНЕНИЕ: Добавлена кнопка "В меню"
bot.onText(/⬅️ В меню/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const mainMenu = {
        reply_markup: {
            keyboard: [
                ['🍓 Ссылки', '📺 Каналы'],
                ['Розыгрыш на стриме🏆', '❓Поддержка'],
                ['/admin']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, '🍓 *Главное меню*', { parse_mode: 'Markdown', ...mainMenu })
        .catch(err => console.error('Ошибка отправки В меню:', err.message));
});

// ==================== ВЕБ-СЕРВЕР ====================
app.use(express.json());

// ИЗМЕНЕНИЕ: Красивый сайт со статистикой
app.get('/', (req, res) => {
    getStats((stats) => {
        res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>🍓 Бот Клубничка - Статистика</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        color: #333;
                        padding: 20px;
                    }
                    
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    
                    .header {
                        text-align: center;
                        padding: 40px 20px;
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 20px;
                        margin-bottom: 30px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    }
                    
                    .header h1 {
                        font-size: 3.5rem;
                        color: #ff6b8b;
                        margin-bottom: 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 15px;
                    }
                    
                    .header p {
                        font-size: 1.2rem;
                        color: #666;
                        margin-bottom: 20px;
                    }
                    
                    .status-badge {
                        display: inline-block;
                        padding: 10px 25px;
                        border-radius: 50px;
                        font-weight: bold;
                        font-size: 1.1rem;
                        margin: 10px 0;
                    }
                    
                    .status-active {
                        background: linear-gradient(135deg, #4CAF50, #8BC34A);
                        color: white;
                    }
                    
                    .status-inactive {
                        background: linear-gradient(135deg, #f44336, #FF9800);
                        color: white;
                    }
                    
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 25px;
                        margin-bottom: 40px;
                    }
                    
                    .stat-card {
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 15px;
                        padding: 30px;
                        text-align: center;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                    }
                    
                    .stat-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
                    }
                    
                    .stat-card i {
                        font-size: 3rem;
                        margin-bottom: 15px;
                        color: #667eea;
                    }
                    
                    .stat-card h3 {
                        font-size: 1.5rem;
                        color: #444;
                        margin-bottom: 15px;
                    }
                    
                    .stat-number {
                        font-size: 3.5rem;
                        font-weight: bold;
                        color: #ff6b8b;
                        margin: 10px 0;
                    }
                    
                    .stat-desc {
                        color: #666;
                        font-size: 1rem;
                    }
                    
                    .info-section {
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 15px;
                        padding: 40px;
                        margin-bottom: 30px;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                    }
                    
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 30px;
                        margin-top: 20px;
                    }
                    
                    .info-item {
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                        border-left: 5px solid #667eea;
                    }
                    
                    .info-item h4 {
                        color: #444;
                        margin-bottom: 10px;
                        font-size: 1.2rem;
                    }
                    
                    .info-item p {
                        color: #666;
                        font-size: 1.1rem;
                    }
                    
                    .links-section {
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 15px;
                        padding: 40px;
                        margin-bottom: 30px;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                    }
                    
                    .links-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-top: 20px;
                    }
                    
                    .link-btn {
                        display: block;
                        padding: 15px;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        text-decoration: none;
                        border-radius: 10px;
                        text-align: center;
                        font-weight: bold;
                        transition: transform 0.3s ease, box-shadow 0.3s ease;
                    }
                    
                    .link-btn:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                    }
                    
                    .footer {
                        text-align: center;
                        padding: 30px;
                        color: white;
                        margin-top: 30px;
                    }
                    
                    .footer a {
                        color: #ffeb3b;
                        text-decoration: none;
                    }
                    
                    .footer a:hover {
                        text-decoration: underline;
                    }
                    
                    @media (max-width: 768px) {
                        .header h1 {
                            font-size: 2.5rem;
                        }
                        
                        .stat-number {
                            font-size: 2.5rem;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1><i class="fas fa-robot"></i> Бот Клубничка 🍓</h1>
                        <p>Telegram бот для отслеживания ссылок и проведения розыгрышей</p>
                        <div class="status-badge ${CONFIG.GIVEAWAY_ACTIVE ? 'status-active' : 'status-inactive'}">
                            <i class="fas fa-${CONFIG.GIVEAWAY_ACTIVE ? 'play' : 'pause'}"></i>
                            Розыгрыш: ${CONFIG.GIVEAWAY_ACTIVE ? 'АКТИВЕН' : 'ОСТАНОВЛЕН'}
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <i class="fas fa-users"></i>
                            <h3>Всего пользователей</h3>
                            <div class="stat-number">${stats.totalUsers || 0}</div>
                            <p class="stat-desc">Зарегистрировано в боте</p>
                        </div>
                        
                        <div class="stat-card">
                            <i class="fas fa-trophy"></i>
                            <h3>Участников розыгрыша</h3>
                            <div class="stat-number">${stats.totalParticipants || 0}</div>
                            <p class="stat-desc">Заявок на участие</p>
                        </div>
                        
                        <div class="stat-card">
                            <i class="fas fa-user-plus"></i>
                            <h3>Новых сегодня</h3>
                            <div class="stat-number">${stats.todayUsers || 0}</div>
                            <p class="stat-desc">Пользователей за сегодня</p>
                        </div>
                        
                        <div class="stat-card">
                            <i class="fas fa-calendar-day"></i>
                            <h3>Участников сегодня</h3>
                            <div class="stat-number">${stats.todayParticipants || 0}</div>
                            <p class="stat-desc">Новых заявок сегодня</p>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <h2 style="text-align: center; color: #444; margin-bottom: 30px;">
                            <i class="fas fa-info-circle"></i> Информация о боте
                        </h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <h4><i class="fas fa-key"></i> Кодовое слово</h4>
                                <p style="font-size: 1.8rem; font-weight: bold; color: #ff6b8b;">${CONFIG.GIVEAWAY_WORD}</p>
                                <p>Слово для участия в розыгрыше</p>
                            </div>
                            
                            <div class="info-item">
                                <h4><i class="fas fa-cog"></i> Настройки</h4>
                                <p>Статус: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}</p>
                                <p>Админ ID: ${CONFIG.ADMIN_ID}</p>
                            </div>
                            
                            <div class="info-item">
                                <h4><i class="fas fa-link"></i> Ссылки</h4>
                                <p>Доступно ${links.length} ссылок для отслеживания</p>
                                <p>Бот работает на Render.com</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="links-section">
                        <h2 style="text-align: center; color: #444; margin-bottom: 30px;">
                            <i class="fas fa-external-link-alt"></i> Быстрые ссылки
                        </h2>
                        <div class="links-grid">
                            <a href="https://t.me/vizavik1_bot" class="link-btn" target="_blank">
                                <i class="fab fa-telegram"></i> Открыть бота
                            </a>
                            <a href="/health" class="link-btn">
                                <i class="fas fa-heartbeat"></i> Проверка здоровья
                            </a>
                            <a href="https://render.com" class="link-btn" target="_blank">
                                <i class="fas fa-server"></i> Хостинг Render
                            </a>
                            <a href="https://github.com" class="link-btn" target="_blank">
                                <i class="fab fa-github"></i> Исходный код
                            </a>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>🤖 <strong>Бот "Клубничка"</strong> | 🍓 Все права защищены © 2024</p>
                        <p>Бот работает на <a href="https://render.com" target="_blank">Render.com</a> | Обновлено: ${new Date().toLocaleString('ru-RU')}</p>
                        <p style="margin-top: 20px; opacity: 0.8;">
                            <i class="fas fa-sync-alt"></i> Статистика обновляется в реальном времени
                        </p>
                    </div>
                </div>
                
                <script>
                    // Автообновление страницы каждые 60 секунд
                    setTimeout(() => {
                        location.reload();
                    }, 60000);
                    
                    // Анимация появления карточек
                    document.addEventListener('DOMContentLoaded', () => {
                        const cards = document.querySelectorAll('.stat-card, .info-item');
                        cards.forEach((card, index) => {
                            card.style.opacity = '0';
                            card.style.transform = 'translateY(20px)';
                            
                            setTimeout(() => {
                                card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                                card.style.opacity = '1';
                                card.style.transform = 'translateY(0)';
                            }, index * 100);
                        });
                    });
                </script>
            </body>
            </html>
        `);
    });
});

// Проверка работоспособности
app.get('/health', (req, res) => {
    getStats((stats) => {
        res.json({ 
            status: 'ok', 
            bot: 'running', 
            timestamp: new Date().toISOString(),
            stats: stats,
            config: {
                giveaway_active: CONFIG.GIVEAWAY_ACTIVE,
                giveaway_word: CONFIG.GIVEAWAY_WORD,
                admin_id: CONFIG.ADMIN_ID
            }
        });
    });
});

// GET обработчик для webhook (для проверки)
app.get('/webhook', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Вебхук бота 🍓</title>
            <style>
                body { font-family: Arial; padding: 50px; text-align: center; }
                .container { max-width: 600px; margin: 0 auto; }
                .success { color: green; font-size: 1.2rem; }
                .info { color: blue; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Вебхук бота Клубничка</h1>
                <p class="success">✅ Вебхук активен и готов принимать запросы</p>
                <p class="info">📡 Этот эндпоинт принимает только POST запросы от Telegram</p>
                <p><strong>URL вебхука:</strong> ${RENDER_URL}/webhook</p>
                <p><strong>Статус:</strong> 🟢 Активен</p>
                <p><strong>Бот:</strong> ${CONFIG.BOT_NAME}</p>
                <p><a href="/">← Вернуться на главную</a></p>
            </div>
        </body>
        </html>
    `);
});

// ==================== ВЕБХУК ====================
const WEBHOOK_PATH = '/webhook';

// Обработчик вебхука
app.post(WEBHOOK_PATH, (req, res) => {
    try {
        console.log('📥 Получен вебхук от Telegram:', {
            update_id: req.body.update_id,
            message: req.body.message ? {
                text: req.body.message.text,
                from_id: req.body.message.from?.id,
                chat_id: req.body.message.chat?.id
            } : 'no message'
        });
        
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
