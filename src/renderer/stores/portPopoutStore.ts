import type { PortPopout } from '../components/popout/port-popout-model'
import { usePortStore } from './portStore'

export interface PortPopoutState {
  popouts: PortPopout[]
  setPopouts: (popouts: PortPopout[]) => void
  updatePopouts: (updater: (current: PortPopout[]) => PortPopout[]) => void
  resetPopoutSlice: () => void
}

export const usePortPopoutStore = usePortStore

export function resetPortPopoutStore() {
  usePortStore.getState().resetPopoutSlice()
}
