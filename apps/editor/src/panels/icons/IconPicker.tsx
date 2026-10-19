import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { toolStore } from "../../tools/tool-store";
import { IconBrowser } from "./IconBrowser";
import { insertIconNode } from "./insert-icon";

// ED-046: picker ikon Lucide (search) untuk Icon tool. Pilih → sisip node `icon` di frame/page terpilih, lalu kembali
// ke Move. Grid & insert dibagi dengan tab Assets → Icons (ED-163).
export function IconPicker({ runtime, onClose }: { runtime: CanvasRuntime; onClose: () => void }) {
  return (
    <div className="w-64 p-2" data-testid="icon-picker">
      <IconBrowser
        onPick={(name, set) => {
          insertIconNode(runtime, name, set);
          toolStore.getState().dispatch({ type: "selectTool", tool: "select" });
          onClose();
        }}
      />
    </div>
  );
}
