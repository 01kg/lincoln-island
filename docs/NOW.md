# 当前状态

**最后更新：** 2026-08-23
**阶段：** Web 技术纵切：2.9 移动可信度收敛
**当前里程碑：** 2.9 修复移动速度、R 复位和下海行为的一致性并完成两轮冷启动验证

## 已确定

- 产品首先是辅助儿童阅读《神秘岛》的可漫游 3D 章节地图，不是完整生存游戏。
- 选择章节会使整座岛呈现该章的状态。
- 世界需要区分永久地理、随章节发生的变化、读者当时已知的信息和本章路线。
- 首个纵切应先用灰盒验证空间理解，避免过早投入精细建模。
- 仓库采用 `AGENTS.md` 为入口的文件化记忆机制。
- 产品采用 Web 优先路线；当前实现基线是 Babylon.js、TypeScript、Vite 和 React。
- Babylon.js 是否最终成为长期 3D 引擎，以一次小型技术纵切的结果为准；若关键验收失败，Unity 是首选退路。
- 内容采用版本化 JSON；章节状态解析器保持为不依赖呈现层的纯 TypeScript 逻辑。
- 运行时资产统一优先使用 GLB/glTF；混元和 Blender 属于离线资产生产链，不是发布版本的运行时依赖。
- MVP 不引入后端、账号或数据库，首版作为静态 Web 应用发布。

## 已完成

- 建立项目愿景、MVP、概念架构和当前状态文档。
- 建立 ADR 决策记录及模板。
- 添加 Web/Node 友好且兼容 Unity 退路的 `.gitignore`、文本规范和二进制属性。
- 登记用户提供的林肯岛彩色地图为外部研究参考，未在来源与使用权明确前复制进仓库。
- 调研浏览器 3D、Unity、Godot、Unreal、混元 3D、Blender 与资产管理方案。
- 接受 ADR 0004：Web 优先，并以 Babylon.js 技术纵切作为继续投入的验证门。
- 接受 ADR 0005：本地开发、测试与构建采用 Docker 优先入口。
- 建立第一个 Web 工程地基：Vite + React + strict TypeScript + Babylon.js，保留 `domain/`、`scene/`、`ui/` 模块边界。
- 增加 Dockerfile、Compose、`.dockerignore` 和 npm `package-lock.json`；Node 基线固定为 24.18.0，开发服务使用非 root 用户、init、健康检查和命名卷。
- 建立固定种子岛屿灰盒、海岸/高地、第一人称步行、重力碰撞和水平边界恢复；地形与玩家边界规则位于纯 TypeScript domain 层并有测试。
- 通过 Babylon 子路径导入和场景动态懒加载，将入口 chunk 从约 5.82 MB 降至约 188.50 kB（gzip 约 59.97 kB）；场景 chunk 约 1.22 MB（gzip 约 297.26 kB）。
- 修复 Windows Docker Desktop 下 Compose 的开发挂载边界：源码只读挂载到容器 `/app/source`，依赖由 Dockerfile 锁文件层执行 `npm ci` 并保留在镜像内；移除不必要的依赖初始化服务和共享卷，不再嵌套挂载到只读源码路径。
- 修复诊断营地复位朝向：复位目标从“营地原点 + 前向量”改为“出生位移 + 前向量”，避免刚进入时相机抬头看天；并开启 Vite 文件轮询监听以提升 Docker 下热重载稳定性。
- 新增 `Space` 跳跃能力（含冷却防抖），并修复“掉入海里只在有方向输入时继续下沉”的行为：陆地上的空格会执行固定的可见跳跃弧线；FreeCamera 已开启连续重力（不再需方向键维持），海区下沉在相机输入完成后的每一渲染帧执行，直到低于阈值触发复位。
- 海水下不保留地形侧壁或绿色面片；邻近高地标记为有碰撞的绿色七边锥形山体，底座深入海面以下，占位风格仍为灰盒。

## 当前没有

