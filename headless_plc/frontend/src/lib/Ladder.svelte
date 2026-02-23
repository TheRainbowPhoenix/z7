<script>
  import { onMount } from 'svelte';

  export let state;
  let container;

  onMount(async () => {
      // Fetch initial logic HTML
      try {
          const res = await fetch('/api/logic');
          if (res.ok) {
              container.innerHTML = await res.text();
              updateVisualization(state);
          }
      } catch (e) {
          console.error("Failed to load logic", e);
      }
  });

  $: if (state && container) {
      updateVisualization(state);
  }

  function updateVisualization(currentState) {
      if (!currentState || !currentState.tags) return;
      const tags = currentState.tags;
      const elements = container.querySelectorAll('[data-tag]');

      elements.forEach(el => {
          const tagName = el.getAttribute('data-tag');
          const type = el.getAttribute('data-instruction-type');
          const val = tags[tagName];

          let active = false;
          if (val !== undefined) {
              if (type === 'XIO') {
                  active = (val === 0);
              } else {
                  active = (val !== 0);
              }
          }

          const replaceClass = (node, from, to, add) => {
              if (node.classList && node.classList.contains(from)) {
                  if (add) {
                      if (active) {
                          node.classList.remove(from);
                          node.classList.add(to);
                      } else {
                          node.classList.add(from);
                          node.classList.remove(to);
                      }
                  }
              }
              for (let i = 0; i < node.children.length; i++) {
                  replaceClass(node.children[i], from, to, add);
              }
          };

          replaceClass(el, 'bg-slate-400', 'bg-green-500', true);
          replaceClass(el, 'border-slate-400', 'border-green-500', true);

          const text = el.querySelector('p');
          if (text) {
              if (active) {
                  text.classList.remove('text-black');
                  text.classList.add('text-green-700', 'font-bold');
              } else {
                  text.classList.add('text-black');
                  text.classList.remove('text-green-700', 'font-bold');
              }
          }
      });
  }
</script>

<div bind:this={container} class="w-full h-full overflow-auto p-4 bg-gray-50">
  Loading Logic...
</div>
