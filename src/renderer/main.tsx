import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AnnouncementProvider } from './components/a11y/AnnouncementProvider'
import { LocaleProvider } from './components/i18n/LocaleProvider'
import './styles/globals.css'

function PreReactSplashDisposer(): null {
  React.useEffect(() => {
    document.getElementById('pre-react-splash')?.remove()
  }, [])
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreReactSplashDisposer />
    <LocaleProvider>
      <AnnouncementProvider>
        <App />
      </AnnouncementProvider>
    </LocaleProvider>
  </React.StrictMode>
)
