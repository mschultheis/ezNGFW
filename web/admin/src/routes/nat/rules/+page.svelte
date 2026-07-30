<!-- Route view for `/nat/rules` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import ResourceTable from '$lib/components/admin/ResourceTable.svelte';
  import type { FormField, TableColumn } from '$lib/types/admin';
  import { asList, asObject, asString } from '$lib/utils/api-data';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

  import { _ } from '$lib/i18n';
  const endpoint = '/nat';

  const natTypeOptions = [
    { label: 'SNAT (Source NAT)', value: 'snat' },
    { label: 'DNAT (Destination NAT)', value: 'dnat' },
    { label: 'One-to-One (Bimap)', value: 'one-to-one' },
    { label: 'NPTv6 (IPv6 Prefix Translation)', value: 'nptv6' },
    { label: 'NAT64', value: 'nat64' }
  ];

  const protocolOptions = [
    { label: 'Any', value: 'any' },
    { label: 'TCP', value: 'tcp' },
    { label: 'UDP', value: 'udp' },
    { label: 'TCP/UDP', value: 'tcp/udp' },
    { label: 'ICMP', value: 'icmp' },
    { label: 'GRE', value: 'gre' },
    { label: 'ESP', value: 'esp' },
    { label: 'AH', value: 'ah' }
  ];

  const poolOptions = [
    { label: 'Round-Robin', value: 'round-robin' },
    { label: 'Source Hash (Sticky)', value: 'source-hash' },
    { label: 'Random', value: 'random' },
    { label: 'Sticky Address', value: 'sticky' },
    { label: 'None', value: 'none' }
  ];

  const filterAssociationOptions = [
    { label: 'Pass (create linked filter rule)', value: 'pass' },
    { label: 'None (NAT only)', value: 'none' },
    { label: 'Match Existing', value: 'match' }
  ];

  const columns: TableColumn[] = [
    { key: 'position', label: 'Position' },
    { key: 'nat_type', label: 'Type' },
    { key: 'protocol', label: 'Protocol' },
    { key: 'in_interface', label: 'Ingress' },
    { key: 'out_interface', label: 'Egress' },
    { key: 'src_cidr', label: 'Source CIDR' },
    { key: 'dst_cidr', label: 'Destination CIDR' },
    { key: 'translated_ip', label: 'Translated IP' },
    { key: 'translated_port', label: 'Translated Port' },
    { key: 'enabled', label: 'Enabled' },
    { key: 'description', label: 'Description' }
  ];

  let interfaceOptions = $state<{ label: string; value: string }[]>([{ label: 'Any', value: 'any' }]);
  let rulesCount = $state(0);
  let activeRules = $state(0);
  let stats = $state<Record<string, unknown>>({});
  let statsLoading = $state(true);
  let translations = $state<Record<string, unknown>[]>([]);
  let showTranslations = $state(false);

  const fields = $derived.by(
    (): FormField[] => [
      { key: 'enabled', label: 'Enabled', type: 'boolean', hint: 'Activate or park this rule without deleting it.' },
      { key: 'position', label: 'Order / Position', type: 'number', min: 1, hint: 'Lower numbers are evaluated first.' },
      { key: 'nat_type', label: 'NAT Type', type: 'select', options: natTypeOptions, hint: 'Translation mode for this rule.' },
      { key: 'protocol', label: 'Protocol', type: 'select', options: protocolOptions, hint: 'Restrict matching to protocol when possible.' },
      { key: 'in_interface', label: 'Ingress Interface', type: 'select', options: interfaceOptions, hint: 'Interface where packets enter before translation.' },
      { key: 'out_interface', label: 'Egress Interface', type: 'select', options: interfaceOptions, hint: 'Interface used after translation.' },
      { key: 'src_cidr', label: 'Source Network', type: 'text', placeholder: '10.0.1.0/24', hint: 'Source address/network to match.' },
      { key: 'src_port', label: 'Source Port', type: 'text', placeholder: 'Optional', hint: 'Optional source port or range.' },
      { key: 'dst_cidr', label: 'Destination Network', type: 'text', placeholder: '0.0.0.0/0', hint: 'Destination address/network to match.' },
      { key: 'dst_port', label: 'Destination Port', type: 'text', placeholder: '443', hint: 'External destination port to match.' },
      { key: 'translated_ip', label: 'Translated Address', type: 'text', placeholder: '10.0.1.50', hint: 'Translated target address.' },
      { key: 'translated_port', label: 'Translated Port', type: 'text', placeholder: 'Optional', hint: 'Translated port if remapping is needed.' },
      { key: 'description', label: 'Description', type: 'text', hint: 'Document service owner and intent.' },
      { key: 'pool_options', label: 'Pool Options', type: 'select', options: poolOptions, hint: 'Address pool behavior when multiple addresses are available.' },
      { key: 'static_port', label: 'Static Port', type: 'boolean', hint: 'Preserve source port when possible.' },
      { key: 'no_rdr', label: 'No Redirect', type: 'boolean', hint: 'Disable redirect behavior for this rule.' },
      { key: 'filterAssociation', label: 'Filter Rule Association', type: 'select', options: filterAssociationOptions, hint: 'Controls linked firewall filter behavior.' },
      { key: 'tag', label: 'Packet Tag', type: 'text', hint: 'Apply tag for downstream matching.' },
      { key: 'tagged', label: 'Match Tagged', type: 'text', hint: 'Only match packets already carrying this tag.' },
      { key: 'nosync', label: 'No HA Sync', type: 'boolean', hint: 'Skip state sync to HA peer.' },
      { key: 'log', label: 'Log Matches', type: 'boolean', hint: 'Enable NAT match logging.' }
    ]
  );

  async function loadOverview() {
    statsLoading = true;
    try {
      const [rulesPayload, ifacesPayload, statsPayload, transPayload] = await Promise.all([
        api.get('/nat').catch(() => []),
        api.get('/interfaces').catch(() => []),
        api.get('/nat/stats').catch(() => ({})),
        api.get('/nat/translations').catch(() => [])
      ]);

      const rules = asList(rulesPayload).map((entry) =>
        typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
      );
      rulesCount = rules.length;
      activeRules = rules.filter((rule) => Boolean(rule.enabled ?? true)).length;

      interfaceOptions = [
        { label: 'Any', value: 'any' },
        ...asList(ifacesPayload)
          .map((iface) => {
            const row = typeof iface === 'object' && iface !== null ? (iface as Record<string, unknown>) : null;
            const value = String(row?.name ?? row?.id ?? iface ?? '').trim();
            return value ? { label: value, value } : null;
          })
          .filter((item): item is { label: string; value: string } => item !== null)
      ];

      stats = asObject(statsPayload);
      translations = asList(transPayload).map((entry) =>
        typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
      );
    } finally {
      statsLoading = false;
    }
  }

  onMount(() => {
    void loadOverview();
  });
