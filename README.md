# @flipmorsch/react-spatial-navigation

![NPM Version](https://img.shields.io/npm/v/@flipmorsch/react-spatial-navigation)
![License](https://img.shields.io/npm/l/@flipmorsch/react-spatial-navigation)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)
![React](https://img.shields.io/badge/React-18%2B-blue)

A complete, performant, and flexible spatial navigation library for React applications. Designed for Smart TVs, set-top boxes, and keyboard-navigable web apps.

---

## 🚀 Features

- **True DOM-based Navigation**: Focus is moved based on the real geometric position of elements (`getBoundingClientRect()`), not artificial gridding.
- **Smart Auto-focus**: Resolves the closest logical next element regardless of the DOM hierarchy.
- **Unobtrusive API**: Exposes a minimal, hook-based API (`useFocusable`) working seamlessly with modern React.
- **Zero Dependencies**: Lightweight and built relying only on React primitives. 
- **Smooth Auto-scrolling**: Out of the box `scrollIntoView` support to gracefully track focus across large lists or grids.

## 🛠️ Tech Stack

- **Framework:** React (>=18.0.0)
- **Language:** TypeScript 
- **Bundler:** tsup (outputs CJS and ESM formats)
- **Testing:** Playwright Component Testing

---

## 📦 Installation

```bash
npm install @flipmorsch/react-spatial-navigation
```

or using yarn:

```bash
yarn add @flipmorsch/react-spatial-navigation
```

---

## 📖 Walkthrough: How To Use

Integrating spatial navigation into your React app takes just two steps.

### Step 1: Wrap your app in a FocusProvider

The `<FocusProvider>` establishes the required context, maintains the active focus state, and listens to global keyboard events (Arrow keys + Enter). Wrap your root component or the section of your app you want to navigate.

```tsx
// App.tsx
import React from 'react';
import { FocusProvider } from '@flipmorsch/react-spatial-navigation';
import MainMenu from './MainMenu';

export default function App() {
  return (
    <FocusProvider>
      <div className="tv-app">
        <MainMenu />
      </div>
    </FocusProvider>
  );
}
```

### Step 2: Make elements focusable

In your components, use the `useFocusable` hook to register elements. Attach the returned `ref` to your DOM element and style it conditionally based on the `isFocused` state.

```tsx
// Component.tsx
import React from 'react';
import { useFocusable } from '@flipmorsch/react-spatial-navigation';

export default function NavButton({ label, onEnter }) {
  const { ref, isFocused } = useFocusable({
    onEnter,
    // Optional callbacks:
    // onFocus: () => console.log('Focused!'),
    // onBlur: () => console.log('Blurred!'),
  });

  return (
    <button
      ref={ref}
      style={{
        padding: '20px',
        border: '3px solid transparent',
        borderColor: isFocused ? 'white' : 'transparent',
        transform: isFocused ? 'scale(1.1)' : 'scale(1.0)',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );
}
```

That's it! When you press the arrow keys, the library computes the visual layout and intelligently moves the `isFocused` state to the nearest valid `<NavButton>`.

---

## 🌟 Best Practices

1. **Maintain an Unbroken Focus Chain**: Ensure focusable elements are visible within the viewport (or close enough for intersection). Elements set to `display: none` or opacity `0` are automatically excluded from the spatial navigation calculations.
2. **Handle the "Back" Action**: The library intercepts `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, and `Enter`. It observes `Escape` and `Backspace` but does not override them by default. If you need navigation history (like a TV "Back" button), handle capturing these keys at the app level.
3. **Use `autoFocus` Judiciously**: The `useFocusable` hook accepts an `autoFocus: true` parameter. This is incredibly useful for setting the initial focus when a modal opens, or an app first loads.

```tsx
const { ref, isFocused } = useFocusable({
  autoFocus: true, // This element gets focus instantly on mount
  onEnter: () => alert('Selected!')
})
```

---

## ⚙️ Advanced Configuration (`SpatialNavConfig`)

While `<FocusProvider>` uses intelligent default spatial behavior, you can interact directly with the underlying spatial engine by passing a `config` object to `findNextFocusable(currentId, elements, direction, config)`, or by extending your app logic.

The engine scoring is customizable. You can provide these options to `<FocusProvider config={{ ... }}>`:

### `sameGroupBonus` (default: `50`)
Applies a score bonus to elements that share the same `groupId` as the currently focused element. A higher value makes the focus "stick" to the current group rather than jumping to a closer element in a different group.

```tsx
// This config strongly prefers staying inside the current group.
// Even if an item in another group is physically closer, it will jump to the next item in the same group.
<FocusProvider config={{ sameGroupBonus: 1000 }}>
  {/* Elements with the same groupId get the bonus */}
  <SideMenu groupId="menu-group" />
  <MainGrid groupId="content-group" />
</FocusProvider>
```

### `outOfViewportPenalty` (default: `500`)
Applies an artificial distance penalty to elements that are currently off-screen. This helps prevent focus from disappearing off-screen when there are perfectly valid on-screen targets.

```tsx
// This config makes focus very eager to stay on-screen.
// It will only jump off-screen if absolutely no other valid option exists on-screen.
<FocusProvider config={{ outOfViewportPenalty: 2000 }}>
  <AppContent />
</FocusProvider>
```

### `primaryDistanceWeight` (default: `1`)
Determines how heavily the direct alignment distance (e.g., how far Right the next element is when pressing ArrowRight) matters in the scoring algorithm.

```tsx
// Setting this higher makes the algorithm aggressively favor elements that are 
// closer in the strict direction of movement, largely ignoring perpendicular drift.
<FocusProvider config={{ primaryDistanceWeight: 3 }}>
  <AppContent />
</FocusProvider>
```

### `crossDistanceWeight` (default: `0.5`)
Determines how heavily misalignment (perpendicular distance from the center axis, e.g., how far Up or Down an element is when navigating Right) matters.

```tsx
// Setting this to a high value strictly forces focus to follow straight lines. 
// It will heavily penalize elements that are visually staggered or misaligned.
<FocusProvider config={{ crossDistanceWeight: 5 }}>
  <AppContent />
</FocusProvider>
```

### `skipHiddenElements` (default: `true`)
Automatically ignores elements with `display: none`, `visibility: hidden`, or `opacity: 0` so focus doesn't accidentally land on invisible items.

```tsx
// Disabling this will allow the engine to focus visually hidden items.
// You might do this if you handle visibility purely via Javascript state 
// and want hidden elements to still receive focus events behind the scenes.
<FocusProvider config={{ skipHiddenElements: false }}>
  <AppContent />
</FocusProvider>
```

### `preferViewport` (default: `true`)
A boolean toggle that enables or disables the `outOfViewportPenalty` altogether.

```tsx
// Setting this to false turns off the outOfViewportPenalty. 
// Focus will move purely based on distance, blindly jumping off-screen 
// if the next element is technically the closest geometrical match.
<FocusProvider config={{ preferViewport: false }}>
  <AppContent />
</FocusProvider>
```

---

## 📝 License

This project is licensed under the BSD-3-Clause License - see the `LICENSE` file for details.
