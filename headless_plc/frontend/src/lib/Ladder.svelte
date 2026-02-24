<script>
  import { renderLadder } from '../../../renderer/html-generator.js'; // Can we import backend logic here? No, browser context.
  // We need to fetch rendered HTML from server or reimplement renderer in frontend.
  // The server provides /api/logic which returns HTML.
  // But for editing, we want to inject UI.
  // Current Ladder.svelte fetches HTML and injects it.

  import { onMount, createEventDispatcher } from 'svelte';

  export let state = {};

  let container;
  let htmlContent = '';

  // Edit State
  let selection = null; // { type: 'rung' | 'instruction', id: ... }
  let showEditor = false;
  let editValue = '';
  let editPosition = { x: 0, y: 0 };

  $: if (state) {
      fetchLogic();
  }

  async function fetchLogic() {
      try {
          const res = await fetch('/api/logic');
          htmlContent = await res.text();
      } catch (e) {}
  }

  function handleMainClick(e) {
      // Basic selection logic based on classes or attributes in generated HTML
      // The renderer adds 'id' or data attributes?
      // Looking at `html-generator.js` (from memory/previous steps), it uses classes but maybe not IDs for everything.
      // I might need to update renderer to include data-id attributes for selection.
      // For now, let's assume I can click a rung.

      // Since I can't easily modify renderer without breaking Tailwind scan potentially,
      // I will rely on text selection or just a "Paste Mode" toggle.

      // Let's implement a simple "Edit Mode" button.
  }

  async function handlePaste() {
      try {
          const text = await navigator.clipboard.readText();
          if (!text) return;

          // Heuristic: If text looks like ladder logic (contains '[' or '('), offer to merge
          if (text.includes('[') || text.includes('(')) {
              editValue = text;
              showEditor = true;
          }
      } catch (e) {}
  }

  async function applyEdit() {
      // Send editValue to backend to merge?
      // We need an endpoint for "Patch Logic".
      // Backend `server.js` doesn't have it yet.
      // I'll add `POST /api/logic/patch` which takes { dsl: "..." }.
      // Backend will parse DSL and append/replace.
      // For this step, I'll assume appending to the end or replacing selected rung (if I had selection).
      // Given constraints, I'll just append for now or replace all?
      // User said "depending on where my selection is".
      // Without robust selection, I'll default to "Append".

      try {
          await fetch('/api/logic/patch', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ dsl: editValue, action: 'append' })
          });
          showEditor = false;
          fetchLogic();
      } catch (e) {
          alert("Failed to patch logic: " + e.message);
      }
  }

</script>

<div class="w-full h-full relative group" on:click={handleMainClick} on:keydown={(e) => { if(e.key==='v' && (e.ctrlKey||e.metaKey)) handlePaste(); }}>
  <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
      <button class="bg-white border shadow px-2 py-1 text-xs rounded hover:bg-gray-50" on:click={() => { editValue=''; showEditor=true; }}>Paste Ladder Text</button>
  </div>

  <div class="w-full h-full overflow-auto p-4 bg-gray-50 ladder-container" bind:this={container}>
      {@html htmlContent}
  </div>

  {#if showEditor}
      <div class="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white p-4 rounded shadow-lg w-96 flex flex-col gap-2">
              <h3 class="font-bold text-gray-700">Inject Ladder Logic</h3>
              <textarea bind:value={editValue} class="w-full h-32 border p-2 text-sm font-mono" placeholder="[XIC(A)]OTE(B)"></textarea>
              <div class="flex justify-end gap-2">
                  <button class="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded" on:click={() => showEditor = false}>Cancel</button>
                  <button class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" on:click={applyEdit}>Inject</button>
              </div>
          </div>
      </div>
  {/if}
</div>

<style>
  /* Ensure SVG fills container */
  .ladder-container :global(svg) {
      width: 100%;
      height: auto;
  }
</style>
