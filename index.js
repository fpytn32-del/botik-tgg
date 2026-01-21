const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8334802447:AAGD7H0akQpXgWRlh1xWaXsGmjV7DXJY8eM',
    ADMIN_IDS: [7637020943, 1037455201], // Два администратора
    BOT_NAME: '🍓 Клубничка Трекер',
    GIVEAWAY_WORD: 'КЛУБНИЧКА',
    GIVEAWAY_ACTIVE: true
};

// Проверка администратора
function isAdmin(userId) {
    return CONFIG.ADMIN_IDS.includes(Number(userId));
}

// Список ссылок
const LINKS = [
    { name: '🎰 EZcash', url: 'https://ezca.sh/VIZAVIK' },
    { name: '🎰 Vodka.bet', url: 'https://send1.vodka/?id=14412' },
    { name: '🍓 Наш канал', url: 'https://t.me/youtube_klubnichka' },
    { name: '💬 Чат Клубнички', url: 'https://t.me/+OxCS4zHRzLdmMzgy' },
    { name: '💸 Выплаты Призов', url: 'https://t.me/kv_youtube_klubnichka' },
    { name: '🎥 YouTube Визавик', url: 'https://youtube.com/@tgvizavik?si=g3KEpXlflyX_6ASC' },
    { name: '🎮 Kick Клубничка', url: 'https://kick.com/klubnichka-kick' }
];

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
        
        db.run(`CREATE TABLE IF NOT EXISTS link_clicks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            first_name TEXT,
            link_name TEXT,
            link_url TEXT,
            clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS link_stats (
            link_name TEXT PRIMARY KEY,
            link_url TEXT,
            click_count INTEGER DEFAULT 0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        console.log('✅ База данных готова');
        
        // Инициализация статистики ссылок ПОСЛЕ создания таблицы
        LINKS.forEach(link => {
            db.run(
                `INSERT OR IGNORE INTO link_stats (link_name, link_url, click_count) VALUES (?, ?, 0)`,
                [link.name, link.url],
                (err) => {
                    if (err) console.error('Ошибка инициализации статистики:', err);
                }
            );
        });
        
        if (callback) callback();
    });
}

// ==================== TELEGRAM БОТ ====================
const bot = new TelegramBot(CONFIG.TELEGRAM_TOKEN);

// ==================== ВЕБ-СЕРВЕР ====================
const app = express();
const PORT = process.env.PORT || 10000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegramm-bot-klubnichka.onrender.com';

// ==================== ПЕРЕМЕННЫЕ ДЛЯ ХРАНЕНИЯ СОСТОЯНИЙ ====================
let giveawayStates = {};
let adminState = {}; // Для хранения состояния админ-команд
let userStates = {}; // Для отслеживания состояния пользователей

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

// Функция для записи перехода по ссылке с обновлением статистики
function logLinkClick(userData, linkName, linkUrl) {
    const { id, username, first_name } = userData;
    
    // Записываем детальный клик
    db.run(
        'INSERT INTO link_clicks (user_id, username, first_name, link_name, link_url) VALUES (?, ?, ?, ?, ?)',
        [id, username, first_name, linkName, linkUrl],
        (err) => {
            if (err) console.error('Ошибка записи перехода по ссылке:', err);
        }
    );
    
    // Обновляем агрегированную статистики
    db.run(
        `INSERT INTO link_stats (link_name, link_url, click_count) 
         VALUES (?, ?, 1)
         ON CONFLICT(link_name) DO UPDATE SET 
         click_count = click_count + 1,
         last_updated = CURRENT_TIMESTAMP`,
        [linkName, linkUrl],
        (err) => {
            if (err) console.error('Ошибка обновления статистики ссылки:', err);
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
            
            // Общее количество переходов за неделю
            db.get(`SELECT COUNT(*) as total FROM link_clicks 
                    WHERE clicked_at >= datetime('now', '-7 days')`, (err, row) => {
                if (!err) stats.weeklyClicks = row.total;
                
                // Общее количество переходов всего
                db.get('SELECT COUNT(*) as total FROM link_clicks', (err, row) => {
                    if (!err) stats.totalClicks = row.total;
                    
                    // Последние 10 пользователей, перешедших по ссылкам
                    db.all(`SELECT first_name, username, link_name, 
                            datetime(clicked_at, 'localtime') as clicked_at 
                            FROM link_clicks 
                            ORDER BY clicked_at DESC LIMIT 10`, (err, rows) => {
                        if (!err) stats.recentClicks = rows;
                        
                        // Статистика по каждой ссылке
                        db.all(`SELECT link_name, click_count, link_url 
                                FROM link_stats 
                                ORDER BY click_count DESC`, (err, rows) => {
                            if (!err) stats.linkStats = rows;
                            
                            // Самые популярные ссылки за неделю
                            db.all(`SELECT link_name, COUNT(*) as clicks 
                                    FROM link_clicks 
                                    WHERE clicked_at >= datetime('now', '-7 days')
                                    GROUP BY link_name 
                                    ORDER BY clicks DESC LIMIT 5`, (err, rows) => {
                                if (!err) stats.topLinks = rows;
                                
                                // Количество уникальных пользователей за неделю
                                db.get(`SELECT COUNT(DISTINCT user_id) as total FROM link_clicks 
                                        WHERE clicked_at >= datetime('now', '-7 days')`, (err, row) => {
                                    if (!err) stats.weeklyUniqueUsers = row.total;
                                    
                                    callback(stats);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// ==================== КОМАНДЫ БОТА ====================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Сбрасываем все состояния пользователя
    delete giveawayStates[userId];
    delete adminState[userId];
    delete userStates[userId];
    
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
    
    // Добавляем кнопку /admin для админов
    if (isAdmin(userId)) {
        mainMenu.reply_markup.keyboard.push(['/admin']);
    }
    
    bot.sendMessage(chatId,
        `🍓 *Добро пожаловать!*\n\n` +
        `Выберите раздел:`,
        { parse_mode: 'Markdown', ...mainMenu }
    ).catch(err => console.error('Ошибка отправки /start:', err.message));
});

bot.onText(/🍓 Ссылки/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
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
    
    // Добавляем кнопку /admin для админов
    if (isAdmin(userId)) {
        linksKeyboard.reply_markup.keyboard.push(['/admin']);
    }
    
    bot.sendMessage(chatId,
        `🍓 *Основные ссылки:*\n\n` +
        `Выберите ссылку:`,
        { parse_mode: 'Markdown', ...linksKeyboard }
    ).catch(err => console.error('Ошибка отправки Ссылки:', err.message));
});

bot.onText(/📺 Каналы/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const channelsKeyboard = {
        reply_markup: {
            keyboard: [
                ['🎥 YouTube Визавик', '🎮 Kick Клубничка'],
                ['⬅️ Назад']
            ],
            resize_keyboard: true
        }
    };
    
    // Добавляем кнопку /admin для админов
    if (isAdmin(userId)) {
        channelsKeyboard.reply_markup.keyboard.push(['/admin']);
    }
    
    bot.sendMessage(chatId,
        `📺 *Каналы и стримы:*\n\n` +
        `Выберите платформу:`,
        { parse_mode: 'Markdown', ...channelsKeyboard }
    ).catch(err => console.error('Ошибка отправки Каналы:', err.message));
});

bot.onText(/❓Поддержка/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const supportKeyboard = {
        reply_markup: {
            keyboard: [
                ['Тигран🍓', 'ALlen🍓'],
                ['⬅️ Назад']
            ],
            resize_keyboard: true
        }
    };
    
    // Добавляем кнопку /admin для админов
    if (isAdmin(userId)) {
        supportKeyboard.reply_markup.keyboard.push(['/admin']);
    }
    
    bot.sendMessage(chatId,
        `❓ *Поддержка*\n\n` +
        `Выберите модератора!:`,
        { parse_mode: 'Markdown', ...supportKeyboard }
    ).catch(err => console.error('Ошибка отправки Поддержка:', err.message));
});

// ИСПРАВЛЕНИЕ: Кнопки поддержки с ссылками на юзернеймы
bot.onText(/Тигран🍓/, (msg) => {
    const chatId = msg.chat.id;
    
    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { 
                        text: `💬 Написать Тиграну🍓`, 
                        url: 'https://t.me/tigrantigranka'
                    }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId,
        `👤 *Тигран🍓*\n\n` +
        `Нажмите кнопку ниже, чтобы написать модератору!:`,
        { parse_mode: 'Markdown', ...inlineKeyboard }
    ).catch(err => console.error('Ошибка отправки Тигран:', err.message));
});

bot.onText(/ALlen🍓/, (msg) => {
    const chatId = msg.chat.id;
    
    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { 
                        text: `💬 Написать ALLen🍓`, 
                        url: 'https://t.me/MODERKLUBNICHKA'
                    }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId,
        `👤 *ALlen🍓*\n\n` +
        `Нажмите кнопку ниже, чтобы написать модератору!:`,
        { parse_mode: 'Markdown', ...inlineKeyboard }
    ).catch(err => console.error('Ошибка отправки ALLen:', err.message));
});

// Обработка ссылок
LINKS.forEach(link => {
    bot.onText(new RegExp(`^${link.name}$`), (msg) => {
        const chatId = msg.chat.id;
        
        // Логируем переход по ссылке
        logLinkClick(msg.from, link.name, link.url);
        
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
bot.onText(/Розыгрыш на стриме🏆/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Сбрасываем состояние админа для этого пользователя
    delete adminState[userId];
    
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
                `*Напиши слово для розыгрыша!*`,
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки:', err.message));
        }
    });
});

// Обработка всех сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.toUpperCase().trim();
    
    // Если пользователь нажал кнопку меню, сбрасываем все состояния
    if (text === '⬅️ НАЗАД' || text === '⬅️ В МЕНЮ' || text === '⬅️ НАЗАД В АДМИНКУ' || 
        text === '🍓 ССЫЛКИ' || text === '📺 КАНАЛЫ' || text === '❓ПОДДЕРЖКА' || 
        text === '/START' || text === '/ADMIN') {
        delete giveawayStates[userId];
        delete adminState[userId];
        delete userStates[userId];
        return;
    }
    
    // Обработка выбора количества победителей
    if (adminState[userId] === 'awaiting_winners_count') {
        const count = parseInt(text);
        if (!isNaN(count) && count > 0 && count <= 100) {
            db.get('SELECT COUNT(*) as total FROM giveaway_participants', (err, totalRow) => {
                const totalParticipants = totalRow ? totalRow.total : 0;
                
                db.all('SELECT username, first_name, entered_at FROM giveaway_participants ORDER BY RANDOM() LIMIT ?', 
                    [Math.min(count, totalParticipants)], (err, participants) => {
                    if (err) {
                        console.error('Ошибка получения победителей:', err);
                        participants = [];
                    }
                    
                    let message = `🏆 *РЕЗУЛЬТАТЫ РОЗЫГРЫША*\n\n`;
                    message += `Количество победителей: *${Math.min(count, totalParticipants)}*\n\n`;
                    
                    if (participants && participants.length > 0) {
                        message += `🎲 *Победители:*\n\n`;
                        participants.forEach((p, i) => {
                            message += `${i+1}. ${p.first_name} (@${p.username || 'нет'})\n`;
                        });
                        message += `\nВсего участников в базе: *${totalParticipants}*\n`;
                        message += `Слово для розыгрыша: *${CONFIG.GIVEAWAY_WORD}*`;
                    } else {
                        message += 'Нет участников для розыгрыша';
                    }
                    
                    // Добавляем кнопку для возврата в админку
                    const backKeyboard = {
                        reply_markup: {
                            keyboard: [
                                ['⬅️ Назад в админку']
                            ],
                            resize_keyboard: true
                        }
                    };
                    
                    bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...backKeyboard })
                        .catch(err => console.error('Ошибка отправки результатов:', err.message));
                });
            });
            delete adminState[userId];
            return;
        } else {
            bot.sendMessage(chatId,
                '❌ Неверное количество! Введите число от 1 до 100:',
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки:', err.message));
            return;
        }
    }
    
    // Обработка изменения слова (только если пользователь не нажал кнопку меню)
    if (adminState[userId] === 'awaiting_new_word') {
        const newWord = text;
        if (newWord && newWord.length > 0 && /^[А-ЯA-Z]+$/.test(newWord)) {
            CONFIG.GIVEAWAY_WORD = newWord;
            delete adminState[userId];
            
            bot.sendMessage(chatId,
                `✅ *Слово изменено!*\n\n` +
                `Новое слово для розыгрыша: *${CONFIG.GIVEAWAY_WORD}*`,
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки подтверждения:', err.message));
        } else {
            // Если пользователь ввел неверный формат, но это может быть кнопка меню
            if (text !== '⬅️ В МЕНЮ' && text !== '⬅️ НАЗАД' && text !== '⬅️ НАЗАД В АДМИНКУ') {
                bot.sendMessage(chatId,
                    `❌ *Неверный формат!*\n\n` +
                    `Используйте только буквы (без пробелов и цифр)\n` +
                    `Или нажмите "⬅️ В меню" для отмены`,
                    { parse_mode: 'Markdown' }
                ).catch(err => console.error('Ошибка отправки:', err.message));
            }
        }
        return;
    }
    
    // ИСПРАВЛЕНИЕ: Если пользователь ввел неверное слово в розыгрыше
    if (giveawayStates[userId] && text) {
        if (text === CONFIG.GIVEAWAY_WORD) {
            delete giveawayStates[userId];
            addGiveawayParticipant(msg.from);
            
            bot.sendMessage(chatId,
                `🎉 *ВЫ ДОБАВЛЕНЫ В РОЗЫГРЫШ!* 🏆\n\n` +
                `Ожидайте результатов! 🍓`,
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки подтверждения:', err.message));
        } else {
            // Если слово неверное, сообщаем об этом
            bot.sendMessage(chatId,
                `❌ *Неверное клубничное слово!* 🍓\n\n` +
                `Попробуйте еще раз или нажмите "⬅️ Назад" для выхода`,
                { parse_mode: 'Markdown' }
            ).catch(err => console.error('Ошибка отправки сообщения о неверном слове:', err.message));
        }
    }
});

bot.onText(/⬅️ Назад/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Сбрасываем состояние розыгрыша при возврате в меню
    delete giveawayStates[userId];
    delete adminState[userId];
    delete userStates[userId];
    
    const mainMenu = {
        reply_markup: {
            keyboard: [
                ['🍓 Ссылки', '📺 Каналы'],
                ['Розыгрыш на стриме🏆', '❓Поддержка']
            ],
            resize_keyboard: true
        }
    };
    
    // Добавляем кнопку /admin для админов
    if (isAdmin(userId)) {
        mainMenu.reply_markup.keyboard.push(['/admin']);
    }
    
    bot.sendMessage(chatId, '🍓 *Главное меню*', { parse_mode: 'Markdown', ...mainMenu })
        .catch(err => console.error('Ошибка отправки Назад:', err.message));
});

// Админ команды
bot.onText(/\/admin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
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
        
        // Определяем, кто из админов использует команду
        const adminNames = CONFIG.ADMIN_IDS.map(id => {
            if (id === 7637020943) return 'Тигран';
            if (id === 1037455201) return 'Виктория';
            return `Админ ${id}`;
        });
        
        bot.sendMessage(chatId,
            `👑 *АДМИН ПАНЕЛЬ*\n\n` +
            `Привет, ${userId === 7637020943 ? 'Тигран' : 'Виктория'}! 🍓\n\n` +
            `Слово: *${CONFIG.GIVEAWAY_WORD}*\n` +
            `Статус: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}\n` +
            `Участников: *${row.count}*\n` +
            `Администраторы: ${adminNames.join(', ')}\n\n` +
            `Выберите действие:`,
            { parse_mode: 'Markdown', ...adminKeyboard }
        ).catch(err => console.error('Ошибка отправки админ панели:', err.message));
    });
});

bot.onText(/👑 Активировать розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    CONFIG.GIVEAWAY_ACTIVE = true;
    bot.sendMessage(chatId, '✅ *Розыгрыш активирован!* 🟢', { parse_mode: 'Markdown' })
        .catch(err => console.error('Ошибка активации розыгрыша:', err.message));
});

bot.onText(/👑 Остановить розыгрыш/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    CONFIG.GIVEAWAY_ACTIVE = false;
    giveawayStates = {};
    bot.sendMessage(chatId, '⛔️ *Розыгрыш остановлен!* 🔴', { parse_mode: 'Markdown' })
        .catch(err => console.error('Ошибка остановки розыгрыша:', err.message));
});

bot.onText(/👑 Очистить участников/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
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
    
    if (!isAdmin(userId)) return;
    
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

// ИСПРАВЛЕНИЕ: "Результаты розыгрыша" с выбором количества победителей
bot.onText(/👑 Результаты розыгрыша/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    // Создаем клавиатуру с кнопками выбора количества
    const winnersKeyboard = {
        reply_markup: {
            keyboard: [
                ['1 победитель', '3 победителя', '5 победителей'],
                ['10 победителей', 'Ввести число', '⬅️ Назад в админку']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `🏆 *ВЫБОР КОЛИЧЕСТВА ПОБЕДИТЕЛЕЙ*\n\n` +
        `Выберите количество победителей или введите своё число (1-100):`,
        { parse_mode: 'Markdown', ...winnersKeyboard }
    ).catch(err => console.error('Ошибка отправки выбора победителей:', err.message));
});

// Обработка кнопок выбора количества победителей
bot.onText(/1 победитель/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    showWinners(chatId, 1, userId);
});

bot.onText(/3 победителя/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    showWinners(chatId, 3, userId);
});

bot.onText(/5 победителей/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    showWinners(chatId, 5, userId);
});

bot.onText(/10 победителей/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    showWinners(chatId, 10, userId);
});

bot.onText(/Ввести число/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    adminState[userId] = 'awaiting_winners_count';
    bot.sendMessage(chatId,
        `🔢 *ВВЕДИТЕ ЧИСЛО*\n\n` +
        `Введите количество победителей (от 1 до 100):\n\n` +
        `*Или нажмите "⬅️ Назад в админку" для отмены*`,
        { parse_mode: 'Markdown' }
    ).catch(err => console.error('Ошибка отправки запроса числа:', err.message));
});

bot.onText(/⬅️ Назад в админку/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    // Сбрасываем состояние
    delete adminState[userId];
    
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
    
    bot.sendMessage(chatId, '👑 *Админ панель*', { parse_mode: 'Markdown', ...adminKeyboard })
        .catch(err => console.error('Ошибка отправки возврата в админку:', err.message));
});

// Функция показа победителей
function showWinners(chatId, count, userId) {
    if (!isAdmin(userId)) return;
    
    db.get('SELECT COUNT(*) as total FROM giveaway_participants', (err, totalRow) => {
        const totalParticipants = totalRow ? totalRow.total : 0;
        
        db.all('SELECT username, first_name, entered_at FROM giveaway_participants ORDER BY RANDOM() LIMIT ?', 
            [Math.min(count, totalParticipants)], (err, participants) => {
            if (err) {
                console.error('Ошибка получения победителей:', err);
                participants = [];
            }
            
            let message = `🏆 *РЕЗУЛЬТАТЫ РОЗЫГРЫША*\n\n`;
            message += `Выбрано победителей: *${Math.min(count, totalParticipants)}*\n\n`;
            
            if (participants && participants.length > 0) {
                message += `🎲 *Победители:*\n\n`;
                participants.forEach((p, i) => {
                    message += `${i+1}. ${p.first_name} (@${p.username || 'нет'})\n`;
                });
                message += `\nВсего участников в базе: *${totalParticipants}*\n`;
                message += `Слово для розыгрыша: *${CONFIG.GIVEAWAY_WORD}*`;
            } else {
                message += 'Нет участников для розыгрыша';
            }
            
            // Добавляем кнопку для возврата в админку
            const backKeyboard = {
                reply_markup: {
                    keyboard: [
                        ['⬅️ Назад в админку']
                    ],
                    resize_keyboard: true
                }
            };
            
            // Сбрасываем состояние
            delete adminState[userId];
            
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...backKeyboard })
                .catch(err => console.error('Ошибка отправки результатов:', err.message));
        });
    });
}

// ИСПРАВЛЕНИЕ: Улучшенная статистика
bot.onText(/👑 Статистика/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    getStats((stats) => {
        let message = `📊 *СТАТИСТИКА БОТА*\n\n`;
        message += `👥 *Пользователи:*\n`;
        message += `   Всего: *${stats.totalUsers || 0}*\n`;
        
        message += `\n🏆 *Розыгрыш:*\n`;
        message += `   Участников: *${stats.totalParticipants || 0}*\n`;
        
        message += `\n🔗 *Переходы по ссылкам:*\n`;
        message += `   Всего переходов: *${stats.totalClicks || 0}*\n`;
        message += `   За неделю: *${stats.weeklyClicks || 0}*\n`;
        message += `   Уникальных пользователей за неделю: *${stats.weeklyUniqueUsers || 0}*\n`;
        
        // Статистика по каждой ссылке
        if (stats.linkStats && stats.linkStats.length > 0) {
            message += `\n📈 *Топ ссылок (все время):*\n`;
            stats.linkStats.forEach((link, i) => {
                if (i < 5) {
                    message += `   ${i+1}. ${link.link_name}: *${link.click_count || 0}* переходов\n`;
                }
            });
        }
        
        // Самые популярные ссылки за неделю
        if (stats.topLinks && stats.topLinks.length > 0) {
            message += `\n🔥 *Популярное за неделю:*\n`;
            stats.topLinks.forEach((link, i) => {
                if (i < 3) {
                    message += `   ${i+1}. ${link.link_name}: *${link.clicks || 0}* переходов\n`;
                }
            });
        }
        
        // Последние переходы
        if (stats.recentClicks && stats.recentClicks.length > 0) {
            message += `\n🕐 *Последние переходы:*\n`;
            stats.recentClicks.forEach((click, i) => {
                if (i < 3) {
                    const time = click.clicked_at ? click.clicked_at.split(' ')[1] : 'N/A';
                    message += `   ${click.first_name} → ${click.link_name} (${time})\n`;
                }
            });
        }
        
        message += `\n🔧 *Настройки:*\n`;
        message += `   Статус розыгрыша: ${CONFIG.GIVEAWAY_ACTIVE ? '🟢 Активен' : '🔴 Остановлен'}\n`;
        message += `   Кодовое слово: *${CONFIG.GIVEAWAY_WORD}*\n`;
        message += `   Администраторов: *${CONFIG.ADMIN_IDS.length}*`;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
            .catch(err => console.error('Ошибка отправки статистики:', err.message));
    });
});

bot.onText(/👑 Изменить слово/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) return;
    
    adminState[userId] = 'awaiting_new_word';
    
    const backKeyboard = {
        reply_markup: {
            keyboard: [
                ['⬅️ Назад в админку']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `✏️ *ИЗМЕНЕНИЕ СЛОВА ДЛЯ РОЗЫГРЫША*\n\n` +
        `Текущее слово: *${CONFIG.GIVEAWAY_WORD}*\n\n` +
        `Отправьте новое слово (только буквы, без пробелов):\n\n` +
        `*Или нажмите "⬅️ Назад в админку" для отмены*`,
        { parse_mode: 'Markdown', ...backKeyboard }
    ).catch(err => console.error('Ошибка отправки запроса на изменение слова:', err.message));
});

bot.onText(/⬅️ В меню/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Сбрасываем все состояния
    delete giveawayStates[userId];
    delete adminState[userId];
    delete userStates[userId];
    
    const mainMenu = {
        reply_markup: {
            keyboard: [
                ['🍓 Ссылки', '📺 Каналы'],
                ['Розыгрыш на стриме🏆', '❓Поддержка']
            ],
            resize_keyboard: true
        }
    };
    
    // Добавляем кнопку /admin для админов
    if (isAdmin(userId)) {
        mainMenu.reply_markup.keyboard.push(['/admin']);
    }
    
    bot.sendMessage(chatId, '🍓 *Главное меню*', { parse_mode: 'Markdown', ...mainMenu })
        .catch(err => console.error('Ошибка отправки В меню:', err.message));
});

// ==================== ВЕБ-СЕРВЕР ====================
app.use(express.json());

// ИСПРАВЛЕНИЕ: Статистика не обновляется автоматически
let cachedStats = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 30000; // 30 секунд

// Функция для получения статистики с кэшированием
function getCachedStats(callback) {
    const now = Date.now();
    
    if (cachedStats && (now - lastCacheUpdate) < CACHE_DURATION) {
        callback(cachedStats);
    } else {
        getStats((stats) => {
            cachedStats = stats;
            lastCacheUpdate = now;
            callback(stats);
        });
    }
}

// Красивый сайт со статистикой
app.get('/', (req, res) => {
    getCachedStats((stats) => {
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
                    
                    .recent-clicks {
                        margin-top: 30px;
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 15px;
                        padding: 30px;
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                    }
                    
                    .click-item {
                        padding: 15px;
                        margin: 10px 0;
                        background: #f8f9fa;
                        border-radius: 8px;
                        border-left: 4px solid #ff6b8b;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    .click-user {
                        font-weight: bold;
                        color: #444;
                    }
                    
                    .click-link {
                        color: #667eea;
                    }
                    
                    .click-time {
                        color: #888;
                        font-size: 0.9rem;
                    }
                    
                    .link-stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 15px;
                        margin-top: 20px;
                    }
                    
                    .link-stat-item {
                        padding: 15px;
                        background: #f0f0f0;
                        border-radius: 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    .link-name {
                        font-weight: bold;
                        color: #444;
                    }
                    
                    .link-count {
                        background: #ff6b8b;
                        color: white;
                        padding: 5px 15px;
                        border-radius: 20px;
                        font-weight: bold;
                    }
                    
                    .refresh-btn {
                        background: #4CAF50;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1rem;
                        margin-top: 20px;
                        transition: background 0.3s ease;
                    }
                    
                    .refresh-btn:hover {
                        background: #45a049;
                    }
                    
                    .admin-info {
                        background: rgba(255, 235, 59, 0.1);
                        border: 2px solid #ffeb3b;
                        border-radius: 10px;
                        padding: 15px;
                        margin: 20px 0;
                        color: #333;
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
                            <i class="fas fa-mouse-pointer"></i>
                            <h3>Переходы за неделю</h3>
                            <div class="stat-number">${stats.weeklyClicks || 0}</div>
                            <p class="stat-desc">По всем ссылкам</p>
                        </div>
                        
                        <div class="stat-card">
                            <i class="fas fa-link"></i>
                            <h3>Всего переходов</h3>
                            <div class="stat-number">${stats.totalClicks || 0}</div>
                            <p class="stat-desc">За все время</p>
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
                                <p>Администраторов: ${CONFIG.ADMIN_IDS.length}</p>
                                <p>Уникальных за неделю: ${stats.weeklyUniqueUsers || 0}</p>
                            </div>
                            
                            <div class="info-item">
                                <h4><i class="fas fa-chart-line"></i> Активность</h4>
                                <p>${LINKS.length} отслеживаемых ссылок</p>
                                <p>Бот работает на Render.com</p>
                            </div>
                        </div>
                        
                        <div class="admin-info">
                            <h4 style="color: #ff9800; margin-bottom: 10px;">
                                <i class="fas fa-shield-alt"></i> Администраторы системы
                            </h4>
                            <p><strong>ID администраторов:</strong> ${CONFIG.ADMIN_IDS.join(', ')}</p>
                            <p><strong>Всего администраторов:</strong> ${CONFIG.ADMIN_IDS.length}</p>
                        </div>
                    </div>
                    
                    ${stats.linkStats && stats.linkStats.length > 0 ? `
                    <div class="info-section">
                        <h2 style="text-align: center; color: #444; margin-bottom: 30px;">
                            <i class="fas fa-chart-bar"></i> Статистика переходов по ссылкам
                        </h2>
                        <div class="link-stats-grid">
                            ${stats.linkStats.map(link => `
                                <div class="link-stat-item">
                                    <span class="link-name">${link.link_name}</span>
                                    <span class="link-count">${link.click_count || 0}</span>
                                </div>
                            `).join('')}
                        </div>
                        <p style="text-align: center; margin-top: 15px; color: #666;">
                            <i class="fas fa-info-circle"></i> Подсчитывается каждый переход (без дублирования)
                        </p>
                    </div>
                    ` : ''}
                    
                    ${stats.recentClicks && stats.recentClicks.length > 0 ? `
                    <div class="recent-clicks">
                        <h2 style="text-align: center; color: #444; margin-bottom: 30px;">
                            <i class="fas fa-history"></i> Последние переходы
                        </h2>
                        ${stats.recentClicks.map(click => `
                            <div class="click-item">
                                <div>
                                    <span class="click-user">${click.first_name || 'Пользователь'}</span>
                                    <span class="click-link"> → ${click.link_name}</span>
                                </div>
                                <span class="click-time">${click.clicked_at || 'N/A'}</span>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}
                    
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
                            <a href="/webhook" class="link-btn">
                                <i class="fas fa-code"></i> Статус вебхука
                            </a>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <button class="refresh-btn" onclick="location.reload()">
                            <i class="fas fa-sync-alt"></i> Обновить статистику
                        </button>
                        <p style="color: white; margin-top: 10px; opacity: 0.8;">
                            <i class="fas fa-info-circle"></i> Данные обновляются вручную
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>🤖 <strong>Бот "Клубничка"</strong> | 🍓 Все права защищены © 2024</p>
                        <p>Бот работает на <a href="https://render.com" target="_blank">Render.com</a> | Обновлено: ${new Date().toLocaleString('ru-RU')}</p>
                        <p style="margin-top: 20px; opacity: 0.8;">
                            <i class="fas fa-database"></i> Все переходы по ссылкам подсчитываются отдельно
                        </p>
                    </div>
                </div>
                
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        const cards = document.querySelectorAll('.stat-card, .info-item, .click-item, .link-stat-item');
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
    getCachedStats((stats) => {
        res.json({ 
            status: 'ok', 
            bot: 'running', 
            timestamp: new Date().toISOString(),
            stats: {
                total_users: stats.totalUsers || 0,
                total_participants: stats.totalParticipants || 0,
                weekly_clicks: stats.weeklyClicks || 0,
                total_clicks: stats.totalClicks || 0
            },
            config: {
                giveaway_active: CONFIG.GIVEAWAY_ACTIVE,
                giveaway_word: CONFIG.GIVEAWAY_WORD,
                admin_ids: CONFIG.ADMIN_IDS,
                admin_count: CONFIG.ADMIN_IDS.length
            },
            cache_info: {
                cached: cachedStats !== null,
                last_updated: new Date(lastCacheUpdate).toISOString()
            }
        });
    });
});

// GET обработчик для webhook
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
                <p><strong>Администраторов:</strong> ${CONFIG.ADMIN_IDS.length}</p>
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
            console.log(`👑 Администраторы: ${CONFIG.ADMIN_IDS.join(', ')}`);
            
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

// ==================== KEEP-ALIVE СИСТЕМА ДЛЯ ИЗБЕЖАНИЯ ПРОСТОЯ ====================
// Этот код добавлен в конец для предотвращения 50-секундного простоя на Render.com

// Импорт модулей для keep-alive
const http = require('http');
const https = require('https');

// Функция для пинга самого себя
function startKeepAlive() {
    console.log('🚀 Запуск системы keep-alive...');
    
    // Определяем, какой модуль использовать (http или https)
    const useHttps = RENDER_URL.startsWith('https');
    const pingModule = useHttps ? https : http;
    
    // Интервал пинга - каждые 25 секунд (меньше 30 секунд простоя Render)
    const PING_INTERVAL = 25000;
    
    // Основной интервал пинга
    const keepAliveInterval = setInterval(() => {
        const currentTime = new Date().toLocaleTimeString('ru-RU');
        
        // Пингуем health endpoint
        pingModule.get(`${RENDER_URL}/health`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const healthData = JSON.parse(data);
                    if (healthData.status === 'ok') {
                        console.log(`✅ Keep-alive: ${currentTime} | Бот активен`);
                    }
                } catch (e) {
                    console.log(`✅ Keep-alive: ${currentTime} | Ответ получен`);
                }
            });
        }).on('error', (err) => {
            console.log(`⚠️ Keep-alive ошибка: ${err.message}`);
        });
        
        // Каждую минуту пингуем главную страницу
        if (new Date().getSeconds() < 5) { // В начале каждой минуты
            pingModule.get(RENDER_URL, (res) => {
                console.log(`🏠 Главная страница активна (${currentTime})`);
            }).on('error', () => {
                console.log(`🏠 Главная страница не отвечает (${currentTime})`);
            });
        }
        
    }, PING_INTERVAL);
    
    // Дополнительный пинг каждые 10 минут для надежности
    setInterval(() => {
        pingModule.get(`${RENDER_URL}/health`, () => {
            console.log(`🔄 Дополнительный пинг выполнен: ${new Date().toLocaleTimeString('ru-RU')}`);
        });
    }, 600000); // 10 минут
    
    // Также пингуем при запуске
    setTimeout(() => {
        pingModule.get(`${RENDER_URL}/health`, () => {
            console.log('🚀 Начальный пинг выполнен успешно');
        });
    }, 5000);
    
    return keepAliveInterval;
}

// Запускаем keep-alive систему через 5 секунд после старта
setTimeout(() => {
    const keepAlive = startKeepAlive();
    
    // Очистка при завершении
    process.on('SIGINT', () => {
        if (keepAlive) clearInterval(keepAlive);
    });
    
    process.on('SIGTERM', () => {
        if (keepAlive) clearInterval(keepAlive);
    });
    
}, 5000);

// ==================== АЛЬТЕРНАТИВНЫЙ СПОСОБ: ИСПОЛЬЗОВАНИЕ ВНЕШНЕГО СЕРВИСА ====================
// Рекомендуется также настроить внешний сервис для мониторинга:
// 1. UptimeRobot.com (бесплатно, 50 мониторов)
// 2. cron-job.org (бесплатно)
// 3. StatusCake.com (бесплатно)

// Автоматическое создание HTTP-запроса каждые 29 секунд (для надежности)
setInterval(() => {
    // Простой HTTP запрос без использования внешних модулей
    try {
        const req = http.request(`${RENDER_URL}/health`, { method: 'HEAD' }, (res) => {
            // Просто игнорируем ответ, главное - отправить запрос
        });
        req.on('error', () => {
            // Игнорируем ошибки
        });
        req.end();
    } catch (e) {
        // Игнорируем все ошибки
    }
}, 29000); // 29 секунд

console.log('🛡️  Система защиты от простоя активирована');
console.log('⏰ Пинги будут отправляться каждые 25-29 секунд');


