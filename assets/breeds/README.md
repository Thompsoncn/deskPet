# 美术帧投放说明

把每个品种每种动作的帧 PNG 按以下规则丢进对应子目录，**animator.js 会自动检测并切换到 PNG 模式**（覆盖程序化占位）。

## 命名

```
assets/breeds/{breed}/{action}/frame_{NNN}.png
```

- `{breed}`：`shiba` `corgi` `golden` `husky` `teddy` `zhongtian`
- `{action}`：`idle` `eat` `play`
- `{NNN}`：三位数序号，从 `001` 起，**连续不跳号**

示例：`assets/breeds/shiba/idle/frame_001.png` … `frame_006.png`

## 规格（详见 `docs/art-spec.md`）

- 画布 **256×256**，PNG 透明背景
- idle 6–8 帧，eat / play 8–12 帧
- 帧率 8–12 fps（animator 默认 10 fps，失焦时降到 4 fps）

## 验证

把帧放好后启动 `npm start`：

- 帧路径正确 → 看到真狗狗动起来
- 帧不全或不存在 → 自动回退到程序化占位（橙色圆 + 呼吸 + 眨眼）

## 与代码的契约

- 主进程通过 `ipcMain.handle('count-frames')` 用 `fs.readdir` 数文件
- 渲染端 `animator.js` 拼接 URL 加载 `<Image>`，全部 onload 成功才进 PNG 模式
- 任意一帧加载失败都会保留在程序化模式，不会卡死
