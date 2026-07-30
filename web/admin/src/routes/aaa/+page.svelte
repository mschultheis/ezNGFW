<!-- Route view for `/aaa` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import Save from '@lucide/svelte/icons/save';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { _ } from '$lib/i18n';

  type AaaConfig = {
    auth_order: string[];
    radius: { enabled: boolean; servers: any[] };
    ldap: { enabled: boolean; servers: any[] };
    tacacs: { enabled: boolean; servers: any[] };
    dot1x: { enabled: boolean; interfaces: any[] };
  };

  let loading = $state(true);
  let saving = $state(false);
  let config = $state<AaaConfig>({
    auth_order: ['local'],
    radius: { enabled: false, servers: [] },
    ldap: { enabled: false, servers: [] },
    tacacs: { enabled: false, servers: [] },
    dot1x: { enabled: false, interfaces: [] }
  });
  let authOrderDraft = $state('local,radius,ldap');
  let testUsername = $state('');
  let testPassword = $state('');
  let testBackend = $state('local');
  let testResult = $state('');

  async function loadAll() {
    loading = true;
    try {
      const payload = await api.get<AaaConfig>('/aaa');
      config = payload;
      authOrderDraft = (payload.auth_order ?? []).join(',');
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load AAA settings');
    } finally {
      loading = false;
    }
  }

  async function saveAll() {
    saving = true;
    try {
      const payload = { ...config, auth_order: authOrderDraft.split(',').map((x) => x.trim()).filter(Boolean) };
      config = await api.patch<AaaConfig>('/aaa', payload);
      toasts.success($_('aaa.toastaaa_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save AAA settings');
    } finally {
      saving = false;
    }
  }

  async function runTestAuth() {
    saving = true;
    try {
      const response = await api.post<{ success: boolean; backend: string; details: string }>('/aaa/test-auth', {
        username: testUsername,
        password: testPassword,
        backend: testBackend
      });
      testResult = `${response.success ? 'SUCCESS' : 'FAIL'} (${response.backend}) - ${response.details}`;
    } catch (e) {
      testResult = e instanceof Error ? e.message : 'Test failed';
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    void loadAll();
  });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <div class="flex items-start justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('aaa.aaa_authentication')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('aaa.radius_ldap_tacacs_and_8021x_policy_orchestration')}</CardDescription>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" class="border-slate-700 text-slate-200" onclick={() => void loadAll()} disabled={loading || saving}><RefreshCw class="mr-2 h-4 w-4" />Reload</Button>
          <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void saveAll()} disabled={loading || saving}><Save class="mr-2 h-4 w-4" />Save</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <a class="rounded-md border border-slate-800 bg-slate-950/60 p-3 hover:border-cyan-500" href="{base}/aaa/radius">RADIUS ({config.radius.servers.length})</a>
        <a class="rounded-md border border-slate-800 bg-slate-950/60 p-3 hover:border-cyan-500" href="{base}/aaa/ldap">LDAP ({config.ldap.servers.length})</a>
        <a class="rounded-md border border-slate-800 bg-slate-950/60 p-3 hover:border-cyan-500" href="{base}/aaa/tacacs">TACACS+ ({config.tacacs.servers.length})</a>
        <a class="rounded-md border border-slate-800 bg-slate-950/60 p-3 hover:border-cyan-500" href="{base}/aaa/dot1x">802.1X ({config.dot1x.interfaces.length})</a>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <p class="mb-2 text-sm text-slate-300">{$_('aaa.authentication_order')}</p>
          <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={authOrderDraft} placeholder="local,radius,ldap" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><span>{$_('aaa.radius_enabled')}</span><Switch checked={config.radius.enabled} onCheckedChange={(v) => (config.radius.enabled = v)} /></div></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><span>{$_('aaa.ldap_enabled')}</span><Switch checked={config.ldap.enabled} onCheckedChange={(v) => (config.ldap.enabled = v)} /></div></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><span>{$_('aaa.tacacs_enabled')}</span><Switch checked={config.tacacs.enabled} onCheckedChange={(v) => (config.tacacs.enabled = v)} /></div></div>
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-2"><div class="flex items-center justify-between text-xs"><span>802.1X enabled</span><Switch checked={config.dot1x.enabled} onCheckedChange={(v) => (config.dot1x.enabled = v)} /></div></div>
        </div>
      </div>
    </CardContent>
  </Card>

  <Card class="border-slate-800 bg-slate-900/70">
    <CardHeader>
      <CardTitle class="text-slate-100">{$_('aaa.backend_test_authentication')}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="grid gap-3 md:grid-cols-4">
        <Input class="border-slate-700 bg-slate-950 text-slate-200" bind:value={testUsername} placeholder={$_('aaa.placeholderusername')} />
        <Input class="border-slate-700 bg-slate-950 text-slate-200" type="password" bind:value={testPassword} placeholder={$_('aaa.placeholderpassword')} />
        <select
              bind:value={testBackend}
              class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="local">local</option>
              <option value="radius">radius</option>
              <option value="ldap">ldap</option>
              <option value="tacacs+">tacacs+</option>
            </select>
        <Button class="bg-cyan-600 text-white hover:bg-cyan-700" onclick={() => void runTestAuth()} disabled={saving}>Run Test</Button>
      </div>
      <p class="text-sm text-slate-300">{testResult || 'No test executed yet.'}</p>
    </CardContent>
  </Card>
</div>
