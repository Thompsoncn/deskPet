# AI 绘图 prompt 套件 · deskPet

> 给项目作者用来在 **即梦 / 文心一格 / Midjourney / Stable Diffusion** 等工具批量生成美术资源。
>
> **阅读顺序**：先看「第 1 节 风格基线」 → 跑一张样板锁画风 → 把样板的 seed/参考图记在 `docs/art-spec.md` 第 6 节 → 再按照 2–8 节逐项产出。
>
> 所有命名约定严格遵循 `docs/art-spec.md` 第 3 节，**不要自行更改文件名**，否则代码加载会失败。

---

## 1. 风格基线 prompt（所有图共用，最重要）

整套美术资源的灵魂是「**画风一致**」。先把这段基线 prompt 抄到记事本里固定下来，**每张图都用它打头**，只在尾部追加对象描述。

### 1.1 主 prompt（中文）

```
手绘扁平插画风，温暖治愈系，暖橙暖黄主色调，少量奶白与浅褐过渡色，粗白描边（约 3-5px），无渐变，无写实阴影，造型圆润柔和，Q版比例（头身比 2:1），可爱治愈，儿童绘本风，画面干净，构图居中
```

### 1.2 主 prompt（英文备用）

```
flat hand-drawn illustration, warm healing palette, dominant warm orange and yellow tones with soft cream and light brown accents, thick clean white outline (3-5px), no gradient, no realistic shadow, soft rounded shapes, chibi proportion (2-head body), kawaii, children's book illustration style, clean composition, centered subject
```

### 1.3 反向词 / Negative prompt

中文：

```
写实，照片，3D 渲染，金属反光，复杂阴影，硬边阴影，景深虚化，恐怖，暗黑，血腥，成人内容，丑陋畸形，多余的腿，多余的尾巴，文字水印，logo，签名，杂乱背景，背景纹理，噪点
```

英文：

```
photorealistic, photograph, 3D render, metallic reflection, complex shadow, hard cast shadow, depth of field blur, dark, horror, scary, gore, adult content, ugly, deformed, extra limbs, extra tails, watermark, text, logo, signature, messy background, busy texture, noise, grain
```

### 1.4 推荐参数与工作流

| 项目 | 建议值 |
|---|---|
| 画布 | 1:1 正方形（角色帧），16:10 横版（明信片/风景） |
| 风格强度 | 即梦：风格化 7–8；文心：风格强度强；Midjourney：`--stylize 250 --s 250` |
| seed | **第一张满意后必须把 seed 记下来**，后续同品种、同动作复用同一 seed 才能保持画风 |
| 出图数量 | 每次出 4–8 张候选，挑 1 张当帧 |
| 参考图 | 锁定样板后，把它当 reference image 喂回去（即梦「参考图」、Midjourney `--cref`、SD ControlNet/IP-Adapter），权重 0.6–0.8 |
| 单角色帧导出 | 256×256 PNG，透明背景；如果工具不支持透明背景，先 1024×1024 出图，再用 remove.bg 或 PS 抠图 |

> **关键工作流**：
> 1. 先按第 2.1 节出柴犬 idle 第一帧，挑出最满意的那张。
> 2. 把它当作 reference image / cref，所有后续图都喂这张图当参考，画风偏移会大幅减小。
> 3. 同一品种的多帧动画，**只改动作动词，不改画风部分**。

---

## 2. 狗狗资源（6 品种 × 3 动作 × 多帧）

### 2.1 通用模板

每条 prompt 的拼装规则：

```
[1.1 主 prompt]，一只 {品种描述}，{动作描述}，{表情描述}，正面视角，透明背景，居中，画面四周留 28px 安全边
```

英文同理：

```
[1.2 main prompt], a {breed phrase}, {action phrase}, {expression phrase}, front view, transparent background, centered, 28px safe margin around the canvas
```

**多帧生成技巧**：同一动作下做 6–12 帧时，在 `{动作描述}` 末尾追加一句细微变化提示，例如「胸口微微抬起」「眼睛半闭」「尾巴左偏 10 度」，**保持 seed 不变**，让 AI 生成"同一姿态略有偏移"的多张图。

---

### 2.2 柴犬 shiba

