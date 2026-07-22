<script lang="ts">
  let { subtitle = '', compact = false } = $props<{
    subtitle?: string;
    compact?: boolean;
  }>();
</script>

<div class="text-center {compact ? 'mb-6' : 'mb-8'}">
  <img
    src="/logo-d20.svg"
    alt=""
    aria-hidden="true"
    width={compact ? 52 : 72}
    height={compact ? 52 : 72}
    class="mx-auto"
  />
  <h1 class="mt-3 font-bold text-white {compact ? 'text-xl' : 'text-2xl'}">DnD Recorder</h1>
  {#if subtitle}
    <p class="mt-1 text-sm text-gray-400">{subtitle}</p>
  {/if}
</div>
