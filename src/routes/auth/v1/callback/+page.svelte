<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  onMount(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      goto('/');
    } else if (error) {
        console.error('Auth error:', error);
        // Optionally redirect to login page or show error
        goto('/'); 
    } else {
        // Give Supabase a moment to process the hash if getSession didn't catch it immediately
        // implicit flow sometimes needs the client to process the URL first
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || session) {
                goto('/');
            }
        });
        
        // Fallback if nothing happens
        setTimeout(() => {
            goto('/');
        }, 2000);

        return () => {
            subscription.unsubscribe();
        };
    }
  });
</script>

<div class="container">
  <div class="loading">
    <div class="spinner"></div>
    <p>Verifying login...</p>
  </div>
</div>

<style>
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f8f9fa;
  }

  .loading {
    text-align: center;
    color: #666;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4285f4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>