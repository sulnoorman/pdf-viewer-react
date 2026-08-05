import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LabelProvider } from '../../context/LabelContext.jsx'
import { TextStamp } from './TextStamp.jsx'

beforeAll(() => {
  if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    }
  }
  for (const method of ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture']) {
    if (!Element.prototype[method]) Element.prototype[method] = function noop() {}
  }
})

const ANNOTATION = {
  id: 't1',
  type: 'text',
  pageIndex: 0,
  x: 10,
  y: 10,
  width: 200,
  height: 60,
  rotation: 0,
  opacity: 1,
  text: 'Hello',
  fontSize: 16,
  color: '#000000',
  fontFamily: 'Helvetica',
}

const fire = (target, type, x = 150, y = 150) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      button: 0,
    })
  )

function setup(props = {}) {
  const onCommit = vi.fn()

  const tree = (extra) => (
    <LabelProvider>
      <TextStamp
        annotation={ANNOTATION}
        screenRect={{ x: 100, y: 100, width: 200, height: 60 }}
        frameRotation={0}
        scale={1}
        isActive
        onSelect={vi.fn()}
        onCommit={onCommit}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        {...extra}
      />
    </LabelProvider>
  )

  const view = render(tree(props))
  return {
    onCommit,
    textarea: () => screen.getByRole('textbox'),
    // Re-renders the same tree, which is what a prop change in the real Page does —
    // rendering a second tree would leave the first mounted and unchanged.
    rerender: (extra) => act(() => view.rerender(tree(extra))),
  }
}

/** A textarea only blocks dragging while it is the edit surface. */
const isEditing = (textarea) => textarea.hasAttribute('data-no-drag')

describe('TextStamp editing mode', () => {
  it('starts inert, so the box can be dragged straight away', () => {
    const { textarea } = setup()
    expect(isEditing(textarea())).toBe(false)
    expect(textarea()).toHaveAttribute('readonly')
  })

  it('opens straight into typing when freshly created', () => {
    // "Add text", and host actions that insert text, must not need a double-click.
    const { textarea } = setup({ autoFocus: true })
    expect(isEditing(textarea())).toBe(true)
  })

  it('enters typing mode on a double-click', () => {
    const { textarea } = setup()
    act(() => {
      textarea().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(isEditing(textarea())).toBe(true)
  })

  it('leaves typing mode when a transform gesture starts', () => {
    /*
     * The reported bug: after resizing a text box you could not drag it until you had
     * clicked somewhere else and back. Resizing left the caret in the box, so the
     * textarea kept swallowing the press that should have begun the move.
     */
    const { textarea } = setup({ autoFocus: true })
    expect(isEditing(textarea())).toBe(true)

    const handle = document.querySelector('[data-handle="se"]')
    act(() => {
      fire(handle, 'pointerdown', 300, 160)
      fire(handle, 'pointermove', 340, 190)
      fire(handle, 'pointerup', 340, 190)
    })

    expect(isEditing(textarea())).toBe(false)
  })

  it('can be dragged immediately after that resize', () => {
    const { onCommit, textarea } = setup({ autoFocus: true })

    const handle = document.querySelector('[data-handle="se"]')
    act(() => {
      fire(handle, 'pointerdown', 300, 160)
      fire(handle, 'pointermove', 340, 190)
      fire(handle, 'pointerup', 340, 190)
    })
    onCommit.mockClear()

    act(() => {
      fire(textarea(), 'pointerdown', 150, 130)
      fire(textarea(), 'pointermove', 210, 130)
      fire(textarea(), 'pointerup', 210, 130)
    })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const [, rect] = onCommit.mock.calls[0]
    expect(rect.x).toBe(160)
  })

  it('leaves typing mode when deselected', () => {
    // Otherwise a box left mid-edit keeps blocking the next gesture on it.
    const { rerender, textarea } = setup({ autoFocus: true })
    expect(isEditing(textarea())).toBe(true)

    rerender({ autoFocus: true, isActive: false })
    expect(isEditing(textarea())).toBe(false)
  })
})
