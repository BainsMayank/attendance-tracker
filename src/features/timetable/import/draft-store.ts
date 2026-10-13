import { create } from "zustand";
export const useImportDraft = create<{
  raw: string;
  semesterId: string | null;
  set: (raw: string, semesterId: string | null) => void;
}>((set) => ({
  raw: "",
  semesterId: null,
  set: (raw, semesterId) => set({ raw, semesterId }),
}));
