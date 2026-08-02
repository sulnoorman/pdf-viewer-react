/**
 * The viewer fills its container, so every story needs a sized parent — otherwise it
 * collapses to nothing and looks broken. This is also the first thing a reader learns
 * about integrating it.
 */
const withViewerFrame = (Story) => (
  <div style={{ height: '80vh', minHeight: 520, display: 'flex' }}>
    <Story />
  </div>
)

/** @type {import('@storybook/react-vite').Preview} */
const preview = {
  decorators: [withViewerFrame],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true, sort: 'requiredFirst' },
    options: {
      storySort: {
        order: [
          'Getting Started',
          'PDFViewer',
          ['Basic', 'Stamping', 'Text', 'Drawing', 'Navigation', 'Rotation'],
          'Integration',
          'Customisation',
          'States',
        ],
      },
    },
  },
}

export default preview