- 页面空白回归已修复；用户已在普通浏览器人工确认鼠标与 WASD 移动有效，输入链路通过。诊断营地已通过自动 WebGL 可见性检查；普通浏览器的最终视觉复验、目标浏览器矩阵和性能预算仍待完成。
- 先前普通浏览器复验因画面几乎全深蓝、缺乏方向和空间参照，无法判断移动是否生效。现以岛内较低处独立的浅色可碰撞营地平台作为稳定出生面：白门位于出生点前方 7 m，红柱和黄标左右各前方约 6 m，路径从前方 1.8 m 开始；初始画面同时保留明亮海面和绿色陆地边缘。它们是版本化的技术诊断灰盒占位，不是正式林肯岛美术、地名或小说事实。
- 用户在第 2.6 复验时连静态 HUD 也未看见；服务端已确认包含最新源码，客户端复验重点转为：在普通浏览器确认首次进入后 HUD 是否显示 buildId 且视角已前向对齐。
- 完整林肯岛、章节状态、2D 地图和正式地标资产。
- 经版本核对的第一部分第 18 章地点与路线数据。
- 有授权、可随项目分发的地图底图或小说译文。
- 混元 API 凭据或正式 3D 资产流水线。

## 下一步

1. 确认用于研究的《神秘岛》版本、语言和章节编号，建立可引用的章节资料表。
2. 核对候选章节（第一部分第 18 章）涉及的地点、人物路线、当时已知地名和建设状态。
3. 确认参考地图的原始来源与使用权限；在此之前只抽取事实，不分发图片。
4. 在普通目标浏览器中人工验收 WebGL 初始化、点击进入视角、鼠标锁定、WASD/方向键、Esc 释放后，重点复核 `R` 复位首步是否抬升、进入海中后是否仍依赖持续按键下坠，以及移动速度是否与版本化参数一致。
5. 确认首次进入与复位后的相机朝向为水平前视（不再抬头看天），并保留 `R` 复位后 yaw 稳定一致。
6. 继续为章节状态解析器建立纯逻辑测试，并在不引入正式内容前验证静态构建与浏览器矩阵。
6. 根据 ADR 0004 的通过/退出条件决定保留 Babylon.js，或转向 Unity 技术纵切。

## 待确认问题

- 首轮明确支持哪些桌面/移动浏览器与输入设备？
- 用户期望采用哪个中文译本或原文作为章节事实基准？
- 第一个纵切是否最终采用第一部分第 18 章？
- 附件地图的作者、来源页面、许可证和是否允许改编/再分发是什么？
- 默认漫游采用第一人称、第三人称，还是允许切换？
- 岛屿灰盒在普通儿童家庭设备上的首个帧率、内存与下载体积预算是多少？

## 阻塞项

没有阻止继续研究和灰盒原型的硬阻塞。正式引用文本、提交地图或发布资产前，必须先解决对应来源与权限问题。

## 验证记录

- 2026-08-14：2.9.1 节点（`dev-2.9-movement`）完成“移动速度、R 复位、下海”三类异常收敛：速度参数集中到 `playerMovementConfig.walkSpeed`（当前 3.2），R 返回及海上恢复走“清空动量+短暂锁定”路径，避免直接干预 Babylon 垂直碰撞。
  - 复验事实（普通浏览器）：第 2.8 通过验证的四项（白门/红柱/黄标/路径可见、WASD 生效、鼠标视角有效、R 返回有效）仍成立；2.9 增补处理三项异常后保持通过。
  - 本轮修复说明：仅对异常行为做收敛，未改动营地布局、材质风格或正式阅读流程。
  - `npm run test`、`npm run build`、`npm audit` 在容器内通过；两轮冷启动 compose 均达成 `healthy`，宿主机未出现 `node_modules`、`dist`、`.vite-cache`。

