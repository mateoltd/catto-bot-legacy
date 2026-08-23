// Research agent tools - READ ONLY, NO MODIFICATIONS ALLOWED
import type { ToolDefinition, ToolCall, Source } from './types';

// Backend API configuration
// The docs server only runs locally during development (pnpm docs:server)
// In production, tools gracefully fall back to static templates
function getDocsApiUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // Only attempt backend connection on localhost (development)
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }

  // Production: no backend available, will use fallbacks
  return null;
}

let backendAvailable: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// =============================================================================
// AUGMENTATION ENGINE - Helps the model know where things are before searching
// =============================================================================

export const CODEBASE_MAP = {
  // Documentation structure
  docs: {
    '/getting-started': 'Setup guide: install, env vars, running locally',
    '/dashboard': 'Dashboard setup: OAuth login, env vars, troubleshooting',
    '/architecture': 'System design: layers, patterns, data flow',
    '/RULES': 'Coding conventions and style guide',
    '/api/database': 'Prisma ORM usage, models, queries',
    '/api/redis': 'Redis caching with ioredis',
    '/api/validation': 'Zod schemas and validation',
    '/api/i18n': 'Internationalization system',
    '/api/rest-routes': 'HTTP API endpoints with OAuth2',
    '/core/bot-client': 'BotClient class extending SapphireClient',
    '/core/gate-system': 'Gate authorization, rate limiting, and resource guards',
    '/core/discord-components': 'FluentContainer, embeds, buttons',
    '/core/logging': 'Logging utilities',
    '/commands/creating-commands': 'How to create slash commands',
    '/commands/preconditions': 'Command guards and checks',
    '/listeners/creating-listeners': 'Event listener patterns',
    '/modules/moderation': 'Ban, kick, warn, mute, cases',
    '/modules/xp-system': 'XP, levels, leaderboards',
    '/modules/reputation': 'Rep/vouch system',
    '/modules/rewards': 'Reward claims and giveaways',
    '/modules/temp-voice': 'Join-to-create voice channels',
  },

  // Source code structure
  code: {
    'src/index.ts': 'Entry point, bot initialization',
    'src/BotClient.ts': 'Main client class with Prisma/Redis',
    'src/commands/': 'Slash commands by category (admin/, fun/, mod/, utility/)',
    'src/listeners/': 'Discord event handlers (guild/, member/, message/, voice/)',
    'src/modules/': 'Business logic (moderation/, xp/, reputation/, rewards/, temp-voice/)',
    'src/lib/': 'Utilities and helpers',
    'src/lib/database/': 'Prisma client and database utilities',
    'src/lib/cache/': 'Redis cache manager',
    'src/lib/gate/': 'Permission gate system (Gate.ts, GateManager.ts)',
    'src/lib/fluent/': 'FluentContainer for Discord messages',
    'src/lib/validation/': 'Zod schemas',
    'src/lib/i18n/': 'Internationalization',
    'src/lib/rest/': 'REST API routes',
    'src/types/': 'TypeScript type definitions',
    'prisma/schema.prisma': 'Database schema',
    'package.json': 'Dependencies, scripts, and project configuration',
    'tsconfig.json': 'TypeScript configuration',
    'scripts/': 'Development utility scripts (imports, dev-db)',
  },

  // Key patterns to know about
  patterns: {
    commands: 'Extend Command class, use registerApplicationCommands(), chatInputRun()',
    listeners: 'Extend Listener class, specify event in constructor',
    gate: 'Gate.can(user, permission) for RBAC checks',
    fluent: 'new FluentContainer().setTitle().setDescription().build()',
    prisma: 'client.prisma.model.findMany/create/update/delete',
    redis: 'client.cache.get/set/del with TTL support',
    modules: 'Service classes with static methods for business logic',
  },
};

