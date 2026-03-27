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
 * Parse package.json and extract available scripts
 */
export function parsePackageJson(projectPath: string): {
  valid: boolean
  name?: string
  scripts?: string[]
  error?: string
} {
  try {
    const pkgPath = path.join(projectPath, 'package.json')

    if (!fs.existsSync(pkgPath)) {
      return { valid: false, error: 'package.json not found' }
    }

    const content = fs.readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)

    const name = pkg.name || path.basename(projectPath)
    const scripts = pkg.scripts ? Object.keys(pkg.scripts) : []

    return { valid: true, name, scripts }
  } catch (_error) {
    return { valid: false, error: 'Failed to parse package.json' }
  }
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
