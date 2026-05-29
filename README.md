# deskPet

> 一只常驻你桌面、会主动搭话、会偷偷去旅行寄明信片的虚拟狗狗。

基于 Electron + 原生 HTML/CSS/JS，纯本地运行，第一版只支持 Windows（macOS 可开发验证）。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 生成占位图标（首次必须）
npm run make-icon

# 3. 启动
npm start          # 正常模式
npm run start:dev  # 开发模式（旅行系统时间缩到秒级，便于验证）
```

首次启动会弹领养窗口：选品种（6 个）→ 选性别 → 起名字 → 进入桌面。

退出软件、删除存档可以重新领养：
```bash
# macOS
rm -f "$HOME/Library/Application Support/deskPet/savegame.json"
# Windows
del "%APPDATA%\deskPet\savegame.json"
```

## 项目状态

| 模块 | 状态 | 说明 |
|---|---|---|
| 1 桌面骨架 | ✅ | 透明无边框窗口、单实例、右键菜单、系统托盘（含「找回狗狗」） |
| 2 待机动画 | ✅ | PNG 帧 + 程序化占位双模 |
| 3 领养流程 | ✅ | 6 品种 / 公母 / 起名 |
| 4 本地存档 | ✅ | debounce 写盘 / 原子写 / 退出前 flush |
| 5 喂食 / 玩耍 | ✅ | 60s 冷却 / 数值更新 |
| 6 数值系统 | ✅ | 等级 1-20 / 5 种情绪 / 饥饿衰减 / 每日 exp 软上限 |
| 7 主动搭话 | ✅ | 加权抽词 / 15-20min 间隔 / 安静模式 / 350+ 条台词 |
| 8 旅行明信片 | ✅ | 状态机 + canvas 合成 + 相册 + 通知 |
| 9 打包 | ✅ | electron-builder + NSIS / DMG / AppImage |

完整执行方案：`~/.claude/plans/delegated-kindling-star.md`

## 项目结构

```
deskPet/
├── main.js               # Electron 主进程入口
├── preload.js            # 渲染端安全桥
├── lib/                  # 主进程纯逻辑模块（可单测）
│   ├── save.js           # 本地存档（debounce / 原子写）
│   ├── stats.js          # 数值规则（等级 / 情绪 / 饥饿）
│   ├── speech.js         # 台词抽取
│   └── travel.js         # 旅行状态机
├── renderer/             # 所有渲染端代码
│   ├── index.html        # 桌面狗狗主窗口
│   ├── adopt.html        # 领养弹窗
│   ├── postcard.html     # 明信片相册
│   ├── styles/*.css
│   └── scripts/
│       ├── animator.js   # 帧动画播放器
│       ├── adopt.js
│       ├── postcard.js   # 明信片 canvas 合成器
│       └── album.js
├── data/                 # 可调内容（台词 / 目的地 / 等级曲线）
│   ├── lines.json        # 350+ 条台词（按情绪 / 品种 / 时段 / 事件）
│   ├── destinations.json # 10 个旅行目的地
│   └── level-curve.json  # 等级经验曲线
├── assets/               # 美术资源（部分待补）
│   ├── breeds/{shiba|corgi|...}/{idle|eat|play}/frame_NNN.png
│   ├── postcards/scenes/{xinjiang|tibet|...}.jpg
│   └── icon.png          # 软件图标
├── scripts/
│   └── make-icon.js      # 占位图标生成器
└── docs/
    ├── PRD.md            # 产品需求文档
    ├── art-spec.md       # 美术规范
    ├── art-prompts.md    # AI 绘图 prompt 套件（轨道 A）
    └── build.md          # 打包指南
```

## 关键约定

- **存档路径**：`{userData}/savegame.json`，schema 版本 1。改字段时记得在 `lib/save.js` 的 `migrate()` 加迁移逻辑。
- **帧动画**：把帧丢到 `assets/breeds/{breed}/{action}/frame_NNN.png`，animator 自动检测并切到 PNG 模式；没有真帧就用 canvas 程序化占位。
- **明信片背景**：丢到 `assets/postcards/scenes/{id}.jpg`（id 见 `data/destinations.json`），没有就用程序化渐变 + 远山。
- **台词扩充**：直接编辑 `data/lines.json` 或 `data/destinations.json`，无需改代码。

## 打包发布

见 `docs/build.md`。

简版：
```bash
npm run dist        # Windows .exe 安装包
npm run dist:mac    # macOS .dmg（开发验证用）
npm run dist:dir    # 不打安装包，只产 unpacked 目录
```

## 开发

PRD 推荐「一个模块一个新对话窗口」推进，详见执行方案 `~/.claude/plans/delegated-kindling-star.md`。

### 单测（纯逻辑模块）

`lib/` 下的纯函数模块都有单测用例。当前没接 jest，通过 inline node 脚本运行，覆盖：

- `lib/stats.js`：等级跨越、每日上限、跨日重置、情绪 5 优先级、衰减边界
- `lib/speech.js`：加权抽桶、冷却 / 每日上限、本地日切
- `lib/travel.js`：状态机门、normal / eager 概率分布
