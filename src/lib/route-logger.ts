/**
 * Custom route logger for better route categorization
 */

import signale from 'signale';

interface RouteInfo {
  method: string;
  path: string;
}

interface CategoryInfo {
  name: string;
  emoji: string;
  routes: RouteInfo[];
}

/**
 * Categorizes routes based on their path structure
 */
export function categorizeRoutes(routePaths: RouteInfo[]): CategoryInfo[] {
  const categories: Map<string, CategoryInfo> = new Map();

  for (const route of routePaths) {
    const { category, emoji } = getCategoryInfo(route.path);

    if (!categories.has(category)) {
      categories.set(category, {
        name: category,
        emoji,
        routes: [],
      });
    }

    const categoryInfo = categories.get(category);
    if (categoryInfo) {
      categoryInfo.routes.push(route);
    }
  }

  // Convert to array and sort by category name
  const result = Array.from(categories.values());

  // Custom sort order: ROOT first, then alphabetically
  result.sort((a, b) => {
    if (a.name === 'ROOT') return -1;
    if (b.name === 'ROOT') return 1;
    if (a.name === '@ME') return -1;
    if (b.name === '@ME') return 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Determines the category and emoji for a given route path
 */
function getCategoryInfo(path: string): { category: string; emoji: string } {
  const segments = path.split('/').filter(Boolean);

  // Root level routes (health, ping, stats) - no parent path
  if (segments.length === 1) {
    const route = segments[0] || 'root';

    switch (route) {
      case 'health':
        return { category: 'ROOT', emoji: '💚' };
      case 'ping':
        return { category: 'ROOT', emoji: '🏓' };
      case 'stats':
        return { category: 'ROOT', emoji: '📊' };
      default:
        return { category: 'ROOT', emoji: '🏠' };
    }
  }

  // Users routes
  const usersSegment = segments[0];
  if (usersSegment === 'users') {
    const userRoute = segments[1];
    if (userRoute === '@me') {
      return { category: '@ME', emoji: '👤' };
    }
    return { category: 'USERS', emoji: '👥' };
  }

  // OAuth routes
  const oauthSegment = segments[0];
  if (oauthSegment === 'oauth') {
    const oauthRoute = segments[1];
    switch (oauthRoute) {
      case 'login':
        return { category: 'LOGIN', emoji: '🔑' };
      case 'logout':
        return { category: 'LOGOUT', emoji: '🚪' };
      case 'callback':
        return { category: 'CALLBACK', emoji: '🔄' };
      default:
        return { category: 'OAUTH', emoji: '🔐' };
    }
  }

  // Guild-specific routes
  const guildSegment = segments[0];
  const guildIdSegment = segments[1];
  if (guildSegment === 'guilds' && guildIdSegment?.startsWith('[')) {
    // If it's just /guilds/[guildId]
    if (segments.length === 2) {
      return { category: '[GUILDID]', emoji: '🏰' };
    }

    // Categorize by the feature after [guildId]
    const feature = segments[2];

    switch (feature) {
      case 'channels-roles':
        return { category: 'CHANNELS & ROLES', emoji: '📋' };
      case 'logging':
        return { category: 'LOGGING', emoji: '📝' };
      case 'moderation':
        return { category: 'MODERATION', emoji: '🛡️' };
      case 'permissions':
        return { category: 'PERMISSIONS', emoji: '🔒' };
      case 'rewards':
        return { category: 'REWARDS', emoji: '🎁' };
      case 'temp-voice':
        return { category: 'TEMP VOICE', emoji: '🎤' };
      case 'voice-xp':
        return { category: 'VOICE XP', emoji: '🎵' };
      case 'xp':
        return { category: 'XP', emoji: '⭐' };
      default:
        return { category: '[GUILDID]', emoji: '🏰' };
    }
  }

  // Fallback
  return { category: 'OTHER', emoji: '📁' };
}

/**
 * Gets the method color emoji
 */
export function getMethodEmoji(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return '🟢';
    case 'POST':
      return '🟡';
    case 'PUT':
      return '🟠';
    case 'PATCH':
      return '🔵';
    case 'DELETE':
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Logs routes in a beautiful formatted way using signale
 */
export function logRoutes(baseUrl: string, routePaths: RouteInfo[]): void {
  // Create a custom signale instance for route logging
  const { Signale } = signale;
  const routeLogger = new Signale({
    scope: 'API Routes',
    types: {
      routes: {
        badge: '🌐',
        color: 'cyan',
        label: 'routes',
      },
      endpoint: {
        badge: '📍',
        color: 'blue',
        label: 'endpoint',
      },
      category: {
        badge: '📁',
        color: 'magenta',
        label: 'category',
      },
    },
  });

  const separator = '─'.repeat(80);
  const doubleSeparator = '═'.repeat(80);

  // Header
  console.log('\n' + doubleSeparator);
  routeLogger.success('🌐 API Server Started Successfully');
  console.log(doubleSeparator);
  routeLogger.info(`📍 Base URL: ${baseUrl}`);
  routeLogger.info(`📊 Total Routes: ${routePaths.length}`);
  console.log(separator);

  if (routePaths.length === 0) {
    routeLogger.warn('⚠️  No routes registered');
    console.log(doubleSeparator + '\n');
    return;
  }

  routeLogger.info('📋 Available Endpoints:');
  console.log(separator);

  // Categorize and log routes
  const categories = categorizeRoutes(routePaths);

  for (const category of categories) {
    console.log(`\n  ${category.emoji} ${category.name}`);

    for (const route of category.routes) {
      const methodEmoji = getMethodEmoji(route.method);
      const methodPadded = route.method.padEnd(6);
      const url = `${baseUrl}${route.path}`;

      console.log(`    ${methodEmoji} ${methodPadded} ${url}`);
    }
  }

  console.log('\n' + separator);
  routeLogger.success('✨ API Server is ready to accept requests');
  console.log(doubleSeparator + '\n');
}
