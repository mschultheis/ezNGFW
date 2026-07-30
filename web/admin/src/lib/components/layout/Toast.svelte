<!-- Layout component that controls the Toast area of the admin shell. -->

<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { toasts, type ToastType } from '$lib/stores/toast';

  const colorClasses: Record<ToastType, string> = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/40 bg-red-500/10 text-red-300',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
  };
</script>

<div class="pointer-events-none fixed right-4 top-4 z-[70] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
  {#each $toasts as toast (toast.id)}
    <button
      type="button"
      class={`pointer-events-auto cursor-pointer rounded-md border px-4 py-3 text-left text-sm shadow-xl backdrop-blur ${colorClasses[toast.type]}`}
      onclick={() => toasts.dismiss(toast.id)}
      in:fly={{ y: -12, duration: 200 }}
      out:fade={{ duration: 150 }}
    >
      {toast.message}
    </button>
  {/each}
</div>
