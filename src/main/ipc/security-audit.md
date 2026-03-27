# IPC 通信安全审计

## 审计日期: 2026-01-17

### 已检查的 IPC Handlers

| Handler | 文件位置 | 风险评估 | 发现问题 |
|---------|---------|---------|---------|
| `projects:add` | ipc/index.ts:33 | 🟢 低 | 路径验证和 package.json 解析已实现 |
| `process:start` | ipc/index.ts:94 | 🟢 低 | 从 store 获取项目，脚本验证在 ProcessManager 中 |
| `shell:open-path` | ipc/index.ts:218 | 🔴 高 | **直接打开任意路径，无验证** |
| `dialog:open-directory` | ipc/index.ts:194 | 🟢 低 | 使用系统对话框，安全 |
| `projects:update` | ipc/index.ts:77 | 🟢 低 | 使用白名单过滤允许更新的字段 |
| `settings:update` | ipc/index.ts:143 | 🟡 中 | 无验证直接更新设置 |
| `projects:scan` | ipc/index.ts:224 | 🟡 中 | scanPath 参数未验证 |
| `projects:scan-directory` | ipc/index.ts:232 | 🟡 中 | dirPath 参数未验证 |

### 高风险发现

#### 1. shell:open-path 未验证输入
**位置:** `src/main/ipc/index.ts:218`
```typescript
ipcMain.handle('shell:open-path', async (_, path: string) => {
  return shell.openPath(path)
})
```
**问题:** 直接接受用户输入的路径并用 `shell.openPath()` 打开
**风险:** 可能被用于打开恶意文件或暴露敏感目录
**建议:**
- 添加路径白名单验证
- 仅允许打开已注册项目的目录

**修复建议:**
```typescript
ipcMain.handle('shell:open-path', async (_, path: string) => {
  // 验证路径是否为已注册项目
  const projects = appStore.getProjects()
  const isProjectPath = projects.some(p =>
    path.toLowerCase().startsWith(p.path.toLowerCase())
  )
  if (!isProjectPath) {
    throw new Error('Only project directories can be opened')
  }
  return shell.openPath(path)
})
```

### 中等风险发现

#### 2. settings:update 无验证
**位置:** `src/main/ipc/index.ts:143`
```typescript
ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_, updates) => {
  appStore.updateSettings(updates)
  return appStore.getSettings()
})
```
**问题:** 任何设置都可以被更新，没有验证
**建议:** 添加设置字段白名单验证

#### 3. projects:scan-directory 路径未验证
**位置:** `src/main/ipc/index.ts:232`
**问题:** 可以扫描任意目录
**风险:** 可能被用于探测敏感目录结构
**建议:** 限制扫描范围到允许的根目录

### 安全亮点

#### 1. projects:add 路径验证
**位置:** `src/main/ipc/index.ts:33-66`
✅ 使用 `validatePath()` 验证路径安全性
✅ 使用 `parsePackageJson()` 验证项目有效性
✅ 检查重复项目

#### 2. projects:update 字段白名单
**位置:** `src/main/ipc/index.ts:77-90`
✅ 只允许更新 name, tags, group, defaultScript
✅ 防止修改 path 等敏感字段

#### 3. process:start 项目验证
**位置:** `src/main/ipc/index.ts:94-109`
✅ 从 store 获取项目，不接受外部路径
✅ 脚本验证在 ProcessManager 中实现

### 建议修复优先级

| 优先级 | 问题 | 建议 |
|--------|------|------|
| P0 | shell:open-path | 添加项目路径验证 |
| P1 | projects:scan-directory | 限制扫描范围 |
| P2 | settings:update | 添加字段验证 |

### 后续行动

1. **立即修复 P0 问题** - shell:open-path 路径验证
2. **短期改进** - 限制扫描目录范围
3. **持续审计** - 新增 IPC handler 时遵循安全检查清单
