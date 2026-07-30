<!-- Route view for `/automation` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { _ } from '$lib/i18n';

  type AutomationStatus = {
    netconf?: { enabled?: boolean; listen_port?: number; yang_modules?: number };
    terraform?: { enabled?: boolean; state_backend?: string; drift_detection?: boolean };
    ansible?: { enabled?: boolean; inventory_export_enabled?: boolean; allowed_modules?: number };
    ztp?: { enabled?: boolean; templates?: number; auto_register?: boolean };
  };

  let status = $state<AutomationStatus>({});
  let loading = $state(true);

  async function load() {
    loading = true;
    try {
      status = await api.get('/automation/status') as AutomationStatus;
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load automation status');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('automation.automation_services')}</CardTitle>
      <CardDescription class="text-slate-400">{$_('automation.controlplane_integrations_for_netconfyang_terrafor')}</CardDescription>
    </CardHeader>
    <CardContent>
      {#if loading}
        <p class="text-sm text-slate-400">{$_('automation.loading_service_status')}</p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <a href="{base}/automation/netconf" class="rounded-md border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-cyan-700">
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('automation.netconf')}</p>
            <p class="mt-2 text-sm text-slate-100">{status.netconf?.enabled ? 'Enabled' : 'Disabled'}</p>
            <p class="mt-1 text-xs text-slate-400">Port {status.netconf?.listen_port ?? 0} | YANG modules {status.netconf?.yang_modules ?? 0}</p>
          </a>
          <a href="{base}/automation/terraform" class="rounded-md border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-cyan-700">
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('automation.terraform')}</p>
            <p class="mt-2 text-sm text-slate-100">{status.terraform?.enabled ? 'Enabled' : 'Disabled'}</p>
            <p class="mt-1 text-xs text-slate-400">Backend {status.terraform?.state_backend ?? '-'} | Drift {status.terraform?.drift_detection ? 'On' : 'Off'}</p>
          </a>
          <a href="{base}/automation/ansible" class="rounded-md border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-cyan-700">
            <p class="text-xs uppercase tracking-wide text-slate-400">{$_('automation.ansible')}</p>
            <p class="mt-2 text-sm text-slate-100">{status.ansible?.enabled ? 'Enabled' : 'Disabled'}</p>
            <p class="mt-1 text-xs text-slate-400">Inventory export {status.ansible?.inventory_export_enabled ? 'On' : 'Off'} | Modules {status.ansible?.allowed_modules ?? 0}</p>
          </a>
          <a href="{base}/automation/ztp" class="rounded-md border border-slate-800 bg-slate-950 p-4 transition-colors hover:border-cyan-700">
            <p class="text-xs uppercase tracking-wide text-slate-400">ZTP</p>
            <p class="mt-2 text-sm text-slate-100">{status.ztp?.enabled ? 'Enabled' : 'Disabled'}</p>
            <p class="mt-1 text-xs text-slate-400">Templates {status.ztp?.templates ?? 0} | Auto register {status.ztp?.auto_register ? 'On' : 'Off'}</p>
          </a>
        </div>
      {/if}
    </CardContent>
  </Card>
</div>
