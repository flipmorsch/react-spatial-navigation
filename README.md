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

## 📝 License

This project is licensed under the BSD-3-Clause License - see the `LICENSE` file for details.
