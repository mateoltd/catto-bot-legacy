import { Command, container } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { type Message, EmbedBuilder, ComponentType } from 'discord.js';
import { COLORS } from '#lib/constants.js';
import { paginationRow } from '#lib/discord/components/buttons.js';
import {
  InteractionResponder,
  MessageResponder,
  type CommandResponder,
} from '#lib/discord/index.js';
import {
  buildHelpPages,
  compareHelpCategories,
  collectSubcommandHelpActions,
  formatHelpCategoryHeading,
  formatHelpCommandBlocks,
  getConfiguredHelpActions,
  getHelpCategory,
  isHelpCategoryAlias,
  isCommandHiddenFromHelp,
  splitHelpCategory,
  type HelpSubcommandMetadata,
} from '#lib/interaction/index.js';

export class HelpCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'help',
      aliases: ['h', 'commands'],
      description: 'Display all available commands',
      detailedDescription: 'Shows a list of all available commands and their descriptions.',
      preconditions: ['GuildOnly'],
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    return this.run(new InteractionResponder(interaction));
  }

  public override async messageRun(message: Message): Promise<void> {
    if (!message.inGuild()) return;
    return this.run(new MessageResponder(message));
  }

  private async run(ctx: CommandResponder): Promise<void> {
    const { client, stores } = this.container;
    const commands = stores.get('commands');

    // Filter to only commands that support prefix (have messageRun)
    const prefixCommands: Command[] = [];
    for (const command of commands.values()) {
      if (this.supportsPrefix(command) && !isCommandHiddenFromHelp(command)) {
        prefixCommands.push(command);
      }
    }
    prefixCommands.sort((left, right) => left.name.localeCompare(right.name));

    // Group by category (normalize directory paths to friendly names)
    const categories = new Map<string, Command[]>();
    for (const command of prefixCommands) {
      const category = getHelpCategory(command);
      if (category === 'Moderation' && isHelpCategoryAlias(command)) continue;

      const categoryCommands = categories.get(category);
      if (categoryCommands) categoryCommands.push(command);
      else categories.set(category, [command]);
    }

    const configuredPrefix = client.options.defaultPrefix ?? '!';
    const prefix =
      typeof configuredPrefix === 'string' ? configuredPrefix : (configuredPrefix[0] ?? '!');

    // Split large categories into fields that stay within Discord's value limit.
    const categoryEntries = [...categories.entries()].sort(([left], [right]) =>
      compareHelpCategories(left, right)
    );
    const sections = categoryEntries.flatMap(([category, categoryCommands]) => {
      const blocks = categoryCommands.flatMap((command) =>
        formatHelpCommandBlocks(command, this.getActions(command))
      );
      return splitHelpCategory(category, blocks);
    });
    const pages = buildHelpPages(sections);

    if (pages.length === 0) {
      await ctx.replyError('No prefix commands available.');
      return;
    }

    const commandPathCount = sections.reduce((count, section) => count + section.blocks.length, 0);

    const buildEmbed = (page: number) => {
      const embed = new EmbedBuilder()
        .setColor(COLORS.DEFAULT)
        .setTitle('Command List')
        .setDescription(`Use \`${prefix}<command>\` to run a command`)
        .setThumbnail(client.user?.displayAvatarURL() ?? null);

      for (const [category, blocks] of pages[page - 1] ?? []) {
        embed.addFields({
          name: formatHelpCategoryHeading(category),
          value: blocks.join('\n') || 'No commands',
          inline: false,
        });
      }

      embed.setFooter({
        text: `Page ${page}/${pages.length} • ${commandPathCount} command paths available`,
        iconURL: ctx.user.displayAvatarURL(),
      });

      return embed;
    };

    await ctx.deferPublicClassic();

    // Single page - no pagination needed
    if (pages.length === 1) {
      await ctx.editReply({ embeds: [buildEmbed(1)] });
      return;
    }

    // Multi-page with pagination buttons
    let currentPage = 1;
    const baseId = `help:${ctx.user.id}:${Date.now()}`;
    const sent = await ctx.editReply({
      embeds: [buildEmbed(1)],
      components: [
        paginationRow(baseId, 1, pages.length, {
          showFirst: false,
          showLast: false,
        }),
      ],
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === ctx.user.id,
    });

    collector.on('collect', async (interaction) => {
      const action = interaction.customId.split(':').pop();
      if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (action === 'next') currentPage = Math.min(pages.length, currentPage + 1);

      await interaction.update({
        embeds: [buildEmbed(currentPage)],
        components: [
          paginationRow(baseId, currentPage, pages.length, {
            showFirst: false,
            showLast: false,
          }),
        ],
      });
    });

    collector.on('end', () => {
      sent
        .edit({
          components: [
            paginationRow(baseId, currentPage, pages.length, {
              showFirst: false,
              showLast: false,
              disabled: true,
            }),
          ],
        })
        .catch((err) => {
          container.logger.debug('help: failed to disable pagination buttons:', err);
        });
    });
  }

  /** Check if a command supports prefix (message) execution. */
  private supportsPrefix(command: Command): boolean {
    // Subcommand instances: check if any entries have messageRun
    if (command instanceof Subcommand) {
      const opts = command.options as Subcommand.Options;
      return (
        opts.subcommands?.some((mapping) => {
          if ('messageRun' in mapping && mapping.messageRun) return true;
          if ('entries' in mapping && mapping.entries) {
            return mapping.entries.some((entry) => 'messageRun' in entry && entry.messageRun);
          }
          return false;
        }) ?? false
      );
    }

    // Regular commands: check if class overrides messageRun from base Command
    let proto = Object.getPrototypeOf(command);
    while (proto && proto !== Command.prototype) {
      if (Object.prototype.hasOwnProperty.call(proto, 'messageRun')) return true;
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }

  private getActions(command: Command): readonly string[] {
    if (command instanceof Subcommand) {
      const subcommands = (command.options as Subcommand.Options).subcommands ?? [];
      return collectSubcommandHelpActions(subcommands as readonly HelpSubcommandMetadata[]);
    }

    return getConfiguredHelpActions(command.name);
  }
}
