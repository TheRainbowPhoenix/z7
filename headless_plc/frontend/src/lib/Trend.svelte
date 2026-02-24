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

  // Plotting Logic
  $: if (container && history.length > 0 && metadata.length > 0) {
      renderPlot();
  }

  function renderPlot() {
      if (!container) return;

      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      // Filter history
      const relevantHistory = history.filter(h => h.timestamp > fiveMinutesAgo);

      // Transform for Plot: One long array?
      // Plot.plot with 'fy' (facet y) stacks them vertically.
      // We want distinct full-width plots. Observable Plot's facet is one SVG.
      // If we want them stacked vertically and scrollable, we might need multiple plots or one tall plot.
      // User said: "not one large plot that's cut on its width, but rather a lot of small height full width plots"
      // Facet Y does this in one SVG. If we have 20 tags, it might be tall.

      const data = [];
      relevantHistory.forEach(h => {
          Object.entries(h.tags).forEach(([name, val]) => {
              // Filter to numeric/bool
              // Also maybe only relevant tags?
              // Plot all for now.
              data.push({
                  time: new Date(h.timestamp),
                  value: Number(val),
                  name: name
              });
          });
      });

      const plot = Plot.plot({
          style: { background: "transparent", width: "100%" },
          width: container.clientWidth,
          // height: null, // Auto height based on facets?
          marginLeft: 100,
          marginRight: 20,
          x: { label: null, type: "time", domain: [new Date(fiveMinutesAgo), new Date(now)] },
          y: { grid: true, label: null },
          fy: { label: null, domain: data.map(d => d.name).sort() }, // Facet by tag name
          marks: [
              Plot.frame(),
              Plot.lineY(data, { x: "time", y: "value", stroke: "name", fy: "name" }),
              Plot.text(data, Plot.selectLast({ x: "time", y: "value", z: "name", text: "value", dx: 5, fy: "name" }))
          ]
      });

      container.innerHTML = '';
      container.appendChild(plot);
  }
</script>

<div class="h-full w-full flex flex-col bg-white overflow-hidden">
  <div class="flex-1 overflow-auto p-4" bind:this={container}>
      {#if history.length === 0}
          <div class="flex items-center justify-center h-full text-gray-400 text-xs">Waiting for data...</div>
      {/if}
  </div>
</div>
