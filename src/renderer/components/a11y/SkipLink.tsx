import { useT } from '../../hooks/useT'

export function SkipLink() {
  const { t } = useT()
  return (
    <a href="#main-content" className="skip-link">
      {t('a11y.skipToMain', '跳到主内容')}
    </a>
  )
}
