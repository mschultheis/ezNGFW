<!-- Route view for `/nat/stats` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { toasts } from '$lib/stores/toast';
  import { Switch } from '$lib/components/ui/switch';
  import * as Select from '$lib/components/ui/select';
  import * as Collapsible from '$lib/components/ui/collapsible';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';

  import { _ } from '$lib/i18n';
  type NatSummary = {
    totalTranslations: number;
    activeSessions: number;
    bytesTranslated: number;
    tcpSessions: number;
    udpSessions: number;
    icmpSessions: number;
    droppedSessions: number;
  };

  type RuleStat = {
    id: string;
    rule: string;
    type: string;
    interface: string;
    hits: number;
    packets: number;
    bytes: number;
    lastMatch: string;
  };

  type Talker = {
    sourceIp: string;
    sessions: number;
    bytes: number;
    packets: number;
  };

  type ProtocolSlice = {
    protocol: string;
    sessions: number;
    percent: number;
  };

  type Profile = {
    id: string;
    name: string;
    timeRange: string;
    protocol: string;
    autoRefresh: boolean;
    minimumHits: number;
  };

  const timeRangeOptions = [
    { value: '5m', label: 'Last 5 minutes' },
    { value: '15m', label: 'Last 15 minutes' },
    { value: '1h', label: 'Last 1 hour' },
    { value: '6h', label: 'Last 6 hours' },
    { value: '24h', label: 'Last 24 hours' }
  ];

  const protocolOptions = [
    { value: 'all', label: 'All protocols' },
    { value: 'tcp', label: 'TCP' },
    { value: 'udp', label: 'UDP' },
    { value: 'icmp', label: 'ICMP' }
  ];

  let summary = $state<NatSummary>({
    totalTranslations: 0,
    activeSessions: 0,
    bytesTranslated: 0,
    tcpSessions: 0,
    udpSessions: 0,
    icmpSessions: 0,
    droppedSessions: 0
  });

  let rules = $state<RuleStat[]>([]);
  let talkers = $state<Talker[]>([]);
  let distributions = $state<ProtocolSlice[]>([]);

  let profiles = $state<Profile[]>([]);
  let profileDraft = $state<Profile>({
    id: '',
    name: '',
    timeRange: '15m',
    protocol: 'all',
    autoRefresh: false,
    minimumHits: 0
  });
  let editingProfileId = $state<string | null>(null);

  let loading = $state(true);
  let loadingProfiles = $state(true);
  let error = $state('');

  let timeRange = $state('15m');
  let protocolFilter = $state('all');
  let minimumHits = $state(0);

  let autoRefresh = $state(false);
  let refreshSeconds = $state(20);
  let showAdvanced = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  let savingProfile = $state(false);
  let deletingProfile = $state(false);

  function numberWithCommas(value: number) {
    return new Intl.NumberFormat().format(value);
  }

  function bytesHuman(value: number) {
    const abs = Math.abs(value);
    if (abs >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (abs >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`;
    if (abs >= 1024) return `${(value / 1024).toFixed(2)} KB`;
    return `${value} B`;
  }

  function normalizeRule(raw: Record<string, unknown>, idx: number): RuleStat {
    return {
      id: String(raw.id ?? raw.uuid ?? idx + 1),
      rule: String(raw.rule ?? raw.name ?? `Rule ${idx + 1}`),
      type: String(raw.type ?? raw.mode ?? 'outbound'),
      interface: String(raw.interface ?? raw.iface ?? 'any'),
      hits: Number(raw.hits ?? raw.evaluations ?? 0),
      packets: Number(raw.packets ?? 0),
      bytes: Number(raw.bytes ?? 0),
      lastMatch: String(raw.lastMatch ?? raw.last_hit ?? '-')
    };
  }

  function normalizeProfile(raw: Record<string, unknown>): Profile {
    return {
      id: String(raw.id ?? raw.uuid ?? crypto.randomUUID()),
      name: String(raw.name ?? 'Unnamed profile'),
      timeRange: String(raw.timeRange ?? '15m'),
      protocol: String(raw.protocol ?? 'all'),
      autoRefresh: Boolean(raw.autoRefresh),
      minimumHits: Number(raw.minimumHits ?? 0)
    };
  }

  function normalizeSource(source: string) {
    const ipv6 = source.match(/^\[([^\]]+)\]/);
    if (ipv6) return ipv6[1];
    const idx = source.indexOf(':');
    if (idx > -1 && source.indexOf(':') === idx) return source.slice(0, idx);
    return source;
  }

  function applyRuleFilters(rows: RuleStat[]) {
    return rows.filter((row) => {
      if (protocolFilter !== 'all' && row.type.toLowerCase() !== protocolFilter) return false;
      if (row.hits < minimumHits) return false;
      return true;
    });
  }

  function recalculateDistribution() {
    const total = summary.activeSessions || 1;
    const tcp = summary.tcpSessions;
    const udp = summary.udpSessions;
    const icmp = summary.icmpSessions;
    distributions = [
      { protocol: 'TCP', sessions: tcp, percent: (tcp / total) * 100 },
      { protocol: 'UDP', sessions: udp, percent: (udp / total) * 100 },
      { protocol: 'ICMP', sessions: icmp, percent: (icmp / total) * 100 }
    ];
  }

  async function loadStats() {
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams();
      params.set('range', timeRange);
      if (protocolFilter !== 'all') params.set('protocol', protocolFilter);

      const [summaryPayload, rulesPayload, translationsPayload] = await Promise.all([
        api.get<Record<string, unknown>>(`/nat/stats?${params.toString()}`),
        api.get<unknown[]>('/nat'),
        api.get<unknown[]>('/nat/translations')
      ]);

      summary = {
        totalTranslations: Number(summaryPayload.totalTranslations ?? summaryPayload.total_translations ?? 0),
        activeSessions: Number(summaryPayload.activeSessions ?? summaryPayload.active_sessions ?? 0),
        bytesTranslated: Number(summaryPayload.bytesTranslated ?? summaryPayload.bytes_translated ?? 0),
        tcpSessions: Number(summaryPayload.tcpSessions ?? summaryPayload.protocol_tcp ?? 0),
        udpSessions: Number(summaryPayload.udpSessions ?? summaryPayload.protocol_udp ?? 0),
        icmpSessions: Number(summaryPayload.icmpSessions ?? summaryPayload.protocol_icmp ?? 0),
        droppedSessions: Number(summaryPayload.droppedSessions ?? summaryPayload.dropped ?? 0)
      };

      const normalizedRules = Array.isArray(rulesPayload)
        ? rulesPayload.map((item, idx) => normalizeRule((item ?? {}) as Record<string, unknown>, idx))
        : [];
      rules = applyRuleFilters(normalizedRules);

      const bySource = new Map<string, Talker>();
      if (Array.isArray(translationsPayload)) {
        for (const item of translationsPayload) {
          const row = (item ?? {}) as Record<string, unknown>;
          const rawSource = String(row.source ?? row.original_src ?? row.src ?? '-');
          const sourceIp = normalizeSource(rawSource);
          const entry = bySource.get(sourceIp) ?? { sourceIp, sessions: 0, bytes: 0, packets: 0 };
          entry.sessions += 1;
          entry.bytes += Number(row.bytes ?? row.bytesTranslated ?? 0);
          entry.packets += Number(row.packets ?? 0);
          bySource.set(sourceIp, entry);
        }
      }
      talkers = Array.from(bySource.values()).sort((a, b) => b.bytes - a.bytes).slice(0, 12);

      if (summary.activeSessions === 0 && talkers.length > 0) {
        summary.activeSessions = talkers.reduce((sum, item) => sum + item.sessions, 0);
      }
      recalculateDistribution();
    } catch (loadError) {
      summary = {
        totalTranslations: 0,
        activeSessions: 0,
        bytesTranslated: 0,
        tcpSessions: 0,
        udpSessions: 0,
        icmpSessions: 0,
        droppedSessions: 0
      };
      rules = [];
      talkers = [];
      distributions = [];
      error = loadError instanceof Error ? loadError.message : 'Failed to load NAT statistics';
      toasts.error(error);
    } finally {
      loading = false;
    }
  }

  async function loadProfiles() {
    loadingProfiles = true;
    try {
      const payload = await api.get<unknown[]>('/nat/stats/profiles');
      profiles = Array.isArray(payload)
        ? payload.map((item) => normalizeProfile((item ?? {}) as Record<string, unknown>))
        : [];
    } catch {
      profiles = [];
      toasts.warning($_('nat_stats.toast_saved_statistic_profiles_unavailable'));
    } finally {
      loadingProfiles = false;
    }
  }

  function resetProfileDraft() {
    profileDraft = {
      id: '',
      name: '',
      timeRange: '15m',
      protocol: 'all',
      autoRefresh: false,
      minimumHits: 0
    };
    editingProfileId = null;
  }

  function editProfile(profile: Profile) {
    profileDraft = { ...profile };
    editingProfileId = profile.id;
  }

  function applyProfile(profile: Profile) {
    timeRange = profile.timeRange;
    protocolFilter = profile.protocol;
    autoRefresh = profile.autoRefresh;
    minimumHits = profile.minimumHits;
    void loadStats();
    toasts.success(`Applied profile: ${profile.name}`);
  }

  async function saveProfile() {
    if (!profileDraft.name.trim()) {
      toasts.warning($_('nat_stats.toast_profile_name_is_required'));
      return;
    }
    savingProfile = true;
    try {
      const payload = {
        name: profileDraft.name.trim(),
        timeRange: profileDraft.timeRange,
        protocol: profileDraft.protocol,
        autoRefresh: profileDraft.autoRefresh,
        minimumHits: profileDraft.minimumHits
      };
      if (editingProfileId) {
        await api.put(`/nat/stats/profiles/${editingProfileId}`, payload);
      } else {
        await api.post('/nat/stats/profiles', payload);
      }
      toasts.success(editingProfileId ? 'Profile updated' : 'Profile created');
      resetProfileDraft();
      await loadProfiles();
    } catch (profileError) {
      toasts.error(profileError instanceof Error ? profileError.message : 'Failed to save profile');
    } finally {
      savingProfile = false;
    }
  }

  async function deleteProfile(id: string) {
    deletingProfile = true;
    try {
      await api.del(`/nat/stats/profiles/${id}`);
      if (editingProfileId === id) resetProfileDraft();
      toasts.success($_('nat_stats.toast_profile_deleted'));
      await loadProfiles();
    } catch (profileError) {
      toasts.error(profileError instanceof Error ? profileError.message : 'Failed to delete profile');
    } finally {
      deletingProfile = false;
    }
  }

  onMount(() => {
    void Promise.all([loadStats(), loadProfiles()]);
  });

  $effect(() => {
    if (timer) clearInterval(timer);
    if (autoRefresh && refreshSeconds > 0) {
      timer = setInterval(() => {
        void loadStats();
      }, refreshSeconds * 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('nat_stats.nat_statistics_dashboard')}</CardTitle>
          <p class="mt-1 text-sm text-slate-400">{$_('nat_stats.observe_translation_pressure_rule_effectiveness_an')}</p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={() => void loadStats()} disabled={loading}>
            <RefreshCwIcon class="mr-2 h-4 w-4" /> {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_stats.total_translations')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{numberWithCommas(summary.totalTranslations)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_stats.active_sessions')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{numberWithCommas(summary.activeSessions)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_stats.bytes_translated')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{bytesHuman(summary.bytesTranslated)}</p>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/70 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">{$_('nat_stats.dropped_sessions')}</p>
          <p class="mt-1 text-2xl font-semibold text-slate-100">{numberWithCommas(summary.droppedSessions)}</p>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      {#if error}
        <div class="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div>
      {/if}

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Time range" hint="Time range controls aggregation window and helps reveal short spikes versus sustained load. Example: use 5 minutes during incident response and 24 hours for trend baselines." />
          <Select.Root type="single" value={timeRange} onValueChange={(value) => value && (timeRange = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{timeRangeOptions.find((option) => option.value === timeRange)?.label ?? 'Select range'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each timeRangeOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Protocol filter" hint="Filter protocol classes to isolate asymmetries between TCP, UDP, and ICMP traffic. Example: inspect UDP only when troubleshooting high-volume DNS traffic or gaming workloads." />
          <Select.Root type="single" value={protocolFilter} onValueChange={(value) => value && (protocolFilter = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{protocolOptions.find((option) => option.value === protocolFilter)?.label ?? 'Select protocol'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each protocolOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Minimum rule hits" hint="Filter out low-signal rules to focus on hotspots consuming NAT table resources. Example: set 100 to analyze frequently matched rules during traffic surges." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" bind:value={minimumHits} />
        </div>

        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Auto-refresh" hint="Auto-refresh keeps counters current while tuning NAT rules during active incidents. Example: run 20-second refresh while validating new overload rules under synthetic load tests." />
          <div class="mt-2 flex items-center justify-between">
            <span class="text-xs text-slate-400">{autoRefresh ? `Enabled (${refreshSeconds}s)` : 'Disabled'}</span>
            <Switch checked={autoRefresh} onCheckedChange={(checked) => (autoRefresh = checked)} />
          </div>
        </div>
      </div>

      <Collapsible.Root bind:open={showAdvanced}>
        <Collapsible.Trigger class="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-left">
          <span class="text-sm font-medium text-slate-200">{$_('nat_stats.advanced_statistics_behavior')}</span>
          <ChevronDownIcon class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content class="mt-3 grid gap-4 md:grid-cols-2">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Refresh interval seconds" hint="Shorter intervals increase responsiveness while diagnosing saturation, but can increase backend load. Example: 10 seconds for temporary stress tests, 60 seconds for passive production monitoring." />
            <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="5" max="300" bind:value={refreshSeconds} />
          </div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label="Apply current filters" hint="Run with active range and protocol constraints to avoid stale interpretation. Example: after changing filter values, apply and compare top talkers before and after policy updates." />
            <Button class="mt-2 bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void loadStats()}>
              <BarChart3Icon class="mr-2 h-4 w-4" /> Recompute metrics
            </Button>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('nat_stats.saved_statistic_profiles')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Profile name" hint="Profiles preserve recurring views for NOC workflows and weekly reporting. Example: Peak-hour UDP pressure profile for DNS-heavy branch offices." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" bind:value={profileDraft.name} placeholder="Peak-hour TCP" />
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Time range" hint="Persist range choices to make before-and-after performance comparisons consistent. Example: always use 1h for routine post-change validation windows." />
          <Select.Root type="single" value={profileDraft.timeRange} onValueChange={(value) => value && (profileDraft.timeRange = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{timeRangeOptions.find((option) => option.value === profileDraft.timeRange)?.label ?? 'Select range'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each timeRangeOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Protocol" hint="Protocol pinning lets teams share targeted views without reconfiguring filters each time. Example: save an ICMP-only profile for troubleshooting monitor path anomalies." />
          <Select.Root type="single" value={profileDraft.protocol} onValueChange={(value) => value && (profileDraft.protocol = value)}>
            <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
              <span>{protocolOptions.find((option) => option.value === profileDraft.protocol)?.label ?? 'Select protocol'}</span>
            </Select.Trigger>
            <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
              {#each protocolOptions as option}
                <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <FieldLabel label="Minimum hits" hint="Store a persistent threshold to keep low-impact rules out of routine reports. Example: set 50 so recurring analytics focus on operationally significant NAT entries." />
          <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type="number" min="0" bind:value={profileDraft.minimumHits} />
        </div>
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
        <FieldLabel label="Profile auto-refresh" hint="Enable for profiles used on wallboards and NOC monitors where manual refresh is impractical. Example: 30-second updates for dedicated incident-response dashboards." />
        <div class="mt-2 flex items-center justify-between">
          <span class="text-xs text-slate-400">{profileDraft.autoRefresh ? 'Enabled' : 'Disabled'}</span>
          <Switch checked={profileDraft.autoRefresh} onCheckedChange={(checked) => (profileDraft.autoRefresh = checked)} />
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveProfile} disabled={savingProfile}>
          <SaveIcon class="mr-2 h-4 w-4" /> {savingProfile ? 'Saving...' : editingProfileId ? 'Update profile' : 'Create profile'}
        </Button>
        {#if editingProfileId}
          <Button variant="outline" class="border-slate-700 text-slate-100 hover:bg-slate-800" onclick={resetProfileDraft}>{$_('nat_stats.cancel_edit')}</Button>
        {/if}
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <Table>
          <TableHeader class="bg-slate-950/60">
            <TableRow class="border-slate-700 hover:bg-slate-900/70">
              <TableHead class="text-slate-300">{$_('common.name')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_stats.range')}</TableHead>
              <TableHead class="text-slate-300">{$_('common.protocol')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_stats.min_hits')}</TableHead>
              <TableHead class="text-slate-300">{$_('nat_stats.auto_refresh')}</TableHead>
              <TableHead class="text-slate-300">{$_('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#if loadingProfiles}
              <TableRow class="border-slate-800 hover:bg-transparent"><TableCell colspan={6} class="py-6 text-center text-slate-400">Loading profiles...</TableCell></TableRow>
            {:else if profiles.length === 0}
              <TableRow class="border-slate-800 hover:bg-transparent"><TableCell colspan={6} class="py-6 text-center text-slate-500">No saved profiles.</TableCell></TableRow>
            {:else}
              {#each profiles as profile}
                <TableRow class="border-slate-800 hover:bg-slate-800/30">
                  <TableCell class="text-slate-100">{profile.name}</TableCell>
                  <TableCell class="text-slate-300">{profile.timeRange}</TableCell>
                  <TableCell class="text-slate-300">{profile.protocol}</TableCell>
                  <TableCell class="text-slate-300">{profile.minimumHits}</TableCell>
                  <TableCell class="text-slate-300">{profile.autoRefresh ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div class="flex gap-2">
                      <Button size="sm" variant="outline" class="border-cyan-700 text-cyan-200 hover:bg-cyan-950/40" onclick={() => applyProfile(profile)}>Use</Button>
                      <Button size="sm" variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => editProfile(profile)}>
                        <PencilIcon class="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" class="border-red-500/40 text-red-300 hover:bg-red-950/30" onclick={() => void deleteProfile(profile.id)} disabled={deletingProfile}>
                        <Trash2Icon class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              {/each}
            {/if}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>

  <div class="grid gap-6 xl:grid-cols-2">
    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader>
        <CardTitle class="text-slate-100">{$_('nat_stats.per_rule_hit_counts')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-950/60">
              <TableRow class="border-slate-700 hover:bg-slate-900/70">
                <TableHead class="text-slate-300">{$_('nat_stats.rule')}</TableHead>
                <TableHead class="text-slate-300">{$_('common.type')}</TableHead>
                <TableHead class="text-slate-300">{$_('common.interface')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.hits')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.packets')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.bytes')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.last_match')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#if loading}
                <TableRow class="border-slate-800 hover:bg-transparent"><TableCell colspan={7} class="py-8 text-center text-slate-400">Loading rule counters...</TableCell></TableRow>
              {:else if rules.length === 0}
                <TableRow class="border-slate-800 hover:bg-transparent"><TableCell colspan={7} class="py-8 text-center text-slate-500">No rules match filter criteria.</TableCell></TableRow>
              {:else}
                {#each rules as rule}
                  <TableRow class="border-slate-800 hover:bg-slate-800/30">
                    <TableCell class="text-slate-100">{rule.rule}</TableCell>
                    <TableCell class="text-slate-300">{rule.type}</TableCell>
                    <TableCell class="text-slate-300">{rule.interface}</TableCell>
                    <TableCell class="text-right text-slate-300">{numberWithCommas(rule.hits)}</TableCell>
                    <TableCell class="text-right text-slate-300">{numberWithCommas(rule.packets)}</TableCell>
                    <TableCell class="text-right text-slate-300">{bytesHuman(rule.bytes)}</TableCell>
                    <TableCell class="text-xs text-slate-400">{rule.lastMatch}</TableCell>
                  </TableRow>
                {/each}
              {/if}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-800 bg-slate-900/70">
      <CardHeader>
        <CardTitle class="text-slate-100">{$_('nat_stats.top_talkers_source_ip')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader class="bg-slate-950/60">
              <TableRow class="border-slate-700 hover:bg-slate-900/70">
                <TableHead class="text-slate-300">{$_('nat_stats.source_ip')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.sessions')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.packets')}</TableHead>
                <TableHead class="text-slate-300">{$_('nat_stats.bytes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#if loading}
                <TableRow class="border-slate-800 hover:bg-transparent"><TableCell colspan={4} class="py-8 text-center text-slate-400">Loading talkers...</TableCell></TableRow>
              {:else if talkers.length === 0}
                <TableRow class="border-slate-800 hover:bg-transparent"><TableCell colspan={4} class="py-8 text-center text-slate-500">No translation activity for selected range.</TableCell></TableRow>
              {:else}
                {#each talkers as talker}
                  <TableRow class="border-slate-800 hover:bg-slate-800/30">
                    <TableCell class="text-slate-100">{talker.sourceIp}</TableCell>
                    <TableCell class="text-right text-slate-300">{numberWithCommas(talker.sessions)}</TableCell>
                    <TableCell class="text-right text-slate-300">{numberWithCommas(talker.packets)}</TableCell>
                    <TableCell class="text-right text-slate-300">{bytesHuman(talker.bytes)}</TableCell>
                  </TableRow>
                {/each}
              {/if}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('nat_stats.protocol_distribution')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      {#if distributions.length === 0}
        <p class="text-sm text-slate-500">{$_('nat_stats.no_protocol_distribution_data_for_current_selectio')}</p>
      {:else}
        {#each distributions as slice}
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <div class="mb-2 flex items-center justify-between text-sm">
              <span class="text-slate-200">{slice.protocol}</span>
              <span class="text-slate-400">{numberWithCommas(slice.sessions)} sessions ({slice.percent.toFixed(1)}%)</span>
            </div>
            <div class="h-2 w-full rounded bg-slate-800">
              <div class="h-2 rounded bg-cyan-600" style={`width: ${Math.min(100, Math.max(0, slice.percent))}%`}></div>
            </div>
          </div>
        {/each}
      {/if}

      <div class="flex flex-wrap gap-2 pt-1">
        <Badge class="border-cyan-400/30 bg-cyan-500/20 text-cyan-200">TCP: {summary.tcpSessions}</Badge>
        <Badge class="border-cyan-400/30 bg-cyan-500/20 text-cyan-200">UDP: {summary.udpSessions}</Badge>
        <Badge class="border-cyan-400/30 bg-cyan-500/20 text-cyan-200">ICMP: {summary.icmpSessions}</Badge>
      </div>
    </CardContent>
  </Card>
</div>
