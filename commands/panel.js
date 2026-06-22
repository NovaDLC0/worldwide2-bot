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
  getCooldown, addApplication, getPendingApplications,
  getApplicationById, updateApplicationStatus, setApplicationReviewer,
  setCountry, getAllCountries, saveUserSelection, getUserSelection, clearUserSelection,
} = require('../database/db');

const { COUNTRIES, REGIONS } = require('../data/countries');
const { baseEmbed, successEmbed, errorEmbed, warningEmbed, withBanner, bannerEmbed, logoAttachment } = require('../utils/embedBuilder');
const config = require('../config.json');

// === Вспомогательные функции ===

/** Строка кнопок главной панели */
function mainPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('panel_choose_country')
      .setLabel('🗺️ Выбрать страну')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('panel_submit_app')
      .setLabel('📋 Подать анкету')
      .setStyle(ButtonStyle.Primary),
  );
}

/** Select-меню выбора региона */
function regionSelectRow() {
  const options = Object.entries(REGIONS).map(([key, r]) => ({
    label: r.label,
    description: r.description,
    value: key,
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('panel_region_select')
      .setPlaceholder('Выберите регион...')
      .addOptions(options),
  );
}

/** Select-меню стран для выбранного региона */
function countrySelectRow(regionKey) {
  const items = COUNTRIES.filter(c => c.region === regionKey);
  const taken = new Set(getAllCountries().map(c => c.country_name));

  const options = items.map(c => {
    const isTaken = taken.has(c.name);
    return {
      label: `${c.flag} ${c.name}`,
      description: isTaken ? '⛔ Занято' : '✅ Свободно',
      value: c.name,
      default: false,
    };
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`panel_country_select_${regionKey}`)
      .setPlaceholder('Выберите страну...')
      .addOptions(options),
  );
}

/** Возвращает embed для этапа выбора региона */
function regionEmbed() {
  return baseEmbed('DEFAULT')
    .setTitle('🗺️ Выбор страны — Регион')
    .setDescription('Сначала выберите **регион**, затем — конкретную страну.');
}

// ============================================================
// КОМАНДА /panel
// ============================================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Разместить панель подачи заявок на страну'),

  async execute(interaction) {
    const embed = baseEmbed('DEFAULT')
      .setTitle('🌍 World Wide — Панель заявок')
      .setDescription(
        'Добро пожаловать в панель заявок!\n\n' +
        '> 🗺️ **Выбрать страну** — выберите государство, которым хотите управлять\n' +
        '> 📋 **Подать анкету** — заполните заявку (страна должна быть выбрана)\n\n' +
        `> ⏰ **Кулдаун:** ${config.applicationCooldownHours} ч. между заявками`,
      );

    await interaction.reply({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
      components: [mainPanelRow()],
    });
  },

  // ============================================================
  // КНОПКИ
  // ============================================================
  async handleButton(interaction) {

    // --- Кнопка: Выбрать страну ---
    if (interaction.customId === 'panel_choose_country') {
      return interaction.reply({
        embeds: [bannerEmbed(), regionEmbed()],
        files: [logoAttachment()],
        components: [regionSelectRow()],
        ephemeral: true,
      });
    }

    // --- Кнопка: Подать анкету ---
    if (interaction.customId === 'panel_submit_app') {
      // Проверяем кулдаун
      const cooldown = getCooldown(interaction.user.id);
      if (cooldown) {
        const ms = config.applicationCooldownHours * 3600000;
        const elapsed = Date.now() - cooldown.last_application;
        if (elapsed < ms) {
          const remaining = Math.ceil((ms - elapsed) / 3600000);
          return interaction.reply({
            ...withBanner(warningEmbed('Кулдаун активен', `Следующая заявка доступна через **${remaining} ч.**`)),
            ephemeral: true,
          });
        }
      }

      // Проверяем, выбрана ли страна
      const sel = getUserSelection(interaction.user.id);
      if (!sel) {
        // Страна не выбрана — перенаправляем к выбору
        const hint = warningEmbed(
          'Страна не выбрана',
          'Сначала выберите страну через **🗺️ Выбрать страну**, а затем вернитесь к подаче анкеты.',
        );
        return interaction.reply({
          embeds: [bannerEmbed(), hint, regionEmbed()],
          files: [logoAttachment()],
          components: [regionSelectRow()],
          ephemeral: true,
        });
      }

      // Страна выбрана — открываем анкету
      return openApplicationModal(interaction, sel.country_name);
    }

    // --- Кнопки управления заявкой из лог-канала ---

    // Взять на рассмотрение
    if (interaction.customId.startsWith('review_take_')) {
      const appId = parseInt(interaction.customId.replace('review_take_', ''));
      return handleTakeReview(interaction, appId);
    }

    // Одобрить
    if (interaction.customId.startsWith('review_approve_')) {
      const appId = parseInt(interaction.customId.replace('review_approve_', ''));
      return handleApprove(interaction, appId);
    }

    // Отказать (открыть модалку)
    if (interaction.customId.startsWith('review_reject_')) {
      const appId = parseInt(interaction.customId.replace('review_reject_', ''));
      return handleRejectModal(interaction, appId);
    }
  },

  // ============================================================
  // SELECT-МЕНЮ
  // ============================================================
  async handleSelect(interaction) {

    // --- Выбор региона ---
    if (interaction.customId === 'panel_region_select') {
      const regionKey = interaction.values[0];
      const region = REGIONS[regionKey];
      if (!region) return;

      const embed = baseEmbed('DEFAULT')
        .setTitle(`${region.label} — Выбор страны`)
        .setDescription('Выберите государство из списка. Занятые страны отмечены ⛔.');

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [countrySelectRow(regionKey)],
      });
    }

    // --- Выбор конкретной страны ---
    if (interaction.customId.startsWith('panel_country_select_')) {
      const countryName = interaction.values[0];
      const taken = getAllCountries().find(c => c.country_name === countryName);

      if (taken) {
        return interaction.update({
          embeds: [
            bannerEmbed(),
            errorEmbed('Страна занята', `**${countryName}** уже принадлежит <@${taken.user_id}>.\nВыберите другую страну.`),
            regionEmbed(),
          ],
          files: [logoAttachment()],
          components: [regionSelectRow()],
        });
      }

      // Сохраняем выбор в БД
      saveUserSelection(interaction.user.id, countryName);

      const country = COUNTRIES.find(c => c.name === countryName);
      const flag = country?.flag ?? '🌍';

      const embed = baseEmbed('SUCCESS')
        .setTitle('✅ Страна выбрана')
        .setDescription(
          `Вы выбрали: ${flag} **${countryName}**\n\n` +
          'Теперь нажмите **📋 Подать анкету** на главной панели, чтобы заполнить заявку.',
        );

      return interaction.update({
        embeds: [bannerEmbed(), embed],
        files: [logoAttachment()],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('panel_choose_country')
              .setLabel('🔄 Изменить страну')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('panel_submit_app')
              .setLabel('📋 Подать анкету')
              .setStyle(ButtonStyle.Success),
          ),
        ],
      });
    }
  },

  // ============================================================
  // МОДАЛКИ
  // ============================================================
  async handleModal(interaction) {

    // --- Анкета-заявка ---
    if (interaction.customId === 'panel_app_modal') {
      const sel = getUserSelection(interaction.user.id);
      if (!sel) {
        return interaction.reply({
          ...withBanner(errorEmbed('Ошибка', 'Выбор страны устарел. Начните заново через /panel.')),
          ephemeral: true,
        });
      }

      // Повторная проверка кулдауна
      const cooldown = getCooldown(interaction.user.id);
      if (cooldown) {
        const ms = config.applicationCooldownHours * 3600000;
        if (Date.now() - cooldown.last_application < ms) {
          return interaction.reply({
            ...withBanner(warningEmbed('Кулдаун активен', 'Вы уже подавали заявку недавно.')),
            ephemeral: true,
          });
        }
      }

      // Проверяем, не занята ли страна (могли занять пока шла анкета)
      const taken = getAllCountries().find(c => c.country_name === sel.country_name);
      if (taken) {
        clearUserSelection(interaction.user.id);
        return interaction.reply({
          ...withBanner(errorEmbed('Страна занята', `**${sel.country_name}** только что заняли. Выберите другую через /panel.`)),
          ephemeral: true,
        });
      }

      const fields = {
        knows_rules: interaction.fields.getTextInputValue('app_rules'),
        ideology:    interaction.fields.getTextInputValue('app_ideology'),
        government:  interaction.fields.getTextInputValue('app_government'),
        knows_vpi:   interaction.fields.getTextInputValue('app_vpi'),
        age:         interaction.fields.getTextInputValue('app_age'),
      };

      addApplication(interaction.user.id, interaction.user.username, sel.country_name, fields);
      clearUserSelection(interaction.user.id);

      // Ответ заявителю
      await interaction.reply({
        ...withBanner(successEmbed(
          'Заявка подана',
          `Ваша заявка на страну **${sel.country_name}** отправлена на рассмотрение.\nВы получите уведомление в личные сообщения.`,
        )),
        ephemeral: true,
      });

      // Отправка в лог-канал
      await sendApplicationToLog(interaction, sel.country_name, fields);
    }

    // --- Причина отказа ---
    if (interaction.customId.startsWith('review_reject_modal_')) {
      const appId = parseInt(interaction.customId.replace('review_reject_modal_', ''));
      const reason = interaction.fields.getTextInputValue('reject_reason').trim();
      await processRejection(interaction, appId, reason);
    }
  },
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/** Открывает модальное окно анкеты */
async function openApplicationModal(interaction, countryName) {
  const country = COUNTRIES.find(c => c.name === countryName);
  const flag = country?.flag ?? '🌍';

  const modal = new ModalBuilder()
    .setCustomId('panel_app_modal')
    .setTitle(`Заявка: ${flag} ${countryName}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_rules')
        .setLabel('Вы знаете правила сервера?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Да / Нет')
        .setRequired(true)
        .setMaxLength(50),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_ideology')
        .setLabel('Выбранная идеология')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Идеологии смотри в канале #идеологии')
        .setRequired(true)
        .setMaxLength(100),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_government')
        .setLabel('Выбранная форма правления')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например: Республика, Монархия...')
        .setRequired(true)
        .setMaxLength(100),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_vpi')
        .setLabel('Вы понимаете что такое ВПИ?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Да / Нет / Объясните своими словами')
        .setRequired(true)
        .setMaxLength(200),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('app_age')
        .setLabel('Ваш возраст')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите ваш возраст')
        .setRequired(true)
        .setMaxLength(3),
    ),
  );

  await interaction.showModal(modal);
}

/** Отправляет заявку в лог-канал */
async function sendApplicationToLog(interaction, countryName, fields) {
  try {
    const logChannel = await interaction.client.channels.fetch(config.logChannelId);
    if (!logChannel) return;

    // Получаем последнюю добавленную заявку
    const apps = getPendingApplications();
    const app = [...apps].reverse().find(a => a.user_id === interaction.user.id);
    if (!app) return;

    const country = COUNTRIES.find(c => c.name === countryName);
    const flag = country?.flag ?? '🌍';

    const embed = baseEmbed('WARNING')
      .setTitle(`📋 Новая заявка #${app.id} — ${flag} ${countryName}`)
      .addFields(
        { name: '👤 Заявитель', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🌍 Страна', value: `${flag} ${countryName}`, inline: true },
        { name: '🕐 Подана', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '📖 Знает правила?', value: fields.knows_rules, inline: true },
        { name: '🎯 Идеология', value: fields.ideology, inline: true },
        { name: '🏛️ Форма правления', value: fields.government, inline: true },
        { name: '⚙️ Понимает ВПИ?', value: fields.knows_vpi, inline: false },
        { name: '🎂 Возраст', value: fields.age, inline: true },
      )
      .setFooter({ text: `ID заявки: ${app.id}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`review_take_${app.id}`)
        .setLabel('📋 Взять на рассмотрение')
        .setStyle(ButtonStyle.Primary),
    );

    await logChannel.send({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
      components: [row],
    });
  } catch (err) {
    console.error('[panel] Ошибка отправки в лог:', err.message);
  }
}

/** Взять заявку на рассмотрение */
async function handleTakeReview(interaction, appId) {
  const app = getApplicationById(appId);
  if (!app) {
    return interaction.reply({
      ...withBanner(errorEmbed('Заявка не найдена', `Заявка #${appId} не существует.`)),
      ephemeral: true,
    });
  }
  if (app.status !== 'pending') {
    return interaction.reply({
      ...withBanner(warningEmbed('Уже обработана', `Заявка #${appId} уже была рассмотрена.`)),
      ephemeral: true,
    });
  }
  if (app.reviewer_id) {
    return interaction.reply({
      ...withBanner(warningEmbed(
        'Уже на рассмотрении',
        `Заявку #${appId} уже взял <@${app.reviewer_id}>.`,
      )),
      ephemeral: true,
    });
  }

  // Назначаем ревьюера
  setApplicationReviewer(appId, interaction.user.id, interaction.user.username);

  const country = COUNTRIES.find(c => c.name === app.country_name);
  const flag = country?.flag ?? '🌍';

  // Обновляем embed лог-канала: убираем "Взять на рассмотрение", добавляем "Одобрить/Отказать"
  const embed = baseEmbed('WARNING')
    .setTitle(`📋 Заявка #${app.id} — ${flag} ${app.country_name}`)
    .addFields(
      { name: '👤 Заявитель', value: `<@${app.user_id}>`, inline: true },
      { name: '🌍 Страна', value: `${flag} ${app.country_name}`, inline: true },
      { name: '🕐 Подана', value: `<t:${Math.floor(app.created_at / 1000)}:R>`, inline: true },
      { name: '📖 Знает правила?', value: app.knows_rules ?? '—', inline: true },
      { name: '🎯 Идеология', value: app.ideology ?? '—', inline: true },
      { name: '🏛️ Форма правления', value: app.government ?? '—', inline: true },
      { name: '⚙️ Понимает ВПИ?', value: app.knows_vpi ?? '—', inline: false },
      { name: '🎂 Возраст', value: app.age ?? '—', inline: true },
      { name: '🔍 На рассмотрении у', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setFooter({ text: `ID заявки: ${app.id}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`review_approve_${appId}`)
      .setLabel('✅ Одобрить')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`review_reject_${appId}`)
      .setLabel('❌ Отказать')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.update({
    embeds: [bannerEmbed(), embed],
    files: [logoAttachment()],
    components: [row],
  });
}

/** Одобрить заявку */
async function handleApprove(interaction, appId) {
  const app = getApplicationById(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({
      ...withBanner(warningEmbed('Недоступно', 'Заявка уже обработана или не существует.')),
      ephemeral: true,
    });
  }
  // Только ревьюер может одобрить
  if (app.reviewer_id && app.reviewer_id !== interaction.user.id) {
    return interaction.reply({
      ...withBanner(errorEmbed('Нет доступа', `Заявку рассматривает <@${app.reviewer_id}>.`)),
      ephemeral: true,
    });
  }

  setCountry(app.user_id, app.username, app.country_name);
  updateApplicationStatus(appId, 'approved', interaction.user.id, null);

  const country = COUNTRIES.find(c => c.name === app.country_name);
  const flag = country?.flag ?? '🌍';

  const embed = successEmbed(
    'Заявка одобрена',
    `Заявка #${appId} от <@${app.user_id}> на страну ${flag} **${app.country_name}** — **одобрена** <@${interaction.user.id}>.`,
  );

  await interaction.update({
    embeds: [bannerEmbed(), embed],
    files: [logoAttachment()],
    components: [],
  });

  // ЛС заявителю
  try {
    const u = await interaction.client.users.fetch(app.user_id);
    await u.send({
      embeds: [
        bannerEmbed(),
        successEmbed(
          '✅ Заявка одобрена!',
          `Ваша заявка на страну ${flag} **${app.country_name}** была **одобрена**!\nДобро пожаловать в World Wide!`,
        ),
      ],
      files: [logoAttachment()],
    });
  } catch {}

  // Лог
  try {
    const logChannel = await interaction.client.channels.fetch(config.logChannelId);
    if (logChannel) await logChannel.send({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
    });
  } catch {}
}

/** Открыть модалку для ввода причины отказа */
async function handleRejectModal(interaction, appId) {
  const app = getApplicationById(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({
      ...withBanner(warningEmbed('Недоступно', 'Заявка уже обработана.')),
      ephemeral: true,
    });
  }
  if (app.reviewer_id && app.reviewer_id !== interaction.user.id) {
    return interaction.reply({
      ...withBanner(errorEmbed('Нет доступа', `Заявку рассматривает <@${app.reviewer_id}>.`)),
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`review_reject_modal_${appId}`)
    .setTitle('Причина отказа');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reject_reason')
        .setLabel('Укажите причину отказа')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Подробно опишите причину...')
        .setRequired(true)
        .setMaxLength(500),
    ),
  );

  await interaction.showModal(modal);
}

/** Обработать отказ с причиной */
async function processRejection(interaction, appId, reason) {
  const app = getApplicationById(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({
      ...withBanner(warningEmbed('Недоступно', 'Заявка уже обработана.')),
      ephemeral: true,
    });
  }

  updateApplicationStatus(appId, 'rejected', interaction.user.id, reason);

  const country = COUNTRIES.find(c => c.name === app.country_name);
  const flag = country?.flag ?? '🌍';

  const embed = errorEmbed(
    'Заявка отклонена',
    `Заявка #${appId} от <@${app.user_id}> на страну ${flag} **${app.country_name}** — **отклонена** <@${interaction.user.id}>.\n\n**Причина:** ${reason}`,
  );

  // Обновляем сообщение в лог-канале (если можно)
  try {
    await interaction.update({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
      components: [],
    });
  } catch {
    await interaction.reply({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
      ephemeral: true,
    });
  }

  // ЛС заявителю
  try {
    const u = await interaction.client.users.fetch(app.user_id);
    await u.send({
      embeds: [
        bannerEmbed(),
        errorEmbed(
          '❌ Заявка отклонена',
          `Ваша заявка на страну ${flag} **${app.country_name}** была **отклонена**.\n\n**Причина:** ${reason}\n\nВы можете подать новую заявку через ${config.applicationCooldownHours} ч.`,
        ),
      ],
      files: [logoAttachment()],
    });
  } catch {}

  // Лог
  try {
    const logChannel = await interaction.client.channels.fetch(config.logChannelId);
    if (logChannel) await logChannel.send({
      embeds: [bannerEmbed(), embed],
      files: [logoAttachment()],
    });
  } catch {}
}
