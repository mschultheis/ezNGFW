<!-- Route view for `/vpn/l2tp` in the ezNGFW admin GUI. -->

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
  type L2tpConfig = {
    enabled: boolean;
    listen_address: string;
    ip_pool_start: string;
    ip_pool_end: string;
    dns_servers: string[];
    wins_servers: string[];
    authentication: string;
    ipsec_psk: string;
    mtu: number;
    idle_timeout_sec: number;
    max_sessions: number;
    require_ipsec: boolean;
    ppp_authentication: string;
    description: string;
  };

  let loading = $state(true);
  let saving = $state(false);
  let cfg = $state<L2tpConfig>({
    enabled: false,
    listen_address: '0.0.0.0',
    ip_pool_start: '10.50.0.10',
    ip_pool_end: '10.50.0.200',
    dns_servers: [],
    wins_servers: [],
    authentication: 'local',
    ipsec_psk: '',
    mtu: 1400,
    idle_timeout_sec: 1800,
    max_sessions: 200,
    require_ipsec: true,
    ppp_authentication: 'mschap-v2',
    description: ''
  });

  const asCsv = (v: string[]) => v.join(', ');
  const fromCsv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const AUTH_OPTIONS = ['local', 'radius'];
  const PPP_AUTH_OPTIONS = ['pap', 'chap', 'mschap-v2'];

  async function load() {
    try { cfg = await api.get<L2tpConfig>('/vpn/l2tp'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load L2TP config'); }
    finally { loading = false; }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch<L2tpConfig>('/vpn/l2tp', cfg);
      toasts.success($_('vpn_l2tp.toast_l2tp_ipsec_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save L2TP/IPsec settings');
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
          <CardTitle class="text-slate-100">{$_('vpn_l2tp.l2tp_ipsec_server')}</CardTitle>
          <CardDescription class="text-slate-400">Remote-access L2TP service protected by IPsec.</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}><Save class="mr-2 size-4" />{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable or disable the L2TP/IPsec service." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Require IPsec" hint="Enforce IPsec protection for all L2TP sessions." /><div class="flex h-9 items-center"><Switch checked={cfg.require_ipsec} onCheckedChange={(v) => (cfg.require_ipsec = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Listen Address" hint="Address where L2TP daemon listens for client connections." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.listen_address} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Authentication" hint="Backend user auth method: local or radius." /><select bind:value={cfg.authentication} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each AUTH_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="PPP Authentication" hint="PPP auth protocol used inside the L2TP tunnel." /><select bind:value={cfg.ppp_authentication} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each PPP_AUTH_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="IPsec PSK" hint="Pre-shared key used by IPsec for L2TP clients." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.ipsec_psk} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Pool Start" hint="First IPv4 address assigned to remote clients." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.ip_pool_start} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Pool End" hint="Last IPv4 address assigned to remote clients." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.ip_pool_end} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="DNS Servers" hint="Comma-separated DNS servers pushed to clients." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.dns_servers)} oninput={(e) => (cfg.dns_servers = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="WINS Servers" hint="Comma-separated WINS servers for legacy name resolution." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.wins_servers)} oninput={(e) => (cfg.wins_servers = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="MTU" hint="Tunnel MTU for L2TP sessions." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.mtu} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Idle Timeout (sec)" hint="Disconnect clients after inactivity timeout." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.idle_timeout_sec} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Max Sessions" hint="Maximum concurrent L2TP sessions." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.max_sessions} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="Operational notes for this L2TP service profile." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
      </div>
    </CardContent>
  </Card>
</div>
