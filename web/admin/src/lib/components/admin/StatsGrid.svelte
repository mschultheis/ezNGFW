<!-- Administrative component that powers the StatsGrid workflow in the ezNGFW GUI. -->

<script lang="ts">
  import { Card, CardContent } from '$lib/components/ui/card';
  import { asString } from '$lib/utils/api-data';

  let {
    title = 'Stats',
    values
  }: {
    title?: string;
    values: Array<{ label: string; value: unknown; tone?: 'default' | 'success' | 'danger' | 'warning' }>;
  } = $props();

  const tones = {
    default: 'text-slate-100',
    success: 'text-emerald-400',
    danger: 'text-red-400',
    warning: 'text-amber-400'
  };
</script>

<div class="space-y-3">
  <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {#each values as stat}
      <Card class="border-slate-800 bg-slate-900">
        <CardContent class="py-4">
          <p class="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
          <p class={`mt-2 text-xl font-semibold ${tones[stat.tone ?? 'default']}`}>{asString(stat.value)}</p>
        </CardContent>
      </Card>
    {/each}
  </div>
</div>
