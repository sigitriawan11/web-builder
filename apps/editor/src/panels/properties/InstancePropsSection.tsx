import { type Node, type PropDef, runCommand, setProp, setVariant, type VariantAxis } from "@platform/document-model";
import { useLibraryComponentDefinition } from "@platform/sdk/react";
import { Checkbox, Input, NativeSelect } from "@platform/ui";
import { useLocale, useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { InspectorRow, InspectorSection } from "./InspectorSection";
import { NumberInput } from "./inputs/NumberInput";

// T3.6.4/ED-153: form props instance dari propsSchema component. Ubah nilai → `setProp` → canvas re-resolve. Tipe yang
// didukung sekarang: text/number/boolean/enum (image/link/icon/color = kontrol kaya, follow-up). Hanya satu instance.
const EDITABLE = new Set(["text", "number", "boolean", "enum"]);

export function InstancePropsSection({
  runtime,
  node,
  readOnly,
}: {
  runtime: CanvasRuntime;
  node: Node;
  readOnly: boolean;
}) {
  if (node.type !== "instance") return null;
  return (
    <Form
      runtime={runtime}
      nodeId={node.id}
      componentId={node.props.componentId}
      version={node.props.version}
      propValues={node.props.propValues ?? {}}
      variant={node.props.variant ?? {}}
      readOnly={readOnly}
    />
  );
}

function Form({
  runtime,
  nodeId,
  componentId,
  version,
  propValues,
  variant,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodeId: string;
  componentId: string;
  version: number;
  propValues: Record<string, unknown>;
  variant: Record<string, string>;
  readOnly: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const def = useLibraryComponentDefinition(componentId, version);

  const set = (key: string, value: unknown) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setProp, { id: nodeId, key, value });
    runtime.undo.stopCapturing();
  };
  const setVar = (axis: string, option: string) => {
    if (readOnly) return;
    runtime.undo.stopCapturing();
    runCommand(runtime.commandCtx, setVariant, { id: nodeId, axis, option });
    runtime.undo.stopCapturing();
  };

  if (def.isPending)
    return (
      <InspectorSection id="instance-props" title={t("inspector.instance.title")}>
        <p className="px-3 text-xs text-muted-foreground">{t("inspector.instance.loading")}</p>
      </InspectorSection>
    );

  const data = def.data as { propsSchema?: PropDef[]; variantAxes?: VariantAxis[] } | undefined;
  const editable = (data?.propsSchema ?? []).filter((prop) => EDITABLE.has(prop.type));
  // CMP-031/CMP-032: axis `state` jadi pseudo-class (bukan picker manual) → tak ditampilkan di sini.
  const axes = (data?.variantAxes ?? []).filter((axis) => axis.name !== "state");

  return (
    <InspectorSection id="instance-props" title={t("inspector.instance.title")}>
      {axes.length === 0 && editable.length === 0 ? (
        <p className="px-3 text-xs text-muted-foreground">{t("inspector.instance.none")}</p>
      ) : null}
      {axes.map((axis) => (
        <InspectorRow key={`v:${axis.name}`} label={axis.name}>
          <NativeSelect
            value={variant[axis.name] ?? axis.default}
            disabled={readOnly}
            data-testid={`instance-variant-${axis.name}`}
            onChange={(e) => setVar(axis.name, e.target.value)}
          >
            {axis.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
        </InspectorRow>
      ))}
      {editable.map((prop) => (
        <InspectorRow key={prop.key} label={prop.label[locale] || prop.key}>
          <PropControl
            prop={prop}
            value={propValues[prop.key]}
            readOnly={readOnly}
            onChange={(v) => set(prop.key, v)}
          />
        </InspectorRow>
      ))}
    </InspectorSection>
  );
}

function PropControl({
  prop,
  value,
  readOnly,
  onChange,
}: {
  prop: PropDef;
  value: unknown;
  readOnly: boolean;
  onChange: (value: unknown) => void;
}) {
  const current = value ?? ("default" in prop ? prop.default : undefined);
  if (prop.type === "boolean")
    return <Checkbox checked={current === true} disabled={readOnly} onCheckedChange={(c) => onChange(c === true)} />;
  if (prop.type === "number")
    return (
      <NumberInput
        label={prop.key}
        value={typeof current === "number" ? current : undefined}
        testId={`instance-prop-${prop.key}`}
        onCommit={(update) => onChange(update(typeof current === "number" ? current : 0))}
      />
    );
  if (prop.type === "enum")
    return (
      <NativeSelect
        value={typeof current === "string" ? current : ""}
        disabled={readOnly}
        data-testid={`instance-prop-${prop.key}`}
        onChange={(e) => onChange(e.target.value)}
      >
        {prop.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value}
          </option>
        ))}
      </NativeSelect>
    );
  // text
  return (
    <Input
      value={typeof current === "string" ? current : ""}
      disabled={readOnly}
      data-testid={`instance-prop-${prop.key}`}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
