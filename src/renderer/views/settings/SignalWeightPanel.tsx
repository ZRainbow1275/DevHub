import { useEffect, useMemo, useState } from 'react'
import {
  SIGNAL_SOURCES,
  type FusionConfig,
  type SignalContributionSnapshot,
  type SignalSource,
  type WeightProfile,
  type WeightProfileId
} from '@shared/schemas/signal-fusion'
import { CheckIcon, SettingsIcon } from '../../components/icons'

type WeightDraft = Record<SignalSource, number>

const SOURCE_LABELS: Record<SignalSource, string> = {
  cli_parse: 'CLI 解析',
  window_title: '窗口标题',
  process_cpu_io: '进程 CPU/IO',
  task_queue: '任务队列',
  watchdog: 'Watchdog',
  user_feedback: '用户反馈'
}

const PROFILE_LABELS: Record<WeightProfileId, string> = {
  default: '默认均衡',
  'cli-heavy': 'CLI 优先',
  'window-heavy': '窗口优先',
  'user-custom': '自定义'
}

function emptyDraft(): WeightDraft {
  return SIGNAL_SOURCES.reduce<WeightDraft>((draft, source) => {
    draft[source] = 0
    return draft
  }, {} as WeightDraft)
}

function draftFromProfiles(profiles: WeightProfile[], profileId: WeightProfileId): WeightDraft {
  const profile = profiles.find(item => item.profileId === profileId) ?? profiles[0]
  return profile ? { ...profile.weights } : emptyDraft()
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function SignalWeightPanel() {
  const [profiles, setProfiles] = useState<WeightProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<WeightProfileId>('default')
  const [draft, setDraft] = useState<WeightDraft>(emptyDraft)
  const [config, setConfig] = useState<Partial<FusionConfig> | null>(null)
  const [latest, setLatest] = useState<SignalContributionSnapshot | null>(null)
  const [status, setStatus] = useState('等待加载融合配置')
  const api = window.devhub?.r8?.ai

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!api) {
        setStatus('当前 preload 未暴露 AI 融合配置接口')
        return
      }
      try {
        const [loadedProfiles, loadedConfig] = await Promise.all([
          api.listWeightProfiles(),
          api.fusionConfig()
        ])
        if (cancelled) return
        setProfiles(loadedProfiles)
        const profileId = (loadedConfig as { profileId?: WeightProfileId } | null)?.profileId ?? 'default'
        setActiveProfile(profileId)
        setDraft(draftFromProfiles(loadedProfiles, profileId))
        setConfig(loadedConfig as Partial<FusionConfig>)
        setStatus('融合配置已加载')
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : '融合配置加载失败')
      }
    }
    void load()
    const unsubscribe = api?.onFusionStream?.(payload => setLatest(payload))
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [api])

  const draftSum = useMemo(() => Object.values(draft).reduce((total, value) => total + value, 0), [draft])
  const contributionSum = useMemo(() => {
    if (!latest) return 0
    return Object.values(latest.contributions).reduce((total, contribution) => total + contribution.contributionPct, 0)
  }, [latest])

  const selectProfile = (profileId: WeightProfileId) => {
    setActiveProfile(profileId)
    setDraft(draftFromProfiles(profiles, profileId))
  }

  const updateWeight = (source: SignalSource, value: number) => {
    setDraft(current => ({ ...current, [source]: value }))
  }

  const saveProfile = async () => {
    if (!api) return
    try {
      const result = await api.setWeightProfile({ profileId: 'user-custom', weights: draft, confirmedBy: 'signal-weight-panel' }) as { normalizedWeights?: WeightDraft; profileId?: WeightProfileId; warning?: string }
      const normalized = result.normalizedWeights ?? draft
      setActiveProfile(result.profileId ?? 'user-custom')
      setDraft(normalized)
      const loadedProfiles = await api.listWeightProfiles()
      setProfiles(loadedProfiles)
      setStatus(result.warning ?? '自定义权重已保存并立即生效')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '权重保存失败')
    }
  }

  const updateConfig = async (patch: Partial<FusionConfig>) => {
    if (!api) return
    try {
      const next = await api.fusionConfig(patch) as Partial<FusionConfig>
      setConfig(next)
      setStatus('融合运行参数已更新')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '融合运行参数更新失败')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 p-4 bg-surface-800 border-l-3 border-accent radius-sm">
        <div className="flex items-center gap-3">
          <SettingsIcon size={18} className="text-accent" />
          <div>
            <h3 className="text-text-primary font-semibold">AI 信号融合权重</h3>
            <p className="text-xs text-text-muted">weighted mean + confidence decay + contribution transparency</p>
          </div>
        </div>
        <span className="text-xs text-text-muted font-mono">sum {draftSum.toFixed(3)}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(['default', 'cli-heavy', 'window-heavy', 'user-custom'] as WeightProfileId[]).map(profileId => (
          <button
            key={profileId}
            type="button"
            onClick={() => selectProfile(profileId)}
            className={`px-3 py-2 text-sm border radius-sm transition-colors ${activeProfile === profileId ? 'bg-accent text-white border-accent' : 'bg-surface-800 text-text-secondary border-surface-600 hover:bg-surface-700'}`}
          >
            {PROFILE_LABELS[profileId]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {SIGNAL_SOURCES.map(source => (
          <label key={source} className="block p-3 bg-surface-800 border-l-3 border-surface-600 radius-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">{SOURCE_LABELS[source]}</span>
              <span className="text-xs text-accent font-mono">{draft[source].toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={draft[source]}
              onChange={event => updateWeight(source, Number(event.target.value))}
              className="w-full h-1.5 bg-surface-600 appearance-none cursor-pointer accent-accent radius-none"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={saveProfile} className="px-4 py-2 bg-accent text-white text-sm hover:bg-accent-600 transition-colors radius-sm flex items-center gap-2">
          <CheckIcon size={14} />
          保存自定义权重
        </button>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          衰减
          <input
            type="checkbox"
            checked={config?.decayEnabled ?? true}
            onChange={event => void updateConfig({ decayEnabled: event.target.checked })}
          />
        </label>
        <span className="text-xs text-text-muted">minSources {config?.minSourcesForFusion ?? 2}</span>
        <span className="text-xs text-text-muted">stream {config?.streamThrottleMs ?? 100}ms</span>
      </div>

      <div className="p-3 bg-surface-800 border-l-3 border-surface-600 radius-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">最近融合贡献</span>
          <span className="text-xs text-text-muted font-mono">{latest ? latest.instanceId : 'no-stream'}</span>
        </div>
        {latest ? (
          <div className="space-y-2">
            {SIGNAL_SOURCES.map(source => (
              <div key={source} className="grid grid-cols-[96px_1fr_48px] gap-2 items-center text-xs">
                <span className="text-text-muted">{SOURCE_LABELS[source]}</span>
                <div className="h-2 bg-surface-700 radius-sm overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: pct(latest.contributions[source].contributionPct) }} />
                </div>

                <span className="text-text-secondary font-mono text-right">{pct(latest.contributions[source].contributionPct)}</span>
              </div>
            ))}
            <div className="text-[11px] text-text-muted">contribution sum {contributionSum.toFixed(3)}</div>
          </div>
        ) : (
          <p className="text-xs text-text-muted">等待真实 `ai:fusion-stream` 推送；不会使用模拟样本填充。</p>
        )}
      </div>

      <div className="text-xs text-text-muted">{status}</div>
    </div>
  )
}
