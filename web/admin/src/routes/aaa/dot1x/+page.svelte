<!-- Route view for `/aaa/dot1x` in the ezNGFW admin GUI. -->

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

  type Dot1xInterface = { interface: string; mode: string; host_mode: string; mac_bypass: boolean; description: string };
  type Dot1xConfig = { enabled: boolean; auth_server: string; interfaces: Dot1xInterface[]; guest_vlan: number | null; auth_fail_vlan: number | null; reauth_period_sec: number; max_reauth_attempts: number; eap_method: string; description: string };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<Dot1xConfig>({ enabled: false, auth_server: 'radius', interfaces: [], guest_vlan: null, auth_fail_vlan: null, reauth_period_sec: 3600, max_reauth_attempts: 3, eap_method: 'peap', description: '' });
  let draft = $state<Dot1xInterface>({ interface: '', mode: 'auto', host_mode: 'single-host', mac_bypass: false, description: '' });

  async function loadAll() { loading = true; try { config = await api.get<Dot1xConfig>('/aaa/dot1x'); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load 802.1X'); } finally { loading = false; } }
  async function saveConfig() { saving = true; try { config = await api.patch<Dot1xConfig>('/aaa/dot1x', config); toasts.success($_('aaa_dot1x.toast8021x_settings_saved')); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save 802.1X'); } finally { saving = false; } }
  async function addInterface() { if (!draft.interface.trim()) return; saving = true; try { await api.post('/aaa/dot1x/interfaces', draft); draft = { interface: '', mode: 'auto', host_mode: 'single-host', mac_bypass: false, description: '' }; await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add interface'); } finally { saving = false; } }
  async function removeInterface(id: string) { saving = true; try { await api.del(`/aaa/dot1x/interfaces/${id}`); await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove interface'); } finally { saving = false; } }
  onMount(() => { void loadAll(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_dot1x.8021x')}</CardTitle></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><FieldLabel label="Enabled" hint="Enable or disable 802.1X port-based network access control." /><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div></div>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Auth Server" hint="The RADIUS server group used for 802.1X authentication." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.auth_server} placeholder="auth server" />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="EAP Method" hint="The Extensible Authentication Protocol method used for client authentication." />
          <select
                bind:value={config.eap_method}
                class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                <option value="peap">peap</option>
                <option value="eap-tls">eap-tls</option>
                <option value="eap-ttls">eap-ttls</option>
                <option value="eap-fast">eap-fast</option>
                <option value="md5">md5</option>
              </select>
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Guest VLAN" hint="VLAN assigned to unauthorized clients if no other policy applies." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.guest_vlan} placeholder="guest VLAN" />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Auth Fail VLAN" hint="VLAN assigned to clients that fail authentication." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.auth_fail_vlan} placeholder="auth fail VLAN" />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Reauth Period" hint="Time in seconds between periodic re-authentication of clients." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.reauth_period_sec} placeholder="reauth period" />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Max Attempts" hint="Maximum number of re-authentication attempts before a client is considered unauthorized." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.max_reauth_attempts} placeholder="max attempts" />
        </label>
        <div class="flex items-end pb-0.5">
          <Button class="w-full bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveConfig()} disabled={loading || saving}>Save</Button>
        </div>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_dot1x.port_policies')}</CardTitle></CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={draft.interface} placeholder="interface" />
        <select
              bind:value={draft.mode}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="auto">auto</option>
              <option value="force-authorized">force-authorized</option>
              <option value="force-unauthorized">force-unauthorized</option>
              <option value="mac-bypass">mac-bypass</option>
            </select>
        <select
              bind:value={draft.host_mode}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="single-host">single-host</option>
              <option value="multi-host">multi-host</option>
              <option value="multi-domain">multi-domain</option>
              <option value="multi-auth">multi-auth</option>
            </select>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><span>{$_('aaa_dot1x.mac_bypass')}</span><Switch checked={draft.mac_bypass} onCheckedChange={(v) => (draft.mac_bypass = v)} /></div></div>
      </div>
      <div class="flex justify-end"><Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void addInterface()} disabled={saving}>Add interface policy</Button></div>
      {#each config.interfaces as iface}
        <div class="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm">
          <span>{iface.interface} | {iface.mode} | {iface.host_mode} | MAC bypass {iface.mac_bypass ? 'on' : 'off'}</span>
          <Button size="sm" variant="outline" class="border-red-500/60 text-red-300" onclick={() => void removeInterface(iface.interface)}>Remove</Button>
        </div>
      {/each}
    </CardContent>
  </Card>
</div>
