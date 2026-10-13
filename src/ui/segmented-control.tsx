import NativeSegments from "@expo/ui/community/segmented-control";
import { useTheme } from "./theme-provider";
export function SegmentedControl<T extends string>({
  values,
  value,
  onChange,
  disabled = false,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const { scheme, colors } = useTheme();
  return (
    <NativeSegments
      values={[...values]}
      selectedIndex={values.indexOf(value)}
      enabled={!disabled}
      onChange={(event) =>
        onChange(values[event.nativeEvent.selectedSegmentIndex])
      }
      appearance={scheme}
      tintColor={colors.accent}
      style={{ minHeight: 48 }}
    />
  );
}
