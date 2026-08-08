import { state, cfg, LAYOUTS, saveAutoState } from './state.js';
import { getLayoutRows, applyAlgo } from './layout.js';
import { toast, customConfirm } from './ui.js';

export function renderSeats() {
  const container = document.getElementById('seats-container');
  if (!container) return;
  container.innerHTML = '';
  container.style.gap = cfg.colGap + 'px';

  document.documentElement.style.setProperty('--cell-w', cfg.cellW + 'px');
  document.documentElement.style.setProperty('--cell-h', cfg.cellH + 'px');
  document.documentElement.style.setProperty('--row-gap', cfg.rowGap + 'px');
  document.documentElement.style.setProperty('--col-gap', cfg.colGap + 'px');

  if (state.seats.length === 0) {
    container.innerHTML = '<div style="padding:40px;color:#9ca3af;text-align:center;">학생 명단을 등록하고<br>자리 배치를 실행하세요.</div>';
    return;
  }

  const cols = cfg.colCount;
  const rowPattern = getLayoutRows(cfg.layoutType);
  const colGroups = {};

  for (const seat of state.seats) {
    if (!colGroups[seat.colIdx]) colGroups[seat.colIdx] = [];
    colGroups[seat.colIdx].push(seat);
  }

  let globalGroupCounter = 1;

  for (let c = 0; c < cols; c++) {
    const colSeats = colGroups[c] || [];
    const colDiv = document.createElement('div');
    colDiv.className = 'col-group';
    colDiv.style.gap = cfg.rowGap + 'px';

    if (cfg.layoutType === 'single' || cfg.layoutType === 'pair') {
      const labelDiv = document.createElement('div');
      labelDiv.className = 'col-label';
      labelDiv.textContent = `${c + 1}분단`;
      colDiv.appendChild(labelDiv);
    }

    let slotI = 0;
    while (slotI < colSeats.length) {
      const blockDiv = document.createElement('div');
      blockDiv.style.cssText = 'display:flex; flex-direction:column; gap:2px;';

      if (cfg.layoutType === 'group' || cfg.layoutType === 'group6') {
        const blockSeats = colSeats.slice(slotI, slotI + rowPattern.reduce((a, r) => a + r.length, 0));
        const hasValidSeat = blockSeats.some(s => !s.isGhost);
        const gLabel = document.createElement('div');
        gLabel.className = 'group-label';
        if (hasValidSeat) {
          gLabel.textContent = `${globalGroupCounter}모둠`;
          globalGroupCounter++;
        } else {
          gLabel.innerHTML = '&nbsp;';
          gLabel.style.visibility = 'hidden';
        }
        blockDiv.appendChild(gLabel);
      }

      for (const rowCells of rowPattern) {
        if (slotI >= colSeats.length) break;
        const rowDiv = document.createElement('div');
        rowDiv.style.cssText = 'display:flex; gap:2px;';
        for (let ci = 0; ci < rowCells.length; ci++) {
          const seat = colSeats[slotI++];
          if (!seat) break;
          rowDiv.appendChild(createSeatEl(seat));
        }
        blockDiv.appendChild(rowDiv);
        if (slotI >= colSeats.length) break;
      }

      colDiv.appendChild(blockDiv);
    }
    container.appendChild(colDiv);
  }

  if (state.teacherView) {
    const colGroupsArray = [...container.querySelectorAll('.col-group')];
    colGroupsArray.reverse().forEach(c => {
      const label = c.querySelector('.col-label');
      const blocks = [...c.children].filter(ch => !ch.classList.contains('col-label'));

      blocks.reverse().forEach(block => {
        const gLabel = block.querySelector('.group-label');
        if (gLabel) block.removeChild(gLabel);

        const rows = [...block.children];
        rows.reverse().forEach(r => {
          const rSeats = [...r.children];
          rSeats.reverse().forEach(s => r.appendChild(s));
          block.appendChild(r);
        });

        if (gLabel) {
          gLabel.style.marginTop = '4px';
          gLabel.style.marginBottom = '0';
          block.appendChild(gLabel);
        }
      });

      c.innerHTML = '';
      blocks.forEach(b => c.appendChild(b));

      if (label) {
        label.style.marginTop = '10px';
        label.style.marginBottom = '0';
        c.appendChild(label);
      }
      container.appendChild(c);
    });
  }

  fitToWorkspace();
}

