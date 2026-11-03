<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Folder, FileCode, ChevronRight, ChevronDown, PlayCircle } from 'lucide-svelte';

  const dispatch = createEventDispatcher();
  export let currentFile = '';
  export let isRunning = false;

  let files = [];
  let expanded = true;

  onMount(async () => {
      await refreshFiles();
  });

  async function refreshFiles() {
      try {
          const res = await fetch('/api/files');
          if (res.ok) {
              const data = await res.json(); // Expecting array of { name: '...', path: '...' }
              files = data.map(f => ({ ...f, type: 'file' }));
          }
      } catch (e) {
          console.error("Failed to fetch files", e);
      }
  }

  function selectFile(file) {
      dispatch('select', file);
  }
</script>

<div class="flex flex-col h-full bg-gray-50 border-r border-gray-200 w-64 text-sm shrink-0">
  <div class="p-2 border-b border-gray-200 flex items-center font-bold text-gray-700">
      <span class="ml-2">Project Explorer</span>
      <button class="ml-auto p-1 hover:bg-gray-200 rounded" on:click={refreshFiles} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
      </button>
  </div>

  <div class="flex-1 overflow-auto p-2">
      <!-- Root Folder -->
      <div>
          <button
              class="flex items-center gap-1 w-full hover:bg-gray-200 px-1 py-0.5 rounded text-left"
              on:click={() => expanded = !expanded}
          >
              {#if expanded}
                  <ChevronDown size={14} />
              {:else}
                  <ChevronRight size={14} />
              {/if}
              <Folder size={14} class="text-blue-500" />
              <span class="font-medium">examples</span>
          </button>

          {#if expanded}
              <div class="pl-4 mt-1 space-y-0.5">
                  {#each files as file}
                      <button
                          class="flex items-center gap-2 w-full hover:bg-blue-50 px-1 py-1 rounded text-left group {currentFile === file.name ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600'}"
                          on:click={() => selectFile(file)}
                      >
                          <FileCode size={14} class="shrink-0" />
                          <span class="truncate flex-1">{file.name}</span>
                          {#if currentFile === file.name && isRunning}
                              <PlayCircle size={12} class="text-green-500 shrink-0 animate-pulse" />
                          {/if}
                      </button>
                  {/each}
                  {#if files.length === 0}
                      <div class="text-gray-400 italic text-xs pl-2">No files found</div>
                  {/if}
              </div>
          {/if}
      </div>
  </div>
</div>
