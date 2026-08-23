<script setup lang="ts">
import {
  Shield,
  Zap,
  Mic,
  Lock,
  Globe,
  Database,
  Terminal,
  ArrowRight,
  Book,
  Code,
  Layers,
  Settings,
  ChevronRight,
  ExternalLink
} from 'lucide-vue-next';
import ChatPanel from './chat/ChatPanel.vue';

const features = [
  { icon: Shield, title: 'Moderation', desc: 'Case tracking, warnings, mutes, tempbans', link: '/modules/moderation' },
  { icon: Zap, title: 'XP System', desc: 'Text and voice leveling with leaderboards', link: '/modules/xp-system' },
  { icon: Mic, title: 'Temp Voice', desc: 'Join-to-create with control panels', link: '/modules/temp-voice' },
  { icon: Lock, title: 'Gate System', desc: 'Authorization, rate limiting, and resource guards', link: '/core/gate-system' },
  { icon: Globe, title: 'REST API', desc: 'HTTP endpoints with OAuth2', link: '/api/rest-routes' },
  { icon: Database, title: 'Database', desc: 'PostgreSQL + Prisma + Redis', link: '/api/database' },
];

const quickLinks = [
  { icon: Book, title: 'Getting Started', desc: 'Setup and run locally', link: '/getting-started' },
  { icon: Globe, title: 'Dashboard Setup', desc: 'Run the mod dashboard', link: '/dashboard' },
  { icon: Code, title: 'Commands', desc: 'Create slash commands', link: '/commands/creating-commands' },
  { icon: Layers, title: 'Architecture', desc: 'System design overview', link: '/architecture' },
];
</script>

<template>
  <div class="home">
    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-badge">
          <Terminal :size="14" />
          <span>v1.0 Documentation</span>
        </div>
        <h1 class="hero-title">CATTO</h1>
        <p class="hero-tagline">
          TypeScript Discord bot built with Sapphire, Prisma, and Redis
        </p>
        <div class="hero-actions">
          <a href="/getting-started" class="btn btn-primary">
            Get Started
            <ArrowRight :size="16" />
          </a>
          <a href="https://github.com/cattxdev/catto.v2" target="_blank" class="btn btn-secondary">
            GitHub
            <ExternalLink :size="14" />
          </a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="code-window">
          <div class="code-header">
            <div class="code-dots">
              <span></span><span></span><span></span>
            </div>
            <span class="code-title">BotClient.ts</span>
          </div>
          <pre class="code-content"><code><span class="kw">import</span> { SapphireClient } <span class="kw">from</span> <span class="str">'@sapphire/framework'</span>;
<span class="kw">import</span> { PrismaClient } <span class="kw">from</span> <span class="str">'@prisma/client'</span>;

<span class="kw">export class</span> <span class="fn">BotClient</span> <span class="kw">extends</span> SapphireClient {
  <span class="kw">constructor</span>() {
    <span class="kw">super</span>({
      intents: [<span class="str">'Guilds'</span>, <span class="str">'GuildMessages'</span>],
      <span class="cm">// Prisma + Redis integration</span>
    });
  }
}</code></pre>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section class="features">
      <div class="section-header">
        <h2>Features</h2>
        <p>Built for scale with modern tooling</p>
      </div>
      <div class="features-grid">
        <a v-for="feature in features" :key="feature.title" :href="feature.link" class="feature-card">
          <div class="feature-icon">
            <component :is="feature.icon" :size="20" />
          </div>
          <div class="feature-content">
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.desc }}</p>
          </div>
          <ChevronRight :size="16" class="feature-arrow" />
        </a>
      </div>
    </section>

    <!-- Quick Links -->
    <section class="quick-links">
      <div class="section-header">
        <h2>Quick Links</h2>
        <p>Jump right in</p>
      </div>
      <div class="links-grid">
        <a v-for="link in quickLinks" :key="link.title" :href="link.link" class="link-card">
          <component :is="link.icon" :size="18" />
          <div>
            <h4>{{ link.title }}</h4>
            <span>{{ link.desc }}</span>
          </div>
        </a>
      </div>
    </section>

    <!-- Research Agent Chat -->
    <ChatPanel />

    <!-- Footer -->
    <footer class="home-footer">
      <div class="footer-content">
        <span>CATTO v1.0</span>
        <span class="sep">·</span>
        <span>TypeScript + Sapphire + Prisma + Redis</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  background: #000;
  color: #fff;
}

/* Hero */
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 6rem 2rem;
  align-items: center;
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 3rem;
    padding: 4rem 1.5rem;
  }
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.8rem;
  background: #111;
  border: 1px solid #222;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #888;
  margin-bottom: 1.5rem;
}

.hero-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 4rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  margin: 0 0 1rem;
  background: linear-gradient(180deg, #fff 0%, #666 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  padding: 0.1em 0;
  line-height: 1.2;
  overflow: visible;
}

.hero-tagline {
  font-size: 1.1rem;
  color: #666;
  margin: 0 0 2rem;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #fff;
  color: #000;
}

.btn-primary:hover {
  background: #e5e5e5;
  transform: translateY(-2px);
}

.btn-secondary {
  background: transparent;
  color: #fff;
  border: 1px solid #333;
}

.btn-secondary:hover {
  border-color: #fff;
  background: rgba(255,255,255,0.05);
}

/* Code Window */
.hero-visual {
  display: flex;
  justify-content: center;
}

.code-window {
  width: 100%;
  max-width: 500px;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  overflow: hidden;
}

.code-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #111;
  border-bottom: 1px solid #1a1a1a;
}

.code-dots {
  display: flex;
  gap: 6px;
}

.code-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #333;
}

.code-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #555;
}

.code-content {
  padding: 1.25rem;
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.7;
  color: #888;
  overflow-x: auto;
}

.code-content .kw { color: #666; }
.code-content .str { color: #888; }
.code-content .fn { color: #fff; }
.code-content .cm { color: #444; }

/* Sections */
.features, .quick-links {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.section-header {
  margin-bottom: 2rem;
}

.section-header h2 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #fff;
  margin: 0 0 0.5rem;
}

.section-header p {
  font-size: 0.85rem;
  color: #555;
  margin: 0;
}

/* Features Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1px;
  background: #1a1a1a;
  border: 1px solid #1a1a1a;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: #0a0a0a;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
  min-height: 80px;
}

.feature-card:hover {
  background: #111;
}

.feature-card:hover .feature-arrow {
  transform: translateX(4px);
  opacity: 1;
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #111;
  border: 1px solid #222;
  color: #fff;
  flex-shrink: 0;
}

.feature-content {
  flex: 1;
  min-width: 0;
}

.feature-content h3 {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: #fff;
}

.feature-content p {
  font-size: 0.8rem;
  color: #555;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feature-arrow {
  color: #444;
  opacity: 0;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

/* Quick Links */
.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.link-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
}

.link-card:hover {
  border-color: #333;
  background: #111;
}

.link-card svg {
  color: #555;
  flex-shrink: 0;
  margin-top: 2px;
}

.link-card h4 {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: #fff;
}

.link-card span {
  font-size: 0.75rem;
  color: #555;
}

/* Footer */
.home-footer {
  padding: 2rem;
  border-top: 1px solid #111;
  margin-top: 4rem;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sep {
  color: #222;
}
</style>
