// ED-063: reorder & reparent di dalam auto-layout. Logika murni; rect & titik dalam koordinat world.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChildBox {
  id: string;
  rect: Rect;
}

export type FlexDirection = "row" | "column";

// Toleransi pengelompokan baris wrap (px world): anak dengan tepi atas sedekat ini dianggap satu baris.
const ROW_TOLERANCE = 1;

const centerX = (rect: Rect) => rect.x + rect.width / 2;
const centerY = (rect: Rect) => rect.y + rect.height / 2;

// Baris wrap (urut dokumen): anak berurutan dengan tepi atas sama.
function wrapRows(children: readonly ChildBox[]): { start: number; items: ChildBox[] }[] {
  const rows: { start: number; items: ChildBox[] }[] = [];
  children.forEach((child, index) => {
    const row = rows.at(-1);
    const top = row?.items[0]?.rect.y;
    if (row && top !== undefined && Math.abs(child.rect.y - top) <= ROW_TOLERANCE) row.items.push(child);
    else rows.push({ start: index, items: [child] });
  });
  return rows;
}

function rowSpan(items: readonly ChildBox[]): { top: number; bottom: number } {
  return {
    top: Math.min(...items.map((item) => item.rect.y)),
    bottom: Math.max(...items.map((item) => item.rect.y + item.rect.height)),
  };
}

/**
 * Indeks sisip untuk titik `pointer` di antara `children` (urut dokumen, TANPA node yang di-drag),
 * sesuai semantik indeks akhir `moveNode`. Baris/kolom: jumlah anak yang titik tengahnya sebelum pointer.
 * Wrap (ED-063): baris terdekat dulu, lalu kolom di dalam baris itu.
 */
export function reorderIndex(
  children: readonly ChildBox[],
  pointer: { x: number; y: number },
  direction: FlexDirection,
  wrap: boolean,
): number {
  if (direction === "column" || !wrap) {
    const before = (child: ChildBox) =>
      direction === "row" ? centerX(child.rect) < pointer.x : centerY(child.rect) < pointer.y;
    return children.filter(before).length;
  }

  const rows = wrapRows(children);
  if (rows.length === 0) return 0;
  // Baris yang memuat pointer secara vertikal, atau yang pusatnya paling dekat.
  const distance = (items: readonly ChildBox[]) => {
    const { top, bottom } = rowSpan(items);
    return pointer.y < top ? top - pointer.y : pointer.y > bottom ? pointer.y - bottom : 0;
  };
  const row = rows.reduce((best, candidate) => (distance(candidate.items) < distance(best.items) ? candidate : best));
  return row.start + row.items.filter((child) => centerX(child.rect) < pointer.x).length;
}

// Garis penanda sisip (world): tegak lurus arah layout. Ketebalan digambar overlay (2px screen).
export interface InsertionMarker {
  x: number;
  y: number;
  length: number;
  orientation: "vertical" | "horizontal";
}

/**
 * Posisi garis penanda untuk `index` (ED-063): di tengah antara dua anak bertetangga, atau tepat di
 * luar anak pertama/terakhir. Container kosong: di awal area container.
 */
export function insertionMarker(
  children: readonly ChildBox[],
  index: number,
  direction: FlexDirection,
  wrap: boolean,
  container: Rect,
): InsertionMarker {
  const previous = children[index - 1];
  const next = children[index];

  if (direction === "column") {
    const y =
      previous && next
        ? (previous.rect.y + previous.rect.height + next.rect.y) / 2
        : next
          ? next.rect.y
          : previous
            ? previous.rect.y + previous.rect.height
            : container.y;
    return { x: container.x, y, length: container.width, orientation: "horizontal" };
  }

  // Wrap: penanda di baris anak tujuan (atau baris anak sebelumnya bila sisip di akhir baris).
  const sameRow = previous && next && Math.abs(previous.rect.y - next.rect.y) <= ROW_TOLERANCE;
  const reference = next && (!previous || sameRow || !wrap) ? next : previous;
  const span = wrap && reference ? rowSpan(children.filter((child) => Math.abs(child.rect.y - reference.rect.y) <= ROW_TOLERANCE)) : null;
  const x =
    previous && next && sameRow
      ? (previous.rect.x + previous.rect.width + next.rect.x) / 2
      : reference === next && next
        ? next.rect.x
        : previous
          ? previous.rect.x + previous.rect.width
          : container.x;
  return span
    ? { x, y: span.top, length: span.bottom - span.top, orientation: "vertical" }
    : { x, y: container.y, length: container.height, orientation: "vertical" };
}
