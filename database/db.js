const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.json');

// === Инициализация ===
function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        const empty = {
            countries: [],
            warns: [],
            applications: [],
            cooldowns: [],
            user_selections: [],
            auto_messages: [],
            seed_done: { done: 0 }
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// === Заглушка для prepared statement ===
class Statement {
    constructor(db, sql, mode) {
        this.db = db;
        this.sql = sql;
        this.mode = mode; // 'run', 'get', 'all'
    }
    run(...params) {
        const data = loadDB();
        const result = { changes: 0 };
        // Эмуляция INSERT/UPDATE/DELETE через простой парсинг
        if (this.sql.includes('INSERT INTO countries')) {
            const [userId, username, countryName, assignedAt] = params;
            const existing = data.countries.find(c => c.user_id === userId);
            if (existing) {
                existing.username = username;
                existing.country_name = countryName;
                existing.assigned_at = assignedAt;
            } else {
                data.countries.push({
                    id: data.countries.length + 1,
                    user_id: userId,
                    username,
                    country_name: countryName,
                    assigned_at: assignedAt
                });
                result.changes = 1;
            }
        } else if (this.sql.includes('INSERT INTO warns')) {
            const [userId, username, moderatorId, moderatorUsername, reason, createdAt] = params;
            data.warns.push({
                id: data.warns.length + 1,
                user_id: userId,
                username,
                moderator_id: moderatorId,
                moderator_username: moderatorUsername,
                reason,
                created_at: createdAt
            });
            result.changes = 1;
        } else if (this.sql.includes('INSERT INTO applications')) {
            const [userId, username, countryName, knows_rules, ideology, government, knows_vpi, age, status, createdAt] = params;
            data.applications.push({
                id: data.applications.length + 1,
                user_id: userId,
                username,
                country_name: countryName,
                knows_rules,
                ideology,
                government,
                knows_vpi,
                age,
                status: 'pending',
                reviewer_id: null,
                reviewer_username: null,
                created_at: createdAt,
                reviewed_by: null,
                review_reason: null,
                reviewed_at: null
            });
            result.changes = 1;
        } else if (this.sql.includes('INSERT INTO cooldowns')) {
            const [userId, lastApplication] = params;
            const existing = data.cooldowns.find(c => c.user_id === userId);
            if (existing) {
                existing.last_application = lastApplication;
            } else {
                data.cooldowns.push({ user_id: userId, last_application: lastApplication });
            }
            result.changes = 1;
        } else if (this.sql.includes('INSERT INTO user_selections')) {
            const [userId, countryName, createdAt] = params;
            const existing = data.user_selections.find(s => s.user_id === userId);
            if (existing) {
                existing.country_name = countryName;
                existing.created_at = createdAt;
            } else {
                data.user_selections.push({ user_id: userId, country_name: countryName, created_at: createdAt });
            }
            result.changes = 1;
        } else if (this.sql.includes('INSERT INTO auto_messages')) {
            const [messageId, channelId, type, createdAt] = params;
            const existing = data.auto_messages.find(a => a.type === type);
            if (existing) {
                existing.message_id = messageId;
                existing.channel_id = channelId;
                existing.created_at = createdAt;
            } else {
                data.auto_messages.push({ id: data.auto_messages.length + 1, message_id: messageId, channel_id: channelId, type, created_at: createdAt });
            }
            result.changes = 1;
        } else if (this.sql.includes('INSERT OR REPLACE INTO seed_done')) {
            data.seed_done.done = 1;
            result.changes = 1;
        } else if (this.sql.includes('DELETE FROM countries')) {
            const userId = params[0];
            const idx = data.countries.findIndex(c => c.user_id === userId);
            if (idx !== -1) { data.countries.splice(idx, 1); result.changes = 1; }
        } else if (this.sql.includes('DELETE FROM user_selections')) {
            const userId = params[0];
            const idx = data.user_selections.findIndex(s => s.user_id === userId);
            if (idx !== -1) { data.user_selections.splice(idx, 1); result.changes = 1; }
        } else if (this.sql.includes('DELETE FROM auto_messages')) {
            const type = params[0];
            const idx = data.auto_messages.findIndex(a => a.type === type);
            if (idx !== -1) { data.auto_messages.splice(idx, 1); result.changes = 1; }
        } else if (this.sql.includes('UPDATE applications')) {
            const [status, reviewedBy, reason, reviewedAt, id] = params;
            const app = data.applications.find(a => a.id === id);
            if (app) {
                app.status = status;
                app.reviewed_by = reviewedBy;
                app.review_reason = reason;
                app.reviewed_at = reviewedAt;
                result.changes = 1;
            }
        } else if (this.sql.includes('UPDATE applications SET reviewer_id')) {
            const [reviewerId, reviewerUsername, id] = params;
            const app = data.applications.find(a => a.id === id);
            if (app) {
                app.reviewer_id = reviewerId;
                app.reviewer_username = reviewerUsername;
                result.changes = 1;
            }
        } else if (this.sql.includes('UPDATE countries')) {
            const [userId, username, countryName, assignedAt] = params;
            const c = data.countries.find(c => c.user_id === userId);
            if (c) {
                c.username = username;
                c.country_name = countryName;
                c.assigned_at = assignedAt;
                result.changes = 1;
            }
        } else if (this.sql.includes('UPDATE cooldowns')) {
            const [userId, lastApplication] = params;
            const c = data.cooldowns.find(c => c.user_id === userId);
            if (c) {
                c.last_application = lastApplication;
                result.changes = 1;
            }
        } else if (this.sql.includes('UPDATE user_selections')) {
            const [userId, countryName, createdAt] = params;
            const s = data.user_selections.find(s => s.user_id === userId);
            if (s) {
                s.country_name = countryName;
                s.created_at = createdAt;
                result.changes = 1;
            }
        }
        saveDB(data);
        return result;
    }
    get(...params) {
        const data = loadDB();
        if (this.sql.includes('SELECT * FROM countries WHERE user_id = ?')) {
            const userId = params[0];
            return data.countries.find(c => c.user_id === userId) || null;
        }
        if (this.sql.includes('SELECT done FROM seed_done')) {
            return { done: data.seed_done.done };
        }
        if (this.sql.includes('SELECT COUNT(*) as count FROM warns WHERE user_id = ?')) {
            const userId = params[0];
            const count = data.warns.filter(w => w.user_id === userId).length;
            return { count };
        }
        if (this.sql.includes('SELECT * FROM applications WHERE id = ?')) {
            const id = params[0];
            return data.applications.find(a => a.id === id) || null;
        }
        if (this.sql.includes('SELECT * FROM cooldowns WHERE user_id = ?')) {
            const userId = params[0];
            return data.cooldowns.find(c => c.user_id === userId) || null;
        }
        if (this.sql.includes('SELECT * FROM user_selections WHERE user_id = ?')) {
            const userId = params[0];
            return data.user_selections.find(s => s.user_id === userId) || null;
        }
        if (this.sql.includes('SELECT * FROM auto_messages WHERE type = ?')) {
            const type = params[0];
            return data.auto_messages.find(a => a.type === type) || null;
        }
        return null;
    }
    all(...params) {
        const data = loadDB();
        if (this.sql.includes('SELECT user_id, country_name FROM countries')) {
            return data.countries.map(c => ({ user_id: c.user_id, country_name: c.country_name }));
        }
        if (this.sql.includes('SELECT * FROM countries ORDER BY country_name ASC')) {
            return [...data.countries].sort((a, b) => a.country_name.localeCompare(b.country_name));
        }
        if (this.sql.includes('SELECT * FROM warns ORDER BY created_at DESC LIMIT ?')) {
            const limit = params[0] || 10;
            return [...data.warns].sort((a, b) => b.created_at - a.created_at).slice(0, limit);
        }
        if (this.sql.includes('SELECT * FROM warns WHERE user_id = ? ORDER BY created_at DESC')) {
            const userId = params[0];
            return data.warns.filter(w => w.user_id === userId).sort((a, b) => b.created_at - a.created_at);
        }
        if (this.sql.includes("SELECT * FROM applications WHERE status = 'pending' ORDER BY created_at ASC")) {
            return data.applications.filter(a => a.status === 'pending').sort((a, b) => a.created_at - b.created_at);
        }
        return [];
    }
}

// === Основной объект Database ===
class Database {
    constructor() {
        // Инициализация
    }
    pragma() { /* заглушка */ }
    exec(sql) {
        // Для CREATE TABLE просто игнорируем
        console.log('[БД] Выполнен SQL (заглушка):', sql.slice(0, 60));
    }
    prepare(sql) {
        return new Statement(this, sql);
    }
    transaction(fn) {
        return (...args) => {
            // Просто выполняем функцию (заглушка)
            return fn(...args);
        };
    }
}

const db = new Database();

// === Сид начальных данных ===
function seedInitialData() {
    try {
        const { INITIAL_ASSIGNMENTS } = require('../data/countries');
        const data = loadDB();
        if (data.seed_done.done) return;
        const now = Date.now();
        for (const a of INITIAL_ASSIGNMENTS) {
            const existing = data.countries.find(c => c.user_id === a.userId);
            if (!existing) {
                data.countries.push({
                    id: data.countries.length + 1,
                    user_id: a.userId,
                    username: a.username,
                    country_name: a.country,
                    assigned_at: now
                });
            }
        }
        data.seed_done.done = 1;
        saveDB(data);
        console.log('[БД] Начальные назначения стран загружены');
    } catch (e) {
        console.log('[БД] Начальные данные не загружены (файл countries.js отсутствует)');
    }
}

// === Страны ===
function getCountryByUser(userId) {
    const data = loadDB();
    return data.countries.find(c => c.user_id === userId) || null;
}
function getCountryHoldersMap() {
    const data = loadDB();
    const map = new Map();
    for (const row of data.countries) {
        if (!map.has(row.country_name)) map.set(row.country_name, []);
        map.get(row.country_name).push(row.user_id);
    }
    return map;
}
function getAllCountries() {
    const data = loadDB();
    return [...data.countries].sort((a, b) => a.country_name.localeCompare(b.country_name));
}
function setCountry(userId, username, countryName) {
    const data = loadDB();
    const now = Date.now();
    const existing = data.countries.find(c => c.user_id === userId);
    if (existing) {
        existing.username = username;
        existing.country_name = countryName;
        existing.assigned_at = now;
    } else {
        data.countries.push({
            id: data.countries.length + 1,
            user_id: userId,
            username,
            country_name: countryName,
            assigned_at: now
        });
    }
    saveDB(data);
}
function removeCountry(userId) {
    const data = loadDB();
    const idx = data.countries.findIndex(c => c.user_id === userId);
    if (idx !== -1) {
        data.countries.splice(idx, 1);
        saveDB(data);
        return { changes: 1 };
    }
    return { changes: 0 };
}

// === Варны ===
function addWarn(userId, username, moderatorId, moderatorUsername, reason) {
    const data = loadDB();
    data.warns.push({
        id: data.warns.length + 1,
        user_id: userId,
        username,
        moderator_id: moderatorId,
        moderator_username: moderatorUsername,
        reason,
        created_at: Date.now()
    });
    saveDB(data);
}
function getWarnCount(userId) {
    const data = loadDB();
    return data.warns.filter(w => w.user_id === userId).length;
}
function getRecentWarns(limit = 10) {
    const data = loadDB();
    return [...data.warns].sort((a, b) => b.created_at - a.created_at).slice(0, limit);
}
function getWarnsByUser(userId) {
    const data = loadDB();
    return data.warns.filter(w => w.user_id === userId).sort((a, b) => b.created_at - a.created_at);
}

// === Заявки ===
function addApplication(userId, username, countryName, fields) {
    const data = loadDB();
    const now = Date.now();
    data.applications.push({
        id: data.applications.length + 1,
        user_id: userId,
        username,
        country_name: countryName,
        knows_rules: fields.knows_rules,
        ideology: fields.ideology,
        government: fields.government,
        knows_vpi: fields.knows_vpi,
        age: fields.age,
        status: 'pending',
        reviewer_id: null,
        reviewer_username: null,
        created_at: now,
        reviewed_by: null,
        review_reason: null,
        reviewed_at: null
    });
    const cd = data.cooldowns.find(c => c.user_id === userId);
    if (cd) {
        cd.last_application = now;
    } else {
        data.cooldowns.push({ user_id: userId, last_application: now });
    }
    saveDB(data);
}
function getPendingApplications() {
    const data = loadDB();
    return data.applications.filter(a => a.status === 'pending').sort((a, b) => a.created_at - b.created_at);
}
function getApplicationById(id) {
    const data = loadDB();
    return data.applications.find(a => a.id === id) || null;
}
function updateApplicationStatus(id, status, reviewedBy, reason) {
    const data = loadDB();
    const app = data.applications.find(a => a.id === id);
    if (app) {
        app.status = status;
        app.reviewed_by = reviewedBy;
        app.review_reason = reason || null;
        app.reviewed_at = Date.now();
        saveDB(data);
    }
}
function setApplicationReviewer(id, reviewerId, reviewerUsername) {
    const data = loadDB();
    const app = data.applications.find(a => a.id === id);
    if (app) {
        app.reviewer_id = reviewerId;
        app.reviewer_username = reviewerUsername;
        saveDB(data);
    }
}
function getCooldown(userId) {
    const data = loadDB();
    return data.cooldowns.find(c => c.user_id === userId) || null;
}

// === Временный выбор ===
function saveUserSelection(userId, countryName) {
    const data = loadDB();
    const now = Date.now();
    const existing = data.user_selections.find(s => s.user_id === userId);
    if (existing) {
        existing.country_name = countryName;
        existing.created_at = now;
    } else {
        data.user_selections.push({ user_id: userId, country_name: countryName, created_at: now });
    }
    saveDB(data);
}
function getUserSelection(userId) {
    const data = loadDB();
    return data.user_selections.find(s => s.user_id === userId) || null;
}
function clearUserSelection(userId) {
    const data = loadDB();
    const idx = data.user_selections.findIndex(s => s.user_id === userId);
    if (idx !== -1) {
        data.user_selections.splice(idx, 1);
        saveDB(data);
    }
}

// === Автосообщения ===
function saveAutoMessage(messageId, channelId, type = 'country_list') {
    const data = loadDB();
    const existing = data.auto_messages.find(a => a.type === type);
    if (existing) {
        existing.message_id = messageId;
        existing.channel_id = channelId;
        existing.created_at = Date.now();
    } else {
        data.auto_messages.push({
            id: data.auto_messages.length + 1,
            message_id: messageId,
            channel_id: channelId,
            type,
            created_at: Date.now()
        });
    }
    saveDB(data);
}
function getAutoMessage(type = 'country_list') {
    const data = loadDB();
    return data.auto_messages.find(a => a.type === type) || null;
}
function deleteAutoMessage(type = 'country_list') {
    const data = loadDB();
    const idx = data.auto_messages.findIndex(a => a.type === type);
    if (idx !== -1) {
        data.auto_messages.splice(idx, 1);
        saveDB(data);
    }
}

module.exports = {
    db,
    seedInitialData,
    getCountryByUser, getCountryHoldersMap, getAllCountries, setCountry, removeCountry,
    addWarn, getWarnCount, getRecentWarns, getWarnsByUser,
    addApplication, getPendingApplications, getApplicationById,
    updateApplicationStatus, setApplicationReviewer, getCooldown,
    saveUserSelection, getUserSelection, clearUserSelection,
    saveAutoMessage, getAutoMessage, deleteAutoMessage,
};
