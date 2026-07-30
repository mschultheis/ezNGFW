<!-- Route view for `/ntp` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Save from '@lucide/svelte/icons/save';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { _ } from '$lib/i18n';

  type NtpUpstream = {
    address: string;
    server_type: string;
    prefer: boolean;
    iburst: boolean;
    minpoll: number;
    maxpoll: number;
    key: number | null;
    description: string;
    id?: string;
  };

  type NtpConfig = {
    enabled: boolean;
    listen_addresses: string[];
    upstream_servers: NtpUpstream[];
    allow_networks: string[];
    orphan_mode: boolean;
    orphan_stratum: number;
    leap_smear: boolean;
    log_enabled: boolean;
    description: string;
  };

  const defaults: NtpConfig = {
    enabled: false,
    listen_addresses: ['0.0.0.0:123'],
    upstream_servers: [],
    allow_networks: [],
    orphan_mode: false,
    orphan_stratum: 8,
    leap_smear: false,
    log_enabled: false,
    description: ''
  };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<NtpConfig>({ ...defaults });
  let listenDraft = $state('');
  let allowDraft = $state('');
  let upstreamDraft = $state<NtpUpstream>({
    address: '', server_type: 'server', prefer: false, iburst: true, minpoll: 6, maxpoll: 10, key: null, description: ''
  });

  async function loadAll() {
    loading = true;
    try {
      const payload = await api.get<NtpConfig>('/ntp');
      config = {
        ...defaults,
        ...payload,
        listen_addresses: Array.isArray(payload.listen_addresses) ? payload.listen_addresses : [],
        allow_networks: Array.isArray(payload.allow_networks) ? payload.allow_networks : [],
        upstream_servers: Array.isArray(payload.upstream_servers) ? payload.upstream_servers : []
      };
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load NTP settings');
    } finally {
      loading = false;
    }
  }

  async function saveConfig() {
    saving = true;
    try {
      const payload: NtpConfig = {
        ...config,
        listen_addresses: config.listen_addresses.filter(Boolean),
        allow_networks: config.allow_networks.filter(Boolean)
      };
      config = await api.patch<NtpConfig>('/ntp', payload);
      toasts.success($_('ntp.toastntp_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save NTP settings');
    } finally {
      saving = false;
    }
  }

  async function addUpstream() {
    if (!upstreamDraft.address.trim()) {
      toasts.error($_('ntp.toastupstream_address_is_required'));
      return;
    }
    saving = true;
    try {
      await api.post('/ntp/upstreams', { ...upstreamDraft, key: upstreamDraft.key || null });
      upstreamDraft = { address: '', server_type: 'server', prefer: false, iburst: true, minpoll: 6, maxpoll: 10, key: null, description: '' };
      await loadAll();
      toasts.success($_('ntp.toastntp_upstream_added'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to add upstream');
    } finally {
      saving = false;
    }
  }

  async function removeUpstream(id: string) {
    saving = true;
    try {
      await api.del(`/ntp/upstreams/${id}`);
      await loadAll();
      toasts.success($_('ntp.toastntp_upstream_removed'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove upstream');
    } finally {
      saving = false;
    }
  }

  function addListenAddress() {
    const value = listenDraft.trim();
    if (!value) return;
    config.listen_addresses = [...config.listen_addresses, value];
    listenDraft = '';
  }

  function addAllowNetwork() {
    const value = allowDraft.trim();
    if (!value) return;
    config.allow_networks = [...config.allow_networks, value];
    allowDraft = '';
  }

  onMount(() => {
    void loadAll();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('ntp.ntp_server')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('ntp.standalone_ntp_service_settings_and_upstream_peers')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => void loadAll()} disabled={loading || saving}><RefreshCw class="mr-2 h-4 w-4" />Reload</Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveConfig()} disabled={loading || saving}><Save class="mr-2 h-4 w-4" />Save</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <div class="flex items-center justify-between"><span>{$_('ntp.enable_ntp_service')}</span><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div>
        </div>
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('ntp.placeholderdescription')} bind:value={config.description} />
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><div class="flex items-center justify-between"><span>{$_('ntp.orphan_mode')}</span><Switch checked={config.orphan_mode} onCheckedChange={(v) => (config.orphan_mode = v)} /></div></div>
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" max="15" bind:value={config.orphan_stratum} />
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><div class="flex items-center justify-between"><span>{$_('ntp.leap_smear')}</span><Switch checked={config.leap_smear} onCheckedChange={(v) => (config.leap_smear = v)} /></div></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3"><div class="flex items-center justify-between"><span>{$_('ntp.logging')}</span><Switch checked={config.log_enabled} onCheckedChange={(v) => (config.log_enabled = v)} /></div></div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <p class="text-sm text-slate-300">{$_('ntp.listen_addresses')}</p>
          <div class="flex gap-2"><Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={listenDraft} placeholder="0.0.0.0:123" /><Button variant="outline" class="border-slate-700" onclick={addListenAddress}><Plus class="h-4 w-4" /></Button></div>
          {#each config.listen_addresses as value, idx}
            <div class="flex items-center justify-between rounded border border-slate-800 px-2 py-1 text-xs">
              <span>{value}</span><button class="text-red-300" onclick={() => (config.listen_addresses = config.listen_addresses.filter((_, i) => i !== idx))}><Trash2 class="h-3.5 w-3.5" /></button>
            </div>
          {/each}
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <p class="text-sm text-slate-300">{$_('ntp.allowed_networks')}</p>
          <div class="flex gap-2"><Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={allowDraft} placeholder="10.0.0.0/24" /><Button variant="outline" class="border-slate-700" onclick={addAllowNetwork}><Plus class="h-4 w-4" /></Button></div>
          {#each config.allow_networks as value, idx}
            <div class="flex items-center justify-between rounded border border-slate-800 px-2 py-1 text-xs">
              <span>{value}</span><button class="text-red-300" onclick={() => (config.allow_networks = config.allow_networks.filter((_, i) => i !== idx))}><Trash2 class="h-3.5 w-3.5" /></button>
            </div>
          {/each}
        </div>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('ntp.upstream_servers')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('ntp.placeholderaddress')} bind:value={upstreamDraft.address} />
        <select
              bind:value={upstreamDraft.server_type}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="server">server</option>
              <option value="pool">pool</option>
              <option value="peer">peer</option>
            </select>
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" min="4" max="17" bind:value={upstreamDraft.minpoll} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" min="4" max="17" bind:value={upstreamDraft.maxpoll} />
      </div>
      <div class="flex gap-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center gap-2 text-xs"><span>{$_('ntp.prefer')}</span><Switch checked={upstreamDraft.prefer} onCheckedChange={(v) => (upstreamDraft.prefer = v)} /></div></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center gap-2 text-xs"><span>iBurst</span><Switch checked={upstreamDraft.iburst} onCheckedChange={(v) => (upstreamDraft.iburst = v)} /></div></div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void addUpstream()} disabled={saving}><Plus class="mr-2 h-4 w-4" />Add Upstream</Button>
      </div>
      <div class="space-y-2">
        {#if config.upstream_servers.length === 0}
          <p class="text-sm text-slate-500">{$_('ntp.no_upstreams_configured')}</p>
        {:else}
          {#each config.upstream_servers as upstream, idx}
            <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
              <span>{upstream.address} ({upstream.server_type}) min/max poll {upstream.minpoll}/{upstream.maxpoll}</span>
              <Button size="sm" variant="outline" class="border-red-500/60 text-red-300" onclick={() => void removeUpstream(String((upstream as any).id ?? idx))}><Trash2 class="h-3.5 w-3.5" /></Button>
            </div>
          {/each}
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