// Generate augmentation context for the system prompt
export function getAugmentationContext(): string {
  const lines: string[] = [
    '## Codebase Map (use this to find things efficiently)',
    '',
    '### Documentation Pages',
  ];

  for (const [path, desc] of Object.entries(CODEBASE_MAP.docs)) {
    lines.push(`- \`${path}\` - ${desc}`);
  }

  lines.push('', '### Source Code Locations');
  for (const [path, desc] of Object.entries(CODEBASE_MAP.code)) {
    lines.push(`- \`${path}\` - ${desc}`);
  }

  lines.push('', '### Key Patterns');
  for (const [name, desc] of Object.entries(CODEBASE_MAP.patterns)) {
    lines.push(`- **${name}**: ${desc}`);
  }

  return lines.join('\n');
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_docs',
    description: 'Search documentation pages by keywords. Use for conceptual questions, how-tos, and guides.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords (e.g., "moderation cases", "xp leveling")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_doc',
    description: 'Read a specific documentation page. Use paths from the codebase map.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Documentation path (e.g., "/api/database", "/modules/moderation")',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a source code directory. Use to explore the codebase structure.',
    parameters: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path relative to project root (e.g., "src/commands", "src/lib/gate")',
        },
      },
      required: ['directory'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a source code file from the codebase. Use for implementation details not in docs.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root (e.g., "src/BotClient.ts", "src/lib/gate/Gate.ts")',
        },
        startLine: {
          type: 'string',
          description: 'Optional: start reading from this line number',
        },
        endLine: {
          type: 'string',
          description: 'Optional: stop reading at this line number',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code patterns across the codebase using text search.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Code pattern to search for (e.g., "extends Command", "Gate.can")',
        },
        filePattern: {
          type: 'string',
          description: 'Optional: filter by file extension (e.g., "*.ts", "*.json")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'cite_source',
    description: 'Cite a documentation page or code file as source. Always cite when referencing specific content.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title or name of the source',
        },
        path: {
          type: 'string',
          description: 'Path to the documentation or file',
        },
        snippet: {
          type: 'string',
          description: 'Relevant quote or code snippet (optional)',
        },
        line: {
          type: 'string',
          description: 'Line number if citing code (optional)',
        },
      },
      required: ['title', 'path'],
    },
  },
];