**品种描述**：
- 中：`一只柴犬，橙红色短毛，白色腹部和脸颊，竖立的三角小耳朵，卷起的小尾巴，眯眯眼，嘴角微平显得高冷`
- 英：`a Shiba Inu, orange-red short fur, white belly and cheek, small upright triangular ears, curled fluffy tail, narrow slanted eyes, slightly flat mouth corner showing aloof temperament`

#### 2.2.1 idle（待机 6–8 帧）

文件位置：`assets/breeds/shiba/idle/frame_001.png` ~ `frame_008.png`

基础 prompt（中文）：

```
[主 prompt]，一只柴犬，橙红色短毛，白色腹部和脸颊，竖立的三角小耳朵，卷起的小尾巴，眯眯眼，嘴角微平显得高冷，端坐姿势，正面视角，双前爪轻搭在地面，呼吸平稳，透明背景，居中
```

每帧的变化（保持 seed 不变，仅追加这一句）：

| 帧 | 变化提示 |
|---|---|
| 001 | `胸口正常起伏，眼睛睁开` |
| 002 | `胸口微微抬起 2 像素，眼睛睁开` |
| 003 | `胸口最高点，眼睛睁开` |
| 004 | `胸口下落，眼睛睁开` |
| 005 | `胸口下落到底，眼睛半闭准备眨眼` |
| 006 | `胸口正常，眼睛完全闭合（眨眼瞬间）` |
| 007 | `胸口正常，眼睛重新睁开，尾巴轻微右偏` |
| 008 | `胸口正常，眼睛睁开，尾巴回正` |

英文基础 prompt：

```
[main prompt], a Shiba Inu, orange-red short fur, white belly and cheek, small upright triangular ears, curled tail, narrow slanted eyes, aloof flat mouth, sitting upright, front view, both front paws gently on the ground, calm breathing, transparent background, centered
```

#### 2.2.2 eat（进食 8–12 帧）

文件位置：`assets/breeds/shiba/eat/frame_001.png` ~ `frame_010.png`

基础 prompt（中文）：

```
[主 prompt]，一只柴犬，橙红色短毛，白色腹部和脸颊，眼睛专注地看着前方的食盆，正在吃饭，面前有一个奶白色小食盆装着褐色狗粮，正面略微俯视视角，透明背景，居中
```

每帧的变化：

| 帧 | 变化提示 |
|---|---|
| 001 | `站立姿态，头部抬起，准备低头` |
| 002 | `头部下倾 15 度，靠近食盆` |
| 003 | `鼻尖贴近食盆，张开嘴` |
| 004 | `嘴含住一口狗粮，眼睛眯起来` |
| 005 | `叼起狗粮，头部抬起 30 度` |
| 006 | `头部完全抬起，嘴里咀嚼，眼睛闭合享受` |
| 007 | `咀嚼中，腮帮鼓起` |
| 008 | `吞咽，喉咙微抬` |
| 009 | `满足表情，舌头微吐` |
| 010 | `回到准备低头的姿态，循环到 001` |

#### 2.2.3 play（玩耍 8–12 帧）

文件位置：`assets/breeds/shiba/play/frame_001.png` ~ `frame_010.png`

基础 prompt（中文）：

```
[主 prompt]，一只柴犬，橙红色短毛，开心地玩耍，嘴角上扬，舌头微吐，眼睛弯成月牙，前爪扑跳的姿势，身后有一个红色橡胶小球作为玩具，动感线条很轻，透明背景，居中
```

每帧的变化（蹦跳循环）：

| 帧 | 变化提示 |
|---|---|
| 001 | `四脚着地，前爪伏低，屁股翘起，准备扑` |
| 002 | `前爪开始抬起，重心前压` |
| 003 | `前爪跃起，后腿蹬地` |
| 004 | `腾空最高点，全身离地 5px，尾巴向上甩` |
| 005 | `开始下落，前爪朝下伸展` |
| 006 | `前爪着地，后腿还在空中` |
| 007 | `四脚着地，身体向左微转，尾巴向右甩` |
| 008 | `站立蹦弹，身体向右微转，尾巴向左甩` |
| 009 | `回到伏低姿势，眼睛笑成月牙` |
| 010 | `回到 001 姿势，循环` |

---

### 2.3 柯基 corgi

