import { PhasePlaceholder } from "@/components/app/PhasePlaceholder";

/** Faz 3'te (F03) doğum yılı seçici ve 18 altı engeli gelir. */
export default function AgeGatePage() {
  return <PhasePlaceholder titleKey="onboarding" phase={3} feature="F03" />;
}