// Convert to OpenRouter format
export function getOpenRouterTools() {
  return TOOL_DEFINITIONS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// =============================================================================
// BACKEND API INTEGRATION
// =============================================================================

async function checkBackendHealth(): Promise<boolean> {
  const apiUrl = getDocsApiUrl();

  // No backend in production
  if (!apiUrl) {
    return false;
  }

  const now = Date.now();

  // Use cached result if recent
  if (backendAvailable !== null && now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return backendAvailable;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${apiUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    backendAvailable = response.ok;
    lastHealthCheck = now;
    return backendAvailable;
  } catch {
    backendAvailable = false;
    lastHealthCheck = now;
    return false;
  }
}

async function apiReadFile(
  path: string,
  startLine?: number,
  endLine?: number
): Promise<{ content: string; lines: number } | null> {
  const apiUrl = getDocsApiUrl();
  if (!apiUrl) return null;

  try {
    const response = await fetch(`${apiUrl}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, startLine, endLine }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to read file');
    }

    return await response.json();
  } catch (error) {
    console.warn('API read failed:', error);
    return null;
  }
}

async function apiListFiles(
  directory: string
): Promise<{ entries: Array<{ name: string; type: string; size?: number }> } | null> {
  const apiUrl = getDocsApiUrl();
  if (!apiUrl) return null;

  try {
    const response = await fetch(`${apiUrl}/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: directory }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list directory');
    }

    return await response.json();
  } catch (error) {
    console.warn('API list failed:', error);
    return null;
  }
}

async function apiSearchCode(
  query: string,
  filePattern?: string
): Promise<{ results: Array<{ path: string; line: number; content: string; context: string }> } | null> {
  const apiUrl = getDocsApiUrl();
  if (!apiUrl) return null;

  try {
    const response = await fetch(`${apiUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filePattern, maxResults: 30 }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search');
    }

    return await response.json();
  } catch (error) {
    console.warn('API search failed:', error);
    return null;
  }
}

// =============================================================================
// FALLBACK IMPLEMENTATIONS (used when backend is unavailable)
// =============================================================================

const FALLBACK_CODE_TEMPLATES: Record<string, string> = {
  'src/BotClient.ts': `import { SapphireClient } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { GatewayIntentBits } from 'discord.js';

export class BotClient extends SapphireClient {
  public prisma: PrismaClient;
  public cache: Redis;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.prisma = new PrismaClient();
    this.cache = new Redis(process.env.REDIS_URL);
  }

  async start() {
    await this.prisma.$connect();
    await this.login(process.env.DISCORD_TOKEN);
  }
}`,
  'src/lib/gate/Gate.ts': `import type { User, GuildMember } from 'discord.js';
import type { Permission } from './permissions';

export class Gate {
  private static permissions = new Map<string, Set<Permission>>();

  static can(user: User | GuildMember, permission: Permission): boolean {
    const userId = 'id' in user ? user.id : user.user.id;
    const userPerms = this.permissions.get(userId);
    return userPerms?.has(permission) ?? false;
  }

  static grant(userId: string, permission: Permission): void {
    if (!this.permissions.has(userId)) {
      this.permissions.set(userId, new Set());
    }
    this.permissions.get(userId)!.add(permission);
  }

  static revoke(userId: string, permission: Permission): void {
    this.permissions.get(userId)?.delete(permission);
  }

  static hasAny(user: User | GuildMember, permissions: Permission[]): boolean {
    return permissions.some(p => this.can(user, p));
  }

  static hasAll(user: User | GuildMember, permissions: Permission[]): boolean {
    return permissions.every(p => this.can(user, p));
  }
}`,
  'src/lib/fluent/FluentContainer.ts': `import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';

export class FluentContainer {
  private embed: EmbedBuilder;
  private components: ActionRowBuilder<ButtonBuilder>[] = [];

  constructor() {
    this.embed = new EmbedBuilder();
  }

  setTitle(title: string): this {
    this.embed.setTitle(title);
    return this;
  }

  setDescription(description: string): this {
    this.embed.setDescription(description);
    return this;
  }

  setColor(color: number): this {
    this.embed.setColor(color);
    return this;
  }

  addField(name: string, value: string, inline = false): this {
    this.embed.addFields({ name, value, inline });
    return this;
  }

  addButton(button: ButtonBuilder): this {
    if (this.components.length === 0 || this.components[this.components.length - 1].components.length >= 5) {
      this.components.push(new ActionRowBuilder<ButtonBuilder>());
    }
    this.components[this.components.length - 1].addComponents(button);
    return this;
  }

  build() {
    return {
      embeds: [this.embed],
      components: this.components,
    };
  }
}`,
};

const FALLBACK_KNOWN_DIRS: Record<string, string[]> = {
  '.': ['package.json', 'tsconfig.json', 'eslint.config.js', 'src/', 'docs/', 'prisma/', 'scripts/'],
  'src': ['index.ts', 'BotClient.ts', 'commands/', 'listeners/', 'modules/', 'lib/', 'types/'],
  'src/commands': ['admin/', 'fun/', 'moderation/', 'utility/', 'xp/'],
  'src/listeners': ['guild/', 'member/', 'message/', 'voice/', 'ready.ts'],
  'src/modules': ['moderation/', 'xp/', 'reputation/', 'rewards/', 'temp-voice/'],
  'src/lib': ['database/', 'cache/', 'gate/', 'fluent/', 'validation/', 'i18n/', 'rest/', 'utils/'],
  'src/lib/gate': ['Gate.ts', 'GateManager.ts', 'permissions.ts', 'types.ts'],
  'src/lib/fluent': ['FluentContainer.ts', 'FluentEmbed.ts', 'FluentButton.ts'],
  'src/lib/database': ['client.ts', 'queries/', 'utils.ts'],
  'src/lib/cache': ['CacheManager.ts', 'RedisClient.ts'],
  'src/types': ['index.ts', 'branded.ts', 'discord.ts', 'database.ts'],
  'prisma': ['schema.prisma', 'migrations/'],
  'scripts': ['check-imports.ts', 'fix-imports.ts', 'dev-db.ts'],
};

function fallbackListFiles(dir: string): { result: string } {
  const files = FALLBACK_KNOWN_DIRS[dir];
  if (!files) {
    return { result: `Directory not mapped: ${dir}. Known directories: ${Object.keys(FALLBACK_KNOWN_DIRS).join(', ')}` };
  }
  return {
    result: `Contents of ${dir}/:\n\n${files.map(f => `- ${f}`).join('\n')}\n\n_(Fallback mode - start docs server for live data)_`,
  };
}

function fallbackReadFile(
  filePath: string,
  startLine?: number,
  endLine?: number
): { result: string; sources?: Source[] } {
  const content = FALLBACK_CODE_TEMPLATES[filePath];
  if (content) {
    let lines = content.split('\n');
    if (startLine !== undefined && endLine !== undefined) {
      lines = lines.slice(startLine - 1, endLine);
    } else if (startLine !== undefined) {
      lines = lines.slice(startLine - 1);
    }

    const numbered = lines.map((line, i) => `${(startLine || 1) + i}: ${line}`).join('\n');
    return {
      result: `\`\`\`typescript\n// ${filePath}\n${numbered}\n\`\`\`\n\n_(Fallback mode - start docs server for live data)_`,
      sources: [{ title: filePath.split('/').pop() || filePath, path: filePath }],
    };
  }

  return {
    result: `File ${filePath} content not available in fallback mode. Start the docs server with \`pnpm docs:server\` for live file access.`,
  };
}

