import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { router, useFocusEffect } from "expo-router";
import { attachmentRepository, fileData } from "@/db/repositories/file-commands";
import {
  ActionButton,
  BottomSheet,
  FilterChip,
  GradientBackground,
  Icon,
  RoundButton,
  Text,
  contentStyle,
  haptic,
  icons,
  toneColors,
  useTheme,
  useToast,
  type IconName,
  type Tone,
} from "@/ui";
import { ErrorText } from "@/features/timetable/form-controls";
import { attachments, localFile, shareFile } from "./service";
import {
  breadcrumbs,
  bytesLabel,
  descendantIds,
  type FileRow,
  type FolderRow,
  type Scope,
  type Snapshot,
} from "./model";
import { invalidateFiles, subscribeFiles } from "./events";
import { pickSources } from "./pickers";

type Entry = { kind: "folder"; row: FolderRow } | { kind: "file"; row: FileRow };
type Source = "documents" | "photos" | "camera";
const RECENT = 8;

export function SubjectFilesBrowser({
  scope,
  subjectName,
  readOnly,
  header,
}: {
  scope: Scope;
  subjectName: string;
  readOnly: boolean;
  header: ReactNode;
}) {
  const { colors, scheme } = useTheme(),
    toast = useToast();
  const [data, setData] = useState<Snapshot>({ files: [], folders: [] });
  const [folder, setFolder] = useState<string | null>(null),
    [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false),
    [dest, setDest] = useState<string | null>(null),
    [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const lock = useRef(false),
    cancel = useRef(false);
  const reload = useCallback(() => {
    try {
      const next = fileData(scope);
      // Missing files stay visible and recoverable; their bytes do not count as storage.
      for (const row of next.files)
        if (row.state === "ready" && !localFile(row.relativePath).exists) {
          attachmentRepository.state(row.id, "missing");
          row.state = "missing";
        }
      setData(next);
      setFolder((current) =>
        current && !next.folders.some((f) => f.id === current) ? null : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load files");
    } finally {
      setLoading(false);
    }
    // Scope values, not the caller's object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.semesterId, scope.subjectId]);
  useFocusEffect(reload);
  useEffect(() => subscribeFiles(reload), [reload]);
  const mutate = async (
    operation: () => Promise<{ undo?: () => unknown | Promise<unknown> } | void>,
    message?: string,
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      invalidateFiles();
      if (message) {
        void haptic("success");
        toast({
          message,
          undo: result?.undo
            ? async () => {
                await result.undo!();
                invalidateFiles();
              }
            : undefined,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "File operation failed");
      void haptic("error");
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress("");
    }
  };
  const edit = (entry?: Entry, action = "rename", parent = folder) =>
    router.push({
      pathname: "/file-editor",
      params: {
        ...scope,
        kind: entry?.kind ?? "folder",
        id: entry?.row.id,
        action: entry ? action : "create",
        parentId: parent ?? "",
      },
    });
  const importSources = (source: Source, target: string | null) =>
    void mutate(async () => {
      attachmentRepository.assertWritable(scope);
      cancel.current = false;
      const selected = await pickSources(source, scope, target);
      let count = 0,
        duplicates = 0;
      const failures: string[] = [],
        saved: FileRow[] = [];
      for (let i = 0; i < selected.length && !cancel.current; i++) {
        setProgress(`Saving ${i + 1} of ${selected.length} · ${selected[i].name}`);
        try {
          const row = await attachments.importFile(scope, target, selected[i]);
          saved.push(row);
          count++;
          if (
            data.files.some((f) => f.sha256 === row.sha256) ||
            saved.slice(0, -1).some((f) => f.sha256 === row.sha256)
          )
            duplicates++;
          invalidateFiles();
        } catch (e) {
          failures.push(
            `${selected[i].name}: ${e instanceof Error ? e.message : "Copy failed"}`,
          );
        }
      }
      if (count) {
        void haptic("success");
        toast({
          message: `${count} ${count === 1 ? "file" : "files"} saved${duplicates ? ` · ${duplicates} duplicate copies kept` : ""}`,
          undo: async () => {
            // Guard each imported item; later edits are never silently discarded by Undo.
            const current = fileData(scope);
            if (
              saved.some(
                (row) =>
                  !current.files.some(
                    (f) => f.id === row.id && f.revision === row.revision,
                  ),
              )
            )
              throw new Error("Imported files changed. Newer data was preserved.");
            for (const row of saved)
              await attachments.deleteEntry(scope, "file", row.id);
            invalidateFiles();
          },
        });
      }
      if (failures.length)
        setError(`${count} saved. ${failures.join("\n")} Retry failed files from +.`);
    });
  const act = (entry: Entry, action: string) => {
    if (action === "share" && entry.kind === "file") {
      void mutate(() => shareFile(entry.row));
      return;
    }
    if (action !== "delete") {
      edit(entry, action);
      return;
    }
    const ids = descendantIds(data.folders, entry.row.id),
      count =
        entry.kind === "file"
          ? 1
          : data.files.filter((f) => f.folderId && ids.has(f.folderId)).length;
    Alert.alert(
      `Delete “${entry.row.name}”?`,
      `${count} ${count === 1 ? "file" : "files"}${entry.kind === "folder" ? " and its nested folders" : ""} will be removed. Undo is available briefly after deletion.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void mutate(
              () => attachments.deleteEntry(scope, entry.kind, entry.row.id),
              "Deleted",
            ),
        },
      ],
    );
  };
  const menu = (entry: Entry): MenuAction[] =>
    [
      ...(!readOnly
        ? [
            { id: "rename", title: "Rename", image: "pencil" as const },
            { id: "move", title: "Move to folder", image: "folder" as const },
            {
              id: "delete",
              title: "Delete",
              image: "trash" as const,
              attributes: { destructive: true },
            },
          ]
        : []),
      ...(entry.kind === "file"
        ? [{ id: "share", title: "Share", image: "square.and.arrow.up" as const }]
        : []),
    ].map((a) => ({ ...a, attributes: { ...a.attributes, disabled: busy } }));
  const openSheet = () => {
    setDest(folder);
    setSheet(true);
  };
  const choose = (action: Source | "folder") => {
    setSheet(false);
    // Let the sheet finish dismissing before presenting a system picker or route.
    setTimeout(() => {
      if (action === "folder") edit(undefined, "create", dest);
      else importSources(action, dest);
    }, 450);
  };

  const search = query.trim().toLocaleLowerCase();
  const countIn = (id: string) => {
    const ids = descendantIds(data.folders, id);
    return (
      data.files.filter((f) => f.folderId && ids.has(f.folderId)).length +
      data.folders.filter((f) => f.parentId === id).length
    );
  };
  const folderName = (id: string | null) =>
    id ? (data.folders.find((f) => f.id === id)?.name ?? "") : "";
  const subfolders = search
    ? []
    : data.folders
        .filter((f) => f.parentId === folder)
        .sort((a, b) => a.name.localeCompare(b.name));
  const filesHere = search
    ? data.files.filter((f) => f.name.toLocaleLowerCase().includes(search))
    : folder
      ? data.files.filter((f) => f.folderId === folder)
      : [...data.files].sort((a, b) => b.createdAt - a.createdAt);
  const folderMatches = search
    ? data.folders.filter((f) => f.name.toLocaleLowerCase().includes(search))
    : [];
  const listed: Entry[] = [
    ...folderMatches.map((row) => ({ kind: "folder" as const, row })),
    ...(folder || search || showAll ? filesHere : filesHere.slice(0, RECENT)).map(
      (row) => ({ kind: "file" as const, row }),
    ),
  ];
  const path = breadcrumbs(data.folders, folder);
  const stored = data.files
    .filter((f) => f.state === "ready")
    .reduce((n, f) => n + f.sizeBytes, 0);

  const section = (label: string) => (
    <Text
      accessibilityRole="header"
      variant="caption"
      secondary
      style={{
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        marginHorizontal: 4,
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  );
  const folderCard = (f: FolderRow) => (
    <MenuView
      key={f.id}
      shouldOpenOnLongPress
      title={f.name}
      colorScheme={scheme}
      actions={menu({ kind: "folder", row: f })}
      onPressAction={({ nativeEvent }) =>
        act({ kind: "folder", row: f }, nativeEvent.event)
      }
      style={{ width: "48%", flexGrow: 1 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${f.name} folder, ${countIn(f.id)} items`}
        accessibilityHint="Long press for folder options"
        disabled={busy}
        onPress={() => {
          setFolder(f.id);
          setQuery("");
        }}
        style={({ pressed }) => ({
          minHeight: 112,
          gap: 10,
          padding: 14,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.accentSubtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icons.folder} size={20} color={colors.accent} />
        </View>
        <View>
          <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: "600" }} numberOfLines={2}>
            {f.name}
          </Text>
          <Text variant="caption" secondary>
            {countIn(f.id)} {countIn(f.id) === 1 ? "item" : "items"}
          </Text>
        </View>
      </Pressable>
    </MenuView>
  );
  const top = (
    <View style={{ gap: 16, marginBottom: 12 }}>
      {header}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <Icon name={icons.search} size={16} color={colors.textSecondary} />
          <TextInput
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            accessibilityLabel="Search files"
            placeholder={`Search ${data.files.length} ${data.files.length === 1 ? "file" : "files"}`}
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{ flex: 1, minHeight: 40, fontSize: 16, color: colors.textPrimary }}
          />
        </View>
        {!readOnly && (
          <RoundButton
            icon={icons.plus}
            label="Add files or folder"
            disabled={busy}
            onPress={openSheet}
          />
        )}
      </View>
      {!!folder && !search && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
          {[{ id: null as string | null, name: "All files" }, ...path].map((f, i, all) => (
            <View key={f.id ?? "root"} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {i > 0 && <Icon name={icons.chevronRight} size={12} color={colors.textSecondary} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${f.name}`}
                disabled={busy || i === all.length - 1}
                onPress={() => setFolder(f.id)}
                style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: i === all.length - 1 ? colors.textPrimary : colors.accent,
                  }}
                >
                  {f.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {readOnly && (
        <Text variant="caption" secondary>
          Archived · files can be viewed and shared.
        </Text>
      )}
      {busy && (
        <View style={{ gap: 8, alignItems: "flex-start" }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityIndicator color={colors.accent} />
            <Text accessibilityLiveRegion="polite">{progress || "Working…"}</Text>
          </View>
          {!!progress && (
            <ActionButton
              label="Stop after this file"
              variant="tonal"
              onPress={() => {
                cancel.current = true;
              }}
            />
          )}
        </View>
      )}
      <ErrorText message={error} />
      {!!error && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton label="Reload" variant="tonal" style={{ flex: 1 }} onPress={reload} />
          <ActionButton
            label="Open Settings"
            variant="tonal"
            style={{ flex: 1 }}
            onPress={() => {
              void Linking.openSettings().catch(() =>
                setError("Could not open Settings. Open it from your home screen."),
              );
            }}
          />
        </View>
      )}
      {!search && (subfolders.length > 0 || !readOnly) && (
        <>
          {section(folder ? "Folders" : "Folders")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {subfolders.map(folderCard)}
            {!readOnly && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New folder"
                disabled={busy}
                onPress={() => edit()}
                style={({ pressed }) => ({
                  width: "48%",
                  flexGrow: 1,
                  minHeight: 112,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: colors.separator,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon name={icons.folderAdd} color={colors.accent} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.accent }}>
                  New folder
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}
      {section(search ? "Results" : folder ? folderName(folder) || "Files" : "Recent")}
    </View>
  );
  return (
    <GradientBackground>
      <FlatList
        data={listed}
        keyExtractor={(e) => `${e.kind}-${e.row.id}`}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={contentStyle}
        ListHeaderComponent={top}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 20,
                gap: 6,
              }}
            >
              <Text style={{ fontWeight: "600" }}>
                {search ? "No matching files" : folder ? "This folder is empty" : "A place for course material"}
              </Text>
              <Text variant="secondary" secondary>
                {search
                  ? "Search covers every folder in this subject."
                  : "Add lecture slides, handouts or photos of the board with +."}
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <FileRowView
            entry={item}
            first={index === 0}
            last={index === listed.length - 1}
            meta={metaFor(item, data, !!search || !folder)}
            busy={busy}
            actions={menu(item)}
            onAction={(a) => act(item, a)}
            onOpen={() =>
              item.kind === "folder"
                ? (setFolder(item.row.id), setQuery(""))
                : router.push({
                    pathname: "/file-preview",
                    params: { ...scope, fileId: item.row.id },
                  })
            }
          />
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 16 }}>
            {!folder && !search && filesHere.length > RECENT && (
              <ActionButton
                label={showAll ? "Show recent only" : `Show all ${filesHere.length} files`}
                variant="tonal"
                onPress={() => setShowAll(!showAll)}
              />
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
              <Icon name={icons.iphone} size={16} color={colors.textSecondary} />
              <Text variant="caption" secondary style={{ flex: 1 }}>
                Stored on this device · {bytesLabel(stored)} · included in app backups when you choose “with files”
              </Text>
            </View>
          </View>
        }
      />
      <BottomSheet
        open={sheet}
        onDismiss={() => setSheet(false)}
        title="Add to subject"
        subtitle={subjectName}
        done={false}
      >
        <View style={{ marginHorizontal: -8 }}>
          {(
            [
              ["documents", icons.doc, "Documents", "PDFs, slides and docs from the Files app"],
              ["photos", icons.photo, "Photo Library", "Photos of notes, boards or handouts"],
              ["camera", icons.camera, "Camera", "Take a photo of a page or the board"],
              ["folder", icons.folderAdd, "New Folder", "Group files by unit, assignment or exam"],
            ] as [Source | "folder", IconName, string, string][]
          ).map(([id, icon, title, detail], i) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${detail}`}
              onPress={() => choose(id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                minHeight: 72,
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderTopWidth: i ? 0.5 : 0,
                borderTopColor: colors.separator,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.accentSubtle,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={icon} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: "600" }}>{title}</Text>
                <Text variant="caption" secondary>
                  {detail}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ gap: 10 }}>
          <Text variant="caption" secondary>
            Save into
          </Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[{ id: null as string | null, label: "All files" }, ...data.folders.map((f) => ({
              id: f.id as string | null,
              label: breadcrumbs(data.folders, f.id).map((p) => p.name).join(" / "),
            }))].map((d) => (
              <FilterChip
                key={d.id ?? "root"}
                label={d.label}
                variant="choice"
                selected={dest === d.id}
                onPress={() => setDest(d.id)}
              />
            ))}
          </View>
        </View>
        <ActionButton label="Cancel" variant="tonal" onPress={() => setSheet(false)} />
      </BottomSheet>
    </GradientBackground>
  );
}

function fileBadge(row: FileRow): { label: string; tone: Tone } {
  const ext = row.name.split(".").pop()?.toUpperCase() ?? "";
  if (row.mimeType === "application/pdf" || ext === "PDF") return { label: "PDF", tone: "bad" };
  if (row.mimeType.startsWith("image/"))
    return { label: ext && ext.length <= 4 ? ext : "IMG", tone: "accent" };
  if (["DOC", "DOCX", "PPT", "PPTX", "XLS", "XLSX", "TXT", "KEY", "PAGES"].includes(ext))
    return { label: ext.slice(0, 4), tone: "neutral" };
  if (["C", "CPP", "PY", "JAVA", "JS", "TS", "HTML", "IPYNB", "SQL"].includes(ext))
    return { label: ext.slice(0, 4), tone: "ok" };
  return { label: ext ? ext.slice(0, 4) : "FILE", tone: "neutral" };
}
function relativeDate(time: number) {
  const day = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
  const diff = day(Date.now()) - day(time);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(time);
}
function metaFor(entry: Entry, data: Snapshot, withFolder: boolean) {
  if (entry.kind === "folder")
    return breadcrumbs(data.folders, entry.row.parentId).map((f) => f.name).join(" / ") || "Folder";
  const row = entry.row;
  const where = withFolder && row.folderId
    ? breadcrumbs(data.folders, row.folderId).map((f) => f.name).join(" / ")
    : "";
  return [where, bytesLabel(row.sizeBytes), relativeDate(row.createdAt)].filter(Boolean).join(" · ");
}
function FileRowView({
  entry,
  first,
  last,
  meta,
  busy,
  actions,
  onAction,
  onOpen,
}: {
  entry: Entry;
  first: boolean;
  last: boolean;
  meta: string;
  busy: boolean;
  actions: MenuAction[];
  onAction: (action: string) => void;
  onOpen: () => void;
}) {
  const { colors, scheme } = useTheme();
  const file = entry.kind === "file" ? entry.row : null;
  const badge = file ? fileBadge(file) : { label: "", tone: "accent" as Tone };
  const c = toneColors(colors, badge.tone);
  const problem = file && file.state !== "ready";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingVertical: 10,
        paddingLeft: 14,
        paddingRight: 4,
        backgroundColor: colors.surface,
        borderTopLeftRadius: first ? 16 : 0,
        borderTopRightRadius: first ? 16 : 0,
        borderBottomLeftRadius: last ? 16 : 0,
        borderBottomRightRadius: last ? 16 : 0,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.separator,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.row.name}, ${problem ? file!.state : meta}`}
        disabled={busy}
        onPress={onOpen}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: c.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {file ? (
            <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.3, color: c.fg }}>
              {badge.label}
            </Text>
          ) : (
            <Icon name={icons.folder} size={20} color={colors.accent} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 21, fontWeight: "500" }}>
            {entry.row.name}
          </Text>
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: problem ? colors.warning : colors.textSecondary }}
          >
            {problem
              ? file!.state === "missing"
                ? "Missing · import again"
                : `${file!.state} · reload to recover`
              : meta}
          </Text>
        </View>
      </Pressable>
      {actions.length > 0 && (
        <MenuView
          title={entry.row.name}
          colorScheme={scheme}
          actions={actions}
          onPressAction={({ nativeEvent }) => onAction(nativeEvent.event)}
        >
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`More options for ${entry.row.name}`}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name={icons.ellipsis} size={18} color={colors.textSecondary} />
          </View>
        </MenuView>
      )}
    </View>
  );
}
