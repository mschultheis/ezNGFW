<!-- Route view for `/backup` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import StatusPill from '$lib/components/admin/StatusPill.svelte';
  import { toasts } from '$lib/stores/toast';
  import { asObject, asList, asString } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Badge } from '$lib/components/ui/badge';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import SaveIcon from '@lucide/svelte/icons/save';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { _ } from '$lib/i18n';

  /* ── Types & defaults ─────────────────────────────────── */

  type BackupSettings = {
    autoBackup: boolean;
    schedule: string;
    retentionDays: number;
    retentionCount: number;
    remoteTarget: string;
    remoteType: string;
    remoteUsername: string;
    remotePassword: string;
    encryptionEnabled: boolean;
    encryptionPassword: string;
    includeRrdData: boolean;
    includeCertificates: boolean;
    includeDhcpLeases: boolean;
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
    notifyEmail: string;
  };

  const defaults: BackupSettings = {
    autoBackup: false,
    schedule: '0 2 * * *',
    retentionDays: 30,
    retentionCount: 10,
    remoteTarget: '',
    remoteType: 'local',
    remoteUsername: '',
    remotePassword: '',
    encryptionEnabled: false,
    encryptionPassword: '',
    includeRrdData: true,
    includeCertificates: true,
    includeDhcpLeases: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
    notifyEmail: ''
  };

  let settings = $state<BackupSettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let creating = $state(false);
  let downloading = $state(false);
  let restoring = $state(false);
  let importing = $state(false);
  let restoreFile = $state<File | null>(null);
  let configFile = $state<File | null>(null);
  let operationPassword = $state('');
  let showAdvanced = $state(false);

  type HistoryRow = Record<string, unknown>;
  let history = $state<HistoryRow[]>([]);
  let historyLoading = $state(false);

  /* ── Remote target type options ───────────────────────── */

  const remoteTypeOptions = [
    { label: 'Local only', value: 'local' },
    { label: 'Amazon S3', value: 's3' },
    { label: 'SFTP', value: 'sftp' },
    { label: 'NFS', value: 'nfs' },
    { label: 'SMB/CIFS', value: 'smb' },
    { label: 'Google Cloud Storage', value: 'gcs' },
    { label: 'WebDAV', value: 'webdav' }
  ];

  /* ── Data fetching ────────────────────────────────────── */

  async function load() {
    loading = true;
    try {
      const [payload, histPayload] = await Promise.all([
        api.get('/backup/config'),
        api.get('/backup/history')
      ]);
      const d = asObject(payload);
      settings = {
        autoBackup: Boolean(d.autoBackup ?? defaults.autoBackup),
        schedule: String(d.schedule ?? defaults.schedule),
        retentionDays: Number(d.retentionDays ?? defaults.retentionDays),
        retentionCount: Number(d.retentionCount ?? defaults.retentionCount),
        remoteTarget: String(d.remoteTarget ?? defaults.remoteTarget),
        remoteType: String(d.remoteType ?? defaults.remoteType),
        remoteUsername: String(d.remoteUsername ?? defaults.remoteUsername),
        remotePassword: String(d.remotePassword ?? defaults.remotePassword),
        encryptionEnabled: Boolean(d.encryptionEnabled ?? defaults.encryptionEnabled),
        encryptionPassword: String(d.encryptionPassword ?? defaults.encryptionPassword),
        includeRrdData: Boolean(d.includeRrdData ?? defaults.includeRrdData),
        includeCertificates: Boolean(d.includeCertificates ?? defaults.includeCertificates),
        includeDhcpLeases: Boolean(d.includeDhcpLeases ?? defaults.includeDhcpLeases),
        notifyOnSuccess: Boolean(d.notifyOnSuccess ?? defaults.notifyOnSuccess),
        notifyOnFailure: Boolean(d.notifyOnFailure ?? defaults.notifyOnFailure),
        notifyEmail: String(d.notifyEmail ?? defaults.notifyEmail)
      };
      history = asList(histPayload);
    } catch (e) {
      settings = { ...defaults };
      toasts.error(e instanceof Error ? e.message : 'Failed to load backup settings');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/backup/config', settings);
      toasts.success($_('backup.toastbackup_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save backup settings');
    } finally {
      saving = false;
    }
  }

  async function loadHistory() {
    historyLoading = true;
    try {
      history = asList(await api.get('/backup/history'));
    } catch { history = []; }
    finally { historyLoading = false; }
  }

  /* ── Operations ───────────────────────────────────────── */

  async function createBackup() {
    creating = true;
    try {
      await api.post('/backup/create', {
        encryptionPassword: operationPassword || undefined
      });
      toasts.success($_('backup.toastbackup_creation_started'));
      await loadHistory();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create backup');
    } finally { creating = false; }
  }

  async function downloadBackup() {
    downloading = true;
    try {
      const params = new URLSearchParams();
      if (operationPassword) params.set('encryptionPassword', operationPassword);
      const urlPath = params.toString() ? `/api/backup/download?${params}` : '/api/backup/download';
      const res = await fetch(urlPath, {
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ezngfw-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
      a.click();
      URL.revokeObjectURL(url);
      toasts.success($_('backup.toastbackup_downloaded'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Backup download failed');
    } finally { downloading = false; }
  }

  async function restoreBackup() {
    if (!restoreFile) { toasts.warning('Select a backup file first'); return; }
    restoring = true;
    try {
      const data = new FormData();
      data.append('file', restoreFile);
      if (operationPassword) data.append('encryptionPassword', operationPassword);
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined,
        body: data
      });
      if (!res.ok) throw new Error(await res.text());
      toasts.success($_('backup.toastrestore_uploaded_system_will_apply_and_reboot'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Restore failed');
    } finally { restoring = false; }
  }

  async function exportConfigJson() {
    try {
      const res = await fetch('/api/config/export', {
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ezngfw-config-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toasts.success($_('backup.toastconfiguration_exported'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Config export failed');
    }
  }

  async function importConfigJson() {
    if (!configFile) { toasts.warning('Select a config file first'); return; }
    importing = true;
    try {
      const data = new FormData();
      data.append('file', configFile);
      const res = await fetch('/api/config/import', {
        method: 'POST',
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined,
        body: data
      });
      if (!res.ok) throw new Error(await res.text());
      toasts.success($_('backup.toastconfiguration_import_queued_review_pending_ch'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Config import failed');
    } finally { importing = false; }
  }

  onMount(() => { void load(); });

</script>

<div class="space-y-6">
  <!-- ── Backup Schedule Settings ────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('backup.backup_schedule')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('backup.configure_automatic_backup_creation_retention_and')}</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}>
          <SaveIcon class="mr-2 size-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-3">
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
          <Skeleton class="h-9 bg-slate-800" />
        </div>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <!-- Auto-backup toggle -->
          <label class="space-y-1 text-sm md:col-span-2">
            <FieldLabel label="Automatic Backup" hint="Enable scheduled automatic backups. When active, the system creates encrypted snapshots according to the cron schedule below and uploads them to the configured remote target. Disable to rely on manual backups only. Example: enable for production appliances, disable on lab/test units." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.autoBackup} onCheckedChange={(v) => (settings.autoBackup = v)} />
              <span class="text-xs" class:text-emerald-400={settings.autoBackup} class:text-slate-500={!settings.autoBackup}>{settings.autoBackup ? 'Scheduled' : 'Manual only'}</span>
            </div>
          </label>

          <!-- Cron schedule -->
          <label class="space-y-1 text-sm">
            <FieldLabel label="Cron Schedule" hint="Standard 5-field cron expression that controls when automatic backups run. The fields are: minute hour day-of-month month day-of-week. Schedule during low-traffic windows to minimize performance impact. Example: '0 2 * * *' runs daily at 02:00, '0 3 * * 0' runs weekly Sunday 03:00." />
            <Input class="border-slate-700 bg-slate-950 font-mono text-slate-100" value={settings.schedule} oninput={(e) => (settings.schedule = (e.currentTarget as HTMLInputElement).value)} placeholder="0 2 * * *" />
          </label>

          <!-- Retention days -->
          <label class="space-y-1 text-sm">
            <FieldLabel label="Retention (days)" hint="Maximum age in days before old backups are automatically purged. Set to 0 to keep backups indefinitely (not recommended for remote targets with limited storage). Balance between compliance requirements and storage cost. Example: 30 for monthly rotation, 90 for quarterly compliance." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.retentionDays)} oninput={(e) => (settings.retentionDays = Number((e.currentTarget as HTMLInputElement).value || 30))} />
          </label>

          <!-- Retention count -->
          <label class="space-y-1 text-sm">
            <FieldLabel label="Max Backup Count" hint="Maximum number of backup snapshots to keep regardless of age. When this limit is reached, the oldest backup is deleted before a new one is created. Useful as a safety cap alongside day-based retention. Example: 10 keeps the last 10 snapshots." />
            <Input class="border-slate-700 bg-slate-950 text-slate-100" type="number" value={String(settings.retentionCount)} oninput={(e) => (settings.retentionCount = Number((e.currentTarget as HTMLInputElement).value || 10))} />
          </label>

          <!-- Remote type -->
          <label class="space-y-1 text-sm">
            <FieldLabel label="Remote Target Type" hint="Choose where backup archives are uploaded after creation. Local stores on the appliance disk only (lost if disk fails). S3, SFTP, NFS, and SMB provide off-site redundancy. Google Cloud Storage and WebDAV are also supported. Example: 's3' for AWS S3 buckets, 'sftp' for SSH file transfer." />
            <Select.Root type="single" value={settings.remoteType} onValueChange={(v) => { if (v) settings.remoteType = v; }}>
              <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                <span>{remoteTypeOptions.find(o => o.value === settings.remoteType)?.label ?? 'Select…'}</span>
              </Select.Trigger>
              <Select.Content class="border-slate-700 bg-slate-900">
                {#each remoteTypeOptions as opt}
                  <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                {/each}
              </Select.Content>
            </Select.Root>
          </label>

          <!-- Remote target path -->
          {#if settings.remoteType !== 'local'}
            <label class="space-y-1 text-sm">
              <FieldLabel label="Remote Path" hint="Full URI or path to the remote backup destination. Format depends on the remote type: S3 uses 's3://bucket/prefix', SFTP uses 'user@host:/path', NFS uses 'host:/export', SMB uses '//server/share/path'. Example: 's3://my-fw-backups/ezngfw/' or 'admin@backup-server:/var/backups/fw/'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.remoteTarget} oninput={(e) => (settings.remoteTarget = (e.currentTarget as HTMLInputElement).value)} placeholder="s3://bucket/path or user@host:/path" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Remote Username" hint="Authentication username for the remote target. For S3 this is the Access Key ID, for SFTP the SSH username, for SMB the domain\\user. Leave empty if using key-based or IAM authentication. Example: 'AKIAIOSFODNN7EXAMPLE' for S3." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" value={settings.remoteUsername} oninput={(e) => (settings.remoteUsername = (e.currentTarget as HTMLInputElement).value)} placeholder={$_('backup.placeholderaccess_key_or_username')} />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Remote Password" hint="Authentication password or secret key for the remote target. For S3 this is the Secret Access Key, for SFTP the SSH password (prefer key-based auth when possible). Stored encrypted in the configuration. Example: AWS secret key or SSH password." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="password" value={settings.remotePassword} oninput={(e) => (settings.remotePassword = (e.currentTarget as HTMLInputElement).value)} placeholder={$_('backup.placeholdersecret_key_or_password')} />
            </label>
          {/if}

          <!-- Encryption toggle -->
          <label class="space-y-1 text-sm md:col-span-2">
            <FieldLabel label="Encrypt Backups" hint="Enable AES-256 encryption for all backup archives. Encrypted backups cannot be restored without the password, so store it securely in a password manager or vault. Strongly recommended when using remote targets over untrusted networks. Example: always enable for S3/cloud targets." />
            <div class="flex h-9 items-center gap-3">
              <Switch checked={settings.encryptionEnabled} onCheckedChange={(v) => (settings.encryptionEnabled = v)} />
              <span class="text-xs" class:text-emerald-400={settings.encryptionEnabled} class:text-slate-500={!settings.encryptionEnabled}>{settings.encryptionEnabled ? 'AES-256 Encrypted' : 'Unencrypted'}</span>
            </div>
          </label>

          {#if settings.encryptionEnabled}
            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Encryption Password" hint="Passphrase used to encrypt and decrypt backup archives. Must be provided during restore. Use a strong passphrase (16+ characters with mixed case, numbers, symbols) and store it in your organization's password vault. Example: 'Fw-Backup-2024!SecureVault'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="password" value={settings.encryptionPassword} oninput={(e) => (settings.encryptionPassword = (e.currentTarget as HTMLInputElement).value)} placeholder={$_('backup.placeholderstrong_passphrase_for_backup_encryption')} />
            </label>
          {/if}
        </div>

        <!-- Advanced settings collapsible -->
        <button class="mt-4 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 cursor-pointer" onclick={() => (showAdvanced = !showAdvanced)}>
          {#if showAdvanced}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
          Advanced Options
        </button>

        {#if showAdvanced}
          <div class="mt-3 grid gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="Include RRD Data" hint="Include round-robin database files (traffic graphs, monitoring history) in backups. Disabling reduces backup size significantly but you lose historical monitoring data on restore. Example: enable for production, disable for config-only migrations." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.includeRrdData} onCheckedChange={(v) => (settings.includeRrdData = v)} />
                <span class="text-xs text-slate-400">{settings.includeRrdData ? 'Included' : 'Excluded'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Include Certificates" hint="Include TLS/SSL certificates and private keys in backups. Required if you want a full restore without re-issuing certificates. Disable only if certificates are managed externally (e.g. ACME auto-renewal). Example: enable for manual certificate deployments." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.includeCertificates} onCheckedChange={(v) => (settings.includeCertificates = v)} />
                <span class="text-xs text-slate-400">{settings.includeCertificates ? 'Included' : 'Excluded'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Include DHCP Leases" hint="Include current DHCP lease database in backups. Preserves IP-to-device mappings across restores so clients keep their addresses. Disable if DHCP lease continuity is not important. Example: enable for environments with many static-mapped clients." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.includeDhcpLeases} onCheckedChange={(v) => (settings.includeDhcpLeases = v)} />
                <span class="text-xs text-slate-400">{settings.includeDhcpLeases ? 'Included' : 'Excluded'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Notify on Success" hint="Send an email notification after each successful backup. Useful for audit trails and confirming that scheduled backups are running as expected. Disable if you only want failure alerts. Example: enable for compliance environments." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.notifyOnSuccess} onCheckedChange={(v) => (settings.notifyOnSuccess = v)} />
                <span class="text-xs text-slate-400">{settings.notifyOnSuccess ? 'Enabled' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Notify on Failure" hint="Send an email alert when a backup job fails. Strongly recommended so you can fix issues before your backup window is missed. Pair with monitoring for critical infrastructure. Example: always enable in production." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.notifyOnFailure} onCheckedChange={(v) => (settings.notifyOnFailure = v)} />
                <span class="text-xs text-slate-400">{settings.notifyOnFailure ? 'Enabled' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Notification Email" hint="Email address that receives backup success and failure notifications. Can be a distribution list or ticketing system intake address. Must be reachable from the appliance SMTP configuration. Example: 'ops-alerts@company.com'." />
              <Input class="border-slate-700 bg-slate-950 text-slate-100" type="email" value={settings.notifyEmail} oninput={(e) => (settings.notifyEmail = (e.currentTarget as HTMLInputElement).value)} placeholder="ops-alerts@company.com" />
            </label>
          </div>
        {/if}
      {/if}
    </CardContent>
  </Card>

  <!-- ── Manual Backup Operations ────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('backup.backup_operations')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('backup.create_download_and_restore_encrypted_firewall_con')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <label class="space-y-1 text-sm">
        <FieldLabel label="Operation Password" hint="Optional passphrase for this specific backup or restore operation. If the backup was encrypted, you must provide the same passphrase used during creation. For new backups, this overrides the default encryption password from settings above. Example: leave empty to use the configured default." />
        <Input class="border-slate-700 bg-slate-950 text-slate-100" type="password" bind:value={operationPassword} placeholder={$_('backup.placeholderoptional_passphrase_for_this_operation')} />
      </label>

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={createBackup} disabled={creating}>
          <SaveIcon class="mr-2 size-4" />
          {creating ? 'Creating…' : 'Create Backup Now'}
        </Button>
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={downloadBackup} disabled={downloading}>
          <DownloadIcon class="mr-2 size-4" />
          {downloading ? 'Downloading…' : 'Download Latest'}
        </Button>
      </div>

      <div class="rounded-md border border-slate-800 p-4">
        <p class="mb-2 text-sm font-medium text-slate-200">{$_('backup.restore_from_backup')}</p>
        <p class="mb-3 text-xs text-slate-500">{$_('backup.upload_a_previously_exported_targz_backup_archive')}</p>
        <div class="flex flex-wrap items-center gap-2">
          <Input type="file" accept=".tar,.tar.gz,.tgz,.zip" onchange={(e) => (restoreFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
          <Button class="bg-red-500 text-white hover:bg-red-600" onclick={restoreBackup} disabled={restoring}>
            <ArchiveRestoreIcon class="mr-2 size-4" />
            {restoring ? 'Restoring…' : 'Upload & Restore'}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- ── Config Export / Import ──────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('backup.config_export_import')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('backup.move_raw_json_configuration_snapshots_between_appl')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={exportConfigJson}>
        <DownloadIcon class="mr-2 size-4" />
        Export Config (JSON)
      </Button>
      <div class="flex flex-wrap items-center gap-2">
        <Input type="file" accept=".json" onchange={(e) => (configFile = (e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={importConfigJson} disabled={importing}>
          <UploadIcon class="mr-2 size-4" />
          {importing ? 'Importing…' : 'Import Config'}
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- ── Backup History ──────────────────────────────── -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('backup.backup_history')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('backup.previous_backup_snapshots_with_timestamps_sizes_an')}</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={loadHistory} disabled={historyLoading}>
          <RefreshCwIcon class="mr-2 size-4" />
          Refresh
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-800">
            <TableRow class="border-slate-700 hover:bg-slate-800">
              <TableHead class="text-slate-300">{$_('backup.date')}</TableHead>
              <TableHead class="text-slate-300">{$_('backup.size')}</TableHead>
              <TableHead class="text-slate-300">{$_('backup.type')}</TableHead>
              <TableHead class="text-slate-300">{$_('backup.target')}</TableHead>
              <TableHead class="text-slate-300">{$_('backup.status')}</TableHead>
              <TableHead class="text-slate-300">{$_('backup.notes')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if history.length === 0}
              <TableRow class="border-slate-800 hover:bg-slate-900">
                <TableCell class="py-8 text-center text-slate-500" colspan={6}>No backup history available</TableCell>
              </TableRow>
            {:else}
              {#each history as row}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="font-mono text-xs">{asString(row.date ?? row.timestamp)}</TableCell>
                  <TableCell>{asString(row.size)}</TableCell>
                  <TableCell>{asString(row.type)}</TableCell>
                  <TableCell>{asString(row.target ?? row.remoteTarget ?? 'local')}</TableCell>
                  <TableCell>
                    <StatusPill status={asString(row.status)} />
                  </TableCell>
                  <TableCell class="text-xs text-slate-400">{asString(row.notes ?? row.message ?? '')}</TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
</div>
