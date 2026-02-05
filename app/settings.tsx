import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function SettingsScreen() {
  return (
    <ThemedView style={{ flex: 1, padding: 16, gap: 12 }}>
      <ThemedText type="title">Settings</ThemedText>
      <ThemedText>Alert sensitivity will go here.</ThemedText>
    </ThemedView>
  );
}