**品种描述**：
- 中：`一只柯基犬，金黄棕色与白色双色毛，胸口和四肢白色，超短的小腿，圆滚滚的屁股，竖立的大三角耳朵，圆眼笑眼，舌头粉色微吐，气质活泼可爱`
- 英：`a Pembroke Welsh Corgi, golden tan and white bicolor coat, white chest and limbs, very short legs, round chubby butt, large upright triangular ears, round smiling eyes, pink tongue slightly out, cheerful and playful`

#### idle / eat / play

直接套 2.2.1 / 2.2.2 / 2.2.3 的帧变化提示，把品种描述换成柯基的那段。**额外性格调整**：
- idle：把「胸口微抬」改为「尾巴小幅左右摇晃」，柯基摇尾比柴犬频繁；表情用「抬头看向主人，笑眼」。
- play：把「红色橡胶球」改为「米色磨牙骨头玩具」，扑跳幅度更大（腾空 8px）。

完整柯基 idle 示例（中文）：

```
[主 prompt]，一只柯基犬，金黄棕色与白色双色毛，胸口和四肢白色，超短的小腿，圆滚滚的屁股，竖立的大三角耳朵，圆眼笑眼，舌头粉色微吐，端坐姿势，抬头看向主人，尾巴小幅摇晃，正面视角，透明背景，居中
```

---

### 2.4 金毛 golden

**品种描述**：
- 中：`一只金毛寻回犬，奶金色长毛微卷，毛发柔软蓬松，圆润大眼睛眼神温柔，长嘴微笑，舌头粉嫩微吐，性格暖心稳重`
- 英：`a Golden Retriever, creamy golden long wavy fur, soft fluffy texture, large round gentle eyes, long muzzle with a warm smile, pink tongue slightly out, warm-hearted and calm`

**性格调整**：
- idle：坐姿端正，尾巴左右大幅缓慢摆动；表情「暖笑」。
- eat：吃得很优雅，咀嚼幅度小。
- play：跳跃幅度温和，常见姿势是「叼着布偶玩具走过来」。

完整金毛 play 示例：

```
[主 prompt]，一只金毛寻回犬，奶金色长毛微卷，圆润大眼睛眼神温柔，长嘴微笑，嘴里叼着一个米色布偶玩具，开心地朝镜头小跑过来，尾巴大幅摇晃，毛发轻微飘动，透明背景，居中
```

---

### 2.5 哈士奇 husky

**品种描述**：
- 中：`一只西伯利亚哈士奇，黑白双色毛，黑色面罩眼周白色形成"二哈眉"，挺立的大尖耳朵，蓝色或异色瞳，表情夸张又呆萌，常常张大嘴大笑，舌头大幅外吐`
- 英：`a Siberian Husky, black and white bicolor coat, black mask with white above eyes forming silly eyebrows, large pointed upright ears, blue or heterochromia eyes, exaggerated derpy expression, often grinning with tongue hanging out`

**性格调整**：
- idle：偶尔做出夸张的"瞪眼"或「歪头杀」表情；可在 2/3 帧加入「嘴巴张大露出舌头」。
- play：跳跃最夸张，腾空 10px，可以加一帧「四脚朝天打滚」的失败姿态作为彩蛋。
- eat：吃得特别急，腮帮鼓得最大，可加一帧「头埋进食盆里」。

哈士奇 idle 帧 003 示例：

```
[主 prompt]，一只西伯利亚哈士奇，黑白双色毛，黑色面罩二哈眉，挺立大尖耳，蓝色瞳，端坐姿势，突然瞪大眼睛歪头 15 度，舌头微吐，呆萌表情，透明背景，居中
```

---

### 2.6 泰迪 teddy

**品种描述**：
- 中：`一只泰迪犬（红棕色玩具贵宾犬），通体红棕色卷毛像小毛球，圆圆的大眼睛黑亮亮，小巧的鼻子，体型娇小，气质撒娇黏人`
- 英：`a Teddy Bear Poodle (red-brown toy poodle), all-over red-brown curly fur like a little fluffball, large round shiny black eyes, tiny nose, petite body, clingy and adorable`

**性格调整**：
- idle：头部小幅左右转动「找主人」；可加一帧「头微微抬高看向镜头」。
- play：常见姿势是「原地小碎步打转追自己尾巴」，而非大跳。
- eat：小口小口地吃，每帧只吃一小颗狗粮。

泰迪 idle 帧 005 示例：

```
[主 prompt]，一只红棕色泰迪犬，通体红棕色卷毛小毛球，黑亮大眼，端坐姿势，头微微抬高看向镜头，眼神撒娇期待，透明背景，居中
```

