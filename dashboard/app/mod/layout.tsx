import type React from 'react';
import type { Metadata } from 'next';
import { SessionExpiredModal } from '@/components/mod/session-expired-modal';
import './mod-theme.css';

export const metadata: Metadata = {
  title: 'Mod Dashboard | Catto',
  description: 'Moderation dashboard for evidence and case management',
};

export default function ModLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="mod" className="min-h-screen bg-[var(--mod-bg)] text-[var(--mod-text)]">
      {children}
      <SessionExpiredModal />
    </div>
  );
}
