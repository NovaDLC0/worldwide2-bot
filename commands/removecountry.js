const { SlashCommandBuilder } = require('discord.js');
const { getCountryByUser, removeCountry } = require('../database/db');
const { successEmbed, errorEmbed, withBanner } = require('../utils/embedBuilder');
const { isAdmin } = require('../utils/checkPermissions');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecountry')
    .setDescription('Снять страну с пользователя (Администратор)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Пользователь').setRequired(true),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        ...withBanner(errorEmbed('Нет доступа', 'Эта команда доступна только администраторам.')),
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const existing = getCountryByUser(targetUser.id);

    if (!existing) {
      return interaction.reply({
        ...withBanner(errorEmbed('Страна не найдена', `У <@${targetUser.id}> нет назначенной страны.`)),
        ephemeral: true,
      });
    }

    await doRemoveCountry(interaction, targetUser, existing.country_name);
  },
};

/**
 * Снимает страну и отправляет уведомления
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').User} targetUser
 * @param {string} countryName
 * @param {boolean} silent - не отвечать на interaction (при вызове из /warn)
 */
async function doRemoveCountry(interaction, targetUser, countryName, silent = false) {
  try {
    removeCountry(targetUser.id);

    const embed = successEmbed(
      'Страна снята',
      `<@${targetUser.id}> больше не управляет страной **${countryName}**.`,
    ).addFields(
      { name: 'Пользователь', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Страна', value: countryName, inline: true },
      { name: 'Снял', value: `<@${interaction.user.id}>`, inline: true },
    );

    if (!silent) {
      await interaction.reply(withBanner(embed));
    }

    // Уведомление в личку
    try {
      await targetUser.send(withBanner(
        errorEmbed('Страна снята', `Ваша страна **${countryName}** была снята администратором <@${interaction.user.id}> на сервере **World Wide**.`),
      ));
    } catch {}

    // Логирование
    try {
      const channel = await interaction.client.channels.fetch(config.logChannelId);
      if (channel) await channel.send(withBanner(embed));
    } catch {}

  } catch (err) {
    console.error('[removecountry] Ошибка:', err);
    if (!silent) {
      await interaction.reply({
        ...withBanner(errorEmbed('Ошибка', 'Не удалось снять страну. Попробуйте снова.')),
        ephemeral: true,
      });
    }
  }
}

module.exports.doRemoveCountry = doRemoveCountry;
