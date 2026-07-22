import { writable } from "svelte/store";

export type ToastKind = "success" | "error" | "info";
export type ToastMessage = { id: number; kind: ToastKind; message: string };

const messages = writable<ToastMessage[]>([]);
let nextId = 1;

function show(message: string, kind: ToastKind = "info", durationMs = 5000): number {
  const id = nextId++;
  messages.update((items) => [...items, { id, kind, message }]);
  if (durationMs > 0) setTimeout(() => dismiss(id), durationMs);
  return id;
}

function dismiss(id: number): void {
  messages.update((items) => items.filter((item) => item.id !== id));
}

export const toast = {
  messages,
  dismiss,
  success: (message: string) => show(message, "success"),
  error: (message: string) => show(message, "error", 7000),
  info: (message: string) => show(message, "info")
};
