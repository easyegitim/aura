// SPEC 7.4: MediaPipe yüz ağı standart indeksleri. Görüntüde kişinin sağı solda kalır.
// Yanlış çıkan indeks /debug/landmarks sayfasında doğrulanıp burada düzeltilir.
export const IDX = {
  top: 10, // ağın tepesi (alın üstü, saç çizgisi değil)
  glabella: 9, // kaş arası
  nasion: 168, // burun kökü
  noseTip: 1,
  subnasale: 2, // burun altı
  upperLipMid: 0,
  menton: 152, // çene ucu
  cheekR: 234, // elmacık hizası en dış (kişinin sağı)
  cheekL: 454,
  gonionR: 172, // çene köşesi (yaklaşık)
  gonionL: 397,
  foreheadR: 54,
  foreheadL: 284,
  browTopR: 105,
  browTopL: 334,
  eyeOuterR: 33,
  eyeOuterL: 263,
  eyeInnerR: 133,
  eyeInnerL: 362,
  irisR: 468,
  irisL: 473,
  mouthR: 61,
  mouthL: 291,
} as const;

/** Yüz ovali (kompozit maskesi için, sırayla). */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;

/** Kompozit hizalaması için sabit noktalar (SPEC 10.4 adım 2). */
export const ALIGN_POINTS = [33, 263, 133, 362, 168, 1, 152] as const;

export const LANDMARK_COUNT = 478;
