<script lang="ts">
  import { toast } from '$lib/toast.js';
  const { messages } = toast;

  const styles = {
    success: 'border-green-500/40 bg-green-950/95 text-green-100',
    error: 'border-red-500/40 bg-red-950/95 text-red-100',
    info: 'border-brand-500/40 bg-surface-800/95 text-white'
  };
</script>

<div class="pointer-events-none fixed inset-x-4 top-20 z-[100] flex flex-col items-end gap-3 sm:left-auto sm:w-96"
  aria-live="polite" aria-atomic="false">
  {#each $messages as item (item.id)}
    <div class="pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur {styles[item.kind]}"
      role={item.kind === 'error' ? 'alert' : 'status'}>
      <span class="mt-0.5" aria-hidden="true">{item.kind === 'success' ? '✓' : item.kind === 'error' ? '!' : 'ℹ'}</span>
      <p class="min-w-0 flex-1 text-sm leading-relaxed">{item.message}</p>
      <button type="button" onclick={() => toast.dismiss(item.id)} aria-label="Hinweis schließen"
        class="min-h-6 min-w-6 rounded text-current opacity-70 hover:opacity-100">×</button>
    </div>
  {/each}
</div>
