const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  getPendingApplications,
  getApplicationById,
  updateApplicationStatus,
  getAllCountries,
  getCountryByUser,
  setCountry,
  removeCountry,
  getRecentWarns,
} = require('../database/db');
const { baseEmbed, successEmbed, errorEmbed, warningEmbed, withBanner, bannerEmbed, logoAttachment } = require('../utils/embedBuilder');
const { isAdmin } = require('../utils/checkPermissions');
const config = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Панель администратора (Администратор)'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        ...withBanner(errorEmbed('Нет доступа', 'Эта команда доступна только администраторам.')),
        ephemeral: true,
      });
    }

    const embed = baseEmbed('DEFAULT')
      .setTitle('⚙️ Панель администратора — World Wide')
      .setDescription('Выберите раздел для управления:')
      .addFields(
        { name: '📥 Список заявок', value: 'Просмотр и обработка активных заявок', inline: true },
        { name: '👥 Страны', value: 'Управление странами игроков', inline: true },
        { name: '⚠️ История варнов', value: 'Последние 10 предупреждений', inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('admin_applications').setLabel('📥 Заявки').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_countries').setLabel('👥 Страны').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('admin_warns').setLabel('⚠️ Варны').setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
      components: [row],
      ephemeral: true,
    });
  },

  async handleButton(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        ...withBanner(errorEmbed('Нет доступа', 'Недостаточно прав.')),
        ephemeral: true,
      });
    }

    // === Раздел: Заявки ===
    if (interaction.customId === 'admin_applications') {
      const apps = getPendingApplications();

      if (apps.length === 0) {
        return interaction.update({
          embeds: [bannerEmbed(), baseEmbed('DEFAULT').setTitle('📥 Заявки').setDescription('Активных заявок нет.')],
          files: [logoAttachment()],
          components: [backRow()],
        });
      }

      const options = apps.slice(0, 25).map(a => ({
        label: `#${a.id} — ${a.country_name}`,
        description: `${a.username} • ${new Date(a.created_at).toLocaleDateString('ru-RU')}`,
        value: String(a.id),
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId('admin_app_select')
        .setPlaceholder('Выберите заявку для просмотра...')
        .addOptions(options);

      const embed = baseEmbed('DEFAULT')
        .setTitle('📥 Активные заявки')
        .setDescription(`Найдено **${apps.length}** заявок. Выберите для просмотра:`);

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [new ActionRowBuilder().addComponents(select), backRow()],
      });
    }

    // === Раздел: Страны ===
    if (interaction.customId === 'admin_countries') {
      const countries = getAllCountries();

      if (countries.length === 0) {
        return interaction.update({
          embeds: [bannerEmbed(), baseEmbed('DEFAULT').setTitle('👥 Страны').setDescription('Нет назначенных стран.')],
          files: [logoAttachment()],
          components: [backRow()],
        });
      }

      const options = countries.slice(0, 25).map(c => ({
        label: c.country_name,
        description: `Владелец: ${c.username}`,
        value: c.user_id,
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId('admin_country_select')
        .setPlaceholder('Выберите страну...')
        .addOptions(options);

      const embed = baseEmbed('DEFAULT')
        .setTitle('👥 Управление странами')
        .setDescription(`Зарегистрировано **${countries.length}** стран.`);

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [new ActionRowBuilder().addComponents(select), backRow()],
      });
    }

    // === Раздел: Варны ===
    if (interaction.customId === 'admin_warns') {
      const warns = getRecentWarns(10);

      const embed = baseEmbed('WARNING').setTitle('⚠️ Последние предупреждения');

      if (warns.length === 0) {
        embed.setDescription('История варнов пуста.');
      } else {
        const lines = warns.map((w, i) =>
          `**${i + 1}.** <@${w.user_id}> — *${w.reason}*\n> Модератор: <@${w.moderator_id}> • <t:${Math.floor(w.created_at / 1000)}:R>`,
        );
        embed.setDescription(lines.join('\n\n'));
      }

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [backRow()],
      });
    }

    // === Кнопка "Назад" ===
    if (interaction.customId === 'admin_back') {
      const embed = baseEmbed('DEFAULT')
        .setTitle('⚙️ Панель администратора — World Wide')
        .setDescription('Выберите раздел для управления:')
        .addFields(
          { name: '📥 Список заявок', value: 'Просмотр и обработка активных заявок', inline: true },
          { name: '👥 Страны', value: 'Управление странами игроков', inline: true },
          { name: '⚠️ История варнов', value: 'Последние 10 предупреждений', inline: true },
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_applications').setLabel('📥 Заявки').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('admin_countries').setLabel('👥 Страны').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_warns').setLabel('⚠️ Варны').setStyle(ButtonStyle.Danger),
      );

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [row],
      });
    }

    // === Одобрить заявку ===
    if (interaction.customId.startsWith('admin_app_approve_')) {
      const appId = parseInt(interaction.customId.replace('admin_app_approve_', ''));
      const app = getApplicationById(appId);
      if (!app || app.status !== 'pending') {
        return interaction.update({
          embeds: [bannerEmbed(), warningEmbed('Заявка недоступна', 'Заявка уже обработана или не существует.')],
          files: [logoAttachment()],
          components: [backRow()],
        });
      }

      setCountry(app.user_id, app.username, app.country_name);
      updateApplicationStatus(appId, 'approved', interaction.user.id, null);

      await interaction.update({
        embeds: [
          bannerEmbed(),
          successEmbed('Заявка одобрена', `Заявка #${appId} от <@${app.user_id}> на страну **${app.country_name}** — одобрена.`),
        ],
        files: [logoAttachment()],
        components: [backRow()],
      });

      try {
        const u = await interaction.client.users.fetch(app.user_id);
        await u.send({
          embeds: [bannerEmbed(), successEmbed('Заявка одобрена!', `Ваша заявка на страну **${app.country_name}** одобрена!`)],
          files: [logoAttachment()],
        });
      } catch {}
    }

    // === Отклонить заявку (открыть модалку) ===
    if (interaction.customId.startsWith('admin_app_reject_')) {
      const appId = parseInt(interaction.customId.replace('admin_app_reject_', ''));
      const modal = new ModalBuilder()
        .setCustomId(`admin_reject_modal_${appId}`)
        .setTitle('Причина отклонения');
      const input = new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Причина')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(200);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    // === Снять страну ===
    if (interaction.customId.startsWith('admin_country_remove_')) {
      const userId = interaction.customId.replace('admin_country_remove_', '');
      const c = getCountryByUser(userId);
      if (!c) {
        return interaction.update({
          embeds: [bannerEmbed(), errorEmbed('Ошибка', 'У пользователя нет страны.')],
          files: [logoAttachment()],
          components: [backRow()],
        });
      }
      removeCountry(userId);
      await interaction.update({
        embeds: [bannerEmbed(), successEmbed('Страна снята', `Страна **${c.country_name}** снята с <@${userId}>.`)],
        files: [logoAttachment()],
        components: [backRow()],
      });
      try {
        const u = await interaction.client.users.fetch(userId);
        await u.send({
          embeds: [bannerEmbed(), errorEmbed('Страна снята', `Ваша страна **${c.country_name}** была снята администратором.`)],
          files: [logoAttachment()],
        });
      } catch {}
    }
  },

  // Обработка select-меню
  async handleSelect(interaction) {
    if (!isAdmin(interaction.member)) return;

    // === Детальный просмотр заявки ===
    if (interaction.customId === 'admin_app_select') {
      const appId = parseInt(interaction.values[0]);
      const app = getApplicationById(appId);
      if (!app) {
        return interaction.update({
          embeds: [bannerEmbed(), errorEmbed('Заявка не найдена', 'Заявка не существует.')],
          files: [logoAttachment()],
          components: [backRow()],
        });
      }

      const embed = baseEmbed('WARNING')
        .setTitle(`📋 Заявка #${app.id}`)
        .addFields(
          { name: '👤 Заявитель', value: `<@${app.user_id}>`, inline: true },
          { name: '🌍 Страна', value: app.country_name, inline: true },
          { name: '📅 Подана', value: `<t:${Math.floor(app.created_at / 1000)}:R>`, inline: true },
          { name: '📊 Статус', value: app.status, inline: true },
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`admin_app_approve_${app.id}`).setLabel('✅ Одобрить').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`admin_app_reject_${app.id}`).setLabel('❌ Отклонить').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_applications').setLabel('← Назад к списку').setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [row],
      });
    }

    // === Детальный просмотр страны ===
    if (interaction.customId === 'admin_country_select') {
      const userId = interaction.values[0];
      const c = getCountryByUser(userId);
      if (!c) {
        return interaction.update({
          embeds: [bannerEmbed(), errorEmbed('Ошибка', 'Страна не найдена.')],
          files: [logoAttachment()],
          components: [backRow()],
        });
      }

      const embed = baseEmbed('DEFAULT')
        .setTitle(`🌍 ${c.country_name}`)
        .addFields(
          { name: '👤 Владелец', value: `<@${c.user_id}>`, inline: true },
          { name: '📅 Назначена', value: `<t:${Math.floor(c.assigned_at / 1000)}:R>`, inline: true },
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`admin_country_remove_${userId}`).setLabel('🗑️ Снять страну').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('admin_countries').setLabel('← Назад').setStyle(ButtonStyle.Secondary),
      );

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [row],
      });
    }
  },

  // Обработка модальных окон
  async handleModal(interaction) {
    // Отклонение через /admin
    if (interaction.customId.startsWith('admin_reject_modal_')) {
      const appId = parseInt(interaction.customId.replace('admin_reject_modal_', ''));
      const reason = interaction.fields.getTextInputValue('reject_reason').trim();
      const app = getApplicationById(appId);

      if (!app || app.status !== 'pending') {
        return interaction.reply({
          ...withBanner(warningEmbed('Недоступно', 'Заявка уже обработана.')),
          ephemeral: true,
        });
      }

      updateApplicationStatus(appId, 'rejected', interaction.user.id, reason);

      await interaction.reply({
        ...withBanner(errorEmbed(
          'Заявка отклонена',
          `Заявка #${appId} от <@${app.user_id}> на страну **${app.country_name}** отклонена.\n**Причина:** ${reason}`,
        )),
        ephemeral: true,
      });

      try {
        const u = await interaction.client.users.fetch(app.user_id);
        await u.send({
          embeds: [bannerEmbed(), errorEmbed('Заявка отклонена', `Ваша заявка на страну **${app.country_name}** отклонена.\n**Причина:** ${reason}`)],
          files: [logoAttachment()],
        });
      } catch {}
    }

    // Отклонение через кнопку в лог-канале
    if (interaction.customId.startsWith('reject_reason_modal_')) {
      const appId = parseInt(interaction.customId.replace('reject_reason_modal_', ''));
      const reason = interaction.fields.getTextInputValue('reject_reason_input').trim();
      const app = getApplicationById(appId);

      if (!app || app.status !== 'pending') {
        return interaction.reply({
          ...withBanner(warningEmbed('Недоступно', 'Заявка уже обработана.')),
          ephemeral: true,
        });
      }

      updateApplicationStatus(appId, 'rejected', interaction.user.id, reason);

      await interaction.update({
        embeds: [
          bannerEmbed(),
          errorEmbed('Заявка отклонена', `Заявка #${appId} от <@${app.user_id}> на страну **${app.country_name}** отклонена.\n**Причина:** ${reason}`),
        ],
        files: [logoAttachment()],
        components: [],
      });

      try {
        const u = await interaction.client.users.fetch(app.user_id);
        await u.send({
          embeds: [bannerEmbed(), errorEmbed('Заявка отклонена', `Ваша заявка на страну **${app.country_name}** отклонена.\n**Причина:** ${reason}`)],
          files: [logoAttachment()],
        });
      } catch {}

      // Логирование
      try {
        const logChannel = await interaction.client.channels.fetch(config.logChannelId);
        if (logChannel) {
          await logChannel.send({
            embeds: [
              bannerEmbed(),
              errorEmbed('Заявка отклонена', `Администратор <@${interaction.user.id}> отклонил заявку #${appId} (<@${app.user_id}>)\n**Причина:** ${reason}`),
            ],
            files: [logoAttachment()],
          });
        }
      } catch {}
    }
  },
};

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_back')
      .setLabel('← Главное меню')
      .setStyle(ButtonStyle.Secondary),
  );
}
