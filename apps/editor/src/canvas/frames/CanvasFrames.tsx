import { siteFontStack } from "../fonts/site-fonts";
import { GeometryContext } from "../geometry/geometry-context";
import { spikeGeometry } from "../geometry/spike-geometry";
import { FrameContext } from "../render-root/breakpoint-context";
import { NodeView } from "../render-root/NodeView";
import { RenderScope } from "../render-root/RenderRoot";
import { type FrameMode, type FrameSpec, layoutFrames } from "./frame-layout";
import { IframeFrame } from "./IframeFrame";

interface CanvasFramesProps {
  pageId: string;
  showAll: boolean;
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

function FrameContent({
  frame,
  pageId,
  scopeClassName,
  siteFont,
  measured,
}: FrameContentProps & { measured: boolean }) {
  return (
    <GeometryContext.Provider value={measured ? spikeGeometry : null}>
      <FrameContext.Provider value={{ breakpoint: frame.breakpoint, width: frame.width }}>
        <RenderScope className={scopeClassName} fontStack={siteFontStack(siteFont)}>
          <NodeView id={pageId} parent="block" />
        </RenderScope>
      </FrameContext.Provider>
    </GeometryContext.Provider>
  );
}

// ED-034: page dirender di satu atau beberapa breakpoint frame berdampingan.
export function CanvasFrames({ pageId, showAll, mode, scopeClassName, siteFont }: CanvasFramesProps) {
  return layoutFrames(showAll).map((frame) =>
    mode === "iframe" ? (
      <IframeFrame key={frame.breakpoint} frame={frame} siteFont={siteFont}>
        <FrameContent frame={frame} pageId={pageId} siteFont={siteFont} measured={false} />
      </IframeFrame>
    ) : (
      <div
        key={frame.breakpoint}
        className={`bp-frame bp-${frame.breakpoint}`}
        style={{ position: "absolute", left: frame.x, top: 0, width: frame.width }}
      >
        {/* ED-019: geometry diukur untuk frame aktif saja (spike: Desktop). */}
        <FrameContent
          frame={frame}
          pageId={pageId}
          scopeClassName={scopeClassName}
          siteFont={siteFont}
          measured={frame.breakpoint === "base"}
        />
      </div>
    ),
  );
}
