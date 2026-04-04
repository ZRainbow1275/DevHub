# Task: project-discovery-rebuild

## Overview

重建项目探查系统，将当前仅支持 npm/package.json 的项目扫描器扩展为多生态系统项目发现引擎。支持 npm/pnpm/yarn/venv/conda/poetry/Rust/Go/Java 九种项目类型的自动检测。提供手动扫描和自动文件系统监听两种工作模式，实现项目的实时发现与管理。

## Requirements

### R1: 多项目类型检测引擎

- 扩展 `ProjectScanner.scanDirectory` 支持以下项目标识文件检测：

| 项目类型 | 标识文件 | 提取信息 |
|---------|---------|---------|
| npm | `package.json` + `package-lock.json` | name, scripts, dependencies |
| pnpm | `package.json` + `pnpm-lock.yaml` | name, scripts, dependencies |
| yarn | `package.json` + `yarn.lock` | name, scripts, dependencies |
| Python venv | `requirements.txt` + (`venv/` 或 `.venv/`) | name from dirname |
| Conda | `environment.yml` 或 `environment.yaml` | name from yaml |
| Poetry | `pyproject.toml`（含 `[tool.poetry]`） | name, scripts |
| Rust | `Cargo.toml` | package.name, binaries |
| Go | `go.mod` | module name |
| Java Maven | `pom.xml` | artifactId, groupId |
| Java Gradle | `build.gradle` 或 `build.gradle.kts` | project name |

- 新增 `ProjectType` 枚举类型：`'npm' | 'pnpm' | 'yarn' | 'venv' | 'conda' | 'poetry' | 'rust' | 'go' | 'java-maven' | 'java-gradle' | 'unknown'`
- 当目录同时匹配多种类型时（如同时有 `package.json` 和 `Cargo.toml`），返回所有匹配类型，优先级由用户选择

### R2: 类型系统扩展

- `ScanResult` 接口新增 `projectType: ProjectType` 字段，`scripts` 泛化为通用命令列表
- `Project` 接口新增 `projectType: ProjectType` 字段
- 向后兼容：现有无 `projectType` 字段的 Project 数据默认为 `'npm'`
- `IPC_CHANNELS` 新增 watcher 相关通道常量

### R3: 手动扫描模式增强

- 保持现有 `scanDirectory` / `scanCommonLocations` / `discoverProjectsIntelligently` API
- 扩展为多项目类型检测
- `parsePackageJson`（security.ts）泛化为 `detectProjectType` + `parseProjectConfig`
- IPC handler `PROJECTS_ADD` 支持非 npm 项目的添加验证

### R4: 自动监听模式（新增）

- 新建 `ProjectWatcher` 类（或集成到 ProjectScanner）
- 使用 `chokidar` 监听配置的扫描根目录
- 监听粒度：一级/二级目录下的项目标识文件变化（新增/删除）
- 变化事件 debounce：2-5 秒防抖
- 通过 IPC 推送 `projects:watcher-detected` 事件到渲染进程
- 应用退出时正确关闭 watcher（参照 ProcessManager.cleanup 模式）
- 设置面板新增 watcher 启停配置

### R5: preload 桥接层

- 暴露 watcher 启停和配置 API
- 更新 `window.devhub` 全局类型声明
- 保持与现有 API 模式一致

### R6: 前端适配

- `useProjects` hook 订阅 watcher 事件
- `projectStore` 适配 `projectType` 字段
- `AddProjectDialog` 展示检测到的项目类型
- `AutoDiscoveryDialog` 展示项目类型标识
- `ProjectList` 按项目类型显示图标/标签

### R7: ProcessManager 命令映射

- 建立项目类型到运行命令的映射表：
  - npm: `npm run <script>`
  - pnpm: `pnpm run <script>`
  - yarn: `yarn run <script>`
  - Rust: `cargo run`, `cargo build`, `cargo test`
  - Go: `go run .`, `go build`, `go test`
  - Python: `python <entry>`, `pip install -r requirements.txt`
  - Poetry: `poetry run <script>`
  - Conda: `conda run -n <env> <cmd>`
  - Java Maven: `mvn compile`, `mvn package`, `mvn test`
  - Java Gradle: `gradle build`, `gradle run`, `gradle test`
- ProcessManager.spawn 根据 projectType 选择正确的命令

## Acceptance Criteria

- [ ] `ProjectScanner.scanDirectory` 能正确检测所有 10 种项目类型的标识文件
- [ ] npm/pnpm/yarn 通过 lock 文件正确区分
- [ ] 扫描结果包含正确的 `projectType` 字段
- [ ] 手动扫描（`scanCommonLocations`）覆盖所有新项目类型
- [ ] `ProjectWatcher` 能实时检测指定目录下的新项目出现/删除
- [ ] watcher 事件有 debounce，不会频繁触发
- [ ] watcher 在应用退出时正确清理
- [ ] IPC handler 支持添加非 npm 项目
- [ ] 前端 UI 正确展示项目类型信息（图标/标签）
- [ ] ProcessManager 能根据项目类型启动正确的命令
- [ ] 现有 npm 项目数据向后兼容（自动标记为 'npm'）
- [ ] 所有测试通过，新增项目类型有测试覆盖
- [ ] chokidar 依赖正确安装和引入

## Technical Notes

### 1. 文件系统监听方案

推荐使用 `chokidar`（稳定跨平台，Electron 生态常用）。当前项目中没有任何 fs watcher 实现，这是全新功能。需要安装 chokidar 依赖。

### 2. 安全边界

`security.ts` 的路径验证逻辑（`isPathAllowed`, `sanitizePath`）必须保持不变。新增的 `detectProjectType` / `parseProjectConfig` 需复用相同的安全校验链。

### 3. 配置文件解析

新增依赖的可能性：
- TOML 解析（`@iarna/toml` 或 `toml`）— 用于 `Cargo.toml` 和 `pyproject.toml`
- YAML 解析（`yaml` 或 `js-yaml`）— 用于 `environment.yml` 和 `pnpm-lock.yaml`
- XML 解析（`fast-xml-parser`）— 用于 `pom.xml`

### 4. Scanner 模式参考

参考 `SystemProcessScanner` 的 `startAutoRefresh()` / `stopAutoRefresh()` 模式和回调通知机制（`onUpdate` / `onZombieDetected`），为 `ProjectWatcher` 设计类似接口。

### 5. 向后兼容策略

AppStore（electron-store）中已保存的 Project 数据没有 `projectType` 字段。迁移策略：读取时如果缺少该字段，默认设置为 `'npm'`。

### 6. IPC 速率限制

新增的 watcher 相关 IPC handler 需要应用 `rateLimiter.ts` 中的速率限制，防止高频事件洪泛。

## Out of Scope

- 项目模板创建/初始化功能
- 远程项目/SSH 连接的项目探查
- Docker/容器化项目检测
- Monorepo 工作区深层解析（如 pnpm workspace 内部包结构）
- 项目依赖分析/审计
- 自动安装依赖
- CI/CD 集成检测
