# 🌍 World Wide Bot

Discord-бот для управления странами: заявки, варны, автообновляемый список.

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка config.json
Откройте `config.json` и заполните все поля:

| Поле | Описание |
|------|----------|
| `token` | Токен бота из Discord Developer Portal |
| `clientId` | Application ID бота |
| `guildId` | ID вашего сервера (ПКМ по серверу → Копировать ID) |
| `logChannelId` | ID канала для логов |
| `adminRoleId` | ID роли администратора |
| `applicationCooldownHours` | Кулдаун между заявками (в часах) |
| `activityType` | WATCHING / PLAYING / LISTENING / STREAMING |
| `activityText` | Текст активности |

### 3. Запуск
```bash
npm start
```

## Команды

| Команда | Описание | Права |
|---------|----------|-------|
| `/country` | Список всех стран (автообновление каждые 5 сек) | Все |
| `/setcountry @user страна` | Назначить страну | Администратор |
| `/removecountry @user` | Снять страну | Администратор |
| `/warn @user причина` | Выдать предупреждение (2 варна = снятие страны) | Модератор |
| `/panel` | Панель подачи заявки | Все |
| `/admin` | Панель администратора | Администратор |

## Настройка прав модератора

Модератором считается пользователь с правом `ManageMessages` или `KickMembers` в Discord,
либо с ролью из `adminRoleId`.

## Баннер предупреждений

В файле `commands/warn.js` замените `BANNER_URL` на ссылку на изображение вашего сервера:
```js
const BANNER_URL = 'https://ссылка-на-ваш-баннер.png';
```

## Примечание об имени бота

Изменение имени бота через `client.user.setUsername()` имеет строгий лимит Discord (2 раза в час).
Рекомендуется задать имя **World Wide** вручную в Discord Developer Portal.
