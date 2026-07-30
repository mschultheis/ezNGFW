<!-- Route view for `/syslog/settings` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api/client";
  import FieldLabel from "$lib/components/admin/FieldLabel.svelte";
  import { toasts } from "$lib/stores/toast";
  import { Switch } from "$lib/components/ui/switch";
  import * as Select from "$lib/components/ui/select";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import ResourceTable from "$lib/components/admin/ResourceTable.svelte";
  import type { FormField, TableColumn } from "$lib/types/admin";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Save from "@lucide/svelte/icons/save";
  import Play from "@lucide/svelte/icons/play";
  import { _ } from '$lib/i18n';

  type Field = {
    key: string;
    label: string;
    kind: "text" | "number" | "boolean" | "select" | "textarea";
    required?: boolean;
    nullable?: boolean;
    hint: string;
    options?: { value: string; label: string }[];
  };

  const settingsEndpoint = "/syslog/settings";
  const actionEndpoint = "/syslog/settings/test-delivery";

  const settingsFields: Field[] = [
    { key: "enabled", label: "Enable Remote Syslog", kind: "boolean", hint: "Enable Remote Syslog controls how this workflow behaves in production and during troubleshooting." },
    { key: "remoteAddress", label: "Primary Remote Server", kind: "text", hint: "Primary Remote Server controls how this workflow behaves in production and during troubleshooting." },
    { key: "remotePort", label: "Remote Port", kind: "number", hint: "Remote Port controls how this workflow behaves in production and during troubleshooting." },
    { key: "transport", label: "Transport Protocol", kind: "select", options: [{ value: "udp", label: "UDP" }, { value: "tcp", label: "TCP" }, { value: "tls", label: "TLS" }], hint: "Transport Protocol controls how this workflow behaves in production and during troubleshooting." },
    { key: "facility", label: "Facility Mapping", kind: "select", options: [{ value: "local0", label: "local0" }, { value: "local1", label: "local1" }, { value: "daemon", label: "daemon" }, { value: "security", label: "security" }], hint: "Facility Mapping controls how this workflow behaves in production and during troubleshooting." },
    { key: "severity", label: "Minimum Severity", kind: "select", options: [{ value: "debug", label: "Debug" }, { value: "info", label: "Info" }, { value: "notice", label: "Notice" }, { value: "warning", label: "Warning" }, { value: "error", label: "Error" }], hint: "Minimum Severity controls how this workflow behaves in production and during troubleshooting." },
    { key: "logRotationCount", label: "Log Rotation Count", kind: "number", hint: "Log Rotation Count controls how this workflow behaves in production and during troubleshooting." }
  ];

  const actionFields: Field[] = [
    { key: "message", label: "Test Message", kind: "text", hint: "Test Message controls how this workflow behaves in production and during troubleshooting." },
    { key: "facility", label: "Facility", kind: "select", options: [{ value: "local0", label: "local0" }, { value: "local1", label: "local1" }, { value: "daemon", label: "daemon" }], hint: "Facility controls how this workflow behaves in production and during troubleshooting." },
    { key: "severity", label: "Severity", kind: "select", options: [{ value: "info", label: "Info" }, { value: "warning", label: "Warning" }, { value: "error", label: "Error" }], hint: "Severity controls how this workflow behaves in production and during troubleshooting." },
    { key: "includeHostname", label: "Include Hostname", kind: "boolean", hint: "Include Hostname controls how this workflow behaves in production and during troubleshooting." },
    { key: "includeTimestamp", label: "Include Timestamp", kind: "boolean", hint: "Include Timestamp controls how this workflow behaves in production and during troubleshooting." },
    { key: "target", label: "Target Override", kind: "text", hint: "Target Override controls how this workflow behaves in production and during troubleshooting." }
  ];

  const columns: TableColumn[] = [
    { key: "hostname", label: "Target Hostname" },
    { key: "port", label: "Port" },
    { key: "protocol", label: "Protocol" },
    { key: "facility", label: "Facility" },
    { key: "severity", label: "Severity" },
    { key: "enabled", label: "Enabled" }
  ];

  const fields: FormField[] = [
    { key: "hostname", label: "Target Hostname", type: "text", required: true, hint: "Target Hostname controls how this workflow behaves in production and during troubleshooting." },
    { key: "port", label: "Port", type: "number", hint: "Port controls how this workflow behaves in production and during troubleshooting." },
    { key: "protocol", label: "Protocol", type: "select", options: [{ label: "UDP", value: "udp" }, { label: "TCP", value: "tcp" }, { label: "TLS", value: "tls" }], hint: "Protocol controls how this workflow behaves in production and during troubleshooting." },
    { key: "facility", label: "Facility", type: "select", options: [{ label: "local0", value: "local0" }, { label: "local1", value: "local1" }, { label: "daemon", value: "daemon" }], hint: "Facility controls how this workflow behaves in production and during troubleshooting." },
    { key: "severity", label: "Severity", type: "select", options: [{ label: "Info", value: "info" }, { label: "Warning", value: "warning" }, { label: "Error", value: "error" }], hint: "Severity controls how this workflow behaves in production and during troubleshooting." },
    { key: "enabled", label: "Enabled", type: "boolean", hint: "Enabled controls how this workflow behaves in production and during troubleshooting." },
    { key: "description", label: "Description", type: "textarea", hint: "Description controls how this workflow behaves in production and during troubleshooting." }
  ];

  const secondaryTables = [
    { endpoint: "/syslog/queue", title: "Forwarding Queue Status", description: "Queue depth and retry counters to validate transport reliability and backpressure conditions.", columns: ["target", "queued", "failed", "retries", "lastError"] },
    { endpoint: "/syslog/recent-events", title: "Recent Forwarded Events", description: "Sample forwarded events used to verify facility/severity mappings and timestamp formatting.", columns: ["timestamp", "facility", "severity", "host", "message"] }
  ];

  let settings = $state<Record<string, any>>({});
  let actionDraft = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let actionResults = $state<Record<string, any>[]>([]);
  let actionOutput = $state("");

  let runningAction = $state(false);
  let saving = $state(false);
  let showAdvanced = $state(false);

  function asRows(payload: unknown): Record<string, any>[] {
    if (!Array.isArray(payload)) return [];
    return payload.map((entry) => (typeof entry === "object" && entry !== null ? (entry as Record<string, any>) : { value: String(entry ?? "") }));
  }

  async function loadSettings() {
    try {
      const payload = await api.get<Record<string, any>>(settingsEndpoint);
      settings = payload || {};
    } catch {
      toasts.error("Failed to load configuration settings");
    }
  }

  async function loadSecondary() {
    const next: Record<string, Record<string, any>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = asRows(payload);
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put(settingsEndpoint, settings);
      toasts.success("Settings saved");
    } catch {
      toasts.error("Failed to save settings");
    } finally {
      saving = false;
    }
  }

  async function runPrimaryAction() {
    runningAction = true;
    actionOutput = "Running request against backend API...";
    try {
      const response = await api.post(actionEndpoint, actionDraft);
      const maybeRecord = typeof response === "object" && response !== null ? (response as Record<string, any>) : {};
      actionResults = asRows(maybeRecord.results ?? maybeRecord.hops ?? maybeRecord.rows ?? maybeRecord.records ?? response);
      actionOutput = String(maybeRecord.output ?? maybeRecord.summary ?? JSON.stringify(response, null, 2));
      toasts.success("Action completed successfully");
      await loadSecondary();
    } catch {
      actionResults = [];
      actionOutput = "Request failed. Check backend service status and try again.";
      toasts.error("Action failed");
    } finally {
      runningAction = false;
    }
  }

  onMount(() => {
    void loadSettings();
    void loadSecondary();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('syslog_settings.global_syslog_settings')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('syslog_settings.manage_remote_forwarding_facilities_severity_thres')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => { void loadSettings(); void loadSecondary(); }} disabled={saving || runningAction}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving || runningAction}>
            <Save class="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each settingsFields as field}
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === "boolean"}
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-slate-400">{settings[field.key] ? "Enabled" : "Disabled"}</span>
                <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
              </div>
            {:else if field.kind === "select"}
              <Select.Root type="single" value={String(settings[field.key] ?? "")} onValueChange={(value) => value && (settings[field.key] = value)}>
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{field.options?.find((option) => option.value === String(settings[field.key]))?.label ?? "Select value"}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each field.options ?? [] as option}
                    <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <Input
                class="mt-2 border-slate-700 bg-slate-950 text-slate-100"
                type={field.kind === "number" ? "number" : "text"}
                value={String(settings[field.key] ?? "")}
                oninput={(event) => (settings[field.key] = field.kind === "number" ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)}
              />
            {/if}
          </div>
        {/each}
      </div>

      <Collapsible.Root bind:open={showAdvanced} class="pt-1">
        <Collapsible.Trigger>
          <span class="font-medium text-slate-200">{$_('syslog_settings.advanced_operational_behavior')}</span>
          <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <p class="text-sm leading-6 text-slate-300">
            Advanced settings tune polling cadence, strict validation behavior, and fail-safe defaults. In production,
            stage major changes by disabling new records first, then save and verify live telemetry before enabling.
          </p>
        </Collapsible.Content>
      </Collapsible.Root>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/60">
    <CardHeader>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('syslog_settings.log_delivery_verification')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('syslog_settings.send_verification_events_to_configured_targets_bef')}</CardDescription>
        </div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={runPrimaryAction} disabled={runningAction}>
          <Play class="mr-2 h-4 w-4" /> {runningAction ? "Running..." : "Send Test Event"}
        </Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each actionFields as field}
          <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <FieldLabel label={field.label} hint={field.hint} />
            {#if field.kind === "boolean"}
              <div class="mt-2 flex items-center justify-between">
                <span class="text-xs text-slate-400">{actionDraft[field.key] ? "Enabled" : "Disabled"}</span>
                <Switch checked={Boolean(actionDraft[field.key])} onCheckedChange={(checked) => (actionDraft[field.key] = checked)} />
              </div>
            {:else if field.kind === "select"}
              <Select.Root type="single" value={String(actionDraft[field.key] ?? "")} onValueChange={(value) => value && (actionDraft[field.key] = value)}>
                <Select.Trigger class="mt-2 w-full border-slate-700 bg-slate-950 text-slate-100">
                  <span>{field.options?.find((option) => option.value === String(actionDraft[field.key]))?.label ?? "Select value"}</span>
                </Select.Trigger>
                <Select.Content class="border-slate-700 bg-slate-900 text-slate-100">
                  {#each field.options ?? [] as option}
                    <Select.Item value={option.value} label={option.label} class="cursor-pointer hover:bg-slate-800" />
                  {/each}
                </Select.Content>
              </Select.Root>
            {:else}
              <Input class="mt-2 border-slate-700 bg-slate-950 text-slate-100" type={field.kind === "number" ? "number" : "text"} value={String(actionDraft[field.key] ?? "")} oninput={(event) => (actionDraft[field.key] = field.kind === "number" ? Number((event.currentTarget as HTMLInputElement).value || 0) : (event.currentTarget as HTMLInputElement).value)} />
            {/if}
          </div>
        {/each}
      </div>

      <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">{$_('syslog_settings.live_output')}</p>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{actionOutput || "No output yet. Run the tool to populate this panel."}</pre>
      </div>

      <div class="overflow-x-auto rounded-md border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {#if actionResults.length === 0}
                <th class="px-3 py-2 text-left">Result</th>
              {:else}
                {#each Object.keys(actionResults[0]) as key}
                  <th class="px-3 py-2 text-left">{key}</th>
                {/each}
              {/if}
            </tr>
          </thead>
          <tbody>
            {#if actionResults.length === 0}
              <tr><td class="px-3 py-6 text-center text-slate-500">No structured rows returned.</td></tr>
            {:else}
              {#each actionResults as result}
                <tr class="border-t border-slate-800/80 text-slate-200">
                  {#each Object.keys(actionResults[0]) as key}
                    <td class="px-3 py-2 text-xs">{String(result[key] ?? "-")}</td>
                  {/each}
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('syslog_settings.titlesyslog_targets')}
    description={$_('syslog_settings.descriptionconfigure_remote_syslog_servers_to_rece')}
    endpoint="/syslog/targets"
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('syslog_settings.addlabeladd_target')}
  />

  {#each secondaryTables as section}
    <Card class="border-slate-800 bg-slate-900/60">
      <CardHeader>
        <CardTitle class="text-slate-100">{section.title}</CardTitle>
        <CardDescription class="text-slate-400">{section.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="overflow-x-auto rounded-md border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {#each section.columns as column}
                  <th class="px-3 py-2 text-left">{column}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#if (secondaryData[section.endpoint] ?? []).length === 0}
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No syslog settings found.</td></tr>
              {:else}
                {#each secondaryData[section.endpoint] ?? [] as row}
                  <tr class="border-t border-slate-800/80 text-slate-200">
                    {#each section.columns as column}
                      <td class="px-3 py-2 text-xs">{String(row[column] ?? "-")}</td>
                    {/each}
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  {/each}
</div>