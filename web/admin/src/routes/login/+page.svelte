<!-- Authentication page handling credential, MFA, and optional SSO sign-in flows. -->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Card, CardContent } from '$lib/components/ui/card';
  import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';
  import KeyRoundIcon from '@lucide/svelte/icons/key-round';
  import UserIcon from '@lucide/svelte/icons/user';
  import { _ } from '$lib/i18n';

  /** Login flow stages: credentials first, then MFA if the account requires it. */
  type Stage = 'credentials' | 'mfa';

  let stage = $state<Stage>('credentials');
  let loading = $state(false);

  let username = $state('');
  let password = $state('');
  let rememberMe = $state(false);
  let mfaToken = $state('');
  let pendingLoginToken = $state('');

  let errorMessage = $state('');
  let accountLocked = $state(false);
  let invalidCredentials = $state(false);
  let mfaRequired = $state(false);

  /** Firmware version fetched from public endpoint. */
  let fwVersion = $state('');
  let demoMode = $state(false);
  let demoLoading = $state(false);

  /** Clear all error flags and messages. */
  function resetErrors() {
    errorMessage = '';
    accountLocked = false;
    invalidCredentials = false;
    mfaRequired = false;
  }

  /** Persist the JWT token and optional role after successful auth. */
  function rememberRoleAndToken(token: string, role?: string) {
    api.setToken(token);
    if (role) localStorage.setItem('ezngfw_role', role);
    if (rememberMe) localStorage.setItem('ezngfw_remember_user', username);
    else localStorage.removeItem('ezngfw_remember_user');
    localStorage.removeItem('ezngfw_ai_hint_dismissed');
  }

  /** Stage 1: Submit username + password. Transitions to MFA stage when required. */
  async function submitCredentials() {
    resetErrors();
    loading = true;
    try {
      const response = await api.post<{
        token?: string;
        role?: string;
        mfaRequired?: boolean;
        loginToken?: string;
        accountLocked?: boolean;
        errorCode?: string;
      }>('/auth/login', { username, password, remember_me: rememberMe });

      if (response.accountLocked || response.errorCode === 'ACCOUNT_LOCKED') {
        accountLocked = true;
        errorMessage = 'Account locked. Contact an administrator.';
        toasts.error(errorMessage);
        return;
      }

      if (response.mfaRequired) {
        if (!response.loginToken) throw new Error('MFA required but login token was not provided');
        pendingLoginToken = response.loginToken;
        stage = 'mfa';
        mfaRequired = true;
        toasts.warning('MFA token required to complete sign in');
        return;
      }

      if (!response.token) {
        invalidCredentials = true;
        errorMessage = 'Invalid credentials';
        toasts.error(errorMessage);
        return;
      }

      rememberRoleAndToken(response.token, response.role);
      toasts.success('Signed in successfully');
      await goto(base + '/');
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Login failed';
      // Detect connection failures (backend not running)
      const isConnectionError =
        error instanceof TypeError ||
        raw.includes('Failed to fetch') ||
        raw.includes('NetworkError') ||
        raw.includes('ERR_CONNECTION_REFUSED') ||
        raw.includes('Load failed');
      if (isConnectionError) {
        errorMessage = 'Cannot reach the ezNGFW backend. Please verify the firewall service is running.';
      } else {
        invalidCredentials = true;
        errorMessage = raw;
      }
      toasts.error(errorMessage);
    } finally {
      loading = false;
    }
  }

  /** Stage 2: Submit MFA/OTP code to finalize authentication. */
  async function submitMfa() {
    resetErrors();
    loading = true;
    try {
      const response = await api.post<{ token?: string; role?: string; errorCode?: string }>('/auth/mfa', {
        loginToken: pendingLoginToken,
        otpCode: mfaToken
      });

      if (!response.token) {
        mfaRequired = true;
        errorMessage = 'MFA required or invalid token';
        toasts.error(errorMessage);
        return;
      }

      rememberRoleAndToken(response.token, response.role);
      toasts.success('MFA verified');
      await goto(base + '/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MFA verification failed';
      mfaRequired = true;
      errorMessage = message;
      toasts.error(message);
    } finally {
      loading = false;
    }
  }

  /** Redirect to the SSO/OIDC provider login flow. */
  async function beginSso() {
    loading = true;
    resetErrors();
    try {
      const response = await api.get<{ redirectUrl?: string; provider?: string }>('/auth/sso');
      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
        return;
      }
      toasts.warning('SSO is not configured on this node');
    } catch {
      toasts.warning('SSO is not configured on this node');
    } finally {
      loading = false;
    }
  }

  async function tryDemo() {
    demoLoading = true;
    try {
      const { enableDemoMode } = await import('$lib/api/demo-api');
      enableDemoMode();
      api.setToken('demo-auth-token');
      toasts.success('Demo mode activated — all data is simulated');
      await goto(base + '/');
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to start demo');
    } finally {
      demoLoading = false;
    }
  }

  /** Return from MFA stage back to the credentials form. */
  function backToCredentials() {
    stage = 'credentials';
    mfaToken = '';
    pendingLoginToken = '';
    resetErrors();
  }

  /** On mount, restore a previously-remembered username. */
  $effect(() => {
    const remembered = localStorage.getItem('ezngfw_remember_user');
    if (remembered && remembered.length > 0) {
      username = remembered;
      rememberMe = true;
    }
  });

  $effect(() => {
    if (!browser) return;
    demoMode = new URLSearchParams(window.location.search).has('demo') || localStorage.getItem('ezngfw_demo_mode') === '1';
  });

  /** Fetch public version info (no auth required). */
  async function fetchVersion() {
    try {
      const res = await fetch('/api/version');
      if (res.ok) {
        const data = await res.json();
        fwVersion = data.version ?? '';
      }
    } catch { /* backend unreachable — version stays hidden */ }
  }
  // Fire once on mount via $effect with empty deps pattern
  $effect(() => { void fetchVersion(); });
