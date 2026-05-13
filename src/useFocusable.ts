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
  const nodeRef = useRef<HTMLElement | null>(null)
  const didInitRegistrationEffect = useRef(false)

  const isFocused = activeId === id

  // Keep callbacks in a ref so register/unregister closures always see the
  // latest values without re-registering the element.
  const callbacks = useRef({onEnter, onFocus, onBlur})
  useEffect(() => {
    callbacks.current = {onEnter, onFocus, onBlur}
  }, [onEnter, onFocus, onBlur])

  const registerNode = useCallback(
    (node: HTMLElement) => {
      register({
        id,
        ref: node,
        groupId,
        priority,
        onEnter: () => callbacks.current.onEnter?.(),
        onFocus: () => callbacks.current.onFocus?.(),
        onBlur: () => callbacks.current.onBlur?.(),
      })
    },
    [id, register, groupId, priority],
  )

  // Callback ref: register when the DOM node mounts, unregister when it
  // unmounts or changes. Keep this stable across group/priority changes so
  // React doesn't force a null->node ref cycle for metadata-only updates.
  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        nodeRef.current = node
        registerNode(node)
      } else {
        nodeRef.current = null
        unregister(id)
      }
    },
    [id, registerNode, unregister],
  )

  useEffect(() => {
    if (!didInitRegistrationEffect.current) {
      didInitRegistrationEffect.current = true
      return
    }
    if (nodeRef.current) {
      registerNode(nodeRef.current)
    }
  }, [registerNode])

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
