const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { resetAllPoints } = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('تصفير-النقاط')
    .setDescription('🗑️ تصفير نقاط جميع أعضاء هذا السيرفر')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const count = resetAllPoints(interaction.guildId);
    return interaction.reply({
      content: `✅ تم تصفير نقاط **${count}** عضو في هذا السيرفر إلى **0**.`,
      ephemeral: false,
    });
  },
};