export function createSeatEl(seat) {
  const el = document.createElement('div');
  el.dataset.id = seat.id;

  let cls = 'seat';
  if (seat.isGhost) cls += ' ghost';
  else if (seat.excluded) cls += ' excluded';
  else if (seat.student) cls += ' occupied';
  if (seat.isLocked && !seat.isGhost && !seat.excluded) cls += ' locked';
  if (seat.id === state.selectedSeatId) cls += ' selected';
  if (seat.id === state.overSeatId) cls += ' over';

  if (seat.student) {
    if (seat.student.gender === '남') cls += ' male';
    else if (seat.student.gender === '여') cls += ' female';
  }

  el.className = cls;

  if (seat.isGhost) {
    el.innerHTML = '';
  } else if (seat.excluded) {
    el.innerHTML = '<span class="seat-empty-mark" style="font-size:16px;color:#fca5a5;">✕</span>';
  } else if (seat.student) {
    el.innerHTML = `<span class="seat-id">${seat.student.id}</span><span class="seat-name">${seat.student.name}</span>`;
    if (seat.isLocked) {
      const dot = document.createElement('div');
      dot.className = 'fixed-dot';
      el.appendChild(dot);
    }
  }

  el.addEventListener('click', (e) => onSeatClick(seat.id, e));
  el.addEventListener('contextmenu', (e) => onSeatRightClick(seat.id, e));
  el.addEventListener('dragstart', (e) => onDragStart(seat.id, e));
  el.addEventListener('dragover', (e) => onDragOver(seat.id, e));
  el.addEventListener('dragleave', () => onDragLeave(seat.id));
  el.addEventListener('drop', (e) => onDrop(seat.id, e));

  const isDraggable = !seat.isGhost && !seat.excluded && !seat.isLocked;
  el.setAttribute('draggable', isDraggable);
  return el;
}

function onSeatClick(id, e) {
  const seat = state.seats.find(s => s.id === id);
  if (!seat || seat.isGhost) return;

  if (state.selectedSeatId) {
    if (state.selectedSeatId === id) {
      seat.isLocked = !seat.isLocked;
      if (seat.isLocked && seat.student) {
        seat.fixedFor = seat.student.id;
      } else {
        seat.fixedFor = null;
      }
      state.selectedSeatId = null;
    } else {
      const src = state.seats.find(s => s.id === state.selectedSeatId);
      if (src && !src.isGhost) {
        if (src.isLocked || seat.isLocked) {
          toast('잠긴 자리는 교환할 수 없습니다.', true);
          state.selectedSeatId = null;
          renderSeats();
          return;
        }
        [src.student, seat.student] = [seat.student, src.student];
        if (seat.student) seat.excluded = false;
        if (src.student) src.excluded = false;
        src.isLocked = false; seat.isLocked = false;
        src.fixedFor = null; seat.fixedFor = null;
      }
      state.selectedSeatId = null;
    }
  } else {
    if (!seat.student) {
      seat.excluded = !seat.excluded;
      updateBadge();
    } else {
      state.selectedSeatId = id;
    }
  }
  renderSeats();
  saveAutoState();
}

function onSeatRightClick(id, e) {
  e.preventDefault();
  const seat = state.seats.find(s => s.id === id);
  if (!seat || seat.isGhost) return;
  state.ctxTarget = seat;
  openContextMenu(e.clientX, e.clientY, seat);
}

function onDragStart(id, e) {
  const seat = state.seats.find(s => s.id === id);
  if (!seat || seat.isGhost || seat.isLocked) {
    e.preventDefault();
    if (seat && seat.isLocked) toast('잠긴 자리는 이동할 수 없습니다.', true);
    return;
  }
  state.dragSrcId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
}

function onDragOver(id, e) {
  e.preventDefault();
  if (state.dragSrcId && state.dragSrcId !== id) {
    state.overSeatId = id;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('over');
  }
}

function onDragLeave(id) {
  state.overSeatId = null;
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.remove('over');
}

