<!-- Reusable UI primitive for collapsible trigger within the admin design system. -->

<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: CollapsiblePrimitive.TriggerProps = $props();
</script>

<CollapsiblePrimitive.Trigger
	bind:ref
	data-slot="collapsible-trigger"
	class={cn(
		"flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-slate-600 hover:bg-slate-900/80",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</CollapsiblePrimitive.Trigger>
