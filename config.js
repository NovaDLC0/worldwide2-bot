require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  logChannelId: process.env.LOG_CHANNEL_ID,
  adminRoleId: process.env.ADMIN_ROLE_ID,
  applicationCooldownHours: parseInt(process.env.APPLICATION_COOLDOWN_HOURS) || 24,
  activityType: process.env.ACTIVITY_TYPE || 'WATCHING',
  activityText: process.env.ACTIVITY_TEXT || 'за World Wide'
};
