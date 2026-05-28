const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { launchApp, buildSave, cleanup } = require('./fixtures');

test.describe('旅行明信片', () => {
  let app;
  let userDataDir;

  test.afterEach(async () => {
    if (app) await app.close();
    if (userDataDir) cleanup(userDataDir);
  });

  async function waitForStatus(win, target, timeoutMs = 8000) {
    const start = Date.now();
    let last = null;
    while (Date.now() - start < timeoutMs) {
      last = await win.evaluate(async () => {
        const s = await window.deskPet.getSave();
        return s?.travel?.status;
      });
      if (last === target) return true;
      await win.waitForTimeout(100);
    }
    throw new Error(`等待 travel.status='${target}' 超时，最后看到 '${last}'`);
  }

  test('T6: 完整旅行流程 idle→away→idle，明信片入册且 PNG 落盘', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave() }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    // 触发旅行
    await win.evaluate(() => window.deskPet.triggerTravel());

    // 经历 away（测试态 departing 200ms → away）
    await waitForStatus(win, 'away');

    // away 期间 canvas 隐藏、占位显示
    const awayDisplay = await win.evaluate(() => getComputedStyle(document.getElementById('away')).display);
    expect(awayDisplay).not.toBe('none');

    // 等回到 idle（away 300ms → arriving 200ms → idle）
    await waitForStatus(win, 'idle');

    // 明信片应入册
    const save = await win.evaluate(() => window.deskPet.getSave());
    expect(save.postcards.length).toBe(1);
    expect(save.dog.mood).toBe('happy');

    // PNG 文件应落盘
    const pc = save.postcards[0];
    const pngPath = path.join(userDataDir, 'postcards', pc.filename);
    expect(fs.existsSync(pngPath)).toBe(true);
    expect(fs.statSync(pngPath).size).toBeGreaterThan(1000);

    // 回到 idle 后 canvas 重新可见
    const petDisplay = await win.evaluate(() => getComputedStyle(document.getElementById('pet')).display);
    expect(petDisplay).not.toBe('none');
  });

  test('T6b: 旅行归来发放经验', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave({ dog: { exp: 0, level: 1 } }) }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    await win.evaluate(() => window.deskPet.triggerTravel());
    await waitForStatus(win, 'away');
    await waitForStatus(win, 'idle');

    const save = await win.evaluate(() => window.deskPet.getSave());
    // 归来 +25 经验（L1 不足 80，不升级）
    expect(save.dog.exp).toBe(25);
    expect(save.dog.level).toBe(1);
  });

  test('T8: 启动时卡在 away 且 returnAt 已过 → 自动恢复并生成明信片', async () => {
    const pastReturn = new Date(Date.now() - 60_000).toISOString();
    ({ app, userDataDir } = await launchApp({
      save: buildSave({
        travel: {
          status: 'away',
          destination: 'xinjiang',
          departedAt: new Date(Date.now() - 120_000).toISOString(),
          returnAt: pastReturn,
        },
      }),
    }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');

    // resumeTravelIfMidFlight 应在 200ms 后接管，returnAt 已过立即归来
    await waitForStatus(win, 'idle');

    const save = await win.evaluate(() => window.deskPet.getSave());
    expect(save.postcards.length).toBe(1);

    // canvas 应该可见（不再卡在 away 占位）
    const petDisplay = await win.evaluate(() => getComputedStyle(document.getElementById('pet')).display);
    expect(petDisplay).not.toBe('none');
    const awayDisplay = await win.evaluate(() => getComputedStyle(document.getElementById('away')).display);
    expect(awayDisplay).toBe('none');
  });

  test('T8b: 卡在 away 但 destination 无效 → 安全回 idle', async () => {
    ({ app, userDataDir } = await launchApp({
      save: buildSave({
        travel: { status: 'away', destination: 'nonexistent', returnAt: new Date(Date.now() - 1000).toISOString() },
      }),
    }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await waitForStatus(win, 'idle');

    const save = await win.evaluate(() => window.deskPet.getSave());
    expect(save.travel.status).toBe('idle');
    // 无效 destination 不产生明信片
    expect(save.postcards.length).toBe(0);
  });
});
