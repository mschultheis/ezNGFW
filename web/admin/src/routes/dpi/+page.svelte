<!-- Route view for `/dpi` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import * as Select from '$lib/components/ui/select';
  import SaveIcon from '@lucide/svelte/icons/save';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import RefreshCcwIcon from '@lucide/svelte/icons/refresh-ccw';
  import { _ } from '$lib/i18n';

  /* ---------- types ---------- */
  type DpiSettings = {
    enabled: boolean;
    engine: string;
    inspectionMode: string;
    interfaces: string;
    defaultAction: string;
    logAllTraffic: boolean;
    logBlockedTraffic: boolean;
    updateSignatures: boolean;
    detectProtocols: string;
    blockCategories: string;
    customSignatures: string;
    maxFlows: number;
    flowTimeout: number;
    cacheSize: number;
    geoipEnabled: boolean;
    sslInspection: boolean;
    quicDetection: boolean;
  };
  type CategoryPolicy = { name: string; action: string; bwLimitKbps: number; log: boolean; enabled: boolean; applicationsCount: number; description: string };
  type AppRule = { name: string; category: string; action: string; bwLimitKbps: number; schedule: string; log: boolean; enabled: boolean; description: string };

  const defaults: DpiSettings = {
    enabled: false, engine: 'ndpi', inspectionMode: 'balanced', interfaces: '', defaultAction: 'allow', logAllTraffic: false, logBlockedTraffic: true,
    updateSignatures: true,
    detectProtocols: '', blockCategories: '', customSignatures: '', maxFlows: 100000,
    flowTimeout: 120, cacheSize: 4096, geoipEnabled: false, sslInspection: false, quicDetection: true
  };

  /* ---------- state ---------- */
  let settings = $state<DpiSettings>({ ...defaults });
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);

  let interfaceOptions = $state<{ label: string; value: string }[]>([]);
  const selectedInterfaces = $derived(settings.interfaces.split(',').map((v) => v.trim()).filter(Boolean));

  let categories = $state<CategoryPolicy[]>([]);
  let catLoading = $state(true);
  let catSaving = $state(false);
  let editingCat = $state<CategoryPolicy | null>(null);

  let appRules = $state<AppRule[]>([]);
  let appLoading = $state(true);
  let appSaving = $state(false);
  let editingApp = $state<AppRule | null>(null);

  let stats = $state<Record<string, unknown>>({});
  let statsLoading = $state(true);
  let capabilities = $state<string[]>([]);

  function toggleInterface(value: string, enabled: boolean) {
    const current = new Set(selectedInterfaces);
    if (enabled) {
      current.add(value);
    } else {
      current.delete(value);
    }
    settings.interfaces = Array.from(current).sort().join(',');
  }

  /* ---------- loaders ---------- */
  async function load() {
    loading = true;
    try {
      const [payload, ifaces] = await Promise.all([api.get('/dpi'), api.get('/interfaces')]);
      const d = asObject(payload);
      settings = {
        enabled: Boolean(d.enabled ?? defaults.enabled),
        engine: String(d.engine ?? defaults.engine),
        inspectionMode: String(d.inspectionMode ?? d.inspection_mode ?? defaults.inspectionMode),
        interfaces: String(d.interfaces ?? defaults.interfaces),
        defaultAction: String(d.defaultAction ?? d.default_action ?? defaults.defaultAction),
        logAllTraffic: Boolean(d.logAllTraffic ?? defaults.logAllTraffic),
        logBlockedTraffic: Boolean(d.logBlockedTraffic ?? defaults.logBlockedTraffic),
        updateSignatures: Boolean(d.updateSignatures ?? d.update_signatures ?? defaults.updateSignatures),
        detectProtocols: String(d.detectProtocols ?? defaults.detectProtocols),
        blockCategories: String(d.blockCategories ?? defaults.blockCategories),
        customSignatures: String(d.customSignatures ?? defaults.customSignatures),
        maxFlows: Number(d.maxFlows ?? defaults.maxFlows),
        flowTimeout: Number(d.flowTimeout ?? defaults.flowTimeout),
        cacheSize: Number(d.cacheSize ?? defaults.cacheSize),
        geoipEnabled: Boolean(d.geoipEnabled ?? defaults.geoipEnabled),
        sslInspection: Boolean(d.sslInspection ?? defaults.sslInspection),
        quicDetection: Boolean(d.quicDetection ?? defaults.quicDetection),
      };
      interfaceOptions = asList(ifaces).map((i: unknown) => {
        const r = typeof i === 'object' && i !== null ? (i as Record<string, unknown>) : null;
        const v = String(r?.name ?? r?.id ?? i ?? '');
        return { label: v, value: v };
      });
    } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load DPI settings'); }
    finally { loading = false; }
  }

  async function loadCategories() {
    catLoading = true;
    try { categories = asList(await api.get('/dpi/categories')).map((c: unknown) => { const r = asObject(c); return { name: String(r.name ?? ''), action: String(r.action ?? 'allow'), bwLimitKbps: Number(r.bwLimitKbps ?? 0), log: Boolean(r.log), enabled: Boolean(r.enabled ?? true), applicationsCount: Number(r.applicationsCount ?? r.applications_count ?? 0), description: String(r.description ?? '') }; }); }
    catch { categories = []; }
    finally { catLoading = false; }
  }

  async function loadAppRules() {
    appLoading = true;
    try { appRules = asList(await api.get('/dpi/app-rules')).map((c: unknown) => { const r = asObject(c); return { name: String(r.name ?? ''), category: String(r.category ?? ''), action: String(r.action ?? 'allow'), bwLimitKbps: Number(r.bwLimitKbps ?? 0), schedule: String(r.schedule ?? ''), log: Boolean(r.log), enabled: Boolean(r.enabled ?? true), description: String(r.description ?? '') }; }); }
    catch { appRules = []; }
    finally { appLoading = false; }
  }

  async function loadStats() {
    statsLoading = true;
    try {
      stats = asObject(await api.get('/dpi/stats'));
      const raw = stats.capabilities;
      if (Array.isArray(raw)) capabilities = raw.map(String);
      else if (raw && typeof raw === 'object') capabilities = Object.entries(raw as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k);
      else capabilities = [];
    } catch { stats = {}; capabilities = []; }
    finally { statsLoading = false; }
  }

  /* ---------- save ---------- */
  async function save() {
    saving = true;
    try { await api.patch('/dpi', settings); toasts.success($_('dpi.toastdpi_settings_saved')); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { saving = false; }
  }

  async function saveCategories() {
    catSaving = true;
    try { await api.patch('/dpi/categories', categories); toasts.success($_('dpi.toastcategory_policies_saved')); editingCat = null; }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { catSaving = false; }
  }

  async function saveAppRules() {
    appSaving = true;
    try { await api.patch('/dpi/app-rules', appRules); toasts.success($_('dpi.toastapplication_rules_saved')); editingApp = null; }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Save failed'); }
    finally { appSaving = false; }
  }

  function addCategory() { const c: CategoryPolicy = { name: '', action: 'allow', bwLimitKbps: 0, log: false, enabled: true, applicationsCount: 0, description: '' }; categories = [...categories, c]; editingCat = c; }
  function removeCategory(idx: number) { categories = categories.filter((_, i) => i !== idx); }
  function addAppRule() { const r: AppRule = { name: '', category: '', action: 'allow', bwLimitKbps: 0, schedule: '', log: false, enabled: true, description: '' }; appRules = [...appRules, r]; editingApp = r; }
  function removeAppRule(idx: number) { appRules = appRules.filter((_, i) => i !== idx); }

  const engineOptions = [
    { label: 'nDPI (recommended)', value: 'ndpi' },
    { label: 'L7 Filter (legacy)', value: 'l7-filter' }
  ];
  const actionOptions = [
    { label: 'Allow', value: 'allow' },
    { label: 'Block', value: 'block' },
    { label: 'Throttle', value: 'throttle' },
    { label: 'Log Only', value: 'log' }
  ];

  onMount(() => { void load(); void loadCategories(); void loadAppRules(); void loadStats(); });

</script>

<div class="space-y-6">
  <!-- DPI Engine Settings -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="flex items-center gap-2 text-slate-100"><ShieldIcon class="size-4" /> DPI Engine Settings</CardTitle>
          <CardDescription class="text-slate-400">{$_('dpi.configure_the_protocol_classification_engine_inter')}</CardDescription>
        </div>
        <Badge class={settings.enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}>
          {settings.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>
    </CardHeader>
    <CardContent>
      {#if loading}
        <div class="space-y-3"><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /><Skeleton class="h-9 bg-slate-800" /></div>
      {:else}
        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <FieldLabel label="Enabled" hint="Activate the DPI engine to classify network flows in real time. When disabled, no application identification occurs and all traffic passes uninspected. Enable on interfaces where you need visibility or policy enforcement. Example: enable on LAN and guest interfaces." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.enabled} onCheckedChange={(v) => (settings.enabled = v)} />
                <span class="text-xs" class:text-emerald-400={settings.enabled} class:text-slate-500={!settings.enabled}>{settings.enabled ? 'Active' : 'Disabled'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Engine" hint="Select the classification backend. nDPI supports 300+ protocols including modern encrypted apps (QUIC, DoH, DoT) with active maintenance. L7-Filter is legacy Linux netfilter-based and supports fewer protocols. Use nDPI unless you have specific legacy compatibility requirements." />
              <Select.Root type="single" value={settings.engine} onValueChange={(v) => { if (v) settings.engine = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100">
                  <span>{engineOptions.find(o => o.value === settings.engine)?.label ?? 'Select…'}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  {#each engineOptions as opt}
                    <Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Inspection Mode" hint="Defines DPI strictness and CPU posture. Balanced is recommended for production, Aggressive improves detection depth at the cost of additional processing, and Performance reduces parsing detail for high-throughput links. Example: Balanced on office WAN edges, Performance on 10G aggregation with external monitoring." />
              <Select.Root type="single" value={settings.inspectionMode} onValueChange={(v) => { if (v) settings.inspectionMode = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{settings.inspectionMode || 'Select...'}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  <Select.Item value="performance" label="Performance" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  <Select.Item value="balanced" label="Balanced" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  <Select.Item value="aggressive" label="Aggressive" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                </Select.Content>
              </Select.Root>
            </label>

            <div class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Monitored Interfaces" hint="Select interfaces whose traversing traffic should be classified by DPI. Restricting scope lowers CPU usage and keeps analytics relevant for operators. Example: enable LAN and guest VLANs, but leave loopback and dedicated HA sync interfaces unselected." />
              <div class="grid gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-3">
                {#each interfaceOptions as opt}
                  <label class="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <span class="text-slate-200">{opt.label}</span>
                    <Switch checked={selectedInterfaces.includes(opt.value)} onCheckedChange={(v) => toggleInterface(opt.value, Boolean(v))} class="cursor-pointer" />
                  </label>
                {/each}
              </div>
            </div>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Default Action" hint="Fallback action used when traffic is classified but no application or category override applies. Allow is safest for initial deployments, Alert is useful for policy dry-runs, and Block is strict for controlled environments. Example: set Alert during rollout, then move to Block after tuning exceptions." />
              <Select.Root type="single" value={settings.defaultAction} onValueChange={(v) => { if (v) settings.defaultAction = v; }}>
                <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{settings.defaultAction || 'Select...'}</span></Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900">
                  <Select.Item value="allow" label="Allow" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  <Select.Item value="alert" label="Alert" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                  <Select.Item value="block" label="Block" class="cursor-pointer text-slate-200 hover:bg-slate-800" />
                </Select.Content>
              </Select.Root>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Block Categories" hint="Globally blocked DPI categories applied before per-application rules. Traffic matching these categories is silently dropped. Separate multiple categories with commas. Example: malware, botnet, mining, p2p." />
              <Input class="border-slate-700 bg-slate-950" value={settings.blockCategories} oninput={(e) => (settings.blockCategories = (e.currentTarget as HTMLInputElement).value)} placeholder="malware, botnet, p2p" />
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Log All Traffic" hint="When enabled, every classified flow is logged regardless of action. This generates significant log volume and should only be used temporarily for auditing, compliance, or debugging. Disable once your policies are stable. Example: enable for the first 24 hours after new rules." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.logAllTraffic} onCheckedChange={(v) => (settings.logAllTraffic = v)} />
                <span class="text-xs text-slate-400">{settings.logAllTraffic ? 'Logging all' : 'Off'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Log Blocked Traffic" hint="Log every flow that hits a block action. Useful for verifying that policies are catching the intended traffic and for incident response. Unlike Log All Traffic, this only captures denied flows. Example: keep enabled in production for security audit trails." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.logBlockedTraffic} onCheckedChange={(v) => (settings.logBlockedTraffic = v)} />
                <span class="text-xs text-slate-400">{settings.logBlockedTraffic ? 'Logging blocked' : 'Off'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm">
              <FieldLabel label="Update Signatures" hint="Controls automatic refresh of application fingerprints and protocol signatures used by the DPI engine. Keep enabled in production so detection accuracy stays current as applications evolve and evade older signatures. Example: enable with scheduled maintenance windows if strict change control is required." />
              <div class="flex h-9 items-center gap-3">
                <Switch checked={settings.updateSignatures} onCheckedChange={(v) => (settings.updateSignatures = v)} class="cursor-pointer" />
                <span class="text-xs text-slate-400">{settings.updateSignatures ? 'Auto-update on' : 'Manual updates only'}</span>
              </div>
            </label>

            <label class="space-y-1 text-sm md:col-span-2">
              <FieldLabel label="Detect Protocols" hint="Restrict classification to specific protocols. When empty, all supported protocols are detected. Limiting this list reduces CPU usage on high-throughput links but may miss unexpected application traffic. Example: http, https, dns, quic, ssh." />
              <Input class="border-slate-700 bg-slate-950" value={settings.detectProtocols} oninput={(e) => (settings.detectProtocols = (e.currentTarget as HTMLInputElement).value)} placeholder="http, https, dns, quic (empty = all)" />
            </label>
          </div>

          <!-- Advanced section -->
          <button type="button" class="flex cursor-pointer items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300" onclick={() => (showAdvanced = !showAdvanced)}>
            {#if showAdvanced}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon class="size-4" />{/if}
            Advanced Settings
          </button>
          {#if showAdvanced}
            <div class="grid gap-4 rounded-md border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-2">
              <label class="space-y-1 text-sm">
                <FieldLabel label="Max Concurrent Flows" hint="Maximum number of flows tracked simultaneously by the DPI engine. Higher values support busier networks but consume more RAM. Each flow entry uses approximately 200-300 bytes. Default 100,000 is suitable for SMB; large enterprises may need 500k+. Example: 100000." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.maxFlows)} oninput={(e) => (settings.maxFlows = Number((e.currentTarget as HTMLInputElement).value || 100000))} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Flow Timeout (seconds)" hint="Idle timeout in seconds before a tracked flow is evicted from the classification table. Lower values free resources faster but may cause re-classification of long-lived idle connections. Example: 120 for general traffic, 300 for video streaming." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.flowTimeout)} oninput={(e) => (settings.flowTimeout = Number((e.currentTarget as HTMLInputElement).value || 120))} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="Cache Size" hint="Number of protocol signature cache entries. Larger caches improve performance on repeated flows by avoiding redundant classification lookups. Example: 4096 for small networks, 16384 for large deployments." />
                <Input class="border-slate-700 bg-slate-950" type="number" value={String(settings.cacheSize)} oninput={(e) => (settings.cacheSize = Number((e.currentTarget as HTMLInputElement).value || 4096))} />
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="GeoIP Enrichment" hint="Enrich flow classification with geographic IP data. Requires GeoIP database (MaxMind GeoLite2 or similar). Adds country/ASN metadata to logs and enables geo-based policy rules. Example: enable to block traffic from specific countries." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.geoipEnabled} onCheckedChange={(v) => (settings.geoipEnabled = v)} />
                  <span class="text-xs text-slate-400">{settings.geoipEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="SSL/TLS Inspection" hint="Enable deep inspection of TLS-encrypted traffic using the TLS Inspection proxy certificate. Without this, DPI can only classify by SNI and certificate metadata. Enable for full application visibility inside HTTPS. Requires trusted CA cert deployed to clients." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.sslInspection} onCheckedChange={(v) => (settings.sslInspection = v)} />
                  <span class="text-xs text-slate-400">{settings.sslInspection ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm">
                <FieldLabel label="QUIC Detection" hint="Enable classification of QUIC (HTTP/3) protocol traffic. QUIC runs over UDP port 443 and is used by major browsers. Without this, QUIC traffic appears as generic UDP. Disable only if you block QUIC entirely at the firewall level." />
                <div class="flex h-9 items-center gap-3">
                  <Switch checked={settings.quicDetection} onCheckedChange={(v) => (settings.quicDetection = v)} />
                  <span class="text-xs text-slate-400">{settings.quicDetection ? 'Enabled' : 'Disabled'}</span>
                </div>
              </label>

              <label class="space-y-1 text-sm md:col-span-2">
                <FieldLabel label="Custom Signatures" hint="Define custom nDPI detection rules for applications not covered by built-in signatures. Each line is one rule in nDPI custom protocol format. Validate syntax carefully — malformed rules cause DPI reload failures. Example: host:*.internal.corp @InternalApps" />
                <Textarea class="border-slate-700 bg-slate-950" rows={4} value={settings.customSignatures} oninput={(e) => (settings.customSignatures = (e.currentTarget as HTMLTextAreaElement).value)} placeholder="host:*.example.com @CustomApp" />
              </label>
            </div>
          {/if}

          <Button type="submit" class="bg-cyan-500 text-white hover:bg-cyan-600" disabled={saving}>
            <SaveIcon class="mr-2 size-4" />{saving ? 'Saving…' : 'Save DPI Settings'}
          </Button>
        </form>
      {/if}
    </CardContent>
  </Card>

  <!-- Category Policies -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dpi.category_policies')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('dpi.enforce_percategory_actions_bandwidth_caps_and_log')}</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={addCategory}><PlusIcon class="mr-1 size-4" /> Add Category</Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if catLoading}
        <Skeleton class="h-24 bg-slate-800" />
      {:else if categories.length === 0}
        <p class="py-6 text-center text-sm text-slate-500">{$_('dpi.no_category_policies_defined_click_add_category_to')}</p>
      {:else}
        <div class="space-y-3">
          {#each categories as cat, idx}
            <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-200">{cat.name || '(unnamed)'}</span>
                  <Badge class="border-slate-700 bg-slate-800 text-xs text-slate-300">Apps: {cat.applicationsCount}</Badge>
                </div>
                <div class="flex gap-1">
                  <button class="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200" onclick={() => (editingCat = editingCat === cat ? null : cat)}><PencilIcon class="size-4" /></button>
                  <button class="cursor-pointer rounded p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300" onclick={() => removeCategory(idx)}><TrashIcon class="size-4" /></button>
                </div>
              </div>
              {#if editingCat === cat}
                <div class="mt-3 grid gap-3 md:grid-cols-2">
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Category Name" hint="Name of the DPI category this policy applies to. Must match a classification output from the engine. Example: social_media, streaming, gaming." />
                    <Input class="border-slate-700 bg-slate-950" value={cat.name} oninput={(e) => (cat.name = (e.currentTarget as HTMLInputElement).value)} placeholder="streaming" />
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Action" hint="Policy action for traffic in this category. Allow passes traffic, Block drops silently, Throttle applies bandwidth cap, Log records without enforcement." />
                    <Select.Root type="single" value={cat.action} onValueChange={(v) => { if (v) cat.action = v; }}>
                      <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find(o => o.value === cat.action)?.label ?? cat.action}</span></Select.Trigger>
                      <Select.Content class="border-slate-700 bg-slate-900">
                        {#each actionOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}
                      </Select.Content>
                    </Select.Root>
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Bandwidth Limit (kbps)" hint="Per-flow bandwidth cap in kilobits per second. Only effective when action is Throttle. Set to 0 to disable. Example: 5000 for 5 Mbps limit on streaming." />
                    <Input class="border-slate-700 bg-slate-950" type="number" value={String(cat.bwLimitKbps)} oninput={(e) => (cat.bwLimitKbps = Number((e.currentTarget as HTMLInputElement).value || 0))} />
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Log" hint="Enable logging for flows matching this category. Useful during initial deployment to validate correct classification before enforcing block rules." />
                    <div class="flex h-9 items-center gap-3">
                      <Switch checked={cat.log} onCheckedChange={(v) => (cat.log = v)} />
                      <span class="text-xs text-slate-400">{cat.log ? 'Yes' : 'No'}</span>
                    </div>
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Enabled" hint="Turns this category policy on or off without removing it. Disabling is useful during staged rollouts when you need to compare behavior before full enforcement. Example: disable temporarily while validating newly updated signatures for that category." />
                    <div class="flex h-9 items-center gap-3">
                      <Switch checked={cat.enabled} onCheckedChange={(v) => (cat.enabled = v)} class="cursor-pointer" />
                      <span class="text-xs text-slate-400">{cat.enabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </label>
                  <label class="space-y-1 text-sm md:col-span-2">
                    <FieldLabel label="Description" hint="Document the business reason for this policy so other admins understand intent during audits or troubleshooting." />
                    <Input class="border-slate-700 bg-slate-950" value={cat.description} oninput={(e) => (cat.description = (e.currentTarget as HTMLInputElement).value)} placeholder={$_('dpi.placeholderblock_social_media_during_work_hours')} />
                  </label>
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="mt-4">
          <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveCategories} disabled={catSaving}>
            <SaveIcon class="mr-2 size-4" />{catSaving ? 'Saving…' : 'Save Category Policies'}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>

  <!-- Application Rules -->
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('dpi.application_rules')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('dpi.perapplication_decisions_with_optional_schedules_a')}</CardDescription>
        </div>
        <Button variant="outline" class="border-slate-700 text-slate-100" onclick={addAppRule}><PlusIcon class="mr-1 size-4" /> Add App Rule</Button>
      </div>
    </CardHeader>
    <CardContent>
      {#if appLoading}
        <Skeleton class="h-24 bg-slate-800" />
      {:else if appRules.length === 0}
        <p class="py-6 text-center text-sm text-slate-500">{$_('dpi.no_application_rules_defined_click_add_app_rule_to')}</p>
      {:else}
        <div class="space-y-3">
          {#each appRules as rule, idx}
            <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-200">{rule.name || '(unnamed)'}</span>
                  <Badge class="border-slate-700 bg-slate-800 text-xs text-slate-300">{rule.action}</Badge>
                  <Badge class={rule.enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs' : 'border-slate-700 bg-slate-800 text-xs text-slate-400'}>{rule.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <div class="flex gap-1">
                  <button class="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200" onclick={() => (editingApp = editingApp === rule ? null : rule)}><PencilIcon class="size-4" /></button>
                  <button class="cursor-pointer rounded p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300" onclick={() => removeAppRule(idx)}><TrashIcon class="size-4" /></button>
                </div>
              </div>
              {#if editingApp === rule}
                <div class="mt-3 grid gap-3 md:grid-cols-2">
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Rule Name" hint="Descriptive name for this application rule. Choose something that other admins will immediately understand. Example: Block-TikTok, Throttle-Netflix." />
                    <Input class="border-slate-700 bg-slate-950" value={rule.name} oninput={(e) => (rule.name = (e.currentTarget as HTMLInputElement).value)} />
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Category / App" hint="DPI application or category name this rule targets. Must match classification engine output exactly. Example: Netflix, YouTube, BitTorrent, Zoom." />
                    <Input class="border-slate-700 bg-slate-950" value={rule.category} oninput={(e) => (rule.category = (e.currentTarget as HTMLInputElement).value)} placeholder={$_('dpi.placeholdernetflix')} />
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Action" hint="What happens when traffic matches. Allow passes it, Block drops silently, Throttle applies a bandwidth cap, Log records for monitoring only." />
                    <Select.Root type="single" value={rule.action} onValueChange={(v) => { if (v) rule.action = v; }}>
                      <Select.Trigger class="mt-1 w-full cursor-pointer border-slate-700 bg-slate-950 text-slate-100"><span>{actionOptions.find(o => o.value === rule.action)?.label ?? rule.action}</span></Select.Trigger>
                      <Select.Content class="border-slate-700 bg-slate-900">
                        {#each actionOptions as opt}<Select.Item value={opt.value} label={opt.label} class="cursor-pointer text-slate-200 hover:bg-slate-800" />{/each}
                      </Select.Content>
                    </Select.Root>
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Bandwidth Limit (kbps)" hint="Per-flow bandwidth cap. Effective only when action is Throttle. Example: 10000 for 10 Mbps limit." />
                    <Input class="border-slate-700 bg-slate-950" type="number" value={String(rule.bwLimitKbps)} oninput={(e) => (rule.bwLimitKbps = Number((e.currentTarget as HTMLInputElement).value || 0))} />
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Schedule" hint="Optional time schedule restricting when this rule is active. Leave empty for always-on. Example: work-hours (Mon-Fri 08:00-18:00), weekends, after-hours." />
                    <select
              bind:value={rule.schedule}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="always">always</option>
              <option value="business-hours">business-hours</option>
              <option value="after-hours">after-hours</option>
              <option value="weekends">weekends</option>
              <option value="custom">custom</option>
            </select> (rule.schedule = (e.currentTarget as HTMLInputElement).value)} placeholder="always" />
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Log" hint="Log matched flows for this rule. Recommended during rollout to verify correct targeting." />
                    <div class="flex h-9 items-center gap-3">
                      <Switch checked={rule.log} onCheckedChange={(v) => (rule.log = v)} />
                      <span class="text-xs text-slate-400">{rule.log ? 'Yes' : 'No'}</span>
                    </div>
                  </label>
                  <label class="space-y-1 text-sm">
                    <FieldLabel label="Enabled" hint="Activates this application rule without deleting the definition. Keep disabled while preparing schedule windows or testing category-level policy interactions. Example: disable until after business-hour change freeze ends." />
                    <div class="flex h-9 items-center gap-3">
                      <Switch checked={rule.enabled} onCheckedChange={(v) => (rule.enabled = v)} class="cursor-pointer" />
                      <span class="text-xs text-slate-400">{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </label>
                  <label class="space-y-1 text-sm md:col-span-2">
                    <FieldLabel label="Description" hint="Explain the business purpose of this rule for audit and change control." />
                    <Input class="border-slate-700 bg-slate-950" value={rule.description} oninput={(e) => (rule.description = (e.currentTarget as HTMLInputElement).value)} />
                  </label>
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <div class="mt-4">
          <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={saveAppRules} disabled={appSaving}>
            <SaveIcon class="mr-2 size-4" />{appSaving ? 'Saving…' : 'Save Application Rules'}
          </Button>
        </div>
      {/if}
    </CardContent>
  </Card>

  <!-- Stats + Capabilities -->
  <div class="grid gap-6 lg:grid-cols-2">
    <Card class="border-slate-800 bg-slate-900">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <CardTitle class="text-slate-100">{$_('dpi.classification_summary')}</CardTitle>
          <Button variant="outline" size="sm" class="border-slate-700 text-slate-300" onclick={() => void loadStats()} disabled={statsLoading}>
            <RefreshCcwIcon class="mr-1 size-3" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {#if statsLoading}
          <Skeleton class="h-24 bg-slate-800" />
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-md border border-slate-800 bg-slate-950 p-3 text-center">
              <p class="text-2xl font-bold text-slate-100">{stats.sessions ?? stats.totalSessions ?? 0}</p>
              <p class="text-xs text-slate-400">{$_('dpi.total_sessions')}</p>
            </div>
            <div class="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
              <p class="text-2xl font-bold text-emerald-300">{stats.classified ?? stats.classifiedSessions ?? 0}</p>
              <p class="text-xs text-slate-400">{$_('dpi.classified')}</p>
            </div>
            <div class="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-center">
              <p class="text-2xl font-bold text-red-300">{stats.blocked ?? stats.blockedSessions ?? 0}</p>
              <p class="text-xs text-slate-400">{$_('dpi.blocked')}</p>
            </div>
            <div class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-center">
              <p class="text-2xl font-bold text-amber-300">{stats.unknown ?? stats.unknownSessions ?? 0}</p>
              <p class="text-xs text-slate-400">{$_('dpi.unknown')}</p>
            </div>
          </div>
        {/if}
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle class="text-slate-100">{$_('dpi.capability_matrix')}</CardTitle>
        <CardDescription class="text-slate-400">{$_('dpi.dpi_capabilities_reported_by_the_selected_engine_a')}</CardDescription>
      </CardHeader>
      <CardContent>
        {#if statsLoading}
          <Skeleton class="h-24 bg-slate-800" />
        {:else if capabilities.length === 0}
          <p class="py-6 text-center text-sm text-slate-500">{$_('dpi.no_capabilities_reported_by_engine')}</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each capabilities as cap}
              <Badge class="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{cap}</Badge>
            {/each}
          </div>
        {/if}
      </CardContent>
    </Card>
  </div>
</div>
