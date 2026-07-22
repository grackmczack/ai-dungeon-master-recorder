<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  let {
    title,
    titleId,
    onClose,
    children,
    maxWidth = 'max-w-lg'
  }: {
    title: string;
    titleId: string;
    onClose: () => void;
    children: Snippet;
    maxWidth?: string;
  } = $props();

  let dialog: HTMLDivElement;

  function focusableElements(): HTMLElement[] {
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => !element.hasAttribute('hidden'));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const elements = focusableElements();
    if (elements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => (focusableElements()[0] ?? dialog)?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  });
</script>

<div class="fixed inset-0 z-[80] flex items-center justify-center p-4">
  <button type="button" class="absolute inset-0 cursor-default bg-black/70" onclick={onClose}
    aria-label="Dialog schließen"></button>
  <div bind:this={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabindex="-1"
    onkeydown={handleKeydown}
    class="relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-surface-600 bg-surface-800 p-6 shadow-2xl {maxWidth}">
    <div class="mb-5 flex items-start justify-between gap-4">
      <h2 id={titleId} class="text-xl font-semibold text-white">{title}</h2>
      <button type="button" onclick={onClose} aria-label="Dialog schließen"
        class="min-h-10 min-w-10 rounded-lg text-xl text-gray-400 hover:bg-surface-700 hover:text-white">×</button>
    </div>
    {@render children()}
  </div>
</div>
