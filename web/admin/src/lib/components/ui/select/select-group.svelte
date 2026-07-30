<!-- Reusable UI primitive for select group within the admin design system. -->

<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...restProps }: SelectPrimitive.GroupProps = $props();
</script>

<SelectPrimitive.Group bind:ref data-slot="select-group" {...restProps} />
