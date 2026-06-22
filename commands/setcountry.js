const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getCountryByUser, setCountry, getAllCountries } = require('../database/db');
const { successEmbed, errorEmbed, warningEmbed, withBanner, bannerEmbed, logoAttachment } = require('../utils/embedBuilder');
const { isAdmin } = require('../utils/checkPermissions');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcountry')
    .setDescription('Назначить страну пользователю (Администратор)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Пользователь').setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName('country').setDescription('Название страны').setRequired(true),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        ...withBanner(errorEmbed('Нет доступа', 'Эта команда доступна только администраторам.')),
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user');
    const countryName = interaction.options.getString('country').trim();

    if (!countryName) {
      return interaction.reply({
        ...withBanner(errorEmbed('Ошибка', 'Название страны не может быть пустым.')),
        ephemeral: true,
      });
    }

    // Проверяем, не занята ли страна другим игроком
    const allCountries = getAllCountries();
    const existingOwner = allCountries.find(
      c => c.country_name.toLowerCase() === countryName.toLowerCase() && c.user_id !== targetUser.id,
    );
    if (existingOwner) {
      return interaction.reply({
        ...withBanner(errorEmbed('Страна занята', `Страна **${countryName}** уже принадлежит <@${existingOwner.user_id}>.`)),
        ephemeral: true,
      });
    }

    const existing = getCountryByUser(targetUser.id);

    // Если у пользователя уже есть страна — запрашиваем подтверждение
    if (existing) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`setcountry_confirm_${targetUser.id}_${Buffer.from(countryName).toString('base64')}`)
          .setLabel('✅ Подтвердить замену')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('setcountry_cancel')
          .setLabel('❌ Отмена')
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.reply({
        ...withBanner(warningEmbed(
          'Страна уже назначена',
          `У <@${targetUser.id}> уже есть страна **${existing.country_name}**.\nЗаменить на **${countryName}**?`,
        )),
        components: [row],
        ephemeral: true,
      });
    }

    await assignCountry(interaction, targetUser, countryName);
  },

  async handleButton(interaction) {
    if (interaction.customId === 'setcountry_cancel') {
      return interaction.update({
        ...withBanner(errorEmbed('Отменено', 'Операция отменена.')),
        components: [],
      });
    }

    if (interaction.customId.startsWith('setcountry_confirm_')) {
      const parts = interaction.customId.split('_');
      const userId = parts[2];
      const countryName = Buffer.from(parts[3], 'base64').toString('utf8');

      if (!isAdmin(interaction.member)) {
        return interaction.update({
          ...withBanner(errorEmbed('Нет доступа', 'У вас нет прав для подтверждения этого действия.')),
          components: [],
        });
      }

      const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
      if (!targetUser) {
        return interaction.update({
          ...withBanner(errorEmbed('Ошибка', 'Пользователь не найден.')),
          components: [],
        });
      }

      await interaction.update({ components: [] });
      await assignCountry(interaction, targetUser, countryName, true);
    }
  },
};

async function assignCountry(interaction, targetUser, countryName, isUpdate = false) {
  try {
    setCountry(targetUser.id, targetUser.username, countryName);

    const embed = successEmbed(
      'Страна назначена',
      `<@${targetUser.id}> теперь управляет страной **${countryName}**.`,
    ).addFields(
      { name: 'Пользователь', value: `<@${targetUser.id}>`, inline: true },
      { name: 'Страна', value: countryName, inline: true },
      { name: 'Назначил', value: `<@${interaction.user.id}>`, inline: true },
    );

    if (isUpdate) {
      await interaction.followUp(withBanner(embed));
    } else {
      await interaction.reply(withBanner(embed));
    }

    // Уведомление в личку
    try {
      await targetUser.send(withBanner(
        successEmbed('Вам назначена страна', `Администратор <@${interaction.user.id}> назначил вам страну **${countryName}** на сервере **World Wide**.`),
      ));
    } catch {}

    // Логирование
    await sendLog(interaction.client, embed);

  } catch (err) {
    console.error('[setcountry] Ошибка:', err);
    const replyMethod = isUpdate ? 'followUp' : 'reply';
    await interaction[replyMethod]({
      ...withBanner(errorEmbed('Ошибка', 'Не удалось назначить страну. Попробуйте снова.')),
      ephemeral: true,
    });
  }
}

async function sendLog(client, embed) {
  try {
    const channel = await client.channels.fetch(config.logChannelId);
    if (channel) await channel.send(withBanner(embed));
  } catch {}
}
