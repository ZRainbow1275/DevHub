import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SIGNAL_SOURCES, type SignalContributionSnapshot, type SignalSource, type WeightProfile } from '@shared/schemas/signal-fusion'
import { SignalWeightPanel } from './SignalWeightPanel'

function weights(value: number): Record<SignalSource, number> {
  return SIGNAL_SOURCES.reduce<Record<SignalSource, number>>((record, source) => {
    record[source] = value
    return record
  }, {} as Record<SignalSource, number>)
}

function profile(profileId: WeightProfile['profileId'], value: number): WeightProfile {
  return { profileId, weights: weights(value), updatedAt: 1, validatedSum: true }
}

describe('SignalWeightPanel', () => {
  it('loads real fusion config bridge and saves user-custom weights without sample placeholders', async () => {
    const profiles = [profile('default', 1 / 6), profile('cli-heavy', 1 / 6), profile('window-heavy', 1 / 6), profile('user-custom', 1 / 6)]
    const snapshot: SignalContributionSnapshot = {
      instanceId: 'ai-real-1',
      contributions: SIGNAL_SOURCES.reduce<SignalContributionSnapshot['contributions']>((record, source) => {
        record[source] = { weight: 1 / 6, rawValue: 0.5, confidence: 0.8, contributionPct: 1 / 6, weightedValue: 0.1, effectiveWeight: 0.2, decayedConfidence: 0.8, ageMs: 0, stale: false }
        return record
      }, {} as SignalContributionSnapshot['contributions']),
      fusedProgress: { instanceId: 'ai-real-1', percent: 0.5, source: 'fusion', confidence: 0.8, observedAt: 1 },
      fusedAt: 1,
      state: 'working',
      profileId: 'default',
      sampleCount: 6,
      warnings: []
    }
    const setWeightProfile = vi.fn(async () => ({ success: true, profileId: 'user-custom', normalizedWeights: weights(1 / 6) }))
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: {
        r8: {
          ai: {
            listWeightProfiles: vi.fn(async () => profiles),
            fusionConfig: vi.fn(async () => ({ profileId: 'default', decayEnabled: true, minSourcesForFusion: 2, streamThrottleMs: 100 })),
            setWeightProfile,
            onFusionStream: vi.fn((listener: (payload: SignalContributionSnapshot) => void) => {
              listener(snapshot)
              return vi.fn()
            })
          }
        }
      }
    })

    render(<SignalWeightPanel />)

    expect(await screen.findByText('融合配置已加载')).toBeInTheDocument()
    expect(screen.getByText('ai-real-1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /保存自定义权重/ }))

    await waitFor(() => expect(setWeightProfile).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'user-custom', confirmedBy: 'signal-weight-panel' })))
  })
})
