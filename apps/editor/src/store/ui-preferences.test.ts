import { describe, expect, it } from "vitest";
import {
  createUiPreferencesStore,
  DEFAULT_PREFERENCES,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  type PreferenceStorage,
  parsePreferences,
  preferencesKey,
} from "./ui-preferences";

function memory(): PreferenceStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, read: (key) => data.get(key) ?? null, write: (key, value) => void data.set(key, value) };
}

describe("ui preferences (ED-007)", () => {
  it("disimpan per user; user lain mendapat default", () => {
    const storage = memory();
    const store = createUiPreferencesStore(storage);
    store.getState().loadFor("user-a");
    store.getState().update({ leftTab: "assets", leftWidth: 320 });
    expect(JSON.parse(storage.data.get(preferencesKey("user-a")) ?? "{}")).toMatchObject({
      leftTab: "assets",
      leftWidth: 320,
    });

    store.getState().loadFor("user-b");
    expect(store.getState()).toMatchObject(DEFAULT_PREFERENCES);
    store.getState().loadFor("user-a");
    expect(store.getState()).toMatchObject({ leftTab: "assets", leftWidth: 320 });
  });

  it("lebar dibatasi 200–480", () => {
    const store = createUiPreferencesStore(memory());
    store.getState().update({ leftWidth: 50 });
    expect(store.getState().leftWidth).toBe(LEFT_SIDEBAR_MIN);
    store.getState().update({ leftWidth: 9999 });
    expect(store.getState().leftWidth).toBe(LEFT_SIDEBAR_MAX);
  });

  it("data rusak / tidak valid → default per field", () => {
    expect(parsePreferences("{bukan json")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(JSON.stringify({ leftTab: "x", leftWidth: 300 }))).toEqual({
      ...DEFAULT_PREFERENCES,
      leftWidth: 300,
    });
  });
});