---

### 2.7 中华田园犬 zhongtian

**品种描述**：
- 中：`一只中华田园犬（土狗），暖黄色短毛微带浅褐斑纹，胸口白色，体型匀称健壮，立耳或半立耳，杏仁眼眼神机警又温和，嘴角自然不刻意上扬，朴实接地气`
- 英：`a Chinese Native Dog (Chinese Rural Dog), warm yellow short fur with light brown patches, white chest, well-proportioned sturdy build, upright or semi-upright ears, almond-shaped alert yet gentle eyes, natural mouth corner, honest and down-to-earth`

**性格调整**：
- idle：站立姿势比其他品种更多，呈现「警觉听声」状态；耳朵会出现「左耳竖右耳半垂」的可爱细节。
- eat：动作朴实，没有特殊变化。
- play：常见姿势是「叼着一根小树枝奔跑」。

中华田园犬 idle 帧 001 示例：

```
[主 prompt]，一只中华田园犬，暖黄色短毛带浅褐斑纹，胸口白色，体型健壮匀称，半立耳，杏仁眼机警又温和，站立姿势，耳朵警觉竖立，正面视角，透明背景，居中
```

---

## 3. 品种展示图（6 张，领养页用）

比帧图更精细，**不是帧动画**，是高质量肖像立绘。

文件位置：`assets/breeds/{breed}/portrait.png`，建议 512×512。

通用模板（中文）：

```
[主 prompt]，一只 {品种完整描述}，3/4 侧身坐姿，正脸朝向镜头，表情饱满有神，毛发质感细腻可见，画面下方有一小块圆形浅米色阴影作为站立平面（不是写实阴影，是装饰圆斑），整体作为角色立绘海报，构图比帧动画更精致，背景为纯透明
```

英文：

```
[main prompt], a {breed full description}, 3/4 sitting pose facing camera, expressive eyes, visible fur texture detail, decorative cream-colored circular pad beneath as a ground accent (decorative not realistic shadow), character portrait poster composition more refined than frame animation, transparent background
```

把 `{品种完整描述}` 替换成 2.2–2.7 的品种描述段即可，6 张依次生成。**这 6 张务必使用同一个 seed 和同一张参考图**，否则领养页 6 只狗会画风打架。

---

## 4. 旅行风景（10 张，对应 destinations.json）

规格：**1200×800 JPG**，无透明，对应 `assets/postcards/scenes/{id}.jpg`。

**这一组的风格关键**：和狗狗角色帧画风同源（手绘扁平、白描边、暖色），**但允许更大的色彩饱和度变化**，因为要让 10 个目的地一眼分辨。视觉关键词已经预设好，按下表填入模板即可。

### 4.1 通用模板（中文）

```
[主 prompt]，{目的地视觉关键词}，横向宽幅风景插画，远景中景近景层次清晰，色调以 {主色调} 为主，画面构图左 1/3 或右 1/3 留出空白用于后期叠加狗狗形象，无人物，无文字，无邮戳（邮戳由代码生成）
```

英文：

```
[main prompt], {destination visual keywords}, wide horizontal landscape illustration, clear foreground/midground/background layers, dominant {color tone} palette, leave the left 1/3 or right 1/3 of the frame relatively empty for later overlay of a dog character, no people, no text, no postmark (rendered by code)
```

### 4.2 10 个目的地具体关键词

