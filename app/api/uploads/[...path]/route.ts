import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { LocalImageStorageProvider } from '@/lib/storage';
export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const user = await requireCurrentUser();
  const storagePath = params.path.join('/');
  const image = await db.listingImage.findFirst({
    where: { storagePath, listing: { userId: user.id } },
  });
  if (!image) return new NextResponse('Not found', { status: 404 });
  const bytes = await new LocalImageStorageProvider().read(storagePath);
  return new NextResponse(bytes, {
    headers: {
      'content-type': image.imageType,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const user = await requireCurrentUser();
  const storagePath = params.path.join('/');
  const image = await db.listingImage.findFirst({
    where: { storagePath, listing: { userId: user.id } },
  });
  if (!image) return new NextResponse('Not found', { status: 404 });
  await new LocalImageStorageProvider().delete(storagePath);
  await db.listingImage.delete({ where: { id: image.id } });
  return NextResponse.json({ ok: true });
}
