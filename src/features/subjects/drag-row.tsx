import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Button, Text, useTheme } from "@/ui";
import { ToolIcon, RowActions } from "./content-ui";

export function DragRow({
  children,
  label,
  onDrop,
  onMove,
  first,
  last,
  onDragging,
  onHeight,
}: PropsWithChildren<{
  label: string;
  onDrop: (distance: number) => void;
  onMove: (direction: -1 | 1) => void;
  first: boolean;
  last: boolean;
  onDragging: (active: boolean) => void;
  onHeight: (height: number) => void;
}>) {
  const { reduceMotion, colors } = useTheme();
  const y = useSharedValue(0),
    active = useSharedValue(false);
  const pan = Gesture.Pan()
    .activateAfterLongPress(250)
    .onStart(() => {
      active.set(true);
      scheduleOnRN(onDragging, true);
    })
    .onUpdate((event) => {
      y.set(event.translationY);
    })
    .onEnd((event) => {
      scheduleOnRN(onDrop, event.translationY);
    })
    .onFinalize(() => {
      active.set(false);
      y.set(
        reduceMotion ? 0 : withSpring(0, { duration: 400, dampingRatio: 0.8 }),
      );
      scheduleOnRN(onDragging, false);
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
    zIndex: active.get() ? 10 : 0,
    opacity: active.get() ? 0.92 : 1,
  }));
  return (
    <Animated.View
      style={style}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 12,
          backgroundColor: colors.surface,
          padding: 12,
          gap: 8,
        }}
      >
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityLabel={`Drag to reorder ${label}`}
            accessibilityHint="Long press and drag. Move up and Move down buttons are also available."
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ToolIcon kind="grip" />
            <Text secondary>Hold to drag</Text>
          </View>
        </GestureDetector>
        {children}
        <RowActions>
          <Button
            label="Move up"
            accessibilityLabel={`Move ${label} up`}
            variant="secondary"
            disabled={first}
            onPress={() => onMove(-1)}
          />
          <Button
            label="Move down"
            accessibilityLabel={`Move ${label} down`}
            variant="secondary"
            disabled={last}
            onPress={() => onMove(1)}
          />
        </RowActions>
      </View>
    </Animated.View>
  );
}
