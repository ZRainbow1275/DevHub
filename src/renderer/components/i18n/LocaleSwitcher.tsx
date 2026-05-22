import type { Locale, LocaleManifest } from '@shared/schemas/r8-runtime'
import { useLocale } from './LocaleProvider'
import { useT } from '../../hooks/useT'

function statusLabel(status: LocaleManifest['status'], t: ReturnType<typeof useT>['t']): string {
  if (status === 'stable') return t('settings.locale.status.stable')
  if (status === 'preview') return t('settings.locale.status.preview')
  return t('settings.locale.status.partial')
}

export function LocaleSwitcher() {
  const { locale, manifests, changeLocale } = useLocale()
  const { t } = useT()

  return (
    <div className="rounded-sm border-2 border-surface-700 bg-surface-900 p-4" data-testid="locale-switcher">
      <div className="mb-3">
        <h4 className="text-sm font-bold text-text-primary">{t('settings.locale.title')}</h4>
        <p className="mt-1 text-xs text-text-muted">{t('settings.locale.description')}</p>
      </div>
      <label className="mb-2 block text-[10px] uppercase tracking-wider text-text-muted" htmlFor="locale-switcher-select">
        {t('settings.locale.current')}
      </label>
      <select
        className="w-full border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-text-primary outline-none focus:border-accent radius-sm"
        id="locale-switcher-select"
        onChange={(event) => {
          void changeLocale(event.target.value as Locale)
        }}
        value={locale}
      >
        {manifests.map(item => (
          <option key={item.locale} value={item.locale}>
            {item.nativeName} / {item.displayName}
          </option>
        ))}
      </select>
      <div className="mt-3 grid gap-2">
        {manifests.map(item => (
          <div className="flex items-center justify-between text-[11px] text-text-secondary" key={item.locale}>
            <span>{item.nativeName}</span>
            <span>{statusLabel(item.status, t)} · {t('settings.locale.coverage')} {(item.coverage * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
