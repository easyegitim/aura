const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  { ignores: ["dist/*", "ios/*", "android/*", ".expo/*"] },
  // Node ortamında çalışan yapılandırma/eklenti/betik dosyaları
  { files: ["plugins/**/*.js", "scripts/**/*.mjs", "*.config.js"], languageOptions: { globals: { __dirname: "readonly", require: "readonly", module: "writable", process: "readonly", console: "readonly" } } },
  {
    rules: {
      // SPEC-MOBILE M1: sunucu ve DOM'a bağlı modüller mobilden içe aktarılmaz.
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "server-only", message: "Sunucu modülü; mobilde kullanılamaz." }],
          patterns: [
            { group: ["next", "next/*", "react-dom", "react-dom/*"], message: "Next/DOM modülü; mobilde kullanılamaz." },
            { group: ["@/lib/db/*", "@/lib/api/guard", "@/lib/api/premium", "@/lib/api/admin", "@/lib/ai/*", "!@/lib/ai/reportSchema", "!@/lib/ai/scoreSchema", "@/lib/billing/*", "!@/lib/billing/revenuecat", "@/lib/coach/generate", "@/lib/coach/reportsStore", "@/lib/experts/*", "@/lib/legal/*", "@/lib/email/*", "@/lib/face/vision.worker", "@/lib/face/client", "@/lib/face/preprocess", "@/lib/local/*", "@/lib/share/*", "@/lib/security/*", "@/lib/monitoring/*", "@/app/*", "@/components/*"], message: "Sunucu/DOM modülü; SPEC-MOBILE M1 paylaşım listesine bak." },
          ],
        },
      ],
    },
  },
]);
