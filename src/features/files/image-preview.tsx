import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Button, Text } from "@/ui";
export function ImagePreview({ uri, name }: { uri: string; name: string }) {
  const scale = useSharedValue(1), baseScale = useSharedValue(1), x = useSharedValue(0), y = useSharedValue(0), baseX = useSharedValue(0), baseY = useSharedValue(0);
  const [bounds, setBounds] = useState({ width: 1, height: 1 }), [error, setError] = useState("");
  const pinch = Gesture.Pinch().onStart(() => { baseScale.set(scale.get()); }).onUpdate(e => { scale.set(Math.max(1, Math.min(5, baseScale.get() * e.scale))); x.set(0); y.set(0); });
  const pan = Gesture.Pan().maxPointers(1).onStart(() => { baseX.set(x.get()); baseY.set(y.get()); }).onUpdate(e => {
    const limitX = bounds.width * (scale.get() - 1) / 2, limitY = bounds.height * (scale.get() - 1) / 2;
    x.set(Math.max(-limitX, Math.min(limitX, baseX.get() + e.translationX))); y.set(Math.max(-limitY, Math.min(limitY, baseY.get() + e.translationY)));
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  return <View style={{ flex: 1, gap: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16 }}>
      <Button label="Zoom in" variant="secondary" onPress={() => { scale.set(Math.min(5, scale.get() + .5)); }} />
      <Button label="Zoom out" variant="secondary" onPress={() => { scale.set(Math.max(1, scale.get() - .5)); x.set(0); y.set(0); }} />
      <Button label="Reset" variant="secondary" onPress={() => { scale.set(1); x.set(0); y.set(0); }} />
    </View>
    {!!error && <Text selectable>{error}</Text>}
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}><View onLayout={e => setBounds(e.nativeEvent.layout)} style={{ flex: 1, overflow: "hidden" }}><Animated.View style={[{ flex: 1 }, style]}><Image source={{ uri }} accessibilityLabel={name} contentFit="contain" style={{ flex: 1 }} onError={() => setError("This image could not be decoded. Try Share to open it in another app.")} /></Animated.View></View></GestureDetector>
  </View>;
}
