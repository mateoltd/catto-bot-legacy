import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Layout from './Layout.vue';
import Home from './components/Home.vue';
import ChatPanel from './components/chat/ChatPanel.vue';
import CommandBuilder from './components/CommandBuilder.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('Home', Home);
    app.component('ChatPanel', ChatPanel);
    app.component('CommandBuilder', CommandBuilder);
  },
} satisfies Theme;
