<script lang="ts">
  import Dialog from '$lib/components/Dialog.svelte';
  import { confirmationRequest, resolveConfirmation } from '$lib/confirm.js';
</script>

{#if $confirmationRequest}
  <Dialog title={$confirmationRequest.title} titleId="global-confirmation-title" onClose={() => resolveConfirmation(false)} maxWidth="max-w-md">
    <p class="text-sm leading-relaxed text-gray-200">{$confirmationRequest.message}</p>
    <div class="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" onclick={() => resolveConfirmation(false)}
        class="min-h-11 rounded-lg px-4 py-2 text-gray-200 hover:bg-surface-700">Abbrechen</button>
      <button type="button" onclick={() => resolveConfirmation(true)}
        class="min-h-11 rounded-lg px-4 py-2 font-medium text-white {$confirmationRequest.danger ? 'bg-red-700 hover:bg-red-600' : 'bg-brand-600 hover:bg-brand-500'}">
        {$confirmationRequest.confirmLabel}
      </button>
    </div>
  </Dialog>
{/if}
