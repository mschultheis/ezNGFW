<!-- Route view for `/automation/netconf` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { _ } from '$lib/i18n';

  type YangModule = { name: string; version: string; namespace: string; enabled: boolean };
  type NetconfCallHome = { address: string; port: number; reconnect_interval_sec: number };
  type NetconfConfig = {
    enabled: boolean;
    listen_port: number;
    max_sessions: number;
    ssh_enabled: boolean;
    tls_enabled: boolean;
    certificate: string;
    yang_modules: YangModule[];
    call_home_enabled: boolean;
    call_home_servers: NetconfCallHome[];
    description: string;
  };

  const defaults: NetconfConfig = {
    enabled: false,
    listen_port: 830,
    max_sessions: 32,
    ssh_enabled: true,
    tls_enabled: false,
    certificate: '',
    yang_modules: [],
    call_home_enabled: false,
    call_home_servers: [],
    description: ''
  };

  let cfg = $state<NetconfConfig>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);

  async function load() {
    loading = true;
    try {
      cfg = { ...defaults, ...(await api.get('/automation/netconf') as NetconfConfig) };
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load NETCONF settings');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch('/automation/netconf', cfg) as NetconfConfig;
      toasts.success($_('automation_netconf.toastnetconf_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save NETCONF settings');
    } finally {
      saving = false;
    }
  }

  function addYangModule() {
    cfg.yang_modules = [...cfg.yang_modules, { name: '', version: '', namespace: '', enabled: true }];
  }

  function addCallHomeServer() {
    cfg.call_home_servers = [...cfg.call_home_servers, { address: '', port: 4334, reconnect_interval_sec: 60 }];
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('automation_netconf.netconf_and_yang')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('automation_netconf.configure_netconf_server_behavior_yang_module_avai')}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading}
        <p class="text-sm text-slate-400">{$_('automation_netconf.loading')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2">
          <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Activate or deactivate the NETCONF server for remote device management." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="SSH transport" hint="Enable the use of SSH as the secure transport layer for NETCONF sessions." /><div class="flex h-9 items-center"><Switch checked={cfg.ssh_enabled} onCheckedChange={(v) => (cfg.ssh_enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="TLS transport" hint="Enable the use of TLS as the secure transport layer for NETCONF sessions." /><div class="flex h-9 items-center"><Switch checked={cfg.tls_enabled} onCheckedChange={(v) => (cfg.tls_enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Call-home enabled" hint="Allow the device to initiate connections to a management system rather than waiting for a request." /><div class="flex h-9 items-center"><Switch checked={cfg.call_home_enabled} onCheckedChange={(v) => (cfg.call_home_enabled = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Listen port" hint="TCP port where the NETCONF SSH subsystem accepts connections. Default 830." /><Input class="border-slate-700 bg-slate-950" type="number" bind:value={cfg.listen_port} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Max sessions" hint="The maximum number of concurrent NETCONF sessions allowed on this device." /><Input class="border-slate-700 bg-slate-950" type="number" bind:value={cfg.max_sessions} /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Certificate reference" hint="The identifier or path for the TLS certificate used to secure NETCONF communications." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.certificate} placeholder="cert-id-or-path" /></label>
          <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="A brief summary or note about this NETCONF configuration for administrative reference." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
        </div>
        <div class="flex gap-2"><Button onclick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
      {/if}
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('automation_netconf.yang_modules')}</CardTitle></CardHeader>
    <CardContent class="space-y-2">
      {#each cfg.yang_modules as item, i}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-4">
          <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_netconf.placeholdermodule_name')} value={item.name} oninput={(e) => (cfg.yang_modules[i].name = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_netconf.placeholderversion')} value={item.version} oninput={(e) => (cfg.yang_modules[i].version = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_netconf.placeholdernamespace')} value={item.namespace} oninput={(e) => (cfg.yang_modules[i].namespace = (e.currentTarget as HTMLInputElement).value)} />
          <div class="flex items-center justify-between"><Switch checked={item.enabled} onCheckedChange={(v) => (cfg.yang_modules[i].enabled = v)} /><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => (cfg.yang_modules = cfg.yang_modules.filter((_, idx) => idx !== i))}>Remove</Button></div>
        </div>
      {/each}
      <Button type="button" variant="outline" class="border-slate-700" onclick={addYangModule}>Add module</Button>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('automation_netconf.callhome_servers')}</CardTitle></CardHeader>
    <CardContent class="space-y-2">
      {#each cfg.call_home_servers as item, i}
        <div class="grid gap-2 rounded border border-slate-800 bg-slate-950 p-3 md:grid-cols-4">
          <Input class="border-slate-700 bg-slate-900" placeholder={$_('automation_netconf.placeholderaddress')} value={item.address} oninput={(e) => (cfg.call_home_servers[i].address = (e.currentTarget as HTMLInputElement).value)} />
          <Input class="border-slate-700 bg-slate-900" type="number" placeholder={$_('automation_netconf.placeholderport')} value={String(item.port)} oninput={(e) => (cfg.call_home_servers[i].port = Number((e.currentTarget as HTMLInputElement).value || 0))} />
          <Input class="border-slate-700 bg-slate-900" type="number" placeholder={$_('automation_netconf.placeholderreconnect_seconds')} value={String(item.reconnect_interval_sec)} oninput={(e) => (cfg.call_home_servers[i].reconnect_interval_sec = Number((e.currentTarget as HTMLInputElement).value || 0))} />
          <div class="flex items-center justify-end"><Button type="button" variant="outline" class="border-red-700 text-red-300" onclick={() => (cfg.call_home_servers = cfg.call_home_servers.filter((_, idx) => idx !== i))}>Remove</Button></div>
        </div>
      {/each}
      <Button type="button" variant="outline" class="border-slate-700" onclick={addCallHomeServer}>Add server</Button>
    </CardContent>
  </Card>
</div>