function onDrop(id, e) {
  e.preventDefault();
  state.overSeatId = null;
  const srcId = state.dragSrcId || e.dataTransfer.getData('text/plain');
  state.dragSrcId = null;
  if (!srcId || srcId === id) { renderSeats(); return; }
  const src = state.seats.find(s => s.id === srcId);
  const dst = state.seats.find(s => s.id === id);
  if (!src || !dst) { renderSeats(); return; }

  if (src.isLocked || dst.isLocked) {
    toast('잠긴 자리는 교환할 수 없습니다.', true);
    renderSeats();
    return;
  }

  [src.student, dst.student] = [dst.student, src.student];
  if (dst.student) dst.excluded = false;
  if (src.student) src.excluded = false;
  src.isLocked = false; dst.isLocked = false;
  src.fixedFor = null; dst.fixedFor = null;

  renderSeats();
  updateBadge();
  saveAutoState();
}

function openContextMenu(x, y, seat) {
  const menu = document.getElementById('ctx-menu');
  document.getElementById('ctx-head').textContent = seat.student ? `자리: ${seat.student.id} ${seat.student.name}` : '빈 자리';
  const itemsEl = document.getElementById('ctx-items');
  itemsEl.innerHTML = '';

  if (seat.fixedFor) {
    const btn = document.createElement('div');
    btn.className = 'ctx-item danger';
    btn.textContent = '고정 해제';
    btn.onclick = () => { seat.fixedFor = null; seat.isLocked = false; closeCtx(); renderSeats(); };
    itemsEl.appendChild(btn);
    itemsEl.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-sep' }));
  }

  const lbl = document.createElement('div');
  lbl.className = 'ctx-head';
  lbl.textContent = '고정석으로 지정할 학생:';
  itemsEl.appendChild(lbl);

  const sl = document.createElement('div');
  sl.style.cssText = 'max-height:160px;overflow-y:auto;';
  state.students.forEach(st => {
    const btn = document.createElement('div');
    btn.className = 'ctx-item';
    btn.innerHTML = `<span style="background:#F18BA7;color:#fff;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:800;min-width:20px;text-align:center;">${st.id}</span> ${st.name}`;
    btn.onclick = () => {
      seat.fixedFor = st.id;
      seat.isLocked = false;
      toast(`${st.name}의 고정석이 지정되었습니다.`);
      closeCtx();
      renderSeats();
    };
    sl.appendChild(btn);
  });
  itemsEl.appendChild(sl);
  menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 300) + 'px';
  menu.classList.add('open');
  setTimeout(() => document.addEventListener('click', closeCtx, { once: true }), 10);
}

export function closeCtx() {
  const menu = document.getElementById('ctx-menu');
  if (menu) menu.classList.remove('open');
}

export function executeArrangement() {
  if (state.students.length === 0) {
    toast('먼저 학생 명단을 등록해주세요.', true);
    return;
  }

  const previousSeatsState = JSON.stringify(state.seats);
  const availSeats = state.seats.filter(s => !s.isGhost && !s.excluded);
  const lockedSeats = availSeats.filter(s => s.fixedFor);
  const freeSeats = availSeats.filter(s => !s.fixedFor);

  lockedSeats.forEach(seat => { seat.student = state.students.find(s => s.id === seat.fixedFor) || null; });
  const lockedIds = new Set(lockedSeats.map(s => s.fixedFor));
  let freeStudents = state.students.filter(s => !lockedIds.has(s.id));
  freeStudents = applyAlgo(freeStudents, cfg.algo, freeSeats);

  let assignTargetSeats = [...freeSeats];
  const layoutVal = document.getElementById('layout-type').value;
  if (cfg.algo === 'idAsc') {
    if (layoutVal === 'single') {
      assignTargetSeats.sort((a, b) => {
        if (a.colIdx !== b.colIdx) return a.colIdx - b.colIdx;
        return a.rowIdx - b.rowIdx;
      });
    } else {
      assignTargetSeats.sort((a, b) => {
        if (a.colIdx !== b.colIdx) return a.colIdx - b.colIdx;
        if (a.groupIdx !== b.groupIdx) return a.groupIdx - b.groupIdx;
        if (a.rowIdx !== b.rowIdx) return a.rowIdx - b.rowIdx;
        return a.orderIdx - b.orderIdx;
      });
    }
  }

  assignTargetSeats.forEach((seat, i) => { seat.student = freeStudents[i] || null; seat.isLocked = false; });
  state.seats.filter(s => s.isGhost || s.excluded).forEach(s => s.student = null);

  const useCountdown = document.getElementById('countdown-opt').checked;
  if (useCountdown) {
    // 카운트다운 완료 후 renderSeats()가 실행되도록 카운트다운 시작
    startArrangeCountdown(previousSeatsState);
  } else {
    renderSeats();
    setBubbleText('<span style="font-size:15px; font-weight:800;">배치 완료! 🎉</span>');
    toast('배치가 완료되었습니다!');
    setTimeout(() => {
      if (!state.countdownTimer) setBubbleText('오늘의 자리를 배치해볼까요?');
    }, 3000);
  }
}

