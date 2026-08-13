# 概念架构

本文记录目前已经达成共识的系统边界。Web 优先技术基线已经接受；第一个工程纵切已建立 Docker 优先的 Vite/React/Babylon.js 入口，精确包版本已由 `package.json` 与 `package-lock.json` 记录，浏览器范围和性能预算仍待验证。

## 技术基线

当前实现方向见 [ADR 0004](decisions/0004-web-first-technical-baseline.md)：

- **运行平台：** 静态 Web 应用，MVP 不依赖后端。
- **3D 运行时：** Babylon.js。
- **语言与构建：** 严格模式 TypeScript、Vite、npm 锁文件。
- **阅读界面：** React 与 HTML/CSS；2D 地图优先使用 SVG。
- **内容数据：** JSON、JSON Schema 与运行时校验。
- **3D 交换格式：** GLB/glTF 2.0。
- **验证：** 纯逻辑单元测试和浏览器端到端测试。
- **离线资产工具：** Blender 及 Python；混元 3D 通过可替换的离线适配器接入。
- **本地开发入口：** Docker Desktop、明确版本的 Node 24.18.0 镜像、npm `package-lock.json` 和镜像内依赖层；开发进程以非 root 用户运行。
- **开发挂载边界：** Compose 将宿主源码只读挂载到容器 `/app/source`；Dockerfile 的依赖层依据锁文件执行 `npm ci` 并保留 `/app/node_modules`，不再使用初始化服务或共享依赖卷，避免只读源码挂载下的嵌套挂载点与卷竞争。
- **Vite 开发缓存：** `cacheDir` 由 `VITE_CACHE_DIR` 配置；Compose 指向容器内可写的 `/app/.vite-cache`，宿主机默认使用被忽略的项目 `.vite-cache`，避免在只读源码树或宿主机 `node_modules` 下生成优化缓存。
- **开发版本与缓存可见性：** Vite 在转换时将 `VITE_BUILD_ID` 注入页面 meta 与静态技术诊断 HUD；Compose 默认值为 `dev-2.7-visibility`，可由宿主 `LINCOLN_BUILD_ID` 覆盖。开发服务器对 HTML 与模块响应 `Cache-Control: no-store`，用于排查本地陈旧页面，不规定未来 production 托管的缓存策略。
- **构建输出边界：** `build.outDir` 由 `VITE_OUT_DIR` 配置；Compose 验证写入容器 `/tmp/lincoln-island-dist`，镜像 production 阶段和宿主机默认仍为 `dist`，避免只读源码挂载下回写产物。
- **TypeScript 增量缓存：** `tsc -b` 的 `.tsbuildinfo` 固定写入系统临时目录，避免只读源码挂载下回写 `node_modules/.tmp`；这不改变源码或依赖边界。
- **开发健康边界：** Compose 健康检查运行 `scripts/dev-server-smoke.mjs`，验证根 HTML 的 build id/no-store、静态诊断 HUD、入口/应用/界面模块和入口中发现的至少一个预构建依赖；仅根 HTML 返回 200 不视为开发服务可用。
- **当前灰盒实现：** `src/domain/terrain.ts` 以固定种子生成非矩形岛形、海岸和高地；Babylon.js 只负责将网格、海面、灯光和第一人称相机装配到场景。
- **灰盒诊断参照：** `src/domain/diagnostics.ts` 版本化定义三枚彩色形状标记和分段路径，`src/scene/createIslandScene.ts` 负责网格装配；场景以约 10Hz 的最小状态回调向 React 提供位置、原型方位、按键和 Pointer Lock 状态，页面角落的“技术诊断”HUD 不代表正式产品内容。
- **原型空间约定：** 假设 1 world unit ≈ 1 m；当前岛屿尺寸与形状是为体验压缩的原型假设，不是小说地理事实。
- **首屏边界：** React 首屏只加载 UI；Babylon 场景通过动态 import 懒加载，入口与场景 chunk 分开，避免把完整 Babylon 模块放入 UI 首屏。

Babylon.js 是当前实现基线，但长期采用仍须通过一个小型技术纵切。Unity 保留为验证失败时的迁移方向，而不是并行维护的第二套实现。

## 核心模型

世界不是“每章复制一个场景”，而是由一个稳定地理基础和所选章节的状态共同解析：

```text
章节世界 = 永久地理
         + 截至该章发生的建设与环境变化
         + 该章正在发生的路线与事件提示
         + 该章读者可以知道的名称与信息
```

