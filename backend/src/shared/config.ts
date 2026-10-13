import { z } from "zod";
import { loadEnvFile } from "./load-env.js";
loadEnvFile(process.env.BACKEND_ENV_FILE ?? ".env");
const result = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().default("127.0.0.1"),
    LOG_LEVEL: z.string().default("info"),
    MONGODB_URI: z.string().default(""),
    MONGODB_DB_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default("easy_shop"),
    APP_ORIGIN: z.string().url().default("http://localhost:3000"),
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    GROQ_API_KEY: z.string().default(""),
    GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),
    GEMINI_API_KEY: z.string().default(""),
    AI_AUTO_REPLY_ENABLED: z.coerce.boolean().default(true),
    AI_AUTO_REPLY_SEND_ENABLED: z.coerce.boolean().default(false),
    AI_VISUAL_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),
    AI_REPLY_PROVIDER: z.enum(["openai", "groq", "rule"]).default("openai"),
    TEST_LAB_ENABLED: z.coerce.boolean().default(false),
    META_APP_ID: z.string().default(""),
    META_APP_SECRET: z.string().default(""),
    META_WEBHOOK_VERIFY_TOKEN: z.string().default(""),
    META_GRAPH_VERSION: z.string().default("v25.0"),
    META_OAUTH_SCOPES: z
      .string()
      .default(
        "pages_show_list,pages_manage_metadata,pages_messaging,pages_read_engagement,pages_read_user_content,pages_manage_posts,pages_manage_engagement,read_insights,business_management,instagram_basic,instagram_manage_messages,instagram_content_publish,instagram_manage_comments,instagram_manage_insights",
      ),
  })
  .safeParse(process.env);
if (!result.success)
  throw new Error(
    "Invalid backend environment configuration. Check variable names and formats.",
  );
const env = result.data;
export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  host: env.HOST,
  logLevel: env.LOG_LEVEL,
  mongoUri: env.MONGODB_URI,
  mongoDatabase: env.MONGODB_DB_NAME,
  appOrigin: env.APP_ORIGIN,
  openaiApiKey: env.OPENAI_API_KEY,
  openaiModel: env.OPENAI_MODEL,
  groqApiKey: env.GROQ_API_KEY,
  groqModel: env.GROQ_MODEL,
  geminiApiKey: env.GEMINI_API_KEY,
  aiAutoReplyEnabled: env.AI_AUTO_REPLY_ENABLED,
  aiAutoReplySendEnabled: env.AI_AUTO_REPLY_SEND_ENABLED,
  aiVisualConfidenceThreshold: env.AI_VISUAL_CONFIDENCE_THRESHOLD,
  aiReplyProvider: env.AI_REPLY_PROVIDER,
  testLabEnabled: env.TEST_LAB_ENABLED,
  metaAppId: env.META_APP_ID,
  metaAppSecret: env.META_APP_SECRET,
  metaWebhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
  metaGraphVersion: env.META_GRAPH_VERSION,
  metaOAuthScopes: env.META_OAUTH_SCOPES,
};
