// Tek analiz select listesi (UI spec §1.2, engine spec §8, sözleşme C8). Son üç sütun migration 0009'la gelir;
// bu listeyi kullanan sorgular ancak 0009 ilgili veritabanına uygulandıktan sonra çalışır.
export const ANALYSIS_ROW_COLUMNS =
  "id, status, created_at, face_shape, overall, potential, subscores, gains, observations, geometry, calibration_version, prompt_version, engine_version, signals" as const;
