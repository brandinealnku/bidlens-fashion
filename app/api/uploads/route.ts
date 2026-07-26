import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { LocalImageStorageProvider } from '@/lib/storage';
import { audit } from '@/lib/services/audit';
export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const form = await request.formData();
    const listingId = String(form.get('listingId') ?? '');
    const listing = await db.auctionListing.findFirst({
      where: { id: listingId, userId: user.id },
    });
    if (!listing) throw new Error('Listing not found');
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Image is required');
    const saved = await new LocalImageStorageProvider().save({
      bytes: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
      userId: user.id,
    });
    const count = await db.listingImage.count({
      where: { auctionListingId: listingId },
    });
    const image = await db.listingImage.create({
      data: {
        auctionListingId: listingId,
        storagePath: saved.storagePath,
        imageType: file.type,
        displayOrder: count,
        isPrimary: count === 0,
      },
    });
    await audit(user.id, 'IMAGE_UPLOADED', 'ListingImage', image.id, {
      size: saved.size,
      mimeType: file.type,
    });
    return NextResponse.json(image);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
