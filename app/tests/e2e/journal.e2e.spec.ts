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

  test('deletes an entry from my info panel and keeps it deleted after reload', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '간편 작성' }).click()
    await page.getByLabel('내용').fill('삭제 기능을 검증하기 위한 오늘의 기록입니다.')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page.getByText('오늘 기록 초안을 저장했습니다.')).toBeVisible()

    await page.getByRole('button', { name: '내 정보' }).click()

    const myEntryPanel = page.getByLabel('내가 올린 일기 내용')
    const entryCard = myEntryPanel.locator('.my-entry-card')
    await expect(entryCard).toHaveCount(1)
    const dateKey = await entryCard.locator('h3').innerText()

    page.once('dialog', (dialog) => dialog.accept())
    await entryCard.locator('.delete-entry-btn').click()

    await expect(page.getByText(`${dateKey} 기록을 삭제했습니다.`)).toBeVisible()
    await expect(myEntryPanel.locator('.my-entry-card')).toHaveCount(0)
    await expect(myEntryPanel.getByText('아직 작성한 일기가 없습니다.')).toBeVisible()

    await page.reload()

    await page.getByRole('button', { name: '내 정보' }).click()
    await expect(page.getByLabel('내가 올린 일기 내용').locator('.my-entry-card')).toHaveCount(0)
    await expect(page.getByLabel('내가 올린 일기 내용').getByText('아직 작성한 일기가 없습니다.')).toBeVisible()
  })

  test('shows validation message for too-short input', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '간편 작성' }).click()
    await page.getByLabel('내용').fill('짧다')
    await page.getByRole('button', { name: '저장' }).click()

    await expect(page.getByText('기록은 10자 이상 입력해주세요.')).toBeVisible()
  })

  test('rejects unsupported or oversized media and keeps valid attachments working', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '간편 작성' }).click()
    await page.getByLabel('내용').fill('허용되지 않는 첨부 파일을 검증하는 기록입니다.')

    await page.getByLabel('사진/파일/영상 첨부').setInputFiles({
      name: 'unsupported.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('test-image'),
    })

    await expect(page.getByText('지원하지 않는 이미지 형식입니다. jpg, png, webp만 첨부할 수 있습니다.')).toBeVisible()
    await expect(page.getByText('선택된 첨부 파일이 없습니다.')).toBeVisible()
    await expect(page.getByText(/unsupported\.gif/)).toHaveCount(0)

    await page.getByLabel('사진/파일/영상 첨부').setInputFiles({
      name: 'oversized.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(11 * 1024 * 1024),
    })

    await expect(page.getByText('이미지 용량이 10MB를 초과했습니다.')).toBeVisible()
    await expect(page.getByText('선택된 첨부 파일이 없습니다.')).toBeVisible()
    await expect(page.getByText(/oversized\.jpg/)).toHaveCount(0)

    await page.getByLabel('사진/파일/영상 첨부').setInputFiles({
      name: 'valid.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('test-image'),
    })

    await expect(page.getByText('선택된 파일: valid.jpg')).toBeVisible()
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

  test('inserts an image into the design canvas from the file menu', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '디자인 작성' }).click()
    await page.getByRole('tab', { name: '제작 스튜디오' }).click()
    await page.getByRole('button', { name: '파일' }).click()
    await page.getByRole('menuitem', { name: '파일 삽입' }).click()
    await page.getByLabel('파일 삽입').setInputFiles({
      name: 'canvas-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test-image'),
    })

    await expect(page.getByRole('img', { name: 'canvas-image.png' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'canvas-image.png 크기 조절' })).toBeVisible()

    const image = page.getByRole('img', { name: 'canvas-image.png' })
    const rotationHandle = page.getByRole('button', { name: '이미지 15도 회전' })
    const imageBounds = await image.locator('..').boundingBox()
    const rotationBounds = await rotationHandle.boundingBox()
    if (!imageBounds || !rotationBounds) throw new Error('rotation handle has no bounds')
    const centerX = imageBounds.x + imageBounds.width / 2
    const centerY = imageBounds.y + imageBounds.height / 2
    const startX = rotationBounds.x + rotationBounds.width / 2
    const startY = rotationBounds.y + rotationBounds.height / 2
    const startAngle = Math.atan2(startY - centerY, startX - centerX)
    const radius = Math.hypot(startX - centerX, startY - centerY)
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(
      centerX + Math.cos(startAngle + Math.PI / 12) * radius,
      centerY + Math.sin(startAngle + Math.PI / 12) * radius,
      { steps: 5 },
    )
    await page.mouse.up()
    expect(await image.evaluate((element) => element.parentElement?.style.transform)).toContain(
      'rotate(15deg)',
    )
    const rotatedBounds = await image.boundingBox()
    if (!rotatedBounds) throw new Error('rotated image has no bounds')
    expect(rotatedBounds.x + rotatedBounds.width / 2).toBeCloseTo(
      imageBounds.x + imageBounds.width / 2,
      0,
    )
    expect(rotatedBounds.y + rotatedBounds.height / 2).toBeCloseTo(
      imageBounds.y + imageBounds.height / 2,
      0,
    )
    const beforeMove = await image.boundingBox()
    if (!beforeMove) throw new Error('inserted image has no bounds')
    await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + beforeMove.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      beforeMove.x + beforeMove.width / 2 + 32,
      beforeMove.y + beforeMove.height / 2 + 24,
    )
    await page.mouse.up()
    const afterMove = await image.boundingBox()
    expect(afterMove?.x).toBeGreaterThan(beforeMove.x)
    expect(afterMove?.y).toBeGreaterThan(beforeMove.y)

    const resizeHandle = page.getByRole('button', { name: 'canvas-image.png 크기 조절' })
    const beforeResize = await image.boundingBox()
    const handleBox = await resizeHandle.boundingBox()
    if (!beforeResize || !handleBox) throw new Error('resize handle has no bounds')
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      handleBox.x + handleBox.width / 2 + 80,
      handleBox.y + handleBox.height / 2 + 80,
      { steps: 5 },
    )
    await page.mouse.up()
    const afterResize = await image.boundingBox()
    expect(afterResize?.width).toBeGreaterThan(beforeResize.width)
    expect(afterResize?.height).toBeGreaterThan(beforeResize.height)
    expect((afterResize?.width ?? 0) / (afterResize?.height ?? 1)).toBeCloseTo(
      beforeResize.width / beforeResize.height,
      1,
    )
  })

  test('persists image position, ratio, and free rotation after saving and reload', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '디자인 작성' }).click()
    await page.getByRole('tab', { name: '제작 스튜디오' }).click()
    await page.getByRole('button', { name: '파일' }).click()
    await page.getByRole('menuitem', { name: '파일 삽입' }).click()
    await page.getByLabel('파일 삽입').setInputFiles({
      name: 'persisted-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test-image'),
    })
    await page.getByRole('button', { name: '텍스트 수정 모드' }).click()
    await page.getByPlaceholder('본문').fill('이미지 변형을 저장하고 복원하는 디자인 기록입니다.')

    const image = page.getByRole('img', { name: 'persisted-image.png' })
    const rotationHandle = page.getByRole('button', { name: '이미지 15도 회전' })
    const imageBounds = await image.locator('..').boundingBox()
    const rotationBounds = await rotationHandle.boundingBox()
    if (!imageBounds || !rotationBounds) throw new Error('image controls have no bounds')
    const centerX = imageBounds.x + imageBounds.width / 2
    const centerY = imageBounds.y + imageBounds.height / 2
    const startX = rotationBounds.x + rotationBounds.width / 2
    const startY = rotationBounds.y + rotationBounds.height / 2
    const startAngle = Math.atan2(startY - centerY, startX - centerX)
    const radius = Math.hypot(startX - centerX, startY - centerY)
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(
      centerX + Math.cos(startAngle + Math.PI / 6) * radius,
      centerY + Math.sin(startAngle + Math.PI / 6) * radius,
      { steps: 5 },
    )
    await page.mouse.up()

    await expect(image.locator('..')).toHaveAttribute('style', /translate\(24px, 96px\)/)
    await page.getByRole('button', { name: '임시 저장' }).click()
    await expect(page.getByText('오늘 기록 초안을 저장했습니다.')).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: '디자인 작성' }).click()
    await page.getByRole('tab', { name: '제작 스튜디오' }).click()

    const restoredImage = page.getByRole('img', { name: 'persisted-image.png' })
    await expect(restoredImage).toBeVisible()
    const restoredContainer = restoredImage.locator('..')
    expect(await restoredContainer.getAttribute('style')).toContain('translate(24px, 96px)')
    expect(await restoredContainer.getAttribute('style')).toContain('rotate(30deg)')
    expect(await restoredContainer.getAttribute('style')).toContain('width: 220px')
    expect(await restoredContainer.getAttribute('style')).toContain('height: 146px')
  })
})
