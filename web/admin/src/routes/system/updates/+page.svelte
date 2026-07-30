<!-- Route view for `/system/updates` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import StatusPill from '$lib/components/admin/StatusPill.svelte';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import History from '@lucide/svelte/icons/history';
  import Power from '@lucide/svelte/icons/power';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { _ } from '$lib/i18n';

  type UpdateChannel = { name: string; url: string; description: string };
  type UpdatePackage = {
    name: string;
    current_version: string;
    new_version: string;
    size_bytes: number;
    changelog: string;
    requires_reboot: boolean;
  };
  type UpdateInfo = {
    update_available: boolean;
    current_version: string;
    latest_version: string;
    channel: string;
    packages: UpdatePackage[];
    total_download_size: number;
    requires_reboot: boolean;
    release_date: string;
    changelog_html: string;
    checked_at: number;
  };
  type UpdateProgress = {
    status: 'Idle' | 'Checking' | 'Downloading' | 'Installing' | 'WaitingReboot' | 'Failed' | 'Complete';
    percent: number;
    message: string;
    started_at: number;
    package_name: string | null;
    log_lines: string[];
  };
  type UpdateHistoryEntry = {
    version: string;
    installed_at: number;
    from_version: string;
    packages_updated: number;
    success: boolean;
    reboot_performed: boolean;
    log_summary: string;
  };

  const defaultInfo: UpdateInfo = {
    update_available: false,
    current_version: '-',
    latest_version: '-',
    channel: 'stable',
    packages: [],
    total_download_size: 0,
    requires_reboot: false,
    release_date: '-',
    changelog_html: '<p>No update metadata loaded yet.</p>',
    checked_at: 0
  };

  const defaultProgress: UpdateProgress = {
    status: 'Idle',
    percent: 0,
    message: 'Idle',
    started_at: 0,
    package_name: null,
    log_lines: []
  };

  let loading = $state(true);
  let updateInfo = $state<UpdateInfo>({ ...defaultInfo });
  let progress = $state<UpdateProgress>({ ...defaultProgress });
  let channels = $state<UpdateChannel[]>([]);
  let selectedChannel = $state('stable');
  let history = $state<UpdateHistoryEntry[]>([]);
  let showHistory = $state(true);
  let uploading = $state(false);
  let uploadFile = $state<File | null>(null);
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let logContainer = $state<HTMLDivElement | null>(null);

  const isBusy = $derived(['Checking', 'Downloading', 'Installing'].includes(progress.status));
  const waitingReboot = $derived(progress.status === 'WaitingReboot');

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatTime = (stamp: number) => {
    if (!stamp) return 'Never';
    return new Date(stamp * 1000).toLocaleString();
  };

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function loadInfo() {
    const data = await api.get<UpdateInfo>('/updates/info');
    updateInfo = data;
    selectedChannel = data.channel || selectedChannel;
  }

  async function loadChannels() {
    const data = await api.get<{ current: string; channels: UpdateChannel[] }>('/updates/channels');
    selectedChannel = data.current;
    channels = Array.isArray(data.channels) ? data.channels : [];
  }

  async function loadHistory() {
    const data = await api.get<{ entries: UpdateHistoryEntry[] }>('/updates/history');
    history = Array.isArray(data.entries) ? data.entries : [];
  }

  async function loadProgress() {
    progress = await api.get<UpdateProgress>('/updates/status');
    if (logContainer) {
      await tick();
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  async function loadAll() {
    loading = true;
    try {
      await Promise.all([loadInfo(), loadChannels(), loadHistory(), loadProgress()]);
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load update state');
    } finally {
      loading = false;
    }
  }

  async function pollStatus() {
    try {
      await loadProgress();
      if (['Checking', 'Downloading', 'Installing'].includes(progress.status)) {
        pollTimer = setTimeout(() => {
          void pollStatus();
        }, 1200);
        return;
      }
      await Promise.all([loadInfo(), loadHistory()]);
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to poll update status');
    } finally {
      if (!['Checking', 'Downloading', 'Installing'].includes(progress.status)) {
        stopPolling();
      }
    }
  }

  async function checkForUpdates() {
    stopPolling();
    try {
      await api.post('/updates/check');
      toasts.success($_('system_updates.toastupdate_check_started'));
      await loadProgress();
      void pollStatus();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to start update check');
    }
  }

  async function installUpdate() {
    if (!updateInfo.update_available) {
      toasts.warning('No update is available to install');
      return;
    }
    if (!confirm(`Install update ${updateInfo.latest_version} now?`)) return;

    stopPolling();
    try {
      await api.post('/updates/install');
      toasts.success($_('system_updates.toastupdate_installation_started'));
      await loadProgress();
      void pollStatus();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to start installation');
    }
  }

  async function setChannel(channel: string) {
    if (!channel || channel === selectedChannel) return;
    try {
      await api.put('/updates/channel', { channel });
      selectedChannel = channel;
      toasts.success(`Update channel switched to ${channel}`);
      await loadInfo();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to switch update channel');
      await loadChannels();
    }
  }

  async function uploadOfflinePackage() {
    if (!uploadFile) {
      toasts.warning('Select an offline update package first');
      return;
    }

    uploading = true;
    try {
      const body = new FormData();
      body.append('file', uploadFile);
      const res = await fetch('/api/updates/upload', {
        method: 'POST',
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : undefined,
        body
      });
      if (!res.ok) throw new Error(await res.text());
      toasts.success($_('system_updates.toastoffline_package_uploaded'));
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Offline upload failed');
    } finally {
      uploading = false;
    }
  }

  async function requestReboot() {
    if (!confirm('Schedule reboot now to complete the update?')) return;
    try {
      await api.post('/updates/reboot');
      toasts.success($_('system_updates.toastreboot_scheduled'));
      await Promise.all([loadProgress(), loadHistory()]);
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to schedule reboot');
    }
  }

  onMount(() => {
    void loadAll();
    return () => stopPolling();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle class="text-slate-100">{$_('system_updates.firmware_updates')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('system_updates.check_stage_and_install_signed_firmware_and_packag')}</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" disabled={loading || isBusy} onclick={checkForUpdates}>
          <RefreshCw class="mr-2 size-4" />
          {isBusy && progress.status === 'Checking' ? 'Checking…' : 'Check for Updates'}
        </Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">{$_('system_updates.current_version')}</p>
          <p class="font-mono text-sm text-slate-100">{updateInfo.current_version}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">{$_('system_updates.latest_version')}</p>
          <p class="font-mono text-sm text-slate-100">{updateInfo.latest_version}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950 p-3">
          <p class="text-xs text-slate-500">{$_('system_updates.last_checked')}</p>
          <p class="text-sm text-slate-100">{formatTime(updateInfo.checked_at)}</p>
        </div>
      </div>

      <label class="space-y-1 text-sm">
        <FieldLabel label="Update Channel" hint="Choose the release train used for metadata checks and package installs." />
        <Select.Root
          type="single"
          value={selectedChannel}
          onValueChange={(value) => {
            if (value) {
              void setChannel(value);
            }
          }}
        >
          <Select.Trigger class="w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
            <span>{channels.find((entry) => entry.name === selectedChannel)?.name ?? selectedChannel}</span>
          </Select.Trigger>
          <Select.Content class="border-slate-700 bg-slate-900">
            {#each channels as channel}
              <Select.Item value={channel.name} label={channel.name} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
            {/each}
          </Select.Content>
        </Select.Root>
      </label>
    </CardContent>
  </Card>

  {#if updateInfo.update_available}
    <Card class="border-emerald-500/30 bg-emerald-500/5">
      <CardContent class="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p class="text-sm font-semibold text-emerald-200">Update available: {updateInfo.current_version} -&gt; {updateInfo.latest_version}</p>
          <p class="text-xs text-emerald-100/80">Download size: {formatBytes(updateInfo.total_download_size)} | Release date: {updateInfo.release_date}</p>
        </div>
        <div class="flex items-center gap-2">
          {#if updateInfo.requires_reboot}
            <Badge class="border-amber-500/40 bg-amber-500/20 text-amber-200">{$_('system_updates.reboot_required')}</Badge>
          {/if}
          <Button class="bg-emerald-600 text-white hover:bg-emerald-700" disabled={isBusy} onclick={installUpdate}>
            <Download class="mr-2 size-4" />Install Update
          </Button>
        </div>
      </CardContent>
    </Card>
  {/if}

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('system_updates.changelog')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('system_updates.release_notes_for_the_current_update_candidate')}</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="max-h-52 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
        {@html updateInfo.changelog_html}
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('system_updates.package_plan')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('system_updates.packages_included_in_the_next_update_installation')}</CardDescription>
    </CardHeader>
    <CardContent class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-slate-800 text-left text-slate-400">
            <th class="px-3 py-2">Package</th>
            <th class="px-3 py-2">Version</th>
            <th class="px-3 py-2">Size</th>
            <th class="px-3 py-2">Flags</th>
          </tr>
        </thead>
        <tbody>
          {#if updateInfo.packages.length === 0}
            <tr>
              <td class="px-3 py-3 text-slate-500" colspan="4">No packages queued. Run a check to populate update metadata.</td>
            </tr>
          {:else}
            {#each updateInfo.packages as pkg}
              <tr class="border-b border-slate-800/70 text-slate-200 last:border-b-0">
                <td class="px-3 py-2 font-mono">{pkg.name}</td>
                <td class="px-3 py-2 font-mono">{pkg.current_version} -&gt; {pkg.new_version}</td>
                <td class="px-3 py-2">{formatBytes(pkg.size_bytes)}</td>
                <td class="px-3 py-2">{#if pkg.requires_reboot}<Badge class="border-amber-500/40 bg-amber-500/20 text-amber-200">{$_('system_updates.reboot')}</Badge>{/if}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('system_updates.update_progress')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('system_updates.live_status_while_checking_or_installing_updates')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <StatusPill status={String(progress.status)} />
        <span class="text-sm text-slate-300">{progress.message}</span>
        {#if progress.package_name}
          <span class="text-xs text-slate-500">Package: {progress.package_name}</span>
        {/if}
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="h-full bg-cyan-500 transition-all duration-300" style={`width: ${Math.min(Math.max(progress.percent, 0), 100)}%`}></div>
      </div>
      <div bind:this={logContainer} class="max-h-48 overflow-auto rounded-md border border-slate-800 bg-black/30 p-3 font-mono text-xs text-emerald-300">
        {#if progress.log_lines.length === 0}
          <div class="text-slate-500">No log output yet.</div>
        {:else}
          {#each progress.log_lines as line}
            <div>{line}</div>
          {/each}
        {/if}
      </div>

      {#if waitingReboot}
        <div class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">
          <p class="text-sm font-medium">{$_('system_updates.update_complete_reboot_required')}</p>
          <Button class="mt-2 bg-amber-500 text-slate-900 hover:bg-amber-400" onclick={requestReboot}>
            <Power class="mr-2 size-4" />Reboot Now
          </Button>
        </div>
      {:else if progress.status === 'Complete'}
        <div class="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Update complete - no reboot needed.
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('system_updates.offline_update')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('system_updates.upload_update_bundles_for_disconnected_deployments')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <label class="space-y-1 text-sm">
        <FieldLabel label="Update Package" hint="Upload a signed offline package generated by your internal mirror." />
        <Input type="file" accept=".pkg,.tar,.txz,.zip,.img,.bin" onchange={(event) => (uploadFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
      </label>
      <Button variant="outline" class="border-slate-700 text-slate-100" disabled={uploading} onclick={uploadOfflinePackage}>
        <Upload class="mr-2 size-4" />{uploading ? 'Uploading…' : 'Upload Offline Package'}
      </Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <button class="flex w-full items-center justify-between text-left" onclick={() => (showHistory = !showHistory)}>
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100"><History class="size-4" />Update History</CardTitle>
          <CardDescription class="text-slate-400">{$_('system_updates.previous_update_operations_and_reboot_completion_s')}</CardDescription>
        </div>
        {#if showHistory}
          <ChevronDown class="size-4 text-slate-400" />
        {:else}
          <ChevronRight class="size-4 text-slate-400" />
        {/if}
      </button>
    </CardHeader>
    {#if showHistory}
      <CardContent class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800 text-left text-slate-400">
              <th class="px-3 py-2">Version</th>
              <th class="px-3 py-2">Installed At</th>
              <th class="px-3 py-2">From</th>
              <th class="px-3 py-2">Packages</th>
              <th class="px-3 py-2">Result</th>
              <th class="px-3 py-2">Summary</th>
            </tr>
          </thead>
          <tbody>
            {#if history.length === 0}
              <tr>
                <td class="px-3 py-3 text-slate-500" colspan="6">No update history recorded yet.</td>
              </tr>
            {:else}
              {#each history as entry}
                <tr class="border-b border-slate-800/70 text-slate-200 last:border-b-0">
                  <td class="px-3 py-2 font-mono">{entry.version}</td>
                  <td class="px-3 py-2">{formatTime(entry.installed_at)}</td>
                  <td class="px-3 py-2 font-mono">{entry.from_version}</td>
                  <td class="px-3 py-2">{entry.packages_updated}</td>
                  <td class="px-3 py-2">
                    {#if entry.success}
                      <Badge class="border-emerald-500/30 bg-emerald-500/20 text-emerald-200">{$_('system_updates.success')}</Badge>
                    {:else}
                      <Badge class="border-red-500/30 bg-red-500/20 text-red-200">{$_('system_updates.failed')}</Badge>
                    {/if}
                    {#if entry.reboot_performed}
                      <Badge class="ml-2 border-cyan-500/30 bg-cyan-500/20 text-cyan-200">{$_('system_updates.rebooted')}</Badge>
                    {/if}
                  </td>
                  <td class="px-3 py-2 text-slate-300">{entry.log_summary}</td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </CardContent>
    {/if}
  </Card>
</div>