</script>

<div class="space-y-6">
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#if statsLoading}
      <Skeleton class="h-24 bg-slate-800" />
      <Skeleton class="h-24 bg-slate-800" />
      <Skeleton class="h-24 bg-slate-800" />
      <Skeleton class="h-24 bg-slate-800" />
    {:else}
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6"><p class="text-xs text-slate-500">{$_('nat_rules.total_rules')}</p><p class="mt-1 text-2xl font-semibold text-slate-100">{rulesCount}</p></CardContent></Card>
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6"><p class="text-xs text-slate-500">{$_('nat_rules.active_rules')}</p><p class="mt-1 text-2xl font-semibold text-emerald-400">{activeRules}</p></CardContent></Card>
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6"><p class="text-xs text-slate-500">{$_('nat_rules.active_translations')}</p><p class="mt-1 text-2xl font-semibold text-cyan-400">{asString(stats.activeTranslations ?? stats.active ?? translations.length)}</p></CardContent></Card>
      <Card class="border-slate-800 bg-slate-900"><CardContent class="pt-6"><p class="text-xs text-slate-500">{$_('nat_rules.total_translated_packets')}</p><p class="mt-1 text-2xl font-semibold text-slate-100">{asString(stats.totalPackets ?? stats.packets ?? '0')}</p></CardContent></Card>
    {/if}
  </div>

  <div class="flex justify-end">
    <Button variant="outline" class="cursor-pointer border-slate-700 text-slate-200 hover:bg-slate-800" onclick={() => void loadOverview()}>
      <RefreshCwIcon class="mr-2 size-4" /> Refresh Stats
    </Button>
  </div>

  <ResourceTable
    title="{$_('nat_rules.nat_rules')}"
    description={$_('nat_rules.descriptionconfigure_stateful_network_address_tran')}
    endpoint={endpoint}
    columns={columns}
    fields={fields}
    addLabel={$_('nat_rules.addlabeladd_nat_rule')}
  />

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <button class="flex w-full cursor-pointer items-center justify-between" onclick={() => (showTranslations = !showTranslations)}>
        <div>
          <CardTitle class="text-slate-100">{$_('nat_rules.active_nat_translations')}</CardTitle>
          <CardDescription class="text-slate-400">Live connection tracking table showing current address translations.</CardDescription>
        </div>
        <div class="text-slate-400">{#if showTranslations}<ChevronDownIcon class="size-5" />{:else}<ChevronRightIcon class="size-5" />{/if}</div>
      </button>
    </CardHeader>
    {#if showTranslations}
      <CardContent>
        {#if translations.length === 0}
          <p class="py-6 text-center text-sm text-slate-500">{$_('nat_rules.no_active_translations')}</p>
        {:else}
          <div class="overflow-x-auto rounded-md border border-slate-800">
            <table class="w-full text-sm">
              <thead class="bg-slate-800 text-xs text-slate-300">
                <tr>
                  <th class="px-3 py-2 text-left">Protocol</th>
                  <th class="px-3 py-2 text-left">Original Source</th>
                  <th class="px-3 py-2 text-left">Original Dest</th>
                  <th class="px-3 py-2 text-left">Translated Source</th>
                  <th class="px-3 py-2 text-left">Translated Dest</th>
                  <th class="px-3 py-2 text-left">State</th>
                  <th class="px-3 py-2 text-left">Age</th>
                </tr>
              </thead>
              <tbody>
                {#each translations as row}
                  <tr class="border-t border-slate-800 hover:bg-slate-800/30">
                    <td class="px-3 py-2 text-slate-400">{asString(row.protocol)}</td>
                    <td class="px-3 py-2 font-mono text-xs text-slate-300">{asString(row.origSrc ?? row.src)}</td>
                    <td class="px-3 py-2 font-mono text-xs text-slate-300">{asString(row.origDst ?? row.dst)}</td>
                    <td class="px-3 py-2 font-mono text-xs text-emerald-400">{asString(row.transSrc ?? row.translatedSrc)}</td>
                    <td class="px-3 py-2 font-mono text-xs text-emerald-400">{asString(row.transDst ?? row.translatedDst)}</td>
                    <td class="px-3 py-2 text-slate-400">{asString(row.state ?? '-')}</td>
                    <td class="px-3 py-2 font-mono text-xs text-slate-500">{asString(row.age ?? row.timeout ?? '-')}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </CardContent>
    {/if}
  </Card>
</div>
