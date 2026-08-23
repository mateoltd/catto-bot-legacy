<script setup lang="ts">
import { useData, useRoute } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { nextTick, provide, computed } from 'vue';
import ChatPanel from './components/chat/ChatPanel.vue';

const { isDark, frontmatter } = useData();
const route = useRoute();
const { Layout } = DefaultTheme;

// Get current page info for the research agent
const currentPagePath = computed(() => route.path);
const currentPageTitle = computed(() => frontmatter.value.title || route.path.split('/').pop() || 'Home');

const enableTransitions = () =>
  'startViewTransition' in document &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

provide('toggle-appearance', async ({ clientX: x, clientY: y }: MouseEvent) => {
  if (!enableTransitions()) {
    isDark.value = !isDark.value;
    return;
  }
  await (document as any).startViewTransition(async () => {
    isDark.value = !isDark.value;
    await nextTick();
  }).ready;
});
</script>

<template>
  <Layout />
  <ChatPanel :current-page="currentPagePath" :page-title="currentPageTitle" />
</template>

<style>
/* Override navbar structure via CSS since we can't easily replace the component */
/* Hide the wrapper/container structure and let elements be positioned independently */
.VPNavBar > .wrapper,
.VPNavBar > .wrapper > .container {
  display: contents !important;
}

.VPNavBar .content,
.VPNavBar .content-body {
  display: contents !important;
}

/* Now position each element independently */
.VPNavBar {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
}

.VPNavBar .title {
  position: absolute !important;
  left: 16px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}

.VPNavBar .search {
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
}

.VPNavBar .menu {
  position: absolute !important;
  right: 80px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}

.VPNavBar .social-links {
  position: absolute !important;
  right: 16px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
}
</style>
