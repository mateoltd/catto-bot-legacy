<script setup lang="ts">
import { ref, computed } from 'vue';
import { Copy, Check } from 'lucide-vue-next';

// Generic interactive command builder for VitePress docs.
//
// Props:
//   fields  — array of { key, label, placeholder, tabs? }
//   commands — array of { label, template } where template uses {{key}} placeholders
//
// Unfilled placeholders render as <placeholder> in the output.

export interface Field {
  /** Key used in template placeholders */
  key: string;
  /** Display label above the input */
  label: string;
  /** Input placeholder (also the template fallback) */
  placeholder: string;
  /** If set, only show this field when one of these tabs is active */
  tabs?: string[];
}

export interface Command {
  /** Tab label */
  label: string;
  /** Command template with {{key}} placeholders */
  template: string;
}

const props = defineProps<{
  fields: Field[];
  commands: Command[];
}>();

const values = ref<Record<string, string>>({});
const activeIndex = ref(0);
const copied = ref(false);

const visibleFields = computed(() =>
  props.fields.filter((f) => {
    if (!f.tabs || f.tabs.length === 0) return true;
    const activeLabel = props.commands[activeIndex.value]?.label;
    return activeLabel ? f.tabs.includes(activeLabel) : true;
  })
);

const renderedCommand = computed(() => {
  const cmd = props.commands[activeIndex.value];
  if (!cmd) return '';
  return cmd.template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = values.value[key]?.trim();
    if (val) return val;
    const field = props.fields.find((f) => f.key === key);
    return field ? `<${field.placeholder}>` : `<${key}>`;
  });
});

function copy() {
  navigator.clipboard.writeText(renderedCommand.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <div class="cmd-builder">
    <div class="cmd-fields">
      <label v-for="field in visibleFields" :key="field.key" class="cmd-field">
        <span class="cmd-field-label">{{ field.label }}</span>
        <input
          v-model="values[field.key]"
          type="text"
          :placeholder="field.placeholder"
          spellcheck="false"
          autocomplete="off"
        />
      </label>
    </div>

    <div class="cmd-tabs">
      <button
        v-for="(cmd, i) in commands"
        :key="cmd.label"
        :class="['cmd-tab', { active: activeIndex === i }]"
        @click="activeIndex = i"
      >
        {{ cmd.label }}
      </button>
      <button class="cmd-copy" @click="copy">
        <Check v-if="copied" :size="14" />
        <Copy v-else :size="14" />
        <span>{{ copied ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>

    <pre class="cmd-output"><code>{{ renderedCommand }}</code></pre>
  </div>
</template>

<style scoped>
.cmd-builder {
  margin: 1.5rem 0;
  border: 1px solid #1a1a1a;
  background: #0a0a0a;
  overflow: hidden;
}

/* ── Fields ── */

.cmd-fields {
  display: flex;
  flex-wrap: wrap;
  border-bottom: 1px solid #1a1a1a;
}

.cmd-field {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 180px;
  border-right: 1px solid #1a1a1a;
}

.cmd-field:last-child {
  border-right: none;
}

.cmd-field-label {
  display: block;
  padding: 0.5rem 0.75rem 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: #555;
  text-transform: uppercase;
}

.cmd-field input {
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  padding: 0.4rem 0.75rem 0.6rem;
  width: 100%;
}

.cmd-field input::placeholder {
  color: #333;
}

/* ── Tabs ── */

.cmd-tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #1a1a1a;
  background: #0a0a0a;
}

.cmd-tab {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #555;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cmd-tab:hover {
  color: #888;
}

.cmd-tab.active {
  color: #fff;
  border-bottom-color: #fff;
}

.cmd-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
  margin-right: 0.5rem;
  padding: 0.35rem 0.7rem;
  background: #111;
  border: 1px solid #222;
  color: #888;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cmd-copy:hover {
  border-color: #444;
  color: #fff;
}

/* ── Output ── */

.cmd-output {
  margin: 0;
  padding: 1rem;
  background: #0a0a0a;
  overflow-x: auto;
}

.cmd-output code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  line-height: 1.7;
  color: #aaa;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
