import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TruncatedText } from './TruncatedText'

describe('TruncatedText', () => {
  const ELLIPSIS = '\u2026'

  it('按字符上限截断长标题并补全省略号', () => {
    const text = 'A'.repeat(55)
    render(<TruncatedText text={text} maxChars={40} testId="window-title-cell" />)

    const node = screen.getByTestId('window-title-cell')
    expect(node.textContent).toBe(`${'A'.repeat(40)}${ELLIPSIS}`)
    expect(node).toHaveAttribute('title', text)
  })

  it('双击后切换到 marquee 模式，再双击恢复截断', () => {
    const text = 'Long window title '.repeat(4)
    render(
      <TruncatedText
        text={text}
        maxChars={40}
        enableMarquee
        testId="window-title-cell"
      />
    )

    const node = screen.getByTestId('window-title-cell')
    expect(node).toHaveAttribute('data-marquee-active', 'false')

    fireEvent.doubleClick(node)
    expect(node).toHaveAttribute('data-marquee-active', 'true')
    expect(node.textContent).toBe(text)

    fireEvent.doubleClick(node)
    expect(node).toHaveAttribute('data-marquee-active', 'false')
    expect(node.textContent).toBe(`${text.slice(0, 40)}${ELLIPSIS}`)
  })

  it('连续两次标题点击会切换 marquee 且阻止卡片选择冒泡', () => {
    const text = 'Long window title '.repeat(4)
    const parentClick = vi.fn()
    render(
      <div onClick={parentClick}>
        <TruncatedText
          text={text}
          maxChars={40}
          enableMarquee
          testId="window-title-cell"
        />
      </div>
    )

    const node = screen.getByTestId('window-title-cell')
    fireEvent.click(node, { detail: 1 })
    fireEvent.click(node, { detail: 1 })
    expect(node).toHaveAttribute('data-marquee-active', 'true')
    expect(parentClick).not.toHaveBeenCalled()

    fireEvent.click(node, { detail: 1 })
    fireEvent.click(node, { detail: 1 })
    expect(node).toHaveAttribute('data-marquee-active', 'false')
    expect(node.textContent).toBe(`${text.slice(0, 40)}${ELLIPSIS}`)
  })
})