let currentCancelClickHandler = null;

export function cleanupCountdownEvents() {
  if (currentCancelClickHandler) {
    window.removeEventListener('click', currentCancelClickHandler, true);
    currentCancelClickHandler = null;
  }
  const overlay = document.getElementById('countdown-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

export function setBubbleText(htmlContent, isCounting = false) {
  const bubble = document.getElementById('char-bubble');
  const bubbleText = document.getElementById('bubble-text');
  if (bubbleText) bubbleText.innerHTML = htmlContent;
  if (bubble) {
    if (isCounting) bubble.classList.add('counting');
    else bubble.classList.remove('counting');
  }
}

export function cancelArrangement() {
  state.isArrangementCancelled = true;
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  cleanupCountdownEvents();
  if (state.prevStateJson) {
    state.seats = JSON.parse(state.prevStateJson);
  }
  renderSeats();
  setBubbleText('<span style="font-size:14px;">배치가 취소되었습니다 😅</span>');
  toast('자리 배치가 취소되었습니다.', true);
  setTimeout(() => {
    if (!state.countdownTimer) setBubbleText('오늘의 자리를 배치해볼까요?');
  }, 2500);
}

export function playMarimbaStep(n) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const freqs = [523.25, 587.33, 659.25, 698.46, 783.99];
    const idx = 5 - n;
    const freq = freqs[Math.max(0, Math.min(idx, freqs.length - 1))];

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.42, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

export function playMarimbaFanfare() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.36, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }, i * 70);
    });
  } catch (e) {}
}

export function startArrangeCountdown(prevState) {
  state.isArrangementCancelled = false;
  state.prevStateJson = prevState;
  cleanupCountdownEvents();
  let n = 5;

  const overlay = document.getElementById('countdown-overlay');
  const charImg = document.getElementById('countdown-char-img');
  const numText = document.getElementById('countdown-num-text');

  const updateCountdownDisplay = (count) => {
    setBubbleText(`<span style="font-size:15px;">공개까지 <span style="font-size:21px; font-weight:900; color:#f43f5e; margin:0 2px;">${count}</span>초 전!</span>`, true);
    if (overlay && charImg && numText) {
      charImg.style.animation = 'none';
      numText.style.animation = 'none';
      void charImg.offsetWidth;
      void numText.offsetWidth;

      charImg.src = `loopy/${count}.png`;
      numText.textContent = count;

      charImg.style.animation = 'countdownPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      numText.style.animation = 'countdownPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      overlay.style.display = 'flex';
    }
  };

  updateCountdownDisplay(n);
  playMarimbaStep(n);

  setTimeout(() => {
    if (state.countdownTimer && !state.isArrangementCancelled) {
      currentCancelClickHandler = (e) => {
        if (state.countdownTimer && !state.isArrangementCancelled) {
          cancelArrangement();
        }
      };
      window.addEventListener('click', currentCancelClickHandler, true);
    }
  }, 50);

  state.countdownTimer = setInterval(() => {
    if (state.isArrangementCancelled) {
      cleanupCountdownEvents();
      return;
    }
    n--;
    if (n <= 0) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
      cleanupCountdownEvents();
      playMarimbaFanfare();
      renderSeats();
      setBubbleText('<span style="font-size:15px; font-weight:800;">배치 완료! 🎉</span>');
      toast('배치가 공개되었습니다!');
      setTimeout(() => {
        if (!state.countdownTimer) setBubbleText('오늘의 자리를 배치해볼까요?');
      }, 3000);
    } else {
      playMarimbaStep(n);
      updateCountdownDisplay(n);
    }
  }, 1000);
}

export function toggleTeacherView() {
  const checkbox = document.getElementById('teacher-view-toggle');
  if (checkbox) {
    state.teacherView = checkbox.checked;
  } else {
    state.teacherView = !state.teacherView;
  }
  const blackboard = document.getElementById('blackboard-el');
  const boardArea = document.getElementById('board-area');
  if (checkbox) checkbox.checked = state.teacherView;
  if (blackboard) blackboard.textContent = '칠판';
  if (boardArea) {
    if (state.teacherView) boardArea.classList.add('teacher-mode');
    else boardArea.classList.remove('teacher-mode');
  }
  renderSeats();
}

