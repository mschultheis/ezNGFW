<!-- Route view for `/users` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { toasts } from '$lib/stores/toast';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Plus from '@lucide/svelte/icons/plus';
  import { _ } from '$lib/i18n';

  type Field = {
    key: string;
    label: string;
    kind: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
    required?: boolean;
    advanced?: boolean;
    nullable?: boolean;
    hint: string;
    options?: { value: string; label: string }[];
  };

  const settingsFields: Field[] = [
    { key: 'autoRefresh', label: 'Auto Refresh', kind: 'boolean', hint: 'Automatically refreshes users and API key data while this page stays open. This helps operators notice account state drift without manual reload clicks. Keep this enabled for active NOC sessions and disable during forensic snapshots.' },
    { key: 'refreshSeconds', label: 'Refresh Interval Seconds', kind: 'number', hint: 'Polling interval used when Auto Refresh is enabled. A value like 15 gives responsive dashboards while limiting API pressure. During incident response you can temporarily lower to 5, then return to a safer steady-state interval.' },
    { key: 'defaultRole', label: 'Default Role', kind: 'select', options: [{ value: 'readonly', label: 'Read Only' }, { value: 'operator', label: 'Operator' }, { value: 'admin', label: 'Admin' }], hint: 'Role pre-selected when adding new users from this page. Choosing a least-privilege default prevents accidental over-permissioning during rapid onboarding. Most teams use readonly as baseline and escalate role only with explicit approval.' },
    { key: 'requireMfaForAdmins', label: 'Require MFA For Admins', kind: 'boolean', hint: 'Forces administrative accounts to enroll and use multi-factor authentication. This materially lowers risk from password reuse or phishing events. Example: keep it on in production and only disable in isolated lab environments.' },
    { key: 'sessionTimeoutMinutes', label: 'Session Timeout Minutes', kind: 'number', hint: 'Idle timeout for authenticated user sessions in the admin UI. Shorter windows reduce exposure on shared terminals while longer windows reduce re-login friction. A common balance is 30 minutes for operators and 15 minutes for privileged access.' },
    { key: 'passwordMinLength', label: 'Minimum Password Length', kind: 'number', advanced: true, hint: 'Minimum character count required for newly created or rotated passwords. Strong length policy improves resistance against brute-force and credential stuffing attacks. Example: 12 for baseline security, 16 for regulated or high-risk deployments.' },
    { key: 'lockoutAttempts', label: 'Account Lockout Attempts', kind: 'number', advanced: true, hint: 'Failed login attempts allowed before a temporary lockout is applied. This slows automated guessing attacks while still allowing normal typo recovery. Typical values are 5 attempts in production and 10 in internal test labs.' },
    { key: 'allowApiKeySelfService', label: 'Allow API Key Self Service', kind: 'boolean', advanced: true, hint: 'Allows users to manage their own API keys without direct administrator intervention. This can speed automation onboarding but expands credential lifecycle responsibility. Keep disabled when strict centralized key governance is required.' },
    { key: 'auditTag', label: 'Audit Tag', kind: 'text', advanced: true, hint: 'Optional short tag appended to settings changes for audit traceability. Teams often use shift codes or ticket prefixes like IAM-OPS to correlate UI changes with runbooks. Keep the format stable so exported logs remain easy to filter.' }
  ];

  const rowFields: Field[] = [
    { key: 'username', label: 'Username', kind: 'text', required: true, hint: 'Unique account identifier used for sign-in and API ownership metadata. Choose a stable naming pattern like first.last or svc-backup to improve operator searchability. Avoid temporary aliases that become unclear after role transitions.' },
    { key: 'fullName', label: 'Full Name', kind: 'text', required: true, hint: 'Human-readable display name shown in tables, approvals, and audit context. Use legal or team-standard naming such as Alex Rivera or Backup Automation Service. Clear names speed incident handoffs when multiple operators share shifts.' },
    { key: 'email', label: 'Email', kind: 'text', required: true, hint: 'Primary notification and identity recovery address for this account. Use monitored mailboxes like noc@example.com for shared operational users and person-specific addresses for individual admins. Confirm mailbox ownership before granting elevated privileges.' },
    { key: 'role', label: 'Role', kind: 'select', required: true, options: [{ value: 'admin', label: 'Admin' }, { value: 'operator', label: 'Operator' }, { value: 'readonly', label: 'Read Only' }], hint: 'Authorization level that controls what the user can change in the platform. Admin is full control, operator is day-to-day execution, and readonly is inspection only. Start with least privilege, then elevate only for documented business need.' },
    { key: 'enabled', label: 'Enabled', kind: 'boolean', hint: 'Determines whether this account can authenticate right now. Disabling keeps the record for audit history while immediately cutting off access. Use disable-first workflows for departures before full deletion approvals.' },
    { key: 'mfaEnabled', label: 'MFA Enabled', kind: 'boolean', hint: 'Tracks whether multi-factor authentication is active on this user account. MFA dramatically reduces compromise risk from leaked passwords and reused credentials. Example: require it for admins and operators in all production environments.' },
    { key: 'password', label: 'Password', kind: 'text', required: true, advanced: true, hint: 'Initial secret used when creating a new local user or rotating credentials. Use long random passphrases such as River-Delta-74-Lantern rather than predictable words. Share initial passwords over secure channels and require immediate rotation on first login.' },
    { key: 'description', label: 'Description', kind: 'textarea', advanced: true, hint: 'Operational context for why this account exists and how it should be used. Include ownership, intended scope, and examples like Break-glass admin for after-hours firewall incidents. Good descriptions improve audits and reduce accidental misuse.' }
  ];

  const secondaryTables = [
    {
      endpoint: '/users',
      title: 'Current User Inventory',
      description: 'Live account inventory pulled from backend user records.',
      columns: ['username', 'fullName', 'email', 'role', 'enabled', 'mfaEnabled', 'lastLogin']
    },
    {
      endpoint: '/users/api-keys',
      title: 'API Keys',
      description: 'Issued API keys, scope context, and expiration posture.',
      columns: ['keyName', 'username', 'keyPrefix', 'created', 'expires', 'permissions']
    }
  ];

  let rows = $state<Record<string, any>[]>([]);
  let settings = $state<Record<string, any>>({});
  let draft = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let editingId = $state<string | null>(null);
  let loading = $state(true);
  let loadingRows = $state(true);
  let saving = $state(false);
  let deleting = $state(false);
  let search = $state('');
  let showAdvanced = $state(false);
  let showFormAdvanced = $state(false);
  let showChangePassword = $state(false);
  let statusFilter = $state('all');
  let sortField = $state('username');
  let sortDirection = $state<'asc' | 'desc'>('asc');
  let validation = $state<Record<string, string>>({});
  let timer: ReturnType<typeof setInterval> | null = null;

  function getDefaultValue(field: Field) {
    if (field.kind === 'boolean') return false;
    if (field.kind === 'number') return 0;
    if (field.kind === 'select') return field.options?.[0]?.value ?? '';
    return '';
  }

  function buildDefaults(fields: Field[]) {
    const model: Record<string, any> = {};
    for (const field of fields) model[field.key] = getDefaultValue(field);
    return model;
  }

  function normalizeRecord(raw: unknown, fields: Field[]) {
    const row = typeof raw === 'object' && raw !== null ? (raw as Record<string, any>) : {};
    const out: Record<string, any> = { ...buildDefaults(fields) };
    for (const field of fields) {
      if (field.kind === 'boolean') out[field.key] = Boolean(row[field.key]);
      else if (field.kind === 'number') out[field.key] = Number(row[field.key] ?? 0);
      else out[field.key] = String(row[field.key] ?? '');
    }
    out.id = String(row.id ?? row.uuid ?? row.key ?? crypto.randomUUID());
    out.updated = String(row.updated ?? row.modified ?? row.lastSeen ?? '');
    return out;
  }

  function resetDraft() {
    draft = buildDefaults(rowFields);
    validation = {};
    editingId = null;
    showChangePassword = false;
  }

  function validateDraft() {
    const next: Record<string, string> = {};
    for (const field of rowFields) {
      if (field.key === 'password' && editingId && !showChangePassword) continue;
      if (field.required && !String(draft[field.key] ?? '').trim()) next[field.key] = `${field.label} is required.`;
      if (field.kind === 'number' && !Number.isFinite(Number(draft[field.key] ?? 0))) {
        next[field.key] = `${field.label} must be a valid number.`;
      }
    }
    const email = String(draft.email ?? '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Email must use a valid address format.';
    if (!editingId || showChangePassword) {
      const password = String(draft.password ?? '');
      if (password.length > 0 && password.length < 8) next.password = 'Password must be at least 8 characters.';
    }
    validation = next;
    return Object.keys(next).length === 0;
  }

  async function loadSettings() {
    try {
      const payload = await api.get<Record<string, any>>('/users/settings');
      const normalized = normalizeRecord(payload, settingsFields);
      for (const field of settingsFields) settings[field.key] = normalized[field.key];
    } catch {
      for (const field of settingsFields) settings[field.key] = getDefaultValue(field);
      toasts.error($_('users.toastfailed_to_load_page_settings'));
    }
  }

  async function loadRows() {
    loadingRows = true;
    try {
      const payload = await api.get<unknown[]>('/users');
      rows = Array.isArray(payload) ? payload.map((entry) => normalizeRecord(entry, rowFields)) : [];
    } catch {
      rows = [];
      toasts.error($_('users.toastfailed_to_load_inline_records'));
    } finally {
      loadingRows = false;
    }
  }

  async function loadSecondary() {
    const next: Record<string, Record<string, any>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = Array.isArray(payload)
          ? payload.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as Record<string, any>) : {}))
          : [];
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function loadAll() {
    loading = true;
    await Promise.all([loadSettings(), loadRows(), loadSecondary()]);
    loading = false;
  }

  async function saveSettings() {
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of settingsFields) payload[field.key] = settings[field.key];
      await api.put('/users/settings', payload);
      toasts.success($_('users.toastsettings_saved'));
    } catch {
      toasts.error($_('users.toastfailed_to_save_settings'));
    } finally {
      saving = false;
    }
  }

  async function saveRow() {
    if (!validateDraft()) {
      toasts.error($_('users.toastplease_resolve_validation_errors_before_savin'));
      return;
    }
    saving = true;
    try {
      const payload: Record<string, any> = {};
      for (const field of rowFields) {
        if (field.key === 'password' && editingId && !showChangePassword) continue;
        const val = draft[field.key]; if (field.nullable && (val === '' || val === undefined)) { payload[field.key] = null; } else if (field.kind === 'number') { payload[field.key] = val === '' ? 0 : Number(val); } else { payload[field.key] = val; }
      }
      if (editingId) await api.put(`/users/${editingId}`, payload);
      else await api.post('/users', payload);
      toasts.success(editingId ? 'User updated' : 'User added');
      resetDraft();
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('users.toastfailed_to_save_user'));
    } finally {
      saving = false;
    }
  }

  function editRow(row: Record<string, any>) {
    draft = { ...row, password: '' };
    validation = {};
    editingId = String(row.id);
    showChangePassword = false;
  }

  async function deleteRow(id: string) {
    deleting = true;
    try {
      await api.del(`/users/${id}`);
      toasts.success($_('users.toastuser_deleted'));
      await Promise.all([loadRows(), loadSecondary()]);
    } catch {
      toasts.error($_('users.toastfailed_to_delete_user'));
    } finally {
      deleting = false;
    }
  }

  function matchesStatus(row: Record<string, any>) {
    if (statusFilter === 'all') return true;
    return Boolean(row.enabled) === (statusFilter === 'enabled');
  }

  function rowSearchText(row: Record<string, any>) {
    return Object.values(row).map((value) => String(value ?? '').toLowerCase()).join(' ');
  }

  function valueText(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  const filteredRows = $derived.by(() => {
    const matched = rows.filter((row) => {
      if (!matchesStatus(row)) return false;
      if (!search) return true;
      return rowSearchText(row).includes(search.toLowerCase());
    });
    return [...matched].sort((a, b) => {
      const left = a[sortField];
      const right = b[sortField];
      let delta = String(left ?? '').localeCompare(String(right ?? ''));
      if (sortDirection === 'desc') delta *= -1;
      return delta;
    });
  });

  const activeCount = $derived(filteredRows.filter((row) => Boolean(row.enabled)).length);
  const disabledCount = $derived(filteredRows.filter((row) => !Boolean(row.enabled)).length);
  const errorCount = $derived.by(() => Object.keys(validation).length);
  const basicRowFields = $derived.by(() => rowFields.filter((field) => !field.advanced && field.key !== 'password'));
  const advancedRowFields = $derived.by(() => rowFields.filter((field) => Boolean(field.advanced)));
  const basicSettingsFields = $derived.by(() => settingsFields.filter((field) => !field.advanced));
  const advancedSettingsFields = $derived.by(() => settingsFields.filter((field) => Boolean(field.advanced)));

  onMount(() => {
    resetDraft();
    void loadAll();
  });

  $effect(() => {
    if (timer) clearInterval(timer);
    if (Boolean(settings.autoRefresh) && Number(settings.refreshSeconds) > 0) {
      timer = setInterval(() => {
        void Promise.all([loadRows(), loadSecondary()]);
      }, Number(settings.refreshSeconds) * 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
  });
</script>

<div class="space-y-6">
  <div class="grid gap-4 md:grid-cols-3">
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('users.active_profiles')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-cyan-400">{activeCount}</p></CardContent>
    </Card>
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('users.disabled_profiles')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-amber-300">{disabledCount}</p></CardContent>
    </Card>
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader class="pb-2"><CardTitle class="text-sm text-slate-200">{$_('users.validation_issues')}</CardTitle></CardHeader>
      <CardContent><p class="text-2xl font-semibold text-rose-300">{errorCount}</p></CardContent>
    </Card>
  </div>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle class="text-slate-100">{editingId ? 'Edit User' : 'Add User'}</CardTitle>
          <CardDescription class="text-slate-400">{$_('users.create_and_manage_local_user_accounts_roles_and_ap')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadRows()} disabled={loadingRows || saving}>
            <RefreshCw class="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveRow()} disabled={saving}>
            {#if editingId}<Save class="mr-2 h-4 w-4" />Update User{:else}<Plus class="mr-2 h-4 w-4" />Add User{/if}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        {#each basicRowFields as field}
          <div>
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === 'boolean'}
              <div class="mt-2 flex h-9 items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3">
                <span class="text-xs" class:text-emerald-300={Boolean(draft[field.key])} class:text-slate-400={!Boolean(draft[field.key])}>{Boolean(draft[field.key]) ? 'Enabled' : 'Disabled'}</span>
                <Switch checked={Boolean(draft[field.key])} onCheckedChange={(checked) => (draft[field.key] = checked)} />
              </div>
            {:else if field.kind === 'select'}
              <Select.Root type="single" value={String(draft[field.key] ?? '')} onValueChange={(value) => value && (draft[field.key] = value)}>
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{field.options?.find((option) => option.value === String(draft[field.key]))?.label ?? 'Select value'}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each field.options ?? [] as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />{/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="text" value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = (event.currentTarget as HTMLInputElement).value)} />
            {/if}
            {#if validation[field.key]}<p class="mt-2 text-xs text-rose-300">{validation[field.key]}</p>{/if}
          </div>
        {/each}
      </div>

      {#if editingId}
        <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <FieldLabel label="Change Password" hint={rowFields.find((field) => field.key === 'password')?.hint ?? ''} />
          <div class="mt-2 flex h-9 items-center justify-between">
            <span class="text-xs text-slate-400">{$_('users.enable_to_set_a_new_password_while_editing_this_ac')}</span>
            <Switch checked={showChangePassword} onCheckedChange={(checked) => (showChangePassword = checked)} />
          </div>
        </div>
      {/if}

      <Collapsible.Root bind:open={showFormAdvanced} class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <Collapsible.Trigger class="flex w-full items-center justify-between text-sm font-medium text-slate-200">
          Advanced user fields
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showFormAdvanced ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="pt-4">
          <div class="grid gap-4 md:grid-cols-2">
            {#each advancedRowFields as field}
              {#if field.key !== 'password' || !editingId || showChangePassword}
                <div class={field.kind === 'textarea' ? 'md:col-span-2' : ''}>
                  <FieldLabel label={field.label} hint={field.hint} />
                  {#if field.kind === 'boolean'}
                    <div class="mt-2 flex h-9 items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3">
                      <span class="text-xs text-slate-400">{Boolean(draft[field.key]) ? 'Enabled' : 'Disabled'}</span>
                      <Switch checked={Boolean(draft[field.key])} onCheckedChange={(checked) => (draft[field.key] = checked)} />
                    </div>
                  {:else if field.kind === 'textarea'}
                    <Textarea class="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100" value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = (event.currentTarget as HTMLTextAreaElement).value)} />
                  {:else if field.kind === 'number'}
                    <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = Number((event.currentTarget as HTMLInputElement).value || 0))} />
                  {:else}
                    <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="text" value={String(draft[field.key] ?? '')} oninput={(event) => (draft[field.key] = (event.currentTarget as HTMLInputElement).value)} />
                  {/if}
                  {#if validation[field.key]}<p class="mt-2 text-xs text-rose-300">{validation[field.key]}</p>{/if}
                </div>
              {/if}
            {/each}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="flex gap-2">
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={resetDraft}>Clear</Button>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('users.users')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('users.searchable_user_inventory_with_inline_edit_and_del')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-950 text-slate-100" placeholder={$_('users.placeholdersearch_users')} value={search} oninput={(event) => (search = (event.currentTarget as HTMLInputElement).value)} />
        <Select.Root type="single" value={statusFilter} onValueChange={(value) => value && (statusFilter = value)}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>{statusFilter === 'all' ? 'All status' : statusFilter === 'enabled' ? 'Enabled only' : 'Disabled only'}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="all" label="All status" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="enabled" label="Enabled only" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="disabled" label="Disabled only" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
        <Select.Root type="single" value={sortField} onValueChange={(value) => value && (sortField = value)}>
          <Select.Trigger class="w-full border-slate-700 bg-slate-950 text-slate-100"><span>Sort by {sortField}</span></Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
            <Select.Item value="username" label="Username" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="fullName" label="Full Name" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="email" label="Email" class="cursor-pointer hover:bg-slate-800" />
            <Select.Item value="role" label="Role" class="cursor-pointer hover:bg-slate-800" />
          </Select.Content>
        </Select.Root>
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => (sortDirection = sortDirection === 'asc' ? 'desc' : 'asc')}>
          Direction: {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </Button>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-2 text-left">Username</th>
              <th class="px-3 py-2 text-left">Full Name</th>
              <th class="px-3 py-2 text-left">Email</th>
              <th class="px-3 py-2 text-left">Role</th>
              <th class="px-3 py-2 text-left">Enabled</th>
              <th class="px-3 py-2 text-left">MFA</th>
              <th class="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if loadingRows}
              <tr><td class="px-3 py-6 text-center text-slate-400" colspan={7}>Loading users...</td></tr>
            {:else if filteredRows.length === 0}
              <tr><td class="px-3 py-6 text-center text-slate-500" colspan={7}>No users match the current filters.</td></tr>
            {:else}
              {#each filteredRows as row}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  <td class="px-3 py-2 text-xs">{valueText(row.username)}</td>
                  <td class="px-3 py-2 text-xs">{valueText(row.fullName)}</td>
                  <td class="px-3 py-2 text-xs">{valueText(row.email)}</td>
                  <td class="px-3 py-2 text-xs">{valueText(row.role)}</td>
                  <td class="px-3 py-2 text-xs"><span class={Boolean(row.enabled) ? 'text-emerald-300' : 'text-amber-300'}>{Boolean(row.enabled) ? 'Enabled' : 'Disabled'}</span></td>
                  <td class="px-3 py-2 text-xs"><span class={Boolean(row.mfaEnabled) ? 'text-cyan-300' : 'text-slate-400'}>{Boolean(row.mfaEnabled) ? 'On' : 'Off'}</span></td>
                  <td class="px-3 py-2">
                    <div class="flex gap-2">
                      <Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editRow(row)}><Pencil class="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="outline" class="border-red-500/50 text-red-300 hover:bg-red-950/40" disabled={deleting} onclick={() => void deleteRow(String(row.id ?? ''))}><Trash2 class="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader>
        <div class="flex items-center justify-between gap-2">
          <div>
            <CardTitle class="text-slate-100">{section.title}</CardTitle>
            <CardDescription class="text-slate-400">{section.description}</CardDescription>
          </div>
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadSecondary()}>
            <RefreshCw class="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400"><tr>{#each section.columns as column}<th class="px-3 py-2 text-left">{column}</th>{/each}</tr></thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No users found.</td></tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">{#each section.columns as column}<td class="px-3 py-2 text-xs">{valueText(row[column])}</td>{/each}</tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {/each}

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('users.settings')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('users.user_management_behavior_and_operational_defaults')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        {#each basicSettingsFields as field}
          <div>
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === 'boolean'}
              <div class="mt-2 flex h-9 items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3">
                <span class="text-xs text-slate-400">{Boolean(settings[field.key]) ? 'Enabled' : 'Disabled'}</span>
                <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
              </div>
            {:else if field.kind === 'select'}
              <Select.Root type="single" value={String(settings[field.key] ?? '')} onValueChange={(value) => value && (settings[field.key] = value)}>
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100"><span>{field.options?.find((option) => option.value === String(settings[field.key]))?.label ?? 'Select value'}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">{#each field.options ?? [] as option}<Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />{/each}</Select.Content>
              </Select.Root>
            {:else}
              <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={String(settings[field.key] ?? '')} oninput={(event) => (settings[field.key] = field.kind === 'number' ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)} />
            {/if}
          </div>
        {/each}
      </div>

      <Collapsible.Root bind:open={showAdvanced} class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <Collapsible.Trigger class="flex w-full items-center justify-between text-sm font-medium text-slate-200">
          Advanced settings
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="pt-4">
          <div class="grid gap-4 md:grid-cols-2">
            {#each advancedSettingsFields as field}
              <div>
                <FieldLabel label={field.label} hint={field.hint} />
                {#if field.kind === 'boolean'}
                  <div class="mt-2 flex h-9 items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3">
                    <span class="text-xs text-slate-400">{Boolean(settings[field.key]) ? 'Enabled' : 'Disabled'}</span>
                    <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
                  </div>
                {:else}
                  <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === 'number' ? 'number' : 'text'} value={String(settings[field.key] ?? '')} oninput={(event) => (settings[field.key] = field.kind === 'number' ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)} />
                {/if}
              </div>
            {/each}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>

      <div class="flex justify-end gap-2">
        <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => void loadSettings()} disabled={saving}>Reset</Button>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveSettings()} disabled={saving || loading}>
          <Save class="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </CardContent>
  </Card>
</div>
