import {
  type ComponentDefinition,
  type InstanceProps,
  type JsonValue,
  type NodePatch,
  plainToRichText,
  resetOverride,
  runCommand,
  setInstanceOverride,
} from "@platform/document-model";
import { useLibraryComponentDefinition } from "@platform/sdk/react";
import { Button, Checkbox, Input } from "@platform/ui";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import type { ChildSelection } from "../../store/child-selection-store";
import { InspectorRow, InspectorSection } from "./InspectorSection";

// ED-058/T3.6.3: edit resolved child "di dalam instance". Hanya properti yang diizinkan (M3: visibility + teks);
// node ber-`nodeAccess.hardLocked` tak bisa di-override. Tulis via `setInstanceOverride` ke `props.overrides[path]`
// → canvas re-resolve. Image/icon/fill/color, repeater & nested = M4.

interface DefNode {
  type?: string;
  name?: string;
  visible?: boolean;
  props?: { content?: unknown };
}

function richToPlain(doc: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null) return;
    const n = node as { type?: unknown; text?: unknown; content?: unknown };
    if (n.type === "text" && typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) for (const child of n.content) walk(child);
  };
  walk(doc);
  return out.join("");
}

export function InstanceChildOverrideSection({
  runtime,
  instanceNode,
  childSelection,
  readOnly,
}: {
  runtime: CanvasRuntime;
  instanceNode: { id: string; props: InstanceProps };
  childSelection: ChildSelection;
  readOnly: boolean;
}) {
  const t = useT();
  const { path, instanceId } = childSelection;
  const def = useLibraryComponentDefinition(instanceNode.props.componentId, instanceNode.props.version);

  const apply = (patch: NodePatch) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setInstanceOverride, { id: instanceId, path, patch });
    runtime.undo.stopCapturing();
  };
  const reset = () => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, resetOverride, { id: instanceId, path });
    runtime.undo.stopCapturing();
  };

  if (def.isPending)
    return (
      <InspectorSection id="instance-child" title={t("inspector.childOverride.title")}>
        <p className="px-3 text-xs text-muted-foreground">{t("inspector.instance.loading")}</p>
      </InspectorSection>
    );

  const data = def.data as ComponentDefinition | undefined;
  const defNode = data?.nodes?.[path] as DefNode | undefined;
  const access = data?.nodeAccess?.[path];
  const override = instanceNode.props.overrides?.[path];
  const childName = defNode?.name || path;

  return (
    <InspectorSection id="instance-child" title={`${t("inspector.childOverride.title")} · ${childName}`}>
      {!defNode ? (
        <p className="px-3 text-xs text-muted-foreground">{t("inspector.childOverride.missing")}</p>
      ) : access?.hardLocked ? (
        // DM-079: node terkunci penuh — tidak bisa di-override sama sekali.
        <p className="px-3 text-xs text-muted-foreground" data-testid="instance-child-locked">
          {t("inspector.childOverride.locked")}
        </p>
      ) : (
        <>
          <InspectorRow label={t("inspector.childOverride.visible")}>
            <Checkbox
              checked={override?.visible ?? defNode.visible ?? true}
              disabled={readOnly}
              data-testid="instance-child-visible"
              onCheckedChange={(checked) => apply({ visible: checked === true })}
            />
          </InspectorRow>
          {defNode.type === "text" ? (
            <InspectorRow label={t("inspector.childOverride.text")}>
              <Input
                value={richToPlain(override?.props?.content ?? defNode.props?.content)}
                disabled={readOnly}
                data-testid="instance-child-text"
                onChange={(e) => apply({ props: { content: plainToRichText(e.target.value) as unknown as JsonValue } })}
              />
            </InspectorRow>
          ) : null}
          {!readOnly && override ? (
            <div className="px-3 pt-2">
              <Button variant="outline" size="sm" data-testid="instance-child-reset" onClick={reset}>
                {t("inspector.childOverride.reset")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </InspectorSection>
  );
}
