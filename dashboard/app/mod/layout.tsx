import type React from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');

  return {
    title: t('moderationTitle'),
    description: t('moderationDescription'),
  };
}

export default function ModLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--mod-bg)] text-[var(--mod-text)]">{children}</div>
  );
}
