import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  logger.warn(
    "ANTHROPIC_API_KEY is not set. You can create a .env file with the key.",
  );
}

export const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export const RATING_MODEL =
  process.env.RATING_MODEL || "claude-3-5-haiku-20241022";
