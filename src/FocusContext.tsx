import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import {
  type Direction,
  type SpatialNavConfig,
  findNextFocusable,
} from './spatial-navigation'

const FocusContext = createContext<FocusContextType | undefined>(undefined)

// ─── SSR-safe window access ───────────────────────────────────────────────────
function getWindow(): Window | undefined {
  return typeof window !== 'undefined' ? window : undefined
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const FocusProvider: React.FC<{
  children: React.ReactNode
  config?: SpatialNavConfig
}> = ({children, config}) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const elementsRef = useRef<Map<string, RegisteredElement>>(new Map())

  // Keep mutable refs in sync so the keydown handler always sees latest values
  // without needing to re-attach the event listener on every change.
  const configRef = useRef(config)
  configRef.current = config

  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const prevActiveId = useRef<string | null>(null)

  const register = useCallback((element: RegisteredElement) => {
    if (elementsRef.current.has(element.id)) {
      // Warn about duplicate IDs — silently overwriting can cause lost callbacks
      const debug = configRef.current?.debug ?? false
      if (debug) {
        console.warn(
          `SpatialNav: Duplicate focusable ID "${element.id}" — overwriting previous registration.`,
        )
      }
    }
    elementsRef.current.set(element.id, element)

    // If no active ID, or the current active ID is no longer in the map,
    // default to the first registered element.
    setActiveId(current => {
      if (current && elementsRef.current.has(current)) return current
      return element.id
    })
  }, [])

  const unregister = useCallback((id: string) => {
    elementsRef.current.delete(id)
    setActiveId(current => {
      if (current === id) {
        // Find the next available ID
        const first = elementsRef.current.keys().next().value
        return (first as string) || null
      }
      return current
    })
  }, [])

  const setFocus = useCallback((id: string) => {
    if (elementsRef.current.has(id)) {
      setActiveId(id)
    }
  }, [])

  // ── Keyboard listener (attached once, reads latest values from refs) ──────
  useEffect(() => {
    const win = getWindow()
    if (!win) return // SSR guard

    const handleKeyDown = (e: KeyboardEvent) => {
      const mapping: Record<string, Direction | 'enter' | 'back'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        Enter: 'enter',
        Backspace: 'back',
        Escape: 'back',
      }

      const action = mapping[e.key]
      if (!action) return

      // If no elements are registered, don't intercept keys
      if (elementsRef.current.size === 0) return

      if (action === 'back') {
        // TV "Back" key — observed but not overridden by default.
        // Users should handle Escape / Backspace at the app level.
        return
      }

      if (action === 'enter') {
        const active = elementsRef.current.get(activeIdRef.current || '')
        if (active?.onEnter) {
          e.preventDefault()
          active.onEnter()
        }
        return
      }

      // Directional navigation
      const elements = Array.from(elementsRef.current.values())
      const nextId = findNextFocusable(
        activeIdRef.current,
        elements,
        action,
        configRef.current,
      )

      if (nextId) {
        e.preventDefault()
        setActiveId(nextId)
      }
    }

    win.addEventListener('keydown', handleKeyDown)
    return () => win.removeEventListener('keydown', handleKeyDown)
  }, []) // ← empty deps: relies on refs for current values

  // ── Focus/blur callbacks + auto-scroll ────────────────────────────────────
  useEffect(() => {
    if (prevActiveId.current !== activeId) {
      if (prevActiveId.current) {
        elementsRef.current.get(prevActiveId.current)?.onBlur?.()
      }
      if (activeId) {
        const element = elementsRef.current.get(activeId)
        if (element) {
          element.onFocus?.()
          // Smooth scroll the newly focused element into view
          element.ref.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          })
        }
      }
      prevActiveId.current = activeId
    }
  }, [activeId])

  return (
    <FocusContext.Provider value={{activeId, register, unregister, setFocus}}>
      {children}
    </FocusContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useFocusContext = () => {
  const context = useContext(FocusContext)
  if (!context) {
    throw new Error('useFocusContext must be used within a FocusProvider')
  }
  return context
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisteredElement {
  id: string
  ref: HTMLElement
  groupId?: string
  priority?: number
  onEnter?: () => void
  onFocus?: () => void
  onBlur?: () => void
}

interface FocusContextType {
  activeId: string | null
  register: (element: RegisteredElement) => void
  unregister: (id: string) => void
  setFocus: (id: string) => void
}
