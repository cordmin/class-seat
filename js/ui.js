import { state } from './state.js';

let toastTimer;

export function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = msg;
  if (isError) {
    el.classList.add('error');
  } else {
    el.classList.remove('error');
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 4000 : 2500);
}

export function showConfirm(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-modal').style.display = 'flex';
  state.confirmCallback = cb;
}

export function confirmOk() {
  document.getElementById('confirm-modal').style.display = 'none';
  if (state.confirmCallback) {
    state.confirmCallback();
    state.confirmCallback = null;
  }
}

export function confirmCancel() {
  document.getElementById('confirm-modal').style.display = 'none';
  state.confirmCallback = null;
}

export function toggleSaveMenu(e) {
  e.stopPropagation();
  const pop = document.getElementById('save-popover');
  if (!pop) return;

  if (pop.style.display === 'block') {
    pop.style.display = 'none';
    return;
  }

  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();

  pop.style.top = (rect.bottom + 4) + 'px';
  pop.style.left = rect.left + 'px';
  pop.style.display = 'block';
}

export function hideSaveMenu() {
  const pop = document.getElementById('save-popover');
  if (pop) pop.style.display = 'none';
}

export function updateStudentListPreview() {
  const el = document.getElementById('student-list-preview');
  if (!el) return;
  if (state.students.length === 0) {
    el.innerHTML = '<span style="color:var(--textm);">등록된 학생 명단이 없습니다.</span>';
    return;
  }

  el.innerHTML = state.students.map(s =>
    `<div style="display:flex;gap:8px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);">
       <span style="background:var(--accent);color:#fff;border-radius:4px;padding:0 5px;font-size:10px;font-weight:800;min-width:24px;text-align:center;line-height:1.9;">${s.id}</span>
       <span>${s.name}</span>
       ${s.gender ? `<span style="color:${s.gender==='남'?'#60a5fa':'#f472b6'};font-size:10px;">${s.gender}</span>` : ''}
     </div>`
  ).join('');
}

export function openStudentModal() {
  const m = document.getElementById('student-list-modal');
  if (!m) return;
  if (state.students.length === 0) {
    toast('불러온 학생 명단이 없습니다.', true);
    return;
  }
  const listHtml = state.students.map(s => {
    let genderBadge = '';
    if (s.gender === '남') genderBadge = `<span style="background:#dbeafe; color:#1e40af; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; gap:3px;">♂ 남</span>`;
    else if (s.gender === '여') genderBadge = `<span style="background:#fce7f3; color:#9d174d; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; gap:3px;">♀ 여</span>`;
    return `<div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid var(--border2); background:#fff; border-radius:10px; margin-bottom:6px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="background:var(--accent); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; flex-shrink:0;">${s.id}</div>
      <div style="flex:1; font-weight:800; font-size:14px; color:var(--text1);">${s.name}</div>
      <div>${genderBadge}</div>
    </div>`;
  }).join('');

  const content = document.getElementById('modal-student-list-content');
  if (content) content.innerHTML = listHtml;
  m.style.display = 'flex';
}

export function closeStudentModal() {
  const m = document.getElementById('student-list-modal');
  if (m) m.style.display = 'none';
}
