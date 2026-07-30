<script lang="ts">
  type Tab = {
    id: string;
    label: string;
    icon?: any;
  };

  let { tabs, activeTab = $bindable(), onTabChange }: {
    tabs: Tab[];
    activeTab: string;
    onTabChange?: (tabId: string) => void;
  } = $props();

  function selectTab(tabId: string) {
    activeTab = tabId;
    onTabChange?.(tabId);
  }
</script>

<div class="flex gap-0.5 border-b border-slate-700 overflow-x-auto mb-4">
  {#each tabs as tab}
    <button
      type="button"
      class="flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-[0.82rem] font-medium transition-colors border-b-2 {activeTab === tab.id ? 'text-cyan-400 border-cyan-400' : 'text-slate-400 border-transparent hover:text-slate-200'}"
      onclick={() => selectTab(tab.id)}
    >
      {#if tab.icon}
        {@const Icon = tab.icon}
        <Icon class="size-3.5" />
      {/if}
      {tab.label}
    </button>
  {/each}
</div>
