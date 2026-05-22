# P5.2 — AI 任务卡片仍用 Emoji 而非工具原生 Logo [P2]

> Round: R6 · 2026-04-20
> 用户原话：**"出现了Emoji，而非这些AI工具自身的图标"**
> 截图：`屏幕截图 2026-04-15 195527.png`
> R5 锚点：`prompts/0415/07-ai-task-icons-and-duplicates.md`（未修复）

---

## 一、症状

截图显示：
- `Claude Code-1` 前缀是 🤖（U+1F916，机器人脸）
- 两个 `Codex CLI-1` 前缀都是 🧠（U+1F9E0，大脑）

用户明确要求用每个 AI 工具官方 Logo 替代 Emoji。

## 二、工具官方视觉资源

| 工具 | Logo | 获取来源 |
|------|------|---------|
| Claude Code | Anthropic 品牌渐变 + 文字 "C" | Anthropic brand guidelines（橙/紫渐变图形或字母标） |
| Codex CLI | OpenAI 花瓣标志（公开 SVG） | OpenAI brand assets |
| OpenCode | 需确认项目归属 | 项目 README / GitHub 仓库 |
| Gemini CLI | Google Gemini 星形（蓝紫渐变） | Google AI brand assets |

> **合规提醒**：使用第三方公司 Logo 需遵循其品牌使用条款。若存在版权/商标限制，可采用抽象化再设计（保留色调与形态）或 SVG 缩略形式。

## 三、验收契约

- [ ] 为每个已知 AI CLI 工具提供 16px/24px/32px SVG Logo
- [ ] 通过 `toolName` 字段路由到对应 SVG 组件
- [ ] 未知工具 fallback 到当前 Emoji（或通用 AI 图标）
- [ ] Logo 颜色跟随主题（暗色模式反色或保持品牌色可配置）
- [ ] SVG 文件放在 `src/renderer/assets/ai-tools/`

## 四、实现建议

```tsx
// src/renderer/components/monitor/AIToolIcon.tsx
const TOOL_LOGO: Record<string, React.ComponentType> = {
  'Claude Code': ClaudeLogo,
  'Codex CLI': CodexLogo,
  'OpenCode': OpenCodeLogo,
  'Gemini CLI': GeminiLogo,
};

export function AIToolIcon({ tool, size = 24 }: Props) {
  const Logo = TOOL_LOGO[tool] ?? GenericAILogo;
  return <Logo width={size} height={size} />;
}
```

## 五、关联

- R5 原文：`prompts/0415/07-ai-task-icons-and-duplicates.md`（含 R5-N5 重复卡片）
- 同时解决 R5-N5（重复卡片）见 `08-ai-progress-tracker-broken.md`
