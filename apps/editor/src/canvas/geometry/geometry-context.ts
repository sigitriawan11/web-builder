import { createContext } from "react";
import type { GeometryStore } from "./geometry-store";

// Store tempat NodeView mendaftarkan elemennya. `null` = node di frame ini tidak diukur
// (frame non-aktif, atau iframe: koordinatnya relatif ke dokumen iframe).
export const GeometryContext = createContext<GeometryStore | null>(null);
