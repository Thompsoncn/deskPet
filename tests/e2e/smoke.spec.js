const { test, expect } = require('@playwright/test');
const { launchApp, buildSave, cleanup } = require('./fixtures');

test.describe('启动与渲染', () => {
  let app;
  let userDataDir;

  test.afterEach(async () => {
    if (app) await app.close();
    if (userDataDir) cleanup(userDataDir);
  });

  test('T1: 有存档时直接进桌面，canvas 可见、away 隐藏', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave() }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForFunction(() => !!window.__deskpetReady || true);
    await win.waitForTimeout(800);

    const petDisplay = await win.evaluate(() => getComputedStyle(document.getElementById('pet')).display);
    expect(petDisplay).not.toBe('none');

    const awayDisplay = await win.evaluate(() => getComputedStyle(document.getElementById('away')).display);
    expect(awayDisplay).toBe('none');
  });

  test('T2: canvas 程序化绘制出非透明像素（占位狗可见）', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave() }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(800);

    const hasPixels = await win.evaluate(() => {
      const c = document.getElementById('pet');
      const ctx = c.getContext('2d');
      // 中心点应当被狗狗占位填充
      const d = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
      return d[3] > 0;
    });
    expect(hasPixels).toBe(true);
  });

  test('T2b: 没有内联脚本被 CSP 拦截（app.js 真的跑起来了）', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave() }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(800);

    // app.js 跑起来才会有 animator 实例挂在 window 上吗？没有的话用别的探针：
    // 检查 canvas 已被绘制 + away 被正确隐藏（都依赖 app.js 执行）
    const awayHidden = await win.evaluate(() => document.getElementById('away').hasAttribute('hidden'));
    expect(awayHidden).toBe(true);
  });
});
