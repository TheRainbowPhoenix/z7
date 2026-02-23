<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let tags = {}; // { StartButton: 0, ... }
  export let status = 'stopped';
  export let metadata = []; // [ { name: 'StartButton', usage: 'input' }, ... ]

  let activeTab = 'All';
  const tabs = ['All', 'Inputs', 'Outputs', 'Local'];

  // Filter helpers
  $: inputs = metadata.filter(t => t.usage === 'input');
  $: outputs = metadata.filter(t => t.usage === 'output');
  $: locals = metadata.filter(t => t.usage === 'local' || !t.usage); // Default to local if undefined

  // For specific tab view
  $: filteredTags = metadata.filter(tag => {
      if (activeTab === 'All') return true; // Handled separately
      if (activeTab === 'Inputs') return tag.usage === 'input';
      if (activeTab === 'Outputs') return tag.usage === 'output';
      if (activeTab === 'Local') return tag.usage === 'local' || !tag.usage;
      return false;
  });

  function toggle(name) {
    dispatch('toggle', name);
  }
</script>

<div class="flex flex-col h-full bg-gray-50 border-l border-gray-200 w-80 text-sm shrink-0">
  <!-- Simulation Status -->
  <div class="p-4 border-b border-gray-200">
    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Simulation Status</div>
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full {status === 'running' ? 'bg-red-500 animate-pulse' : 'bg-red-500'}"></div> <!-- Wait, usually green for running -->
      <!-- The image shows STOPPED in red. I'll stick to that convention. Running usually green. -->
      {#if status === 'running'}
        <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        <span class="font-mono font-bold text-green-600 uppercase">RUNNING</span>
      {:else}
        <div class="w-2 h-2 rounded-full bg-red-500"></div>
        <span class="font-mono font-bold text-red-600 uppercase">STOPPED</span>
      {/if}
    </div>
  </div>

  <!-- Tags View Tabs -->
  <div class="px-4 pt-4">
    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags View</div>
    <div class="flex space-x-4 border-b border-gray-200">
      {#each tabs as tab}
        <button
          class="pb-2 text-xs font-medium transition-colors border-b-2 {activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
          on:click={() => activeTab = tab}
        >
          {tab}
        </button>
      {/each}
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-auto p-4 space-y-6">
    {#if activeTab === 'All'}
       <!-- Inputs Group -->
       {#if inputs.length > 0}
         <div>
           <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Inputs</div>
           <div class="bg-white rounded border border-gray-200 divide-y divide-gray-100">
             {#each inputs as tag}
               <div class="flex items-center justify-between p-2 px-3 h-10">
                 <span class="font-medium text-gray-700 text-xs">{tag.name}</span>
                 <!-- Switch -->
                 <button
                   class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none {tags[tag.name] ? 'bg-blue-500' : 'bg-gray-200'}"
                   on:click={() => toggle(tag.name)}
                 >
                   <span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {tags[tag.name] ? 'translate-x-5' : 'translate-x-1'}"/>
                 </button>
               </div>
             {/each}
           </div>
         </div>
       {/if}

       <!-- Outputs Group -->
       {#if outputs.length > 0}
         <div>
           <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Outputs</div>
           <div class="bg-white rounded border border-gray-200 divide-y divide-gray-100">
             {#each outputs as tag}
               <div class="flex items-center justify-between p-2 px-3 h-10">
                 <span class="font-medium text-gray-700 text-xs">{tag.name}</span>
                 <span class="font-mono text-gray-600 text-xs">{tags[tag.name] ?? 0}</span>
               </div>
             {/each}
           </div>
         </div>
       {/if}

       <!-- Locals Group -->
       {#if locals.length > 0}
         <div>
             <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Local</div>
             <div class="bg-white rounded border border-gray-200 divide-y divide-gray-100">
               {#each locals as tag}
                 <div class="flex items-center justify-between p-2 px-3 h-10">
                   <span class="font-medium text-gray-700 text-xs">{tag.name}</span>
                   <span class="font-mono text-gray-600 text-xs">{tags[tag.name] ?? 0}</span>
                 </div>
               {/each}
             </div>
         </div>
       {/if}

    {:else}
       <!-- Filtered List -->
       <div class="bg-white rounded border border-gray-200 divide-y divide-gray-100">
         {#each filteredTags as tag}
            <div class="flex items-center justify-between p-2 px-3 h-10">
                 <span class="font-medium text-gray-700 text-xs">{tag.name}</span>
                 {#if tag.usage === 'input'}
                    <button
                       class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none {tags[tag.name] ? 'bg-blue-500' : 'bg-gray-200'}"
                       on:click={() => toggle(tag.name)}
                     >
                       <span class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {tags[tag.name] ? 'translate-x-5' : 'translate-x-1'}"/>
                     </button>
                 {:else}
                    <span class="font-mono text-gray-600 text-xs">{tags[tag.name] ?? 0}</span>
                 {/if}
            </div>
         {/each}
       </div>
    {/if}
  </div>
</div>
