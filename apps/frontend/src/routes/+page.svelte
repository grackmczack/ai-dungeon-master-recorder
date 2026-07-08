<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.js';

  const { isAuthenticated } = auth;

  onMount(() => {
    if ($isAuthenticated) goto('/dashboard');
    else goto('/login');
  });
</script>
