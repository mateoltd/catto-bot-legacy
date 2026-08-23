import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

// Define environment schema
const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  CLIENT_SECRET: z.string().min(1, 'CLIENT_SECRET is required'),
  OWNER_IDS: z
    .string()
    .optional()
    .transform((val) => val?.split(',').filter(Boolean) ?? []),
  DEFAULT_PREFIX: z.string().optional().default('!'),
  NODE_ENV: z.enum(['development', 'production']).optional().default('development'),
  API_PORT: z
    .string()
    .optional()
    .default('4000')
    .transform((val) => parseInt(val, 10)),
  API_PREFIX: z.string().optional().default('api'),
  API_ORIGIN: z.string().optional().default('*'),
  API_REDIRECT: z.string().optional().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: z
    .string()
    .optional()
    .default('6379')
    .transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z
    .string()
    .optional()
    .default('0')
    .transform((val) => parseInt(val, 10)),

  // Backblaze B2 Storage
  B2_ENDPOINT: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    }),
  B2_REGION: z.string().optional().default('us-west-004'),
  B2_KEY_ID: z.string().optional(),
  B2_APP_KEY: z.string().optional(),
  B2_BUCKET_NAME: z.string().optional(),
  B2_BUCKET_ID: z.string().optional(),

  // Evidence HMAC signing
  EVIDENCE_HMAC_SECRET: z.string().min(32).optional(),

  // Dashboard URL for evidence links
  DASHBOARD_URL: z.string().optional().default('http://localhost:3000'),

  // Evidence limits
  MAX_EVIDENCE_UPLOAD_BYTES: z
    .string()
    .optional()
    .default(String(2 * 1024 * 1024 * 1024)) // 2GB default
    .transform((val) => parseInt(val, 10)),
  MAX_SNAPSHOT_MESSAGES: z
    .string()
    .optional()
    .default('100')
    .transform((val) => parseInt(val, 10)),

  // Deploy metadata
  DEPLOY_VERSION: z.string().optional().default('dev'),
});

// Validate and parse environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n❌ Configuration Error: Invalid environment variables\n');
      error.issues.forEach((err) => {
        const path = err.path.join('.');
        console.error(`   ${path}: ${err.message}`);
      });
      console.error(
        '\n💡 Please check your .env file and ensure all required variables are set.\n'
      );
      process.exit(1);
    }
    throw error;
  }
};

export const CONFIG = parseEnv();
