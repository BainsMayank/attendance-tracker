import { Pressable, Text as NativeText, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FrostedSurface, Icon, haptic, useTheme, type IconName } from "@/ui";
import { FLOATING_TAB_BAR, FLOATING_TAB_GAP } from "./chrome";

export type TabSpec = { name: string; title: string; icon: IconName };

/** Android's floating frosted tab bar; the glass counterpart of the iOS tab bar. */
export function FloatingTabBar({
  state,
  navigation,
  tabs,
}: BottomTabBarProps & { tabs: TabSpec[] }) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const focused = tabs.find((t) => t.name === state.routes[state.index]?.name);
  const shape = {
    height: FLOATING_TAB_BAR,
    borderRadius: FLOATING_TAB_BAR / 2,
  };
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: bottom + FLOATING_TAB_GAP,
        alignItems: "center",
      }}
    >
      <View
        style={[
          shape,
          {
            width: "100%",
            maxWidth: 480,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          },
        ]}
      >
        <FrostedSurface
          scope={focused?.title ?? ""}
          fill="surface"
          edge="all"
          accessibilityRole="tablist"
          style={[
            shape,
            { flexDirection: "row", alignItems: "center", paddingHorizontal: 6 },
          ]}
        >
          {state.routes.map((route, index) => {
            const tab = tabs.find((t) => t.name === route.name);
            if (!tab) return null;
            const selected = state.index === index;
            const ink = selected ? colors.accent : colors.textSecondary;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={tab.title}
                accessibilityState={{ selected }}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!selected && !event.defaultPrevented) {
                    void haptic("selection");
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() =>
                  navigation.emit({ type: "tabLongPress", target: route.key })
                }
                style={({ pressed }) => ({
                  flex: 1,
                  height: FLOATING_TAB_BAR,
                  opacity: pressed ? 0.6 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                })}
              >
                <View
                  style={{
                    width: 52,
                    height: 28,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Always painted, faded in: Android drops the corner radius
                      when a background switches from transparent at runtime. */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 14,
                      backgroundColor: colors.accentSubtle,
                      opacity: selected ? 1 : 0,
                    }}
                  />
                  <Icon name={tab.icon} size={22} color={ink} />
                </View>
                <NativeText
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    lineHeight: 16,
                    fontWeight: selected ? "600" : "500",
                    color: ink,
                  }}
                >
                  {tab.title}
                </NativeText>
              </Pressable>
            );
          })}
        </FrostedSurface>
      </View>
    </View>
  );
}
