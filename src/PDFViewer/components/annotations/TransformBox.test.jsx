import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransformBox } from './TransformBox.jsx'

/**
 * jsdom has no PointerEvent and no pointer capture, so gestures are driven by dispatching
 * events the handlers actually read. Only clientX/clientY, pointerId and the target
 * matter to TransformBox.
 */
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

const RECT = { x: 100, y: 100, width: 200, height: 80 }

const fire = (target, type, { x = 0, y = 0, pointerId = 1 } = {}) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerId,
      button: 0,
    })
  )

/** Drag from one point to another, starting on `target`. */
function gesture(target, from, to) {
  fire(target, 'pointerdown', from)
  fire(target, 'pointermove', to)
  fire(target, 'pointerup', to)
}

function setup(props = {}) {
  const onCommit = vi.fn()
  const view = render(
    <TransformBox rect={RECT} selected resizable rotatable onCommit={onCommit} {...props}>
      <div data-testid="content" style={{ width: '100%', height: '100%' }} />
    </TransformBox>
  )
  return { onCommit, view, content: () => screen.getByTestId('content') }
}

describe('TransformBox gestures', () => {
  it('moves when dragged by its body', () => {
    const { onCommit, content } = setup()
    gesture(content(), { x: 150, y: 150 }, { x: 190, y: 175 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const [rect] = onCommit.mock.calls[0]
    expect(rect).toMatchObject({ x: RECT.x + 40, y: RECT.y + 25 })
  })

  it('resizes when dragged by a handle', () => {
    const { onCommit } = setup()
    const handle = document.querySelector('[data-handle="se"]')
    gesture(handle, { x: 300, y: 180 }, { x: 340, y: 200 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    const [rect] = onCommit.mock.calls[0]
    expect(rect.width).toBeGreaterThan(RECT.width)
  })

  it('can be dragged immediately after a resize, with no click in between', () => {
    // Guards the gesture machinery itself: one gesture must not leave state behind that
    // stops the next from starting.
    const { onCommit, content } = setup()

    gesture(document.querySelector('[data-handle="se"]'), { x: 300, y: 180 }, { x: 340, y: 200 })
    onCommit.mockClear()

    gesture(content(), { x: 150, y: 150 }, { x: 200, y: 150 })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0].x).toBe(RECT.x + 50)
  })

  it('announces the start of a move, resize and rotate', () => {
    /*
     * How the text box learns to leave typing mode. Resizing a box whose caret was still
     * in it left the textarea swallowing pointer events, so the object could not be
     * dragged afterwards until you clicked somewhere else and back.
     */
    for (const target of [
      () => screen.getByTestId('content'),
      () => document.querySelector('[data-handle="se"]'),
      () => document.querySelector('[data-rotate="true"]'),
    ]) {
      const onTransformStart = vi.fn()
      const { unmount } = render(
        <TransformBox rect={RECT} selected resizable rotatable onTransformStart={onTransformStart}>
          <div data-testid="content" style={{ width: '100%', height: '100%' }} />
        </TransformBox>
      )
      gesture(target(), { x: 150, y: 150 }, { x: 200, y: 170 })
      expect(onTransformStart).toHaveBeenCalled()
      unmount()
    }
  })

  it('does not announce a transform for a press on a data-no-drag child', () => {
    // Clicking into a text box to place the caret is not a transform.
    const onTransformStart = vi.fn()
    render(
      <TransformBox rect={RECT} selected onTransformStart={onTransformStart}>
        <textarea data-no-drag data-testid="editor" />
      </TransformBox>
    )
    gesture(screen.getByTestId('editor'), { x: 150, y: 150 }, { x: 150, y: 150 })
    expect(onTransformStart).not.toHaveBeenCalled()
  })

  it('can be dragged immediately after a rotate', () => {
    const { onCommit, content } = setup()

    const rotateHandle = document.querySelector('[data-rotate="true"]')
    gesture(rotateHandle, { x: 200, y: 60 }, { x: 260, y: 90 })
    onCommit.mockClear()

    gesture(content(), { x: 150, y: 150 }, { x: 200, y: 150 })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('suppresses the browser default when a gesture starts', () => {
    /*
     * Without this the browser started a native drag — of a text selection left in
     * pdf.js's text layer by an earlier drag — and native drag replaces the pointer
     * stream with drag events, so the gesture received nothing after pointerdown and
     * the object would not move at all.
     */
    setup()
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 150,
      clientY: 150,
      pointerId: 1,
      button: 0,
    })
    screen.getByTestId('content').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves the browser default alone for a data-no-drag child', () => {
    // Typing and selecting inside a text box must keep working.
    render(
      <TransformBox rect={RECT} selected onSelect={vi.fn()}>
        <textarea data-no-drag data-testid="editor" />
      </TransformBox>
    )
    const event = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: 150,
      clientY: 150,
      pointerId: 1,
      button: 0,
    })
    screen.getByTestId('editor').dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('does not commit a click that moved nothing', () => {
    // Otherwise every selection would land on the undo stack.
    const { onCommit, content } = setup()
    gesture(content(), { x: 150, y: 150 }, { x: 150, y: 150 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  describe('constrainDraft', () => {
    /*
     * The hook that holds an object inside its page while the pointer is still down.
     * Correcting only on release was not enough: for the whole gesture the box floated
     * outside the page — a page stops clipping during a gesture — which is exactly what
     * "it goes through the edge" looked like.
     */
    it('paints and commits the constrained rect, not the raw one', () => {
      // If the two ever diverged the box would visibly jump as the pointer lifted.
      const constrainDraft = vi.fn((rect) => ({ ...rect, x: 0 }))
      const { onCommit, content } = setup({ constrainDraft })

      gesture(content(), { x: 150, y: 150 }, { x: 400, y: 175 })

      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onCommit.mock.calls[0][0]).toMatchObject({ x: 0, y: RECT.y + 25 })
    })

    it('reports a move with the gesture kind', () => {
      const constrainDraft = vi.fn((rect) => rect)
      const { content } = setup({ constrainDraft })

      gesture(content(), { x: 150, y: 150 }, { x: 190, y: 175 })

      const [rect, rotation, kind] = constrainDraft.mock.calls[0]
      expect(kind).toBe('move')
      expect(rotation).toBe(0)
      expect(rect).toMatchObject({ x: RECT.x + 40, y: RECT.y + 25 })
    })

    it('reports a resize with the handle and the aspect lock', () => {
      // Both are needed to shrink about the right anchor without distorting an image.
      const constrainDraft = vi.fn((rect) => rect)
      setup({ constrainDraft, lockAspectRatio: true })

      gesture(document.querySelector('[data-handle="se"]'), { x: 300, y: 180 }, { x: 340, y: 200 })

      const [, , kind, options] = constrainDraft.mock.calls[0]
      expect(kind).toBe('resize')
      expect(options).toMatchObject({ handle: 'se', lockAspectRatio: true })
    })

    it('is not consulted for a rotate', () => {
      // Rotation does not move the centre, so constraining mid-spin could only fight the
      // user. The commit-time clamp settles it instead.
      const constrainDraft = vi.fn((rect) => rect)
      setup({ constrainDraft })

      gesture(document.querySelector('[data-rotate="true"]'), { x: 200, y: 60 }, { x: 260, y: 90 })

      expect(constrainDraft).not.toHaveBeenCalled()
    })

    it('behaves exactly as before when not supplied', () => {
      const { onCommit, content } = setup()
      gesture(content(), { x: 150, y: 150 }, { x: 190, y: 175 })
      expect(onCommit.mock.calls[0][0]).toMatchObject({ x: RECT.x + 40, y: RECT.y + 25 })
    })
  })

  it('selects but does not drag from a child marked data-no-drag', () => {
    const onSelect = vi.fn()
    const onCommit = vi.fn()
    render(
      <TransformBox rect={RECT} selected onSelect={onSelect} onCommit={onCommit}>
        <textarea data-no-drag data-testid="editor" />
      </TransformBox>
    )

    gesture(screen.getByTestId('editor'), { x: 150, y: 150 }, { x: 200, y: 150 })
    expect(onSelect).toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()
  })
})
