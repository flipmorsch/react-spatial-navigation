import {useRef, useEffect, useId, useCallback} from 'react'
import {useFocusContext} from './FocusContext'

export interface UseFocusableOptions {
  id?: string
  onEnter?: () => void
  onFocus?: () => void
  onBlur?: () => void
  groupId?: string
  autoFocus?: boolean
  priority?: number
}

export interface UseFocusableResult {
  /** Callback ref — attach to the DOM element you want to make focusable */
  ref: (node: HTMLElement | null) => void
  /** Whether this element currently has spatial focus */
  isFocused: boolean
  /** The resolved element ID */
  id: string
  /** Imperatively focus this element */
  setFocus: () => void
}

export function useFocusable({
  id: providedId,
  onEnter,
  onFocus,
  onBlur,
  groupId,
  priority,
  autoFocus = false,
}: UseFocusableOptions = {}): UseFocusableResult {
  const internalId = useId()
  const id = providedId || internalId
  const {activeId, register, unregister, setFocus} = useFocusContext()

  const isFocused = activeId === id

  // Keep callbacks in a ref so register/unregister closures always see the
  // latest values without re-registering the element.
  const callbacks = useRef({onEnter, onFocus, onBlur})
  useEffect(() => {
    callbacks.current = {onEnter, onFocus, onBlur}
  }, [onEnter, onFocus, onBlur])

  // Callback ref: register when the DOM node mounts, unregister when it
  // unmounts or changes. This keeps the registered DOM node always in sync.
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        register({
          id,
          ref: node,
          groupId,
          priority,
          onEnter: () => callbacks.current.onEnter?.(),
          onFocus: () => callbacks.current.onFocus?.(),
          onBlur: () => callbacks.current.onBlur?.(),
        })
      } else {
        unregister(id)
      }
    },
    // register and unregister are stable (useCallback with [] deps in context).
    // id, groupId, and priority may change — if they do, the old registration
    // is cleaned up and a new one is created via the callback ref lifecycle.
    [id, register, unregister, groupId, priority],
  )

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      setFocus(id)
    }
  }, [autoFocus, id, setFocus])

  return {
    ref,
    isFocused,
    id,
    setFocus: () => setFocus(id),
  }
}
