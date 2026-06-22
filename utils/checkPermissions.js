const config = require('../config.js');

/**
 * Проверяет, является ли пользователь администратором
 * @param {import('discord.js').GuildMember} member
 */
function isAdmin(member) {
  if (!member) return false;
  // Проверяем роль администратора из конфига или права администратора Discord
  return (
    member.roles.cache.has(config.adminRoleId) ||
    member.permissions.has('Administrator')
  );
}

/**
 * Проверяет, является ли пользователь модератором (или администратором)
 * @param {import('discord.js').GuildMember} member
 */
function isModerator(member) {
  if (!member) return false;
  return (
    isAdmin(member) ||
    member.permissions.has('ManageMessages') ||
    member.permissions.has('KickMembers')
  );
}

module.exports = { isAdmin, isModerator };
