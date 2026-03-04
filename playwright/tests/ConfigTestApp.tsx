import React from 'react'
import {FocusProvider, useFocusable, SpatialNavConfig} from '../../src'

const FocusableBox = ({
  id,
  label,
  autoFocus,
  groupId,
  style,
}: {
  id?: string
  label: string
  autoFocus?: boolean
  groupId?: string
  style?: React.CSSProperties
}) => {
  const {ref, isFocused} = useFocusable({id, autoFocus, groupId})

  return (
    <div
      ref={ref as any}
      data-testid={label}
      style={{
        width: 100,
        height: 100,
        margin: 20,
        backgroundColor: isFocused ? 'blue' : 'gray',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {label}
    </div>
  )
}

export const ConfigTestApp = ({config}: {config?: SpatialNavConfig}) => {
  return (
    <FocusProvider config={config}>
      <div style={{display: 'flex', gap: '20px'}}>
        <FocusableBox label="Box 1" autoFocus groupId="group-a" />
        <FocusableBox label="Box 2" groupId="group-b" />
        <div style={{marginLeft: '100px'}}>
          <FocusableBox label="Box 3" groupId="group-a" />
        </div>
      </div>
    </FocusProvider>
  )
}

export const HiddenTestApp = ({config}: {config?: SpatialNavConfig}) => {
  return (
    <FocusProvider config={config}>
      <div style={{display: 'flex', gap: '20px'}}>
        <FocusableBox label="Box 1" autoFocus />
        {/* display: none will ALWAYS be skipped because width=0/height=0 fails the DOM visible dimension checks. 
            To truly test skipHiddenElements, we must use elements with real dimensions that are "hidden" via CSS visibility/opacity */}

        <FocusableBox style={{visibility: 'hidden'}} label="Hidden Box" />

        <FocusableBox style={{opacity: 0}} label="Opacity Box" />

        <FocusableBox label="Box 2" />
        <FocusableBox label="Box 3" />
      </div>
    </FocusProvider>
  )
}

export const ViewportTestApp = ({config}: {config?: SpatialNavConfig}) => {
  return (
    <FocusProvider config={config}>
      <div style={{position: 'relative', width: '800px', height: '600px'}}>
        {/* Origin Top Left */}
        <div style={{position: 'absolute', top: 50, left: 50}}>
          <FocusableBox label="Box 1" autoFocus />
        </div>
        {/* On screen, further away Down (Y=200) */}
        <div style={{position: 'absolute', top: 200, left: 50}}>
          <FocusableBox label="Box 2" />
        </div>
        {/* Physically closer straight Down (Y=180), but placed severely offscreen negatively on the X axis so it receives outOfViewportPenalty */}
        <div style={{position: 'absolute', top: 180, left: -2000}}>
          <FocusableBox label="Offscreen Box" />
        </div>
      </div>
    </FocusProvider>
  )
}

export const WeightTestApp = ({config}: {config?: SpatialNavConfig}) => {
  return (
    <FocusProvider config={config}>
      <div style={{position: 'relative', width: '800px', height: '600px'}}>
        <div style={{position: 'absolute', top: 50, left: 50}}>
          <FocusableBox label="Box 1" autoFocus />
        </div>
        {/* Box 2: Close on X (+150px) but very misaligned on Y (+250px) */}
        <div style={{position: 'absolute', top: 300, left: 200}}>
          <FocusableBox label="Box 2" />
        </div>
        {/* Box 3: Extremely far on X (+600px) but perfectly aligned on Y */}
        <div style={{position: 'absolute', top: 50, left: 650}}>
          <FocusableBox label="Box 3" />
        </div>
      </div>
    </FocusProvider>
  )
}
