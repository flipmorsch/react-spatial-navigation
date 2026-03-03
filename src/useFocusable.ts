import {useRef, useEffect, useId} from 'react'
import {useFocusContext} from './FocusContext'

interface UseFocusableOptions {
  id?: string
  onEnter?: () => void
  onFocus?: () => void
  onBlur?: () => void
  groupId?: string
  autoFocus?: boolean
}

export function useFocusable({
  id: providedId,
  onEnter,
  onFocus,
  onBlur,
  groupId,
  autoFocus = false,
}: UseFocusableOptions = {}) {
  const internalId = useId()
  const id = providedId || internalId
  const ref = useRef<HTMLElement>(null)
  const {activeId, register, unregister, setFocus} = useFocusContext()

  const isFocused = activeId === id

  // Use refs for callbacks so they are always current but don't trigger re-registration
  const callbacks = useRef({onEnter, onFocus, onBlur})
  useEffect(() => {
    callbacks.current = {onEnter, onFocus, onBlur}
  }, [onEnter, onFocus, onBlur])

  useEffect(() => {
    if (ref.current) {
      register({
        id,
        ref: ref.current,
        onEnter: () => callbacks.current.onEnter?.(),
        onFocus: () => callbacks.current.onFocus?.(),
        onBlur: () => callbacks.current.onBlur?.(),
        groupId,
      })
    }

    return () => {
      unregister(id)
    }
  }, [id, register, unregister, groupId])

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
