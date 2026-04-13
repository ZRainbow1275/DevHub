import path from 'path'
import fs from 'fs'
import os from 'os'

// Default allowed root directories
const DEFAULT_ALLOWED_ROOTS = [
  os.homedir(),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Desktop'),
  'C:\\Projects',
  'D:\\Projects',
  'D:\\Desktop'
]

/**
 * Validate that a path is safe and within allowed directories
 */
export function validatePath(
  inputPath: string,
  additionalAllowedPaths: string[] = []
): { valid: boolean; error?: string; normalized?: string } {
  try {
    // Resolve the path to absolute
    const normalized = path.resolve(inputPath)

    // Check for path traversal attempts
    if (normalized.includes('..')) {
      return { valid: false, error: 'Path traversal not allowed' }
    }

    // Check for suspicious characters
    const suspiciousPatterns = [
      /[<>"|?*]/,  // Invalid Windows characters
      /\0/,         // Null byte
      /;/,          // Command separator
      /\$/,         // Variable expansion
      /`/           // Command substitution
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(normalized)) {
        return { valid: false, error: 'Path contains invalid characters' }
      }
    }

    // Check if path exists
    if (!fs.existsSync(normalized)) {
      return { valid: false, error: 'Path does not exist' }
    }

    // Check if it's a directory
    const stats = fs.statSync(normalized)
    if (!stats.isDirectory()) {
      return { valid: false, error: 'Path is not a directory' }
    }

    // Combine default and additional allowed paths
    const allAllowedPaths = [...DEFAULT_ALLOWED_ROOTS, ...additionalAllowedPaths]

    // Check if path is within allowed roots
    const isAllowed = allAllowedPaths.some((root) => {
      const resolvedRoot = path.resolve(root)
      return normalized.toLowerCase().startsWith(resolvedRoot.toLowerCase())
    })

    if (!isAllowed) {
      return {
        valid: false,
        error: 'Path is not within allowed directories. Add it to allowed paths in settings.'
      }
    }

    // Detect symlinks pointing outside allowed paths
    try {
      const realPath = fs.realpathSync(normalized)
      if (realPath.toLowerCase() !== normalized.toLowerCase()) {
        const isRealAllowed = allAllowedPaths.some(root =>
          realPath.toLowerCase().startsWith(path.resolve(root).toLowerCase())
        )
        if (!isRealAllowed) {
          return { valid: false, error: 'Symlink target outside allowed paths' }
        }
      }
    } catch {
      // realpathSync may fail for some paths, continue
    }

    return { valid: true, normalized }
  } catch {
    return { valid: false, error: 'Invalid path format' }
  }
}

/**
 * Validate that a script name is safe
 */
export function validateScriptName(scriptName: string): boolean {
  // Only allow alphanumeric, dash, underscore, colon
  const validPattern = /^[a-zA-Z0-9_:-]+$/
  return validPattern.test(scriptName)
}

/**
 * Parse package.json and extract available scripts.
 * Kept for backward compatibility. Use parseProjectConfig for multi-type support.
 */
export function parsePackageJson(projectPath: string): {
  valid: boolean
  name?: string
  scripts?: string[]
  projectType?: import('@shared/types').ProjectType
  error?: string
} {
  return parseProjectConfig(projectPath)
}

/**
 * Parse project configuration files and extract metadata.
 * Supports multi-ecosystem project detection (npm, pnpm, yarn, Rust, Go, Python, Java).
 * Uses synchronous fs for IPC handler compatibility.
 */
export function parseProjectConfig(projectPath: string): {
  valid: boolean
  name?: string
  scripts?: string[]
  projectType?: import('@shared/types').ProjectType
  error?: string
} {
  // Check for package.json (npm/pnpm/yarn)
  const pkgPath = path.join(projectPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8')
      const pkg = JSON.parse(content)
      const name = pkg.name || path.basename(projectPath)
      const scripts = pkg.scripts ? Object.keys(pkg.scripts) : []

      // Determine specific package manager
      let projectType: import('@shared/types').ProjectType = 'npm'
      if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
        projectType = 'pnpm'
      } else if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
        projectType = 'yarn'
      }

      return { valid: true, name, scripts, projectType }
    } catch {
      return { valid: false, error: 'Failed to parse package.json' }
    }
  }

  // Check for Cargo.toml (Rust)
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    return {
      valid: true,
      name: path.basename(projectPath),
      scripts: ['run', 'build', 'test', 'check', 'clippy'],
      projectType: 'rust'
    }
  }

  // Check for go.mod (Go)
  const goModPath = path.join(projectPath, 'go.mod')
  if (fs.existsSync(goModPath)) {
    try {
      const content = fs.readFileSync(goModPath, 'utf-8')
      const moduleMatch = content.match(/^module\s+(\S+)/m)
      const moduleName = moduleMatch ? moduleMatch[1] : path.basename(projectPath)
      const name = moduleName.includes('/') ? moduleName.split('/').pop()! : moduleName
      return {
        valid: true,
        name,
        scripts: ['run', 'build', 'test', 'vet'],
        projectType: 'go'
      }
    } catch {
      return {
        valid: true,
        name: path.basename(projectPath),
        scripts: ['run', 'build', 'test', 'vet'],
        projectType: 'go'
      }
    }
  }

  // Check for pom.xml (Maven)
  if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
    return {
      valid: true,
      name: path.basename(projectPath),
      scripts: ['compile', 'package', 'test', 'clean', 'install'],
      projectType: 'java-maven'
    }
  }

  // Check for build.gradle / build.gradle.kts (Gradle)
  if (fs.existsSync(path.join(projectPath, 'build.gradle')) ||
      fs.existsSync(path.join(projectPath, 'build.gradle.kts'))) {
    return {
      valid: true,
      name: path.basename(projectPath),
      scripts: ['build', 'run', 'test', 'clean', 'assemble'],
      projectType: 'java-gradle'
    }
  }

  // Check for pyproject.toml (Poetry)
  if (fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    return {
      valid: true,
      name: path.basename(projectPath),
      scripts: ['run', 'install', 'build', 'test'],
      projectType: 'poetry'
    }
  }

  // Check for environment.yml / environment.yaml (Conda)
  if (fs.existsSync(path.join(projectPath, 'environment.yml')) ||
      fs.existsSync(path.join(projectPath, 'environment.yaml'))) {
    return {
      valid: true,
      name: path.basename(projectPath),
      scripts: ['create', 'activate', 'install'],
      projectType: 'conda'
    }
  }

  // Check for Python venv projects — unified detection using consistent markers
  const hasRequirementsTxt = fs.existsSync(path.join(projectPath, 'requirements.txt'))
  const hasSetupPy = fs.existsSync(path.join(projectPath, 'setup.py'))
  const hasVenvDir = fs.existsSync(path.join(projectPath, 'venv')) ||
    fs.existsSync(path.join(projectPath, '.venv'))

  if (hasRequirementsTxt || hasSetupPy) {
    return {
      valid: true,
      name: path.basename(projectPath),
      scripts: hasVenvDir
        ? ['activate', 'install', 'run', 'test']
        : ['install', 'run', 'test'],
      projectType: 'venv'
    }
  }

  return { valid: false, error: 'No recognized project configuration found' }
}

/**
 * Sanitize a string for safe display
 */
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
