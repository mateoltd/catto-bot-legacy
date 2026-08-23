import { Command, container } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { type Message, EmbedBuilder, ComponentType } from 'discord.js';
import { COLORS } from '#lib/constants.js';
import { paginationRow } from '#lib/discord/components/buttons.js';

const COMMANDS_PER_PAGE = 10;

/** Map raw directory-based categories to display names. */
function formatCategory(raw: string): string {
  if (raw.startsWith('moderation')) return 'Moderation';
  if (raw === 'admin') return 'Admin';
  if (raw === 'general') return 'General';
  // Capitalize first letter for anything else
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export class HelpCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'help',
      aliases: ['h', 'commands'],
      description: 'Display all available commands',
      detailedDescription: 'Shows a list of all available commands and their descriptions.',
    });
  }

  public override async messageRun(message: Message): Promise<void> {
    const { client, stores } = this.container;
    const commands = stores.get('commands');

    // Filter to only commands that support prefix (have messageRun)
    const prefixCommands: Command[] = [];
    for (const command of commands.values()) {
      if (this.supportsPrefix(command) && !this.isHiddenFromHelp(command)) {
        prefixCommands.push(command);
      }
    }

    // Group by category (normalize directory paths to friendly names)
    const categories = new Map<string, Command[]>();
    for (const command of prefixCommands) {
      const rawCategory = command.fullCategory.join('/') || 'general';
      const category = formatCategory(rawCategory);
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push(command);
    }

    // Build pages from category entries
    const categoryEntries = [...categories.entries()];
    const pages = this.buildPages(categoryEntries);

    if (pages.length === 0) {
      if (message.channel.isSendable()) {
        await message.channel.send({ content: 'No prefix commands available.' });
      }
      return;
    }

    const prefix = client.options.defaultPrefix ?? '!';

    const buildEmbed = (page: number) => {
      const embed = new EmbedBuilder()
        .setColor(COLORS.DEFAULT)
        .setTitle('Command List')
        .setDescription(`Use \`${prefix}<command>\` to run a command`)
        .setThumbnail(client.user?.displayAvatarURL() ?? null);

      for (const [category, cmds] of pages[page - 1]!) {
        const commandList = cmds.map((cmd) => `\`${cmd.name}\` — ${cmd.description}`).join('\n');
        embed.addFields({ name: category, value: commandList || 'No commands', inline: false });
      }

      embed.setFooter({
        text: `Page ${page}/${pages.length} • ${prefixCommands.length} commands available`,
        iconURL: message.author.displayAvatarURL(),
      });

      return embed;
    };

    if (!message.channel.isSendable()) return;

    // Single page — no pagination needed
    if (pages.length === 1) {
      await message.channel.send({ embeds: [buildEmbed(1)] });
      return;
    }

    // Multi-page with pagination buttons
    let currentPage = 1;
    const baseId = `help:${message.id}`;
    const sent = await message.channel.send({
      embeds: [buildEmbed(1)],
      components: [paginationRow(baseId, 1, pages.length, { showFirst: false, showLast: false })],
    });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on('collect', async (interaction) => {
      const action = interaction.customId.split(':').pop();
      if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (action === 'next') currentPage = Math.min(pages.length, currentPage + 1);

      await interaction.update({
        embeds: [buildEmbed(currentPage)],
        components: [
          paginationRow(baseId, currentPage, pages.length, { showFirst: false, showLast: false }),
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

  /** Hide internal/special commands from global help list. */
  private isHiddenFromHelp(command: Command): boolean {
    const rawCategory = command.fullCategory.join('/');
    if (rawCategory.startsWith('moderation/creative-bans')) return true;

    // Safety net in case category metadata changes.
    return ['captcha', 'quicksand', 'ctrl-z', 'missile-strike', 'eject'].includes(command.name);
  }

  /** Split category entries into pages of ~COMMANDS_PER_PAGE commands each. */
  private buildPages(entries: [string, Command[]][]): [string, Command[]][][] {
    const pages: [string, Command[]][][] = [];
    let currentPage: [string, Command[]][] = [];
    let currentCount = 0;

    for (const entry of entries) {
      if (currentCount + entry[1].length > COMMANDS_PER_PAGE && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        currentCount = 0;
      }
      currentPage.push(entry);
      currentCount += entry[1].length;
    }

    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }
}
