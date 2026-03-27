/**
 * Unified validation utilities for IPC handlers.
 * All input validation functions consolidated here to ensure consistency.
 * Uses TypeScript assertion functions where applicable.
 */

const PROTO_POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype']

/**
 * Guard against prototype pollution in objects received from IPC.
 * Throws if the object contains __proto__, constructor, or prototype keys.
 */
export function guardProtoPollution(obj: unknown, depth = 0): void {
  if (typeof obj !== 'object' || obj === null) return
  if (depth > 10) return // prevent stack overflow from deeply nested objects
  const keys = Object.keys(obj)
  for (const key of keys) {
    if (PROTO_POLLUTION_KEYS.includes(key)) {
      throw new Error('Invalid input: prototype pollution attempt detected')
    }
    guardProtoPollution((obj as Record<string, unknown>)[key], depth + 1)
  }
}

/**
 * Validate that a value is a valid process ID (positive integer within OS range).
 */
export function validatePid(pid: unknown): asserts pid is number {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0 || pid > 65535 * 1024) {
    throw new Error('Invalid PID: must be a positive integer within valid range')
  }
}

/**
 * Validate that a value is a valid port number (1-65535).
 */
export function validatePort(port: unknown): asserts port is number {
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port: must be an integer between 1 and 65535')
  }
}

/**
 * Validate that a value is an array of valid port numbers.
 */
export function validatePortArray(ports: unknown, maxItems = 100): asserts ports is number[] {
  if (!Array.isArray(ports)) {
    throw new Error('Invalid ports: must be an array')
  }
  if (ports.length > maxItems) {
    throw new Error(`Invalid ports: must contain at most ${maxItems} items`)
  }
  for (const p of ports) {
    validatePort(p)
  }
}

/**
 * Validate that a value is a valid window handle (positive integer).
 */
export function validateHwnd(hwnd: unknown, paramName = 'hwnd'): asserts hwnd is number {
  if (typeof hwnd !== 'number' || !Number.isInteger(hwnd) || hwnd <= 0) {
    throw new Error(`Invalid ${paramName}: must be a positive integer`)
  }
}

/**
 * Validate that a value is a non-empty string within length bounds.
 */
export function validateString(value: unknown, paramName: string, maxLength = 200): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${paramName}: must be a non-empty string`)
  }
  if (value.length > maxLength) {
    throw new Error(`Invalid ${paramName}: must be at most ${maxLength} characters`)
  }
}

/**
 * Validate an array of window handles.
 */
export function validateHwndArray(arr: unknown, paramName = 'windowHwnds', maxItems = 100): asserts arr is number[] {
  if (!Array.isArray(arr)) {
    throw new Error(`Invalid ${paramName}: must be an array`)
  }
  if (arr.length > maxItems) {
    throw new Error(`Invalid ${paramName}: must contain at most ${maxItems} items`)
  }
  for (const item of arr) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item <= 0) {
      throw new Error(`Invalid ${paramName}: all items must be positive integers`)
    }
  }
}

/**
 * Validate a tag or group name.
 * Allows letters, digits, Chinese characters, underscores, and hyphens.
 * Length: 1-50 characters after trimming.
 */
export function validateTagOrGroup(input: unknown): asserts input is string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string')
  }
  const trimmed = input.trim()
  if (trimmed.length < 1 || trimmed.length > 50) {
    throw new Error('Length must be 1-50 characters')
  }
  if (!/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/.test(trimmed)) {
    throw new Error('Invalid characters in name')
  }
}

/**
 * Helper to extract the trimmed value from a tag/group name.
 * Call after validateTagOrGroup to get the sanitized value.
 */
export function trimTagOrGroup(input: string): string {
  return input.trim()
}

/**
 * Validate that a value is a valid date string.
 */
export function validateDateString(value: unknown, paramName = 'date'): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${paramName}: must be a string`)
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ${paramName}: must be a valid date string`)
  }
}

/**
 * Validate that a value is a plain object (not null, not array).
 */
export function validateObject(value: unknown, paramName = 'input'): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${paramName}: must be an object`)
  }
}
