import { Stack } from "expo-router/stack";
import { GlassScope, useHeaderScrolled, useTheme } from "@/ui";

export function TabStack({ title }: { title: string }) {
  const { colors, scheme } = useTheme();
  const scrolled = useHeaderScrolled(title);
  // Android: Material 3 app bar, page-colored at rest and tinted once content
  // scrolls under it. iOS keeps its large title and system scroll-edge effect.
  const bar =
    process.env.EXPO_OS === "android" && scrolled
      ? scheme === "dark"
        ? colors.surface
        : colors.surfaceRaised
      : colors.background;
  return (
    <GlassScope name={title}>
      <Stack
        screenOptions={{
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: bar },
          contentStyle: { backgroundColor: colors.background },
          headerLargeTitleEnabled: process.env.EXPO_OS === "ios",
          headerShadowVisible: false,
          headerLargeTitleShadowVisible: false,
          headerLargeStyle: { backgroundColor: colors.background },
          ...(process.env.EXPO_OS === "android" && {
            headerTitleStyle: { fontSize: 22, fontWeight: "600" },
          }),
        }}
      >
        <Stack.Screen name="index" options={{ title }} />
      </Stack>
    </GlassScope>
  );
}
