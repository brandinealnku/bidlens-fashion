import { NextRequest, NextResponse } from 'next/server';
import * as workflow from '@/lib/services/workflow';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    return NextResponse.json(
      id ? await workflow.getListing(id) : await workflow.listUserListings(),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const {
      operation,
      id,
      payload = {},
    } = (await request.json()) as {
      operation: string;
      id?: string;
      payload?: Record<string, unknown>;
    };
    const required = () => {
      if (!id) throw new Error('Listing id is required');
      return id;
    };
    const handlers: Record<string, () => Promise<unknown>> = {
      createListing: () => workflow.createListing(payload),
      updateListing: () => workflow.updateListing(required(), payload),
      deleteDraftListing: () => workflow.deleteDraftListing(required()),
      updateImage: () =>
        workflow.updateImage(required(), String(payload.imageId), {
          isPrimary:
            typeof payload.isPrimary === 'boolean'
              ? payload.isPrimary
              : undefined,
          displayOrder:
            typeof payload.displayOrder === 'number'
              ? payload.displayOrder
              : undefined,
        }),
      runAnalysis: () => workflow.runAnalysis(required()),
      createCustomCandidate: () =>
        workflow.createCustomCandidate(required(), payload),
      selectCandidate: () =>
        workflow.selectCandidate(
          required(),
          typeof payload.candidateId === 'string' ? payload.candidateId : null,
        ),
      loadDemoComparables: () => workflow.loadDemoComparables(required()),
      addComparable: () => workflow.addComparable(required(), payload),
      updateManualComparable: () =>
        workflow.updateManualComparable(
          required(),
          String(payload.comparableId),
          payload,
        ),
      deleteManualComparable: () =>
        workflow.deleteManualComparable(
          required(),
          String(payload.comparableId),
        ),
      setComparableIncluded: () =>
        workflow.setComparableIncluded(
          required(),
          String(payload.comparableId),
          Boolean(payload.included),
          typeof payload.reason === 'string' ? payload.reason : undefined,
        ),
      recalculateValuation: () => workflow.recalculateValuation(required()),
      updateAssumptions: () => workflow.updateAssumptions(required(), payload),
      recalculateBidRecommendation: () =>
        workflow.recalculateBidRecommendation(required()),
      saveToWatchlist: () => workflow.saveToWatchlist(required(), payload),
      removeFromWatchlist: () => workflow.removeFromWatchlist(required()),
      updateCurrentBid: () =>
        workflow.updateCurrentBid(required(), Number(payload.currentBid)),
      evaluateAlerts: () => workflow.evaluateAlerts(required()),
      markAlertRead: () => workflow.markAlertRead(String(payload.alertId)),
      recordAuctionOutcome: () =>
        workflow.recordAuctionOutcome(required(), payload),
      recordResaleOutcome: () =>
        workflow.recordResaleOutcome(required(), payload),
      getSettings: () => workflow.getSettings(),
      resetSettings: () => workflow.resetSettings(),
      updateSettings: () => workflow.updateSettings(payload),
    };
    const handler = handlers[operation];
    if (!handler)
      return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
    return NextResponse.json(await handler());
  } catch (error) {
    return failure(error);
  }
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed';
  const validation =
    typeof error === 'object' && error !== null && 'flatten' in error;
  return NextResponse.json(
    { error: message },
    { status: validation ? 422 : 400 },
  );
}
