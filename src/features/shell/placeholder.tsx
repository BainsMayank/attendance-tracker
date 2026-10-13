import { EmptyState, GlassCard, Text } from "@/ui";
import { Screen } from "./screen";
export function Placeholder({
  area,
}: {
  area: "Subjects" | "Daily Log" | "Timetable";
}) {
  const copy = {
    Subjects: [
      "Your semester, in focus",
      "Subjects and attendance summaries will appear here.",
    ],
    "Daily Log": [
      "One day at a time",
      "Your scheduled classes and attendance records will appear here.",
    ],
    Timetable: [
      "Make room for your week",
      "Your weekly schedule and timetable versions will appear here.",
    ],
  }[area];
  return (
    <Screen>
      <Text variant="secondary" secondary>
        Attendance Tracker
      </Text>
      <GlassCard solid>
        <EmptyState
          title={copy[0]}
          message={copy[1]}
          icon={{
            ios: area === "Subjects" ? "books.vertical" : "calendar",
            android: area === "Subjects" ? "menu_book" : "calendar_month",
            web: "calendar_month",
          }}
        />
      </GlassCard>
      <Text secondary variant="secondary">
        Your workspace is ready. This screen is a foundation placeholder.
      </Text>
    </Screen>
  );
}
