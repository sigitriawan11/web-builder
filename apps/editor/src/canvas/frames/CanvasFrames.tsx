import { NodeView } from "../render-root/NodeView";
import { RenderScope } from "../render-root/RenderRoot";
import { FrameContext } from "../render-root/breakpoint-context";
import { type FrameMode, type FrameSpec, layoutFrames } from "./frame-layout";
import { IframeFrame } from "./IframeFrame";

interface CanvasFramesProps {
  pageId: string;
  showAll: boolean;
  mode: FrameMode;
  scopeClassName?: string | undefined;
}

function FrameContent({ frame, pageId, scopeClassName }: { frame: FrameSpec; pageId: string; scopeClassName?: string | undefined }) {
  return (
    <FrameContext.Provider value={{ breakpoint: frame.breakpoint, width: frame.width }}>
      <RenderScope className={scopeClassName}>
        <NodeView id={pageId} parent="block" />
      </RenderScope>
    </FrameContext.Provider>
  );
}

// ED-034: page dirender di satu atau beberapa breakpoint frame berdampingan.
export function CanvasFrames({ pageId, showAll, mode, scopeClassName }: CanvasFramesProps) {
  return layoutFrames(showAll).map((frame) =>
    mode === "iframe" ? (
      <IframeFrame key={frame.breakpoint} frame={frame}>
        <FrameContent frame={frame} pageId={pageId} />
      </IframeFrame>
    ) : (
      <div
        key={frame.breakpoint}
        className={`bp-frame bp-${frame.breakpoint}`}
        style={{ position: "absolute", left: frame.x, top: 0, width: frame.width }}
      >
        <FrameContent frame={frame} pageId={pageId} scopeClassName={scopeClassName} />
      </div>
    ),
  );
}
