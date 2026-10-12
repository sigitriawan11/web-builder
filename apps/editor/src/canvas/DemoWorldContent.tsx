// SEMENTARA (spike M0): isi world statis untuk mengecek lapisan canvas sebelum renderer ada (T0.4.1).

export interface DemoBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export const DEMO_BOXES: DemoBox[] = [
  { id: "demo-hero", x: 80, y: 80, width: 480, height: 240, color: "#FFE3CC" },
  { id: "demo-card-1", x: 80, y: 360, width: 220, height: 160, color: "#D6E8FF" },
  { id: "demo-card-2", x: 340, y: 360, width: 220, height: 160, color: "#D9F2DC" },
];

export function DemoWorldContent() {
  return DEMO_BOXES.map((box) => (
    <div
      key={box.id}
      data-node-id={box.id}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        background: box.color,
        borderRadius: 12,
        font: "16px/1.4 system-ui, sans-serif",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      {box.id}
    </div>
  ));
}
