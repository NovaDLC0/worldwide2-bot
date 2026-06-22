const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// === Динамическая загрузка команд ===
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
const commandsData = [];

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    commandsData.push(command.data.toJSON());
    console.log(`[Команды] Загружена: /${command.data.name}`);
  }
}

// === Регистрация слэш-команд ===
(async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log('[Discord] Регистрация слэш-команд...');
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commandsData },
    );
    console.log(`[Discord] Зарегистрировано ${commandsData.length} команд`);
  } catch (err) {
    console.error('[Discord] Ошибка регистрации команд:', err);
  }
})();

// === Динамическая загрузка событий ===
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[События] Загружено: ${event.name}`);
}

// === Обработчик взаимодействий ===
client.on('interactionCreate', async interaction => {
  try {

    // ── Слэш-команды ──────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return interaction.reply({ content: '❌ Команда не найдена.', ephemeral: true });
      return command.execute(interaction);
    }

    const panel  = client.commands.get('panel');
    const admin  = client.commands.get('admin');
    const setcmd = client.commands.get('setcountry');
    const country = client.commands.get('country');

    // ── Кнопки ────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Список стран (обновить)
      if (id === 'refresh_country_list') return country?.handleButton(interaction);

      // Главная панель + выбор страны + подача анкеты
      if (id === 'panel_choose_country' || id === 'panel_submit_app')
        return panel?.handleButton(interaction);

      // Кнопки из лог-канала: взять / одобрить / отказать
      if (id.startsWith('review_take_') || id.startsWith('review_approve_') || id.startsWith('review_reject_'))
        return panel?.handleButton(interaction);

      // setcountry: подтверждение замены
      if (id.startsWith('setcountry_confirm_') || id === 'setcountry_cancel')
        return setcmd?.handleButton(interaction);

      // Панель администратора
      if (id.startsWith('admin_')) return admin?.handleButton(interaction);

      return;
    }

    // ── Select-меню ───────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;

      // Выбор региона и страны в /panel
      if (id === 'panel_region_select' || id.startsWith('panel_country_select_'))
        return panel?.handleSelect(interaction);

      // Списки в /admin
      if (id.startsWith('admin_')) return admin?.handleSelect(interaction);

      return;
    }

    // ── Модальные окна ────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // Анкета-заявка
      if (id === 'panel_app_modal') return panel?.handleModal(interaction);

      // Причина отказа из лог-канала
      if (id.startsWith('review_reject_modal_')) return panel?.handleModal(interaction);

      // Модалки /admin
      if (id.startsWith('admin_reject_modal_') || id.startsWith('reject_reason_modal_'))
        return admin?.handleModal(interaction);

      return;
    }

  } catch (err) {
    console.error('[Взаимодействие] Необработанная ошибка:', err);
    try {
      const msg = { content: '❌ Произошла внутренняя ошибка. Попробуйте позже.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(msg);
      else await interaction.reply(msg);
    } catch {}
  }
});

// === Глобальный перехват ошибок ===
process.on('unhandledRejection', err => console.error('[Процесс] Необработанный reject:', err));
process.on('uncaughtException',  err => console.error('[Процесс] Необработанное исключение:', err));

// === Запуск ===
client.login(config.token).catch(err => {
  console.error('[Авторизация] Не удалось подключиться:', err.message);
  process.exit(1);
});
