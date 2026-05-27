/**
 * 明信片相册渲染器
 *
 * 启动时通过 IPC 拿到所有明信片元数据 + dataURL，渲染成卡片网格。
 * 点击卡片打开模态查看大图；模态里点「保存为图片」走 IPC 弹保存对话框。
 */

const els = {
  grid: document.getElementById('grid'),
  empty: document.getElementById('empty'),
  subtitle: document.getElementById('subtitle'),
  modal: document.getElementById('modal'),
  modalImg: document.getElementById('modal-image'),
  modalMeta: document.getElementById('modal-meta'),
  modalSave: document.getElementById('modal-save'),
  modalClose: document.getElementById('modal-close'),
};

let postcards = [];
let currentId = null;

function formatDate(iso) {
  try {
    return iso.slice(0, 10);
  } catch {
    return '';
  }
}

function renderGrid() {
  els.grid.innerHTML = '';
  if (postcards.length === 0) {
    els.empty.hidden = false;
    els.subtitle.textContent = '狗狗还没去过任何地方';
    return;
  }
  els.empty.hidden = true;
  els.subtitle.textContent = `狗狗去过 ${postcards.length} 个地方`;

  for (const p of postcards) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="card__img" src="${p.dataURL}" alt="${p.destinationName}" />
      <div class="card__meta">
        <p class="card__title">${p.destinationName}</p>
        <p class="card__date">${formatDate(p.createdAt)}</p>
      </div>
    `;
    card.addEventListener('click', () => openModal(p));
    els.grid.appendChild(card);
  }
}

function openModal(p) {
  currentId = p.id;
  els.modalImg.src = p.dataURL;
  els.modalMeta.textContent = `${p.destinationName} · ${formatDate(p.createdAt)}`;
  els.modal.hidden = false;
}

function closeModal() {
  els.modal.hidden = true;
  currentId = null;
}

els.modalClose.addEventListener('click', closeModal);
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});

els.modalSave.addEventListener('click', async () => {
  if (!currentId) return;
  els.modalSave.disabled = true;
  const original = els.modalSave.textContent;
  els.modalSave.textContent = '保存中…';
  try {
    const res = await window.deskPet.savePostcardAs(currentId);
    els.modalSave.textContent = res?.ok ? '已保存✓' : (res?.canceled ? original : '保存失败');
  } catch {
    els.modalSave.textContent = '保存失败';
  }
  setTimeout(() => {
    els.modalSave.textContent = original;
    els.modalSave.disabled = false;
  }, 1500);
});

(async () => {
  postcards = (await window.deskPet?.listPostcards?.()) || [];
  renderGrid();
})();
