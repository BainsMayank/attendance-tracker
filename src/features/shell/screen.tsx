import { ScrollView, View } from "react-native";
import type { PropsWithChildren } from "react";
import { GradientBackground } from "@/ui";
export function Screen({ children }: PropsWithChildren) {
  return (
    <GradientBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 48,
          gap: 24,
          flexGrow: 1,
        }}
      >
        <View
          style={{ width: "100%", maxWidth: 680, alignSelf: "center", gap: 24 }}
        >
          {children}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}
