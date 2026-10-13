// İlerleme fotoğrafı dizini (SPEC 11.2, SPEC-MOBILE M7): meta veriler JSON dizinde, görseller uygulama sanal alanında. Saf; birim testli.
export type ProgressEntry = { id: string; file: string; takenAt: number; analysisId?: string; note?: string };
export type ProgressIndex = { version: 1; items: ProgressEntry[] };

export const EMPTY_INDEX: ProgressIndex = { version: 1, items: [] };

export function parseIndex(raw: string | null | undefined): ProgressIndex {
  if (!raw) return EMPTY_INDEX;
  try {
    const v = JSON.parse(raw) as Partial<ProgressIndex>;
    if (v && v.version === 1 && Array.isArray(v.items)) return { version: 1, items: v.items.filter((i) => i && typeof i.id === "string" && typeof i.file === "string") };
  } catch {
    // bozuk dizin: boş kabul edilir, dosyalar temizlikte silinir
  }
  return EMPTY_INDEX;
}

export function serializeIndex(index: ProgressIndex): string {
  return JSON.stringify(index);
}

export function addEntry(index: ProgressIndex, entry: ProgressEntry): ProgressIndex {
  return { version: 1, items: [...index.items.filter((i) => i.id !== entry.id), entry].sort((a, b) => b.takenAt - a.takenAt) };
}

export function removeEntry(index: ProgressIndex, id: string): ProgressIndex {
  return { version: 1, items: index.items.filter((i) => i.id !== id) };
}

export function setNote(index: ProgressIndex, id: string, note: string): ProgressIndex {
  const trimmed = note.trim().slice(0, 120);
  return { version: 1, items: index.items.map((i) => (i.id === id ? { ...i, note: trimmed || undefined } : i)) };
}

/** Dizinde olmayan dosyalar (yetim) silinmelidir. */
export function orphanFiles(index: ProgressIndex, files: string[]): string[] {
  const known = new Set(index.items.map((i) => i.file));
  return files.filter((f) => f !== "index.json" && !known.has(f));
}
