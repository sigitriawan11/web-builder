import { useEffect, useReducer } from "react";
import type { GeometryStore, WorldRect } from "../geometry/geometry-store";

// Rect world beberapa node dari cache geometry; render ulang saat salah satunya berubah.
export function useWorldRects(geometry: GeometryStore, ids: readonly string[]): (WorldRect | null)[] {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const unsubscribes = ids.map((id) => geometry.subscribe(id, rerender));
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [geometry, ids]);
  return ids.map((id) => geometry.peekRect(id));
}
