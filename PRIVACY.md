# Privacy Policy

## English

DevHub is designed as a local-first Windows desktop application. By default, DevHub stores operational data on the local machine and does not upload telemetry, diagnostic packs, screenshots, CSV tasks, logs, process lists, window titles, or AI task content.

### Data Stored Locally

DevHub may store:

- Project paths and project metadata
- Settings and feature flags
- Process, port, window, and AI task history
- CSV task queue state and DAG editor data
- Local SKILL metadata and execution artifacts
- Diagnostic packs explicitly exported by the user
- Backup archives explicitly created by the user
- Local feedback records for detection correction

### Sensitive Data

DevHub redacts common secret patterns in diagnostic exports, including API-key-like strings, tokens, hostnames, usernames, command-line secrets, and environment fragments where supported by the active redaction rules. Renderer log storage also routes process output through a shared `logRedactor` module before it is stored or rendered, covering assignment-style secrets, bearer tokens, token prefixes, GitHub tokens, AWS access keys, JWT-like values, and URL credentials. Users should still review diagnostic packs before sharing them.

### Network Use

Idle R8 operation is intended to be zero-egress. DevHub may open a network connection only after an explicit user action such as opening an external link, using future update infrastructure, or manually uploading an artifact outside the app.

### User Control

Users can export settings, export diagnostic packs, create backups, delete backups, and remove local application data through documented workflows. The Windows NSIS uninstaller asks whether fixed DevHub app-data directories should be deleted and defaults to keeping local data.

## 中文

DevHub 是本地优先的 Windows 桌面应用。默认情况下，DevHub 将运行数据保存在本机，不上传遥测、诊断包、截图、CSV 任务、日志、进程列表、窗口标题或 AI 任务内容。

### 本地保存的数据

DevHub 可能保存：

- 项目路径和项目元数据
- 设置和功能开关
- 进程、端口、窗口和 AI 任务历史
- CSV 任务队列状态和 DAG 编辑器数据
- 本地 SKILL 元数据和执行产物
- 用户主动导出的诊断包
- 用户主动创建的备份
- 用于检测纠错的本地反馈记录

### 敏感数据

DevHub 会在诊断导出中脱敏常见 secret 模式，包括类似 API key 的字符串、token、主机名、用户名、命令行 secret 和环境片段。用户分享诊断包前仍应自行复核。

### 网络使用

R8 空闲运行的目标是零外发。只有用户主动执行外部链接、未来更新流程或在应用外手动上传产物等操作时，才应产生网络连接。

### 用户控制

用户可以导出设置、导出诊断包、创建备份、删除备份，并通过文档化流程清理本地应用数据。卸载时一并删除数据依赖安装器能力，当前 R8 runtime 单独跟踪该事项。
