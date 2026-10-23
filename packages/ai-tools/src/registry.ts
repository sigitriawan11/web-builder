import { z } from "zod";
import type { Tool, ToolMode } from "./tool";

// AI-101: registry tool. `toolsFor({mode, entitlements})` menyaring tool per mode + entitlement; `toJsonSchemas`
// menghasilkan definisi tool untuk parameter `tools` Claude API (nama, deskripsi, input_schema JSON Schema).

export interface ToolJsonSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(...tools: Tool[]): this {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) throw new Error(`Tool duplikat: ${tool.name}`);
      this.tools.set(tool.name, tool);
    }
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  all(): Tool[] {
    return [...this.tools.values()];
  }

  /** Tool yang tersedia untuk run: cocok mode + fitur yang dibutuhkan ⊆ entitlements. */
  toolsFor(opts: { mode: ToolMode; entitlements?: ReadonlySet<string> }): Tool[] {
    const entitlements = opts.entitlements ?? new Set<string>();
    return this.all().filter((tool) => {
      if (!tool.modes.includes(opts.mode)) return false;
      if (tool.requires?.feature && !entitlements.has(tool.requires.feature)) return false;
      return true;
    });
  }

  /** Definisi tool (JSON Schema input) untuk Claude API `tools`. */
  static toJsonSchemas(tools: readonly Tool[]): ToolJsonSchema[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: z.toJSONSchema(tool.inputSchema, { unrepresentable: "any", io: "input" }) as Record<
        string,
        unknown
      >,
    }));
  }
}
