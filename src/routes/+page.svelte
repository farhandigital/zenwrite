<script lang="ts">
import Editor from '$lib/components/Editor.svelte';
import SettingsPanel from '$lib/components/SettingsPanel.svelte';
import Sidebar from '$lib/components/Sidebar.svelte';
import TableOfContents from '$lib/components/TableOfContents.svelte';
</script>

<svelte:head>
	<title>ZenWrite - Minimal Markdown Editor</title>
</svelte:head>

<Sidebar />
<Editor />
<SettingsPanel />
<TableOfContents />
