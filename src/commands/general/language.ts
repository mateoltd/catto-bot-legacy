import { Args, Command } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { PermissionFlagsBits, type Message } from 'discord.js';
import { resolveKey } from '@sapphire/plugin-i18next';
import { AVAILABLE_LANGUAGES, isValidLanguage, getLanguageName } from '#lib/i18n.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';

@ApplyOptions<Command.Options>({
  description: 'Change the bot language for this server',
  requiredUserPermissions: [PermissionFlagsBits.Administrator],
  preconditions: ['GuildOnly'],
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
    const languageCode = interaction.options.getString('language');
    return this.run(languageCode, new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message, args: Args) {
    const languageCode = await args.pick('string').catch(() => null);
    return this.run(languageCode, new MessageResponder(message as Message<true>));
  }

  private async run(languageCode: string | null, ctx: CommandResponder): Promise<void> {
    await ctx.deferPublicClassic();

    // If no language specified, show current language
    if (!languageCode) {
      const guild = await this.container.prisma.guild.findUnique({
        where: { guildId: ctx.guild.id },
      });

      const currentLang = guild?.language || 'en-US';
      const availableLangs = AVAILABLE_LANGUAGES.map(
        (l) => `${l.flag} \`${l.code}\` - ${l.name}`
      ).join('\n');

      await ctx.editReply({
        embeds: [
          {
            title: await resolveKey(ctx.guild, 'commands/general:language.currentLanguage'),
            description: getLanguageName(currentLang),
            fields: [
              {
                name: await resolveKey(ctx.guild, 'commands/general:language.availableLanguages'),
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
      await ctx.editReply({
        content: await resolveKey(ctx.guild, 'commands/general:language.invalid', { languages }),
      });
      return;
    }

    // Update language in database
    await this.container.prisma.guild.upsert({
      where: { guildId: ctx.guild.id },
      update: { language: languageCode },
      create: {
        guildId: ctx.guild.id,
        name: ctx.guild.name,
        language: languageCode,
      },
    });

    await ctx.editReply({
      content: await resolveKey(ctx.guild, 'commands/general:language.changed', {
        language: getLanguageName(languageCode),
      }),
    });
  }
}
