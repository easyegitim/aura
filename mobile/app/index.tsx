import { StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "@/lib/config/app";
import { PLANS } from "@/lib/config/plans";

/** M0 iskelet ekranı: paylaşılan kök modüllerin (lib/config) Metro ile derlendiğini kanıtlar. */
export default function Index() {
  return (
    <View style={styles.root} accessibilityRole="summary">
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.body}>Mobil iskelet (M0). Plan sayısı: {Object.keys(PLANS).length}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 8 },
  title: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 14, opacity: 0.7 },
});
