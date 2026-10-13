import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router/tabs";
import { useTheme } from "@/ui";
import { FloatingTabBar, type TabSpec } from "@/features/shell/floating-tab-bar";

// Titles double as each tab's glass scope (see TabStack).
const tabs: TabSpec[] = [
  { name: "(subjects)", title: "Subjects", icon: { ios: "book.closed", android: "menu_book" } },
  { name: "daily-log", title: "Daily Log", icon: { ios: "calendar.badge.checkmark", android: "event_available" } },
  { name: "timetable", title: "Timetable", icon: { ios: "tablecells", android: "calendar_view_week" } },
  { name: "settings", title: "Settings", icon: { ios: "gearshape", android: "settings" } },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  // Android: JS tabs with a floating frosted bar, since the native Material
  // bar can't blur. iOS keeps the system Liquid Glass tab bar.
  if (process.env.EXPO_OS === "android")
    return (
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
        screenOptions={{
          headerShown: false,
          animation: "fade",
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        {tabs.map((t) => (
          <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
        ))}
      </Tabs>
    );
  return (
    <NativeTabs
      tintColor={colors.accent}
      backgroundColor={colors.background}
      labelStyle={{
        color: colors.textSecondary,
        selected: { color: colors.accent },
      }}
    >
      <NativeTabs.Trigger name="(subjects)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "book.closed", selected: "book.closed.fill" }}
          md="menu_book"
        />
        <NativeTabs.Trigger.Label>Subjects</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="daily-log">
        <NativeTabs.Trigger.Icon
          sf={{
            default: "calendar.badge.checkmark",
            selected: "calendar.badge.checkmark",
          }}
          md="event_available"
        />
        <NativeTabs.Trigger.Label>Daily Log</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="timetable">
        <NativeTabs.Trigger.Icon sf="tablecells" md="calendar_view_week" />
        <NativeTabs.Trigger.Label>Timetable</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