| id | 文件名 | 视觉关键词（中文） | 主色调 |
|---|---|---|---|
| `xinjiang` | `xinjiang.jpg` | 远处天山雪山，中景胡杨树和葡萄藤架，近景一片金色沙漠和几串挂着的红枣，天空澄澈宝蓝色 | 暖橙 + 宝蓝 |
| `tibet` | `tibet.jpg` | 远景布达拉宫白红轮廓，中景五色经幡随风飘扬，近景湛蓝湖面倒映雪山，天空压得很低的厚白云 | 雪青 + 经幡红黄蓝 |
| `yunnan` | `yunnan.jpg` | 远景苍山雪顶，中景丽江古城青瓦屋檐与红灯笼，近景青石板路边一束鲜花饼摊位，雨后湿润感 | 青绿 + 暖红灯笼 |
| `seaside` | `seaside.jpg` | 远景海平线橘色晚霞，中景蓝绿海浪卷起白花，近景米黄沙滩上散落贝壳和一把竹编遮阳伞 | 橘晚霞 + 海蓝 |
| `beijing` | `beijing.jpg` | 远景长城在山脊上蜿蜒，中景红墙黄瓦的故宫角楼，近景灰瓦胡同里一辆停着的老式自行车，天空淡蓝 | 朱红 + 灰瓦 |
| `chengdu` | `chengdu.jpg` | 远景青城山轮廓，中景锦里街红灯笼成排，近景一个翻倒的小火锅冒着热气和一只趴着的大熊猫剪影 | 暖橙 + 竹绿 |
| `xian` | `xian.jpg` | 远景大雁塔剪影，中景古城墙绵延，近景一排兵马俑半身像和一个肉夹馍摊位冒着热气，夕阳金黄 | 沙土黄 + 砖红 |
| `xiamen` | `xiamen.jpg` | 远景鼓浪屿岛屿，中景白墙红顶的西式小楼，近景一段海堤和一只盛着沙茶面的碗，海风感 | 海青 + 米白 |
| `zhangjiajie` | `zhangjiajie.jpg` | 远景一根根竖立的石柱山峰穿过云海，中景悬空玻璃桥剪影，近景一只小猴子坐在树枝上，云雾缭绕 | 青灰 + 雾白 |
| `mongolia` | `mongolia.jpg` | 远景无边草原延伸到天边，中景几个白色蒙古包和一群马儿，近景一束草浪和一壶咸奶茶，夜空有星点 | 草绿 + 星空蓝 |

> **批量生成顺序建议**：先做新疆和海边（色调差异最大，最能验证画风弹性），通过后再做其他 8 个。

### 4.3 拼装示例（新疆）

```
手绘扁平插画风，温暖治愈系，暖橙暖黄主色调，少量奶白与浅褐过渡色，粗白描边（约 3-5px），无渐变，无写实阴影，造型圆润柔和，儿童绘本风，远处天山雪山，中景胡杨树和葡萄藤架，近景一片金色沙漠和几串挂着的红枣，天空澄澈宝蓝色，横向宽幅风景插画，远景中景近景层次清晰，色调以暖橙 + 宝蓝为主，画面右 1/3 留出空白用于后期叠加狗狗形象，无人物，无文字，无邮戳
```

---

## 5. 明信片底板（1–2 张）

规格：**1200×800 PNG**，对应 `assets/postcards/templates/template_01.png`（必要时再加 `template_02.png`）。

底板上要有：
- 一圈做旧白色相框（外圈 40px 宽）
- 右上角一个空白邮票位（160×120 矩形，留作代码贴目的地小图标）
- 右下角一个圆形空白邮戳位（直径 140px）
- 底部预留 200px 高的米色横条作为文案区
- 左侧画面区域留 800×600 空白，用于贴风景图

### 5.1 prompt（中文）

```
[主 prompt]，一张空白明信片版式底图，1200×800 横版，外圈是做旧米白色相框（宽 40 像素，边缘有细微毛边和手绘锯齿感），右上角有一个空白邮票位（160×120 像素的矩形框，四周是邮票常见的锯齿边），右下角有一个圆形空白邮戳位（直径 140 像素的细线圆环），底部 200 像素是一条米色横纹纸质区域作为文案位（横纹要轻），整体留白干净，没有任何文字、图案、风景或狗狗，只是版式骨架，背景区域透明
```

英文：

```
[main prompt], an empty postcard layout template, 1200x800 horizontal, outer frame is a vintage cream-white border 40px wide with subtle hand-drawn rough edges, top-right has an empty stamp slot (160x120 rectangle with stamp perforated edges), bottom-right has a round empty postmark slot (140px thin-line circle), bottom 200px is a cream horizontal lined paper area for text, clean empty composition, no text no illustration no landscape no dog, just the layout skeleton, background transparent
```

> **备选**：可以再做一版 `template_02.png` 把邮票位放左上、邮戳放左下，给用户翻看相册时一些视觉变化。

---

## 6. 软件图标

规格：**256×256 PNG**，需要识别度高、能缩到 16×16 还看得出是狗头。

文件位置：`assets/icon.png`（最终用 `electron-icon-builder` 或在线工具转成 `.ico`）。

设计取舍：**只画狗头特写**，不要全身，缩小后才不糊。