- 2026-08-23：修正空格跳跃与海区下沉的运行时路径（`dev-2.9.2-input-sink`）。
  - 原跳跃判定错误地把悬空的诊断营地按岛屿地面高度比较，导致出生点被判为未落地；现按营地平台或地形的实际碰撞支撑高度判定，空格在平台和陆地上均可起跳。
  - 海区下沉移至 `onBeforeCameraRenderObservable`，在 FreeCamera 输入更新后每帧直接下降，且下沉速度为 2.4 m/s；HUD 会显示“海中下沉”，直到自动复位。
  - `docker compose exec web npm test -- src/domain/diagnostics.test.ts src/domain/terrain.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；已执行 `docker compose up -d --build`，健康检查通过，并确认浏览器加载新版本号。

- 2026-08-23：进一步修正 FreeCamera 的默认行为（`dev-2.9.3-vertical-motion`）。
  - `needMoveForGravity` 默认是 `false`，会导致相机仅在 `cameraDirection` 非零时处理重力，正是“松开方向键即停止下落”的直接根因；现显式开启连续重力。
  - 跳跃改用 FreeCamera 的碰撞感知垂直冲量（2.4）而非直接改坐标；HUD 新增“动作”，会明确显示“跳跃中”或“海中下沉”。
  - `docker compose exec web npm test -- src/domain/diagnostics.test.ts src/domain/terrain.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；重建后的开发服务健康，浏览器版本标识已核对。

- 2026-08-23：修正营地平台上的跳跃落地判定（`dev-2.9.4-jump-arc`）。
  - NullEngine 碰撞复现显示平台静止相机高度为 `7.801`，原判断上限为 `7.800`，浮点差使空格跳跃被拒绝。跳跃现不依赖该判定或 FreeCamera 的偏移碰撞坐标；在陆地上按空格即执行 520 ms、最高 2.4 m 的固定上升—下降弧线，再交还连续重力。
  - `docker compose exec web npm test -- src/domain/diagnostics.test.ts src/domain/terrain.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；开发服务健康，浏览器版本标识已核对。

- 2026-08-23：补足灰盒岛屿与高地的体积感。
  - 场景根据地形三角网格的单次边界边自动生成 cliff skirt，不改变版本化地形采样与可行走区域；高地占位物从低矮圆柱替换为七边锥形岩体。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts`（14 项）和 `docker compose exec web npm run build` 通过。

- 2026-08-23：按体验反馈移除地形中的绿色山包，保留独立高地占位物。
  - 地形采样仅保留缓坡；七边锥形山体改为绿色，高 12 m，底座下沉至海面下 3.4 m，使其从海中穿出。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts`（14 项）和 `docker compose exec web npm run build` 通过。

- 2026-08-23：清除海水下可见的绿色地形三角片，并调整高地轮廓。
  - 仅当四个顶点均在陆地上时才生成地形格子；锥形山的顶部直径改为 1.6 m，形成钝平顶。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts`（14 项）和 `docker compose exec web npm run build` 通过。

- 2026-08-23：按体验反馈加宽绿色高地：山脚直径为 8.6 m，平顶直径为 2.1 m；`docker compose exec web npm run build` 通过。

- 2026-08-23：移除海岸下沉侧壁，确保水下没有绿色地形面片；保留不延伸到水下的陆地表面和绿色锥形山；`docker compose exec web npm run build` 通过。
- 2026-08-23：水下状态现在直接隐藏陆地地形网格，避免任何陆地三角面从海水视角露出；绿色锥形山作为独立海上地标继续显示。
- 2026-08-23：进一步剔除海岸线附近低于 0.35 m 的浅水地形面，避免玩家在岸上朝水面看时仍看到绿色薄片。
- 2026-08-23：将绿色地形网格改为仅碰撞、不渲染，彻底清除锥形山旁残留的绿色曲面；绿色锥形山继续作为独立可见地标。
- 2026-08-23：修正开局相机缓慢上升：出生/复位高度改为与营地平台碰撞椭球一致的 2.051m，避免重力在进入世界后把视角从低处抬起。
- 2026-08-23：版本标识简化为 `0.9.5`；开局与 `R` 复位后保持重力冻结，首次方向键或空格输入时才恢复运动，避免空闲状态下再次出现视角上升。
- 2026-08-23：版本更新为 `0.9.6`；绿色锥形山山脚直径调整为 14m、顶部直径 3m，在保持 12m 高度和海下底座的同时降低坡度，便于攀爬。
- 2026-08-23：版本更新为 `0.9.7`；将绿色锥形山纳入陆地边界和坡面支撑逻辑，站在山坡上不会再被误判为海上或穿透后自动下沉。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；已重建开发服务并确认容器健康、`VITE_BUILD_ID=0.9.7`。
- 2026-08-23：版本更新为 `0.9.8`；将复位出生高度对齐到碰撞平台的实际站立高度 `8.4`，并把绿色锥形山的山脚半径扩大到 `12m`、山顶改为较宽的平台，降低攀爬坡度。
  - 自动化浏览器实际加载 HUD 显示版本 `0.9.8`、初始位置 `10.0 / 8.4 / 5.0`；复位后保持 `8.4`。容器健康检查通过；15 项领域测试和生产构建通过。
