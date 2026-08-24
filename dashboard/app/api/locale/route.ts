import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  isAppLocale,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
} from '@/i18n/config';

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isAppLocale(payload?.locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, payload.locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ locale: payload.locale });
}
