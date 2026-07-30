<!-- Route view for `/captive-portal/sessions` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api/client";
  import FieldLabel from "$lib/components/admin/FieldLabel.svelte";
  import { Switch } from "$lib/components/ui/switch";
  import * as Select from "$lib/components/ui/select";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import { toasts } from "$lib/stores/toast";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import ResourceTable from "$lib/components/admin/ResourceTable.svelte";
  import type { FormField, TableColumn } from "$lib/types/admin";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Save from "@lucide/svelte/icons/save";
  import { _ } from '$lib/i18n';

  type Field = {
    key: string;
    label: string;
    kind: "text" | "number" | "boolean" | "select" | "textarea";
    required?: boolean;
    advanced?: boolean;
    nullable?: boolean;
    hint: string;
    options?: { value: string; label: string }[];
  };

  const settingsFields: Field[] = [
    { key: "autoRefresh", label: "Auto Refresh", kind: "boolean", hint: "Automatically refreshes backend data." },
    { key: "refreshSeconds", label: "Refresh Interval Seconds", kind: "number", hint: "Polling cadence used when auto refresh is active." },
    { key: "strictValidation", label: "Strict Validation", kind: "boolean", hint: "Enforces additional client-side validation." },
    { key: "defaultSort", label: "Default Sort", kind: "select", hint: "Initial sort mode applied to inline records.", options: [{ value: "name", label: "Name" }, { value: "priority", label: "Priority" }, { value: "updated", label: "Updated Time" }] },
    { key: "showDisabled", label: "Show Disabled Rows", kind: "boolean", hint: "Keeps disabled records visible." },
    { key: "alertThreshold", label: "Alert Threshold", kind: "number", hint: "Threshold used for warning badges." },
    { key: "operatorTag", label: "Operator Tag", kind: "text", hint: "Optional text marker for traceability." },
    { key: "maintenanceMode", label: "Maintenance Mode", kind: "boolean", hint: "Signals that edits are being staged." }
  ];

  const columns: TableColumn[] = [
    { key: "name", label: "Name" },
    { key: "scope", label: "Scope" },
    { key: "target", label: "Target" },
    { key: "priority", label: "Priority" },
    { key: "category", label: "Category" },
    { key: "enabled", label: "Status" },
    { key: "owner", label: "Owner" }
  ];

  const fields: FormField[] = [
    { key: "name", label: "Profile Name", type: "text", required: true, hint: "Human-readable identifier." },
    { key: "enabled", label: "Enabled", type: "boolean", hint: "Controls whether this profile is active." },
    { key: "priority", label: "Priority", type: "number", required: true, hint: "Relative precedence (lower is first)." },
    { key: "scope", label: "Scope", type: "select", required: true, options: [{ label: "Global", value: "global" }, { label: "Site", value: "site" }, { label: "Segment", value: "segment" }, { label: "Host", value: "host" }], hint: "Narrows where this record applies." },
    { key: "target", label: "Target", type: "text", required: true, hint: "Primary target entity (network, host, etc.)." },
    { key: "category", label: "Category", type: "select", options: [{ label: "Critical", value: "critical" }, { label: "Standard", value: "standard" }, { label: "Experimental", value: "experimental" }], hint: "Groups similar records." },
    { key: "description", label: "Description", type: "textarea", hint: "Extended operator notes." }
  ];

  const secondaryTables = [
    { endpoint: "/captive-portal/sessions", title: "Live Sessions", description: "Current authenticated portal sessions.", columns: ["username", "ip", "mac", "zone", "loginTime", "bytesIn", "bytesOut"] },
    { endpoint: "/captive-portal/sessions/history", title: "Session Event History", description: "Recent session start, stop, and disconnect events.", columns: ["timestamp", "username", "ip", "zone", "event", "reason"] }
  ];

  let settings = $state<Record<string, any>>({});
  let secondaryData = $state<Record<string, Record<string, any>[]>>({});
  let loading = $state(true);
  let saving = $state(false);
  let showAdvanced = $state(false);

  async function loadSettings() {
    try {
      const payload = await api.get<Record<string, any>>("/captive-portal/sessions/settings");
      settings = payload || {};
    } catch {
      toasts.error("Failed to load page settings");
    }
  }

  async function loadSecondary() {
    const next: Record<string, Record<string, any>[]> = {};
    for (const section of secondaryTables) {
      try {
        const payload = await api.get<unknown[]>(section.endpoint);
        next[section.endpoint] = Array.isArray(payload) ? (payload as any[]) : [];
      } catch {
        next[section.endpoint] = [];
      }
    }
    secondaryData = next;
  }

  async function saveSettings() {
    saving = true;
    try {
      await api.put("/captive-portal/sessions/settings", settings);
      toasts.success("Settings saved");
    } catch {
      toasts.error("Failed to save settings");
    } finally {
      saving = false;
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
          <CardTitle class="text-slate-100">{$_('captive_portal_sessions.captive_portal_session_control')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('captive_portal_sessions.filter_score_and_curate_active_portal_sessions')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-300 hover:bg-slate-800" onclick={() => { void loadSettings(); void loadSecondary(); }} disabled={saving}>
            <RefreshCw class="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={saveSettings} disabled={saving}>
            <Save class="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if !loading}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {#each settingsFields.filter(f => !["autoRefresh","refreshSeconds","strictValidation","defaultSort","showDisabled","alertThreshold","operatorTag","maintenanceMode"].includes(f.key)) as field}
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
          <Collapsible.Trigger class="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
            <span class="font-medium text-slate-200">{$_('captive_portal_sessions.advanced_operational_behavior')}</span>
            <ChevronDown class={`h-4 w-4 text-slate-400 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </Collapsible.Trigger>
          <Collapsible.Content class="space-y-3 pt-3">
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {#each settingsFields.filter(f => ["autoRefresh","refreshSeconds","strictValidation","defaultSort","showDisabled","alertThreshold","operatorTag","maintenanceMode"].includes(f.key)) as field}
                <div class="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                  <FieldLabel label={field.label} hint={field.hint} />
                  {#if field.kind === 'boolean'}
                    <div class="mt-2 flex items-center justify-between">
                      <span class="text-xs text-slate-400">{settings[field.key] ? 'Enabled' : 'Disabled'}</span>
                      <Switch checked={Boolean(settings[field.key])} onCheckedChange={(checked) => (settings[field.key] = checked)} />
                    </div>
                  {:else if field.kind === 'select'}
                    <select class="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100" value={String(settings[field.key] ?? '')} onchange={(e) => (settings[field.key] = (e.currentTarget as HTMLSelectElement).value)}>
                      {#each field.options ?? [] as option}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  {:else}
                    <input
                      class="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                      type={field.kind === 'number' ? 'number' : 'text'}
                      value={String(settings[field.key] ?? '')}
                      oninput={(e) => (settings[field.key] = field.kind === 'number' ? Number((e.currentTarget as HTMLInputElement).value || 0) : (e.currentTarget as HTMLInputElement).value)}
                    />
                  {/if}
                </div>
              {/each}
            </div>
            <p class="text-sm leading-6 text-slate-300">
              Advanced settings tune polling cadence, strict validation behavior, and fail-safe defaults.
            </p>
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('captive_portal_sessions.titlesession_policies')}
    description={$_('captive_portal_sessions.descriptionview_and_manage_active_captive_portal_s')}
    endpoint="/captive-portal/sessions/policies"
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('captive_portal_sessions.addlabeladd_profile')}
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
                <tr><td class="px-3 py-6 text-center text-slate-500" colspan={section.columns.length}>No active sessions found.</td></tr>
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