import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { AsciinemaCast } from '@shared/schemas/r8-runtime'
import { formatDuration } from './Timeline'

interface AsciinemaPlayerProps {
  cast: AsciinemaCast | null
  cursorOffsetMs: number
}

export function AsciinemaPlayer({ cast, cursorOffsetMs }: AsciinemaPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const [terminalError, setTerminalError] = useState<string | null>(null)
  const terminalColumns = cast?.width ?? 120
  const terminalRows = Math.min(Math.max(cast?.height ?? 24, 12), 40)
  const visibleText = useMemo(() => cast?.events
    .filter(event => event[0] * 1000 <= cursorOffsetMs)
    .map(event => event[2])
    .join('') ?? '', [cast?.events, cursorOffsetMs])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    try {
      const terminal = new Terminal({
        cols: terminalColumns,
        rows: terminalRows,
        convertEol: true,
        cursorBlink: false,
        disableStdin: true,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 12,
        lineHeight: 1.25,
        scrollback: 10000,
        theme: {
          background: '#050505',
          foreground: '#d8f7df',
          cursor: '#9be28f',
          selectionBackground: '#1f3a29'
        }
      })
      terminal.open(container)
      terminalRef.current = terminal
      setTerminalError(null)
      return () => {
        terminal.dispose()
        terminalRef.current = null
      }
    } catch (reason) {
      setTerminalError(errorMessage(reason))
      terminalRef.current = null
      return undefined
    }
  }, [terminalColumns, terminalRows])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    terminal.reset()
    terminal.write(visibleText || '等待 cast 输出')
  }, [visibleText])

  return (
    <section className="border border-surface-800 bg-surface-950 p-3 radius-md">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-accent">
        <span>asciinema cast</span>
        <span>{formatDuration(cursorOffsetMs)}</span>
      </div>
      <div className="border border-surface-800 bg-black p-2 radius-sm" data-testid="asciinema-player">
        <div className="xterm min-h-56 overflow-hidden" ref={containerRef} />
        <pre className="sr-only">{visibleText || '等待 cast 输出'}</pre>
      </div>
      {terminalError ? <div className="mt-2 text-xs text-warning">xterm 初始化失败，已保留本地 cast 文本：{terminalError}</div> : null}
    </section>
  )
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
