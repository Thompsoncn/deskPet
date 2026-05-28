const { test, expect } = require('@playwright/test');
const { launchApp, readSave, cleanup } = require('./fixtures');

test.describe('领养流程', () => {
  let app;
  let userDataDir;

  test.afterEach(async () => {
    if (app) await app.close();
    if (userDataDir) cleanup(userDataDir);
  });

  test('T3: 无存档时弹领养页，选品种/性别/名字 → 确认 → 生成存档并开桌面', async () => {
    ({ app, userDataDir } = await launchApp({ save: null }));
    const adoptWin = await app.firstWindow();
    await adoptWin.waitForLoadState('domcontentloaded');

    // 应该是领养页
    await adoptWin.waitForSelector('#breeds .breed', { timeout: 5000 });

    // 确认按钮初始禁用
    expect(await adoptWin.evaluate(() => document.getElementById('confirm').disabled)).toBe(true);

    // 选柯基
    await adoptWin.click('.breed[data-id="corgi"]');
    // 选母（radio 视觉隐藏，force 跳过可见性检查）
    await adoptWin.check('input[name="gender"][value="female"]', { force: true });
    // 起名
    await adoptWin.fill('#name', '旺财');

    // 三项齐全后确认按钮可用
    expect(await adoptWin.evaluate(() => document.getElementById('confirm').disabled)).toBe(false);

    // 确认 → 会开新窗口（桌面狗狗）
    const petWinPromise = app.waitForEvent('window');
    await adoptWin.click('#confirm');
    const petWin = await petWinPromise;
    await petWin.waitForLoadState('domcontentloaded');
    await petWin.waitForTimeout(500);

    // 存档应写入选择内容
    const save = readSave(userDataDir);
    expect(save).toBeTruthy();
    expect(save.dog.breed).toBe('corgi');
    expect(save.dog.gender).toBe('female');
    expect(save.dog.name).toBe('旺财');
    expect(save.dog.level).toBe(1);
    expect(save.dog.hunger).toBe(80);

    // 桌面窗口 canvas 可见
    const petDisplay = await petWin.evaluate(() => getComputedStyle(document.getElementById('pet')).display);
    expect(petDisplay).not.toBe('none');
  });
});
