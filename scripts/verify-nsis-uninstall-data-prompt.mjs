#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJsonPath = join(projectRoot, 'package.json')
const installerPath = join(projectRoot, 'build', 'installer.nsh')
const expectedIncludePath = 'build/installer.nsh'
const expectedProductName = 'DevHub'

function assertCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function assertPattern(content, pattern, message) {
  assertCondition(pattern.test(content), message)
}

function assertNoPattern(content, pattern, message) {
  assertCondition(!pattern.test(content), message)
}

async function main() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  const installerScript = await readFile(installerPath, 'utf8')
  const nsisConfig = packageJson.build?.nsis

  assertCondition(packageJson.build?.productName === expectedProductName, `build.productName must remain ${expectedProductName}`)
  assertCondition(nsisConfig?.include === expectedIncludePath, `build.nsis.include must be ${expectedIncludePath}`)
  assertCondition(nsisConfig?.oneClick === false, 'build.nsis.oneClick must remain false so users see assisted uninstall UI')
  assertCondition(nsisConfig?.deleteAppDataOnUninstall !== true, 'build.nsis.deleteAppDataOnUninstall must not auto-delete without the custom prompt')

  assertPattern(installerScript, /!macro\s+customUnInstall\b/, 'installer.nsh must define customUnInstall')
  assertPattern(installerScript, /\$\{ifNot\}\s+\$\{isUpdated\}/, 'uninstall data prompt must be skipped during update flows')
  assertPattern(installerScript, /MessageBox\s+MB_YESNO\|MB_ICONQUESTION\|MB_DEFBUTTON2/, 'uninstall data prompt must be an explicit Yes/No question defaulting to No')
  assertPattern(installerScript, /IDNO\s+devhub_keep_local_data/, 'No must skip local data deletion')
  assertPattern(installerScript, /RMDir\s+\/r\s+"\$APPDATA\\DevHub"/, 'uninstaller must delete only the DevHub roaming app-data directory')
  assertPattern(installerScript, /RMDir\s+\/r\s+"\$LOCALAPPDATA\\DevHub"/, 'uninstaller must delete only the DevHub local app-data directory')

  assertNoPattern(installerScript, /RMDir\s+\/r\s+"\$APPDATA"\b/, 'uninstaller must not delete the broad APPDATA directory')
  assertNoPattern(installerScript, /RMDir\s+\/r\s+"\$LOCALAPPDATA"\b/, 'uninstaller must not delete the broad LOCALAPPDATA directory')
  assertNoPattern(installerScript, /RMDir\s+\/r\s+"\$(PROFILE|DESKTOP|DOCUMENTS|INSTDIR)\\?"/, 'uninstaller must not delete broad profile, desktop, documents, or install directories')
  assertNoPattern(installerScript, /DEVHUB_USER_DATA_DIR/, 'uninstaller must not follow arbitrary DEVHUB_USER_DATA_DIR values')

  process.stdout.write('NSIS uninstall data prompt gate passed: prompt, update guard, and scoped delete paths verified.\n')
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
