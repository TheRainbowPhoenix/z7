<script>
  export let tags = {};

  async function toggleTag(name) {
      const currentVal = tags[name];
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

<div class="flex flex-col h-full bg-white border-l border-gray-200 w-80">
  <div class="p-4 border-b border-gray-200 font-bold text-gray-700">Tags</div>
  <div class="flex-1 overflow-auto p-4 space-y-2">
      {#each Object.entries(tags).sort((a,b) => a[0].localeCompare(b[0])) as [name, val]}
          <div class="flex items-center justify-between text-sm py-1 border-b border-gray-100">
              <span class="font-mono text-gray-700">{name}</span>
              <div class="flex items-center gap-2">
                  <span class="text-gray-400 text-xs">{val}</span>
                  <button
                      class="w-8 h-4 rounded-full relative transition-colors focus:outline-none {val ? 'bg-green-500' : 'bg-gray-200'}"
                      on:click={() => toggleTag(name)}
                  >
                      <div class="w-4 h-4 bg-white rounded-full shadow absolute top-0 left-0 transition-transform {val ? 'translate-x-4' : ''}"></div>
                  </button>
              </div>
          </div>
      {/each}
  </div>
</div>
