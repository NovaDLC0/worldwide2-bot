const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCountryHoldersMap, saveAutoMessage, deleteAutoMessage } = require('../database/db');
const { countryListEmbed, withBanner, bannerEmbed, logoAttachment } = require('../utils/embedBuilder');
const readyEvent = require('../events/ready');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('country')
    .setDescription('Показать список всех стран'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const holdersMap = getCountryHoldersMap();
      const content = countryListEmbed(holdersMap);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_country_list')
          .setLabel('🔄 Обновить')
          .setStyle(ButtonStyle.Secondary),
      );

      const message = await interaction.editReply({
        embeds: [bannerEmbed(), content],
        files: [logoAttachment()],
        components: [row],
      });

      // Сохраняем ID сообщения в БД
      saveAutoMessage(message.id, interaction.channelId, 'country_list');

      // Останавливаем старый интервал, если был
      const oldInterval = readyEvent.getCountryListInterval();
      if (oldInterval) clearInterval(oldInterval);

      // Запускаем автообновление каждые 5 секунд
      const interval = setInterval(async () => {
        try {
          const updatedMap = getCountryHoldersMap();
          const updatedContent = countryListEmbed(updatedMap);
          await message.edit({
            embeds: [bannerEmbed(), updatedContent],
            files: [logoAttachment()],
            components: [row],
          });
        } catch (err) {
          if (err.code === 10008) {
            clearInterval(interval);
            readyEvent.setCountryListInterval(null);
            deleteAutoMessage('country_list');
            console.log('[country] Сообщение удалено, интервал остановлен');
          } else {
            console.error('[country] Ошибка автообновления:', err.message);
          }
        }
      }, 5000);

      readyEvent.setCountryListInterval(interval);

    } catch (err) {
      console.error('[country] Ошибка:', err);
      await interaction.editReply({ content: '❌ Произошла ошибка при получении списка стран.' });
    }
  },

  // Обработка кнопки ручного обновления
  async handleButton(interaction) {
    if (interaction.customId !== 'refresh_country_list') return;
    await interaction.deferUpdate();
    try {
      const holdersMap = getCountryHoldersMap();
      const content = countryListEmbed(holdersMap);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_country_list')
          .setLabel('🔄 Обновить')
          .setStyle(ButtonStyle.Secondary),
      );
      await interaction.editReply({
        embeds: [bannerEmbed(), content],
        files: [logoAttachment()],
        components: [row],
      });
    } catch (err) {
      console.error('[country] Ошибка кнопки обновления:', err);
    }
  },
};
