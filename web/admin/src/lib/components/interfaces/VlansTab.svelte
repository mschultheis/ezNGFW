<!-- Interface management component for the VlansTab tab and related data. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Switch } from '$lib/components/ui/switch';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import Plus from '@lucide/svelte/icons/plus';
  import Check from '@lucide/svelte/icons/check';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  type Vlan = Record<string, unknown>;

  let loading = $state(true);
  let rows = $state<Vlan[]>([]);
  let parentInterfaces = $state<string[]>([]);
  let busyAction = $state('');

  let draft = $state({
    enabled: true,
    device_name: '',
    parent_interface: '',
    vlan_tag: '100',
    priority: '0',
    protocol: '802.1Q',
    description: ''
  });

  function text(v: unknown) {
    return v === null || v === undefined ? '' : String(v);
  }

  async function load() {
    loading = true;
    try {
      const [vlanPayload, ifacePayload] = await Promise.all([
        api.get<Vlan[]>('/vlans'),
        api.get<Record<string, unknown>[]>('/interfaces/overview')
      ]);
      rows = Array.isArray(vlanPayload) ? vlanPayload : [];
      parentInterfaces = Array.isArray(ifacePayload)
        ? ifacePayload.map((entry) => String(entry.name ?? entry.identifier ?? '')).filter((v) => v.length > 0)
        : [];
      if (!draft.parent_interface && parentInterfaces.length > 0) draft.parent_interface = parentInterfaces[0];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Unable to load VLANs');
    } finally {
      loading = false;
    }
  }

  async function add() {
    busyAction = 'add';
    try {
      await api.post('/vlans', {
        ...draft,
        vlan_tag: Number(draft.vlan_tag),
        priority: Number(draft.priority)
      });
      toasts.success('VLAN added');
      draft.device_name = '';
      draft.description = '';
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Unable to add VLAN');
    } finally {
      busyAction = '';
    }
  }

  async function update(deviceName: string, row: Vlan) {
    busyAction = `save:${deviceName}`;
    try {
      await api.put(`/vlans/${encodeURIComponent(deviceName)}`, {
        ...row,
        vlan_tag: Number(row.vlan_tag),
        priority: Number(row.priority)
      });
      toasts.success(`VLAN ${deviceName} updated`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : `Unable to update ${deviceName}`);
    } finally {
      busyAction = '';
    }
  }

  async function remove(deviceName: string) {
    busyAction = `delete:${deviceName}`;
    try {
      await api.del(`/vlans/${encodeURIComponent(deviceName)}`);
      toasts.success(`VLAN ${deviceName} deleted`);
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : `Unable to delete ${deviceName}`);
    } finally {
      busyAction = '';
    }
  }

  async function apply(deviceName: string) {
    busyAction = `apply:${deviceName}`;
    try {
      await api.post(`/vlans/${encodeURIComponent(deviceName)}/apply`);
      toasts.success(`Applied VLAN ${deviceName}`);
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : `Unable to apply ${deviceName}`);
    } finally {
      busyAction = '';
    }
  }

  function mutate(row: Vlan, key: string, value: string | boolean) {
    row[key] = value;
  }

  $effect(() => {
    void load();
  });
</script>

