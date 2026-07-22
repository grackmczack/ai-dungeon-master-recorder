import { get, writable } from "svelte/store";

export type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
};

const request = writable<Confirmation | null>(null);

export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    request.set({
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? "Bestätigen",
      danger: options.danger ?? false,
      resolve
    });
  });
}

export function resolveConfirmation(value: boolean): void {
  const current = get(request);
  request.set(null);
  current?.resolve(value);
}

export const confirmationRequest = { subscribe: request.subscribe };
