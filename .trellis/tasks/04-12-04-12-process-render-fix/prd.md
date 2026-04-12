# 进程渲染报错修复

## Goal
修复后端扫描到进程数据但前端渲染报错无法显示的问题。确保单个卡片失败不影响整体列表。

## Requirements
- 为每个进程/端口/窗口卡片包裹 React Error Boundary
- 后端进程数据返回前进行 schema 校验 + 默认值填充
- 前端所有数据字段使用可选链 `?.` 和空值合并 `??`
- 渲染失败的卡片显示降级 UI（进程名 + PID + "信息不完整"标记）
- 渲染失败时记录错误日志用于调试

## Acceptance Criteria
- [ ] 单个进程卡片渲染失败不影响其余卡片
- [ ] 失败卡片显示降级 UI 而非空白/崩溃
- [ ] 后端进程数据经过清洗标准化（无 null 崩溃）
- [ ] 端口卡片、窗口卡片同样有 Error Boundary
- [ ] 错误日志包含具体失败的进程数据

## Technical Notes
- 详细 spec: `prompts/0411/02-process-deep-probing-spec.md` § 5
- 批次: 第一批 (P0)
- 层级: Full Stack
