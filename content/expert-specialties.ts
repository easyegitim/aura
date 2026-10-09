// SPEC 9.3 / 12.3. AI yalnız dermatoloji, saç sağlığı, diş/ortodonti, diyetisyen, psikolog önerebilir; plastik cerrahi asla (D11).
export type ExpertSpecialty = { id: string; nameTr: string; aiMayRecommend: boolean };

export const EXPERT_SPECIALTIES: ExpertSpecialty[] = [
  { id: "dermatoloji", nameTr: "Dermatoloji", aiMayRecommend: true },
  { id: "sac_sagligi", nameTr: "Saç sağlığı", aiMayRecommend: true },
  { id: "plastik_cerrahi", nameTr: "Plastik cerrahi", aiMayRecommend: false },
  { id: "dis_ortodonti", nameTr: "Diş / ortodonti", aiMayRecommend: true },
  { id: "diyetisyen", nameTr: "Diyetisyen", aiMayRecommend: true },
  { id: "psikolog", nameTr: "Psikolog", aiMayRecommend: true },
];

export const AI_ALLOWED_SPECIALTIES = EXPERT_SPECIALTIES.filter((s) => s.aiMayRecommend).map((s) => s.id);
