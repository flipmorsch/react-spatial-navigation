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
  type FocusableElement,
  type SpatialNavConfig,
  findNextFocusable,
} from './spatial-navigation'

export interface RegisteredElement extends FocusableElement {
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

const FocusContext = createContext<FocusContextType | undefined>(undefined)

export const FocusProvider: React.FC<{
  children: React.ReactNode
  config?: SpatialNavConfig
}> = ({children, config}) => {
  const [activeId, setActiveId] = useState<string | null>(null)
  const elementsRef = useRef<Map<string, RegisteredElement>>(new Map())

  const register = useCallback((element: RegisteredElement) => {
    elementsRef.current.set(element.id, element)
    // If no active ID, or the current active ID is not in the map, set it to the first registered element
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

  const prevActiveId = useRef<string | null>(null)

  useEffect(() => {
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

      // If no elements are registered, don't intercept keys (allow player to handle them)
      if (elementsRef.current.size === 0) return

      if (action === 'back') {
        // Most TV apps expect Back to behave like history.back() or custom navigation
        // If nothing is handled here, we allow it to bubble or manually navigate
        return
      }

      if (action === 'enter') {
        const active = elementsRef.current.get(activeId || '')
        if (active?.onEnter) {
          e.preventDefault()
          active.onEnter()
        }
        return
      }

      const elements = Array.from(elementsRef.current.values())
      const nextId = findNextFocusable(activeId, elements, action, config)

      if (nextId) {
        e.preventDefault()
        setActiveId(nextId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeId])

  // Handle focus/blur callbacks and scrolling
  useEffect(() => {
    if (prevActiveId.current !== activeId) {
      if (prevActiveId.current) {
        elementsRef.current.get(prevActiveId.current)?.onBlur?.()
      }
      if (activeId) {
        const element = elementsRef.current.get(activeId)
        if (element) {
          element.onFocus?.()
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

export const useFocusContext = () => {
  const context = useContext(FocusContext)
  if (!context) {
    throw new Error('useFocusContext must be used within a FocusProvider')
  }
  return context
}
