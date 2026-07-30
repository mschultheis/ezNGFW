<!-- Route view for `/aaa/ldap` in the ezNGFW admin GUI. -->

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

  type LdapServer = { id: string; address: string; port: number; priority: number; description: string };
  type LdapConfig = { enabled: boolean; servers: LdapServer[]; base_dn: string; bind_dn: string; bind_password: string; user_search_filter: string; group_search_filter: string; user_attribute: string; group_attribute: string; tls_enabled: boolean; tls_verify: boolean; tls_ca_certificate: string; timeout_sec: number; description: string };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<LdapConfig>({ enabled: false, servers: [], base_dn: '', bind_dn: '', bind_password: '', user_search_filter: '(uid={username})', group_search_filter: '(memberUid={username})', user_attribute: 'uid', group_attribute: 'cn', tls_enabled: false, tls_verify: true, tls_ca_certificate: '', timeout_sec: 5, description: '' });
  let draft = $state<LdapServer>({ id: '', address: '', port: 389, priority: 1, description: '' });

  async function loadAll() { loading = true; try { config = await api.get<LdapConfig>('/aaa/ldap'); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load LDAP'); } finally { loading = false; } }
  async function saveConfig() { saving = true; try { config = await api.patch<LdapConfig>('/aaa/ldap', config); toasts.success($_('aaa_ldap.toastldap_settings_saved')); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to save LDAP'); } finally { saving = false; } }
  async function addServer() { if (!draft.id.trim() || !draft.address.trim()) return; saving = true; try { await api.post('/aaa/ldap/servers', draft); draft = { id: '', address: '', port: 389, priority: 1, description: '' }; await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to add LDAP server'); } finally { saving = false; } }
  async function removeServer(id: string) { saving = true; try { await api.del(`/aaa/ldap/servers/${id}`); await loadAll(); } catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to remove LDAP server'); } finally { saving = false; } }
  onMount(() => { void loadAll(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_ldap.ldap')}</CardTitle></CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><FieldLabel label="Enabled" hint="Enable or disable LDAP authentication for the system." /><Switch checked={config.enabled} onCheckedChange={(v) => (config.enabled = v)} /></div></div>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Base DN" hint="Root search path in the LDAP directory tree. All user and group queries start from this node." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.base_dn} placeholder={$_('aaa_ldap.placeholderbase_dn')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Bind DN" hint="Distinguished name used to authenticate with the LDAP server before performing lookups." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.bind_dn} placeholder={$_('aaa_ldap.placeholderbind_dn')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Bind password" hint="Password for the Bind DN account used to authenticate with the LDAP server." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="password" bind:value={config.bind_password} placeholder={$_('aaa_ldap.placeholderbind_password')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="User filter" hint="LDAP search filter used to locate user objects. Use &#123;username&#125; as a placeholder for the login name." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.user_search_filter} placeholder={$_('aaa_ldap.placeholderuser_filter')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Group filter" hint="LDAP search filter used to locate group objects. Use &#123;username&#125; as a placeholder for the user's login name." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.group_search_filter} placeholder={$_('aaa_ldap.placeholdergroup_filter')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="User attr" hint="The LDAP attribute that contains the user's unique identifier, typically 'uid' or 'sAMAccountName'." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.user_attribute} placeholder={$_('aaa_ldap.placeholderuser_attr')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Group attr" hint="The LDAP attribute that contains the group name, typically 'cn'." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={config.group_attribute} placeholder={$_('aaa_ldap.placeholdergroup_attr')} />
        </label>
        <label class="space-y-1 text-sm">
          <FieldLabel label="Timeout" hint="Maximum time in seconds to wait for a response from the LDAP server." />
          <Input class="border-slate-700 bg-slate-950 text-slate-200" type="number" bind:value={config.timeout_sec} placeholder="timeout" />
        </label>
      </div>
      <div class="flex gap-3">
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2 text-xs"><FieldLabel label="TLS enabled" hint="Use LDAPS or STARTTLS to encrypt the connection to the LDAP server." /><Switch checked={config.tls_enabled} onCheckedChange={(v) => (config.tls_enabled = v)} /></div></div>
        <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between gap-2 text-xs"><FieldLabel label="TLS verify" hint="Verify the LDAP server's TLS certificate against the configured CA certificate." /><Switch checked={config.tls_verify} onCheckedChange={(v) => (config.tls_verify = v)} /></div></div>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveConfig()} disabled={loading || saving}>Save</Button>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader><CardTitle class="text-slate-100">{$_('aaa_ldap.ldap_servers')}</CardTitle></CardHeader>
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
