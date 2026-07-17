<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.js';

  const { isAuthenticated, loading } = auth;

  onMount(() => {
    const unsubscribe = loading.subscribe((isLoading) => {
      if (!isLoading) goto($isAuthenticated ? '/dashboard' : '/login');
    });
    return unsubscribe;
  });
</script>

<svelte:head><title>DM Recorder</title></svelte:head>
