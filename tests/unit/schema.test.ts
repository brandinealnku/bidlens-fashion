import { describe, it, expect } from 'vitest';
import { fashionAnalysisSchema } from '../../lib/validation/fashion';
describe('fashion schema', () => {
  it('rejects confidence outside 0..1', () =>
    expect(() =>
      fashionAnalysisSchema.parse({ identificationConfidence: 2 }),
    ).toThrow());
});
