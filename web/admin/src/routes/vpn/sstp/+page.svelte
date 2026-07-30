<!-- Route view for `/vpn/sstp` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import Save from '@lucide/svelte/icons/save';

  import { _ } from '$lib/i18n';
  type SstpConfig = {
    enabled: boolean;
    listen_port: number;
    certificate: string;
    ip_pool_start: string;
    ip_pool_end: string;
    dns_servers: string[];
    authentication: string;
    max_clients: number;
    description: string;
  };

  let loading = $state(true);
  let saving = $state(false);
  let cfg = $state<SstpConfig>({
    enabled: false,
    listen_port: 443,
    certificate: '',
    ip_pool_start: '10.60.0.10',
    ip_pool_end: '10.60.0.200',
    dns_servers: [],
    authentication: 'local',
    max_clients: 500,
    description: ''
  });

  const asCsv = (v: string[]) => v.join(', ');
  const fromCsv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const AUTH_OPTIONS = ['local', 'radius', 'ldap'];

  async function load() {
    try { cfg = await api.get<SstpConfig>('/vpn/sstp'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load SSTP config'); }
    finally { loading = false; }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch<SstpConfig>('/vpn/sstp', cfg);
      toasts.success($_('vpn_sstp.toast_sstp_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save SSTP settings');
    } finally {
      saving = false;
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('vpn_sstp.sstp_server')}</CardTitle>
          <CardDescription class="text-slate-400">TLS-based VPN listener for enterprise clients.</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}><Save class="mr-2 size-4" />{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable or disable SSTP service listener." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Listen Port" hint="TCP port for incoming SSTP clients (typically 443)." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.listen_port} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Certificate" hint="TLS certificate reference for SSTP termination." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.certificate} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Authentication" hint="Identity backend used for SSTP users." /><select bind:value={cfg.authentication} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each AUTH_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Pool Start" hint="Start of client address allocation range." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.ip_pool_start} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Pool End" hint="End of client address allocation range." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.ip_pool_end} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="DNS Servers" hint="Comma-separated DNS servers pushed to SSTP clients." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.dns_servers)} oninput={(e) => (cfg.dns_servers = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Max Clients" hint="Maximum number of concurrently connected SSTP clients." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.max_clients} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="Operational notes for this SSTP profile." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
      </div>
    </CardContent>
  </Card>
</div>
