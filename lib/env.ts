import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const environmentSchema = z
  .object({
    DATABASE_URL: z.string().min(1).default('file:./dev.db'),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    AUTH_PROVIDER: z.enum(['demo', 'supabase']).default('demo'),
    DEMO_MODE: booleanString.default('true'),
    AI_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
    COMPARABLE_PROVIDER: z.enum(['demo', 'ebay']).default('demo'),
    STORAGE_PROVIDER: z.enum(['local', 'supabase']).default('local'),
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    EBAY_CLIENT_ID: z.string().optional(),
    EBAY_CLIENT_SECRET: z.string().optional(),
    EBAY_MARKETPLACE_ID: z.string().default('EBAY_US'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((environment, context) => {
    if (environment.DEMO_MODE) return;
    const required: Array<[boolean, string, string]> = [
      [
        environment.AUTH_PROVIDER === 'demo',
        'AUTH_PROVIDER',
        'Production mode requires configured authentication.',
      ],
      [
        environment.AI_PROVIDER === 'gemini' && !environment.GEMINI_API_KEY,
        'GEMINI_API_KEY',
        'Gemini was selected without credentials.',
      ],
      [
        environment.AI_PROVIDER === 'openai' && !environment.OPENAI_API_KEY,
        'OPENAI_API_KEY',
        'OpenAI was selected without credentials.',
      ],
      [
        environment.COMPARABLE_PROVIDER === 'ebay' &&
          (!environment.EBAY_CLIENT_ID || !environment.EBAY_CLIENT_SECRET),
        'EBAY_CLIENT_ID',
        'eBay was selected without both client credentials.',
      ],
    ];
    for (const [invalid, path, message] of required) {
      if (invalid)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message,
        });
    }
  });

export const env = environmentSchema.parse(process.env);