export function updateBadge() {
  const badge = document.getElementById('avail-badge');
  if (badge) {
    badge.textContent = `${state.seats.filter(s => !s.isGhost && !s.excluded).length}석`;
  }
}

export function resetArrangement() {
  customConfirm('배치된 모든 자리와 고정석/제외석 설정을 초기화하시겠습니까?', () => {
    state.seats.forEach(s => {
      s.student = null;
      s.isLocked = false;
      s.fixedFor = null;
      s.excluded = false;
    });
    renderSeats();
    updateBadge();
    toast('자리 배치가 초기화되었습니다.');
    if (typeof saveAutoState === 'function') saveAutoState();
  });
}

export function fitToWorkspace() {
  const workspace = document.getElementById('workspace');
  const boardArea = document.getElementById('board-area');
  const seatsWrap = document.getElementById('seats-wrap');
  if (!workspace || !boardArea || !seatsWrap) return;

  try {
    boardArea.style.zoom = '1';
    boardArea.style.transform = 'none';

    const baseCellW = 100;
    const baseCellH = 75;
    const baseColGap = 55;
    const baseRowGap = 15;
    const isTeacherMode = boardArea.classList.contains('teacher-mode');

    // 1. 베이스 측정값을 임시 적용하여 실제 DOM의 언스케일 폭/높이를 측정
    document.documentElement.style.setProperty('--cell-w', `${baseCellW}px`);
    document.documentElement.style.setProperty('--cell-h', `${baseCellH}px`);
    document.documentElement.style.setProperty('--col-gap', `${baseColGap}px`);
    document.documentElement.style.setProperty('--row-gap', `${baseRowGap}px`);

    const boardRect = boardArea.getBoundingClientRect();
    const actualUnscaledW = Math.max(boardArea.scrollWidth, seatsWrap.offsetWidth, 400) + 24;
    const actualUnscaledH = Math.max(boardArea.scrollHeight, boardRect.height) + 24;

    const availW = workspace.clientWidth - 24;
    const availH = workspace.clientHeight - 48;

    if (availW <= 0 || availH <= 0) return;

    // 2. 가로/세로 비율 중 더 작은 스케일 선택
    const scaleX = availW / actualUnscaledW;
    const scaleY = availH / actualUnscaledH;
    let scale = Math.min(scaleX, scaleY) * 0.92; // 하단 넉넉한 여백용 8% 안전 축소

    if (scale > 1.6) scale = 1.6;
    if (scale < 0.12) scale = 0.12;

    const cellW = Math.max(26, Math.floor(baseCellW * scale));
    const cellH = Math.max(18, Math.floor(baseCellH * scale));
    const colGap = Math.max(3, Math.floor(baseColGap * scale));
    const rowGap = Math.max(2, Math.floor(baseRowGap * scale));

    document.documentElement.style.setProperty('--cell-w', `${cellW}px`);
    document.documentElement.style.setProperty('--cell-h', `${cellH}px`);
    document.documentElement.style.setProperty('--col-gap', `${colGap}px`);
    document.documentElement.style.setProperty('--row-gap', `${rowGap}px`);
    document.documentElement.style.setProperty('--name-size', `${Math.max(10, Math.floor(15 * scale + 2.5))}px`);
    document.documentElement.style.setProperty('--id-size', `${Math.max(9, Math.floor(11 * scale + 3.5))}px`);

    const container = document.getElementById('seats-container');
    if (container) container.style.gap = `${colGap}px`;
    document.querySelectorAll('.col-group').forEach(c => c.style.gap = `${rowGap}px`);
  } catch (e) {
    console.error(e);
  }
}

export function playBeep(freq, duration, vol) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.countdownTimer && !state.isArrangementCancelled) {
    cancelArrangement();
  }
});

window.addEventListener('resize', fitToWorkspace);
window.addEventListener('orientationchange', () => setTimeout(fitToWorkspace, 250));
window.addEventListener('load', fitToWorkspace);
document.addEventListener('DOMContentLoaded', fitToWorkspace);
setTimeout(fitToWorkspace, 100);
setTimeout(fitToWorkspace, 300);
setTimeout(fitToWorkspace, 800);
