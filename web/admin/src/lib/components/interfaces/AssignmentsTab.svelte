<!-- Interface management component for the AssignmentsTab tab and related data. -->

<script lang="ts">
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import Save from '@lucide/svelte/icons/save';

  type Assignment = Record<string, unknown>;
  type Device = {
    name: string;
    mac: string;
    mac_address: string;
    status: string;
    link_detected: boolean;
    ipv4_addresses: string[];
    ipv6_addresses: string[];
    driver: string;
    speed: string;
  };

  let { onSelectInterface }: { onSelectInterface?: (name: string) => void } = $props();

  let loading = $state(true);
  let saving = $state(false);
  let error = $state('');
  let rows = $state<Assignment[]>([]);
  let devices = $state<Device[]>([]);
  let baseline = $state('[]');

  const dirty = $derived(JSON.stringify(rows) !== baseline);

  function text(value: unknown) {
    return value === null || value === undefined ? '' : String(value);
  }

  function findDevice(deviceName: string): Device | undefined {
    return devices.find(d => d.name === deviceName);
  }

  function deviceLabel(d: Device): string {
    const status = d.link_detected ? '🟢 UP' : '🔴 DOWN';
    const ip = d.ipv4_addresses.length > 0 ? d.ipv4_addresses[0] : 'no IP';
    return `${status} ${d.name} [${d.mac || d.mac_address || 'no MAC'}] — ${ip}`;
  }

  function statusClass(deviceName: string): string {
    const d = findDevice(deviceName);
    if (!d) return 'border-slate-600 bg-slate-800 text-slate-400';
    return d.link_detected
      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
      : 'border-rose-500/40 bg-rose-500/15 text-rose-300';
  }

  function setDevice(index: number, deviceName: string) {
    rows[index].device = deviceName;
  }

  function setDescription(index: number, value: string) {
    rows[index].description = value;
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const [assignmentsPayload, devicesPayload] = await Promise.all([
        api.get<Assignment[]>('/interfaces/assignments'),
        api.get<Device[]>('/interfaces/devices')
      ]);
      rows = Array.isArray(assignmentsPayload) ? assignmentsPayload : [];
      devices = Array.isArray(devicesPayload) ? devicesPayload : [];
      baseline = JSON.stringify(rows);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unable to load assignments';
      toasts.error(error);
    } finally {
      loading = false;
    }
  }

  async function save() {
    saving = true;
    try {
      await api.patch('/interfaces/assignments', rows);
      baseline = JSON.stringify(rows);
      toasts.success('Interface assignments saved');
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Unable to save assignments');
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <CardTitle class="text-slate-100">Assignments</CardTitle>
        <CardDescription class="text-slate-400">Map logical identifiers to physical network devices</CardDescription>
      </div>
      <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || !dirty}>
        <Save class="size-4" /> {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-2">
        {#each Array.from({ length: 5 }) as _}
          <Skeleton class="h-10 bg-slate-800" />
        {/each}
      </div>
    {:else if error}
      <p class="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>
    {:else}
      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-800">
            <TableRow class="border-slate-700 hover:bg-slate-800">
              <TableHead class="text-slate-300">Identifier</TableHead>
              <TableHead class="text-slate-300">Device</TableHead>
              <TableHead class="text-slate-300">Status</TableHead>
              <TableHead class="text-slate-300">MAC</TableHead>
              <TableHead class="text-slate-300">IP</TableHead>
              <TableHead class="text-slate-300">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each rows as row, i}
              {@const dev = findDevice(text(row.device))}
              <TableRow class="border-slate-800 hover:bg-slate-800/30">
                <TableCell>
                  <button
                    type="button"
                    class="font-medium text-cyan-300 transition hover:text-cyan-200"
                    onclick={() => onSelectInterface?.(text(row.identifier || row.name))}
                  >
                    {text(row.identifier || row.name)}
                  </button>
                </TableCell>
                <TableCell>
                  <select
                    class="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={text(row.device)}
                    onchange={(e) => setDevice(i, (e.currentTarget as HTMLSelectElement).value)}
                  >
                    <option value="" class="text-slate-500">— Select device —</option>
                    {#each devices as d}
                      <option value={d.name}>{deviceLabel(d)}</option>
                    {/each}
                  </select>
                </TableCell>
                <TableCell>
                  <Badge class={statusClass(text(row.device))}>
                    <span class="flex items-center gap-1.5">
                      <span
                        class="{dev ? (dev.link_detected ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.5)]') : 'bg-slate-500'} inline-block size-2 rounded-full"
                      ></span>
                      {dev ? (dev.link_detected ? 'UP' : 'DOWN') : 'N/A'}
                    </span>
                  </Badge>
                </TableCell>
                <TableCell>
                  <span class="font-mono text-sm text-slate-300">{dev?.mac || dev?.mac_address || 'N/A'}</span>
                </TableCell>
                <TableCell>
                  <span class="font-mono text-sm text-slate-300">{dev?.ipv4_addresses?.[0] || 'N/A'}</span>
                </TableCell>
                <TableCell>
                  <Input
                    class="border-slate-700 bg-slate-950 text-slate-200"
                    value={text(row.description)}
                    oninput={(e) => setDescription(i, (e.currentTarget as HTMLInputElement).value)}
                  />
                </TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    {/if}
  </CardContent>
</Card>
