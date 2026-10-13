import { Pressable, Text as NativeText, View } from "react-native";
import { Stack } from "expo-router/stack";
import { Icon, type IconName } from "./kit";
import { useTheme } from "./theme-provider";

export type HeaderItem = {
  /** Visible text, or the accessibility label when `icon` is set. */
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  /** The screen's confirming action (Save, Finish): accent and semibold. */
  prominent?: boolean;
  /** Accent-tint an icon button. */
  accent?: boolean;
};

/**
 * Header buttons for both platforms. iOS uses the native toolbar (Liquid Glass
 * buttons). Android's native toolbar only draws bundled image icons, so it gets
 * Material-style header buttons rendered here instead.
 */
export function HeaderActions({
  left,
  right,
}: {
  left?: HeaderItem[];
  right?: HeaderItem[];
}) {
  const { colors } = useTheme();
  if (process.env.EXPO_OS === "ios") {
    const toolbar = (placement: "left" | "right", items?: HeaderItem[]) =>
      items?.length ? (
        <Stack.Toolbar placement={placement}>
          {items.map((item) => (
            <Stack.Toolbar.Button
              key={item.label}
              icon={item.icon?.ios as never}
              accessibilityLabel={item.label}
              disabled={item.disabled}
              variant="plain"
              tintColor={item.prominent || item.accent ? colors.accent : undefined}
              style={item.prominent ? { fontWeight: "600" } : undefined}
              onPress={item.onPress}
            >
              {item.icon ? undefined : item.label}
            </Stack.Toolbar.Button>
          ))}
        </Stack.Toolbar>
      ) : null;
    return (
      <>
        {toolbar("left", left)}
        {toolbar("right", right)}
      </>
    );
  }
  const row = (items?: HeaderItem[]) =>
    items?.length
      ? () => (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {items.map((item) => (
              <HeaderButton key={item.label} item={item} />
            ))}
          </View>
        )
      : undefined;
  return (
    <Stack.Screen
      options={{
        ...(left ? { headerLeft: row(left) } : {}),
        ...(right ? { headerRight: row(right) } : {}),
      }}
    />
  );
}

function HeaderButton({ item }: { item: HeaderItem }) {
  const { colors } = useTheme();
  const ink = item.prominent || item.accent ? colors.accent : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled: !!item.disabled }}
      disabled={item.disabled}
      onPress={item.onPress}
      android_ripple={{ color: colors.separator, borderless: true, radius: 24 }}
      hitSlop={4}
      style={({ pressed }) => ({
        minWidth: 48,
        height: 48,
        paddingHorizontal: item.icon ? 0 : 12,
        alignItems: "center",
        justifyContent: "center",
        opacity: item.disabled ? 0.4 : process.env.EXPO_OS === "web" && pressed ? 0.6 : 1,
      })}
    >
      {item.icon ? (
        <Icon name={item.icon} size={24} color={ink} />
      ) : (
        <NativeText
          style={{
            color: ink,
            fontSize: 15,
            fontWeight: item.prominent ? "600" : "500",
          }}
        >
          {item.label}
        </NativeText>
      )}
    </Pressable>
  );
}
