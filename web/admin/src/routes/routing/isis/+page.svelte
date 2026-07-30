<!-- Route view for `/routing/isis` in the ezNGFW admin GUI. -->

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

  type IsisInterface = { name: string; level: string; metric: number; circuit_type: string; passive: boolean; hello_interval: number; hello_multiplier: number };
  let loading = $state(true);
  let saving = $state(false);
  let interfaces = $state<string[]>([]);
  let cfg = $state({ enabled: false, system_id: '', areas: [] as string[], level_type: 'l1l2', interfaces: [] as IsisInterface[], metric_style: 'wide', authentication_type: 'none', authentication_key: '', redistribute: [] as string[], overload_bit: false, lsp_lifetime: 1200 });
  let areasText = $state('');
  let redistributeText = $state('');
  let form = $state<IsisInterface>({ name: '', level: 'l1l2', metric: 10, circuit_type: 'broadcast', passive: false, hello_interval: 10, hello_multiplier: 3 });

  async function load() {
    loading = true;
    try {
      const [data, ifaceData] = await Promise.all([api.get('/routing/isis'), api.get('/interfaces').catch(() => [])]);
      const d = (data ?? {}) as Record<string, unknown>;
      cfg = {
        enabled: Boolean(d.enabled ?? false),
        system_id: String(d.system_id ?? ''),
        areas: Array.isArray(d.areas) ? (d.areas as string[]) : [],
        level_type: String(d.level_type ?? 'l1l2'),
        interfaces: Array.isArray(d.interfaces) ? (d.interfaces as IsisInterface[]) : [],
        metric_style: String(d.metric_style ?? 'wide'),
        authentication_type: String(d.authentication_type ?? 'none'),
        authentication_key: String(d.authentication_key ?? ''),
        redistribute: Array.isArray(d.redistribute) ? (d.redistribute as string[]) : [],
        overload_bit: Boolean(d.overload_bit ?? false),
        lsp_lifetime: Number(d.lsp_lifetime ?? 1200)
      };
      areasText = cfg.areas.join(',');
      redistributeText = cfg.redistribute.join(',');
      interfaces = Array.isArray(ifaceData)
        ? ifaceData.map((row) => String((row as Record<string, unknown>).name ?? '')).filter(Boolean)
        : [];
      if (!form.name && interfaces.length > 0) form.name = interfaces[0];
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load IS-IS config');
    } finally {
      loading = false;
    }
  }

  function addInterface() {
    if (!form.name.trim()) return;
    cfg.interfaces = [...cfg.interfaces, { ...form }];
  }

  async function save() {
    saving = true;
    try {
      cfg.areas = areasText.split(',').map((v) => v.trim()).filter(Boolean);
      cfg.redistribute = redistributeText.split(',').map((v) => v.trim()).filter(Boolean);
      await api.patch('/routing/isis', cfg);
      toasts.success($_('routing_isis.toastisis_configuration_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save IS-IS config');
    } finally {
      saving = false;
    }
  }

  onMount(() => void load());
</script>

<Card class="border-slate-800 bg-slate-900">
  <CardHeader>
    <CardTitle class="text-slate-100">{$_('routing_isis.isis_configuration')}</CardTitle>
    <CardDescription class="text-slate-400">{$_('routing_isis.configure_levels_metrics_authentication_and_perint')}</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <p class="text-sm text-slate-400">{$_('routing_isis.loading_isis_data')}</p>
    {:else}
      <div class="grid gap-4 md:grid-cols-3">
        <div><FieldLabel label="Enabled" hint="Enable IS-IS process to advertise and learn routes with link-state convergence semantics. Keep disabled until interface and authentication settings are prepared for production peers. Example: enabled in MPLS/IP core domains." /><div class="mt-2"><Switch bind:checked={cfg.enabled} /></div></div>
        <div><FieldLabel label="System ID" hint="Set the NET/system identifier used by IS-IS adjacency and LSP identification. This must be unique in the IS-IS domain for deterministic operation. Example: 49.0001.1921.6800.1001.00." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.system_id} /></div>
        <div><FieldLabel label="Level Type" hint="Choose whether router operates in L1, L2, or dual L1L2 mode depending on topology hierarchy. L1L2 is common for area border roles and migration flexibility. Example: l1l2 in regional core nodes." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={cfg.level_type}><option value="l1">l1</option><option value="l2">l2</option><option value="l1l2">l1l2</option></select></div>
        <div><FieldLabel label="Areas" hint="Provide IS-IS area addresses as comma-separated values to scope level-1 behavior and area boundaries. Keep these aligned with domain design documents for troubleshooting clarity. Example: 49.0001,49.0002." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={areasText} /></div>
        <div><FieldLabel label="Metric Style" hint="Select metric encoding style to support standard or wide metrics based on network scale requirements. Wide metrics are recommended for modern multi-domain deployments. Example: wide for large transport networks." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={cfg.metric_style}><option value="narrow">narrow</option><option value="wide">wide</option></select></div>
        <div><FieldLabel label="LSP Lifetime" hint="Set the lifetime for generated LSPs to control refresh cadence and stale information timeout. Larger values reduce churn while still requiring periodic refresh. Example: 1200 seconds." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.lsp_lifetime} /></div>
        <div><FieldLabel label="Redistribute" hint="List protocols redistributed into IS-IS with comma-separated values for controlled external route injection. Keep filters and route-maps in mind to avoid flooding external noise. Example: connected,static." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={redistributeText} /></div>
        <div><FieldLabel label="Authentication Type" hint="Choose authentication mode used on IS-IS control packets to prevent unauthorized adjacency. Match this exactly across neighbors before enabling on live links. Example: md5 on shared provider handoff." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={cfg.authentication_type}><option value="none">none</option><option value="text">text</option><option value="md5">md5</option></select></div>
        <div><FieldLabel label="Authentication Key" hint="Set the shared authentication secret or key-chain name according to selected mode and platform policy. Rotate this under change control to preserve adjacency stability. Example: CORE-ISIS-KEYCHAIN." /><Input class="mt-2 border-slate-700 bg-slate-950" bind:value={cfg.authentication_key} /></div>
        <div><FieldLabel label="Overload Bit" hint="Enable overload bit to keep node as transit-ineligible during maintenance or startup convergence windows. This allows graceful traffic engineering while still maintaining adjacency. Example: enabled during control-plane warmup." /><div class="mt-2"><Switch bind:checked={cfg.overload_bit} /></div></div>
      </div>

      <div class="rounded border border-slate-800 p-4">
        <h3 class="mb-3 text-sm font-semibold text-slate-100">{$_('routing_isis.interfaces')}</h3>
        <div class="grid gap-3 md:grid-cols-4">
          <div><FieldLabel label="Interface" hint="Select interface where IS-IS hellos and LSP exchanges are enabled for adjacency formation. Choose transit links and avoid user-edge access segments by default. Example: eth1 for core uplink." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={form.name}>{#each interfaces as iface}<option value={iface}>{iface}</option>{/each}</select></div>
          <div><FieldLabel label="Level" hint="Define interface participation level to align with area and backbone topology role. Use l2 on core links and l1 for area-only segments where required. Example: l2 on inter-core trunks." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={form.level}><option value="l1">l1</option><option value="l2">l2</option><option value="l1l2">l1l2</option></select></div>
          <div><FieldLabel label="Metric" hint="Set interface routing cost for path selection and traffic engineering inside IS-IS domain. Lower metrics prefer paths and should reflect link quality and capacity. Example: 10 on high-capacity fiber uplinks." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.metric} /></div>
          <div><FieldLabel label="Circuit Type" hint="Set circuit media behavior to broadcast or point-to-point according to underlying link characteristics. Correct type avoids neighbor election mismatch and protocol ambiguity. Example: point-to-point on routed WAN links." /><select class="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3" bind:value={form.circuit_type}><option value="broadcast">broadcast</option><option value="point-to-point">point-to-point</option></select></div>
          <div><FieldLabel label="Passive" hint="Mark interface passive to advertise connected network without sending hello packets or forming adjacencies. Useful for loopbacks and service VLANs without neighbors. Example: true on loopback interfaces." /><div class="mt-2"><Switch bind:checked={form.passive} /></div></div>
          <div><FieldLabel label="Hello Interval" hint="Configure hello interval controlling adjacency liveliness detection speed for this interface. Keep consistent across neighbors to avoid unstable sessions. Example: 10 seconds on LAN links." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.hello_interval} /></div>
          <div><FieldLabel label="Hello Multiplier" hint="Set hold multiplier controlling how many missed hellos trigger neighbor down state. Higher values trade failure-detection speed for tolerance. Example: 3 for standard balance." /><Input type="number" class="mt-2 border-slate-700 bg-slate-950" bind:value={form.hello_multiplier} /></div>
        </div>
        <Button class="mt-3 bg-cyan-600 text-white hover:bg-cyan-500" onclick={addInterface}>Add Interface</Button>
        <div class="mt-3 space-y-2">
          {#each cfg.interfaces as iface, i}
            <div class="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm"><span>{iface.name} {iface.level} metric {iface.metric}</span><Button variant="outline" class="border-slate-700" onclick={() => (cfg.interfaces = cfg.interfaces.filter((_, idx) => idx !== i))}>Remove</Button></div>
          {/each}
        </div>
      </div>
    {/if}

    <Button class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={save} disabled={saving || loading}>{saving ? 'Saving...' : 'Save IS-IS'}</Button>
  </CardContent>
</Card>
