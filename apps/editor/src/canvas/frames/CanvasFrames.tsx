import { type AssetEntry, AssetEntrySchema, YDOC_KEYS } from "@platform/document-model";
import { useMemo } from "react";
import * as Y from "yjs";
import { useDocTheme } from "../../document/use-doc-theme";
import { type CanvasRuntime, useCanvasRuntime } from "../canvas-runtime";
import { siteFontStack } from "../fonts/site-fonts";
import { GeometryContext } from "../geometry/geometry-context";
import { FrameContext } from "../render-root/breakpoint-context";
import { NodeView, ThemeContext } from "../render-root/NodeView";
import { RenderScope } from "../render-root/RenderRoot";
import { createEditorRenderEnv, RenderEnvContext } from "../render-root/render-env";
import type { FrameMode, FrameSpec } from "./frame-layout";
import { IframeFrame } from "./IframeFrame";

interface CanvasFramesProps {
  pageId: string;
  frames: readonly FrameSpec[];
  // ED-019/ED-034: geometry (seleksi, hit overlay) diukur untuk frame breakpoint aktif.
  activeBreakpoint: FrameSpec["breakpoint"];
  mode: FrameMode;
  scopeClassName?: string | undefined;
  siteFont: string | null;
}

interface FrameContentProps {
  frame: FrameSpec;
  pageId: string;
  scopeClassName?: string | undefined;
  siteFont: string | null;
}

// Registry asset dari Y.Doc (ukuran intrinsik <img>); divalidasi seperti node (update remote).
function assetLookup(runtime: CanvasRuntime): (id: string) => AssetEntry | undefined {
  const assets = runtime.doc.getMap<unknown>(YDOC_KEYS.assets);
  return (id) => {
    const value = assets.get(id);
    const parsed = AssetEntrySchema.safeParse(value instanceof Y.Map ? value.toJSON() : value);
    return parsed.success ? parsed.data : undefined;
  };
}

function FrameContent({
  frame,
  pageId,
  scopeClassName,
  siteFont,
  measured,
}: FrameContentProps & { measured: boolean }) {
  const runtime = useCanvasRuntime();
  const theme = useDocTheme(runtime.doc);
  const env = useMemo(
    () =>
      createEditorRenderEnv({
        pageId,
        breakpoint: frame.breakpoint,
        node: (id) => runtime.nodeStore.getNode(id) ?? undefined,
        asset: assetLookup(runtime),
      }),
    [runtime, pageId, frame.breakpoint],
  );
  const frameValue = useMemo(() => ({ breakpoint: frame.breakpoint, width: frame.width }), [frame]);
  return (
    <GeometryContext.Provider value={measured ? runtime.geometry.store : null}>
      <FrameContext.Provider value={frameValue}>
        <ThemeContext.Provider value={theme}>
          <RenderEnvContext.Provider value={env}>
            <RenderScope
              theme={theme}
              breakpoint={frame.breakpoint}
              className={scopeClassName}
              fontStack={siteFontStack(siteFont)}
            >
              <NodeView id={pageId} parent="block" />
            </RenderScope>
          </RenderEnvContext.Provider>
        </ThemeContext.Provider>
      </FrameContext.Provider>
    </GeometryContext.Provider>
  );
}

// ED-034: page dirender di satu atau beberapa breakpoint frame berdampingan.
export function CanvasFrames({ pageId, frames, activeBreakpoint, mode, scopeClassName, siteFont }: CanvasFramesProps) {
  return frames.map((frame) =>
    mode === "iframe" ? (
      <IframeFrame key={frame.breakpoint} frame={frame} siteFont={siteFont}>
        <FrameContent frame={frame} pageId={pageId} siteFont={siteFont} measured={false} />
      </IframeFrame>
    ) : (
      <div
        key={frame.breakpoint}
        className={`bp-frame bp-${frame.breakpoint}`}
        data-breakpoint={frame.breakpoint}
        style={{ position: "absolute", left: frame.x, top: 0, width: frame.width, minHeight: frame.minHeight }}
      >
        <FrameContent
          frame={frame}
          pageId={pageId}
          scopeClassName={scopeClassName}
          siteFont={siteFont}
          measured={frame.breakpoint === activeBreakpoint}
        />
        {/* ED-034: garis "fold" = tinggi viewport preset (bukan konten situs; tidak menerima pointer). */}
        <div
          aria-hidden
          data-fold=""
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: frame.minHeight,
            borderTop: "1px dashed rgba(100, 116, 139, 0.6)",
            pointerEvents: "none",
          }}
        />
      </div>
    ),
  );
}
