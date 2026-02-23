<script>
  import { onMount, onDestroy } from 'svelte';
  import Tabs from './lib/Tabs.svelte';
  import Ladder from './lib/Ladder.svelte';
  import Tags from './lib/Tags.svelte';

  let state = { status: 'stopped', cycle: 0, tags: {} };
  let eventSource;

  onMount(() => {
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
</script>

<div class="h-screen w-screen flex flex-col bg-gray-100 overflow-hidden">
  <!-- Header -->
  <header class="bg-white shadow p-2 flex items-center gap-4 border-b border-gray-300 z-10">
      <div class="flex items-center gap-2">
          <span class="font-bold text-gray-700">PLC Simulator</span>
      </div>
      <div class="h-6 w-px bg-gray-300"></div>

      {#if state.status === 'stopped'}
          <button on:click={start} class="flex items-center gap-1 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
              Start
          </button>
      {:else}
          <button on:click={stop} class="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" /></svg>
              Stop
          </button>
      {/if}

      <div class="ml-auto flex items-center gap-4 text-xs text-gray-500">
          <div>Status: <span class="font-bold {state.status === 'running' ? 'text-green-500' : 'text-red-500'} uppercase">{state.status}</span></div>
          <div>Cycle: {state.cycle}</div>
      </div>
  </header>

  <!-- Main Content with Tabs -->
  <div class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex flex-col min-w-0">
          <Tabs triggers={[
              { id: 'logic', title: 'Ladder Logic' },
              { id: 'json', title: 'Raw State' }
          ]}>
              <div slot="content" let:value class="w-full h-full">
                  {#if value === 'logic'}
                      <Ladder {state} />
                  {:else if value === 'json'}
                      <pre class="p-4 overflow-auto text-xs">{JSON.stringify(state, null, 2)}</pre>
                  {/if}
              </div>
          </Tabs>
      </div>

      <!-- Right Sidebar for Tags -->
      <Tags tags={state.tags} />
  </div>
</div>
