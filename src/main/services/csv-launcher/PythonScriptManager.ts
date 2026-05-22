import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface PythonBatchScriptInfo {
  scriptPath: string
  expectedSha256: string
  actualSha256: string
}

export class PythonScriptManager {
  constructor(private readonly appRoot: string = process.cwd()) {}

  async verifyBatchScript(): Promise<PythonBatchScriptInfo> {
    const scriptPath = resolve(this.appRoot, 'scripts', 'devhub-batch.py')
    const manifestPath = `${scriptPath}.sha256`
    const [script, manifest] = await Promise.all([readFile(scriptPath), readFile(manifestPath, 'utf8')])
    const expectedSha256 = manifest.trim().split(/\s+/)[0] ?? ''
    const actualSha256 = createHash('sha256').update(script).digest('hex')
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('E_INTEGRITY_FAIL:invalid python script sha256 manifest')
    if (actualSha256 !== expectedSha256) throw new Error('E_INTEGRITY_FAIL:python script sha256 mismatch')
    return { scriptPath, expectedSha256, actualSha256 }
  }
}
