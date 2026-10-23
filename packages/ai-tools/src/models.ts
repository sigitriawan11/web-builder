import { z } from "zod";

// AI-047: routing tugas → tier → model ID. Model ID TIDAK di-hardcode; dibaca dari `AI_MODEL_CONFIG` (JSON env).

export const ModelTierSchema = z.enum(["small", "medium", "large"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

// Map tier → model ID (dari AI_MODEL_CONFIG). Opsional `fallback` per tier (AI-211).
export const ModelConfigSchema = z.object({
  small: z.string().min(1),
  medium: z.string().min(1),
  large: z.string().min(1),
  fallback: z.record(ModelTierSchema, z.string().min(1)).optional(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Jenis tugas internal → tier default (dapat dioverride ctx). Selaras tier default budget (AI-042).
export type ModelTask = "plan" | "edit" | "classify" | "chat" | "inline" | "admin";
const TASK_TIER: Record<ModelTask, ModelTier> = {
  plan: "large",
  edit: "medium",
  classify: "small",
  chat: "medium",
  inline: "small",
  admin: "medium",
};

/** Parse `AI_MODEL_CONFIG` (JSON). Lempar bila bukan JSON / tak sesuai schema. */
export function parseModelConfig(raw: string): ModelConfig {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("AI_MODEL_CONFIG bukan JSON valid");
  }
  return ModelConfigSchema.parse(json);
}

export class ModelRouter {
  constructor(private readonly config: ModelConfig) {}

  /** Tier untuk sebuah tugas (AI-047). */
  pick(task: ModelTask): ModelTier {
    return TASK_TIER[task];
  }

  /** Model ID untuk tier. */
  modelFor(tier: ModelTier): string {
    return this.config[tier];
  }

  /** Model fallback (AI-211) bila ada; else undefined. */
  fallbackFor(tier: ModelTier): string | undefined {
    return this.config.fallback?.[tier];
  }

  /** Model ID untuk tugas (shortcut pick + modelFor). */
  modelForTask(task: ModelTask): string {
    return this.modelFor(this.pick(task));
  }
}
