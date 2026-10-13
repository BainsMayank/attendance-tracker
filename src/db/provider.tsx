import { useEffect, useState, type PropsWithChildren } from "react";
import { View } from "react-native";
import { attachments, startFileRecovery } from "@/features/files/service";
import { semesterCleanup } from "@/features/semesters/cleanup-service";
import { recoverPendingPicker } from "@/features/files/pickers";
import { initializeDatabase } from "./client";
import { validateDatabase } from "./validation";
import { syncAppearance } from "@/features/settings/preferences";
import { Button, GradientBackground, Skeleton, Text } from "@/ui";
export function DatabaseProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void initializeDatabase()
      .then(async (db) => {
        validateDatabase(db);
        syncAppearance();
        if (process.env.EXPO_OS !== "web") {
          const cleanup = await semesterCleanup.recover();
          if (cleanup.length)
            throw new Error("Semester attachment cleanup needs retry.");
          await attachments.recover(true);
          await recoverPendingPicker();
        }
        if (alive) setState("ready");
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
          setState("error");
        }
      });
    return () => {
      alive = false;
    };
  }, [attempt]);
  useEffect(
    () => (state === "ready" ? startFileRecovery() : undefined),
    [state],
  );
  if (state !== "ready")
    return (
      <GradientBackground>
        <View
          style={{ flex: 1, justifyContent: "center", padding: 24, gap: 24 }}
        >
          <Text variant="heading" accessibilityRole="header">
            {state === "loading"
              ? "Opening your workspace"
              : "Could not open your workspace"}
          </Text>
          {state === "loading" ? (
            <>
              <Skeleton height={24} width="70%" />
              <Skeleton height={16} />
            </>
          ) : (
            <>
              <Text secondary>
                Your saved database is preserved. Retry opening it.
              </Text>
              <Text selectable accessibilityLiveRegion="assertive">
                {error}
              </Text>
              <Button
                label="Retry"
                onPress={() => {
                  setState("loading");
                  setAttempt((n) => n + 1);
                }}
              />
            </>
          )}
        </View>
      </GradientBackground>
    );
  return children;
}
