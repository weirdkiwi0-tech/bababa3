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

    await expect(page.getByText('기록은 10자 이상 입력해주세요.')).toBeVisible()
  })

  test('opens an uploaded image from the saved diary card', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '간편 작성' }).click()
    await page.getByLabel('내용').fill('이미지를 첨부한 기록을 저장합니다.')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test-image'),
    })
    await page.getByRole('button', { name: '저장' }).click()
    await page.getByRole('button', { name: '내 정보' }).click()
    await page.getByRole('button', { name: /첨부 파일 1개/ }).click()

    await expect(page.getByRole('heading', { name: '일기 첨부 파일' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'photo.png' })).toBeVisible()
  })
})
