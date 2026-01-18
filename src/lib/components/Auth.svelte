<script lang="ts">
  import { signIn, signUp, signOut, signInWithGoogle } from '$lib/supabase';
  import { user } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase'

  let email = '';
  let password = '';
  let isSignUp = false;
  let error = '';
  let loading = false;
  let showDropdown = false;
  let googleLoading = false;



  async function handleGoogleSignIn() {
    googleLoading = true;
    error = '';
    
    try {
      const { error: signInError } = await signInWithGoogle();
      if (signInError) {
        error = signInError.message;
      }
    } catch (e: any) {
      error = e.message || 'An error occurred';
    } finally {
      googleLoading = false;
    }
  }

  async function handleSubmit() {
    error = '';
    loading = true;

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          error = signUpError.message;
        } else {
          error = ''; // Clear any previous error
          // Show success message for sign up
          alert('Check your email for a confirmation link!');
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          error = signInError.message;
        }
      }
    } catch (e: any) {
      error = e.message || 'An error occurred';
    }

    loading = false;
  }

  async function handleSignOut() {
    await signOut();
    showDropdown = false;
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      showDropdown = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="auth-container">

  {#if $user}
    <div class="user-menu">
      <button class="user-button" on:click|stopPropagation={toggleDropdown}>
        {#if $user.user_metadata?.avatar_url}
          <img class="user-avatar-img" src={$user.user_metadata.avatar_url} alt="Profile" />
        {:else}
          <span class="user-avatar">👤</span>
        {/if}
        <span class="user-email">{$user.user_metadata?.full_name || $user.email}</span>
        <span class="dropdown-arrow">{showDropdown ? '▲' : '▼'}</span>
      </button>
      
      {#if showDropdown}
        <div class="dropdown-menu">
          <div class="dropdown-header">
            {#if $user.user_metadata?.full_name}
              <span class="dropdown-name">{$user.user_metadata.full_name}</span>
            {/if}
            <span class="dropdown-email">{$user.email}</span>
          </div>
          <button class="dropdown-item sign-out" on:click={handleSignOut}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="auth-form-container">
      <button class="auth-toggle-btn" on:click|stopPropagation={() => showDropdown = !showDropdown}>
        {showDropdown ? '✕ Close' : '🔐 Sign In'}
      </button>
      
      {#if showDropdown}
        <div class="auth-dropdown">
          <h3>{isSignUp ? 'Create Account' : 'Sign In'}</h3>
          
          <!-- Google Sign In Button -->
          <button 
            type="button" 
            class="google-btn" 
            on:click={handleGoogleSignIn}
            disabled={googleLoading}
          >
            <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>
          
          <div class="divider">
            <span>or</span>
          </div>
          
          <form on:submit|preventDefault={handleSubmit}>
            <input
              type="email"
              bind:value={email}
              placeholder="Email"
              required
            />
            <input
              type="password"
              bind:value={password}
              placeholder="Password"
              minlength="6"
              required
            />
            
            {#if error}
              <p class="error">{error}</p>
            {/if}
            
            <button type="submit" class="submit-btn" disabled={loading}>
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </form>
          
          <p class="switch-mode">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button type="button" class="link-btn" on:click={() => isSignUp = !isSignUp}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .auth-container {
    position: relative;
  }

  .user-menu {
    position: relative;
  }

  .user-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
  }

  .user-button:hover {
    background: #3367d6;
  }

  .user-avatar {
    font-size: 1.1rem;
  }

  .user-avatar-img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-email {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-arrow {
    font-size: 0.6rem;
    margin-left: 0.25rem;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-header {
    padding: 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
  }

  .dropdown-name {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
    color: #333;
    margin-bottom: 0.25rem;
  }

  .dropdown-email {
    font-size: 0.875rem;
    color: #666;
    word-break: break-all;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    text-align: left;
    transition: background 0.2s;
  }

  .dropdown-item:hover {
    background: #f0f0f0;
  }

  .dropdown-item.sign-out {
    color: #dc3545;
  }

  .auth-form-container {
    position: relative;
  }

  .auth-toggle-btn {
    padding: 0.5rem 1rem;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
  }

  .auth-toggle-btn:hover {
    background: #3367d6;
  }

  .auth-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 1.5rem;
    min-width: 280px;
    z-index: 1000;
  }

  .auth-dropdown h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: #333;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: white;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .google-btn:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #ccc;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .google-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .google-icon {
    flex-shrink: 0;
  }

  .divider {
    display: flex;
    align-items: center;
    margin: 1rem 0;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #ddd;
  }

  .divider span {
    padding: 0 0.75rem;
    color: #999;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .auth-dropdown form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .auth-dropdown input {
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .auth-dropdown input:focus {
    outline: none;
    border-color: #4285f4;
  }

  .error {
    color: #dc3545;
    font-size: 0.875rem;
    margin: 0;
    padding: 0.5rem;
    background: #fff5f5;
    border-radius: 4px;
  }

  .submit-btn {
    padding: 0.75rem 1rem;
    background: #4285f4;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .submit-btn:hover:not(:disabled) {
    background: #3367d6;
  }

  .submit-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .switch-mode {
    margin: 1rem 0 0 0;
    font-size: 0.875rem;
    color: #666;
    text-align: center;
  }

  .link-btn {
    background: none;
    border: none;
    color: #4285f4;
    cursor: pointer;
    font-size: 0.875rem;
    text-decoration: underline;
  }

  .link-btn:hover {
    color: #3367d6;
  }

  @media (max-width: 768px) {
    .user-email {
      display: none;
    }

    .auth-dropdown {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      right: auto;
      width: calc(100vw - 2rem);
      max-width: 320px;
    }

    .dropdown-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      right: auto;
      width: calc(100vw - 2rem);
      max-width: 280px;
    }
  }
</style>
