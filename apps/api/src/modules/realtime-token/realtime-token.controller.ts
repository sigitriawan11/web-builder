import { AppError } from "@platform/shared";
import type { ValidatedHandler } from "../../middleware/validate";
import type { issueRealtimeTokenRequest } from "./realtime-token.schema";
import type { RealtimeTokenService } from "./realtime-token.service";

// Controller: request tervalidasi → service → envelope response. Tanpa logika bisnis.
export function createRealtimeTokenController(service: RealtimeTokenService) {
  const issue: ValidatedHandler<typeof issueRealtimeTokenRequest> = async (req, res) => {
    if (!req.ctx.user) throw new AppError("UNAUTHENTICATED");
    // Token akses: jangan disimpan cache perantara.
    res.setHeader("cache-control", "no-store");
    res.json({
      data: await service.issue(req.ctx.user.id, req.valid.body.docId),
      meta: { requestId: req.ctx.requestId },
    });
  };
  return { issue };
}
