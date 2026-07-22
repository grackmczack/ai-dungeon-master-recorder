<script lang="ts">
  let { title, eyebrow, updated = '20. Juli 2026', children } = $props<{
    title: string;
    eyebrow: string;
    updated?: string;
    children: import('svelte').Snippet;
  }>();
</script>

<div class="min-h-screen bg-surface-900 px-4 py-10 sm:px-6 sm:py-14">
  <div class="mx-auto max-w-4xl">
    <a href="/" class="inline-flex min-h-11 items-center gap-2 text-sm text-gray-300 hover:text-white">← Zur Startseite</a>
    <header class="mt-6 rounded-2xl border border-brand-500/20 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,.2),transparent_45%)] p-6 sm:p-10">
      <p class="text-xs font-bold uppercase tracking-[.18em] text-violet-300">{eyebrow}</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      <p class="mt-3 text-sm text-gray-300">Stand: {updated}</p>
    </header>

    <article class="legal-copy mt-6 rounded-2xl border border-surface-600 bg-surface-800 p-6 sm:p-10">
      {@render children()}
    </article>
  </div>
</div>

<style>
  .legal-copy :global(h2) { margin-top: 2.5rem; font-size: 1.35rem; font-weight: 700; color: white; scroll-margin-top: 6rem; }
  .legal-copy :global(h2:first-child) { margin-top: 0; }
  .legal-copy :global(h3) { margin-top: 1.5rem; font-size: 1.05rem; font-weight: 650; color: #f3f4f6; }
  .legal-copy :global(p), .legal-copy :global(li) { margin-top: .75rem; line-height: 1.75; color: #cbd0da; }
  .legal-copy :global(ul) { margin-top: .75rem; padding-left: 1.35rem; list-style: disc; }
  .legal-copy :global(a) { color: #c4b5fd; text-decoration: underline; text-underline-offset: 3px; }
  .legal-copy :global(code) { border-radius: .25rem; background: #252540; padding: .1rem .3rem; color: #ddd6fe; }
  .legal-copy :global(.notice) { margin-top: 1.5rem; border: 1px solid rgba(139,92,246,.3); border-radius: .75rem; background: rgba(139,92,246,.08); padding: 1rem; }
</style>
