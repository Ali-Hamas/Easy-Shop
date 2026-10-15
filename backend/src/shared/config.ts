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
    AI_REPLY_PROVIDER: z.enum(["openai", "rule"]).default("openai"),
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
  aiReplyProvider: env.AI_REPLY_PROVIDER,
};
