<script>
  import { onMount, onDestroy } from 'svelte';
  import Tabs from './lib/Tabs.svelte';
  import Ladder from './lib/Ladder.svelte';
  import Tags from './lib/Tags.svelte';
  import Trend from './lib/Trend.svelte';
  import Tests from './lib/Tests.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import FileTree from './lib/FileTree.svelte';
  import {
    FilePlus, FolderOpen, Save, Share2, Undo2, Redo2, FlaskConical, Play, Square, Sidebar as SidebarIcon, FolderTree,
    Tag, FileCode, Beaker, TrendingUp
  } from 'lucide-svelte';

  let state = { status: 'stopped', cycle: 0, tags: {} };
  let metadata = []; // Tag definitions
  let eventSource;
  let showSidebar = true;
  let showFileTree = false;
  let currentFile = 'MotorControl_LD.rungs'; // Default
  let fileInput;

  // Initialize with metadata fetch
  onMount(async () => {
      await refreshMetadata();

      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
          try {
              state = JSON.parse(event.data);
          } catch (e) {
              console.error("Parse error", e);
          }
      };
  });

  onDestroy(() => {
      if (eventSource) eventSource.close();
  });

  async function refreshMetadata() {
       try {
          const res = await fetch('/api/metadata');
          if (res.ok) {
              const data = await res.json();
              metadata = data || [];
          }
      } catch (e) {
          console.error("Failed to fetch metadata", e);
      }
  }

  async function start() {
      await fetch('/api/start', { method: 'POST' });
  }

  async function stop() {
      await fetch('/api/stop', { method: 'POST' });
  }

  async function handleToggle(event) {
      const name = event.detail;
      const currentVal = state.tags[name];
      const newVal = currentVal ? 0 : 1;
      try {
          await fetch(`/api/tags/${name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: newVal })
          });
      } catch (e) {
          console.error("Toggle failed", e);
      }
  }

  // File Operations
  function triggerOpen() {
      fileInput.click();
  }

  async function handleFileSelect(e) {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      // Simple wrapper check, or raw content
      // API expects { content: "..." } if JSON, but let's try reading text content
      // Server expects JSON with `content` field.

      try {
           await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: text })
          });
          // Refresh
          await refreshMetadata();
      } catch(err) {
          console.error("Upload failed", err);
          alert("Failed to load file");
      }
  }

  function handleSave() {
      // Trigger download
      window.location.href = '/api/download';
  }

  async function handleShare() {
      try {
          const res = await fetch('/api/download');
          const text = await res.text(); // It returns JSON of .rungs
          await navigator.clipboard.writeText(text);
          alert("Logic definition copied to clipboard!");
      } catch (e) {
          console.error("Share failed", e);
      }
  }

  async function runAllTests() {
      try {
          const res = await fetch('/api/tests/run', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
          const data = await res.json();
          console.log("Test Results:", data);
          alert(`Ran ${data.results.length} tests.\nPass: ${data.results.filter(r => r.status === 'pass').length}\nFail: ${data.results.filter(r => r.status === 'fail').length}`);
      } catch (e) {
          console.error("Run tests failed", e);
      }
  }

  async function loadFileByName(name) {
      try {
          const res = await fetch(`/api/files/${name}/load`, { method: 'POST' });
          if (!res.ok) throw new Error("Load failed");
          currentFile = name;
          await refreshMetadata();
      } catch (e) {
          console.error("File load failed", e);
          alert("Failed to load file " + name);
      }
  }

</script>

<div class="h-screen w-screen flex flex-col bg-white overflow-hidden text-sm font-sans">
  <input type="file" bind:this={fileInput} on:change={handleFileSelect} class="hidden" accept=".rungs,.yaml,.yml" />

  <!-- Toolbar -->
  <header class="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-200 shadow-sm z-10 shrink-0">
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="New"><FilePlus size={18} strokeWidth={1.5} /></button>
      <button on:click={triggerOpen} class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Open"><FolderOpen size={18} strokeWidth={1.5} /></button>
      <button on:click={handleSave} class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Save"><Save size={18} strokeWidth={1.5} /></button>
      <button on:click={handleShare} class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Share"><Share2 size={18} strokeWidth={1.5} /></button>

      <div class="h-5 w-px bg-gray-300 mx-2"></div>

      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Undo"><Undo2 size={18} strokeWidth={1.5} /></button>
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Redo"><Redo2 size={18} strokeWidth={1.5} /></button>

      <div class="h-5 w-px bg-gray-300 mx-2"></div>

      <button on:click={runAllTests} class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors border border-transparent hover:border-gray-200" title="Test">
        <FlaskConical size={18} strokeWidth={1.5} />
        <span>Test</span>
      </button>

      {#if state.status === 'stopped'}
          <button on:click={start} class="flex items-center gap-2 px-3 py-1.5 hover:bg-green-50 text-green-700 font-medium rounded transition-colors ml-2" title="Start">
              <Play size={18} fill="currentColor" strokeWidth={0} />
              <span>Start</span>
          </button>
      {:else}
          <button on:click={stop} class="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-700 font-medium rounded transition-colors ml-2" title="Stop">
              <Square size={18} fill="currentColor" strokeWidth={0} />
              <span>Stop</span>
          </button>
      {/if}

      <div class="ml-auto flex items-center gap-1">
        <button on:click={() => showFileTree = !showFileTree} class="p-1.5 hover:bg-gray-100 rounded text-gray-700 {showFileTree ? 'bg-gray-100' : ''}" title="Toggle Project Explorer"><FolderTree size={18} strokeWidth={1.5} /></button>
        <button on:click={() => showSidebar = !showSidebar} class="p-1.5 hover:bg-gray-100 rounded text-gray-700 {showSidebar ? 'bg-gray-100' : ''}" title="Toggle Sidebar"><SidebarIcon size={18} strokeWidth={1.5} /></button>
      </div>
  </header>

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden">
      <!-- File Tree -->
      {#if showFileTree}
          <FileTree
              currentFile={currentFile}
              isRunning={state.status === 'running'}
              on:select={async (e) => {
                  const file = e.detail;
                  // Load file via upload
                  try {
                      // We need to fetch file content first?
                      // Or tell backend to load by path.
                      // Let's add GET /api/files/:name/load to server or just fetch content here.
                      // For now, assume backend has /api/files/:name/content or similar.
                      // I'll implement handleFileLoad(file.name).
                      await loadFileByName(file.name);
                  } catch (err) { console.error(err); }
              }}
          />
      {/if}

      <!-- Main Panel (Tabs) -->
      <div class="flex-1 flex flex-col min-w-0 bg-white relative">
          <Tabs triggers={[
              { id: 'tags', title: 'Tags' },
              { id: 'logic', title: 'Logic' },
              { id: 'tests', title: 'Tests' },
              { id: 'trend', title: 'Trend' }
          ]}>
              <div slot="content" let:value class="w-full h-full relative overflow-hidden">
                  {#if value === 'tags'}
                      <Tags tags={state.tags} metadata={metadata} on:refresh={refreshMetadata} />
                  {:else if value === 'logic'}
                      <Ladder {state} />
                  {:else if value === 'tests'}
                       <Tests />
                  {:else if value === 'trend'}
                       <Trend />
                  {/if}
              </div>
          </Tabs>
      </div>

      <!-- Right Sidebar -->
      {#if showSidebar}
        <Sidebar
            tags={state.tags}
            status={state.status}
            metadata={metadata}
            on:toggle={handleToggle}
        />
      {/if}
  </div>
</div>
