<!-- Reusable UI primitive for tooltip provider within the admin design system. -->

<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	let { ...restProps }: TooltipPrimitive.ProviderProps = $props();
</script>

<TooltipPrimitive.Provider {...restProps} />
