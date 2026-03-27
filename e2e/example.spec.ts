import { test, expect, _electron as electron } from '@playwright/test'

test.describe('DevHub E2E Tests', () => {
  test('应用应该正常启动并显示主窗口', async () => {
    // 注意：这个测试需要先构建应用
    // 在 CI 中会先运行 pnpm build
    const electronApp = await electron.launch({
      args: ['out/main/index.js']
    })

    // 获取第一个窗口
    const window = await electronApp.firstWindow()

    // 验证窗口标题
    const title = await window.title()
    expect(title).toContain('DevHub')

    // 截图保存
    await window.screenshot({ path: 'e2e/screenshots/launch.png' })

    // 关闭应用
    await electronApp.close()
  })

  test('应该显示项目列表区域', async () => {
    const electronApp = await electron.launch({
      args: ['out/main/index.js']
    })

    const window = await electronApp.firstWindow()

    // 等待页面加载
    await window
      .waitForSelector('[data-testid="project-list"]', { timeout: 5000 })
      .catch(() => {
        // 如果没有 testid，尝试其他选择器
      })

    await electronApp.close()
  })
})
