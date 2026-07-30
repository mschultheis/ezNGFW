<!-- Route view for `/routing/vrf` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type Vrf = { id?: string; name: string; table_id: number; description: string; interfaces: string[]; import_route_targets: string[]; export_route_targets: string[]; enabled: boolean };
  let loading = $state(true);
  let saving = $state(false);
  let interfaces = $state<string[]>([]);
  let vrfs = $state<Vrf[]>([]);
  let form = $state<Vrf>({ name: '', table_id: 1001, description: '', interfaces: [], import_route_targets: [], export_route_targets: [], enabled: true });
  let selectedInterface = $state('');
  let importRts = $state('');
  let exportRts = $state('');

  async function load() {
    loading = true;
    try {
      const [vrfData, ifaceData] = await Promise.all([api.get('/routing/vrfs'), api.get('/interfaces').catch(() => [])]);
      vrfs = Array.isArray(vrfData) ? (vrfData as Vrf[]) : [];
      interfaces = Array.isArray(ifaceData)
        ? ifaceData.map((row) => String((row as Record<string, unknown>).name ?? '')).filter(Boolean)
        : [];
      selectedInterface = interfaces[0] ?? '';
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load VRFs');
    } finally {
      loading = false;
    }
  }

  function addInterfaceToForm() {
    if (!selectedInterface) return;
    if (!form.interfaces.includes(selectedInterface)) form.interfaces = [...form.interfaces, selectedInterface];
  }

  async function createVrf() {
    saving = true;
    try {
      form.import_route_targets = importRts.split(',').map((v) => v.trim()).filter(Boolean);
      form.export_route_targets = exportRts.split(',').map((v) => v.trim()).filter(Boolean);
      await api.post('/routing/vrfs', form);
      await load();
      form = { name: '', table_id: 1001, description: '', interfaces: [], import_route_targets: [], export_route_targets: [], enabled: true };
      importRts = '';
      exportRts = '';
      toasts.success($_('routing_vrf.toastvrf_created'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to create VRF');
    } finally {
      saving = false;
    }
  }

  async function updateVrf(vrf: Vrf, idx: number) {
    saving = true;
    try {
      await api.put(`/routing/vrfs/${vrf.id ?? String(idx)}`, vrf);
      toasts.success($_('routing_vrf.toastvrf_updated'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to update VRF');
    } finally {
      saving = false;
    }
  }

  async function removeVrf(vrf: Vrf, idx: number) {
    saving = true;
    try {
      await api.del(`/routing/vrfs/${vrf.id ?? String(idx)}`);
      vrfs = vrfs.filter((_, i) => i !== idx);
      toasts.success($_('routing_vrf.toastvrf_removed'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to remove VRF');
    } finally {
      saving = false;
    }
  }

  onMount(() => void load());
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{$_('routing_vrf.vrf_configuration')}</CardTitle>
    <CardDescription class="text-slate-400">{$_('routing_vrf.create_isolated_pervrf_routing_instances_with_tabl')}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <p class="text-sm text-slate-400">{$_('routing_vrf.loading_vrf_data')}</p>
    {:else}
      <div class="rounded border border-slate-800 p-4">
        <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_vrf.create_vrf')}</h3>
        <div class="grid gap-3 md:grid-cols-3">
          <div><FieldLabel label="Name" hint="Set a unique VRF name used by CLI, policy references, and operator workflows. Keep naming convention consistent across regions for predictable automation. Example: CUST-A or MGMT-VRF." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.name} /></div>
          <div><FieldLabel label="Table ID" hint="Assign Linux routing table ID used for this VRF instance and policy routing lookups. Ensure table IDs are unique to prevent overlap with other VRFs. Example: 1001 for tenant A." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.table_id} /></div>
          <div><FieldLabel label="Enabled" hint="Toggle whether this VRF is active while preserving configuration for quick rollback and staged rollout. Disable when draining traffic before maintenance or migration. Example: enabled in production and disabled in standby lab." /><div class="mt-2"><Switch bind:checked={form.enabled} /></div></div>
          <div class="md:col-span-3"><FieldLabel label="Description" hint="Describe business owner, purpose, and expected routing scope for this VRF in operations context. Good descriptions accelerate incident triage and change review quality. Example: Payment-processing tenant east region." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={form.description} /></div>
          <div><FieldLabel label="Interface" hint="Select interfaces assigned to this VRF to isolate forwarding and routing decisions. Use only interfaces intended for this tenant or service domain. Example: eth2 and vlan200 for customer edge." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={selectedInterface}>{#each interfaces as iface}<option value={iface}>{iface}</option>{/each}</select><Button variant="outline" class="mt-2 border-slate-700" onclick={addInterfaceToForm}>Add Interface</Button></div>
          <div><FieldLabel label="Import Route Targets" hint="Set route targets imported into this VRF from VPN control plane communities or interconnect policy. Keep import list strict to prevent unintended route leaks. Example: target:65000:100,target:65000:110." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={importRts} /></div>
          <div><FieldLabel label="Export Route Targets" hint="Define route targets this VRF exports so remote instances can import only approved prefixes. Align export policy with segmentation and compliance requirements. Example: target:65000:100." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={exportRts} /></div>
        </div>
        <div class="mt-2 text-sm text-slate-300">Interfaces: {form.interfaces.join(', ') || '-'}</div>
        <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={createVrf} disabled={saving}>Create VRF</Button>
      </div>

      <div class="space-y-3">
        {#each vrfs as vrf, idx}
          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <div class="grid gap-2 md:grid-cols-3">
              <Input class="border-slate-700 bg-slate-900" bind:value={vrf.name} />
              <Input class="border-slate-700 bg-slate-900" type="number" bind:value={vrf.table_id} />
              <div class="flex items-center gap-2 text-sm"><span>{$_('routing_vrf.enabled')}</span><Switch bind:checked={vrf.enabled} /></div>
            </div>
            <div class="mt-2 text-sm text-slate-300">{vrf.description}</div>
            <div class="mt-2 flex gap-2"><Button variant="outline" class="border-slate-700" onclick={() => updateVrf(vrf, idx)}>Save</Button><Button variant="outline" class="border-red-700 text-red-300" onclick={() => removeVrf(vrf, idx)}>Delete</Button></div>
          </div>
        {/each}
      </div>
    {/if}
  </CardContent>
</Card>
