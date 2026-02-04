import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

let initialized = false;

export async function initNotifications() {
  // Expo Go on iOS is supported, but guard anyway
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== "granted") return;
    }

    initialized = true;
  } catch (e) {
    console.log("initNotifications failed:", e);
  }
}

export async function sendAlert(title: string, body: string) {
  if (Platform.OS === "web") return;
  if (!Device.isDevice) return;
  if (!initialized) return;

  // Defensive: guarantee string values
  const safeTitle = String(title ?? "Alert");
  const safeBody = String(body ?? "");

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: safeTitle, body: safeBody },
      trigger: null,
    });
  } catch (e) {
    console.log("sendAlert failed:", e);
  }
}