- 2026-08-23：版本更新为 `0.9.9`；将白色门改为蓝色发光传送门，走进门洞后会自动传送到绿色锥形山顶，并在 HUD 显示“山顶传送”。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.9`。
- 2026-08-23：版本更新为 `0.9.10`；在山顶放置程序化灰盒枪支，玩家靠近后自动拾取，枪体隐藏且 HUD 显示“已获得枪”；本版本不加入射击或战斗。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.10` 和“道具 未获得枪”。
- 2026-08-23：版本更新为 `0.9.11`；拾取枪支后可用鼠标左键开火，加入短冷却、可见弹道线、枪口闪光和 HUD 开火次数；不加入敌人、伤害或弹药。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.11`、道具未拾取和武器未装备。
- 2026-08-23：版本更新为 `0.9.12`；加入两个山顶灰盒敌人、敌人生命值、枪支命中扣血、玩家生命值和近距离接触伤害；敌人全部被击败或玩家生命耗尽时分别隐藏或复位。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.12`、生命 `100`、敌人剩余 `2`。
- 2026-08-23：版本更新为 `0.9.13`；将敌人移到山下诊断营地平台附近，并改为具备头、身体、双臂和双腿的人形灰盒模型，伤害逻辑保持不变。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.13`、生命 `100`、敌人剩余 `2`。
- 2026-08-23：版本更新为 `0.9.14`；将营地平台附近的人形敌人数量增加到 `10` 个，保持原有命中、伤害和复位机制。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.14`、生命 `100`、敌人剩余 `10`。
- 2026-08-23：版本更新为 `0.9.15`；加入 `12` 发弹匣与 `48` 发备用子弹，普通左键开火消耗子弹，抬头至天空后左键触发换弹，HUD 显示当前弹药。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.15`、弹药 `12 / 48`。
- 2026-08-23：版本更新为 `0.9.16`；为十个人形敌人增加眼睛、斜眉和嘴巴，形成清晰的警戒表情，战斗机制不变。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.16`、弹药 `12 / 48`、敌人剩余 `10`。
- 2026-08-23：版本更新为 `0.9.17`；敌人被击败后会保留并在约 `520ms` 内倒地，尸体再停留约 `3.2s` 后消失；复位会重新生成敌人。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，页面 HUD 实际显示版本 `0.9.17`、弹药 `12 / 48`、敌人剩余 `10`。
- 2026-08-23：版本更新为 `0.9.18`；传送到山顶后激活敌人的简单游走行为，敌人会在营地平台范围内移动并朝行进方向转身；不加入复杂追踪 AI。
  - `docker compose exec web npm test -- src/domain/terrain.test.ts src/domain/diagnostics.test.ts src/domain/playerInput.test.ts`（15 项）和 `docker compose exec web npm run build` 通过；容器健康检查通过，`VITE_BUILD_ID` 为 `0.9.18`，浏览器实际加载 HUD 显示版本 `0.9.18`、生命 `100`、敌人剩余 `10`。

- 2026-08-23：复位朝向修正已落库，容器内执行 `docker compose exec web npm test -- src/domain/diagnostics.test.ts` 通过；并补充 `vite` 本地监听配置（`watch.usePolling: true`）稳定 Docker 环境下热更新。开发文档更新为默认访问 `http://localhost:5173`，`?v=` 保留为版本核对手段。
  - 当前仍需你在普通浏览器 `Ctrl + F5` 后确认首次进入即是向前视角（不再抬头看天）。

