# ADR 0004：Web 优先的技术基线

- **状态：** 接受
- **日期：** 2026-08-12
- **决策者：** 项目所有者与 Codex

## 背景

首阶段产品不是传统完整游戏，而是让儿童打开链接即可使用的《神秘岛》3D 阅读伴侣。它需要可漫游的低细节岛屿、章节选择、2D 地图、路线和阅读提示；不需要战斗、复杂物理、联网或高写实画面。

项目还要求关键世界能由代码与版本化数据重建，并希望把混元等生成式 3D 服务作为离线美术工具。技术选择因此应优先降低安装门槛、便于 HTML 阅读界面与 SVG 地图集成，并保持章节逻辑和 3D 引擎解耦。

本决定基于 2026-08-12 对 Babylon.js、Unity、Godot、Unreal、混元 3D、Blender 和 Web 资产流水线的调研。外部产品与版本会变化，具体实现时仍须核对官方文档。

## 决定

项目采用 **Web 优先** 路线，并以下列组件作为第一个技术纵切的基线：

| 职责 | 选择 |
|---|---|
| 浏览器 3D | Babylon.js |
| 语言 | TypeScript 严格模式 |
| 构建与依赖 | Vite、npm 与提交到仓库的锁文件 |
| 阅读/章节界面 | React、HTML、CSS |
| 2D 地图 | SVG |
| 内容 | JSON，经 JSON Schema 和运行时校验 |
| 3D 资产 | GLB/glTF 2.0 |
| 逻辑测试 | Vitest |
| 浏览器验证 | Playwright |
| 离线资产处理 | Blender 与 Python |
| 生成式 3D | 混元等服务的可替换离线适配器 |
| 大型二进制版本管理 | Git LFS（正式资产进入仓库时启用） |
| 持续集成 | GitHub Actions（出现可运行工程后配置） |

MVP 作为静态 Web 应用运行，不引入后端、数据库、账号或运行时混元调用。精确依赖版本不在 ADR 中写死；创建工程时由 `package.json` 和锁文件成为事实。

章节领域逻辑保持独立：

```text
版本化内容 JSON
       ↓
Chapter State Resolver（纯 TypeScript）
       ↓
Babylon.js 场景装配 + React/HTML 界面 + SVG 地图
```

Babylon.js 是已接受的**技术验证基线**，不是未经验证便永久锁定的引擎。先完成一个 3～5 天量级的小型纵切，再决定是否继续扩大。

## 原因

- 浏览器链接比安装原生应用更符合儿童阅读伴侣的进入方式。
- HTML/CSS/React 适合章节、提示、引用和无障碍界面；SVG 适合地图标记与路线。
- Babylon.js 能直接加载 GLB/glTF，并提供完成灰盒所需的相机、碰撞、高度图和 Web 3D 能力。
- TypeScript 与 JSON 让章节状态可测试、可审查，也符合“代码与数据驱动”的目标。
- 静态部署使 MVP 在没有服务器运维、账号与隐私负担的情况下成立。
- GLB 是混元输出、Blender 处理与浏览器运行时之间较直接的交付格式。

## 后果

### 正面

- 用户无需先安装游戏客户端即可体验。
- 3D、阅读 UI 和内容数据各自有清晰边界。
- 章节状态解析可脱离渲染引擎进行单元测试。
- 生成式 3D 服务可更换，不成为运行时单点依赖。
- 将来若更换 3D 引擎，领域数据和内容研究仍可保留。

### 代价与风险

- 浏览器在大型地形、内存、首次下载体积、移动端输入和 GPU 兼容性方面比桌面原生应用更受约束。
- Babylon.js 生态与团队经验需要通过原型验证，不能仅凭功能列表判断体验。
- React 与 Babylon.js 必须保持单向职责边界，否则容易出现两套状态互相覆盖。
- 混元服务能力、计费、下载链接有效期与许可可能变化；每次生产正式资产都要即时归档并复核条款。
- Web 发布不能自动解决儿童隐私、内容授权和无障碍问题，发布前仍需专门审查。

## 备选方案

- **Unity 6 LTS、URP 与 C#：** 原生游戏能力和成熟编辑器更强，若项目演变为重度游戏或浏览器纵切无法达到性能/操控目标，它是首选退路。当前阶段在免安装分发、HTML 阅读 UI 和代码化内容工作流上不如 Web 路线直接。
- **Godot：** 轻量且开源，但当前 C# Web 导出限制会迫使语言或平台妥协，暂不采用。
- **Unreal Engine：** 适合高画质大型原生游戏，但对本项目低细节阅读纵切而言开发与硬件成本过高。
- **先做 Unity WebGL：** 仍有浏览器分发能力，但包体、加载、HTML/SVG 集成和自动化内容工作流不如原生 Web 技术自然，暂不作为第一验证路径。

## 后续验证

第一个技术纵切必须同时证明：

1. 从高度图或确定性数据生成一座可识别的灰盒岛屿。
2. 键盘鼠标下可以漫游，并有重力、地面与基本碰撞。
3. 能加载至少一个 GLB 地标且尺度、朝向和材质正确。
4. SVG 地图能同步显示观察者位置与朝向。
5. 能加载一份章节 JSON，并通过章节切换改变至少一个地标的存在或可知状态。
6. `Chapter State Resolver` 的核心规则有不依赖浏览器的测试。
7. 静态生产构建可在选定的普通目标设备和浏览器中运行。

若这些条件在小型纵切中成立，则继续采用 Babylon.js，并补记浏览器矩阵、性能预算和锁定版本。若地形性能、操控体验、资产加载或浏览器兼容性存在无法以 MVP 成本解决的问题，则停止扩建 Web 实现，创建新的 ADR 评估 Unity；不要长期并行维护两套引擎。

## 调研入口

- [Babylon.js 功能规格](https://www.babylonjs.com/specifications/)
- [Unity 6 支持周期](https://unity.com/releases/unity-6/support)
- [Godot 功能与平台说明](https://docs.godotengine.org/en/stable/about/list_of_features.html)
- [Unreal Engine 硬件与软件规格](https://dev.epicgames.com/documentation/unreal-engine/hardware-and-software-specifications-for-unreal-engine)
- [腾讯混元生 3D API](https://cloud.tencent.com/document/product/1804/123447)
- [腾讯混元 3D 数据结构与结果有效期](https://cloud.tencent.com/document/product/1804/120828)
- [Blender 4.5 LTS 命令行文档](https://docs.blender.org/manual/en/4.5/advanced/command_line/arguments.html)
- [Git LFS](https://git-lfs.com/)
