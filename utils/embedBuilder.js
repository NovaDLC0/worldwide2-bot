const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { COUNTRIES } = require('../data/countries');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const LOGO_NAME = 'logo.png';

const COLORS = {
  DEFAULT: 0x2F3136,
  SUCCESS: 0x57F287,
  ERROR: 0xED4245,
  WARNING: 0xFEE75C,
};

function logoAttachment() {
  return new AttachmentBuilder(LOGO_PATH, { name: LOGO_NAME });
}

function bannerEmbed() {
  return new EmbedBuilder()
    .setColor(COLORS.DEFAULT)
    .setImage(`attachment://${LOGO_NAME}`);
}

function baseEmbed(color = 'DEFAULT') {
  return new EmbedBuilder()
    .setColor(COLORS[color] ?? COLORS.DEFAULT)
    .setTimestamp();
}

function successEmbed(title, description) {
  return baseEmbed('SUCCESS')
    .setTitle(`✅ ${title}`)
    .setDescription(description);
}

function errorEmbed(title, description) {
  return baseEmbed('ERROR')
    .setTitle(`❌ ${title}`)
    .setDescription(description);
}

function warningEmbed(title, description) {
  return baseEmbed('WARNING')
    .setTitle(`⚠️ ${title}`)
    .setDescription(description);
}

function countryListEmbed(holdersMap) {
  // Разбиваем на 4 колонки, чтобы уложиться в лимит 1024 символа
  const chunkSize = Math.ceil(COUNTRIES.length / 4);
  const chunks = [];
  for (let i = 0; i < COUNTRIES.length; i += chunkSize) {
    chunks.push(COUNTRIES.slice(i, i + chunkSize));
  }

  function renderColumn(list) {
    const lines = list.map(c => {
      const holders = holdersMap.get(c.name) ?? [];
      if (holders.length === 0) {
        return `${c.flag} ${c.name}`;
      }
      const mentions = holders.map(id => `<@${id}>`).join(' ');
      return `${c.flag} ${c.name} — ${mentions}`;
    });
    return lines.join('\n') || 'Нет стран';
  }

  const embed = baseEmbed('DEFAULT')
    .setTitle('🌍 Список стран — World Wide')
    .setFooter({ text: `World Wide • ${COUNTRIES.length} стран | 🟢 Свободно • 🟡 Занято` });

  for (const chunk of chunks) {
    const text = renderColumn(chunk);
    if (text && text.length <= 1024) {
      embed.addFields({ name: '\u200B', value: text, inline: true });
    } else {
      // Если всё ещё слишком длинно — режем на части
      const lines = text.split('\n');
      let current = '';
      for (const line of lines) {
        if ((current + '\n' + line).length > 1024) {
          embed.addFields({ name: '\u200B', value: current || '...', inline: true });
          current = line;
        } else {
          current = current ? current + '\n' + line : line;
        }
      }
      if (current) {
        embed.addFields({ name: '\u200B', value: current, inline: true });
      }
    }
  }

  return embed;
}

function withBanner(embed) {
  return {
    embeds: [bannerEmbed(), embed],
    files: [logoAttachment()],
  };
}

module.exports = {
  COLORS,
  logoAttachment,
  bannerEmbed,
  baseEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  countryListEmbed,
  withBanner,
};
