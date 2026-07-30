<!-- Route view for `/aaa/tacacs` in the ezNGFW admin GUI. -->

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

  type TacacsServer = { id: string; address: string; port: number; secret: string; priority: number; description: string };
  type TacacsConfig = { enabled: boolean; servers: TacacsServer[]; timeout_sec: number; authentication_type: string; authorization_enabled: boolean; accounting_enabled: boolean; description: string };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<TacacsConfig>({ enabled: false, servers: [], timeout_sec: 5, authentication_type: 'ascii', authorization_enabled: false, accounting_enabled: false, description: '' });
  let draft = $state<TacacsServer>({ id: '', address: '', port: 49, secret: '', priority: 1, description: '' });

  async function loadAll() { loading = true; try { config = await api.get<TacacsConfig>('/aaa/tacacs'); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load TACACS+'); } finally { loading = false; } }
  async function saveConfig() { saving = true; try { config = await api.patch<TacacsConfig>('/aaa/tacacs', config); toasts.success($_('aaa_tacacs.toasttacacs_settings_saved')); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save TACACS+'); } finally { saving = false; } }
  async function addServer() { if (!draft.id.trim() || !draft.address.trim()) return; saving = true; try { await api.post('/aaa/tacacs/servers', draft); draft = { id: '', address: '', port: 49, secret: '', priority: 1, description: '' }; await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add TACACS+ server'); } finally { saving = false; } }
  async function removeServer(id: string) { saving = true; try { await api.del(`/aaa/tacacs/servers/${id}`); await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove TACACS+ server'); } finally { saving = false; } }
  onMount(() => { void loadAll(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_tacacs.tacacs')}</CardTitle></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><FieldLabel label="Enabled" hint="Enable or disable TACACS+ authentication for the system." /><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div></div>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Auth Type" hint="The protocol used for TACACS+ authentication. ASCII is the most common." />
          <select
                bind:value={config.authentication_type}
                class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                <option value="ascii">ascii</option>
                <option value="pap">pap</option>
                <option value="chap">chap</option>
                <option value="mschap">mschap</option>
              </select>
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Timeout" hint="Maximum time in seconds to wait for a response from the TACACS+ server." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.timeout_sec} placeholder="timeout" />
        </label>
      </div>
      <div class="flex gap-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2 text-xs"><FieldLabel label="Authorization" hint="Enable or disable TACACS+ authorization to control user permissions and command access." /><Switch checked={config.authorization_enabled} onCheckedChange={(v) => (config.authorization_enabled = v)} /></div></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2 text-xs"><FieldLabel label="Accounting" hint="Enable or disable TACACS+ accounting to log user sessions and executed commands." /><Switch checked={config.accounting_enabled} onCheckedChange={(v) => (config.accounting_enabled = v)} /></div></div>
        <div class="flex items-end pb-0.5">
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveConfig()} disabled={loading || saving}>Save</Button>
        </div>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_tacacs.tacacs_servers')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-5">
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={draft.id} placeholder="id" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={draft.address} placeholder="address" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={draft.port} placeholder="port" />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={draft.priority} placeholder="priority" />
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void addServer()} disabled={saving}>Add</Button>
      </div>
      {#each config.servers as server}
        <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
          <span>{server.id} {server.address}:{server.port} prio {server.priority}</span>
          <Button size="sm" variant="outline" class="border-red-500/60 text-red-300" onclick={() => void removeServer(server.id)}>Remove</Button>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
