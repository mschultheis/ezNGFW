<script lang="ts">
  let { status, label }: { status: string; label?: string } = $props();

  const statusMap: Record<string, { classes: string; text: string }> = {
    'true': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Enabled' },
    'enabled': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Enabled' },
    'running': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Running' },
    'up': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Up' },
    'active': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Active' },
    'online': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Online' },
    'connected': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Connected' },
    'success': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Success' },
    'ok': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'OK' },
    'healthy': { classes: 'bg-emerald-900/15 text-emerald-400 border-emerald-500/30', text: 'Healthy' },
    'false': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Disabled' },
    'disabled': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Disabled' },
    'stopped': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Stopped' },
    'down': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Down' },
    'inactive': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Inactive' },
    'offline': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Offline' },
    'error': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Error' },
    'failed': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Failed' },
    'fail': { classes: 'bg-red-900/15 text-red-400 border-red-500/30', text: 'Fail' },
    'warning': { classes: 'bg-amber-900/15 text-amber-400 border-amber-500/30', text: 'Warning' },
    'degraded': { classes: 'bg-amber-900/15 text-amber-400 border-amber-500/30', text: 'Degraded' },
    'pending': { classes: 'bg-amber-900/15 text-amber-400 border-amber-500/30', text: 'Pending' },
    'idle': { classes: 'bg-amber-900/15 text-amber-400 border-amber-500/30', text: 'Idle' },
    'waiting': { classes: 'bg-amber-900/15 text-amber-400 border-amber-500/30', text: 'Waiting' },
    'checking': { classes: 'bg-cyan-900/15 text-cyan-400 border-cyan-500/30', text: 'Checking' },
    'downloading': { classes: 'bg-cyan-900/15 text-cyan-400 border-cyan-500/30', text: 'Downloading' },
    'installing': { classes: 'bg-cyan-900/15 text-cyan-400 border-cyan-500/30', text: 'Installing' },
  };

  const normalized = $derived(String(status).toLowerCase());
  const config = $derived(statusMap[normalized] ?? { classes: 'bg-slate-700/15 text-slate-400 border-slate-500/30', text: String(status) });
  const displayText = $derived(label ?? config.text);
</script>

<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {config.classes}">
  {displayText}
</span>
