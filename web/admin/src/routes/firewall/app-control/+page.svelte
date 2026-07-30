<!-- Route view for `/firewall/app-control` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Badge } from '$lib/components/ui/badge';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';

  import { _ } from '$lib/i18n';
  type DpiEngine = 'suricata' | 'ndpi' | 'ebpf';
  type AppAction = 'allow' | 'block' | 'throttle' | 'log';

  type AppCategory = {
    id: string;
    name: string;
    description: string;
    risk_level: number;
    default_action: AppAction;
    app_count: number;
  };

  type AppSignature = {
    id: string;
    name: string;
    category: string;
    protocols: string[];
    ports: number[];
    patterns: string[];
    risk_level: number;
    enabled: boolean;
  };

  type AppPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    action: AppAction;
    target_apps: string[];
    schedule?: string;
    bandwidth_limit?: number;
    log: boolean;
    description: string;
  };

  type AppControlConfig = {
    enabled: boolean;
    default_action: AppAction;
    dpi_engine: DpiEngine;
    categories: AppCategory[];
    signatures: AppSignature[];
    policies: AppPolicy[];
    application_database_version: string;
    auto_update: boolean;
    suricata: Record<string, unknown>;
    ndpi: Record<string, unknown>;
    ebpf: Record<string, unknown>;
  };

  type AppStat = { id: string; name: string; hits: number };
  type AppStats = {
    dpi_engine: DpiEngine;
    signature_count: number;
    policy_count: number;
    top_blocked: AppStat[];
    top_allowed: AppStat[];
  };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<AppControlConfig | null>(null);
  let signatures = $state<AppSignature[]>([]);
  let policies = $state<AppPolicy[]>([]);
  let stats = $state<AppStats>({ dpi_engine: 'suricata', signature_count: 0, policy_count: 0, top_blocked: [], top_allowed: [] });
  let expandedCategories = $state<Record<string, boolean>>({});
  let appActions = $state<Record<string, AppAction>>({});

  const actionOptions: { value: AppAction; label: string }[] = [
    { value: 'allow', label: 'Allow' },
    { value: 'block', label: 'Block' },
    { value: 'throttle', label: 'Throttle' },
    { value: 'log', label: 'Log' }
  ];

  const engineOptions: { value: DpiEngine; label: string; detail: string }[] = [
    { value: 'suricata', label: 'Suricata', detail: 'App-layer protocol parser + IDS metadata' },
    { value: 'ndpi', label: 'nDPI', detail: 'High-performance L7 fingerprinting and heuristics' },
    { value: 'ebpf', label: 'eBPF', detail: 'Kernel-space low-latency classifier' }
  ];

  const appsByCategory = $derived.by(() => {
    const map: Record<string, AppSignature[]> = {};
    for (const app of signatures) {
      map[app.category] = map[app.category] ? [...map[app.category], app] : [app];
    }
    for (const key of Object.keys(map)) {
      map[key].sort((left, right) => left.name.localeCompare(right.name));
    }
    return map;
  });

  async function loadAll() {
    loading = true;
    try {
      const [cfg, sigs, pols, nextStats] = await Promise.all([
        api.get<AppControlConfig>('/firewall/app-control'),
        api.get<AppSignature[]>('/firewall/app-control/signatures'),
        api.get<AppPolicy[]>('/firewall/app-control/policies'),
        api.get<AppStats>('/firewall/app-control/stats')
      ]);
      config = cfg;
      signatures = sigs;
      policies = pols;
      stats = nextStats;

      const expanded: Record<string, boolean> = {};
      for (const category of cfg.categories) {
        expanded[category.id] = expandedCategories[category.id] ?? false;
      }
      expandedCategories = expanded;
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to load app-control data');
    } finally {
      loading = false;
    }
  }

  async function saveBaseConfig() {
    if (!config) return;
    saving = true;
    try {
      await api.patch('/firewall/app-control', {
        enabled: config.enabled,
        default_action: config.default_action,
        auto_update: config.auto_update,
        suricata: config.suricata,
        ndpi: config.ndpi,
        ebpf: config.ebpf
      });
      toasts.success($_('firewall_app.toast_application_control_settings_updated'));
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      saving = false;
    }
  }

  async function setDpiEngine(engine: DpiEngine) {
    try {
      await api.put('/firewall/app-control/dpi-engine', { dpi_engine: engine });
      if (config) config.dpi_engine = engine;
      toasts.success(`DPI engine switched to ${engine}`);
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to switch DPI engine');
    }
  }

  async function applyCategoryAction(categoryId: string, action: AppAction) {
    try {
      await api.post(`/firewall/app-control/categories/${categoryId}/${action}`, {});
      toasts.success(`Applied ${action} policy to ${categoryId}`);
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to apply category action');
    }
  }

  async function allowAllApplications() {
    try {
      await api.post('/firewall/app-control/policies', {
        id: `allow-all-${Date.now()}`,
        name: 'Allow all applications',
        enabled: true,
        action: 'allow',
        target_apps: signatures.map((app) => app.id),
        schedule: undefined,
        bandwidth_limit: undefined,
        log: true,
        description: 'Emergency baseline allow policy'
      } satisfies AppPolicy);
      toasts.success($_('firewall_app.toast_allow_all_policy_created'));
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to create allow-all policy');
    }
  }

  async function saveAppCustomAction(app: AppSignature) {
    const action = appActions[app.id] ?? 'allow';
    const payload: AppPolicy = {
      id: `custom-${app.id}`,
      name: `Custom ${app.name}`,
      enabled: true,
      action,
      target_apps: [app.id],
      schedule: undefined,
      bandwidth_limit: action === 'throttle' ? 3000 : undefined,
      log: true,
      description: `Per-application custom ${action} policy`
    };

    try {
      const existing = policies.find((policy) => policy.id === payload.id);
      if (existing) await api.put(`/firewall/app-control/policies/${payload.id}`, payload);
      else await api.post('/firewall/app-control/policies', payload);
      toasts.success(`${app.name}: ${action} policy applied`);
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to apply custom policy');
    }
  }

  function movePolicy(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= policies.length) return;
    const next = [...policies];
    const current = next[index];
    next[index] = next[target];
    next[target] = current;
    policies = next;
  }

  async function savePolicyOrder() {
    try {
      await api.patch('/firewall/app-control', { policies });
      toasts.success($_('firewall_app.toast_policy_priority_updated'));
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to update policy priority');
    }
  }

  async function deletePolicy(id: string) {
    try {
      await api.del(`/firewall/app-control/policies/${id}`);
      toasts.success($_('firewall_app.toast_policy_removed'));
      await loadAll();
    } catch (error) {
      toasts.error(error instanceof Error ? error.message : 'Failed to remove policy');
    }
  }

  onMount(() => {
    void loadAll();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-700/80 bg-slate-950">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('firewall_app.enterprise_application_control')}</CardTitle>
      <CardDescription class="text-cyan-200/80">Suricata app-layer, nDPI classification, and eBPF-assisted L7 controls in one policy plane.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      {#if loading || !config}
        <p class="text-sm text-slate-300">{$_('firewall_app.loading_application_control_catalog')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-4">
          <label class="space-y-1">
            <span class="text-xs font-medium tracking-wide text-cyan-200">Enable Enforcement</span>
            <div class="flex h-10 items-center rounded-md border border-slate-700 bg-slate-900 px-3">
              <Switch checked={config?.enabled ?? false} onCheckedChange={(value) => { if (config) config.enabled = value; }} />
            </div>
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium tracking-wide text-cyan-200">Default Action</span>
            <select class="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-slate-100" value={config?.default_action ?? 'allow'} onchange={(event) => { if (config) config.default_action = (event.currentTarget as HTMLSelectElement).value as AppAction; }}>
              {#each actionOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium tracking-wide text-cyan-200">Signature DB Version</span>
            <Input class="border-slate-700 bg-slate-900 text-slate-100" readonly value={config.application_database_version} />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium tracking-wide text-cyan-200">Auto Update Signatures</span>
            <div class="flex h-10 items-center rounded-md border border-slate-700 bg-slate-900 px-3">
              <Switch checked={config?.auto_update ?? false} onCheckedChange={(value) => { if (config) config.auto_update = value; }} />
            </div>
          </label>
        </div>

        <div class="rounded-lg border border-cyan-800/60 bg-gradient-to-r from-slate-900 to-cyan-950/40 p-4">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <p class="text-xs font-medium tracking-wide text-cyan-200">DPI Backend Engine</p>
              <p class="text-sm text-slate-300">{$_('firewall_app.choose_the_packet_intelligence_backend_used_for_cl')}</p>
            </div>
            <Badge class="border-cyan-600/70 bg-cyan-900/40 text-cyan-100">{config.enabled ? 'Active' : 'Disabled'}</Badge>
          </div>
          <div class="grid gap-2 md:grid-cols-3">
            {#each engineOptions as engine}
              <button type="button" class={`rounded-lg border p-3 text-left transition ${config.dpi_engine === engine.value ? 'border-cyan-500 bg-cyan-950/50' : 'border-slate-700 bg-slate-900 hover:border-cyan-700'}`} onclick={() => void setDpiEngine(engine.value)}>
                <p class="text-sm font-semibold text-slate-100">{engine.label}</p>
                <p class="text-xs text-slate-400">{engine.detail}</p>
              </button>
            {/each}
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button class="bg-cyan-600 text-white hover:bg-cyan-500" disabled={saving} onclick={() => void saveBaseConfig()}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          <Button type="button" variant="outline" class="border-slate-600 text-slate-200" onclick={() => void allowAllApplications()}>Allow All Applications</Button>
          <Badge class="border-slate-600 bg-slate-900 text-slate-200">{signatures.length} signatures</Badge>
          <Badge class="border-slate-600 bg-slate-900 text-slate-200">{policies.length} policies</Badge>
        </div>
      {/if}
    </CardContent>
  </Card>

  {#if !loading && config}
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2 space-y-6">
        <Card class="border-slate-700/80 bg-slate-950">
          <CardHeader>
            <CardTitle class="text-slate-100">{$_('firewall_app.category_browser')}</CardTitle>
            <CardDescription class="text-slate-300">Expand categories, run quick actions, and set custom actions per application.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            {#each config.categories as category}
              <div class="overflow-hidden rounded-lg border border-slate-700">
                <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-3 py-2">
                  <button type="button" class="text-left" onclick={() => (expandedCategories[category.id] = !expandedCategories[category.id])}>
                    <p class="text-sm font-semibold text-slate-100">{category.name}</p>
                    <p class="text-xs text-slate-400">Risk {category.risk_level} • {appsByCategory[category.id]?.length ?? 0} apps</p>
                  </button>
                  <div class="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" class="border-red-700 text-red-200" onclick={() => void applyCategoryAction(category.id, 'block')}>Block Category</Button>
                    <Button type="button" size="sm" variant="outline" class="border-emerald-700 text-emerald-200" onclick={() => void applyCategoryAction(category.id, 'allow')}>Allow Category</Button>
                  </div>
                </div>
                {#if expandedCategories[category.id]}
                  <div class="divide-y divide-slate-800 bg-slate-950">
                    {#each appsByCategory[category.id] ?? [] as app}
                      <div class="grid gap-2 px-3 py-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                        <div>
                          <p class="text-sm text-slate-100">{app.name}</p>
                          <p class="text-xs text-slate-400">{app.protocols.join(', ')} • ports {app.ports.join(', ')}</p>
                        </div>
                        <select class="h-9 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100" value={appActions[app.id] ?? 'allow'} onchange={(event) => (appActions[app.id] = (event.currentTarget as HTMLSelectElement).value as AppAction)}>
                          {#each actionOptions as option}
                            <option value={option.value}>{option.label}</option>
                          {/each}
                        </select>
                        <Button type="button" size="sm" class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void saveAppCustomAction(app)}>Apply</Button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </CardContent>
        </Card>

        <Card class="border-slate-700/80 bg-slate-950">
          <CardHeader>
            <CardTitle class="text-slate-100">{$_('firewall_app.policy_rules')}</CardTitle>
            <CardDescription class="text-slate-300">Priority-ordered app control policies. Top entries evaluate first.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="overflow-x-auto rounded-lg border border-slate-700">
              <table class="w-full min-w-[760px] text-sm">
                <thead class="bg-slate-900 text-slate-300">
                  <tr>
                    <th class="px-3 py-2 text-left">Priority</th>
                    <th class="px-3 py-2 text-left">Policy</th>
                    <th class="px-3 py-2 text-left">Action</th>
                    <th class="px-3 py-2 text-left">Target Apps</th>
                    <th class="px-3 py-2 text-left">Limit</th>
                    <th class="px-3 py-2 text-left">Ops</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800 bg-slate-950 text-slate-200">
                  {#each policies as policy, index}
                    <tr>
                      <td class="px-3 py-2">{index + 1}</td>
                      <td class="px-3 py-2">
                        <p class="font-medium">{policy.name}</p>
                        <p class="text-xs text-slate-400">{policy.id}</p>
                      </td>
                      <td class="px-3 py-2 uppercase">{policy.action}</td>
                      <td class="px-3 py-2">{policy.target_apps.length}</td>
                      <td class="px-3 py-2">{policy.bandwidth_limit ? `${policy.bandwidth_limit} kbps` : '-'}</td>
                      <td class="px-3 py-2">
                        <div class="flex gap-1">
                          <Button type="button" size="sm" variant="outline" class="border-slate-600 px-2" onclick={() => movePolicy(index, -1)}>Up</Button>
                          <Button type="button" size="sm" variant="outline" class="border-slate-600 px-2" onclick={() => movePolicy(index, 1)}>Down</Button>
                          <Button type="button" size="sm" variant="outline" class="border-red-700 px-2 text-red-200" onclick={() => void deletePolicy(policy.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <Button type="button" class="bg-cyan-600 text-white hover:bg-cyan-500" onclick={() => void savePolicyOrder()}>Save Priority Order</Button>
          </CardContent>
        </Card>
      </div>

      <div class="space-y-6">
        <Card class="border-slate-700/80 bg-slate-950">
          <CardHeader>
            <CardTitle class="text-slate-100">{$_('firewall_app.dpi_status')}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-sm text-slate-300">
            <div class="flex items-center justify-between"><span>Engine</span><Badge class="border-cyan-700 bg-cyan-950/40 text-cyan-100 uppercase">{config.dpi_engine}</Badge></div>
            <div class="flex items-center justify-between"><span>Runtime state</span><span class={config.enabled ? 'text-emerald-300' : 'text-amber-300'}>{config.enabled ? 'Online' : 'Disabled'}</span></div>
            <div class="flex items-center justify-between"><span>Signatures</span><span>{stats.signature_count}</span></div>
            <div class="flex items-center justify-between"><span>Policies</span><span>{stats.policy_count}</span></div>
          </CardContent>
        </Card>

        <Card class="border-slate-700/80 bg-slate-950">
          <CardHeader>
            <CardTitle class="text-slate-100">{$_('firewall_app.top_blocked_apps')}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-sm">
            {#if stats.top_blocked.length === 0}
              <p class="text-slate-400">{$_('firewall_app.no_blocked_app_telemetry_yet')}</p>
            {:else}
              {#each stats.top_blocked as item}
                <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-2 py-1">
                  <span class="text-slate-200">{item.name}</span>
                  <Badge class="border-red-700 bg-red-950/30 text-red-200">{item.hits}</Badge>
                </div>
              {/each}
            {/if}
          </CardContent>
        </Card>

        <Card class="border-slate-700/80 bg-slate-950">
          <CardHeader>
            <CardTitle class="text-slate-100">{$_('firewall_app.top_allowed_apps')}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-sm">
            {#if stats.top_allowed.length === 0}
              <p class="text-slate-400">{$_('firewall_app.no_allowed_app_telemetry_yet')}</p>
            {:else}
              {#each stats.top_allowed as item}
                <div class="flex items-center justify-between rounded border border-slate-700 bg-slate-900 px-2 py-1">
                  <span class="text-slate-200">{item.name}</span>
                  <Badge class="border-emerald-700 bg-emerald-950/30 text-emerald-200">{item.hits}</Badge>
                </div>
              {/each}
            {/if}
          </CardContent>
        </Card>
      </div>
    </div>
  {/if}
</div>
