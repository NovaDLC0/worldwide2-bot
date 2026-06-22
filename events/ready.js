const { ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');
const { getAutoMessage, getCountryHoldersMap, deleteAutoMessage, seedInitialData } = require('../database/db');
const { countryListEmbed, bannerEmbed, logoAttachment } = require('../utils/embedBuilder');

const ACTIVITY_TYPES = {
  PLAYING: ActivityType.Playing,
  WATCHING: ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  STREAMING: ActivityType.Streaming,
};

let countryListInterval = null;

async function startCountryListInterval(client) {
  if (countryListInterval) {
    clearInterval(countryListInterval);
    countryListInterval = null;
  }

  const saved = getAutoMessage('country_list');
  if (!saved) return;

  try {
    const channel = await client.channels.fetch(saved.channel_id);
    if (!channel) return;

    const message = await channel.messages.fetch(saved.message_id).catch(() => null);
    if (!message) return;

    console.log('[Авто] Возобновлено обновление списка стран');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('refresh_country_list')
        .setLabel('🔄 Обновить')
        .setStyle(ButtonStyle.Secondary),
    );

    countryListInterval = setInterval(async () => {
      try {
        const holdersMap = getCountryHoldersMap();
        const embed = countryListEmbed(holdersMap);
        await message.edit({
          embeds: [bannerEmbed(), embed],
          files: [logoAttachment()],
          components: [row],
        });
      } catch (err) {
        console.error('[Авто] Ошибка обновления списка стран:', err.message);
        if (err.code === 10008) {
          clearInterval(countryListInterval);
          countryListInterval = null;
          deleteAutoMessage('country_list');
          console.log('[Авто] Сообщение удалено, интервал остановлен');
        }
      }
    }, 5000);

  } catch (err) {
    console.error('[Авто] Не удалось возобновить интервал:', err.message);
  }
}

module.exports = {
  name: 'ready',
  once: true,

  async execute(client) {
    console.log(`[Бот] Запущен как ${client.user.tag}`);

    // Устанавливаем активность из конфига
    const activityType = ACTIVITY_TYPES[config.activityType] ?? ActivityType.Watching;
    client.user.setActivity(config.activityText, { type: activityType });
    console.log(`[Бот] Активность: ${config.activityType} "${config.activityText}"`);

    // Попытка сменить ник
    try {
      await client.user.setUsername('World Wide');
      console.log('[Бот] Имя изменено на "World Wide"');
    } catch {
      console.log('[Бот] Не удалось изменить имя (допустимо, менять через Developer Portal)');
    }

    // Засев начальных данных (только при первом запуске)
    seedInitialData();

    // Возобновляем автообновление списка стран
    await startCountryListInterval(client);
  },

  startCountryListInterval,
  getCountryListInterval: () => countryListInterval,
  setCountryListInterval: (interval) => { countryListInterval = interval; },
};
