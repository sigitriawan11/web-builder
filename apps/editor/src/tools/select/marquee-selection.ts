import { type CameraState, screenPoint, screenToWorld } from "../../canvas/geometry/coordinates";
import type { GeometryStore } from "../../canvas/geometry/geometry-store";
import type { Point } from "../../canvas/interactions/interaction-machine";
import type { NodeStore } from "../../document/node-store";
import { marqueeHits, rectFromPoints } from "./marquee";

export interface MarqueeContext {
  nodeStore: NodeStore;
  geometry: GeometryStore;
  // Page aktif: lingkup marquee top-level (getter — page bisa berganti).
  readonly pageId: string;
  camera(): CameraState;
  viewportOffset(): { left: number; top: number };
}

/**
 * Node yang terkena marquee (ED-053): anak langsung dari frame tempat marquee dimulai (`scopeId`, atau
 * page aktif), yang terlihat & tidak terkunci, dengan rect dari cache geometry (tanpa memaksa layout).
 */
export function marqueeSelection(
  drag: { origin: Point; current: Point; scopeId: string | null },
  context: MarqueeContext,
): string[] {
  const scope = context.nodeStore.getNode(drag.scopeId ?? context.pageId);
  if (!scope || !("children" in scope)) return [];

  const camera = context.camera();
  const offset = context.viewportOffset();
  const toWorld = (point: Point) => screenToWorld(screenPoint(point.x, point.y), camera, offset);
  const marquee = rectFromPoints(toWorld(drag.origin), toWorld(drag.current));

  const candidates = scope.children
    .map((id) => ({ id, node: context.nodeStore.getNode(id) }))
    .filter(({ node }) => node?.visible && !node.locked)
    .map(({ id }) => ({ id, rect: context.geometry.peekRect(id) }));
  return marqueeHits(marquee, candidates);
}
