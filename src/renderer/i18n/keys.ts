import zhCN from './zh-CN.json'

type DotPrefix<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`

type DotKeys<TValue, Prefix extends string = ''> = {
  [Key in keyof TValue & string]: TValue[Key] extends string
    ? DotPrefix<Prefix, Key>
    : TValue[Key] extends Record<string, unknown>
      ? DotKeys<TValue[Key], DotPrefix<Prefix, Key>>
      : never
}[keyof TValue & string]

export type TranslationKey = DotKeys<typeof zhCN>

export const TRANSLATION_KEY_NAMESPACES = [
  'monitor',
  'settings',
  'drawer',
  'cmdk',
  'statusbar',
  'common',
  'errors',
  'notifications',
  'theme',
  'a11y',
  'ai-task',
  'window',
  'process',
  'port',
] as const

export const DEFAULT_TRANSLATION_RESOURCE = zhCN
