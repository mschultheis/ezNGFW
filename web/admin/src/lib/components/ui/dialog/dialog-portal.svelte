<!-- Reusable UI primitive for dialog portal within the admin design system. -->

<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";

	let { ...restProps }: DialogPrimitive.PortalProps = $props();
</script>

<DialogPrimitive.Portal {...restProps} />