## 四个逻辑层

### 1. 永久地理层

岛屿轮廓、海拔、海岸、山体、湖泊、河流、海湾和主要生境。它们通常跨章节存在，但允许少数重大事件改变。

### 2. 世界变化层

道路、桥梁、住所、窑炉、畜栏、农田、船只和自然事件造成的变化。对象以首次出现、改变和消失的章节为边界。

### 3. 阅读认知层

地名、地图标记、入口、秘密、人物身份和解释文字何时可以展示。物体“物理存在”不等于读者“已经知道”。该层承担防剧透责任。

### 4. 本章叙事层

人物路线、当前位置、阅读锚点和只与本章有关的提示。首版不要求重演完整剧情。

## 建议的数据实体

这些是语义草案，不是已锁定的 TypeScript 类型：

- `ChapterId`：可排序的章节标识，例如 `part1.chapter18`。
- `GeoFeature`：河流、山峰、海湾等稳定地理对象。
- `WorldObject`：可以随时间出现、变化或消失的实体。
- `KnowledgeMarker`：名称、说明、地图标记及其首次可知章节。
- `ChapterRoute`：人物、路径点、方向和阅读锚点。
- `AssetRecord`：模型、材质、音频等资产的来源、版本和许可。

示意数据：

```json
{
    "id": "example_bridge",
    "kind": "structure",
    "transform": {
        "position": [120, 8, 84],
        "rotation": [0, 90, 0]
    },
    "existsFrom": "part1.chapter17",
    "knownFrom": "part1.chapter18",
    "labelFrom": "part1.chapter18",
    "assetId": "bridge_placeholder"
}
```

示例名称与章节仅说明结构，不能当作小说事实引用。

## 运行边界

建议保持以下职责分离：

```text
Book/Research Data
        ↓
Chapter State Resolver
        ↓
World Assembler ─── Asset Catalog ─── GLB/glTF
        ↓                       
Babylon.js 3D World + React/HTML Reading UI + SVG Map
```

- **Research Data** 保存有出处的地点、章节、路线和时间信息。
- **Chapter State Resolver** 只回答某章应存在、应隐藏和应显示什么。
- **World Assembler** 根据稳定 ID 实例化对象，不理解小说剧情。
- **Asset Catalog** 将语义对象映射到占位或正式资产。
- **呈现层** 可以更换表现形式，但共享同一章节状态。

`Chapter State Resolver` 应保持为纯 TypeScript 领域逻辑，不依赖 Babylon.js 或 React。React 不保存 3D 世界事实，Babylon.js 不解释小说章节，JSON 内容也不直接操作场景对象。

## 代码驱动的含义

“代码驱动”不是拒绝可视化工具，而是确保关键世界状态可被数据和代码重建：

- 可以在编辑器中观察、调试和微调结果。
- 不把重要章节逻辑只藏在 Blender 文件、引擎检查器或单个场景的手工开关里。
- 必要的人工修正应导出为版本化数据，而不是仅存于某台机器。
- 自动导入应处理单位、朝向、原点、材质、碰撞和资源登记。

## 生成式 3D 资产边界

早期资产流水线建议为：

```text
资产规格 JSON → 文本/参考图 → 混元等生成服务 → 原始结果归档
             → Blender/Python 校正与验证 → GLB → 资产登记
```

生成结果必须经过尺寸、坐标原点、朝向、拓扑、UV、材质数量、碰撞代理、文件体积和性能检查。还须登记任务 ID、输入描述、服务/模型版本、获取日期和许可信息；短期下载链接不是可复现来源。地形、道路、路线和大量重复植被优先考虑程序化生成；独特地标和道具才优先使用生成式建模。

## 尚未决定

- 依赖的后续升级节奏、浏览器支持策略和性能预算。
- 首轮浏览器矩阵、输入方式和性能预算。
- 技术纵切已使用第一人称，但长期默认视角与是否开放视角切换仍待决定。
- 正式地形资产与坐标数据的方案；当前仅有确定性灰盒网格。
- 真实岛屿坐标尺度、压缩比例及快速旅行策略；当前 1 unit ≈ 1 m 仅为原型假设。
- 章节 JSON 的最终 Schema 与内容拆分粒度。
- 混元 API、开源本地模型或其他资产来源的具体选择。

这些选择应通过小型技术验证和 ADR 确认。
