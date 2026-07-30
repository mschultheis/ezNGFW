<!-- Route view for `/cron` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "$lib/api/client";
  import { toasts } from "$lib/stores/toast";
  import FieldLabel from "$lib/components/admin/FieldLabel.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import ResourceTable from "$lib/components/admin/ResourceTable.svelte";
  import type { FormField, TableColumn } from "$lib/types/admin";
  import Info from "@lucide/svelte/icons/info";
  import { _ } from '$lib/i18n';

  const presetTemplates = [
    { id: "daily-backup", name: "Daily Backup", description: "Create encrypted nightly config backup and prune old snapshots." },
    { id: "weekly-report", name: "Weekly Report", description: "Generate compliance and utilization report each Monday morning." },
    { id: "log-rotation", name: "Log Rotation", description: "Rotate and compress local logs to prevent storage exhaustion." },
    { id: "cert-renewal", name: "Certificate Renewal", description: "Renew ACME certificates and reload services if updated." }
  ];

  const minuteOptions = ["*", "0", "5", "10", "15", "20", "30", "45"].map(v => ({ label: v, value: v }));
  const hourOptions = ["*", "0", "1", "2", "3", "4", "6", "12", "18", "23"].map(v => ({ label: v, value: v }));
  const dayOfMonthOptions = ["*", "1", "5", "10", "15", "20", "25", "28"].map(v => ({ label: v, value: v }));
  const monthOptions = ["*", "1", "3", "6", "9", "12"].map(v => ({ label: v, value: v }));
  const dayOfWeekOptions = ["*", "0", "1", "2", "3", "4", "5", "6"].map(v => ({ label: v, value: v }));
  const categoryOptions = ["maintenance", "backup", "reporting", "security", "monitoring"].map(v => ({ label: v, value: v }));
  const runUserOptions = ["root", "nobody", "admin", "monitoring"].map(v => ({ label: v, value: v }));

  const columns: TableColumn[] = [
    { key: "description", label: "Description" },
    { key: "command", label: "Command", mono: true },
    { key: "enabled", label: "Enabled" },
    { key: "last_run_time", label: "Last Run" },
    { key: "next_run_time", label: "Next Run" },
    { key: "last_exit_code", label: "Exit Code" }
  ];

  const fields: FormField[] = [
    { key: "description", label: "Description", type: "text", hint: "Human-readable identifier for this job." },
    { key: "command", label: "Command", type: "text", required: true, hint: "Full shell command to execute." },
    { key: "minute", label: "Minute", type: "select", options: minuteOptions, hint: "Minute of the hour (0-59)." },
    { key: "hour", label: "Hour", type: "select", options: hourOptions, hint: "Hour of the day (0-23)." },
    { key: "day_of_month", label: "Day of Month", type: "select", options: dayOfMonthOptions, hint: "Day of the month (1-31)." },
    { key: "month", label: "Month", type: "select", options: monthOptions, hint: "Month of the year (1-12)." },
    { key: "day_of_week", label: "Day of Week", type: "select", options: dayOfWeekOptions, hint: "Day of the week (0-6, 0 is Sunday)." },
    { key: "run_as_user", label: "Run As User", type: "select", options: runUserOptions, hint: "System user to execute the command as." },
    { key: "category", label: "Category", type: "select", options: categoryOptions, hint: "Operational category for grouping." },
    { key: "timeout_seconds", label: "Timeout (seconds)", type: "number", hint: "Maximum execution time before termination." },
    { key: "enabled", label: "Enabled", type: "boolean", hint: "Whether the job is active." },
    { key: "mail_on_error", label: "Mail On Error", type: "boolean", hint: "Send email notification if the job fails." },
    { key: "error_email", label: "Error Email", type: "text", hint: "Target address for failure notifications." }
  ];

  function applyPreset(presetId: string) {
    toasts.success("Presets are for reference. Please fill the form manually in the table below.");
  }
</script>

<div class="space-y-6">
  <Card class="border-slate-700 bg-slate-950/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('cron.cron_job_scheduler')}</CardTitle>
      <CardDescription class="text-slate-400">
        Manage scheduled tasks with expression builder and execution health visibility.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <div class="space-y-4 rounded-lg border border-slate-700 p-4">
        <div class="flex items-center gap-2 text-cyan-300">
          <Info class="h-4 w-4" />
          <FieldLabel label="Preset templates" hint="Common firewall automation workflows." />
        </div>
        <div class="grid gap-3 md:grid-cols-4">
          {#each presetTemplates as preset}
            <button
              type="button"
              class="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-left transition-colors hover:border-cyan-700 hover:bg-slate-900"
              onclick={() => applyPreset(preset.id)}
            >
              <p class="text-sm font-medium text-slate-200">{preset.name}</p>
              <p class="mt-1 text-xs text-slate-400">{preset.description}</p>
            </button>
          {/each}
        </div>
      </div>
    </CardContent>
  </Card>

  <ResourceTable
    title={$_('cron.titlescheduled_jobs')}
    description={$_('cron.descriptionsystemlevel_cron_jobs_for_maintenance_b')}
    endpoint="/cron/jobs"
    columns={columns}
    fields={fields}
    idKey="id"
    addLabel={$_('cron.addlabeladd_job')}
  />
</div>