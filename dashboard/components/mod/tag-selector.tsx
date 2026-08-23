'use client';

import { useState } from 'react';
import { PREDEFINED_TAGS } from '@/lib/mod-types';
import { IconPlus, IconX } from '@/lib/mod-icons';

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagSelector({ value, onChange }: TagSelectorProps) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter((t) => t !== tag));
    } else {
      onChange([...value, tag]);
    }
  };

  const addCustom = () => {
    const tag = customInput.trim().toLowerCase();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setCustomInput('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div>
      {/* Predefined tags */}
      <div className="flex flex-wrap gap-1.5">
        {PREDEFINED_TAGS.map((tag) => {
          const isActive = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`border px-2 py-0.5 text-xs transition-[background-color,border-color] duration-75 ${
                isActive
                  ? 'border-[var(--mono-400)] bg-[var(--mono-800)] text-[var(--mono-white)]'
                  : 'border-[var(--mod-border)] text-[var(--mod-text-muted)] hover:border-[var(--mod-border-hover)]'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Custom tags already added */}
      {value.filter((t) => !PREDEFINED_TAGS.includes(t as typeof PREDEFINED_TAGS[number])).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value
            .filter((t) => !PREDEFINED_TAGS.includes(t as typeof PREDEFINED_TAGS[number]))
            .map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 border border-[var(--mono-400)] bg-[var(--mono-800)] px-2 py-0.5 text-xs text-[var(--mono-white)]"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="text-[var(--mod-text-dim)] hover:text-[var(--mono-white)]">
                  <IconX size={10} />
                </button>
              </span>
            ))}
        </div>
      )}

      {/* Custom tag input */}
      <div className="mt-2 flex gap-1">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Custom tag..."
          className="w-32 border border-[var(--mod-border)] bg-[var(--mono-950)] px-2 py-1 text-xs text-[var(--mono-white)] placeholder-[var(--mod-text-dim)] outline-none focus:border-[var(--mono-500)]"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="border border-[var(--mod-border)] px-2 py-1 text-xs text-[var(--mod-text-muted)] transition-[background-color] duration-75 hover:bg-[var(--mod-surface-hover)] disabled:opacity-30"
        >
          <IconPlus size={12} />
        </button>
      </div>
    </div>
  );
}
