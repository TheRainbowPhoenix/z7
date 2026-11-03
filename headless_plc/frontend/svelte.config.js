import { preprocessMeltUI } from '@melt-ui/pp'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: [
    vitePreprocess(),
    preprocessMeltUI()
  ]
}
