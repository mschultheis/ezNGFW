<!-- Reusable UI primitive for collapsible within the admin design system. -->

<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		open = $bindable(false),
		class: className,
		children,
		...restProps
	}: CollapsiblePrimitive.RootProps = $props();
</script>

<CollapsiblePrimitive.Root bind:ref bind:open class={cn("space-y-3", className)} {...restProps}>
	{@render children?.()}
</CollapsiblePrimitive.Root>
