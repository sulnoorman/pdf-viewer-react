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
}
