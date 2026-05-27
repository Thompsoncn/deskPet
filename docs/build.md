# 打包与发布指南

> 模块 9 · 用 electron-builder 把项目打包成可分发的安装包。

## 前置条件

- Node.js LTS（项目验证过 v22 / v24）
- 已 `npm install`，`node_modules/` 就绪
- 应用图标：占位图标已通过 `npm run make-icon` 生成在 `assets/icon.png`。
  正式发布前替换为美术正式版本（同样命名 `assets/icon.png`，256×256 PNG 即可，electron-builder 会自动转 `.ico` / `.icns`）。

## 打包命令

| 命令 | 产出 | 用途 |
|---|---|---|
| `npm run dist` | `dist/deskPet-0.1.0-setup.exe` | 正式 Windows 安装包（NSIS） |
| `npm run dist:mac` | `dist/deskPet-0.1.0.dmg` | macOS 验证用 |
| `npm run dist:dir` | `dist/<platform>-unpacked/` | 不打安装包、只产 app 目录，调试包结构最快 |

所有输出都在 `dist/`（已被 `.gitignore` 忽略）。

## 打包行为

`package.json` 的 `build` 字段定义：

- **`appId`**：`com.deskpet.app`，给系统识别用
- **`productName`**：`deskPet`，最终安装包名
- **`asar: true` + `compression: 'maximum'`**：所有源码打成 `app.asar`，减小体积
- **`files`**：白名单
  ```
  main.js / preload.js / lib/**/* / renderer/**/* / assets/**/* / data/**/*
  ```
  排除：`*.md`、`.DS_Store`
- **Windows NSIS 配置**：
  - `oneClick: false`：让用户选安装目录（避免静默装到系统盘）
  - 桌面快捷方式 + 开始菜单快捷方式
  - 简体中文安装界面

> ⚠️ `lib/**/*` 必须在 files 里。模块 4-8 的纯逻辑（save / stats / speech / travel）都在 `lib/`，漏掉打包后启动就会找不到。

## 替换占位图标

并行轨道 A 出真图标后：

```bash
# 直接覆盖即可，electron-builder 会按平台转格式
cp <new-icon-256x256>.png assets/icon.png
npm run dist  # 重新打包
```

如果要分平台用不同图标：

```json
"win":   { "icon": "assets/icon-win.ico" },
"mac":   { "icon": "assets/icon-mac.icns" },
"linux": { "icon": "assets/icon-linux.png" }
```

## 资源压缩（推荐）

打 release 前对 `assets/` 下的 PNG 做无损压缩，能把 256×256 帧从 ~50KB 压到 ~15KB（PRD 第 8 章性能要求）：

```bash
# 安装一次
brew install pngquant   # macOS
# 或 sudo apt install pngquant   # Linux

# 批量压缩 assets/ 下所有 PNG（覆盖原文件）
find assets -name "*.png" -exec pngquant --quality=75-90 --skip-if-larger --force --output {} {} \;
```

执行后 git diff 检查体积；不满意可以从 git 还原。

## 开发模式

启动时加 `DESKPET_DEV=1` 进入开发模式，旅行系统时间会被缩到秒级，便于验证模块 8：

```bash
npm run start:dev
# 等价于 DESKPET_DEV=1 electron .
```

开发模式效果：
- 旅行触发间隔：48-96h → 30-60s
- 旅行时长：2-6h → 30-60s
- 触发概率：0.5%/check → 40%/check（wantsToTravel 95%/check）
- 右键菜单出现「[DEV] 立刻去旅行」

## 跨平台打包注意

- 在 macOS 上跑 `npm run dist` 也能打 Windows 安装包（electron-builder 跨编译），但代码签名功能受限。
- Windows 上签名需要 `.pfx` 证书 + `CSC_LINK` 环境变量，参考 [electron-builder code signing](https://www.electron.build/code-signing)。
- 第一版未签名的 `.exe` 在 Windows 上首次运行会有 SmartScreen 警告，用户需点「仍要运行」。
- 上架商店通常需要软件著作权登记证书（见 PRD 第 10.2 节），建议开发中后期就开始办，1-3 个月出证。

## 常见问题

**Q: `electron-builder` 报 icon 不存在？**
A: 先跑 `npm run make-icon` 生成占位图标，或确认 `assets/icon.png` 存在。

**Q: 打包后的 app 启动空白？**
A: 检查 `build.files` 是否包含全部运行时需要的目录（特别是 `lib/`、`data/`、`renderer/`）。

**Q: 存档去哪了？**
A: 用户数据在系统约定位置，不在 app 目录：
- Windows：`%APPDATA%\deskPet\savegame.json`
- macOS：`~/Library/Application Support/deskPet/savegame.json`
- Linux：`~/.config/deskPet/savegame.json`
卸载 app 不会清除存档，重装可继承之前的狗狗。

**Q: 打包体积太大？**
A: 运行资源压缩（上面那段），并在 `files` 里精确排除测试和文档（已加 `!**/*.md`）。
