<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let tags = {}; // Runtime values
  export let metadata = []; // Tag definitions

  let newTag = { name: '', dataType: 'DINT', usage: 'local', defaultValue: 0, description: '' };

  // Edit logic
  let editingTag = null; // { name: '...', value: '...' }

  async function addTag() {
      if (!newTag.name) return;
      try {
          const res = await fetch('/api/tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newTag)
          });
          if (res.ok) {
              dispatch('refresh');
              newTag = { name: '', dataType: 'DINT', usage: 'local', defaultValue: 0, description: '' };
          }
      } catch (e) {
          console.error("Add tag failed", e);
      }
  }

  function startEdit(tag) {
      // Only for DINT or REAL (editable numeric types)
      if (tag.dataType === 'DINT' || tag.dataType === 'REAL') {
          editingTag = { name: tag.name, value: tags[tag.name] ?? tag.defaultValue ?? 0 };
      }
  }

  async function saveEdit() {
      if (!editingTag) return;
      try {
          await fetch(`/api/tags/${editingTag.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: Number(editingTag.value) })
          });
          editingTag = null;
      } catch (e) {
          console.error("Update failed", e);
      }
  }
</script>

<div class="h-full w-full overflow-auto bg-white">
  <table class="w-full text-left text-sm border-collapse">
    <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 border-b border-gray-200 shadow-sm">
      <tr>
        <th class="px-6 py-3 font-semibold uppercase text-xs tracking-wider w-1/6">Name</th>
        <th class="px-6 py-3 font-semibold uppercase text-xs tracking-wider w-1/12">Data Type</th>
        <th class="px-6 py-3 font-semibold uppercase text-xs tracking-wider w-1/12">Usage</th>
        <th class="px-6 py-3 font-semibold uppercase text-xs tracking-wider w-1/12 text-center">Array Size</th>
        <th class="px-6 py-3 font-semibold uppercase text-xs tracking-wider w-1/12 text-center">Default Value</th>
        <th class="px-6 py-3 font-semibold uppercase text-xs tracking-wider">Description</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-100">
      {#each metadata as tag}
        <tr class="hover:bg-gray-50 transition-colors group">
          <td class="px-6 py-3 font-mono font-medium text-gray-900">{tag.name}</td>
          <td class="px-6 py-3 font-mono text-gray-600">{tag.dataType}</td>
          <td class="px-6 py-3 text-gray-600 capitalize">{tag.usage || 'Local'}</td>
          <td class="px-6 py-3 text-gray-400 font-mono text-center">{tag.dims ? tag.dims.join(',') : '–'}</td>
          <td class="px-6 py-3 text-gray-600 font-mono text-center">
              {#if (tag.dataType === 'DINT' || tag.dataType === 'REAL') && (tag.usage === 'input' || tag.usage === 'local')}
                  <button on:click={() => startEdit(tag)} class="hover:bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-bold border border-transparent hover:border-blue-300 transition-colors">
                      {tags[tag.name] ?? tag.defaultValue ?? '0'}
                  </button>
              {:else}
                  {tag.defaultValue !== undefined ? tag.defaultValue : '0'}
              {/if}
          </td>
          <td class="px-6 py-3 text-gray-500 truncate max-w-xs" title={tag.description}>{tag.description || ''}</td>
        </tr>
      {/each}

      <!-- Add Tag Row -->
      <tr class="border-t border-gray-200 bg-blue-50/20">
        <td class="px-6 py-3">
             <input type="text" bind:value={newTag.name} placeholder="Add Tag..." class="bg-transparent text-gray-900 w-full focus:outline-none placeholder-gray-400 font-medium" />
        </td>
        <td class="px-6 py-3">
             <select bind:value={newTag.dataType} class="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 w-24 focus:outline-none focus:border-blue-300">
                 <option value="BOOL">BOOL</option>
                 <option value="DINT">DINT</option>
                 <option value="REAL">REAL</option>
                 <option value="STRING">STRING</option>
             </select>
        </td>
        <td class="px-6 py-3">
             <select bind:value={newTag.usage} class="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 w-24 focus:outline-none focus:border-blue-300">
                 <option value="local">Local</option>
                 <option value="input">Input</option>
                 <option value="output">Output</option>
             </select>
        </td>
        <td class="px-6 py-3 text-gray-300 text-center text-xs">Array?</td>
        <td class="px-6 py-3">
             <input type="text" bind:value={newTag.defaultValue} class="bg-transparent text-center font-mono text-xs w-full focus:outline-none" />
        </td>
        <td class="px-6 py-3 flex items-center gap-2">
             <input type="text" bind:value={newTag.description} placeholder="Description" class="bg-transparent text-gray-500 w-full focus:outline-none placeholder-gray-300 italic text-xs" />
             <button on:click={addTag} class="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1 uppercase tracking-wide">Add</button>
        </td>
      </tr>
    </tbody>
  </table>

  {#if metadata.length === 0}
      <div class="p-12 text-center text-gray-400 text-sm">No tags defined or loading...</div>
  {/if}

  {#if editingTag}
      <div class="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div class="bg-white p-4 rounded shadow-lg w-64 flex flex-col gap-3">
              <h3 class="font-bold text-gray-700 text-sm">Edit {editingTag.name}</h3>
              <input type="number" bind:value={editingTag.value} class="border p-1 rounded w-full text-sm" autoFocus />
              <div class="flex justify-end gap-2 text-xs">
                  <button class="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded" on:click={() => editingTag = null}>Cancel</button>
                  <button class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" on:click={saveEdit}>Save</button>
              </div>
          </div>
      </div>
  {/if}
</div>
