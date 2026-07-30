<!-- Route view for `/vpn/ssl-portal` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Textarea } from '$lib/components/ui/textarea';
  import Save from '@lucide/svelte/icons/save';
  import { _ } from '$lib/i18n';

  type Bookmark = { name: string; url: string; bookmark_type: string; host: string; port: number; description: string };
  type Portal = {
    enabled: boolean;
    listen_port: number;
    certificate: string;
    authentication: string;
    user_groups: string[];
    bookmarks: Bookmark[];
    split_tunnel: boolean;
    split_tunnel_routes: string[];
    dns_servers: string[];
    idle_timeout_min: number;
    session_timeout_min: number;
    banner_message: string;
    theme: string;
    description: string;
  };

  let loading = $state(true);
  let saving = $state(false);
  let cfg = $state<Portal>({
    enabled: false,
    listen_port: 10443,
    certificate: '',
    authentication: 'local',
    user_groups: [],
    bookmarks: [],
    split_tunnel: true,
    split_tunnel_routes: [],
    dns_servers: [],
    idle_timeout_min: 30,
    session_timeout_min: 480,
    banner_message: '',
    theme: 'default',
    description: ''
  });

  const asCsv = (v: string[]) => v.join(', ');
  const fromCsv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const AUTH_OPTIONS = ['local', 'radius', 'ldap'];
  const THEME_OPTIONS = ['default', 'splash', 'custom'];

  function encodeBookmarks(v: Bookmark[]): string { return JSON.stringify(v, null, 2); }
  function decodeBookmarks(v: string): Bookmark[] {
    try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }

  async function load() {
    try { cfg = await api.get<Portal>('/vpn/ssl-portal'); }
    catch (e) { toasts.error(e instanceof Error ? e.message : 'Failed to load SSL portal'); }
    finally { loading = false; }
  }

  async function save() {
    saving = true;
    try {
      cfg = await api.patch<Portal>('/vpn/ssl-portal', cfg);
      toasts.success($_('vpn_ssl_portal.toastssl_vpn_portal_settings_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to save SSL VPN portal');
    } finally {
      saving = false;
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900">
    <CardHeader>
      <div class="flex items-center justify-between gap-3">
        <div>
          <CardTitle class="text-slate-100">{$_('vpn_ssl_portal.ssl_vpn_portal')}</CardTitle>
          <CardDescription class="text-slate-400">{$_('vpn_ssl_portal.web_portal_configuration_with_bookmarks_group_acce')}</CardDescription>
        </div>
        <Button class="bg-cyan-500 text-white hover:bg-cyan-600" onclick={save} disabled={saving || loading}><Save class="mr-2 size-4" />{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable SSL VPN web portal listener." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Split Tunnel" hint="Route only selected networks through SSL VPN tunnel." /><div class="flex h-9 items-center"><Switch checked={cfg.split_tunnel} onCheckedChange={(v) => (cfg.split_tunnel = v)} /></div></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Listen Port" hint="HTTPS listener port for the SSL VPN portal." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.listen_port} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Certificate" hint="Certificate reference presented by the SSL VPN portal." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.certificate} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Authentication" hint="Identity backend used by SSL VPN users." /><select bind:value={cfg.authentication} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each AUTH_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Theme" hint="Portal visual theme identifier for branding." /><select bind:value={cfg.theme} class="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100">{#each THEME_OPTIONS as option}<option value={option}>{option}</option>{/each}</select></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Idle Timeout (min)" hint="Terminate inactive sessions after this duration." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.idle_timeout_min} /></label>
        <label class="space-y-1 text-sm"><FieldLabel label="Session Timeout (min)" hint="Hard maximum session duration for portal users." /><Input type="number" class="border-slate-700 bg-slate-950" bind:value={cfg.session_timeout_min} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="User Groups" hint="Comma-separated user groups authorized for portal access." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.user_groups)} oninput={(e) => (cfg.user_groups = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Split Tunnel Routes" hint="Comma-separated routes pushed to SSL VPN clients." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.split_tunnel_routes)} oninput={(e) => (cfg.split_tunnel_routes = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="DNS Servers" hint="Comma-separated DNS servers provided to portal clients." /><Input class="border-slate-700 bg-slate-950" value={asCsv(cfg.dns_servers)} oninput={(e) => (cfg.dns_servers = fromCsv((e.currentTarget as HTMLInputElement).value))} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Banner Message" hint="Login banner shown to users before authentication." /><Textarea class="min-h-[90px] border-slate-700 bg-slate-950" bind:value={cfg.banner_message} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Bookmarks JSON" hint="Portal bookmark entries in JSON array format." /><Textarea class="min-h-[160px] border-slate-700 bg-slate-950 font-mono text-xs" value={encodeBookmarks(cfg.bookmarks)} oninput={(e) => (cfg.bookmarks = decodeBookmarks((e.currentTarget as HTMLTextAreaElement).value))} /></label>
        <label class="space-y-1 text-sm md:col-span-2"><FieldLabel label="Description" hint="Operational notes for this SSL VPN portal profile." /><Input class="border-slate-700 bg-slate-950" bind:value={cfg.description} /></label>
      </div>
    </CardContent>
  </Card>
</div>
