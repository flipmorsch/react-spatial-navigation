import {test, expect} from '@playwright/experimental-ct-react'
import {TestApp} from './TestApp'

test.use({viewport: {width: 500, height: 500}})

test('initial autoFocus establishes active element', async ({mount}) => {
  const component = await mount(<TestApp />)
  const box1 = component.getByTestId('Box 1')
  await expect(box1).toHaveCSS('background-color', 'rgb(0, 0, 255)') // blue = isFocused
})

test('arrow key navigation works correctly in 2D grid', async ({
  mount,
  page,
}) => {
  const component = await mount(<TestApp />)

  const box1 = component.getByTestId('Box 1')
  const box2 = component.getByTestId('Box 2')
  const box3 = component.getByTestId('Box 3')
  const box4 = component.getByTestId('Box 4')

  await expect(box1).toHaveCSS('background-color', 'rgb(0, 0, 255)')

  // Move Right to Box 2
  await page.keyboard.press('ArrowRight')
  await expect(box2).toHaveCSS('background-color', 'rgb(0, 0, 255)')
  await expect(box1).toHaveCSS('background-color', 'rgb(128, 128, 128)') // gray

  // Move Down to Box 4
  await page.keyboard.press('ArrowDown')
  await expect(box4).toHaveCSS('background-color', 'rgb(0, 0, 255)')

  // Move Left to Box 3
  await page.keyboard.press('ArrowLeft')
  await expect(box3).toHaveCSS('background-color', 'rgb(0, 0, 255)')

  // Move Up to Box 1
  await page.keyboard.press('ArrowUp')
  await expect(box1).toHaveCSS('background-color', 'rgb(0, 0, 255)')
})

test('enter key triggers onEnter callback', async ({mount, page}) => {
  const component = await mount(<TestApp />)
  const lastAction = component.getByTestId('last-action')

  // Wait for initial focus on Box 1
  await expect(component.getByTestId('Box 1')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  // Press Enter on Box 1
  await page.keyboard.press('Enter')
  await expect(lastAction).toContainText('Box 1 Enter')

  // Move Right to Box 2
  await page.keyboard.press('ArrowRight')
  await expect(component.getByTestId('Box 2')).toHaveCSS(
    'background-color',
    'rgb(0, 0, 255)',
  )

  // Press Enter on Box 2
  await page.keyboard.press('Enter')
  await expect(lastAction).toContainText('Box 2 Enter')
})
