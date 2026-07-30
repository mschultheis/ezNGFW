<!-- Route view for `/antivirus` in the ezNGFW admin GUI. -->

<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import FieldLabel from '$lib/components/admin/FieldLabel.svelte';
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { _ } from '$lib/i18n';

  type AntivirusConfig = { enabled: boolean; engine: string; scan_http: boolean; scan_smtp: boolean; scan_ftp: boolean; max_file_size_mb: number; max_scan_time_sec: number; quarantine_enabled: boolean; quarantine_path: string; auto_update: boolean; update_interval_hours: number; last_signature_update: string; signature_count: number; description: string };

  let cfg = $state<AntivirusConfig>({ enabled: false, engine: 'clamav', scan_http: true, scan_smtp: true, scan_ftp: true, max_file_size_mb: 100, max_scan_time_sec: 30, quarantine_enabled: true, quarantine_path: '/var/lib/ezngfw/quarantine', auto_update: true, update_interval_hours: 4, last_signature_update: '', signature_count: 0, description: '' });
  let status = $state<Record<string, unknown>>({});


  /** Convert snake_case keys to Title Case labels. */
  function formatLabel(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Format a status value for human-readable display. */
  function formatStatusValue(value: unknown): string {
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string' && value !== '') return value;
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    return String(value ?? '—');
  }

  async function load() {
    try {
      cfg = await api.get('/antivirus') as AntivirusConfig;
      status = await api.get('/antivirus/status') as Record<string, unknown>;
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Failed to load antivirus');
    }
  }

  async function save() {
    try {
      await api.patch('/antivirus', cfg);
      toasts.success($_('antivirus.toastantivirus_saved'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function updateSignatures() {
    try {
      await api.post('/antivirus/update-signatures', {});
      await load();
      toasts.success($_('antivirus.toastsignature_update_requested'));
    } catch (e) {
      toasts.error(e instanceof Error ? e.message : 'Update failed');
    }
  }

  onMount(() => { void load(); });
</script>

<div class="space-y-6">
  <Card class="border-slate-800 bg-slate-900"><CardHeader><CardTitle class="text-slate-100">{$_('antivirus.antivirus_clamav')}</CardTitle><CardDescription class="text-slate-400">{$_('antivirus.inline_httpsmtpftp_scanning_quarantine_controls_an')}</CardDescription></CardHeader><CardContent><form class="space-y-4" onsubmit={(e) => { e.preventDefault(); void save(); }}><div class="grid gap-4 md:grid-cols-3"><label class="space-y-1 text-sm"><FieldLabel label="Enabled" hint="Enable antivirus scanning service." /><div class="flex h-9 items-center"><Switch checked={cfg.enabled} onCheckedChange={(v) => (cfg.enabled = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Scan HTTP" hint="Scan web downloads and HTTP payloads." /><div class="flex h-9 items-center"><Switch checked={cfg.scan_http} onCheckedChange={(v) => (cfg.scan_http = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Scan SMTP" hint="Scan mail attachments and SMTP content." /><div class="flex h-9 items-center"><Switch checked={cfg.scan_smtp} onCheckedChange={(v) => (cfg.scan_smtp = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Scan FTP" hint="Scan FTP uploads/downloads." /><div class="flex h-9 items-center"><Switch checked={cfg.scan_ftp} onCheckedChange={(v) => (cfg.scan_ftp = v)} /></div></label><label class="space-y-1 text-sm"><FieldLabel label="Max File Size (MB)" hint="Files above this threshold bypass scanning." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.max_file_size_mb)} oninput={(e) => (cfg.max_file_size_mb = Number((e.currentTarget as HTMLInputElement).value || 100))} /></label><label class="space-y-1 text-sm"><FieldLabel label="Update Interval (hours)" hint="Schedule interval for signature updates." /><Input class="border-slate-700 bg-slate-950" type="number" value={String(cfg.update_interval_hours)} oninput={(e) => (cfg.update_interval_hours = Number((e.currentTarget as HTMLInputElement).value || 4))} /></label></div><div class="flex gap-2"><Button type="submit">Save</Button><Button type="button" variant="outline" class="border-slate-700" onclick={() => void updateSignatures()}>Update Signatures</Button></div></form></CardContent></Card>

  <Card class="border-slate-800 bg-slate-900">
    <CardHeader><CardTitle class="text-slate-100">{$_('antivirus.service_status')}</CardTitle></CardHeader>
    <CardContent>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each Object.entries(status) as [key, value]}
          <div class="rounded border border-slate-800 bg-slate-950 p-3">
            <p class="text-xs text-slate-400">{formatLabel(key)}</p>
            <p class="mt-1 text-sm font-medium {typeof value === 'boolean' ? (value ? 'text-emerald-400' : 'text-red-400') : 'text-slate-100'}">
              {formatStatusValue(value)}
            </p>
          </div>
        {/each}
      </div>
    </CardContent>
  </Card>
</div>
