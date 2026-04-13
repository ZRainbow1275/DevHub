import { useState, useEffect } from 'react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import { CloseIcon, PlusIcon, TagIcon, CheckIcon } from '../icons'

interface TagManagerDialogProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  currentTags: string[]
  onSave: (tags: string[]) => Promise<void>
}

const isElectron = typeof window !== 'undefined' && window.devhub !== undefined

export function TagManagerDialog({
  isOpen,
  onClose,
  projectName,
  currentTags,
  onSave
}: TagManagerDialogProps) {
  const { showToast } = useToast()
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags)
  const [newTag, setNewTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && isElectron) {
      window.devhub.tags.list().then(setAllTags)
      setSelectedTags(currentTags)
    }
  }, [isOpen, currentTags])

  const handleAddTag = async () => {
    const tag = newTag.trim()
    if (!tag || allTags.includes(tag)) return

    if (isElectron) {
      try {
        await window.devhub.tags.add(tag)
        setAllTags(prev => [...prev, tag])
      } catch (error) {
        showToast('error', error instanceof Error ? error.message : '添加标签失败')
      }
    }
    setNewTag('')
  }

  const handleRemoveTag = async (tag: string) => {
    if (isElectron) {
      try {
        await window.devhub.tags.remove(tag)
        setAllTags(prev => prev.filter(t => t !== tag))
        setSelectedTags(prev => prev.filter(t => t !== tag))
      } catch (error) {
        showToast('error', error instanceof Error ? error.message : '删除标签失败')
      }
    }
    setShowDeleteConfirm(null)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(selectedTags)
      onClose()
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '保存标签失败')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-manager-dialog-title"
          className="bg-surface-900 border-2 border-surface-600 w-full max-w-md mx-4 shadow-elevated relative radius-md"
        >
          {/* Diagonal decoration */}
          <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none radius-md" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-surface-700 relative z-10">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 bg-gold/20 flex items-center justify-center border-l-3 border-gold radius-sm"
              >
                <TagIcon size={20} className="text-gold" />
              </div>
              <div>
                <h2
                  id="tag-manager-dialog-title"
                  className="text-gold font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    transform: 'rotate(-1deg)',
                    transformOrigin: 'left center'
                  }}
                >
                  管理标签
                </h2>
                <p className="text-xs text-text-muted truncate max-w-[200px]">{projectName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-icon-sm text-text-muted hover:text-text-primary"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 relative z-10">
            {/* Existing Tags */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">选择标签</h3>
              {allTags.length === 0 ? (
                <p className="text-text-muted text-sm italic">暂无标签，请先创建</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <div key={tag} className="flex items-center gap-1 group">
                      <button
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 text-sm transition-all duration-200 border-l-2 ${
                          selectedTags.includes(tag)
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary border-surface-600'
                        } radius-sm`}
                      >
                        {selectedTags.includes(tag) && <CheckIcon size={12} className="inline mr-1" />}
                        {tag}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(tag)}
                        className="p-1 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                        title="删除标签"
                      >
                        <CloseIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Tag */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wide">创建新标签</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  placeholder="输入标签名..."
                  className="flex-1 px-4 py-2 bg-surface-800 border-2 border-surface-600 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent radius-sm"
                  maxLength={20}
                />
                <button
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                  className="px-4 py-2 bg-accent text-white text-sm hover:bg-accent-600 disabled:opacity-50 transition-colors border-l-2 border-accent radius-sm"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t-2 border-surface-700 relative z-10">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-text-secondary hover:bg-surface-800 transition-colors radius-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2.5 bg-accent text-white font-medium hover:bg-accent-600 disabled:opacity-50 transition-all border-l-2 border-accent radius-sm"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Tag Confirmation */}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        title="删除标签"
        message={`确定要删除标签 "${showDeleteConfirm}" 吗？这将从所有项目中移除该标签。`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => showDeleteConfirm && handleRemoveTag(showDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </>
  )
}
