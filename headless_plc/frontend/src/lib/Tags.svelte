<script>
  export let tags = {}; // Runtime values
  export let metadata = []; // Tag definitions
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
          <td class="px-6 py-3 text-gray-600 font-mono text-center">{tag.defaultValue !== undefined ? tag.defaultValue : '0'}</td>
          <td class="px-6 py-3 text-gray-500 truncate max-w-xs" title={tag.description}>{tag.description || ''}</td>
        </tr>
      {/each}

      <!-- Add Tag Row Placeholder -->
      <tr class="border-t border-gray-200 bg-gray-50/30">
        <td class="px-6 py-3">
             <input type="text" placeholder="Add Tag..." class="bg-transparent text-gray-500 w-full focus:outline-none placeholder-gray-400 italic" disabled />
        </td>
        <td class="px-6 py-3">
             <div class="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-400 w-20 flex items-center justify-between">DINT <span class="text-[10px] opacity-50">▼</span></div>
        </td>
        <td class="px-6 py-3">
             <div class="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-400 w-20 flex items-center justify-between">Local <span class="text-[10px] opacity-50">▼</span></div>
        </td>
        <td class="px-6 py-3 text-gray-300 text-center text-xs">Array?</td>
        <td class="px-6 py-3 text-gray-400 text-center font-mono text-xs">0</td>
        <td class="px-6 py-3 text-gray-300 italic text-xs">Description</td>
      </tr>
    </tbody>
  </table>

  {#if metadata.length === 0}
      <div class="p-12 text-center text-gray-400 text-sm">No tags defined or loading...</div>
  {/if}
</div>
