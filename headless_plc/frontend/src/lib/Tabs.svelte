<script>
  import { createTabs, melt } from '@melt-ui/svelte';
  import { cubicInOut } from 'svelte/easing';
  import { crossfade } from 'svelte/transition';
  import { cn } from './utils';

  export let triggers = [];
  export let className = '';

  const {
    elements: { root, list, content, trigger },
    states: { value },
  } = createTabs({
    defaultValue: triggers[0]?.id,
  });

  const [send, receive] = crossfade({
    duration: 250,
    easing: cubicInOut,
  });
</script>

<div
  use:melt={$root}
  class="flex w-full h-full flex-col overflow-hidden shadow-lg data-[orientation=vertical]:flex-row {className}"
>
  <div
    use:melt={$list}
    class="flex shrink-0 overflow-x-auto bg-neutral-100 border-b border-gray-200"
  >
    {#each triggers as triggerItem}
      <button use:melt={$trigger(triggerItem.id)} class="trigger relative px-6 py-3 font-medium text-sm text-gray-600 hover:text-gray-900 focus:outline-none">
        {triggerItem.title}
        {#if $value === triggerItem.id}
          <div
            in:send={{ key: 'trigger' }}
            out:receive={{ key: 'trigger' }}
            class="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"
          />
        {/if}
      </button>
    {/each}
  </div>

  <div class="flex-1 overflow-hidden relative">
      <slot name="content" value={$value}></slot>
  </div>
</div>

<style>
  .trigger[data-state='active'] {
    color: #2563eb; /* blue-600 */
    font-weight: 600;
  }
</style>