<div class="space-y-4">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">Add VLAN</CardTitle>
      <CardDescription class="text-slate-400">Create tagged interfaces with priority and protocol controls</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <label class="space-y-1 text-sm"><span class="text-slate-300">Enabled</span><div class="flex h-9 items-center rounded-md border border-slate-700 bg-slate-950 px-3"><Switch checked={draft.enabled} onCheckedChange={(v) => (draft.enabled = v)} /></div></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Device Name</span><Input class="border-slate-700 bg-slate-950" bind:value={draft.device_name} /></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Parent Interface</span><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" bind:value={draft.parent_interface}>{#each parentInterfaces as iface}<option value={iface}>{iface}</option>{/each}</select></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">VLAN Tag</span><Input type="number" min="1" max="4094" class="border-slate-700 bg-slate-950" bind:value={draft.vlan_tag} /></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Priority</span><Input type="number" min="0" max="7" class="border-slate-700 bg-slate-950" bind:value={draft.priority} /></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Protocol</span><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" bind:value={draft.protocol}><option value="802.1Q">802.1Q</option><option value="802.1ad">802.1ad</option></select></label>
      <label class="space-y-1 text-sm md:col-span-2"><span class="text-slate-300">Description</span><Input class="border-slate-700 bg-slate-950" bind:value={draft.description} /></label>
      <div class="md:col-span-2 xl:col-span-4"><Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={add} disabled={busyAction === 'add' || !draft.device_name || !draft.parent_interface}><Plus class="size-4" /> {busyAction === 'add' ? 'Adding...' : 'Add VLAN'}</Button></div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">VLANs</CardTitle></CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-2">{#each Array.from({ length: 5 }) as _}<Skeleton class="h-10 bg-slate-800" />{/each}</div>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-800"><TableRow class="border-slate-700 hover:bg-slate-800"><TableHead class="text-slate-300">Enabled</TableHead><TableHead class="text-slate-300">Device</TableHead><TableHead class="text-slate-300">Parent</TableHead><TableHead class="text-slate-300">Tag</TableHead><TableHead class="text-slate-300">Priority</TableHead><TableHead class="text-slate-300">Protocol</TableHead><TableHead class="text-slate-300">Description</TableHead><TableHead class="text-slate-300">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {#if rows.length === 0}
                <TableRow class="border-slate-800 hover:bg-slate-900"><TableCell colspan={8} class="py-8 text-center text-slate-500">No VLANs configured</TableCell></TableRow>
              {:else}
                {#each rows as row}
                  {@const deviceName = text(row.device_name)}
                  <TableRow class="border-slate-800 hover:bg-slate-800/30">
                    <TableCell><Switch checked={Boolean(row.enabled)} onCheckedChange={(v) => mutate(row, 'enabled', v)} /></TableCell>
                    <TableCell class="font-medium text-slate-100">{deviceName}</TableCell>
                    <TableCell><select class="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100" value={text(row.parent_interface)} onchange={(e) => mutate(row, 'parent_interface', (e.currentTarget as HTMLSelectElement).value)}>{#each parentInterfaces as iface}<option value={iface}>{iface}</option>{/each}</select></TableCell>
                    <TableCell><Input class="h-8 border-slate-700 bg-slate-950" type="number" min="1" max="4094" value={text(row.vlan_tag)} oninput={(e) => mutate(row, 'vlan_tag', (e.currentTarget as HTMLInputElement).value)} /></TableCell>
                    <TableCell><Input class="h-8 border-slate-700 bg-slate-950" type="number" min="0" max="7" value={text(row.priority)} oninput={(e) => mutate(row, 'priority', (e.currentTarget as HTMLInputElement).value)} /></TableCell>
                    <TableCell><select class="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100" value={text(row.protocol)} onchange={(e) => mutate(row, 'protocol', (e.currentTarget as HTMLSelectElement).value)}><option value="802.1Q">802.1Q</option><option value="802.1ad">802.1ad</option></select></TableCell>
                    <TableCell><Input class="h-8 border-slate-700 bg-slate-950" value={text(row.description)} oninput={(e) => mutate(row, 'description', (e.currentTarget as HTMLInputElement).value)} /></TableCell>
                    <TableCell class="space-x-2"><Button size="sm" variant="outline" class="border-slate-700" onclick={() => update(deviceName, row)} disabled={busyAction === `save:${deviceName}`}><Check class="size-4" /> Save</Button><Button size="sm" variant="outline" class="border-sky-500/40 text-sky-300" onclick={() => apply(deviceName)} disabled={busyAction === `apply:${deviceName}`}>Apply</Button><Button size="sm" variant="outline" class="border-rose-500/40 text-rose-300" onclick={() => remove(deviceName)} disabled={busyAction === `delete:${deviceName}`}><Trash2 class="size-4" /></Button></TableCell>
                  </TableRow>
                {/each}
              {/if}
            </TableBody>
          </Table>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
