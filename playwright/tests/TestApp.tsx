import React from 'react'
import {FocusProvider, useFocusable} from '../../src'

export const FocusableBox = ({
  id,
  label,
  autoFocus,
  onEnter,
}: {
  id?: string
  label: string
  autoFocus?: boolean
  onEnter?: () => void
}) => {
  const {ref, isFocused} = useFocusable({id, autoFocus, onEnter})

  return (
    <div
      ref={ref as any}
      data-testid={label}
      style={{
        width: 100,
        height: 100,
        margin: 20,
        backgroundColor: isFocused ? 'blue' : 'gray',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: isFocused ? '4px solid yellow' : 'none',
      }}
    >
      {label}
    </div>
  )
}

export const TestApp = () => {
  const [lastAction, setLastAction] = React.useState<string>('')

  return (
    <FocusProvider>
      <div style={{display: 'flex', flexDirection: 'column'}}>
        <div data-testid="last-action">Last Action: {lastAction}</div>
        <div style={{display: 'flex'}}>
          <FocusableBox
            label="Box 1"
            autoFocus
            onEnter={() => setLastAction('Box 1 Enter')}
          />
          <FocusableBox
            label="Box 2"
            onEnter={() => setLastAction('Box 2 Enter')}
          />
        </div>
        <div style={{display: 'flex'}}>
          <FocusableBox label="Box 3" />
          <FocusableBox label="Box 4" />
        </div>
      </div>
    </FocusProvider>
  )
}