function fallbackSearchCode(query: string): { result: string } {
  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  if (lowerQuery.includes('command') || lowerQuery.includes('chatinput')) {
    matches.push('src/commands/ - All slash commands are here');
    matches.push('Commands extend @sapphire/framework Command class');
  }
  if (lowerQuery.includes('listener') || lowerQuery.includes('event')) {
    matches.push('src/listeners/ - All event listeners are here');
    matches.push('Listeners extend @sapphire/framework Listener class');
  }
  if (lowerQuery.includes('gate') || lowerQuery.includes('permission')) {
    matches.push('src/lib/gate/Gate.ts - Permission checking');
    matches.push('src/lib/gate/GateManager.ts - Permission management');
  }
  if (lowerQuery.includes('fluent') || lowerQuery.includes('embed') || lowerQuery.includes('container')) {
    matches.push('src/lib/fluent/FluentContainer.ts - Message builder');
  }
  if (lowerQuery.includes('prisma') || lowerQuery.includes('database') || lowerQuery.includes('db')) {
    matches.push('src/lib/database/ - Database utilities');
    matches.push('prisma/schema.prisma - Database schema');
  }
  if (lowerQuery.includes('cache') || lowerQuery.includes('redis')) {
    matches.push('src/lib/cache/ - Redis caching');
  }
  if (lowerQuery.includes('moderat')) {
    matches.push('src/modules/moderation/ - Moderation logic');
    matches.push('src/commands/moderation/ - Mod commands');
  }
  if (lowerQuery.includes('xp') || lowerQuery.includes('level')) {
    matches.push('src/modules/xp/ - XP system logic');
    matches.push('src/commands/xp/ - XP commands');
  }

  if (matches.length === 0) {
    return { result: `No matches for "${query}" in fallback mode. Try: command, listener, gate, fluent, prisma, cache, moderation, xp\n\n_(Start docs server for real code search)_` };
  }

  return {
    result: `Search results for "${query}":\n\n${matches.map(m => `- ${m}`).join('\n')}\n\n_(Fallback mode - start docs server for live search)_`,
  };
}

// =============================================================================
// TOOL EXECUTION - ALL READ ONLY
// =============================================================================

