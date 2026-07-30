<!-- Route view for `/vpn/dmvpn` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import Save from '@lucide/svelte/icons/save';
  import { _ } from '$lib/i18n';

  type DmvpnConfig = {
    enabled: boolean;
    role: string;
    tunnel_source: string;
    tunnel_key: number;
    nhrp_network_id: number;
    nhrp_holdtime: number;
    nhs_addresses: string[];
    nhrp_authentication: string;
    tunnel_protection_profile: string;
    gre_multipoint: boolean;
    description: string;
  };

  let loading = $state(true);
  let saving = $state(false);
  let interfaces = $state<string[]>([]);
  let cfg = $state<DmvpnConfig>({
    enabled: false,
    role: 'spoke',
    tunnel_source: '',
    tunnel_key: 100,
    nhrp_network_id: 1,
    nhrp_holdtime: 600,
    nhs_addresses: [],
    nhrp_authentication: '',
    tunnel_protection_profile: '',
    gre_multipoint: true,
    description: ''
  });

  const asCsv = (v: string[]) => v.join(', ');
  const fromCsv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

  function normalizeInterfaces(payload: unknown): string[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((x: any) => String(x?.name ?? x?.id ?? x?.interface ?? '')).filter(Boolean);
  }

  async function load() {
    try {
      const [dmvpn, ifaces] = await Promise.all([api.get<DmvpnConfig>('/vpn/dmvpn'), api.get('/interfaces').catch(() => [])]);
      cfg = dmvpn;
      interfaces = normalizeInterfaces(ifaces);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load DMVPN config');
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch<DmvpnConfig>('/vpn/dmvpn', cfg);
      toasts.success($_('vpn_dmvpn.toastdmvpn_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save DMVPN settings');
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
          <CardTitle class="text-slate-100">{$_('vpn_dmvpn.dmvpn')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('vpn_dmvpn.hubspoke_multipoint_gre_with_nhrp_and_ipsec_protec')}</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}><Save class="mr-2 size-4" />{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable DMVPN tunnel service and NHRP behavior." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="GRE Multipoint" hint="Enable mGRE mode for dynamic spoke registrations." /><div class="flex h-9 items-center"><Switch checked={cfg.gre_multipoint} onCheckedChange={(v) => (cfg.gre_multipoint = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Role" hint="Set this node as hub or spoke in DMVPN mesh." /><Select.Root type="single" value={cfg.role} onValueChange={(v) => v && (cfg.role = v)}><Select.Trigger class="w-full border-slate-700 bg-slate-950"><span>{[{value: 'hub', label: 'Hub'}, {value: 'spoke', label: 'Spoke'}].find(o => o.value === cfg.role)?.label ?? cfg.role}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="hub" label="Hub" /><Select.Item value="spoke" label="Spoke" /></Select.Content></Select.Root></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Source Interface" hint="Source interface used for GRE transport packets." /><Select.Root type="single" value={cfg.tunnel_source} onValueChange={(v) => v && (cfg.tunnel_source = v)}><Select.Trigger class="w-full border-slate-700 bg-slate-950"><span>{interfaces.find(o => o === cfg.tunnel_source) ?? cfg.tunnel_source}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900">{#each interfaces as iface}<Select.Item value={iface} label={iface} />{/each}</Select.Content></Select.Root></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Tunnel Key" hint="Shared tunnel key used by GRE/DMVPN peers." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.tunnel_key} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="NHRP Network ID" hint="Unique NHRP network identifier for this DMVPN cloud." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.nhrp_network_id} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="NHRP Holdtime" hint="NHRP registration hold time in seconds for spoke records." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.nhrp_holdtime} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="NHRP Authentication" hint="NHRP authentication string used between peers." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.nhrp_authentication} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="NHS Addresses" hint="Comma-separated NHS hub addresses used by spokes." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.nhs_addresses)} oninput={(e) => (cfg.nhs_addresses = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Tunnel Protection Profile" hint="IPsec profile name securing the DMVPN transport." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.tunnel_protection_profile} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="Operational notes for this DMVPN deployment." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
      </div>
    </CardContent>
  </Card>
</div>