### 6.1 prompt（中文）

```
[主 prompt]，一只柴犬的正面头部特写图标，橙红色短毛，白色脸颊和眉心，两只小三角耳朵竖立，眯眯眼笑得很满足，嘴角微微上扬，圆形构图，头部占据画面 80%，背景是一个柔和暖橙色圆形（不要做成完整 app 圆角矩形，只是圆形底色），简洁强识别度，可在 16×16 像素下依然清晰，无文字
```

英文：

```
[main prompt], a Shiba Inu front-facing head close-up icon, orange-red fur, white cheek and forehead, two small triangular ears upright, narrow happy eyes, slight smile, circular composition, head fills 80% of canvas, warm orange round background (just a circle color, not app rounded square), strong silhouette readable at 16x16 pixels, no text
```

> **备选思路**：如果想突出旅行卖点，可以让狗狗戴一顶米色小草帽或脖子挂一个迷你明信片图案，但优先保证缩小后能认出"这是一只狗"。

---

## 7. 气泡框（1–2 个）

规格：9-slice 可拉伸 PNG，至少 128×64，对应 `assets/ui/bubble_01.png`、`assets/ui/bubble_02.png`。

### 7.1 标准气泡（bubble_01）

中文 prompt：

```
[主 prompt]，一个空白对话气泡 UI 元素，圆角矩形主体，白色填充，粗黑描边（约 4 像素），左下角有一个小三角形指向气泡外（指向狗狗的位置），描边粗细一致，整个气泡内部完全空白没有任何文字，无阴影，透明背景，构图居中，规格 256×128 像素，左右上下边缘各留 12 像素以便后续做 9-slice 切图
```

英文：

```
[main prompt], an empty speech bubble UI element, rounded rectangle body, white fill, thick black outline about 4px, small triangle tail pointing down-left (toward the dog), uniform outline thickness, completely empty interior with no text, no shadow, transparent background, centered, 256x128 pixels, 12px padding on all 4 edges for later 9-slice cutting
```

### 7.2 想法气泡（bubble_02，可选）

把对话气泡的尖角三角形换成「**三个由小到大的小圆点**」，呈现"想象/心声"的感觉，用于狗狗在「想旅行」情绪下的台词。

```
[主 prompt]，一个空白想法气泡 UI 元素，圆角矩形主体白色填充，粗黑描边 4 像素，左下角不是三角形而是三个由大到小的小圆点（最大的紧贴气泡，逐渐变小指向狗狗），整个气泡内部完全空白，透明背景，256×128 像素
```

---

## 8. 升级与情绪附加资源

### 8.1 升级动画（6 帧通用，不含狗狗本体）

文件位置：`assets/effects/levelup/frame_001.png` ~ `frame_006.png`，256×256，透明背景。

> 注意：升级动画 **不画狗狗**，只画星星 / 光效，代码会把它叠加在狗狗头顶。

基础 prompt（中文）：

```
[主 prompt]，一组装饰性升级光效，画面中央散布着金黄色五角星和奶白色小四角光点，配少量暖橙色光斑，无狗狗，无人物，无文字，圆润可爱，治愈系，透明背景，居中
```

每帧的变化：

| 帧 | 变化提示 |
|---|---|
| 001 | `画面中央有 3 颗小星星刚冒出来，颗粒小，刚刚出现` |
| 002 | `星星变大变多，约 6 颗，开始向外散开` |
| 003 | `星星达到最大，约 8 颗，遍布画面，最亮` |
| 004 | `星星开始向上飘升，颗数不变，亮度略降` |
| 005 | `星星飘到画面上半部分，数量减少到 5 颗，开始淡化` |
| 006 | `画面只剩 2-3 颗渐隐的星星在顶部` |

### 8.2 情绪小表情（5 种 × 64×64）

文件位置：`assets/emotions/{emotion}.png`，64×64 透明背景，对应代码里的 5 种情绪。

> **重要**：这 5 个表情是**通用贴纸**，不是每个品种单独画一套（节省工作量）。代码会把它贴在狗狗头侧。

