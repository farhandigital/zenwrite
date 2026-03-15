<script lang="ts">
import BackupPanel from '$lib/components/BackupPanel.svelte';
import Editor from '$lib/components/Editor.svelte';
import Sidebar from '$lib/components/Sidebar.svelte';
import TableOfContents from '$lib/components/TableOfContents.svelte';
import VersionsPanel from '$lib/components/VersionsPanel.svelte';
</script>


<Sidebar />
<Editor />
<TableOfContents />
<BackupPanel />
<VersionsPanel />