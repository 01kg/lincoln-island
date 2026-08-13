# Lincoln Island

一个帮助儿童阅读儒勒·凡尔纳《神秘岛》的可漫游 3D 章节地图。

读者选择书中的某一章，进入整座林肯岛在那个时刻的状态：亲自走过人物的路线，理解地标之间的关系，然后带着更清晰的空间感回到文字中。

## 当前状态

第一个 Web 技术纵切现在包含一块确定性生成的低多边形占位岛屿和基础第一人称步行。当前只验证灰盒空间、玩家边界和模块边界，尚未实现完整林肯岛、2D 地图或章节切换。

最新状态与明确的下一步见 [`docs/NOW.md`](docs/NOW.md)。

## 项目文档

- [`AGENTS.md`](AGENTS.md)：所有协作者的入口、工作规范与记忆更新协议。
- [`docs/VISION.md`](docs/VISION.md)：愿景、受众与体验原则。
- [`docs/MVP.md`](docs/MVP.md)：第一个可验证纵切及非目标。
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)：概念架构、世界分层和数据边界。
- [`docs/NOW.md`](docs/NOW.md)：项目当前快照与交接信息。
- [`docs/REFERENCES.md`](docs/REFERENCES.md)：原著、地图和资产来源登记。
- [`docs/decisions/README.md`](docs/decisions/README.md)：架构决策记录（ADR）索引。

## 当前原则

- 它首先是阅读伴侣，不是完整游戏。
- 章节是整座岛的时间切片。
- 先用灰盒验证“走进去能否帮助阅读”，再追求模型精度。
- 世界尽量由代码和版本化数据重建。
- AI 生成模型是美术生产工具，不是产品成立的前提。

## 开发（Docker 优先）

前提：安装并启动 Docker Desktop。默认不要求宿主机安装 Node/npm；依赖安装、测试和构建都在 Node 24.18.0 容器内完成，依赖锁定在 `package-lock.json` 中。Dockerfile 的依赖层执行 `npm ci`，`node_modules` 保留在镜像层；Compose 只读挂载源码到容器 `/app/source`，因此不会在宿主项目目录创建依赖目录。

```powershell
# 启动开发服务器（http://localhost:5173）
docker compose up --build -d

# 为一次人工复验指定可见的开发版本标识（可选）
$env:LINCOLN_BUILD_ID = 'dev-2.8-visible-camp'
docker compose up --build -d

# 查看服务日志（需要时）
docker compose logs -f web

# 在一次性容器中运行测试
docker compose run --rm web npm test

# 检查根 HTML 的 build id、静态诊断 HUD、入口模块和 Vite 预构建依赖
docker compose exec web npm run smoke:dev -- http://127.0.0.1:5173

# 审计依赖
docker compose run --rm web npm audit

# 构建 production 静态文件
docker build --target build --tag lincoln-island:build .

# 停止开发服务；删除容器和命名卷
docker compose down --volumes --remove-orphans
```

开发服务运行在非 root 用户下，并启用 init 与模块级健康检查。依赖安装只在镜像依赖层执行，避免初始化服务与 Web 服务竞争同一命名卷；Web 服务从只读源码挂载运行，宿主机编辑仍可触发热更新。Vite 优化缓存位于容器可写的 `/app/.vite-cache`，production 输出在 Compose 中位于 `/tmp/lincoln-island-dist`，不会写入只读源码树或宿主机；宿主机直接运行时默认分别使用项目内被忽略的 `.vite-cache` 和 `dist`。开发 HTML 与模块会返回 `Cache-Control: no-store`，右上角“技术诊断”会显示由 Vite 注入的版本标识；默认 Compose 值为 `dev-2.8-visible-camp`。人工复验请只打开 `http://localhost:5173/?v=dev-2.8-visible-camp` 并报告该版本行；初始画面应出现白门、分列两侧的红柱和黄标，以及白色路径。点击画布取得鼠标视角，使用 WASD 或方向键行走，按 R 返回营地并重新对准白门，按 Esc 释放鼠标。当前技术基线见 [ADR 0004](docs/decisions/0004-web-first-technical-baseline.md)，Docker 边界见 [ADR 0005](docs/decisions/0005-docker-first-local-development.md)。
