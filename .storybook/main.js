import { devWorkerPlugin } from '../scripts/dev-worker-plugin.mjs'

/** @type {import('@storybook/react-vite').StorybookConfig} */
export default {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Stories load the sample PDF and signature from here.
  staticDirs: ['../public'],
  docs: {
    defaultName: 'Docs',
  },
  /**
   * The stories import from `src/`, where the pdf.js worker does not exist — it is copied
   * next to the bundle at build time. Without this, every story fails to open a document.
   */
  viteFinal: (config) => {
    config.plugins = [...(config.plugins ?? []), devWorkerPlugin()]
    return config
  },
}
