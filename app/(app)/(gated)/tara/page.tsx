import { CaptureScreen } from "@/components/camera/CaptureScreen";
import { getPublicEngineInfo } from "@/lib/ai/disclosure.server";

/** F05: rehberli selfie, kalite kapısı ve adımlı analiz ilerlemesi. Motor ve sağlayıcı adı sunucudan (gizli değer yok). */
export default function CapturePage() {
  const info = getPublicEngineInfo();
  return <CaptureScreen engine={info.engine} aiProviderName={info.analysisProvider} />;
}
