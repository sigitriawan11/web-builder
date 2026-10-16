import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createSaveTracker, SAVE_ERROR_AFTER_MS, SAVING_DELAY_MS, type SaveTracker } from "./save-tracker";

// Timer manual: waktu maju hanya lewat `advance`.
function fakeTimers() {
  let now = 0;
  const queue = new Map<number, { at: number; callback: () => void }>();
  let next = 1;
  return {
    setTimeout: (callback: () => void, ms: number) => {
      const id = next++;
      queue.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout: (handle: unknown) => {
      queue.delete(handle as number);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...queue].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at > now) continue;
        queue.delete(id);
        timer.callback();
      }
    },
  };
}

const trackers: SaveTracker[] = [];
afterEach(() => {
  for (const tracker of trackers.splice(0)) tracker.destroy();
});

function setup() {
  const doc = new Y.Doc();
  const timers = fakeTimers();
  const tracker = createSaveTracker(doc, timers);
  trackers.push(tracker);
  const edit = (value: string) => doc.getMap("m").set("k", value);
  const confirm = (clocks: Record<string, number>) =>
    tracker.handleStateless(JSON.stringify({ type: "saved", seq: 1, clocks }));
  const ownClock = () => Y.getState(doc.store, doc.clientID);
  return { doc, timers, tracker, edit, confirm, ownClock };
}

describe("createSaveTracker (ED-200)", () => {
  it("offline sampai tersambung; tanpa perubahan = Tersimpan", () => {
    const { tracker } = setup();
    expect(tracker.status()).toBe("offline");
    tracker.setOnline(true);
    expect(tracker.status()).toBe("saved");
  });

  it("perubahan tertunda > 500 ms → Menyimpan…; dikonfirmasi `saved` dengan clock tab ini → Tersimpan", () => {
    const { tracker, timers, edit, confirm, ownClock, doc } = setup();
    tracker.setOnline(true);
    edit("a");
    expect(tracker.hasUnsaved()).toBe(true);
    timers.advance(SAVING_DELAY_MS - 1);
    expect(tracker.status()).toBe("saved");
    timers.advance(1);
    expect(tracker.status()).toBe("saving");
    confirm({ [String(doc.clientID)]: ownClock() });
    expect(tracker.status()).toBe("saved");
    expect(tracker.hasUnsaved()).toBe(false);
  });

  it("`saved` yang belum mencakup update terakhir (masih di jalan) tidak dianggap tersimpan", () => {
    const { tracker, timers, edit, confirm, ownClock, doc } = setup();
    tracker.setOnline(true);
    edit("a");
    const partial = ownClock();
    edit("b");
    confirm({ [String(doc.clientID)]: partial });
    timers.advance(SAVING_DELAY_MS);
    expect(tracker.status()).toBe("saving");
    // Clock klien lain / pesan lain / JSON rusak diabaikan.
    confirm({ "123": 999 });
    tracker.handleStateless(JSON.stringify({ type: "unlocked" }));
    tracker.handleStateless("{bukan json");
    expect(tracker.hasUnsaved()).toBe(true);
  });

  it("update remote (clientID lain) tidak membuat status tertunda", () => {
    const { tracker, doc } = setup();
    tracker.setOnline(true);
    const other = new Y.Doc();
    other.getMap("m").set("x", 1);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other), "remote");
    expect(tracker.hasUnsaved()).toBe(false);
  });

  it("tertunda terlalu lama saat online → Gagal menyimpan; offline menang; kembali online menghitung ulang", () => {
    const { tracker, timers, edit } = setup();
    tracker.setOnline(true);
    edit("a");
    timers.advance(SAVE_ERROR_AFTER_MS);
    expect(tracker.status()).toBe("error");
    tracker.setOnline(false);
    expect(tracker.status()).toBe("offline");
    tracker.setOnline(true);
    expect(tracker.status()).toBe("saved");
    timers.advance(SAVING_DELAY_MS);
    expect(tracker.status()).toBe("saving");
  });

  it("subscriber dipanggil hanya saat status berubah", () => {
    const { tracker, edit, timers } = setup();
    let calls = 0;
    tracker.subscribe(() => calls++);
    tracker.setOnline(true);
    edit("a");
    edit("b");
    expect(calls).toBe(1);
    timers.advance(SAVING_DELAY_MS);
    expect(calls).toBe(2);
  });
});
