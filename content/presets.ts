import { BEARD_PRESETS } from "./beard-presets";
import { COLOR_PRESETS } from "./color-presets";
import { HAIR_PRESETS } from "./hair-presets";
import type { Preset } from "./types";

export const ALL_PRESETS: Preset[] = [...HAIR_PRESETS, ...BEARD_PRESETS, ...COLOR_PRESETS];
export const PRESET_BY_ID = new Map(ALL_PRESETS.map((p) => [p.id, p]));
export function getPreset(id: string): Preset | undefined {
  return PRESET_BY_ID.get(id);
}
