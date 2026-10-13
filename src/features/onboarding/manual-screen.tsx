import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import { Button, HeaderActions } from "@/ui";
import { TimetableScreen } from "@/features/timetable/timetable-screen";

export function ManualSetupScreen() {
  const finish = () => router.dismissTo("/onboarding");
  return (
    <>
      {process.env.EXPO_OS === "web" ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <Button
                label="Finish setup"
                variant="secondary"
                onPress={finish}
              />
            ),
          }}
        />
      ) : (
        <HeaderActions
          right={[{ label: "Finish setup", prominent: true, onPress: finish }]}
        />
      )}
      <TimetableScreen setup />
    </>
  );
}