</script>

<div class="relative flex min-h-screen items-center justify-center bg-slate-950 px-4">
  <!-- Ambient gradient — subtle cyan glow from top -->
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.10),transparent_55%)]"></div>
  <!-- Secondary glow from bottom-right for depth -->
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.04),transparent_50%)]"></div>

  <div class="relative z-10 w-full max-w-[380px]">
    <Card class="border-slate-800/80 bg-slate-900/90 shadow-2xl shadow-cyan-950/20 backdrop-blur-sm">
      <CardContent class="px-8 pb-8 pt-10">
        <!-- Logo + Branding -->
        <div class="mb-8 flex flex-col items-center text-center">
          <!-- Hexagonal shield with subtle glow -->
          <div class="relative mb-4">
            <div class="absolute -inset-3 rounded-full bg-cyan-500/10 blur-xl"></div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="relative h-14 w-14 drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M16 8 L22 12 L22 20 L16 24 L10 20 L10 12 Z" fill="#06b6d4" fill-opacity="0.15" stroke="#06b6d4" stroke-width="0.8" stroke-linejoin="round"/>
              <circle cx="16" cy="16" r="2.8" fill="#06b6d4"/>
            </svg>
          </div>
          <h1 class="text-[1.65rem] font-bold tracking-tight text-white">{$_('login.title')}</h1>
          <p class="mt-1 text-[13px] font-medium tracking-wide text-slate-500">{$_('login.subtitle')}</p>
        </div>

        {#if stage === 'credentials'}
          <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void submitCredentials(); }}>
            <div class="space-y-1.5">
              <label for="username" class="text-xs font-medium tracking-wide text-slate-400">{$_('login.username')}</label>
              <div class="relative">
                <UserIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="username" class="h-10 border-slate-700/70 bg-slate-950/80 pl-10 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/30" bind:value={username} autocomplete="username" placeholder="admin" required />
              </div>
            </div>

            <div class="space-y-1.5">
              <label for="password" class="text-xs font-medium tracking-wide text-slate-400">{$_('login.password')}</label>
              <div class="relative">
                <LockKeyholeIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="password" type="password" class="h-10 border-slate-700/70 bg-slate-950/80 pl-10 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/30" bind:value={password} autocomplete="current-password" placeholder="Password" required />
              </div>
            </div>

            <div class="flex items-center justify-between pt-0.5">
              <label for="remember" class="cursor-pointer text-sm text-slate-400">{$_('login.remember')}</label>
              <Switch bind:checked={rememberMe} />
            </div>

            {#if errorMessage}
              <div class={invalidCredentials
                ? 'rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300'
                : 'rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300'}>
                {#if !invalidCredentials && !accountLocked}
                  <div class="mb-1 flex items-center gap-1.5 font-semibold">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                      <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                    </svg>
                    Connection Error
                  </div>
                {/if}
                {errorMessage}
              </div>
            {/if}

            <!-- Hidden native submit button ensures Enter key always triggers form submission -->
            <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
            <Button class="mt-1 h-10 w-full cursor-pointer bg-cyan-600 font-medium text-white transition-colors hover:bg-cyan-500 active:bg-cyan-700" type="submit" disabled={loading}>
              {loading ? $_('login.signing_in') : $_('login.sign_in')}
            </Button>
          </form>
        {:else}
          <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void submitMfa(); }}>
            <p class="text-center text-sm text-slate-400">Enter the verification code from your authenticator app</p>
            <div class="space-y-1.5">
              <label for="mfa-token" class="text-xs font-medium tracking-wide text-slate-400">MFA Code</label>
              <div class="relative">
                <KeyRoundIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="mfa-token" class="h-10 border-slate-700/70 bg-slate-950/80 pl-10 text-center tracking-[0.25em] text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/30" bind:value={mfaToken} minlength={6} maxlength={8} inputmode="numeric" autocomplete="one-time-code" placeholder="000000" required />
              </div>
            </div>

            {#if errorMessage}
              <div class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                {errorMessage}
              </div>
            {/if}

            <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
            <div class="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" class="h-10 cursor-pointer border-slate-700 text-slate-300 hover:bg-slate-800" onclick={backToCredentials} disabled={loading}>Back</Button>
              <Button class="h-10 cursor-pointer bg-cyan-600 font-medium text-white hover:bg-cyan-500" type="submit" disabled={loading}>
                {loading ? 'Verifying\u2026' : 'Verify'}
              </Button>
            </div>
          </form>
        {/if}

        <!-- Divider -->
        <div class="relative my-5">
          <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-800/80"></div></div>
          <div class="relative flex justify-center"><span class="bg-slate-900 px-3 text-xs text-slate-600">or</span></div>
        </div>

        <Button type="button" variant="outline" class="h-10 w-full cursor-pointer border-slate-700/70 bg-transparent text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300" onclick={() => void beginSso()} disabled={loading}>
          Sign in with SSO
        </Button>

        {#if !demoMode}
          <div class="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <p class="text-xs font-medium text-cyan-300">Try the Demo</p>
            <p class="mt-0.5 text-[11px] text-slate-500">Browser-only simulation — no firewall changes.</p>
            <Button type="button" class="mt-2 h-9 w-full cursor-pointer bg-cyan-600/80 text-xs font-medium text-white hover:bg-cyan-500" onclick={() => void tryDemo()} disabled={loading || demoLoading}>
              {demoLoading ? 'Starting…' : 'Launch Demo'}
            </Button>
          </div>
        {/if}
      </CardContent>
    </Card>

    <p class="mt-6 text-center text-xs text-slate-600">
      ezNGFW &mdash; Enterprise Next-Generation Firewall
      {#if fwVersion}
        <span class="ml-1 text-slate-500">v{fwVersion}</span>
      {/if}
    </p>
  </div>
</div>
