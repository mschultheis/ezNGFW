<!-- Route view for `/zones` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api/client";
  import { toasts } from "$lib/stores/toast";
  import { asObject } from "$lib/utils/api-data";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent } from "$lib/components/ui/card";
  import ResourceTable from "$lib/components/admin/ResourceTable.svelte";
  import type { FormField, TableColumn, SelectOption } from "$lib/types/admin";
  import RefreshCcwIcon from "@lucide/svelte/icons/refresh-ccw";

  import { _ } from '$lib/i18n';
  let stats = $state<Record<string, any>>({});
  let loadingStats = $state(false);
  let interfaceOptions = $state<SelectOption[]>([]);
  let zoneOptions = $state<SelectOption[]>([]);

  const zoneColumns: TableColumn[] = [
    { key: "name", label: "Name" },
    { key: "interfaces", label: "Interfaces", mono: true },
    { key: "defaultAction", label: "Default Action" },
    { key: "logging", label: "Logging" },
    { key: "description", label: "Description" }
  ];

  const zoneFields = $derived.by((): FormField[] => [
    { key: "name", label: "Name", type: "text", required: true, hint: "Unique zone identifier (e.g. LAN, WAN, DMZ)." },
    { key: "interfaces", label: "Interfaces", type: "multiselect", options: interfaceOptions, hint: "Network interfaces belonging to this zone." },
    { key: "intraZonePolicy", label: "Intra-Zone Policy", type: "select", options: [{ label: "Accept", value: "accept" }, { label: "Drop", value: "drop" }, { label: "Reject", value: "reject" }], hint: "Default behavior for traffic within the same zone." },
    { key: "interZonePolicy", label: "Inter-Zone Policy Default", type: "select", options: [{ label: "Accept", value: "accept" }, { label: "Drop", value: "drop" }, { label: "Reject", value: "reject" }], hint: "Fallback action when traffic crosses zones." },
    { key: "defaultAction", label: "Default Action", type: "select", options: [{ label: "Allow", value: "allow" }, { label: "Deny", value: "deny" }, { label: "Reject", value: "reject" }], hint: "Fallback policy when no inter-zone rule matches." },
    { key: "logging", label: "Logging", type: "boolean", hint: "Enable logging for zone default action." },
    { key: "allowDns", label: "Allow DNS", type: "boolean", hint: "Quick toggle to allow DNS traffic." },
    { key: "allowDhcp", label: "Allow DHCP", type: "boolean", hint: "Quick toggle to allow DHCP traffic." },
    { key: "allowIcmp", label: "Allow ICMP", type: "boolean", hint: "Quick toggle to allow ICMP traffic." },
    { key: "allowNtp", label: "Allow NTP", type: "boolean", hint: "Quick toggle to allow NTP traffic." },
    { key: "masquerade", label: "Masquerade", type: "boolean", hint: "Enable NAT masquerading for outbound traffic." },
    { key: "mtu", label: "MTU", type: "number", hint: "Maximum Transmission Unit (default 1500)." },
    { key: "tcpClampMss", label: "TCP Clamp MSS", type: "boolean", hint: "Automatically clamp TCP MSS to fit MTU." },
    { key: "description", label: "Description", type: "textarea", hint: "Purpose of this zone." }
  ]);

  const policyColumns: TableColumn[] = [
    { key: "order", label: "Order" },
    { key: "fromZone", label: "From" },
    { key: "toZone", label: "To" },
    { key: "action", label: "Action" },
    { key: "service", label: "Service" },
    { key: "source", label: "Source", mono: true },
    { key: "destination", label: "Destination", mono: true },
    { key: "enabled", label: "Enabled" }
  ];

  const policyFields = $derived.by((): FormField[] => [
    { key: "order", label: "Order", type: "number", required: true, hint: "Numeric priority (lower is evaluated first)." },
    { key: "fromZone", label: "From Zone", type: "select", options: zoneOptions, required: true, hint: "Source security zone." },
    { key: "toZone", label: "To Zone", type: "select", options: zoneOptions, required: true, hint: "Destination security zone." },
    { key: "action", label: "Action", type: "select", options: [{ label: "Allow", value: "allow" }, { label: "Deny", value: "deny" }, { label: "Reject", value: "reject" }], hint: "What to do when traffic matches." },
    { key: "service", label: "Service", type: "select", options: [{ label: "Any", value: "any" }, { label: "HTTP/HTTPS", value: "http-https" }, { label: "DNS", value: "dns" }, { label: "SSH", value: "ssh" }, { label: "ICMP", value: "icmp" }], hint: "Protocol or service profile." },
    { key: "source", label: "Source Address", type: "text", hint: "Source IP or CIDR (empty for any)." },
    { key: "destination", label: "Destination Address", type: "text", hint: "Destination IP or CIDR (empty for any)." },
    { key: "log", label: "Log", type: "boolean", hint: "Log matching traffic." },
    { key: "enabled", label: "Enabled", type: "boolean", hint: "Toggle policy active/inactive." },
    { key: "description", label: "Description", type: "textarea", hint: "Reason for this policy." }
  ]);

  async function refreshStats() {
    loadingStats = true;
    try { stats = asObject(await api.get("/zones/stats")); }
    catch { stats = {}; }
    finally { loadingStats = false; }
  }

  async function loadOptions() {
    try {
      const [iData, zData] = await Promise.all([api.get("/interfaces"), api.get("/zones")]);
      interfaceOptions = (iData as any[]).map(i => ({ label: String(i.name || i), value: String(i.name || i) }));
      zoneOptions = (zData as any[]).map(z => ({ label: String(z.name), value: String(z.name) }));
    } catch {
      interfaceOptions = [];
      zoneOptions = [];
    }
  }

  onMount(() => {
    void refreshStats();
    void loadOptions();
  });
</script>

<div class="space-y-6">
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#each [
      { label: "Zones Configured", value: stats.zonesConfigured ?? 0, tone: "" },
      { label: "Active Policies", value: stats.activePolicies ?? 0, tone: "" },
      { label: "Blocked Inter-Zone", value: stats.blockedInterZone ?? 0, tone: "text-red-400" },
      { label: "Allowed Inter-Zone", value: stats.allowedInterZone ?? 0, tone: "text-emerald-400" }
    ] as item}
      <Card class="border-slate-800 bg-slate-900">
        <CardContent class="pt-4 pb-4">
          <p class="text-xs text-slate-400">{item.label}</p>
          <p class="mt-1 text-2xl font-bold {item.tone || "text-slate-100"}">{item.value}</p>
        </CardContent>
      </Card>
    {/each}
  </div>

  <div class="flex justify-end">
    <Button variant="outline" size="sm" class="border-slate-700 text-slate-300 cursor-pointer" onclick={() => void refreshStats()} disabled={loadingStats}>
      <RefreshCcwIcon class="mr-1 size-3.5" />
      {loadingStats ? "Refreshing..." : "Refresh Stats"}
    </Button>
  </div>

  <ResourceTable
    title="{$_('zones.security_zones')}"
    description={$_('zones.descriptionassign_network_interfaces_to_trust_boun')}
    endpoint="/zones"
    columns={zoneColumns}
    fields={zoneFields}
    idKey="name"
    addLabel={$_('zones.addlabelcreate_zone')}
  />

  <ResourceTable
    title="{$_('zones.inter_zone_policies')}"
    description={$_('zones.descriptiondefine_allowdenyreject_rules_between_zo')}
    endpoint="/zones/policies"
    columns={policyColumns}
    fields={policyFields}
    idKey="id"
    addLabel={$_('zones.addlabeladd_policy')}
  />
</div>