# dsh-codex-petcenter · 桌宠皮肤中心

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

把 **Codex 桌宠生态无缝接入 DeepSeek Harness（DSH）** 的桌宠皮肤中心插件。

DSH 的桌宠生态还在起步阶段，而 Codex 桌宠皮肤市场已经非常成熟——本插件直接采用 **Codex 桌宠框架与皮肤格式**（`pet.json` + `spritesheet.webp`），内置聚合皮肤市场，让你在 DSH 里一键**下载 / 卸载 / 切换**上千款社区桌宠皮肤，并渲染一只随 Agent 工作状态实时变化的动画桌宠。

![皮肤中心](https://cdn.jsdelivr.net/gh/bcdahb0-jpg/dsh-codex-petcenter@master/docs/screenshot-center.webp)（不显示，可直接点击显示）

> 皮肤市场聚合了 codex-pet.org 社区 1196+ 款宠物、GitHub `codex-pet` 主题仓库检索结果与内置精选皮肤，全部与 Codex 桌面端共享同一皮肤目录（`~/.codex/pets`），两边同步生效。

## ✨ 特性

- 🛒 **聚合皮肤市场（1227+ 款）**
  - **codex-pet.org 官网源**：社区图库全量同步（名称 / 作者 / 描述 / 标签 / 下载量），assets 直链下载
  - **GitHub 主题源**：自动检索 `codex-pet` / `codex-pets` 标签仓库，按 Star 排序并探测皮肤目录
  - **内置精选源**：26 款离线可用（米哈游角色、宝可梦、猫猫、DeepSeek 娘…）
  - 三源自动去重合并，1 小时缓存 + 手动「刷新市场」
- ⬇️ **一键安装 / 卸载 / 切换**：市场点「下载」即装，已装皮肤单选即切换、随时卸载
- 🔍 **搜索 + 标签筛选**：按名称 / 描述 / 作者 / 标签过滤，1227 款也不迷路
- 🎬 **逐帧动画**：完整支持 Codex 精灵表动画轨——待机、行走、挥手、跳跃、失败、等待、奔跑、审查、视线跟随，v2 皮肤双向注视
- 🤖 **状态驱动行为**：根据 Agent 当前阶段自动切换动画与气泡——思考、使用工具、等待批准、出错、完成、睡眠打盹
- 💬 **多会话对话框**：每个活跃会话一个毛玻璃气泡，单击折叠、双击跳转、悬停终止
- ⚙️ **设置面板**：皮肤选择、缩放/速度滑杆、动画/随机行为/置顶/点击穿透/空闲隐藏开关
- 💾 **持久化**：位置、缩放、速度与开关保存在 `$DSH_HOME/pet.json`，刷新/重启自动恢复

## 📸 截图

| 皮肤中心设置页 | 像素皮肤示例 |（不显示，可直接点击显示）
| --- | --- |
| ![皮肤中心](https://cdn.jsdelivr.net/gh/bcdahb0-jpg/dsh-codex-petcenter@master/docs/screenshot-center.webp) | ![星街彗星像素皮肤](https://cdn.jsdelivr.net/gh/bcdahb0-jpg/dsh-codex-petcenter@master/docs/skin-suisei.webp) |

## 🚀 安装

### 方式一：profile bundle（推荐）

把插件复制到 web profile 的 `node_modules`，并在 `dsh.profile.bundles` 中登记：

```bash
# 1. 复制插件包
cp -r dsh-codex-petcenter "$DSH_HOME/profiles/web/node_modules/"

# 2. 在 $DSH_HOME/profiles/web/package.json 中
#    - dependencies 添加: "dsh-codex-petcenter": "file:D:/path/to/dsh-codex-petcenter"
#    - dsh.profile.bundles 添加: "dsh-codex-petcenter"

# 3. 重启 DSH（插件集变化需要重启生效）
```

### 方式二：git 源安装

```bash
dsh plugin --profile web add github:bcdahb0-jpg/dsh-codex-petcenter
```

## 🛒 皮肤市场

| 来源 | 数量 | 说明 |
| --- | --- | --- |
| codex-pet.org | 1196+ | 社区图库全量同步，含作者/标签/下载量，assets 直链下载 |
| GitHub topic | 动态 | 检索 `codex-pet` / `codex-pets` 标签仓库，按 Star 排序 |
| 内置精选 | 26 | 离线可用：米哈游、宝可梦、猫猫、DeepSeek 娘 |

- 目录缓存于 `$DSH_HOME/petcenter-catalog.json`（1 小时 TTL），「刷新市场」按钮强制更新
- 皮肤下载到 `~/.codex/pets/<名字>/`，与 Codex 桌面端共享；装好后在 DSH 与 Codex 中同时可用
- 每个皮肤标注来源徽章（内置 / 官网 / GitHub）与作者

## 🎮 使用

| 操作 | 效果 |
| --- | --- |
| 市场点「下载」 | 安装皮肤（自动迁移到 DSH） |
| 已装皮肤单选 | 切换当前桌宠，即时生效 |
| 已装皮肤「卸载」 | 删除皮肤（Codex 与 DSH 目录同步清理） |
| 拖动桌宠 | 移动位置（自动保存） |
| 单击桌宠 | 随机互动（开心/挥手/跳跃） |
| 右键桌宠 | 菜单：随机散步 / 隐藏桌宠 / 退出 |
| 单击对话框 | 折叠 / 展开 |
| 双击对话框 | 跳转到对应会话并移除气泡 |
| 悬停进行中的对话框 | 显示 ⏹ 终止按钮，点击终止对话 |
| 设置 → 桌宠皮肤中心 | 皮肤管理、缩放、速度、行为开关、刷新市场 |

## 📦 皮肤格式

Codex 皮肤为 **8 列 × N 行精灵表**（192×208 单元格）：

| 行 | 动作 |
| --- | --- |
| 0 | 待机（idle） |
| 1 / 2 | 向右跑 / 向左跑 |
| 3 | 挥手 |
| 4 | 跳跃 |
| 5 | 失败 |
| 6 | 等待 |
| 7 | 奔跑 |
| 8 | 审查 |
| 9 / 10 | v2 皮肤左右注视 |

末尾全透明帧自动跳过，地面对齐按非透明像素自动计算。任何符合此格式的 Codex 皮肤放入 `~/.codex/pets/<名字>/` 即可被识别。

## 🏗️ 架构

```
lib/
├── index.js          # host 半：事件聚合 + webServer API + 皮肤安装/卸载/目录管理
├── catalog-remote.js # 动态市场源：codex-pet.org API + GitHub topic 检索 + 缓存
├── catalog.js        # 内置精选皮肤清单（26 款，离线兜底）
└── client.js         # client 半：动画渲染 + 皮肤中心管理 UI
```

- host 半使用 Node 原生 `node:fs` 与 `fetch`，通信走 `webServer` HTTP 路由（`/petcenter/*`）
- 皮肤下载三源兜底：jsDelivr CDN → raw.githubusercontent.com → GitHub API（含 Blob 大文件支持）
- client 半为标准 `window.__ModuleLoader__.load` bundle 格式，依赖 `slots` / `timer` / `sessions` 服务

## ⚖️ 致谢与许可证

- 基于 [mengyun233/dsh-codex-pet](https://github.com/mengyun233/dsh-codex-pet)（MIT）二次开发，扩展为皮肤中心形态
- 皮肤数据来源：codex-pet.org 社区（[网站](https://codex-pet.org)）、GitHub `codex-pet` 主题开源仓库、内置精选
- 角色形象版权归其原作者 / 权利人所有，本插件仅作技术演示与皮肤分发

MIT License
