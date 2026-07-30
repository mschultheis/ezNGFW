<!-- Route view for `/security` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asObject } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Switch } from '$lib/components/ui/switch';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import SaveIcon from '@lucide/svelte/icons/save';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import KeyIcon from '@lucide/svelte/icons/key-round';
  import LockIcon from '@lucide/svelte/icons/lock';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { _ } from '$lib/i18n';

  /* ---------- types ---------- */
  type SecuritySettings = {
    brute_force_protection_enabled: boolean;
    https_enabled: boolean;
    management_bind: string;
    session_timeout_seconds: number;
    concurrent_sessions_limit: number;
    require_password_rotation: boolean;
    password_rotation_days: number;
    password_min_length: number;
    require_uppercase: boolean;
    require_number: boolean;
    require_special: boolean;
    max_login_attempts: number;
    lockout_duration_seconds: number;
    anti_lockout_rule: boolean;
    mfa_enabled: boolean;
    mfa_method: string;
    allowed_admin_ips: string;
    sso_enabled: boolean;
    oidc_provider_url: string;
    oidc_client_id: string;
    oidc_client_secret: string;
    oidc_scopes: string;
    oidc_redirect_uri: string;
    oidc_auto_provision: boolean;
    oidc_default_role: string;
    api_key_enabled: boolean;
    api_key_expiry_days: number;
    cors_origins: string;
    csp_policy: string;
    x_frame_options: string;
    hsts_enabled: boolean;
    hsts_max_age: number;
    audit_logging_enabled: boolean;
    log_retention_days: number;
  };

  const defaults: SecuritySettings = {
    brute_force_protection_enabled: true,
    https_enabled: true, management_bind: '0.0.0.0:8080', session_timeout_seconds: 3600, concurrent_sessions_limit: 3,
    require_password_rotation: false, password_rotation_days: 90, password_min_length: 12, require_uppercase: true, require_number: true, require_special: true, max_login_attempts: 5,
    lockout_duration_seconds: 300, anti_lockout_rule: true, mfa_enabled: false, mfa_method: 'totp', allowed_admin_ips: '', sso_enabled: false,
    oidc_provider_url: '', oidc_client_id: '', oidc_client_secret: '', oidc_scopes: 'openid profile email',
    oidc_redirect_uri: '', oidc_auto_provision: false, oidc_default_role: 'viewer',
    api_key_enabled: true, api_key_expiry_days: 365, cors_origins: '', csp_policy: '', x_frame_options: 'SAMEORIGIN', hsts_enabled: true,
    hsts_max_age: 31536000, audit_logging_enabled: true, log_retention_days: 90
  };

  /* ---------- state ---------- */
  let settings = $state<SecuritySettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);

  let username = $state('');
  let oldPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let changingPassword = $state(false);
  let revokingMine = $state(false);
  let revokingAll = $state(false);

  /* ---------- load / save ---------- */
  async function load() {
    loading = true;
    try {
      const d = asObject(await api.get('/security'));
      settings = {
        brute_force_protection_enabled: Boolean(d.brute_force_protection_enabled ?? defaults.brute_force_protection_enabled),
        https_enabled: Boolean(d.https_enabled ?? defaults.https_enabled),
        management_bind: String(d.management_bind ?? defaults.management_bind),
        session_timeout_seconds: Number(d.session_timeout_seconds ?? defaults.session_timeout_seconds),
        concurrent_sessions_limit: Number(d.concurrent_sessions_limit ?? defaults.concurrent_sessions_limit),
        require_password_rotation: Boolean(d.require_password_rotation ?? defaults.require_password_rotation),
        password_rotation_days: Number(d.password_rotation_days ?? defaults.password_rotation_days),
        password_min_length: Number(d.password_min_length ?? defaults.password_min_length),
        require_uppercase: Boolean(d.require_uppercase ?? defaults.require_uppercase),
        require_number: Boolean(d.require_number ?? defaults.require_number),
        require_special: Boolean(d.require_special ?? defaults.require_special),
        max_login_attempts: Number(d.max_login_attempts ?? defaults.max_login_attempts),
        lockout_duration_seconds: Number(d.lockout_duration_seconds ?? defaults.lockout_duration_seconds),
        anti_lockout_rule: Boolean(d.anti_lockout_rule ?? defaults.anti_lockout_rule),
        mfa_enabled: Boolean(d.mfa_enabled ?? defaults.mfa_enabled),
        mfa_method: String(d.mfa_method ?? defaults.mfa_method),
        allowed_admin_ips: String(d.allowed_admin_ips ?? defaults.allowed_admin_ips),
        sso_enabled: Boolean(d.sso_enabled ?? defaults.sso_enabled),
        oidc_provider_url: String(d.oidc_provider_url ?? defaults.oidc_provider_url),
        oidc_client_id: String(d.oidc_client_id ?? defaults.oidc_client_id),
        oidc_client_secret: String(d.oidc_client_secret ?? defaults.oidc_client_secret),
        oidc_scopes: String(d.oidc_scopes ?? defaults.oidc_scopes),
        oidc_redirect_uri: String(d.oidc_redirect_uri ?? defaults.oidc_redirect_uri),
        oidc_auto_provision: Boolean(d.oidc_auto_provision ?? defaults.oidc_auto_provision),
        oidc_default_role: String(d.oidc_default_role ?? defaults.oidc_default_role),
        api_key_enabled: Boolean(d.api_key_enabled ?? defaults.api_key_enabled),
        api_key_expiry_days: Number(d.api_key_expiry_days ?? defaults.api_key_expiry_days),
        cors_origins: String(d.cors_origins ?? defaults.cors_origins),
        csp_policy: String(d.csp_policy ?? defaults.csp_policy),
        x_frame_options: String(d.x_frame_options ?? defaults.x_frame_options),
        hsts_enabled: Boolean(d.hsts_enabled ?? defaults.hsts_enabled),
        hsts_max_age: Number(d.hsts_max_age ?? defaults.hsts_max_age),
        audit_logging_enabled: Boolean(d.audit_logging_enabled ?? defaults.audit_logging_enabled),
        log_retention_days: Number(d.log_retention_days ?? defaults.log_retention_days),
      };
      username = String(d.currentUsername ?? d.username ?? '');
    } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load security settings'); }
    finally { loading = false; }
  }

  async function save() {
    saving = true;
    try { await api.patch('/security', settings); toasts.success($_('security.toastsecurity_settings_saved')); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { saving = false; }
  }

  async function changePassword() {
    if (!username || !oldPassword || !newPassword || !confirmPassword) { toasts.error($_('security.toastall_fields_required')); return; }
    if (newPassword !== confirmPassword) { toasts.error($_('security.toastnew_password_confirmation_does_not_match')); return; }
    changingPassword = true;
    try { await api.post('/security/change-password', { username, oldPassword, newPassword }); toasts.success($_('security.toastpassword_changed')); oldPassword = ''; newPassword = ''; confirmPassword = ''; }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed'); }
    finally { changingPassword = false; }
  }

  async function revokeSessions(scope: 'mine' | 'all') {
    if (scope === 'mine') revokingMine = true; else revokingAll = true;
    try { await api.post('/security/revoke-sessions', { scope }); toasts.success(scope === 'mine' ? 'Your sessions revoked' : 'All sessions revoked'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed'); }
    finally { if (scope === 'mine') revokingMine = false; else revokingAll = false; }
  }

  const roleOptions = [
    { label: 'Admin', value: 'admin' },
    { label: 'Operator', value: 'operator' },
    { label: 'Viewer', value: 'viewer' }
  ];

  onMount(() => { void load(); });

</script>

<div class="space-y-6">
  <!-- Management Plane -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100"><ShieldIcon class="size-4" /> Management Plane</CardTitle>
          <CardDescription class="text-slate-400">{$_('security.https_enforcement_bind_address_session_hardening_a')}</CardDescription>
        </div>
        <Badge class={settings.https_enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}>
          {settings.https_enabled ? 'HTTPS Enforced' : 'HTTP (Insecure)'}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-3"><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /></div>
      {:else}
        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="HTTPS Enabled" hint="Force HTTPS for all GUI and API access. When disabled, admin traffic is sent in cleartext which exposes credentials and session tokens. Only disable on physically isolated management links with no untrusted access. Example: always enable in production." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.https_enabled} onCheckedChange={(v) => (settings.https_enabled = v)} />
                <span class="text-xs" class:text-emerald-400={settings.https_enabled} class:text-amber-400={!settings.https_enabled}>{settings.https_enabled ? 'Enforced' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Management Bind Address" hint="IP address and port the admin GUI/API listens on. Use 0.0.0.0 to listen on all interfaces, or bind to a specific management VLAN IP for security. Example: 192.168.1.1:8443 for HTTPS on management VLAN." />
              <Input class="border-slate-700 bg-slate-950" value={settings.management_bind} oninput={(e) => (settings.management_bind = (e.currentTarget as HTMLInputElement).value)} placeholder="0.0.0.0:8080" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Session Timeout (seconds)" hint="Idle timeout before admin sessions expire and require re-authentication. Shorter timeouts improve security; longer values are more convenient. PCI DSS recommends 15 minutes (900s) for admin access. Example: 1800 for 30 minutes." />
              <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.session_timeout_seconds)} oninput={(e) => (settings.session_timeout_seconds = Number((e.currentTarget as HTMLInputElement).value || 3600))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Brute Force Protection Enabled" hint="Master toggle for login throttling and lockout controls. Disable only in controlled break-glass procedures because it removes automatic resistance to password spraying and credential stuffing. Example: keep enabled in all normal operations and tune limits instead of disabling." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.brute_force_protection_enabled} onCheckedChange={(v) => (settings.brute_force_protection_enabled = v)} class="cursor-pointer" />
                <span class="text-xs text-slate-400">{settings.brute_force_protection_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Max Login Attempts" hint="Number of failed login attempts before the account is temporarily locked. Protects against brute-force password attacks. Set to 0 to disable lockout (not recommended). Example: 5 attempts before lockout." />
              <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.max_login_attempts)} oninput={(e) => (settings.max_login_attempts = Number((e.currentTarget as HTMLInputElement).value || 5))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Lockout Duration (seconds)" hint="How long an account stays locked after exceeding max login attempts. Too short allows rapid retry; too long inconveniences legitimate admins. Example: 300 for 5 minutes, 900 for 15 minutes." />
              <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.lockout_duration_seconds)} oninput={(e) => (settings.lockout_duration_seconds = Number((e.currentTarget as HTMLInputElement).value || 300))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Concurrent Sessions Limit" hint="Maximum number of simultaneous admin sessions per account. Limiting concurrency reduces token sprawl and helps contain session hijacking risk if one browser is compromised. Example: 2 or 3 for security teams; 1 in highly regulated environments." />
              <Input class="border-slate-700 bg-slate-950" type="number" min="1" value={String(settings.concurrent_sessions_limit)} oninput={(e) => (settings.concurrent_sessions_limit = Number((e.currentTarget as HTMLInputElement).value || 3))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Require Password Rotation" hint="Force periodic password changes for all admin accounts. Helps comply with security policies (NIST 800-63B, PCI DSS). When enabled, users are prompted to change their password after the configured number of days." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.require_password_rotation} onCheckedChange={(v) => (settings.require_password_rotation = v)} />
                <span class="text-xs text-slate-400">{settings.require_password_rotation ? 'Required' : 'Off'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Password Minimum Length" hint="Minimum allowed password length for local administrator accounts. Longer passwords generally provide better resistance than composition tricks alone, especially against offline cracking. Example: 14 for standard enterprise controls or 16+ for privileged break-glass accounts." />
              <Input class="border-slate-700 bg-slate-950" type="number" min="8" value={String(settings.password_min_length)} oninput={(e) => (settings.password_min_length = Number((e.currentTarget as HTMLInputElement).value || 12))} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Require Uppercase" hint="Requires at least one uppercase character in local admin passwords. This helps satisfy policy frameworks but should be combined with strong length requirements for meaningful security. Example: keep enabled when auditors require complexity classes." />
              <div class="flex h-9 items-center gap-3"><Switch checked={settings.require_uppercase} onCheckedChange={(v) => (settings.require_uppercase = v)} class="cursor-pointer" /><span class="text-xs text-slate-400">{settings.require_uppercase ? 'Required' : 'Optional'}</span></div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Require Number" hint="Forces numeric characters in passwords. This can prevent extremely weak dictionary-only credentials but should not replace minimum length and MFA. Example: keep enabled for compatibility with existing password policy standards." />
              <div class="flex h-9 items-center gap-3"><Switch checked={settings.require_number} onCheckedChange={(v) => (settings.require_number = v)} class="cursor-pointer" /><span class="text-xs text-slate-400">{settings.require_number ? 'Required' : 'Optional'}</span></div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Require Special Character" hint="Requires at least one symbol in local credentials to increase entropy diversity. This can improve resistance to common guessing patterns when users choose similar base words. Example: enabled with user guidance to avoid predictable substitutions like Password1!." />
              <div class="flex h-9 items-center gap-3"><Switch checked={settings.require_special} onCheckedChange={(v) => (settings.require_special = v)} class="cursor-pointer" /><span class="text-xs text-slate-400">{settings.require_special ? 'Required' : 'Optional'}</span></div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="MFA Enabled" hint="Requires a second authentication factor after password entry for local and compatible SSO admin flows. MFA drastically reduces account-takeover risk from reused or phished passwords. Example: enable before exposing management UI to any routed internal networks." />
              <div class="flex h-9 items-center gap-3"><Switch checked={settings.mfa_enabled} onCheckedChange={(v) => (settings.mfa_enabled = v)} class="cursor-pointer" /><span class="text-xs text-slate-400">{settings.mfa_enabled ? 'Enabled' : 'Disabled'}</span></div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="MFA Method" hint="Select allowed second-factor mechanism for admin login. TOTP works broadly with authenticator apps, WebAuthn supports hardware keys/platform biometrics, and both provides rollout flexibility. Example: start with both, then enforce WebAuthn for privileged admins." />
              <Select.Root type="single" value={settings.mfa_method} onValueChange={(v) => { if (v) settings.mfa_method = v; }}>
                <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100 cursor-pointer"><span>{settings.mfa_method}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  <Select.Item value="totp" label="TOTP" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  <Select.Item value="webauthn" label="WebAuthn" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  <Select.Item value="both" label="Both" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                </Select.Content>
              </Select.Root>
            </label>

            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Allowed Admin IPs" hint="Optional allowlist of source addresses/subnets permitted to reach admin authentication endpoints. One CIDR per line helps avoid formatting mistakes and supports audit-friendly review. Example: 10.0.0.0/24 and 198.51.100.10/32 for jump-host only access." />
              <Textarea class="min-h-24 border-slate-700 bg-slate-950 text-slate-100" bind:value={settings.allowed_admin_ips} placeholder={'10.0.0.0/24\n198.51.100.10/32'} />
            </label>

            {#if settings.require_password_rotation}
              <label class="space-y-1 text-sm">
                <FieldLabel label="Rotation Interval (days)" hint="Number of days before password must be changed. NIST recommends against frequent rotation unless breach is suspected, but many compliance frameworks require 90 days. Example: 90 for quarterly rotation." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.password_rotation_days)} oninput={(e) => (settings.password_rotation_days = Number((e.currentTarget as HTMLInputElement).value || 90))} />
              </label>
            {/if}
          </div>

          <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600" disabled={saving}>
            <SaveIcon class="mr-2 size-4" />{saving ? 'Saving…' : 'Save Management Settings'}
          </Button>
        </form>
      {/if}
    </CardContent>
  </Card>

  <!-- Anti-Lockout Rule -->
  <Card class="border-amber-500/50 bg-amber-500/10">
    <CardHeader>
      <CardTitle class="flex items-center gap-2 text-amber-100"><LockIcon class="size-4" /> Anti-Lockout Rule</CardTitle>
      <CardDescription class="text-amber-200/85">{$_('security.automatically_permits_lan_access_to_the_admin_gui')}</CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <Skeleton class="h-11 bg-amber-950/50" />
      {:else}
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-slate-900/70 p-3">
          <div>
            <p class="text-sm font-medium text-amber-100">{$_('security.antilockout_rule')}</p>
            <p class="text-xs text-amber-200/70">Always permit LAN → Management GUI on port {settings.management_bind.split(':')[1] || '8080'}.</p>
          </div>
          <Switch checked={settings.anti_lockout_rule} onCheckedChange={(v) => { settings.anti_lockout_rule = v; void save(); }} />
        </div>
      {/if}
    </CardContent>
  </Card>

  <!-- SSO / OIDC -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100"><KeyIcon class="size-4" /> SSO / OIDC Authentication</CardTitle>
          <CardDescription class="text-slate-400">{$_('security.configure_oauth_20_openid_connect_single_signon_fo')}</CardDescription>
        </div>
        <Badge class={settings.sso_enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}>
          {settings.sso_enabled ? 'SSO Active' : 'SSO Disabled'}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <Skeleton class="h-32 bg-slate-800" />
      {:else}
        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="Enable SSO" hint="Show the 'Sign in with SSO' button on the login page. When enabled, users can authenticate via your identity provider instead of local credentials. Keep local login as fallback in case the IdP is unreachable." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.sso_enabled} onCheckedChange={(v) => (settings.sso_enabled = v)} />
                <span class="text-xs text-slate-400">{settings.sso_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Provider URL" hint="Base URL of your OIDC identity provider. The firewall appends /.well-known/openid-configuration to discover endpoints automatically. Example: https://login.microsoftonline.com/tenant-id/v2.0 for Azure AD, https://keycloak.example.com/realms/myrealm for Keycloak." />
              <Input class="border-slate-700 bg-slate-950" value={settings.oidc_provider_url} oninput={(e) => (settings.oidc_provider_url = (e.currentTarget as HTMLInputElement).value)} placeholder="https://idp.example.com" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Client ID" hint="The OAuth client identifier registered at your identity provider for this firewall. Created when you register a new application/client in the IdP. Example: ezngfw-admin or a UUID like 12345678-abcd-1234-efgh-123456789abc." />
              <Input class="border-slate-700 bg-slate-950" value={settings.oidc_client_id} oninput={(e) => (settings.oidc_client_id = (e.currentTarget as HTMLInputElement).value)} placeholder="ezngfw-admin" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Client Secret" hint="The secret paired with the Client ID. Treat this like a password — never share or expose it in URLs. Rotate immediately if compromised. Example: a long random string from your IdP's application registration." />
              <Input class="border-slate-700 bg-slate-950" type="password" value={settings.oidc_client_secret} oninput={(e) => (settings.oidc_client_secret = (e.currentTarget as HTMLInputElement).value)} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Scopes" hint="Space-separated OAuth scopes requested during login. 'openid' is required for OIDC. Add 'profile' for display name and 'email' for email address. Some IdPs need 'groups' for role mapping. Example: openid profile email groups." />
              <Input class="border-slate-700 bg-slate-950" value={settings.oidc_scopes} oninput={(e) => (settings.oidc_scopes = (e.currentTarget as HTMLInputElement).value)} placeholder="openid profile email" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Redirect URI" hint="The callback URL registered in your IdP that receives the authorization code after login. Must match exactly what's configured in the IdP. Example: https://firewall.example.com/auth/callback." />
              <Input class="border-slate-700 bg-slate-950" value={settings.oidc_redirect_uri} oninput={(e) => (settings.oidc_redirect_uri = (e.currentTarget as HTMLInputElement).value)} placeholder="https://fw.example.com/auth/callback" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Auto-Provision Users" hint="Automatically create local user accounts for new SSO users on first login. When disabled, only pre-existing local accounts can authenticate via SSO. Enable for convenience, disable for tighter access control." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.oidc_auto_provision} onCheckedChange={(v) => (settings.oidc_auto_provision = v)} />
                <span class="text-xs text-slate-400">{settings.oidc_auto_provision ? 'Auto-create' : 'Manual only'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Default Role for SSO Users" hint="Role assigned to auto-provisioned SSO users. Admin has full access, Operator can modify config, Viewer is read-only. You can change individual roles later in User Management." />
              <Select.Root type="single" value={settings.oidc_default_role} onValueChange={(v) => { if (v) settings.oidc_default_role = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                  <span>{roleOptions.find(o => o.value === settings.oidc_default_role)?.label ?? settings.oidc_default_role}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each roleOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}
                </Select.Content>
              </Select.Root>
            </label>
          </div>

          <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600" disabled={saving}>
            <SaveIcon class="mr-2 size-4" />{saving ? 'Saving…' : 'Save SSO Settings'}
          </Button>
        </form>
      {/if}
    </CardContent>
  </Card>

  <!-- API Key & Advanced Security Headers -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <button class="flex w-full cursor-pointer items-center gap-2 text-left" onclick={() => (showAdvanced = !showAdvanced)}>
        {#if showAdvanced}<ChevronDownIcon class="size-4 text-cyan-400" />{:else}<ChevronRightIcon class="size-4 text-cyan-400" />{/if}
        <CardTitle class="text-slate-100">{$_('security.api_keys_security_headers')}</CardTitle>
      </button>
      <CardDescription class="text-slate-400">{$_('security.api_key_authentication_cors_origins_content_securi')}</CardDescription>
    </CardHeader>
    {#if showAdvanced}
      <CardContent>
        {#if loading}
          <Skeleton class="h-24 bg-slate-800" />
        {:else}
          <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-1 text-sm">
                <FieldLabel label="API Key Authentication" hint="Allow API access via bearer tokens / API keys in addition to session cookies. Required for CLI tools, automation scripts, and third-party integrations. Disable only if all access is via the GUI." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.api_key_enabled} onCheckedChange={(v) => (settings.api_key_enabled = v)} />
                  <span class="text-xs text-slate-400">{settings.api_key_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="API Key Expiry (days)" hint="Number of days before API keys expire and must be regenerated. Shorter lifetimes reduce risk from leaked keys. Set to 0 for non-expiring keys (not recommended). Example: 365 for annual rotation." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.api_key_expiry_days)} oninput={(e) => (settings.api_key_expiry_days = Number((e.currentTarget as HTMLInputElement).value || 365))} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="CORS Allowed Origins" hint="Comma-separated list of origins permitted to make cross-origin API requests. Leave empty to block all CORS requests (most secure). Use * only for development. Example: https://monitoring.example.com, https://grafana.internal." />
                <Input class="border-slate-700 bg-slate-950" value={settings.cors_origins} oninput={(e) => (settings.cors_origins = (e.currentTarget as HTMLInputElement).value)} placeholder="https://monitoring.example.com" />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="HSTS Enabled" hint="Controls whether Strict-Transport-Security response headers are emitted at all. Keep enabled to force browsers onto HTTPS and reduce downgrade risk from mixed-content workflows. Example: keep enabled permanently after HTTPS certificates are stable." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.hsts_enabled} onCheckedChange={(v) => (settings.hsts_enabled = v)} class="cursor-pointer" />
                  <span class="text-xs text-slate-400">{settings.hsts_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="HSTS Max Age (seconds)" hint="Strict-Transport-Security max-age header value. Tells browsers to only access the admin GUI over HTTPS for this duration. Default 31536000 = 1 year. Set to 0 to disable HSTS." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.hsts_max_age)} oninput={(e) => (settings.hsts_max_age = Number((e.currentTarget as HTMLInputElement).value || 31536000))} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="X-Frame-Options" hint="Controls framing behavior for clickjacking protection in older and mixed browser fleets. `SAMEORIGIN` is generally safest for admin GUIs; `DENY` is strictest when no embedding is ever needed. Example: SAMEORIGIN for integrated internal portals that host admin in trusted frames." />
                <select
              bind:value={settings.x_frame_options}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="DENY">{$_('security.deny')}</option>
              <option value="SAMEORIGIN">{$_('security.sameorigin')}</option>
              <option value="ALLOW-FROM">{$_('security.allowfrom')}</option>
            </select> (settings.x_frame_options = (e.currentTarget as HTMLInputElement).value)} placeholder={$_('security.placeholdersameorigin')} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Audit Logging Enabled" hint="Turns on detailed administrative audit events including login attempts, config changes, and session operations. This is required for most compliance frameworks and incident-response timelines. Example: keep enabled always and forward logs to SIEM for retention." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.audit_logging_enabled} onCheckedChange={(v) => (settings.audit_logging_enabled = v)} class="cursor-pointer" />
                  <span class="text-xs text-slate-400">{settings.audit_logging_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Log Retention Days" hint="Number of days security and audit logs should be retained locally before rotation or purge. Set this according to legal, compliance, and forensic requirements while monitoring disk capacity. Example: 90 for baseline controls, 365 for stricter regulated environments." />
                <Input class="border-slate-700 bg-slate-950" type="number" min="1" value={String(settings.log_retention_days)} oninput={(e) => (settings.log_retention_days = Number((e.currentTarget as HTMLInputElement).value || 90))} />
              </label>

              <label class="space-y-1 text-sm md:col-span-2">
                <FieldLabel label="Content Security Policy" hint="Custom CSP header for the admin GUI. Controls which scripts, styles, and resources the browser is allowed to load. Leave empty for the built-in default policy. Example: default-src 'self'; script-src 'self'." />
                <Input class="border-slate-700 bg-slate-950" value={settings.csp_policy} oninput={(e) => (settings.csp_policy = (e.currentTarget as HTMLInputElement).value)} placeholder="default-src 'self'; script-src 'self'" />
              </label>
            </div>

            <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600" disabled={saving}>
              <SaveIcon class="mr-2 size-4" />{saving ? 'Saving…' : 'Save Advanced Security'}
            </Button>
          </form>
        {/if}
      </CardContent>
    {/if}
  </Card>

  <!-- Password & Session Operations -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('security.session_password_operations')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('security.rotate_credentials_and_invalidate_active_sessions')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <form class="grid gap-3 md:grid-cols-4" onsubmit={(e) => { e.preventDefault(); void changePassword(); }}>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Username" hint="The admin account whose password you want to change. Only your own account or accounts you have management rights over." />
          <Input class="border-slate-700 bg-slate-950" value={username} oninput={(e) => (username = (e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Current Password" hint="Your existing password for verification. Required to prevent unauthorized password changes even from an active session." />
          <Input class="border-slate-700 bg-slate-950" type="password" value={oldPassword} oninput={(e) => (oldPassword = (e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="New Password" hint="New password must meet complexity requirements: minimum 12 characters, mix of upper/lower case, numbers, and symbols. Avoid dictionary words and personal information." />
          <Input class="border-slate-700 bg-slate-950" type="password" value={newPassword} oninput={(e) => (newPassword = (e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Confirm New Password" hint="Re-enter the new password to catch typing mistakes before submitting a credential change. This reduces lockout incidents caused by silent typos and helps junior operators avoid emergency resets. Example: paste-manager generated password in both fields to verify exact match." />
          <Input class="border-slate-700 bg-slate-950" type="password" value={confirmPassword} oninput={(e) => (confirmPassword = (e.currentTarget as HTMLInputElement).value)} />
        </label>
        <div class="md:col-span-3">
          <Button type="submit" class="bg-amber-500 text-slate-950 hover:bg-amber-400" disabled={changingPassword}>
            {changingPassword ? 'Changing…' : 'Change Password'}
          </Button>
        </div>
      </form>

      <div class="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        <Button variant="outline" class="border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20" onclick={() => void revokeSessions('mine')} disabled={revokingMine}>
          {revokingMine ? 'Revoking…' : 'Revoke My Sessions'}
        </Button>
        <Button variant="outline" class="border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20" onclick={() => void revokeSessions('all')} disabled={revokingAll}>
          {revokingAll ? 'Revoking…' : 'Revoke All Sessions'}
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
