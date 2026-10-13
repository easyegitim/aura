import type { ExpoConfig } from "expo/config";

// SPEC-MOBILE M1/M8. Mağaza kimlikleri (bundle id / package) ürün adı kesinleşince değiştirilir (SPEC 21.1).
const config: ExpoConfig = {
  name: "Aura",
  slug: "aura",
  scheme: "aura",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.easyegitim.aura",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "Selfie'ni analiz etmek için kameraya erişim gerekir. Fotoğrafın saklanmaz.",
      NSPhotoLibraryUsageDescription: "Galeriden selfie seçmek için erişim gerekir. Fotoğrafın saklanmaz.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.easyegitim.aura",
    adaptiveIcon: {
      backgroundColor: "#0a0a0a",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    permissions: ["android.permission.CAMERA"],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "Selfie'ni analiz etmek için kameraya erişim gerekir. Fotoğrafın saklanmaz.",
        enableFrameProcessors: true,
        enableCodeScanner: false,
      },
    ],
    ["expo-image-picker", { photosPermission: "Galeriden selfie seçmek için erişim gerekir. Fotoğrafın saklanmaz." }],
    "./plugins/withMediapipeModels.js",
  ],
  experiments: { typedRoutes: true },
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID ?? "" } },
};

export default config;
