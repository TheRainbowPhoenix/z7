<script>
  import { onMount, onDestroy } from 'svelte';
  import * as Plot from "@observablehq/plot";
  import * as d3 from "d3";

  let container;
  let history = [];
  let eventSource;

  // Tag metadata to classify input/output/local
  let metadata = [];

  onMount(async () => {
      // Fetch metadata first
      try {
          const mRes = await fetch('/api/metadata');
          if (mRes.ok) metadata = await mRes.json();
      } catch (e) { console.error("Metadata fetch failed", e); }

      // Fetch history
      try {
          const res = await fetch('/api/history');
          if (res.ok) history = await res.json();
      } catch (e) { console.error("History fetch failed", e); }

      // Subscribe to updates (SSE from App.svelte or new here?)
      // App.svelte has the SSE connection but doesn't pass history down.
      // We can establish our own or assume App updates us via props?
      // For simplicity, let's just listen to the same endpoint or use a shared store.
      // But here I'll just open a new SSE for simplicity to be self-contained.
      // Note: Browser has limit on concurrent SSE.
      // Better: Poll or use the `state` prop passed from App if available.
      // But `state` in App is only *current* state.
      // We need to append to history.

      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
          try {
              const state = JSON.parse(event.data);
              // Append to history
              const entry = { timestamp: Date.now(), tags: state.tags };
              history.push(entry);
              if (history.length > 3000) history.shift(); // Limit locally too
              history = history; // Trigger reactivity
          } catch (e) { }
      };
  });

  onDestroy(() => {
      if (eventSource) eventSource.close();
  });

  // Derived data for plotting
  // We need to flatten history into an array of objects { time, value, name, type }
  // This might be expensive to do every frame.
  // Observable Plot handles arrays well.

  $: if (container && history.length > 0 && metadata.length > 0) {
      renderPlot();
  }

  function renderPlot() {
      if (!container) return;

      // Transform data
      // We want to plot all tags? Or filter?
      // Let's plot all numeric/bool tags.
      const data = [];
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Filter history to last 5 mins
      const relevantHistory = history.filter(h => h.timestamp > fiveMinutesAgo);

      relevantHistory.forEach(h => {
          Object.entries(h.tags).forEach(([name, val]) => {
              // Find type
              const meta = metadata.find(m => m.name === name);
              const type = meta ? (meta.usage || 'local') : 'local';
              data.push({
                  time: new Date(h.timestamp),
                  value: Number(val),
                  name: name,
                  type: type
              });
          });
      });

      const plot = Plot.plot({
          style: { background: "transparent" },
          width: container.clientWidth,
          height: container.clientHeight || 400,
          marginLeft: 50,
          marginRight: 100, // Legend space
          x: { label: null, type: "time", domain: [new Date(fiveMinutesAgo), new Date(now)] },
          y: { grid: true },
          color: { legend: true },
          marks: [
              Plot.lineY(data, { x: "time", y: "value", stroke: "name", fx: "type" }),
              // Facet by type (Input, Output, Local)
          ],
          fx: { padding: 0.05 } // Spacing between facets
      });

      container.innerHTML = '';
      container.appendChild(plot);
  }
</script>

<div class="h-full w-full flex flex-col p-4 bg-gray-50 overflow-hidden">
  <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 shrink-0">Real-time Trends (Last 5 Minutes)</h3>
  <div class="flex-1 min-h-0 bg-white border border-gray-200 rounded shadow-sm relative p-2" bind:this={container}>
      {#if history.length === 0}
          <div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Waiting for data...</div>
      {/if}
  </div>
</div>