| 情绪 id | 视觉描述 | prompt 关键词（追加在主 prompt 后） |
|---|---|---|
| `happy` | 黄色笑脸 + 两个小爱心 | `一个圆形黄色笑脸 emoji 风格小贴纸，眼睛弯成月牙，嘴角大幅上扬，旁边有两个粉色小爱心，64×64，透明背景，居中` |
| `normal` | 浅米色普通脸 + 圆点眼睛 | `一个圆形浅米色普通表情小贴纸，两个黑色圆点眼睛，嘴是一条水平短线，平静无情绪，64×64，透明背景，居中` |
| `hungry` | 橙色脸 + 流口水 + 食物图标 | `一个圆形橙色饥饿表情小贴纸，眼睛盯着右下方，嘴角有一滴粉色口水，旁边有一根小骨头图标，64×64，透明背景，居中` |
| `bored` | 灰蓝脸 + 半闭眼 + Z 字 | `一个圆形灰蓝色无聊表情小贴纸，眼睛半闭呈一条线，嘴是无所谓的横线，旁边飘着一个小写 z 字母（打哈欠感），64×64，透明背景，居中` |
| `wantsToTravel` | 天蓝脸 + 闭眼向往 + 飞机/云 | `一个圆形天蓝色向往表情小贴纸，眼睛闭合微笑（陶醉表情），旁边有一朵小白云和一架米色纸飞机剪影，64×64，透明背景，居中` |

完整 prompt 拼装示例（happy）：

```
手绘扁平插画风，温暖治愈系，暖橙暖黄主色调，粗白描边，无渐变，无阴影，圆润柔和，儿童绘本风，一个圆形黄色笑脸 emoji 风格小贴纸，眼睛弯成月牙，嘴角大幅上扬，旁边有两个粉色小爱心，64×64，透明背景，居中
```

---

## 9. 执行节奏建议（先做什么、后做什么）

第一版美术资源量大，按下列顺序推进最稳，能尽早锁画风、降低返工风险：

### 阶段 A · 锁样板（1–2 天，最关键）

1. 用第 1 节的主 prompt + 第 2.2.1 节的柴犬 idle 基础 prompt，**只生成 8–12 张候选**，挑出 1 张最满意的。
2. 把这张存为 `assets/breeds/shiba/idle/frame_001.png`，并把它的 **seed、完整 prompt、工具名** 回填到 `docs/art-spec.md` 第 6 节。
3. 把这张图设为后续所有图的 **reference image**（即梦「参考图」/ MJ `--cref` / SD IP-Adapter）。
4. 用同样 seed 和 reference 出柴犬 idle 剩余的 5–7 帧。在桌面环境里试播一下（模块 2 已经做完），确认动画不抖、不闪、画风稳。

### 阶段 B · 横向扩品种（2–3 天）

5. 用阶段 A 的参考图，做 **6 个品种的 portrait 立绘**（第 3 节）。先把领养页跑通，让作者有"6 只狗一起亮相"的成就感。
6. 做 **6 个品种的 idle 帧**（同 seed、同参考图、只换品种描述）。

### 阶段 C · 互动动画（3–4 天）

7. 6 品种 × eat（每只 8–10 帧）。
8. 6 品种 × play（每只 8–10 帧）。
> 提示：可以优先把柴犬 + 柯基 + 金毛 这 3 个最常用品种的 eat/play 先做完，剩下 3 个品种作为下一周补齐，先让模块 5 能联调。

### 阶段 D · 旅行系统（2–3 天）

9. 第 4 节的 **10 张风景**。先做新疆 + 海边（色调差异最大），过审再批量做剩下 8 张。
10. 第 5 节的 **1 张明信片底板**，连同风景图试合成一张明信片预览，确认排版没问题再考虑做 `template_02`。

### 阶段 E · UI 与杂项（1 天）

11. 第 6 节软件图标 1 张。
12. 第 7 节气泡框 1–2 张。
13. 第 8.1 节升级光效 6 帧。
14. 第 8.2 节情绪小表情 5 张。

### 全局红线

- **每张图生成前都先粘贴第 1 节主 prompt + 反向词**，再追加该资源的描述部分，绝不能省略基线。
- **seed 一旦定下来不要改**，所有同系列资源复用同一 seed。
- **每完成一类，先把 1 张样品塞进项目里跑一下**，确认尺寸/透明背景/命名对得上代码，再批量产出剩余资源。否则一次错全部返工。
- AI 出图的瑕疵（多一条腿、眼睛歪、白边毛刺）用 PS / Photopea 简单修一下即可，不要为了完美反复重 roll，浪费时间。
