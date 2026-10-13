import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Choice, Editor, ErrorText, Field, useSave } from "@/features/timetable/form-controls";
import { createFolder, editEntry, fileData } from "@/db/repositories/file-commands";
import { breadcrumbs, descendantIds } from "./model";
import { invalidateFiles } from "./events";
import { Text } from "@/ui";

export default function FileEditorScreen() {
  const params = useLocalSearchParams<{ semesterId: string; subjectId: string; id?: string; kind: "file" | "folder"; action: "create" | "rename" | "move"; parentId?: string }>();
  const scope = { semesterId: params.semesterId, subjectId: params.subjectId };
  const [initial] = useState(() => {
    try {
      const data = fileData(scope), row = params.kind === "file" ? data.files.find(f => f.id === params.id) : data.folders.find(f => f.id === params.id);
      if (params.action !== "create" && !row) throw new Error("This item is no longer available.");
      return { data, row, error: "" };
    } catch (error) { return { data: { files: [], folders: [] }, row: undefined, error: error instanceof Error ? error.message : "Item unavailable" }; }
  });
  const originalParent = initial.row ? "parentId" in initial.row ? initial.row.parentId : initial.row.folderId : params.parentId || null;
  const [name, setName] = useState(initial.row?.name ?? ""), [parent, setParent] = useState(originalParent ?? "");
  const mutation = useSave();
  const forbidden = params.kind === "folder" && params.id ? descendantIds(initial.data.folders, params.id) : new Set<string>();
  const destinations = [{ value: "", label: "All files" }, ...initial.data.folders.filter(f => !forbidden.has(f.id)).map(f => ({ value: f.id, label: breadcrumbs(initial.data.folders, f.id).map(p => p.name).join(" / ") }))];
  const dirty = name !== (initial.row?.name ?? "") || parent !== (originalParent ?? "");
  const title = params.action === "create" ? "New folder" : params.action === "move" ? "Move to folder" : "Rename";
  return <Editor title={title} busy={mutation.busy} dirty={dirty && !mutation.done} primaryAction={{ label: "Save", loading: mutation.busy, disabled: !!initial.error || !name.trim() || (params.action !== "create" && !dirty), onPress: () => void mutation.save(() => {
    const saved = params.action === "create" ? createFolder(scope, parent || null, name) : editEntry(scope, params.kind, initial.row!, name, parent || null);
    invalidateFiles();
    return { undo: () => { saved.undo(); invalidateFiles(); } };
  }, params.action === "create" ? "Folder created" : params.action === "move" ? "Moved" : "Renamed") }}>
    <ErrorText message={initial.error || mutation.error} />
    {params.action === "move" ? <Text selectable>{name}</Text> : <Field label={params.kind === "file" ? "File name (include extension)" : "Folder name"} value={name} onChangeText={setName} autoFocus autoCapitalize="sentences" />}
    {params.action !== "rename" && <Choice label="Destination folder" value={parent} options={destinations} onChange={setParent} />}
    <Text secondary>Files stay within this subject. Moving or renaming keeps the saved file intact.</Text>
  </Editor>;
}
