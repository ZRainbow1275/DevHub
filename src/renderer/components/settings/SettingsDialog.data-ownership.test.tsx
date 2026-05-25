import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import type {
  BackupBundle,
  DataOwnershipListEntriesRequest,
  DataOwnershipListEntriesResponse,
  DataOwnershipListPathsResponse,
  StatusbarConfig
} from '@shared/schemas/r8-runtime'
import { AnnouncementProvider } from '../a11y/AnnouncementProvider'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { createEmptyStatusAggregate } from '../statusbar/statusbar-model'
import { SettingsDialog } from './SettingsDialog'

function buildStatusbarConfig(): StatusbarConfig {
  const aggregate = createEmptyStatusAggregate(1000)
  return {
    updatedAt: 1000,
    tiles: aggregate.tiles
  }
}

function installDataOwnershipMock() {
  const paths: DataOwnershipListPathsResponse = {
    generatedAt: 1000,
    roots: [
      {
        rootId: 'settings-store',
        label: 'Settings store',
        description: 'Local settings JSON',
        category: 'settings',
        path: 'C:/Users/HP/AppData/Roaming/DevHub/devhub-config.json',
        kind: 'file',
        exists: true,
        fileCount: 1,
        sizeBytes: 256,
        updatedAt: 1000,
        truncated: false,
        sensitive: true,
        exportable: true
      },
      {
        rootId: 'skills',
        label: 'User skills',
        description: 'Local skill directories',
        category: 'skills',
        path: 'C:/Users/HP/AppData/Roaming/DevHub/skills',
        kind: 'directory',
        exists: true,
        fileCount: 1,
        sizeBytes: 512,
        updatedAt: 1100,
        truncated: false,
        sensitive: true,
        exportable: true
      }
    ]
  }

  const rootEntries: DataOwnershipListEntriesResponse = {
    rootId: 'skills',
    rootPath: 'C:/Users/HP/AppData/Roaming/DevHub/skills',
    relativePath: '',
    absolutePath: 'C:/Users/HP/AppData/Roaming/DevHub/skills',
    kind: 'directory',
    exists: true,
    entries: [
      {
        name: 'skill-one',
        relativePath: 'skill-one',
        kind: 'directory',
        sizeBytes: 0,
        updatedAt: 1200
      }
    ],
    entriesTruncated: false,
    generatedAt: 1200
  }

  const nestedEntries: DataOwnershipListEntriesResponse = {
    rootId: 'skills',
    rootPath: 'C:/Users/HP/AppData/Roaming/DevHub/skills',
    relativePath: 'skill-one',
    absolutePath: 'C:/Users/HP/AppData/Roaming/DevHub/skills/skill-one',
    kind: 'directory',
    exists: true,
    entries: [
      {
        name: 'SKILL.md',
        relativePath: 'skill-one/SKILL.md',
        kind: 'file',
        sizeBytes: 128,
        updatedAt: 1300
      }
    ],
    entriesTruncated: false,
    generatedAt: 1300
  }

  const exported: BackupBundle = {
    bundleId: 'bundle-data-ownership',
    backupId: 'backup-data-ownership',
    scope: ['settings', 'csv', 'skills', 'audit'],
    path: 'C:/Users/HP/AppData/Roaming/DevHub/r8-backups/bundle-data-ownership',
    zipPath: 'C:/Users/HP/AppData/Roaming/DevHub/r8-backups/bundle-data-ownership.zip',
    bytes: 2048,
    createdAt: 1400,
    createdBy: 'user'
  }

  const listPaths = vi.fn(async () => paths)
  const listEntries = vi.fn(async (request: DataOwnershipListEntriesRequest) => (
    request.relativePath === 'skill-one' ? nestedEntries : rootEntries
  ))
  const exportAll = vi.fn(async () => exported)
  const openPath = vi.fn(async () => '')

  Object.defineProperty(window, 'devhub', {
    value: {
      settings: {
        get: vi.fn(async () => DEFAULT_SETTINGS),
        update: vi.fn(async () => DEFAULT_SETTINGS)
      },
      system: {
        getDrives: vi.fn(async () => ['C'])
      },
      i18n: {
        getLocale: vi.fn(async () => ({ locale: 'zh-CN' })),
        setLocale: vi.fn(async (locale: 'zh-CN' | 'en-US') => ({ success: true, locale })),
        listLocales: vi.fn(async () => ({ manifest: [] }))
      },
      shell: {
        openPath
      },
      r8: {
        statusbar: {
          getConfig: vi.fn(async () => buildStatusbarConfig()),
          setConfig: vi.fn(async (config: StatusbarConfig) => config),
          reset: vi.fn(async () => buildStatusbarConfig())
        },
        dataOwnership: {
          listPaths,
          listEntries,
          exportAll
        }
      }
    } as unknown as Window['devhub'],
    writable: true,
    configurable: true
  })

  return { exportAll, listEntries, listPaths, openPath }
}

describe('SettingsDialog data ownership panel', () => {
  it('lists local storage paths, browses entries, and exports all data through the preload bridge', async () => {
    const bridge = installDataOwnershipMock()

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: /数据\s+OWNERSHIP/ }))

    await screen.findByTestId('data-ownership-panel')
    await screen.findByText('User skills')
    expect(bridge.listPaths).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('data-ownership-root-skills'))
    await screen.findByTestId('data-ownership-entry-skill-one')
    expect(bridge.listEntries).toHaveBeenCalledWith({ rootId: 'skills', relativePath: '' })

    fireEvent.click(screen.getByRole('button', { name: '查看' }))
    await screen.findByTestId('data-ownership-entry-SKILL.md')
    expect(bridge.listEntries).toHaveBeenCalledWith({ rootId: 'skills', relativePath: 'skill-one' })

    fireEvent.click(screen.getByTestId('data-ownership-export'))
    await screen.findByTestId('data-ownership-export-result')
    expect(bridge.exportAll).toHaveBeenCalledWith({ confirmedBy: 'data-ownership-panel' })

    fireEvent.click(screen.getByRole('button', { name: '打开导出文件' }))
    await waitFor(() => expect(bridge.openPath).toHaveBeenCalledWith('C:/Users/HP/AppData/Roaming/DevHub/r8-backups/bundle-data-ownership.zip'))
  })
})
