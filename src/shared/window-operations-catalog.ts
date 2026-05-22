import type { WindowOperationCatalogItem, WindowOperationKind } from './types-extended'

export const REQUIRED_WINDOW_OPERATION_KINDS: readonly WindowOperationKind[] = [
  'focus',
  'minimize',
  'maximize',
  'restore',
  'toggle-always-on-top',
  'screenshot',
  'close',
  'kill-process',
  'jump-process',
  'jump-port',
  'jump-ai-task',
  'toggle-favorite',
  'open-working-dir'
] as const

export const WINDOW_OPERATION_CATALOG: readonly WindowOperationCatalogItem[] = [
  {
    kind: 'focus',
    label: '聚焦 / 前置',
    description: '将窗口恢复并带到前台',
    category: 'state'
  },
  {
    kind: 'minimize',
    label: '最小化',
    description: '真实调用系统窗口最小化',
    category: 'state'
  },
  {
    kind: 'maximize',
    label: '最大化',
    description: '真实调用系统窗口最大化',
    category: 'state'
  },
  {
    kind: 'restore',
    label: '还原',
    description: '从最小化或最大化状态恢复窗口',
    category: 'state'
  },
  {
    kind: 'move-resize',
    label: '移动 / 调整尺寸',
    description: '按真实窗口矩形调用 WINDOW_MOVE',
    category: 'state'
  },
  {
    kind: 'toggle-always-on-top',
    label: '置顶 / 取消置顶',
    description: '切换窗口 always-on-top 状态',
    category: 'state'
  },
  {
    kind: 'set-opacity',
    label: '设置透明度',
    description: '调用 WINDOW_SET_OPACITY 调整窗口透明度',
    category: 'state'
  },
  {
    kind: 'screenshot',
    label: '截屏当前窗口',
    description: '按窗口矩形捕获真实屏幕区域并保存文件',
    category: 'capture'
  },
  {
    kind: 'copy-title',
    label: '复制窗口标题',
    description: '复制当前真实窗口标题到剪贴板',
    category: 'capture',
    requires: ['clipboard']
  },
  {
    kind: 'jump-process',
    label: '跳到所属进程',
    description: '打开进程视图并定位 PID',
    category: 'navigation',
    requires: ['pid']
  },
  {
    kind: 'jump-port',
    label: '跳到所属端口',
    description: '打开端口视图并定位同 PID 的端口',
    category: 'navigation',
    requires: ['pid', 'port']
  },
  {
    kind: 'jump-ai-task',
    label: '跳到所属 AI 任务',
    description: '打开 AI 任务视图并定位同 PID 任务',
    category: 'navigation',
    requires: ['ai-task']
  },
  {
    kind: 'open-working-dir',
    label: '打开工作目录',
    description: '打开所属进程可解析的真实目录',
    category: 'navigation',
    requires: ['pid']
  },
  {
    kind: 'open-project',
    label: '打开相关项目',
    description: '存在项目关联时跳转到项目上下文',
    category: 'navigation',
    requires: ['project']
  },
  {
    kind: 'toggle-favorite',
    label: '收藏 / 取消收藏',
    description: '按窗口指纹持久化收藏状态',
    category: 'metadata'
  },
  {
    kind: 'set-title',
    label: '编辑窗口标题',
    description: '写入外部窗口标题并同步本地展示',
    category: 'metadata'
  },
  {
    kind: 'send-safe-keys',
    label: '发送安全按键',
    description: '向目标窗口发送允许列表内的键盘事件，执行前必须确认目标窗口',
    category: 'state'
  },
  {
    kind: 'close',
    label: '关闭窗口',
    description: '向窗口发送真实关闭消息',
    category: 'danger',
    danger: true
  },
  {
    kind: 'kill-process',
    label: '结束所属进程',
    description: '调用进程管理器终止 PID',
    category: 'danger',
    requires: ['pid'],
    danger: true
  }
] as const

export function getWindowOperationByKind(kind: WindowOperationKind): WindowOperationCatalogItem {
  const operation = WINDOW_OPERATION_CATALOG.find(item => item.kind === kind)
  if (!operation) {
    throw new Error(`Unknown window operation: ${kind}`)
  }
  return operation
}
