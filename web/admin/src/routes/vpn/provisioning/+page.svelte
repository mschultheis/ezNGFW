<!-- Route view for `/vpn/provisioning` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Select from '$lib/components/ui/select';
  import Plus from '@lucide/svelte/icons/plus';
  import Save from '@lucide/svelte/icons/save';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Download from '@lucide/svelte/icons/download';
  import { _ } from '$lib/i18n';

  type Provision = {
    id: string;
    vpn_type: string;
    name: string;
    config_template: string;
    auto_generate: boolean;
    include_ca: boolean;
    description: string;
  };

  const empty: Provision = { id: '', vpn_type: 'wireguard', name: '', config_template: '', auto_generate: true, include_ca: true, description: '' };
  let loading = $state(true);
  let items = $state<Provision[]>([]);
  let draft = $state<Provision>({ ...empty });

  async function load() {
    try { items = await api.get<Provision[]>('/vpn/provisions'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load provisioning profiles'); }
    finally { loading = false; }
  }

  async function add() {
    try { const created = await api.post<Provision>('/vpn/provisions', draft); items = [...items, created]; draft = { ...empty }; toasts.success($_('vpn_provisioning.toastprovision_profile_added')); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add provisioning profile'); }
  }

  async function saveOne(item: Provision) {
    try { await api.put<Provision>(`/vpn/provisions/${item.id}`, item); toasts.success(`Saved ${item.id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save provisioning profile'); }
  }

  async function remove(id: string) {
    try { await api.del(`/vpn/provisions/${id}`); items = items.filter((x) => x.id !== id); toasts.success(`Removed ${id}`); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove provisioning profile'); }
  }

  async function downloadConfig(item: Provision) {
    const token = api.getToken();
    try {
      const response = await fetch(`/api/vpn/provisions/${item.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      const disp = response.headers.get('content-disposition') || '';
      const name = disp.includes('filename=') ? disp.split('filename=')[1].replaceAll('"', '') : `${item.name || item.id}.conf`;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
      toasts.success(`Downloaded ${name}`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to download config');
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('vpn_provisioning.client_provisioning')}</CardTitle><CardDescription class="text-slate-400">{$_('vpn_provisioning.generate_downloadable_vpn_client_profiles_for_wire')}</CardDescription></CardHeader><CardContent>
    <div class="grid gap-3 md:grid-cols-3">
      <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Unique profile identifier used by provisioning API." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.id} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Operator-friendly profile name shown in downloads." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.name} /></label>
      <label class="space-y-1 text-sm"><FieldLabel label="VPN Type" hint="Target client type that this profile template renders for." /><Select.Root type="single" value={draft.vpn_type} onValueChange={(v) => v && (draft.vpn_type = v)}><Select.Trigger class="w-full border-slate-700 bg-slate-950"><span>{[{value: 'wireguard', label: 'WireGuard'}, {value: 'openvpn', label: 'OpenVPN'}, {value: 'ipsec', label: 'IPsec'}].find(o => o.value === draft.vpn_type)?.label ?? draft.vpn_type}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="wireguard" label="WireGuard" /><Select.Item value="openvpn" label="OpenVPN" /><Select.Item value="ipsec" label="IPsec" /></Select.Content></Select.Root></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Auto Generate" hint="Generate template content automatically when custom template is empty." /><div class="flex h-9 items-center"><Switch checked={draft.auto_generate} onCheckedChange={(v) => (draft.auto_generate = v)} /></div></label>
      <label class="space-y-1 text-sm"><FieldLabel label="Include CA" hint="Include CA bundle/certificate material in generated client files." /><div class="flex h-9 items-center"><Switch checked={draft.include_ca} onCheckedChange={(v) => (draft.include_ca = v)} /></div></label>
      <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Description" hint="Change-control notes and target user group." /><Input class="border-slate-700 bg-slate-950" bind:value={draft.description} /></label>
      <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Config Template" hint="Raw template text returned by download endpoint when set." /><Textarea class="min-h-[130px] border-slate-700 bg-slate-950 font-mono text-xs" bind:value={draft.config_template} /></label>
    </div>
    <div class="mt-4"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={add}><Plus class="mr-2 size-4" />Add Profile</Button></div>
  </CardContent></Card>

  {#if !loading}
    {#each items as item}
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6">
        <div class="grid gap-3 md:grid-cols-3">
          <label class="space-y-1 text-sm"><FieldLabel label="ID" hint="Identifier used in API and download URL." /><Input class="border-slate-700 bg-slate-950" bind:value={item.id} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Name" hint="Display name for this profile." /><Input class="border-slate-700 bg-slate-950" bind:value={item.name} /></label>
          <label class="space-y-1 text-sm"><FieldLabel label="VPN Type" hint="Client profile dialect to generate." /><Select.Root type="single" value={item.vpn_type} onValueChange={(v) => v && (item.vpn_type = v)}><Select.Trigger class="w-full border-slate-700 bg-slate-950"><span>{[{value: 'wireguard', label: 'WireGuard'}, {value: 'openvpn', label: 'OpenVPN'}, {value: 'ipsec', label: 'IPsec'}].find(o => o.value === item.vpn_type)?.label ?? item.vpn_type}</span></Select.Trigger><Select.Content class="border-slate-700 bg-slate-900"><Select.Item value="wireguard" label="WireGuard" /><Select.Item value="openvpn" label="OpenVPN" /><Select.Item value="ipsec" label="IPsec" /></Select.Content></Select.Root></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Auto Generate" hint="Use generated defaults if template is blank." /><div class="flex h-9 items-center"><Switch checked={item.auto_generate} onCheckedChange={(v) => (item.auto_generate = v)} /></div></label>
          <label class="space-y-1 text-sm"><FieldLabel label="Include CA" hint="Embed CA material in generated download." /><div class="flex h-9 items-center"><Switch checked={item.include_ca} onCheckedChange={(v) => (item.include_ca = v)} /></div></label>
          <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Description" hint="Runbook notes and intended audience." /><Input class="border-slate-700 bg-slate-950" bind:value={item.description} /></label>
          <label class="space-y-1 text-sm md:col-span-3"><FieldLabel label="Config Template" hint="Template body used by download endpoint." /><Textarea class="min-h-[130px] border-slate-700 bg-slate-950 font-mono text-xs" bind:value={item.config_template} /></label>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={() => saveOne(item)}><Save class="mr-2 size-4" />Save</Button>
          <Button variant="secondary" onclick={() => downloadConfig(item)}><Download class="mr-2 size-4" />Download</Button>
          <Button variant="destructive" onclick={() => remove(item.id)}><Trash class="mr-2 size-4" />Remove</Button>
        </div>
      </CardContent></Card>
    {/each}
  {/if}
</div>
