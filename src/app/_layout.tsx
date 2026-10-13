import { useEffect } from "react";
import { Stack } from "expo-router/stack";
import type { NativeStackNavigationOptions } from "expo-router/native-stack";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router/react-navigation";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { DatabaseProvider } from "@/db/provider";
import { FirstLaunch } from "@/features/onboarding/first-launch";
import { AppLock } from "@/features/settings/app-lock";
import { SettingsRuntime } from "@/features/settings/runtime";
import { ThemeProvider, ToastProvider, useTheme } from "@/ui";
void SplashScreen.preventAutoHideAsync().catch(() => {});
function Root() {
  const { scheme, colors } = useTheme();
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  // iOS edits in sheets. Android sheets drop the header (and with it Save and
  // Cancel), so editors open as Material full-screen dialogs instead.
  const sheet: NativeStackNavigationOptions =
    process.env.EXPO_OS === "android"
      ? {
          presentation: "modal",
          animation: "slide_from_bottom",
          headerStyle: { backgroundColor: colors.background },
        }
      : {
          presentation: "formSheet",
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1],
        };
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          primary: colors.accent,
          border: colors.separator,
        },
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <DatabaseProvider>
        <AppLock>
          <ToastProvider>
            <SettingsRuntime />
            <Stack
              screenOptions={{
                headerTintColor: colors.textPrimary,
                headerStyle: { backgroundColor: colors.background },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen
                name="file-preview"
                options={{
                  title: "File preview",
                  headerBackButtonDisplayMode: "minimal",
                }}
              />
              <Stack.Screen
                name="file-editor"
                options={{ title: "File", ...sheet }}
              />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="semester"
                options={{ title: "Semester", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-mutes"
                options={{ title: "Muted subjects", headerBackTitle: "Notifications" }}
              />
              <Stack.Screen
                name="settings-notifications"
                options={{ title: "Notifications", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-backup"
                options={{ title: "Backup & restore", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-export"
                options={{ title: "Export attendance", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-appearance"
                options={{ title: "Appearance", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-privacy"
                options={{ title: "Privacy", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-about"
                options={{ title: "About", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="settings-licenses"
                options={{ title: "Open-source licenses", headerBackTitle: "Privacy" }}
              />
              <Stack.Screen
                name="semester-reset"
                options={{ title: "", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="semester-history"
                options={{ title: "Attendance history", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="semester-summary"
                options={{ title: "Semester history", headerBackTitle: "Settings" }}
              />
              <Stack.Screen
                name="attendance-day"
                options={{ title: "Daily Log" }}
              />
              <Stack.Screen
                name="onboarding"
                options={{
                  title: "Set up your semester",
                  headerBackVisible: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="onboarding-manual"
                options={{
                  title: "Build manually",
                  headerBackButtonDisplayMode: "minimal",
                }}
              />
              <Stack.Screen
                name="timetable-import"
                options={{ title: "Import with AI", headerBackTitle: "Timetable" }}
              />
              <Stack.Screen
                name="timetable-import-preview"
                options={{ title: "Preview timetable", headerBackTitle: "Import" }}
              />
              <Stack.Screen
                name="subject-note"
                options={{
                  title: "Note",
                  headerBackButtonDisplayMode: "minimal",
                }}
              />
              <Stack.Screen
                name="subjects/[subjectId]"
                options={{ title: "Subject", headerBackTitle: "Subjects" }}
              />
              <Stack.Screen
                name="timetable-subjects"
                options={{ title: "Subjects", headerBackTitle: "Timetable" }}
              />
              <Stack.Screen
                name="class-types"
                options={{ title: "Class types", headerBackTitle: "Timetable" }}
              />
              {[
                "subject-editor",
                "subject-content-editor",
                "class-type-editor",
                "timetable-slot",
                "timetable-semester",
                "daily-log-extra",
                "daily-log-note",
                "semester-setup",
                "semester-holiday",
              ].map((name) => (
                <Stack.Screen
                  key={name}
                  name={name}
                  options={{
                    ...sheet,
                    contentStyle: { backgroundColor: colors.surface },
                  }}
                />
              ))}
              <Stack.Screen
                name="daily-log-calendar"
                options={{
                  title: "Calendar",
                  ...sheet,
                  contentStyle: { backgroundColor: colors.surface },
                }}
              />
              <Stack.Screen
                name="design-showcase"
                options={{ title: "Design showcase" }}
              />
            </Stack>
            <FirstLaunch />
          </ToastProvider>
        </AppLock>
      </DatabaseProvider>
    </NavigationThemeProvider>
  );
}
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
