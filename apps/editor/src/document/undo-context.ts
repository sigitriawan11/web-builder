import { createContext } from "react";
import type { UndoController } from "./undo-controller";

// Undo dokumen untuk komponen yang punya shortcut sendiri (editor teks inline, ED-197).
export const UndoContext = createContext<UndoController | null>(null);
