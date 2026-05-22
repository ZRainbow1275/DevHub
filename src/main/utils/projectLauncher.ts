import { spawn } from 'child_process'
import { shell } from 'electron'
import { existsSync } from 'fs'
import path from 'path'
import type { ProjectOpenTarget } from '@shared/types'

type LaunchPlan = {
  command: string
  args: string[]
  cwd?: string
  windowsHide?: boolean
}

type ProjectOpenEnv = NodeJS.ProcessEnv

export function buildEditorExecutableCandidates(
  target: Extract<ProjectOpenTarget, 'vscode' | 'cursor'>,
  env: ProjectOpenEnv = process.env
): string[] {
  const localAppData = env.LOCALAPPDATA
  const programFiles = env.ProgramFiles || env.ProgramW6432
  const programFilesX86 = env['ProgramFiles(x86)']

  const appName = target === 'vscode' ? 'Microsoft VS Code' : 'Cursor'
  const executable = target === 'vscode' ? 'Code.exe' : 'Cursor.exe'
  const candidates = [
    localAppData ? path.join(localAppData, 'Programs', appName, executable) : null,
    programFiles ? path.join(programFiles, appName, executable) : null,
    programFilesX86 ? path.join(programFilesX86, appName, executable) : null
  ]

  return candidates.filter((candidate): candidate is string => Boolean(candidate))
}

export function findExistingExecutable(candidates: string[]): string | null {
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

export function getMissingTargetMessage(target: Extract<ProjectOpenTarget, 'vscode' | 'cursor'>): string {
  return target === 'vscode'
    ? '未检测到 VS Code 可执行文件，请确认已安装后重试'
    : '未检测到 Cursor 可执行文件，请确认已安装后重试'
}

function escapePowerShellLiteralPath(projectPath: string): string {
  return projectPath.replace(/'/g, "''")
}

export function buildProjectOpenLaunchPlan(
  target: ProjectOpenTarget,
  projectPath: string,
  env: ProjectOpenEnv = process.env
): LaunchPlan | null {
  if (target === 'explorer') {
    return null
  }

  if (target === 'terminal') {
    return {
      command: 'powershell.exe',
      args: [
        '-NoExit',
        '-Command',
        `Set-Location -LiteralPath '${escapePowerShellLiteralPath(projectPath)}'`
      ],
      cwd: projectPath,
      windowsHide: false
    }
  }

  const executable = findExistingExecutable(buildEditorExecutableCandidates(target, env))
  if (!executable) {
    return null
  }

  return {
    command: executable,
    args: [projectPath],
    cwd: projectPath,
    windowsHide: true
  }
}

export async function launchDetachedProcess(plan: LaunchPlan): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: plan.windowsHide ?? true
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export async function openProjectInTarget(
  target: ProjectOpenTarget,
  projectPath: string,
  env: ProjectOpenEnv = process.env
): Promise<void> {
  if (target === 'explorer') {
    const error = await shell.openPath(projectPath)
    if (error) {
      throw new Error(error)
    }
    return
  }

  const plan = buildProjectOpenLaunchPlan(target, projectPath, env)
  if (!plan) {
    if (target === 'terminal') {
      throw new Error('打开终端失败')
    }
    throw new Error(getMissingTargetMessage(target))
  }

  await launchDetachedProcess(plan)
}
