<!-- Route view for `/upnp` in the ezNGFW admin GUI. -->

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

  type UpnpAllowRule = {
    action: string;
    ext_ports: string;
    int_address: string;
    int_ports: string;
    description: string;
    id?: string;
  };

  type UpnpConfig = {
    enabled: boolean;
    interface: string;
    listen_port: number;
    nat_pmp_enabled: boolean;
    secure_mode: boolean;
    allow_rules: UpnpAllowRule[];
    presentation_url: string;
    model_description: string;
  };

  type UpnpLease = {
    id: number;
    mapping: string;
  };

  const defaults: UpnpConfig = {
    enabled: false,
    interface: '',
    listen_port: 5000,
    nat_pmp_enabled: true,
    secure_mode: true,
    allow_rules: [],
    presentation_url: '',
    model_description: 'ezNGFW Firewall'
  };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<UpnpConfig>({ ...defaults });
  let rules = $state<UpnpAllowRule[]>([]);
  let leases = $state<UpnpLease[]>([]);
  let ruleDraft = $state<UpnpAllowRule>({
    action: 'allow',
    ext_ports: '1024-65535',
    int_address: '0.0.0.0/0',
    int_ports: '1024-65535',
    description: ''
  });

  async function loadAll() {
    loading = true;
    try {
      const payload = await api.get<UpnpConfig>('/upnp');
      config = { ...defaults, ...payload, allow_rules: Array.isArray(payload.allow_rules) ? payload.allow_rules : [] };
      const items = await api.get<UpnpAllowRule[]>('/upnp/rules');
      rules = Array.isArray(items) ? items : [];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load UPnP settings');
    } finally {
      loading = false;
    }
  }

  async function loadLeases() {
    try {
      const items = await api.get<UpnpLease[]>('/upnp/leases');
      leases = Array.isArray(items) ? items : [];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load port mappings');
    }
  }

  async function saveConfig() {
    saving = true;
    try {
      config = await api.patch<UpnpConfig>('/upnp', {
        enabled: config.enabled,
        interface: config.interface,
        listen_port: config.listen_port,
        nat_pmp_enabled: config.nat_pmp_enabled,
        secure_mode: config.secure_mode,
        allow_rules: config.allow_rules,
        presentation_url: config.presentation_url,
        model_description: config.model_description
      });
      toasts.success($_('upnp.toastupnp_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      saving = false;
    }
  }

  async function addRule() {
    saving = true;
    try {
      await api.post('/upnp/rules', { ...ruleDraft });
      ruleDraft = { action: 'allow', ext_ports: '1024-65535', int_address: '0.0.0.0/0', int_ports: '1024-65535', description: '' };
      await loadAll();
      toasts.success($_('upnp.toastupnp_rule_added'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to add rule');
    } finally {
      saving = false;
    }
  }

  async function removeRule(id: string) {
    saving = true;
    try {
      await api.del(`/upnp/rules/${id}`);
      await loadAll();
      toasts.success($_('upnp.toastupnp_rule_removed'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove rule');
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void loadAll();
    void loadLeases();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('upnp.upnp_natpmp')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('upnp.automatic_port_forwarding_via_upnp_igd_and_natpmp')}</CardDescription>
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
          <div class="flex items-center justify-between"><span>{$_('upnp.enable_upnp')}</span><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <div class="flex items-center justify-between"><span>{$_('upnp.enable_natpmp')}</span><Switch checked={config.nat_pmp_enabled} onCheckedChange={(v) => (config.nat_pmp_enabled = v)} /></div>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <div class="flex items-center justify-between"><span>{$_('upnp.secure_mode')}</span><Switch checked={config.secure_mode} onCheckedChange={(v) => (config.secure_mode = v)} /></div>
        </div>
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('upnp.placeholderinterface_eg_eth0')} bind:value={config.interface} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" min="1" max="65535" placeholder={$_('upnp.placeholderlisten_port_5000')} bind:value={config.listen_port} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('upnp.placeholderpresentation_url')} bind:value={config.presentation_url} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200 md:col-span-2" placeholder={$_('upnp.placeholdermodel_description')} bind:value={config.model_description} />
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('upnp.access_rules')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-5">
        <select
          bind:value={ruleDraft.action}
          class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        >
          <option value="allow">allow</option>
          <option value="deny">deny</option>
        </select>
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('upnp.placeholderext_ports_102465535')} bind:value={ruleDraft.ext_ports} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('upnp.placeholderint_address_00000')} bind:value={ruleDraft.int_address} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('upnp.placeholderint_ports_102465535')} bind:value={ruleDraft.int_ports} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" placeholder={$_('upnp.placeholderdescription')} bind:value={ruleDraft.description} />
      </div>
      <div class="flex gap-3">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void addRule()} disabled={saving}><Plus class="mr-2 h-4 w-4" />Add Rule</Button>
      </div>
      <div class="space-y-2">
        {#if rules.length === 0}
          <p class="text-sm text-slate-500">{$_('upnp.no_access_rules_configured')}</p>
        {:else}
          {#each rules as rule}
            <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex rounded px-1.5 py-0.5 text-xs font-medium {rule.action === 'allow' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}">{rule.action}</span>
                <span class="text-slate-300">ext:{rule.ext_ports}</span>
                <span class="text-slate-500">&rarr;</span>
                <span class="text-slate-300">{rule.int_address}:{rule.int_ports}</span>
                {#if rule.description}
                  <span class="text-xs text-slate-500">— {rule.description}</span>
                {/if}
              </div>
              <Button size="sm" variant="outline" class="border-red-500/60 text-red-300" onclick={() => void removeRule(String(rule.id ?? ''))}><Trash2 class="h-3.5 w-3.5" /></Button>
            </div>
          {/each}
        {/if}
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('upnp.active_port_mappings')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('upnp.current_upnpnatpmp_port_forwarding_leases')}</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => void loadLeases()} disabled={loading}><RefreshCw class="mr-2 h-4 w-4" />Refresh</Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-2">
      {#if leases.length === 0}
        <p class="text-sm text-slate-500">{$_('upnp.no_active_port_mappings')}</p>
      {:else}
        {#each leases as lease}
          <div class="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm font-mono text-slate-300">
            {lease.mapping}
          </div>
        {/each}
      {/if}
    </CardContent>
  </Card>
</div>
