<!-- Reusable UI primitive for collapsible content within the admin design system. -->

<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: CollapsiblePrimitive.ContentProps = $props();
</script>

<CollapsiblePrimitive.Content
	bind:ref
	data-slot="collapsible-content"
	class={cn(
		"overflow-hidden rounded-md border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-300 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</CollapsiblePrimitive.Content>
