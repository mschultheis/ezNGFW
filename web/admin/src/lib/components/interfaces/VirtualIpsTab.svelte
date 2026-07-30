<!-- Interface management component for the VirtualIpsTab tab and related data. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  type Vip = Record<string, unknown>;

  let loading = $state(true);
  let creating = $state(false);
  let deleting = $state('');
  let rows = $state<Vip[]>([]);
  let interfaces = $state<string[]>([]);

  let form = $state({
    mode: 'IpAlias',
    interface: '',
    address: '',
    subnet: '24',
    vhid: '',
    description: '',
    password: '',
    adv_base: '1',
    adv_skew: '0'
  });

  const isCarp = $derived(form.mode === 'Carp');

  function text(v: unknown) {
    return v === null || v === undefined || v === '' ? 'N/A' : String(v);
  }

  async function load() {
    loading = true;
    try {
      const [vipsPayload, ifacePayload] = await Promise.all([
        api.get<Vip[]>('/interfaces/vips'),
        api.get<Record<string, unknown>[]>('/interfaces/overview')
      ]);
      rows = Array.isArray(vipsPayload) ? vipsPayload : [];
      interfaces = Array.isArray(ifacePayload)
        ? ifacePayload.map((entry) => String(entry.name ?? entry.identifier ?? '')).filter((v) => v.length > 0)
        : [];
      if (!form.interface && interfaces.length > 0) form.interface = interfaces[0];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Unable to load virtual IPs');
    } finally {
      loading = false;
    }
  }

  async function createVip() {
    creating = true;
    try {
      const payload: Record<string, unknown> = {
        mode: form.mode,
        interface: form.interface,
        address: form.address,
        subnet: Number(form.subnet),
        description: form.description
      };
      if (isCarp) {
        payload.vhid = Number(form.vhid || 0);
        payload.password = form.password;
        payload.adv_base = Number(form.adv_base || 1);
        payload.adv_skew = Number(form.adv_skew || 0);
      }
      await api.post('/interfaces/vips', payload);
      toasts.success('Virtual IP added');
      form.address = '';
      form.description = '';
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Unable to add virtual IP');
    } finally {
      creating = false;
    }
  }

  async function deleteVip(idx: string) {
    deleting = idx;
    try {
      await api.del(`/interfaces/vips/${encodeURIComponent(idx)}`);
      toasts.success('Virtual IP deleted');
      await load();
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Unable to delete virtual IP');
    } finally {
      deleting = '';
    }
  }

  $effect(() => {
    void load();
  });
</script>

<div class="space-y-4">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">Add Virtual IP</CardTitle>
      <CardDescription class="text-slate-400">Create IP Alias, CARP, or Proxy ARP addresses</CardDescription>
    </CardHeader>
    <CardContent class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label class="space-y-1 text-sm"><span class="text-slate-300">Mode</span><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" bind:value={form.mode}><option value="IpAlias">IpAlias</option><option value="Carp">Carp</option><option value="ProxyArp">ProxyArp</option></select></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Interface</span><select class="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-100" bind:value={form.interface}>{#each interfaces as iface}<option value={iface}>{iface}</option>{/each}</select></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Address</span><Input class="border-slate-700 bg-slate-950" bind:value={form.address} /></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Subnet</span><Input type="number" class="border-slate-700 bg-slate-950" bind:value={form.subnet} /></label>
      <label class="space-y-1 text-sm"><span class="text-slate-300">Description</span><Input class="border-slate-700 bg-slate-950" bind:value={form.description} /></label>
      {#if isCarp}
        <label class="space-y-1 text-sm"><span class="text-slate-300">VHID</span><Input type="number" class="border-slate-700 bg-slate-950" bind:value={form.vhid} /></label>
        <label class="space-y-1 text-sm"><span class="text-slate-300">Password</span><Input type="password" class="border-slate-700 bg-slate-950" bind:value={form.password} /></label>
        <label class="space-y-1 text-sm"><span class="text-slate-300">Adv Base</span><Input type="number" class="border-slate-700 bg-slate-950" bind:value={form.adv_base} /></label>
        <label class="space-y-1 text-sm"><span class="text-slate-300">Adv Skew</span><Input type="number" class="border-slate-700 bg-slate-950" bind:value={form.adv_skew} /></label>
      {/if}
      <div class="md:col-span-2 xl:col-span-3">
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={createVip} disabled={creating || !form.interface || !form.address}>
          <Plus class="size-4" /> {creating ? 'Adding...' : 'Add Virtual IP'}
        </Button>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">Virtual IPs</CardTitle></CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-2">{#each Array.from({ length: 5 }) as _}<Skeleton class="h-10 bg-slate-800" />{/each}</div>
      {:else}
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-800"><TableRow class="border-slate-700 hover:bg-slate-800"><TableHead class="text-slate-300">Mode</TableHead><TableHead class="text-slate-300">Interface</TableHead><TableHead class="text-slate-300">Address</TableHead><TableHead class="text-slate-300">Subnet</TableHead><TableHead class="text-slate-300">VHID</TableHead><TableHead class="text-slate-300">Description</TableHead><TableHead class="text-slate-300">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {#if rows.length === 0}
                <TableRow class="border-slate-800 hover:bg-slate-900"><TableCell colspan={7} class="py-8 text-center text-slate-500">No virtual IP entries</TableCell></TableRow>
              {:else}
                {#each rows as row, i}
                  {@const idx = String(row.idx ?? i)}
                  <TableRow class="border-slate-800 hover:bg-slate-800/30">
                    <TableCell>{text(row.mode)}</TableCell>
                    <TableCell>{text(row.interface)}</TableCell>
                    <TableCell class="mono text-xs">{text(row.address)}</TableCell>
                    <TableCell>{text(row.subnet)}</TableCell>
                    <TableCell>{text(row.vhid)}</TableCell>
                    <TableCell>{text(row.description)}</TableCell>
                    <TableCell><Button size="sm" variant="outline" class="border-rose-500/40 text-rose-300 hover:bg-rose-500/10" onclick={() => deleteVip(idx)} disabled={deleting === idx}><Trash2 class="size-4" /> Delete</Button></TableCell>
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
