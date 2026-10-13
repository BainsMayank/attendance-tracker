import { BottomSheet as NativeSheet, Host, RNHostView } from "@expo/ui";
import { ScrollView, View } from "react-native";
import type { PropsWithChildren } from "react";
import { useTheme } from "./theme-provider";
import { Text } from "./text";
import { Button } from "./button";
export function BottomSheet({
  open,
  onDismiss,
  title,
  subtitle,
  done = true,
  children,
}: PropsWithChildren<{
  open: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  /** Action menus close themselves; editors show a Done button. */
  done?: boolean;
}>) {
  const { colors, scheme } = useTheme();
  return (
    <Host
      colorScheme={scheme}
      seedColor={colors.accent}
      style={{ position: "absolute" }}
      pointerEvents="box-none"
    >
      <NativeSheet
        isPresented={open}
        onDismiss={onDismiss}
        snapPoints={["half", "full"]}
        containerColor={colors.surface}
        contentPadding={0}
      >
        <RNHostView>
          <ScrollView
            style={{ flex: 1, backgroundColor: colors.surface }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 24 }}
          >
            <View style={{ gap: 2 }}>
              <Text variant="heading" accessibilityRole="header">
                {title}
              </Text>
              {subtitle && (
                <Text variant="caption" secondary>
                  {subtitle}
                </Text>
              )}
            </View>
            <View style={{ gap: 16 }}>{children}</View>
            {done && <Button label="Done" onPress={onDismiss} />}
          </ScrollView>
        </RNHostView>
      </NativeSheet>
    </Host>
  );
}
