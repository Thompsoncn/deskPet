# 测试方案

> 自动化为主、人工冒烟为辅。每次改完核心逻辑都应跑 `npm test`。

## 一键运行

```bash
npm test          # 单元 + E2E 全跑
npm run test:unit # 仅纯逻辑单元测试（快，~50ms）
npm run test:e2e  # 仅 Electron E2E（~20s）
```

## 单元测试（tests/unit/lib.test.js）

针对 `lib/` 下的纯函数模块，node 内置 test runner，无需启动 Electron。

| 用例 | 覆盖 |
|---|---|
| expForNextLevel | 等级公式 50 + level×30 |
| applyExpGain × 5 | 累积 / 跨一级 / 跨多级 / 每日上限 300 / 跨日重置 / 满级封顶 |
| computeMood | 情绪优先级 wantsToTravel > hungry > happy > bored > normal |
| decayHunger | 每分钟 -0.5、clamp [0,100] |
| pickLine / 抽样 | 台词非空、加权覆盖多条 |
| timeBucket | morning / mealtime / night / 下午 null |
| canSpeak | 安静模式、从未说话、每日上限 |
| getEventLine | 已知 / 未知事件 |
| travel destination | pick / find / 未知 null |
| shouldTriggerTravel | 非 idle 不触发、冷却内不触发 |

共 18 条。

## E2E 测试（tests/e2e/*.spec.js）

Playwright 驱动真实 Electron，每个用例用独立临时 userData 目录（`fixtures.js`），互不污染。
测试态 `DESKPET_TEST=1` 把旅行时间压到毫秒级、eager 100% 触发。

### 启动与渲染（smoke.spec.js）
- **T1** 有存档直接进桌面，canvas 可见、away 隐藏
- **T2** canvas 程序化绘制出非透明像素（占位狗真的画出来了）
- **T2b** 没有内联脚本被 CSP 拦截（验证 app.js 作为外部脚本正常执行）

### 领养（adopt.spec.js）
- **T3** 无存档弹领养页 → 选品种/性别/名字 → 确认按钮从禁用变可用 → 确认后开桌面窗口、存档写入正确字段

### 互动与数值（interactions.spec.js）
- **T4** 喂食 → 饱腹度 +20、经验 +3、记 lastFeedAt
- **T4b** 冷却内第二次喂食无效
- **T5** 玩耍 → 情绪 happy、经验 +10、记 lastPlayAt
- **T5b** 攒够经验跨级升级
- **T7** 安静模式开关写入存档

### 旅行明信片（travel.spec.js）
- **T6** 完整流程 idle→away→idle，明信片入册、PNG 落盘（>1KB）、归来 mood=happy、canvas 恢复可见
- **T6b** 旅行归来发放 25 经验
- **T8** 启动时卡在 away 且 returnAt 已过 → 自动恢复、生成明信片、canvas 可见（防回归：曾经卡死在「去旅行了」）
- **T8b** 卡在 away 但 destination 无效 → 安全回 idle、不产生明信片

共 13 条。

## 测试驱动钩子

为让 E2E 能驱动原生右键菜单背后的动作（Playwright 点不了原生菜单），
`preload.js` 暴露了几个动作 IPC（也可供未来 UI 直接调用）：

- `window.deskPet.feed()` / `play()` / `triggerTravel()` / `endTravel()`
- 主进程 `DESKPET_USERDATA` 环境变量覆盖存档目录，实现测试隔离

## 历史回归点（重点防守）

这些 bug 都已被测试覆盖，改动相关代码后务必回归：

1. **CSP 拦截内联脚本**（T2/T2b）：index.html 的脚本必须是外部文件，
   否则 `default-src 'self'` 会拦截，整个渲染端逻辑失效。
2. **CSS display 覆盖 hidden 属性**（T1/T8）：`.away` 的 `display:flex`
   会让 HTML `hidden` 失效，必须有 `.away[hidden]{display:none!important}`。
3. **away 状态卡死**（T8）：启动时若存档停在 away，resumeTravelIfMidFlight
   必须能恢复。
4. **IPC 监听器竞态**（间接由 T8 覆盖）：渲染端监听器和 helper 必须同步
   注册，否则主进程初始化广播会丢。

## 人工冒烟清单（发版前过一遍）

自动化覆盖不了「好不好看 / 动效顺不顺」，发版前人工跑一遍：

```bash
npm run start:dev
```

- [ ] 狗狗占位在右下角，呼吸 + 眨眼流畅
- [ ] 拖动狗狗跟手不掉帧
- [ ] 右键菜单能弹出，各项可点
- [ ] 喂食/玩耍有动画 + 顶部徽标 + 数值变化
- [ ] 等 30-90s 出现主动搭话气泡，文案通顺
- [ ] 安静模式开启后不再冒气泡
- [ ] 「[DEV] 立刻去旅行」→ 告别 → 占位 → 通知 → 明信片
- [ ] 明信片相册能翻看、能「保存为图片」
- [ ] 退出再启动，狗狗与数值都还在
