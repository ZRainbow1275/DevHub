import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildEditorExecutableCandidates,
  buildProjectOpenLaunchPlan,
  findExistingExecutable,
  getMissingTargetMessage
} from './projectLauncher'

const tempDirs: string[] = []

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('projectLauncher helpers', () => {
  it('优先使用 LOCALAPPDATA 中的 VS Code 安装路径', () => {
    const localAppData = 'C:\\Users\\HP\\AppData\\Local'
    const candidates = buildEditorExecutableCandidates('vscode', {
      LOCALAPPDATA: localAppData,
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)'
    })

    expect(candidates[0]).toBe(path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'))
    expect(candidates).toContain(path.join('C:\\Program Files', 'Microsoft VS Code', 'Code.exe'))
  })

  it('能定位第一个真实存在的编辑器路径', () => {
    const root = createTempDir('devhub-launcher-')
    const existing = path.join(root, 'Cursor.exe')
    writeFileSync(existing, '')

    expect(findExistingExecutable([
      path.join(root, 'Missing.exe'),
      existing,
      path.join(root, 'Later.exe')
    ])).toBe(existing)
  })

  it('终端启动计划会安全转义单引号路径', () => {
    const launchPlan = buildProjectOpenLaunchPlan('terminal', "D:\\Work\\O'Hara")

    expect(launchPlan?.command).toBe('powershell.exe')
    expect(launchPlan?.args).toEqual([
      '-NoExit',
      '-Command',
      "Set-Location -LiteralPath 'D:\\Work\\O''Hara'"
    ])
    expect(launchPlan?.windowsHide).toBe(false)
  })

  it('在找到真实编辑器可执行文件时返回编辑器启动计划', () => {
    const localAppData = createTempDir('devhub-vscode-')
    const installDir = path.join(localAppData, 'Programs', 'Microsoft VS Code')
    mkdirSync(installDir, { recursive: true })
    const executable = path.join(installDir, 'Code.exe')
    writeFileSync(executable, '')

    const launchPlan = buildProjectOpenLaunchPlan('vscode', 'D:\\Desktop\\CREATOR ONE\\devhub', {
      LOCALAPPDATA: localAppData
    })

    expect(launchPlan).toEqual({
      command: executable,
      args: ['D:\\Desktop\\CREATOR ONE\\devhub'],
      cwd: 'D:\\Desktop\\CREATOR ONE\\devhub',
      windowsHide: true
    })
  })

  it('缺失编辑器时给出明确错误消息', () => {
    expect(getMissingTargetMessage('vscode')).toContain('VS Code')
    expect(getMissingTargetMessage('cursor')).toContain('Cursor')
  })
})
