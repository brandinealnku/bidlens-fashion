export function scannerMarketRank(input: {
  opportunityScore: number;
  confidenceBasisPoints: number;
  headroomCents: number;
  maximumBidCents: number;
  comparableCount: number;
}) {
  let score = input.opportunityScore;
  score += Math.round((input.confidenceBasisPoints - 5000) / 1000);
  score += input.comparableCount >= 3 ? 5 : -8;
  if (input.headroomCents < 0) score -= 30;
  else
    score += Math.min(
      10,
      Math.round(
        (input.headroomCents * 10) / Math.max(input.maximumBidCents, 1),
      ),
    );
  return Math.max(0, Math.min(100, score));
}
