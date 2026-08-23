import { Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits } from 'discord.js';
import { resolveKey } from '@sapphire/plugin-i18next';
import { AVAILABLE_LANGUAGES, isValidLanguage, getLanguageName } from '#lib/i18n.js';

@ApplyOptions<Command.Options>({
  description: 'Change the bot language for this server',
  requiredUserPermissions: [PermissionFlagsBits.Administrator],
})
export class LanguageCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName('language')
            .setDescription('The language to set')
            .setRequired(false)
            .addChoices(
              ...AVAILABLE_LANGUAGES.map((lang) => ({
                name: `${lang.flag} ${lang.name}`,
                value: lang.code,
              }))
            )
        )
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const languageCode = interaction.options.getString('language');

    // If no language specified, show current language
    if (!languageCode) {
      const guild = await this.container.prisma.guild.findUnique({
        where: { guildId: interaction.guild.id },
      });

      const currentLang = guild?.language || 'en-US';
      const availableLangs = AVAILABLE_LANGUAGES.map(
        (l) => `${l.flag} \`${l.code}\` - ${l.name}`
      ).join('\n');

      await interaction.editReply({
        embeds: [
          {
            title: await resolveKey(interaction, 'commands/general:language.currentLanguage'),
            description: getLanguageName(currentLang),
            fields: [
              {
                name: await resolveKey(interaction, 'commands/general:language.availableLanguages'),
                value: availableLangs,
              },
            ],
            color: 0x5865f2,
          },
        ],
      });
      return;
    }

    // Validate language
    if (!isValidLanguage(languageCode)) {
      const languages = AVAILABLE_LANGUAGES.map((l) => l.code).join(', ');
      await interaction.editReply({
        content: await resolveKey(interaction, 'commands/general:language.invalid', { languages }),
      });
      return;
    }

    // Update language in database
    await this.container.prisma.guild.upsert({
      where: { guildId: interaction.guild.id },
      update: { language: languageCode },
      create: {
        guildId: interaction.guild.id,
        name: interaction.guild.name,
        language: languageCode,
      },
    });

    await interaction.editReply({
      content: await resolveKey(interaction, 'commands/general:language.changed', {
        language: getLanguageName(languageCode),
      }),
    });
  }
}
