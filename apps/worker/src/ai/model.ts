// Interface klien model + tipe pesan dipindah ke @platform/ai-tools (AI-211). Re-export agar import lokal tetap stabil.
export type {
  ContentBlock,
  ModelClient,
  ModelMessage,
  ModelRequest,
  ModelToolUse,
  ModelTurn,
  ModelUsage,
  StopReason,
} from "@platform/ai-tools";