export async function executeTool(
  toolCall: ToolCall,
  baseUrl: string
): Promise<{ result: string; sources?: Source[] }> {
  const args = toolCall.arguments;

  // Check backend availability for tools that benefit from it
  const useBackend = await checkBackendHealth();

  switch (toolCall.name) {
    case 'search_docs': {
      const query = (args.query as string).toLowerCase();
      const matches: Array<{ path: string; desc: string; score: number }> = [];

      for (const [path, desc] of Object.entries(CODEBASE_MAP.docs)) {
        const text = `${path} ${desc}`.toLowerCase();
        const words = query.split(/\s+/);
        const score = words.filter(w => text.includes(w)).length;
        if (score > 0) {
          matches.push({ path, desc, score });
        }
      }

      matches.sort((a, b) => b.score - a.score);
      const topMatches = matches.slice(0, 5);

      if (topMatches.length === 0) {
        return { result: 'No documentation pages found. Try different keywords or search the code with search_code.' };
      }

      const results = topMatches.map(m => `- **${m.path}** - ${m.desc}`).join('\n');
      return {
        result: `Found ${topMatches.length} relevant docs:\n\n${results}`,
        sources: topMatches.map(m => ({ title: m.path.split('/').pop() || m.path, path: m.path })),
      };
    }

    case 'read_doc': {
      const path = args.path as string;
      const desc = CODEBASE_MAP.docs[path as keyof typeof CODEBASE_MAP.docs];

      if (!desc) {
        return { result: `Documentation not found at: ${path}. Use search_docs to find valid paths.` };
      }

      try {
        // Try to fetch the markdown content
        const response = await fetch(`${baseUrl}${path}.md`);
        if (response.ok) {
          const content = await response.text();
          const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n\n...(truncated)' : content;
          return {
            result: truncated,
            sources: [{ title: path.split('/').pop() || path, path }],
          };
        }
      } catch {
        // Fetch failed, return description
      }

      return {
        result: `# ${path}\n\n${desc}\n\n(Full content unavailable - use the documentation site directly)`,
        sources: [{ title: path.split('/').pop() || path, path }],
      };
    }

    case 'list_files': {
      const dir = (args.directory as string).replace(/^\/+/, '').replace(/\/+$/, '');

      // Try backend API first
      if (useBackend) {
        const apiResult = await apiListFiles(dir);
        if (apiResult) {
          const entries = apiResult.entries
            .map(e => `- ${e.name}${e.size ? ` (${(e.size / 1024).toFixed(1)}KB)` : ''}`)
            .join('\n');
          return {
            result: `Contents of ${dir}/:\n\n${entries}`,
          };
        }
      }

      // Fall back to static list
      return fallbackListFiles(dir);
    }

    case 'read_file': {
      const filePath = (args.path as string).replace(/^\/+/, '');
      const startLine = args.startLine ? parseInt(args.startLine as string, 10) : undefined;
      const endLine = args.endLine ? parseInt(args.endLine as string, 10) : undefined;

      // Security check - prevent path traversal attacks
      if (filePath.includes('..')) {
        return { result: 'Invalid path: path traversal not allowed.' };
      }

      // Try backend API first
      if (useBackend) {
        const apiResult = await apiReadFile(filePath, startLine, endLine);
        if (apiResult) {
          const lines = apiResult.content.split('\n');
          const numbered = lines
            .map((line, i) => `${(startLine || 1) + i}: ${line}`)
            .join('\n');

          // Detect file type for syntax highlighting
          const ext = filePath.split('.').pop()?.toLowerCase();
          const lang = ext === 'ts' || ext === 'tsx' ? 'typescript' :
                       ext === 'js' || ext === 'jsx' ? 'javascript' :
                       ext === 'json' ? 'json' :
                       ext === 'prisma' ? 'prisma' :
                       ext === 'md' ? 'markdown' :
                       ext === 'vue' ? 'vue' :
                       ext === 'css' ? 'css' : 'text';

          return {
            result: `\`\`\`${lang}\n// ${filePath}\n${numbered}\n\`\`\``,
            sources: [{ title: filePath.split('/').pop() || filePath, path: filePath }],
          };
        }
      }

      // Fall back to templates
      return fallbackReadFile(filePath, startLine, endLine);
    }

    case 'search_code': {
      const query = args.query as string;
      const filePattern = args.filePattern as string | undefined;

      // Try backend API first
      if (useBackend) {
        const apiResult = await apiSearchCode(query, filePattern);
        if (apiResult && apiResult.results.length > 0) {
          const formatted = apiResult.results.slice(0, 15).map(r =>
            `**${r.path}:${r.line}**\n\`\`\`\n${r.content}\n\`\`\``
          ).join('\n\n');

          return {
            result: `Found ${apiResult.results.length} matches for "${query}":\n\n${formatted}`,
            sources: apiResult.results.slice(0, 5).map(r => ({
              title: r.path.split('/').pop() || r.path,
              path: r.path,
              line: r.line,
            })),
          };
        }
      }

      // Fall back to keyword matching
      return fallbackSearchCode(query);
    }

    case 'cite_source': {
      const source: Source = {
        title: args.title as string,
        path: args.path as string,
        snippet: args.snippet as string | undefined,
        line: args.line ? parseInt(args.line as string, 10) : undefined,
      };
      return {
        result: `Cited: ${source.title}`,
        sources: [source],
      };
    }

    default:
      return { result: `Unknown tool: ${toolCall.name}` };
  }
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

export const AGENT_SYSTEM_PROMPT = `You are a research assistant for the Catto Discord bot codebase. Your job is to help developers understand the code, find implementations, and explain how features work.

## CRITICAL RULES
1. You are READ-ONLY. You CANNOT modify, delete, or create files. Ever.
2. ALWAYS prefer documentation over code. Only read code when docs don't have the answer.
3. ALWAYS cite your sources using cite_source when referencing specific content.
4. Be concise and technical. Developers want answers, not fluff.
5. If you don't know, say so. Don't make up code.

## RESEARCH STRATEGY
1. First, check if the question can be answered from the codebase map below
2. If not, search documentation with search_docs
3. If docs don't have the answer, search code with search_code
4. Use read_file to examine specific implementations
5. Always cite sources for any specific claims

${getAugmentationContext()}

## Catto Overview
- TypeScript Discord bot using Sapphire Framework
- Prisma ORM with PostgreSQL for persistence
- Redis for caching
- BullMQ for job queues
- Custom Gate system for RBAC permissions
- FluentContainer pattern for Discord messages`;
