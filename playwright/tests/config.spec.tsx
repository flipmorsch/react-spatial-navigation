import {test, expect} from '@playwright/experimental-ct-react'
import React from 'react'
import {
  ConfigTestApp,
  HiddenTestApp,
  ViewportTestApp,
  WeightTestApp,
} from './ConfigTestApp'

test.use({viewport: {width: 800, height: 600}})

test('default config prefers closer element over group (default bonus is 50, distance is > 100)', async ({
  mount,
  page,
}) => {
  const component = await mount(<ConfigTestApp />)

  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  await page.keyboard.press('ArrowRight')

  // Box 2 is physically closer and the default group bonus (50) isn't enough to beat the distance
  await expect(component.getByTestId('Box 2')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )
})

test('custom config with massive sameGroupBonus prefers further element in same group', async ({
  mount,
  page,
}) => {
  // Override group bonus to be massive (e.g. 1000) so it beats the distance penalty
  const component = await mount(
    <ConfigTestApp config={{sameGroupBonus: 1000}} />,
  )

  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  await page.keyboard.press('ArrowRight')

  // Box 3 is further away but shares "group-a" with Box 1, and the massive bonus pulls focus there
  await expect(component.getByTestId('Box 3')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )
})

// --- Hidden Element Tests ---

test('default config skips hidden elements entirely', async ({mount, page}) => {
  const component = await mount(<HiddenTestApp />)
  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  await page.keyboard.press('ArrowRight')

  // Skips the display: none and opacity: 0 boxes directly to Box 2
  await expect(component.getByTestId('Box 2')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )
})

test('skipHiddenElements=false considers hidden elements as focusable targets', async ({
  mount,
  page,
}) => {
  const component = await mount(
    <HiddenTestApp config={{skipHiddenElements: false}} />,
  )
  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  await page.keyboard.press('ArrowRight')

  // With skipHiddenElements disabled, the next geometrical sibling in the flex layout is the 'Hidden Box' (visibility: hidden).
  // Because it inherently preserves geometry (unlike display: none), the score catches it!
  await expect(component.getByTestId('Hidden Box')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )
})

// --- Weight Vector Tests ---

test('default weights prefer navigating to physically closer elements regardless of minor cross misalignment', async ({
  mount,
  page,
}) => {
  const component = await mount(<WeightTestApp />)
  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  await page.keyboard.press('ArrowRight')

  // Box 2 is at X=200, Box 3 is at X=400. Even though Box 2 is deeply misaligned on the Y-Axis (Y=300 vs Y=50),
  // its physical primary distance is much shorter (150px vs 350px).
  // The default config (primary: 1, cross: 0.5) strongly favors this.
  await expect(component.getByTestId('Box 2')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )
})

test('custom crossDistanceWeight violently penalizes misalignment, favoring perfectly aligned distant elements', async ({
  mount,
  page,
}) => {
  // By turning the crossDistanceWeight to 10, any Y-axis misalignment when moving Right costs a massive score penalty.
  const component = await mount(
    <WeightTestApp config={{crossDistanceWeight: 10}} />,
  )
  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  await page.keyboard.press('ArrowRight')

  // Box 3 is much further away, but perfectly aligned on the Y axis, thus dodging the heavy cross penalty!
  await expect(component.getByTestId('Box 3')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )
})
