/**
 * 领养页逻辑
 *
 * 6 个品种数据本地写死（PRD 第 4.1 节）。
 * 没有美术时用色块 + emoji 作占位；有 assets/breeds/{breed}/portrait.png 时优先用图。
 */

const BREEDS = [
  { id: 'shiba',     name: '柴犬',       tag: '高冷 · 偶尔毒舌',     color: '#ff9a76', emoji: '🐕' },
  { id: 'corgi',     name: '柯基',       tag: '活泼 · 爱卖萌',       color: '#fdcb6e', emoji: '🐶' },
  { id: 'golden',    name: '金毛',       tag: '温柔 · 暖心',         color: '#f6b93b', emoji: '🦮' },
  { id: 'husky',     name: '哈士奇',     tag: '二 · 精力旺盛',       color: '#74b9ff', emoji: '🐺' },
  { id: 'teddy',     name: '泰迪',       tag: '黏人 · 敏感',         color: '#d4a373', emoji: '🐩' },
  { id: 'zhongtian', name: '中华田园犬', tag: '忠诚 · 实在',         color: '#e8a87c', emoji: '🐕‍🦺' },
];

const state = {
  breed: null,
  gender: null,
  name: '',
};

const els = {
  breeds: document.getElementById('breeds'),
  name: document.getElementById('name'),
  confirm: document.getElementById('confirm'),
};

function renderBreeds() {
  els.breeds.innerHTML = '';
  for (const b of BREEDS) {
    const card = document.createElement('div');
    card.className = 'breed';
    card.dataset.id = b.id;
    card.innerHTML = `
      <div class="breed__avatar" style="background:${b.color}">${b.emoji}</div>
      <div class="breed__name">${b.name}</div>
      <div class="breed__tag">${b.tag}</div>
    `;
    card.addEventListener('click', () => selectBreed(b.id));
    els.breeds.appendChild(card);
  }
}

function selectBreed(id) {
  state.breed = id;
  for (const card of els.breeds.children) {
    card.classList.toggle('is-selected', card.dataset.id === id);
  }
  refreshConfirm();
}

function refreshConfirm() {
  state.name = els.name.value.trim();
  const ok = state.breed && state.gender && state.name.length > 0;
  els.confirm.disabled = !ok;
}

document.querySelectorAll('input[name="gender"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.gender = input.value;
    refreshConfirm();
  });
});

els.name.addEventListener('input', refreshConfirm);

els.confirm.addEventListener('click', async () => {
  if (els.confirm.disabled) return;
  els.confirm.disabled = true;
  const res = await window.deskPet.adoptConfirm({
    breed: state.breed,
    gender: state.gender,
    name: state.name,
  });
  if (!res?.ok) {
    els.confirm.disabled = false;
    alert(`领养失败：${res?.error || '未知错误'}`);
  }
});

renderBreeds();
