// What CodeSurfer did, and what the decks migrated from the talks monorepo
// lost: stepping through several versions of the same code without leaving
// the slide, so the code holds still and only the part being talked about
// moves. ReMDX has no equivalent — its own `stepIndex` is vestigial, because
// its Slide turns any step past the first into a slide change.
//
// A deck wraps its steps in this, writing each one the way it would write a
// single code slide:
//
//   <CodeSteps>
//
//   #### mapStateToProps
//
//   ```jsx {9-11}
//   …
//   ```
//
//   #### mapDispatchToProps
//
//   ```jsx {13-17}
//   …
//   ```
//
//   </CodeSteps>
//
// A step ends at each code block, so whatever precedes one — a heading, a
// line of prose — belongs to it. Nothing about the blocks themselves changes:
// shiki still highlights them at build time from the same ```lang {a-b} that
// a plain code slide uses.

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { centreOnHighlight } from '../deck/scroll-to-highlight.ts'

// Which way the deck was last moving, so that walking backwards into a
// stepper lands on its last step rather than its first — where CodeSurfer
// left off too.
//
// It has to live outside the components. remdx unmounts a slide once it has
// finished animating out, so a stepper does not survive being left: it is
// built again from nothing when the presenter comes back to it, with no
// memory of which end they are arriving at. Only the key that moved between
// the two slides knows, and it belongs to neither.
let direction = 1

const isCodeBlock = (node: ReactNode): boolean =>
  React.isValidElement(node) &&
  (node.type === 'pre' ||
    String(
      (node.props as { className?: string } | null)?.className || ''
    ).includes('shiki'))

// MDX wraps a fenced block in a fragment, and puts a newline between every
// two elements. Neither is a step boundary.
const flatten = (children: ReactNode): ReactNode[] =>
  React.Children.toArray(children).flatMap((child) => {
    if (React.isValidElement(child) && child.type === React.Fragment) {
      return flatten((child.props as { children?: ReactNode }).children)
    }
    return typeof child === 'string' && !child.trim() ? [] : [child]
  })

const toSteps = (children: ReactNode): ReactNode[][] => {
  const steps: ReactNode[][] = []
  let current: ReactNode[] = []

  for (const child of flatten(children)) {
    current.push(child)
    if (isCodeBlock(child)) {
      steps.push(current)
      current = []
    }
  }

  // Anything after the last code block is a closing remark on it, not a step
  // of its own — a step with no code would be a blank panel.
  if (current.length) {
    if (steps.length) {
      steps[steps.length - 1].push(...current)
    } else {
      steps.push(current)
    }
  }
  return steps
}

// Which slide a node is on, as remdx counts them: the slide wrappers are the
// children of the one element it scales the deck with.
//
// Being visible is not the same question, and answering it that way is wrong:
// remdx animates the slide it is leaving out of view and leaves it displayed
// for the better part of a second afterwards, so for that whole window two
// slides are on screen and the one being left would go on claiming keys — a
// press vanishing every time the presenter walked out of a stepper.
const slideIndexOf = (node: HTMLElement): number | null => {
  const container = document.querySelector('#root > div > div')
  if (!container) {
    return null
  }
  let element: HTMLElement | null = node
  while (element && element.parentElement !== container) {
    element = element.parentElement
  }
  return element ? [...container.children].indexOf(element) : null
}

const CodeSteps = ({ children }: { children: ReactNode }) => {
  const steps = toSteps(children)
  const last = steps.length - 1
  const ref = useRef<HTMLDivElement>(null)
  // Entered from the right: open on the step the presenter was last looking
  // at rather than making them walk the whole block again to get out.
  const [step, setStep] = useState(() => (direction < 0 ? last : 0))

  // remdx puts the slide it is showing in the query string, which is the only
  // account of which slide is live rather than merely still painted.
  const isLive = useCallback(() => {
    if (!ref.current) {
      return false
    }
    const index = slideIndexOf(ref.current)
    const shown = new URL(location.href).searchParams.get('slideIndex')
    return index !== null && shown !== null
      ? String(index) === shown
      : ref.current.offsetParent !== null
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const forward = event.key === 'ArrowRight'
      if (!forward && event.key !== 'ArrowLeft') {
        return
      }

      if (!isLive()) {
        // Park at the end this stepper would be entered from, so it is
        // already in the right place by the time it is shown.
        direction = forward ? 1 : -1
        setStep(forward ? 0 : last)
        return
      }

      const next = step + (forward ? 1 : -1)
      if (next < 0 || next > last) {
        // Out of steps: leave the key alone and let remdx change the slide.
        direction = forward ? 1 : -1
        return
      }

      // Capture phase, so this runs before remdx's Mousetrap handler on the
      // same element and stops the deck from advancing underneath us.
      event.preventDefault()
      event.stopPropagation()
      setStep(next)
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [isLive, last, step])

  // The step being shown is not the one that was measured when the deck
  // mounted — every panel is laid out, but only this one has just been
  // revealed, and a long sample has to be scrolled to the lines it is about.
  useEffect(() => {
    const panel = ref.current?.children[step]
    if (!panel) {
      return
    }
    const frame = requestAnimationFrame(() => {
      panel.querySelectorAll<HTMLPreElement>('pre').forEach(centreOnHighlight)
    })
    return () => cancelAnimationFrame(frame)
  }, [step])

  if (steps.length < 2) {
    return <>{children}</>
  }

  return (
    <>
      <div
        ref={ref}
        style={{
          // Every step is dealt the same grid cell, so they sit on top of one
          // another and the box is as tall as the tallest of them. Absolute
          // positioning would size the box to nothing instead, and showing
          // one at a time would make it jump on every step.
          display: 'grid',
          gridTemplateAreas: '"step"',
          width: '100%',
        }}
      >
        {steps.map((content, index) => (
          <div
            aria-hidden={index !== step}
            key={index}
            style={{
              gridArea: 'step',
              // Opacity rather than display: a hidden panel keeps its layout,
              // which is what lets the grid cell size itself to the tallest
              // one and what lets the code be scrolled before it is shown.
              opacity: index === step ? 1 : 0,
              pointerEvents: index === step ? undefined : 'none',
              transition: 'opacity 120ms ease-out',
            }}
          >
            {content}
          </div>
        ))}
      </div>
      <p
        style={{
          alignSelf: 'flex-end',
          fontSize: '0.5em',
          margin: '0.5em 0 0',
          opacity: 0.5,
        }}
      >
        {step + 1}/{steps.length}
      </p>
    </>
  )
}

export default CodeSteps
