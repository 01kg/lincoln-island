# Lincoln Island

一个帮助儿童阅读儒勒·凡尔纳《神秘岛》的可漫游 3D 章节地图。

读者选择书中的某一章，进入整座林肯岛在那个时刻的状态：亲自走过人物的路线，理解地标之间的关系，然后带着更清晰的空间感回到文字中。

## 当前状态

目前可以进入一个明亮的 3D 灰盒营地，用鼠标观察、使用键盘行走，并在岛屿边缘触发安全返回。白门、红柱、黄标和分段路径都是用于验证方向感的临时参照物，并非正式林肯岛美术。

当前版本仍是技术纵切，尚未实现完整林肯岛、2D 地图或章节切换。

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

## 启动游戏

### 1. 准备 Docker Desktop

安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，等待界面显示 Docker Engine 正在运行。

不需要在电脑上另外安装 Node.js 或 npm。

### 2. 启动本地游戏

在仓库根目录打开 PowerShell，运行：

```powershell
docker compose up --build -d
```

首次启动需要下载基础镜像和前端依赖，可能需要几分钟。后续启动通常会更快。

查看服务是否已经准备好：

```powershell
docker compose ps
```

当 `web` 服务显示 `healthy`，即可进入游戏。

### 3. 用普通浏览器打开

访问：

[http://localhost:5173](http://localhost:5173)

建议使用普通的 Chrome、Edge 或 Firefox。Codex 内置浏览器目前不能可靠完成鼠标锁定交互，不适合人工漫游验收。

日常修改 `src/` 下的代码会通过 Vite 热更新自动呈现；不需要改 URL、重启 Docker 或强制刷新。只有改动 `compose.yaml`、`Dockerfile` 或开发环境变量时，才运行 `docker compose up --build -d`。若怀疑浏览器仍是旧页面，可按 `Ctrl + F5` 并确认右上角版本为 `0.9.18`（或你设置的 `LINCOLN_BUILD_ID`）。

## 操作方法

| 操作 | 按键 |
|---|---|
| 进入鼠标视角 | 点击 3D 画面 |
| 前后左右行走 | `W` `A` `S` `D` 或方向键 |
| 转动视角 | 移动鼠标 |
| 跳跃 | `空格键` |
| 返回诊断营地 | `R` |
| 释放鼠标 | `Esc` |

初始画面应能看到白门、左侧红柱、右侧黄标、分段路径、浅色平台及海陆边界。右上角“技术诊断”面板会显示位置、朝向、输入状态和当前版本。

## 停止游戏

在仓库根目录运行：

```powershell
docker compose down --volumes --remove-orphans
```

该命令会停止并清理本项目的开发容器和临时资源，不会删除源代码。

## 常见问题

### 页面打不开

确认 Docker Desktop 正在运行，然后检查：

```powershell
docker compose ps
docker compose logs --tail 100 web
```

如果服务没有启动，可先清理再重建：

```powershell
docker compose down --volumes --remove-orphans
docker compose up --build -d
```

### 页面空白或仍是旧版本

先确认右上角版本是否为 `0.9.18`。开发服务器已设置为不缓存 HTML 和开发模块；若问题仍在，请保存浏览器截图，并附上：

```powershell
docker compose ps
docker compose logs --tail 100 web
```

### 鼠标或键盘不能控制

- 使用普通 Chrome、Edge 或 Firefox，不要用 Codex 内置浏览器验收鼠标锁定。
- 先点击 3D 画面，再使用鼠标和 WASD。
- 查看右上角诊断面板是否显示按键和“已进入视角”。
- 按 `Esc` 释放鼠标后，可以重新点击画面进入。

## 开发者命令

项目采用 Docker 优先的开发方式。依赖、测试和构建都在 Node 24.18.0 容器中完成，宿主机不会生成 `node_modules`。

```powershell
# 启动或重建开发服务
docker compose up --build -d

# 指定可见的开发版本标识
$env:LINCOLN_BUILD_ID = '0.9.18'
docker compose up --build -d

# 持续查看日志
docker compose logs -f web

# 运行测试
docker compose run --rm web npm test

# 检查根 HTML 的 build id、静态诊断 HUD、入口模块和 Vite 预构建依赖
docker compose exec web npm run smoke:dev -- http://127.0.0.1:5173

# 安全审计
docker compose run --rm web npm audit

# 构建 production 静态文件
docker build --target build --tag lincoln-island:build .

# 停止并清理
docker compose down --volumes --remove-orphans
```

开发服务以非 root 用户运行，并启用 init、模块级健康检查和源码热更新。源码以只读方式挂载至容器；Vite 缓存和构建输出保留在容器可写目录，不污染宿主机。技术基线见 [ADR 0004](docs/decisions/0004-web-first-technical-baseline.md)，Docker 边界见 [ADR 0005](docs/decisions/0005-docker-first-local-development.md)。
