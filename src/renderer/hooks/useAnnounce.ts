import { useContext } from 'react'
import { AnnouncementContext } from '../components/a11y/AnnouncementProvider'

export function useAnnounce() {
  const context = useContext(AnnouncementContext)
  if (!context) {
    throw new Error('AnnouncementProvider is not mounted')
  }
  return context.announce
}
