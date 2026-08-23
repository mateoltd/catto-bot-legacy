import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Catto',
  description: 'Documentation for Catto Discord Bot',
  cleanUrls: true,

  // Force dark mode only
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#000000' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'Catto Documentation' }],
    ['meta', { name: 'og:description', content: 'Documentation for Catto Discord Bot' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'CATTO',

    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api/index' },
      { text: 'Core', link: '/core/index' },
      { text: 'Modules', link: '/modules/index' },
    ],

    sidebar: {
      '/': [
        {
          text: 'INTRODUCTION',
          items: [
            { text: 'Home', link: '/' },
            { text: 'Getting Started', link: '/getting-started' },
            { text: 'Dashboard Setup', link: '/dashboard' },
            { text: 'Architecture', link: '/architecture' },
            { text: 'Deployment (Dokploy)', link: '/deployment-dokploy' },
            { text: 'Deployment (Legacy)', link: '/deployment' },
            { text: 'Coding Rules', link: '/RULES' },
          ],
        },
        {
          text: 'INTERNAL APIS',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/api/index' },
            { text: 'Database', link: '/api/database' },
            { text: 'Redis / Cache', link: '/api/redis' },
            { text: 'Validation', link: '/api/validation' },
            { text: 'i18n', link: '/api/i18n' },
            { text: 'REST Routes', link: '/api/rest-routes' },
          ],
        },
        {
          text: 'CORE SYSTEMS',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/core/index' },
            { text: 'BotClient', link: '/core/bot-client' },
            { text: 'Gate System', link: '/core/gate-system' },
            { text: 'Discord Components', link: '/core/discord-components' },
            { text: 'Logging', link: '/core/logging' },
          ],
        },
        {
          text: 'COMMANDS',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/commands/index' },
            { text: 'Creating Commands', link: '/commands/creating-commands' },
            { text: 'Preconditions', link: '/commands/preconditions' },
          ],
        },
        {
          text: 'LISTENERS',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/listeners/index' },
            { text: 'Creating Listeners', link: '/listeners/creating-listeners' },
          ],
        },
        {
          text: 'MODULES',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/modules/index' },
            { text: 'Moderation', link: '/modules/moderation' },
            { text: 'Evidence', link: '/modules/evidence' },
            { text: 'XP System', link: '/modules/xp-system' },
            { text: 'Reputation', link: '/modules/reputation' },
            { text: 'Rewards', link: '/modules/rewards' },
            { text: 'Temp Voice', link: '/modules/temp-voice' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cattxdev/catto.v2' },
    ],

    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },

    editLink: {
      pattern: 'https://github.com/cattxdev/catto.v2/edit/main/docs/:path',
      text: 'Edit on GitHub',
    },

    footer: {
      message: 'CATTO v2.x',
    },

    outline: {
      level: [2, 3],
      label: 'ON THIS PAGE',
    },

    lastUpdated: {
      text: 'Updated',
      formatOptions: {
        dateStyle: 'short',
      },
    },

    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },

    returnToTopLabel: 'Back to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Theme',
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'vitesse-dark',
    },
    lineNumbers: true,
  },

  lastUpdated: true,
});
