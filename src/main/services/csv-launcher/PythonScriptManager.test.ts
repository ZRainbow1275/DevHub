import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PythonScriptManager } from './PythonScriptManager'

describe('PythonScriptManager', () => {
  it('verifies the real devhub-batch.py sha256 manifest and rejects tampering', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-python-script-'))
    const appRoot = resolve(root)
    const scriptsDir = join(appRoot, 'scripts')
    const sourceScript = resolve(process.cwd(), 'scripts', 'devhub-batch.py')
    const scriptPath = join(scriptsDir, 'devhub-batch.py')
    const manifestPath = `${scriptPath}.sha256`

    await mkdir(scriptsDir, { recursive: true })
    await copyFile(sourceScript, scriptPath)
    const scriptBytes = await readFile(scriptPath)
    const hash = createHash('sha256').update(scriptBytes).digest('hex')
    await writeFile(manifestPath, `${hash}  scripts/devhub-batch.py\n`, 'utf8')

    try {
      const verified = await new PythonScriptManager(appRoot).verifyBatchScript()
      expect(verified.actualSha256).toBe(hash)

      await writeFile(scriptPath, `${await readFile(scriptPath, 'utf8')}\n# tampered\n`, 'utf8')
      await expect(new PythonScriptManager(appRoot).verifyBatchScript()).rejects.toThrow('E_INTEGRITY_FAIL')
    } finally {
      await rm(appRoot, { recursive: true, force: true })
    }
  })
})
