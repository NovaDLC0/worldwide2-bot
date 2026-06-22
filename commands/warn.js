const { SlashCommandBuilder } = require('discord.js');
const { addWarn, getWarnCount, getCountryByUser } = require('../database/db');
const { errorEmbed, warningEmbed, withBanner, bannerEmbed, logoAttachment } = require('../utils/embedBuilder');
const { isModerator } = require('../utils/checkPermissions');
const { doRemoveCountry } = require('./removecountry');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение пользователю (Модератор/Администратор)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Нарушитель').setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Причина предупреждения').setRequired(true),
    ),

  async execute(interaction) {
    if (!isModerator(interaction.member)) {
      return interaction.reply({
        ...withBanner(errorEmbed('Нет доступа', 'Эта команда доступна только модераторам и администраторам.')),
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason').trim();

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        ...withBanner(errorEmbed('Ошибка', 'Вы не можете выдать предупреждение самому себе.')),
        ephemeral: true,
      });
    }
    if (targetUser.bot) {
      return interaction.reply({
        ...withBanner(errorEmbed('Ошибка', 'Нельзя выдать предупреждение боту.')),
        ephemeral: true,
      });
    }

    try {
      addWarn(
        targetUser.id,
        targetUser.username,
        interaction.user.id,
        interaction.user.username,
        reason,
      );

      const warnCount = getWarnCount(targetUser.id);

      // Эмбед 1: только баннер (без текста, без заголовка)
      // Эмбед 2: информация о варне
      const warnEmbed = warningEmbed(
        'Предупреждение выдано',
        `Пользователь <@${targetUser.id}> получил предупреждение.`,
      ).addFields(
        { name: '👤 Нарушитель', value: `<@${targetUser.id}>`, inline: true },
        { name: '🛡️ Модератор', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📋 Причина', value: reason, inline: false },
        { name: '⚠️ Количество варнов', value: `${warnCount}/2`, inline: true },
      );

      // Отправляем: банер + варн-эмбед
      await interaction.reply({
        embeds: [bannerEmbed(), warnEmbed],
        files: [logoAttachment()],
      });

      // Уведомление нарушителю в ЛС
      try {
        await targetUser.send({
          embeds: [
            bannerEmbed(),
            warningEmbed(
              'Вы получили предупреждение',
              `Сервер **World Wide** выдал вам предупреждение.\n**Причина:** ${reason}\n**Варны:** ${warnCount}/2`,
            ),
          ],
          files: [logoAttachment()],
        });
      } catch {}

      // Если достигнуто 2 варна — снять страну автоматически
      if (warnCount >= 2) {
        const countryData = getCountryByUser(targetUser.id);

        if (countryData) {
          const pseudoInteraction = {
            user: interaction.user,
            client: interaction.client,
            reply: () => {},
          };

          await doRemoveCountry(pseudoInteraction, targetUser, countryData.country_name, true);

          // Уведомление нарушителю о снятии страны
          try {
            await targetUser.send({
              embeds: [
                bannerEmbed(),
                errorEmbed(
                  'Страна снята',
                  `Из-за достижения 2 предупреждений ваша страна **${countryData.country_name}** была автоматически снята на сервере **World Wide**.`,
                ),
              ],
              files: [logoAttachment()],
            });
          } catch {}

          // Уведомление модератору
          await interaction.followUp({
            embeds: [
              bannerEmbed(),
              errorEmbed('Страна снята автоматически', `<@${targetUser.id}> достиг 2 варнов. Страна **${countryData.country_name}** автоматически снята.`),
            ],
            files: [logoAttachment()],
          });
        } else {
          await interaction.followUp({
            embeds: [
              bannerEmbed(),
              warningEmbed('Достигнут лимит варнов', `<@${targetUser.id}> достиг 2 варнов. У пользователя нет назначенной страны.`),
            ],
            files: [logoAttachment()],
          });
        }
      }

      // Логирование
      try {
        const logChannel = await interaction.client.channels.fetch(config.logChannelId);
        if (logChannel) {
          await logChannel.send({
            embeds: [bannerEmbed(), warnEmbed],
            files: [logoAttachment()],
          });
        }
      } catch {}

    } catch (err) {
      console.error('[warn] Ошибка:', err);
      await interaction.reply({
        ...withBanner(errorEmbed('Ошибка', 'Не удалось выдать предупреждение. Попробуйте снова.')),
        ephemeral: true,
      });
    }
  },
};
