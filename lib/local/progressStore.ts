"use client";

// SPEC 11.2: ilerleme fotoğrafları yalnız cihazda (IndexedDB, Dexie). Hiçbir fonksiyon ağa çıkmaz.
import Dexie, { type EntityTable } from "dexie";

export type ProgressPhoto = {
  id: string;
  takenAt: number; // epoch ms
  blob: Blob; // JPEG (analiz kopyası ≤ 1280 px)
  analysisId?: string;
  note?: string;
};

class ProgressDB extends Dexie {
  photos!: EntityTable<ProgressPhoto, "id">;
  constructor() {
    super("aura-progress");
    this.version(1).stores({ photos: "id, takenAt, analysisId" });
  }
}

let db: ProgressDB | null = null;
function getDb(): ProgressDB {
  if (!db) db = new ProgressDB();
  return db;
}

export async function addProgressPhoto(input: Omit<ProgressPhoto, "id" | "takenAt"> & { takenAt?: number }): Promise<ProgressPhoto> {
  const photo: ProgressPhoto = { id: crypto.randomUUID(), takenAt: input.takenAt ?? Date.now(), blob: input.blob, analysisId: input.analysisId, note: input.note };
  await getDb().photos.add(photo);
  return photo;
}

export async function listProgressPhotos(): Promise<ProgressPhoto[]> {
  return getDb().photos.orderBy("takenAt").reverse().toArray();
}

export async function updateProgressNote(id: string, note: string): Promise<void> {
  await getDb().photos.update(id, { note });
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  await getDb().photos.delete(id);
}

/** Hesap silme / rıza geri alma: cihazdaki tüm ilerleme fotoğrafları (SPEC Faz 13). */
export async function clearProgressPhotos(): Promise<void> {
  await getDb().photos.clear();
}
