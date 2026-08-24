import { IconShieldLock } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/dashboard/brand-mark';
import { LoginButton } from '@/components/login-button';

export default async function ModLoginPage() {
  const t = await getTranslations('Auth');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <BrandMark compact href="/" />
          <IconShieldLock size={18} className="text-muted-foreground" />
        </div>
        <div className="p-7 sm:p-9">
          <h1 className="text-xl font-semibold text-foreground">{t('moderationTitle')}</h1>
          <p className="mb-7 mt-2 text-sm leading-6 text-muted-foreground">
            {t('moderationDescription')}
          </p>
          <LoginButton redirectPath="/guilds" label={t('authenticateWithDiscord')} />
        </div>
      </div>
    </main>
  );
}
