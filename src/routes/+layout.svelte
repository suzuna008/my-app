<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import { initAuth } from '$lib/stores/auth';

	let { children } = $props();

	const { PUBLIC_GOOGLE_MAPS_API_KEY } = env;

	onMount(() => {
		initAuth();
	});
</script>

<svelte:head>
	<script src="https://maps.googleapis.com/maps/api/js?key={PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places"></script>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
