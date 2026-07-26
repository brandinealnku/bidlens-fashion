import { db } from '@/lib/db/client';
import { env } from '@/lib/env';

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@bidlens.local',
  displayName: 'Demo Reseller',
} as const;

export async function requireCurrentUser() {
  if (!env.DEMO_MODE || env.AUTH_PROVIDER !== 'demo')
    throw new Error('Production authentication is not configured.');
  await db.userProfile.upsert({
    where: { id: DEMO_USER.id },
    update: { email: DEMO_USER.email, displayName: DEMO_USER.displayName },
    create: DEMO_USER,
  });
  return { ...DEMO_USER };
}