- 2026-08-12：仓库初始化时仅发现 `.gitattributes`；没有既有代码或项目文件需要迁移。
- 2026-08-12：所有本地 Markdown 链接均可解析；文本文档通过严格 UTF-8 解码检查。
- 2026-08-12：当前终端未发现可执行的 `git` 命令，因此初始化完成后的 Git 状态尚未通过命令行核验。
- 2026-08-12：完成技术栈调研并接受 Web 优先策略；具体依赖版本留待创建脚手架时由锁文件记录。
- 2026-08-12：走访仓库实际文件后确认，原先只有治理文档与仓库配置；未发现 `package.json`、锁文件、`src/`、测试、章节 JSON、GLB/glTF 或可运行构建。该历史快照已由本节点建立的工程地基取代。
- 2026-08-12：复核 13 份 Markdown 的本地链接与 UTF-8 解码，未发现断链或编码错误。
- 2026-08-12：容器内 Vitest 通过（1 个测试文件、1 个测试）；`npm run build` 和 Docker `build --target build` 均通过。Vite 提示主 bundle 约 5.8 MB（gzip 约 1.3 MB），后续需评估代码分割与性能预算。
- 2026-08-12：完整 `npm audit` 首次发现 Vite 7.1.3 高危与 Vitest 3.2.4 严重开发依赖漏洞；已分别升级到 7.3.6 与 3.2.7，复验结果为 0 vulnerabilities。生产依赖单独审计同样为 0 vulnerabilities。
- 2026-08-12：Docker Compose 启动后开发服务健康检查为 healthy；测试完成后执行 `docker compose down --volumes --remove-orphans` 清理临时容器、网络和命名卷。
- 2026-08-13：用固定种子生成非矩形、四周临海并含高地的低多边形灰盒岛屿；`domain/terrain.ts` 保留采样、出生点和可行走边界规则，Babylon.js 场景负责网格装配。
- 2026-08-13：第一人称 FreeCamera 保留 Babylon 的正常重力/碰撞垂直运动；自定义规则只在离开陆地、跌至安全高度以下或明显脱离地形时恢复上一个安全位置。椭球高度与 offset 表达眼睛位置下方的身体碰撞假设，实际手感仍待浏览器验收。
- 2026-08-13：Babylon 模块改为子路径导入并懒加载场景：上一节点主 chunk 约 5.82 MB（gzip 1.30 MB），当前入口 chunk 约 188.50 kB（gzip 59.97 kB），场景懒加载 chunk 约 1.22 MB（gzip 297.26 kB）。Vite 仍提示场景 chunk 超过 500 kB，后续需继续评估。
- 2026-08-13：首次普通浏览器人工验收确认 WebGL 渲染和鼠标视角通过，但 WASD 无移动反应；根因为 FreeCamera 未显式登记键盘映射。本节点登记 W/↑、S/↓、A/←、D/→，点击进入视角时让 canvas 获取焦点；修复后的 WASD 移动待用户在普通浏览器复验。
- 2026-08-13：Codex 内置浏览器无法完成 Pointer Lock 互动，记录为工具验收限制；当前人工验收入口是普通浏览器。用户截图仅作本次验收证据，不复制进仓库。
- 2026-08-13：第 2.3 挂载修复后发现页面空白：Vite 仍尝试在只读 `/app/source/node_modules/.vite` 写优化缓存，且仅检查根 HTML 造成假健康。将 `cacheDir` 移至容器可写 `/app/.vite-cache`（宿主机默认 `.vite-cache`），并让健康检查/`smoke:dev` 请求根 HTML、`/src/main.tsx` 和一个预构建依赖；本节点冷启动验证页面模块链路。
- 2026-08-13：只读源码挂载下完整 `tsc -b` 还会尝试写 `/app/source/node_modules/.tmp`；已将增量构建信息移至 `/tmp`，并让 Vite 配置在无 Node 类型依赖时安全读取 `VITE_CACHE_DIR`。页面模块 smoke、测试、构建和审计均需在此边界下通过。
- 2026-08-13：同一只读挂载还会使 production build 默认写 `/app/source/dist` 失败；已将 Compose 验证的 `VITE_OUT_DIR` 指向 `/tmp/lincoln-island-dist`，默认镜像/宿主构建仍输出 `dist`。
- 2026-08-13：用户复验反馈点击后鼠标视角与 WASD 均无反应；检查发现视角请求原先绑定在 `click`（按下/抬起之后），Pointer Lock 被拒绝或延迟时容易错过直接用户手势。已改为 `pointerdown` 时聚焦 canvas 并请求锁定，拒绝时保留 Babylon 按住拖动回退；普通浏览器仍需用户复验，Codex 内置浏览器的 Pointer Lock 限制不作为产品结论。
- 2026-08-13：用户进一步复验确认进入 Pointer Lock 后鼠标正常，但一按 WASD/方向键画面冻结。根因为自定义安全守卫用连续 `sampleTerrainHeight + eyeHeight` 审判离散 Babylon 三角网格，按键移动后持续判定 unsafe 并回滚相机。已移除局部高度差判定：正常陆地高度、重力和碰撞完全交给 Babylon；自定义规则仅检查海岸外水平越界或低于全局灾难阈值，并在 safe→unsafe 转换时恢复一次、保留 rotation、清空待处理位移。修复后的普通浏览器移动与视角仍待用户复验。
- 2026-08-13：为诊断“全深蓝/无法判断移动”增加版本化 `domain/diagnostics.ts` 数据和 scene 装配：出生点前方朝向 z=2 的近白门/路径，左红柱、右黄标及分段路径标尺形成距离参照；React HUD 每约 100ms 显示位置、yaw/原型方位、按键和 Pointer Lock。自动 DOM smoke 可确认 HUD/画布/操作提示存在，但不替代普通浏览器的真实手感验收；Codex 内置浏览器的 WebGL shader 日志仍受工具环境限制。
- 2026-08-13：第 2.6 后用户未见静态 HUD，故增加 Vite 转换期 `VITE_BUILD_ID`（Compose 默认 `dev-2.7-visibility`）并在 HTML meta/技术诊断 HUD 显示；开发 HTML 与模块使用 `Cache-Control: no-store`，健康检查同时验证 build id 和 HUD 源模块。服务端最新版已确认，客户端陈旧页面或访问版本待用户通过带查询参数的单一 URL 报告版本行定位；这不是对缓存唯一根因的断言。
- 2026-08-13：第 2.7 后用户确认版本/HUD、鼠标和 WASD 均有效，输入链路人工通过；但 3D 仍全深蓝、看不见任何诊断标记。第 2.8 在岛内较低处建立独立平整的诊断营地：白门、红柱、黄标和路径均相对营地数据定义，初始相机显式对准白门；纯几何测试验证三枚标记位于初始视锥候选范围，冷启动后的 WebGL 截图实际显示浅色营地、白门、路径、红柱、黄标、海面和绿色陆地边缘。HUD 只报告候选、mesh active/ready，不把它误称为像素保证；普通浏览器最终视觉验收仍待用户完成。
- 2026-08-13：诊断 Windows Docker Desktop 下 `. : /app:ro` 与 `/app/node_modules` 命名卷的嵌套挂载冲突；最终改为源码 `/app/source:ro` 与镜像内依赖层，移除不必要的初始化服务和共享卷。两轮冷启动 Compose 均达到 `healthy` 且容器内 HTTP 返回 200；宿主项目目录无 `node_modules`/`dist` 产物。

## 给下一位协作者

先阅读根目录 `AGENTS.md`、ADR 0004 和 ADR 0005。当前工程节点只证明了渲染入口与容器化基础，不代表浏览器体验或 Babylon.js 已长期锁定。下一步应继续做小范围灰盒/浏览器验收，并处理当前 bundle 体积警告；内容侧则是把一个候选章节整理成带出处的“地点—路线—可知信息—世界变化”数据。两者都应保持小范围、可替换，不提前制作完整岛屿。

