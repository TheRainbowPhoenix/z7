<script>
  import { onMount, onDestroy } from 'svelte';
  import Tabs from './lib/Tabs.svelte';
  import Ladder from './lib/Ladder.svelte';
  import Tags from './lib/Tags.svelte';
  import Trend from './lib/Trend.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import {
    FilePlus, FolderOpen, Save, Share2, Undo2, Redo2, FlaskConical, Play, Square, Sidebar as SidebarIcon,
    Tag, FileCode, Beaker, TrendingUp
  } from 'lucide-svelte';

  let state = { status: 'stopped', cycle: 0, tags: {} };
  let metadata = []; // Tag definitions
  let eventSource;

  // Initialize with metadata fetch
  onMount(async () => {
      try {
          const res = await fetch('/api/metadata');
          if (res.ok) {
              const data = await res.json();
              metadata = data || [];
          }
      } catch (e) {
          console.error("Failed to fetch metadata", e);
      }

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
</script>

<div class="h-screen w-screen flex flex-col bg-white overflow-hidden text-sm font-sans">
  <!-- Toolbar -->
  <header class="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-200 shadow-sm z-10 shrink-0">
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="New"><FilePlus size={18} strokeWidth={1.5} /></button>
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Open"><FolderOpen size={18} strokeWidth={1.5} /></button>
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Save"><Save size={18} strokeWidth={1.5} /></button>
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Share"><Share2 size={18} strokeWidth={1.5} /></button>

      <div class="h-5 w-px bg-gray-300 mx-2"></div>

      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Undo"><Undo2 size={18} strokeWidth={1.5} /></button>
      <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700 transition-colors" title="Redo"><Redo2 size={18} strokeWidth={1.5} /></button>

      <div class="h-5 w-px bg-gray-300 mx-2"></div>

      <button class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded text-gray-700 font-medium transition-colors border border-transparent hover:border-gray-200" title="Test">
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

      <div class="ml-auto">
        <button class="p-1.5 hover:bg-gray-100 rounded text-gray-700" title="Toggle Sidebar"><SidebarIcon size={18} strokeWidth={1.5} /></button>
      </div>
  </header>

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden">
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
                      <Tags tags={state.tags} metadata={metadata} />
                  {:else if value === 'logic'}
                      <Ladder {state} />
                  {:else if value === 'tests'}
                       <div class="flex items-center justify-center h-full text-gray-400">Tests View Placeholder</div>
                  {:else if value === 'trend'}
                       <Trend {state} />
                  {/if}
              </div>
          </Tabs>
      </div>

      <!-- Right Sidebar -->
      <Sidebar
        tags={state.tags}
        status={state.status}
        metadata={metadata}
        on:toggle={handleToggle}
      />
  </div>
</div>
