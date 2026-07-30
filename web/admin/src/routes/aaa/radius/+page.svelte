<!-- Route view for `/aaa/radius` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { _ } from '$lib/i18n';

  type RadiusServer = { id: string; address: string; auth_port: number; acct_port: number; secret: string; priority: number; description: string };
  type RadiusConfig = { enabled: boolean; servers: RadiusServer[]; timeout_sec: number; retries: number; nas_identifier: string; accounting_enabled: boolean; coa_enabled: boolean; coa_port: number; description: string };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<RadiusConfig>({ enabled: false, servers: [], timeout_sec: 5, retries: 3, nas_identifier: 'ezngfw', accounting_enabled: false, coa_enabled: false, coa_port: 3799, description: '' });
  let draft = $state<RadiusServer>({ id: '', address: '', auth_port: 1812, acct_port: 1813, secret: '', priority: 1, description: '' });

  async function loadAll() {
    loading = true;
    try { config = await api.get<RadiusConfig>('/aaa/radius'); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load RADIUS'); } finally { loading = false; }
  }
  async function saveConfig() {
    saving = true;
    try { config = await api.patch<RadiusConfig>('/aaa/radius', config); toasts.success($_('aaa_radius.toastradius_settings_saved')); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save RADIUS'); } finally { saving = false; }
  }
  async function addServer() {
    if (!draft.id.trim() || !draft.address.trim()) return;
    saving = true;
    try { await api.post('/aaa/radius/servers', draft); draft = { id: '', address: '', auth_port: 1812, acct_port: 1813, secret: '', priority: 1, description: '' }; await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add server'); } finally { saving = false; }
  }
  async function removeServer(id: string) {
    saving = true;
    try { await api.del(`/aaa/radius/servers/${id}`); await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove server'); } finally { saving = false; }
  }
  onMount(() => { void loadAll(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_radius.radius')}</CardTitle></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><FieldLabel label="Enabled" hint="Enable or disable RADIUS authentication for the system." /><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div></div>
        <label class="space-y-1 text-sm">
          <FieldLabel label="NAS Identifier" hint="The Network Access Server identifier sent in RADIUS packets to identify this device." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.nas_identifier} placeholder={$_('aaa_radius.placeholdernas_identifier')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Description" hint="A descriptive name for this RADIUS configuration." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.description} placeholder={$_('aaa_radius.placeholderdescription')} />
        </label>
      </div>
      <div class="grid gap-3 md:grid-cols-4">
        <label class="space-y-1 text-sm">
          <FieldLabel label="Timeout" hint="Maximum time in seconds to wait for a response from the RADIUS server." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.timeout_sec} placeholder={$_('aaa_radius.placeholdertimeout')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Retries" hint="Number of times to retry a request if no response is received from the RADIUS server." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.retries} placeholder={$_('aaa_radius.placeholderretries')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="CoA port" hint="UDP port for Change of Authorization (CoA) and Disconnect Messages. Standard is 3799." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.coa_port} placeholder={$_('aaa_radius.placeholdercoa_port')} />
        </label>
        <div class="flex items-end pb-0.5">
          <Button class="w-full bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveConfig()} disabled={saving || loading}>Save</Button>
        </div>
      </div>
      <div class="flex gap-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2 text-xs"><FieldLabel label="Accounting" hint="Enable or disable RADIUS accounting to track user session duration and data usage." /><Switch checked={config.accounting_enabled} onCheckedChange={(v) => (config.accounting_enabled = v)} /></div></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2 text-xs"><FieldLabel label="CoA" hint="Enable or disable Change of Authorization (CoA) support for dynamic session modification." /><Switch checked={config.coa_enabled} onCheckedChange={(v) => (config.coa_enabled = v)} /></div></div>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_radius.servers')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={draft.id} placeholder="id" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={draft.address} placeholder="address" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={draft.auth_port} placeholder="auth port" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={draft.acct_port} placeholder="acct port" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={draft.secret} placeholder="secret" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={draft.priority} placeholder="priority" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200 md:col-span-2" bind:value={draft.description} placeholder="description" />
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void addServer()} disabled={saving}>Add</Button>
      </div>
      {#each config.servers as server}
        <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
          <span>{server.id} {server.address}:{server.auth_port}/{server.acct_port} prio {server.priority}</span>
          <Button size="sm" variant="outline" class="border-red-500/60 text-red-300" onclick={() => void removeServer(server.id)}>Remove</Button>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
