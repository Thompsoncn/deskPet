const { test, expect } = require('@playwright/test');
const { launchApp, buildSave, cleanup } = require('./fixtures');

test.describe('互动与数值', () => {
  let app;
  let userDataDir;

  test.afterEach(async () => {
    if (app) await app.close();
    if (userDataDir) cleanup(userDataDir);
  });

  test('T4: 喂食 → 饱腹度 +20、经验 +3、记录 lastFeedAt', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave({ dog: { hunger: 50, exp: 0 } }) }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    const after = await win.evaluate(() => window.deskPet.feed());
    expect(after.dog.hunger).toBe(70);
    expect(after.dog.exp).toBe(3);
    expect(after.interactions.lastFeedAt).toBeTruthy();
  });

  test('T4b: 喂食冷却内第二次无效', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave({ dog: { hunger: 50 } }) }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    await win.evaluate(() => window.deskPet.feed());
    const after2 = await win.evaluate(() => window.deskPet.feed());
    // 冷却内第二次不应再 +20
    expect(after2.dog.hunger).toBe(70);
  });

  test('T5: 玩耍 → 情绪 happy、经验 +10、记录 lastPlayAt', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave({ dog: { mood: 'normal', exp: 0 } }) }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    const after = await win.evaluate(() => window.deskPet.play());
    expect(after.dog.mood).toBe('happy');
    expect(after.dog.exp).toBe(10);
    expect(after.interactions.lastPlayAt).toBeTruthy();
  });

  test('T5b: 攒够经验会升级（exp 79 + 玩耍10 跨过 L1→L2 的 80）', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave({ dog: { exp: 75, level: 1 } }) }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    const after = await win.evaluate(() => window.deskPet.play());
    expect(after.dog.level).toBe(2);
    // 75 + 10 = 85，超过 80，升级后余 5
    expect(after.dog.exp).toBe(5);
  });

  test('T7: 安静模式开关写入存档', async () => {
    ({ app, userDataDir } = await launchApp({ save: buildSave() }));
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await win.waitForTimeout(500);

    const before = await win.evaluate(() => window.deskPet.getSave());
    expect(before.settings.quietMode).toBe(false);

    await win.evaluate(() => window.deskPet.updateSave({ 'settings.quietMode': true }));
    const after = await win.evaluate(() => window.deskPet.getSave());
    expect(after.settings.quietMode).toBe(true);
  });
});
