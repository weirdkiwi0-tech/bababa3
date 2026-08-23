import { expect, test } from '@playwright/test'

test.describe('HaruCheck journal flow', () => {
  test('saves an entry and restores it after reload', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '간편 작성' }).click()
    await page.getByLabel('내용').fill('오늘은 테스트 주도 개발로 기본 흐름을 구축했다.')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page.getByText('오늘 기록 초안을 저장했습니다.')).toBeVisible()

    await page.reload()

    await page.getByRole('button', { name: '간편 작성' }).click()
    await expect(page.getByLabel('내용')).toHaveValue('오늘은 테스트 주도 개발로 기본 흐름을 구축했다.')
  })

  test('shows validation message for too-short input', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '간편 작성' }).click()
    await page.getByLabel('내용').fill('짧다')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page.getByText('기록은 10자 이상 300자 이하로 입력해주세요.')).toBeVisible()
  })
})
