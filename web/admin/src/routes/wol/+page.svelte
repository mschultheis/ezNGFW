<!-- Route view for `/wol` in the ezNGFW admin GUI. -->

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
  import Power from '@lucide/svelte/icons/power';
  import { _ } from '$lib/i18n';

  type WolTarget = {
    mac_address: string;
    description: string;
    interface: string;
    broadcast_address: string;
    id?: string;
  };

  type WolConfig = {
    enabled: boolean;
    interface: string;
    targets: WolTarget[];
  };

  const defaults: WolConfig = {
    enabled: false,
    interface: '',
    targets: []
  };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<WolConfig>({ ...defaults });
  let targets = $state<WolTarget[]>([]);
  let draft = $state<WolTarget>({
    mac_address: '',
    description: '',
    interface: '',
    broadcast_address: '255.255.255.255'
  });

  async function loadAll() {
    loading = true;
    try {
      const payload = await api.get<WolConfig>('/wol');
      config = { ...defaults, ...payload };
      const items = await api.get<WolTarget[]>('/wol/targets');
      targets = Array.isArray(items) ? items : [];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load Wake-on-LAN settings');
    } finally {
      loading = false;
    }
  }

  async function saveConfig() {
    saving = true;
    try {
      config = await api.patch<WolConfig>('/wol', {
        enabled: config.enabled,
        interface: config.interface,
        targets: config.targets
      });
      toasts.success($_('wol.toastwakeonlan_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      saving = false;
    }
  }

  async function addTarget() {
    if (!draft.mac_address.trim()) {
      toasts.error($_('wol.toastmac_address_is_required'));
      return;
    }
    saving = true;
    try {
      await api.post('/wol/targets', { ...draft });
      draft = { mac_address: '', description: '', interface: '', broadcast_address: '255.255.255.255' };
      await loadAll();
      toasts.success($_('wol.toastwol_target_added'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to add target');
    } finally {
      saving = false;
    }
  }

  async function removeTarget(id: string) {
    saving = true;
    try {
      await api.del(`/wol/targets/${id}`);
      await loadAll();
      toasts.success($_('wol.toastwol_target_removed'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove target');
    } finally {
      saving = false;
    }
  }

  async function wakeTarget(id: string, mac: string) {
    saving = true;
    try {
      const result = await api.post<{ success: boolean; mac: string }>(`/wol/wake/${id}`, {});
      if (result.success) {
        toasts.success(`Magic packet sent to ${mac}`);
      } else {
        toasts.error(`Failed to wake ${mac}`);
      }
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to send wake packet');
    } finally {
      saving = false;
    }
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
          <CardTitle class="text-slate-100">{$_('wol.wakeonlan')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('wol.send_magic_packets_to_wake_devices_on_your_network')}</CardDescription>
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
          <div class="flex items-center justify-between"><span>{$_('wol.enable_wakeonlan')}</span><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div>
        </div>
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('wol.placeholderdefault_interface_eg_eth0')} bind:value={config.interface} />
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('wol.wol_targets')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('wol.placeholdermac_address_aabbccddeeff')} bind:value={draft.mac_address} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('wol.placeholderdescription')} bind:value={draft.description} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('wol.placeholderinterface_optional')} bind:value={draft.interface} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('wol.placeholderbroadcast_255255255255')} bind:value={draft.broadcast_address} />
      </div>
      <div class="flex gap-3">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void addTarget()} disabled={saving}><Plus class="mr-2 h-4 w-4" />Add Target</Button>
      </div>
      <div class="space-y-2">
        {#if targets.length === 0}
          <p class="text-sm text-slate-500">{$_('wol.no_wol_targets_configured')}</p>
        {:else}
          {#each targets as target}
            <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
              <div class="flex flex-col gap-0.5">
                <span class="font-mono text-slate-200">{target.mac_address}</span>
                {#if target.description}
                  <span class="text-xs text-slate-400">{target.description}</span>
                {/if}
                {#if target.interface}
                  <span class="text-xs text-slate-500">iface: {target.interface}</span>
                {/if}
              </div>
              <div class="flex gap-2">
                <Button size="sm" class="bg-green-600 text-white hover:bg-green-700" onclick={() => void wakeTarget(String(target.id ?? ''), target.mac_address)} disabled={saving}><Power class="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" class="border-red-500/60 text-red-300" onclick={() => void removeTarget(String(target.id ?? ''))}><Trash2 class="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </CardContent>
  </Card>
</div>
