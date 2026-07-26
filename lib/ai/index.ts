import {
  fashionAnalysisSchema,
  type FashionProductAnalysis,
} from '@/lib/validation/fashion';
export type ProductAnalysisInput = {
  title: string;
  description: string;
  images: string[];
};
export type ProductAnalysisResult = {
  analysis: FashionProductAnalysis;
  raw: string;
};
export interface ProductAnalysisProvider {
  analyzeListing(i: ProductAnalysisInput): Promise<ProductAnalysisResult>;
}
const demo = {
  category: 'HANDBAG',
  brand: 'Maison Aurelia',
  suspectedModel: 'Marais satchel',
  productLine: 'Marais',
  styleNumber: null,
  serialOrDateCode: null,
  color: ['cognac'],
  material: ['pebbled leather'],
  size: 'medium',
  dimensions: null,
  estimatedEra: 'Contemporary',
  genderMarket: 'Women',
  conditionGrade: 'GOOD',
  visibleDamage: ['Light corner wear'],
  includedItems: ['Removable strap'],
  visibleMarkings: ['Wordmark'],
  evidence: ['Structured silhouette', 'Brass-tone turn lock'],
  conflictingEvidence: ['Interior label not visible'],
  identificationConfidence: 0.91,
  authenticityRiskLevel: 'MODERATE',
  authenticityConfidence: null,
  authenticationRecommended: true,
  searchQueries: ['Maison Aurelia Marais leather satchel'],
  candidates: [
    {
      brand: 'Maison Aurelia',
      model: 'Marais satchel',
      productLine: 'Marais',
      category: 'HANDBAG',
      color: ['cognac'],
      material: ['leather'],
      size: 'medium',
      estimatedEra: 'Contemporary',
      confidence: 0.91,
      evidence: ['Silhouette and hardware'],
      conflictingEvidence: ['Style code unavailable'],
      searchQueries: ['Maison Aurelia Marais satchel'],
    },
    {
      brand: 'Maison Aurelia',
      model: 'Rive structured bag',
      productLine: 'Rive',
      category: 'HANDBAG',
      color: ['cognac'],
      material: ['leather'],
      size: 'medium',
      estimatedEra: 'Contemporary',
      confidence: 0.64,
      evidence: ['Structured top-handle construction'],
      conflictingEvidence: ['Closure differs from catalog references'],
      searchQueries: ['Maison Aurelia Rive cognac handbag'],
    },
    {
      brand: null,
      model: 'Structured turn-lock satchel',
      productLine: null,
      category: 'HANDBAG',
      color: ['cognac'],
      material: ['pebbled leather'],
      size: 'medium',
      estimatedEra: 'Contemporary',
      confidence: 0.42,
      evidence: ['Visible silhouette and material'],
      conflictingEvidence: ['Brand label is insufficiently visible'],
      searchQueries: ['cognac pebbled leather turn lock satchel'],
    },
  ],
} as const;
export class MockProductAnalysisProvider implements ProductAnalysisProvider {
  async analyzeListing(_input: ProductAnalysisInput) {
    void _input;
    const analysis = fashionAnalysisSchema.parse(demo);
    return { analysis, raw: JSON.stringify(demo) };
  }
}
abstract class JsonAi implements ProductAnalysisProvider {
  abstract call(i: ProductAnalysisInput, prompt: string): Promise<string>;
  async analyzeListing(i: ProductAnalysisInput) {
    const prompt =
      'Return only JSON matching the supplied fashion schema. Separate visible observations from inference; never authenticate; state uncertainty and provide at most three candidates.';
    let raw = await this.call(i, prompt);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { analysis: fashionAnalysisSchema.parse(JSON.parse(raw)), raw };
      } catch {
        if (attempt === 1)
          throw new Error('AI returned an invalid structured analysis');
        raw = await this.call(
          i,
          `${prompt} Repair this invalid JSON without adding unseen details: ${raw.slice(0, 12000)}`,
        );
      }
    }
    throw new Error('unreachable');
  }
}
export class GeminiProductAnalysisProvider extends JsonAi {
  async call(i: ProductAnalysisInput, p: string) {
    if (!process.env.GEMINI_API_KEY)
      throw new Error('Gemini credentials are missing');
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${p}\nTitle:${i.title}\nDescription:${i.description}`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!r.ok) throw new Error('Gemini analysis failed');
    const x = (await r.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return x.candidates[0].content.parts[0].text;
  }
}
export class OpenAIProductAnalysisProvider extends JsonAi {
  async call(i: ProductAnalysisInput, p: string) {
    if (!process.env.OPENAI_API_KEY)
      throw new Error('OpenAI credentials are missing');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: p },
          { role: 'user', content: `${i.title}\n${i.description}` },
        ],
      }),
    });
    if (!r.ok) throw new Error('OpenAI analysis failed');
    const x = (await r.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return x.choices[0].message.content;
  }
}
