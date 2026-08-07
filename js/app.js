// ─── State ───────────────────────────────────────────────────────────────────
let students = [];
let seats = [];
 
let selectedSeatId = null;
let dragSrcId = null;
let overSeatId = null;
let countdownTimer = null;
let ctxTarget = null;
let confirmCallback = null;
let teacherView = false;  

// 카운트다운 스킵 상태
let isArrangementCancelled = false;

const cfg = {
  seatCount: 30,
  colCount: 5,
  layoutType: 'single',
  algo: 'random',
  rowGap: 8,
  colGap: 48,
  cellW: 100,
  cellH: 75,
  fontFamily: "'Gowun Dodum', sans-serif"
};

window.getArrangementDataForSave = function() {
  const data = {
    version: 2,
    students, cfg,
    seats: seats.map(s => ({ id:s.id, isGhost:s.isGhost, excluded:s.excluded, isLocked:s.isLocked, orderIdx:s.orderIdx, colIdx:s.colIdx, rowIdx:s.rowIdx, fixedFor:s.fixedFor, studentId:s.student?s.student.id:null })),
  };
  return JSON.stringify(data, null, 2);
};

// ─── Web Audio API 효과음 (카운트다운용) ─────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(freq, duration, vol) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
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

// ─── 동적 드롭다운 매핑 데이터 및 로직 ───────────────────────────
const ALGO_OPTIONS = {
  single: [
    { val: 'idAsc', text: '번호 순서' },
    { val: 'random', text: '무작위' },
    { val: 'genderSeparate', text: '남녀 최대 분리' }
  ],
  pair: [
    { val: 'idAsc', text: '번호 순서' },
    { val: 'random', text: '무작위' },
    { val: 'genderPair', text: '남녀 짝궁' },
    { val: 'genderMixCluster', text: '동성 짝궁(분단교차)' },
    { val: 'genderMixRow', text: '동성 짝궁(줄별교차)' },
    { val: 'genderSeparate', text: '동성짝궁(남녀최대분리)' } 
  ],
  group: [
    { val: 'idAsc', text: '번호 순서' },
    { val: 'random', text: '무작위' },
    { val: 'genderSeparate', text: '남녀 최대 분리' },
    { val: 'genderPair', text: '남녀 짝궁' },
    { val: 'genderSameGroup', text: '동성 짝궁' }
  ],
  group6: [
    { val: 'idAsc', text: '번호 순서' },
    { val: 'random', text: '무작위' },
    { val: 'genderSeparate', text: '남녀 최대 분리' },
    { val: 'genderPair', text: '남녀 짝궁' },
    { val: 'genderSameGroup', text: '동성 짝궁' }
  ]
};

function updateSelectLogic() {
  const layoutVal = document.getElementById('layout-type').value;
  const algoSelect = document.getElementById('sort-algo');
  const currentAlgo = algoSelect.value || cfg.algo; 

  algoSelect.innerHTML = '';
  const allowedOptions = ALGO_OPTIONS[layoutVal];
  let isCurrentAlgoValid = false;

  allowedOptions.forEach(opt => {
    const newOption = document.createElement('option');
    newOption.value = opt.val;
    newOption.textContent = opt.text;
    algoSelect.appendChild(newOption);
    if (opt.val === currentAlgo) {
      isCurrentAlgoValid = true;
    }
  });

  if (isCurrentAlgoValid && currentAlgo) {
    algoSelect.value = currentAlgo;
    cfg.algo = currentAlgo;
  } else {
    algoSelect.value = 'random';
    cfg.algo = 'random';
  }
}

// ─── Layout definitions ──────────────────────────────────────────────────────
const LAYOUTS = {
  single:  { rows: [[0]],                           cols: 1 },
  pair:    { rows: [[0,0]],                         cols: 2 },
  group:   { rows: [[0,0],[0,0]],                   cols: 2 },
  group6:  { rows: [[0,0],[0,0],[0,0]],             cols: 2 }
};

function getLayoutRows(type) { return (LAYOUTS[type] || LAYOUTS.single).rows; }

function buildColumnSlots(colIdx, type, pairCount) {
  const rows = getLayoutRows(type);
  const slots = [];
  let rowCounter = 0;
  for (let p = 0; p < pairCount; p++) {
    for (let r = 0; r < rows.length; r++) {
      for (const cell of rows[r]) {
        slots.push({ isGhost: cell === 1, rowIdx: rowCounter, colIdx: colIdx, groupIdx: p });
      }
      rowCounter++;
    }
  }
  return slots;
}

function initSeats() {
  const total = cfg.seatCount;
  const cols  = cfg.colCount;
  const layout = LAYOUTS[cfg.layoutType] || LAYOUTS.single;

  const seatsPerBlock = layout.rows.reduce((a, r) => a + r.filter(v => v === 0).length, 0);

  let allSlots = [];
  const seatsPerCol = Math.ceil(total / cols);
  const pairsPerCol = seatsPerBlock > 0 ? Math.ceil(seatsPerCol / seatsPerBlock) : 1;

  for (let c = 0; c < cols; c++) {
    const colSlots = buildColumnSlots(c, cfg.layoutType, pairsPerCol);
    allSlots.push(...colSlots);
  }

  let availCount = allSlots.filter(s => !s.isGhost).length;
  if (availCount > total) {
    let toRemove = availCount - total;
    for (let i = allSlots.length - 1; i >= 0 && toRemove > 0; i--) {
      if (!allSlots[i].isGhost) {
        allSlots[i].isGhost = true;
        toRemove--;
      }
    }
  }

  seats = allSlots.map((slot, i) => ({
    id: 'seat-' + i,
    isGhost: slot.isGhost,
    excluded: false,
    student: null,
    isLocked: false,
    orderIdx: i,
    colIdx: slot.colIdx,
    rowIdx: slot.rowIdx, 
    groupIdx: slot.groupIdx,
    fixedFor: null,
  }));

  renderSeats();
  updateBadge();
}

function renderSeats() {
  const container = document.getElementById('seats-container');
  container.innerHTML = '';
  
  container.style.gap = cfg.colGap + 'px';

  document.documentElement.style.setProperty('--cell-w', cfg.cellW + 'px');
  document.documentElement.style.setProperty('--cell-h', cfg.cellH + 'px');
  document.documentElement.style.setProperty('--row-gap', cfg.rowGap + 'px');
  document.documentElement.style.setProperty('--col-gap', cfg.colGap + 'px');

  if (seats.length === 0) {
    container.innerHTML = '<div style="padding:40px;color:#9ca3af;text-align:center;">학생 명단을 등록하고<br>자리 배치를 실행하세요.</div>';
    return;
  }

  const cols = cfg.colCount;
  const rowPattern = getLayoutRows(cfg.layoutType);

  const colGroups = {};
  for (const seat of seats) {
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
        labelDiv.textContent = (c + 1) + '분단';
        colDiv.appendChild(labelDiv);
    }

    let slotI = 0;
    while (slotI < colSeats.length) {
      const blockDiv = document.createElement('div');
      blockDiv.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
      
      if (cfg.layoutType === 'group' || cfg.layoutType === 'group6') {
          const blockSeats = colSeats.slice(slotI, slotI + rowPattern.reduce((a,r)=>a+r.length,0));
          const hasValidSeat = blockSeats.some(s => !s.isGhost);
          
          if (hasValidSeat) {
              const gLabel = document.createElement('div');
              gLabel.className = 'group-label';
              gLabel.textContent = `${globalGroupCounter}모둠`;
              blockDiv.appendChild(gLabel);
              globalGroupCounter++;
          }
      }
      
      for (const rowCells of rowPattern) {
        if (slotI >= colSeats.length) break;
        const rowDiv = document.createElement('div');
        rowDiv.style.cssText = `display:flex; gap:2px;`;
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

  if (teacherView) {
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
}

function createSeatEl(seat) {
  const el = document.createElement('div');
  el.dataset.id = seat.id;

  let cls = 'seat';
  if (seat.isGhost) cls += ' ghost';
  else if (seat.excluded) cls += ' excluded';
  else if (seat.student) cls += ' occupied';
  if (seat.isLocked && !seat.isGhost && !seat.excluded) cls += ' locked';
  if (seat.id === selectedSeatId) cls += ' selected';
  if (seat.id === overSeatId) cls += ' over';
  
  if (seat.student) {
    if (seat.student.gender === '남') {
      cls += ' male';
    } else if (seat.student.gender === '여') {
      cls += ' female';
    }
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
  const seat = seats.find(s => s.id === id);
  if (!seat || seat.isGhost) return;

  if (selectedSeatId) {
    if (selectedSeatId === id) {
      seat.isLocked = !seat.isLocked; 
      if (seat.isLocked && seat.student) {
          seat.fixedFor = seat.student.id;
      } else {
          seat.fixedFor = null;
      }
      selectedSeatId = null;
    } else {
      const src = seats.find(s => s.id === selectedSeatId);
      if (src && !src.isGhost) {
        if (src.isLocked || seat.isLocked) {
           toast('잠긴 자리는 교환할 수 없습니다.', true);
           selectedSeatId = null;
           renderSeats();
           return;
        }
        [src.student, seat.student] = [seat.student, src.student];
        if (seat.student) seat.excluded = false;
        if (src.student) src.excluded = false;
        src.isLocked = false; seat.isLocked = false;
        src.fixedFor = null; seat.fixedFor = null;
      }
      selectedSeatId = null;
    }
  } else {
    if (!seat.student) {
      seat.excluded = !seat.excluded;
      updateBadge();
    } else {
      selectedSeatId = id;
    }
  }
  renderSeats();
}

function onSeatRightClick(id, e) {
  e.preventDefault();
  const seat = seats.find(s => s.id === id);
  if (!seat || seat.isGhost) return;
  ctxTarget = seat;
  openContextMenu(e.clientX, e.clientY, seat);
}

function onDragStart(id, e) {
  const seat = seats.find(s => s.id === id);
  if (!seat || seat.isGhost || seat.isLocked) {
      e.preventDefault();
      if(seat && seat.isLocked) toast('잠긴 자리는 이동할 수 없습니다.', true);
      return;
  }
  dragSrcId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
}

function onDragOver(id, e) {
  e.preventDefault();
  if (dragSrcId && dragSrcId !== id) {
    overSeatId = id;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('over');
  }
}

function onDragLeave(id) {
  overSeatId = null;
  const el = document.querySelector(`[data-id="${id}"]`);
  if (el) el.classList.remove('over');
}

function onDrop(id, e) {
  e.preventDefault(); overSeatId = null;
  const srcId = dragSrcId || e.dataTransfer.getData('text/plain');
  dragSrcId = null;
  if (!srcId || srcId === id) { renderSeats(); return; }
  const src = seats.find(s => s.id === srcId);
  const dst = seats.find(s => s.id === id);
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

  renderSeats(); updateBadge();
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
  const lbl = document.createElement('div'); lbl.className = 'ctx-head'; lbl.textContent = '고정석으로 지정할 학생:';
  itemsEl.appendChild(lbl);
  const sl = document.createElement('div'); sl.style.cssText = 'max-height:160px;overflow-y:auto;';
  students.forEach(st => {
    const btn = document.createElement('div'); btn.className = 'ctx-item';
    btn.innerHTML = `<span style="background:var(--accent);color:#fff;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:800;min-width:20px;text-align:center;">${st.id}</span> ${st.name}`;
    btn.onclick = () => { seat.fixedFor = st.id; seat.isLocked = false; toast(`${st.name}의 고정석이 지정되었습니다.`); closeCtx(); renderSeats(); };
    sl.appendChild(btn);
  });
  itemsEl.appendChild(sl);
  menu.style.left = Math.min(x, window.innerWidth - 220) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 300) + 'px';
  menu.classList.add('open');
  setTimeout(() => document.addEventListener('click', closeCtx, { once: true }), 10);
}
function closeCtx() { document.getElementById('ctx-menu').classList.remove('open'); }

function executeArrangement() {
  const layoutVal = document.getElementById('layout-type').value;
  const algoVal = document.getElementById('sort-algo').value;

  if (students.length === 0) { toast('먼저 학생 명단을 등록해주세요.', true);  return; }
  
  const previousSeatsState = JSON.stringify(seats);

  const availSeats = seats.filter(s => !s.isGhost && !s.excluded);
  const lockedSeats = availSeats.filter(s => s.fixedFor);
  const freeSeats = availSeats.filter(s => !s.fixedFor);
  
  lockedSeats.forEach(seat => { seat.student = students.find(s => s.id === seat.fixedFor) || null; });
  const lockedIds = new Set(lockedSeats.map(s => s.fixedFor));
  let freeStudents = students.filter(s => !lockedIds.has(s.id));
  
  // 변경된 applyAlgo는 freeSeats와 1:1로 매칭되는 학생 배열을 반환합니다.
  freeStudents = applyAlgo(freeStudents, cfg.algo, freeSeats);
  
  let assignTargetSeats = [...freeSeats];
  // 번호순 정렬일 때는 좌석도 정렬해서 순서대로 끼워맞춤
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
  seats.filter(s => s.isGhost || s.excluded).forEach(s => s.student = null);
  
  const useCountdown = document.getElementById('countdown-opt').checked;
  if (useCountdown) {
    renderSeats();
    startArrangeCountdown(previousSeatsState);
  } else {
    renderSeats();
    toast('배치가 완료되었습니다!');
  }
}

// 클릭/ESC로 카운트다운 스킵
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && countdownTimer && !isArrangementCancelled) {
        cancelArrangement();
    }
});

function cancelArrangement() {
    isArrangementCancelled = true;
    clearInterval(countdownTimer);
    const overlay = document.getElementById('countdown-overlay');
    overlay.style.display = 'none';
    
    // 배치 이전 상태로 완벽 복원
    seats = JSON.parse(window.prevStateJson);
    renderSeats();
    toast('자리 배치가 취소되었습니다.', true);
}

function startArrangeCountdown(prevState) {
  isArrangementCancelled = false;
  window.prevStateJson = prevState;
  let n = 5;
  const overlay = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-num');
  overlay.style.display = 'flex';
  numEl.textContent = n;
  
  playBeep(440, 0.1, 0.1);

  const clickHandler = () => {
      if(countdownTimer && !isArrangementCancelled) cancelArrangement();
  };
  overlay.addEventListener('click', clickHandler);

  countdownTimer = setInterval(() => {
    if (isArrangementCancelled) {
        overlay.removeEventListener('click', clickHandler);
        return;
    }
    
    n--;
    if (n <= 0) {
      clearInterval(countdownTimer);
      overlay.removeEventListener('click', clickHandler);
      playBeep(880, 0.5, 0.2); 
      overlay.style.display = 'none';
      toast('배치가 공개되었습니다!');
    } else {
      playBeep(440, 0.1, 0.1); 
      numEl.textContent = n;
    }
  }, 1000);
}

// ─── 핵심 로직: 전체 좌석의 잠금 상태를 파악하여 성별 강제 ───────────────────────────
function applyAlgo(studentList, algo, freeSeats) {
  const s = [...studentList];
  
  if (algo === 'random') return shuffle(s);

  if (algo === 'idAsc') {
    return s.sort((a, b) => String(a.id||'').localeCompare(String(b.id||''), 'ko', { numeric: true }));
  }

  let m = shuffle(s.filter(x => x.gender === '남'));
  let f = shuffle(s.filter(x => x.gender === '여'));
  let o = shuffle(s.filter(x => x.gender !== '남' && x.gender !== '여'));

  const popStudent = (pref) => {
    if (pref === '남' && m.length > 0) return m.pop();
    if (pref === '여' && f.length > 0) return f.pop();
    if (o.length > 0) return o.pop();
    // 타겟 성별이 없으면 남은 학생 중 아무나 (Fallback)
    if (m.length > 0) return m.pop();
    if (f.length > 0) return f.pop();
    return null;
  };

  let result = new Array(freeSeats.length).fill(null);
  let blocksMap = new Map();
  freeSeats.forEach((seat, idx) => {
     let key = seat.colIdx + '-' + seat.groupIdx;
     if (!blocksMap.has(key)) blocksMap.set(key, { key: key, idxs: [] });
     blocksMap.get(key).idxs.push(idx);
  });
  let blocks = Array.from(blocksMap.values());

  // [추가된 부분] 전체 좌석(글로벌 변수 seats)을 훑어서 이미 잠긴 자리의 성별을 파악!
  let lockedConstraints = new Map();
  seats.filter(s => s.fixedFor && !s.isGhost && !s.excluded && s.student).forEach(s => {
     let key = s.colIdx + '-' + s.groupIdx;
     if (s.student.gender === '남' || s.student.gender === '여') {
         // 이 묶음(짝꿍/모둠)에는 무조건 이 성별이 들어가야 한다는 룰을 저장
         lockedConstraints.set(key, s.student.gender);
     }
  });

  if (algo === 'genderPair') { 
    blocks.forEach(blockObj => {
      blockObj.idxs.forEach(idx => {
        let seat = freeSeats[idx];
        
        // 핵심: 짝꿍 자리 중 왼쪽(짝수 인덱스)은 '남', 오른쪽(홀수 인덱스)은 '여'로 강제 지정
        let p = (seat.orderIdx % 2 === 0) ? '남' : '여';

        // 단, 선생님께서 특정 자리에 미리 자물쇠를 채워두셨다면?
        // 그 옆자리는 남녀 짝꿍을 유지하기 위해 고정된 학생의 '반대 성별'을 무조건 요구합니다.
        if (lockedConstraints.has(blockObj.key)) {
          let lockedGender = lockedConstraints.get(blockObj.key);
          p = (lockedGender === '남') ? '여' : '남';
        }

        // popStudent() 함수가 '남'을 요구해도 남학생이 없으면 알아서 여학생을 뽑아줍니다.
        result[idx] = popStudent(p);
      });
    });
    return result;
  }

  // 동성 짝꿍 로직 (분단교차, 줄별교차, 모둠)
  if (algo === 'genderMixCluster' || algo === 'genderMixRow' || algo === 'genderSameGroup') { 
    const startMale = Math.random() < 0.5;
    
    blocks.forEach((blockObj, blockNumber) => {
      let seatIdxs = blockObj.idxs;
      let firstSeat = freeSeats[seatIdxs[0]];
      let pref = '남';

      if (algo === 'genderMixCluster') {
        pref = (firstSeat.colIdx % 2 === 0) ? (startMale ? '남' : '여') : (startMale ? '여' : '남');
      } else if (algo === 'genderMixRow') {
        pref = (firstSeat.rowIdx % 2 === 0) ? (startMale ? '남' : '여') : (startMale ? '여' : '남');
      } else { 
        pref = (blockNumber % 2 === 0) ? (startMale ? '남' : '여') : (startMale ? '여' : '남');
      }

      // 잠긴 자리가 있다면 해당 자리의 성별로 덮어쓰기! (이게 핵심)
      if (lockedConstraints.has(blockObj.key)) {
          pref = lockedConstraints.get(blockObj.key);
      } else {
          // 제약이 없을 때만 남은 인원을 체크하여 뒤집음
          let pool = pref === '남' ? m : f;
          let otherPool = pref === '남' ? f : m;
          if (pool.length < seatIdxs.length && otherPool.length >= seatIdxs.length) {
              pref = (pref === '남') ? '여' : '남';
          }
      }

      seatIdxs.forEach((idx) => {
        result[idx] = popStudent(pref);
      });
    });
    return result;
  }

  // 남녀 최대 분리 로직 (동성 짝꿍 유지)
  if (algo === 'genderSeparate') {
    const startMale = Math.random() < 0.5;
    let mainPref = startMale ? '남' : '여';
    let subPref = startMale ? '여' : '남';

    blocks.forEach(blockObj => {
      let targetPref = mainPref;

      // 여기도 잠긴 자리가 있다면 해당 짝꿍은 잠긴 자리와 동일한 성별로 강제!
      if (lockedConstraints.has(blockObj.key)) {
          targetPref = lockedConstraints.get(blockObj.key);
      } else {
          let mainPool = mainPref === '남' ? m : f;
          let subPool = subPref === '남' ? m : f;
          if (mainPool.length < blockObj.idxs.length && subPool.length >= blockObj.idxs.length) {
              mainPref = subPref;
              subPref = targetPref;
              targetPref = mainPref;
          }
      }

      blockObj.idxs.forEach((idx) => {
        result[idx] = popStudent(targetPref);
      });
    });
    return result;
  }

  return shuffle(s);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const INIT_ROWS = 10;

function buildGridRow(id = '', name = '', gender = '') {
  const row = document.createElement('div');
  row.className = 'student-row';
  ['번호', '이름', '성별'].forEach((ph, colI) => {
    const cell = document.createElement('div');
    cell.className = 'student-cell';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = ph;
    inp.value = [id, name, gender][colI];
    inp.dataset.col = colI;

    inp.addEventListener('keydown', e => {
      const allRows = [...document.querySelectorAll('#student-grid-body .student-row')];
      const rowIdx = allRows.indexOf(row);
      const totalCols = 3;

      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (rowIdx === allRows.length - 1) addStudentRow();
        const nextRow = document.querySelectorAll('#student-grid-body .student-row')[rowIdx + 1];
        if (nextRow) nextRow.querySelectorAll('input')[colI].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (rowIdx > 0) allRows[rowIdx - 1].querySelectorAll('input')[colI].focus();
      } else if (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length) {
        e.preventDefault();
        if (colI < totalCols - 1) {
          row.querySelectorAll('input')[colI + 1].focus();
        } else if (rowIdx < allRows.length - 1) {
          allRows[rowIdx + 1].querySelectorAll('input')[0].focus();
        }
      } else if (e.key === 'ArrowLeft' && inp.selectionStart === 0) {
        e.preventDefault();
        if (colI > 0) {
          row.querySelectorAll('input')[colI - 1].focus();
        } else if (rowIdx > 0) {
          const prevInputs = allRows[rowIdx - 1].querySelectorAll('input');
          prevInputs[prevInputs.length - 1].focus();
        }
      } else if (e.key === 'Tab' && !e.shiftKey && colI === 2) {
        e.preventDefault();
        if (rowIdx === allRows.length - 1) addStudentRow();
        const nextRow2 = document.querySelectorAll('#student-grid-body .student-row')[rowIdx + 1];
        if (nextRow2) nextRow2.querySelector('input').focus();
      }
    });

    cell.appendChild(inp);
    row.appendChild(cell);
  });
  return row;
}

function initGrid(count = INIT_ROWS) {
  const body = document.getElementById('student-grid-body');
  if (!body) return;
  body.innerHTML = '';
  for (let i = 0; i < count; i++) body.appendChild(buildGridRow());
}

function addStudentRow() {
  document.getElementById('student-grid-body').appendChild(buildGridRow());
}

function clearGrid() {
  initGrid(INIT_ROWS);
}

const sgBody = document.getElementById('student-grid-body');
if (sgBody) sgBody.addEventListener('paste', async (e) => {
  e.preventDefault();
  let text = (e.clipboardData || window.clipboardData).getData('text');
  if(!text) return;
  
  const lines = text.trim().split('\n').filter(l => l.trim());
  const body = document.getElementById('student-grid-body');
  body.innerHTML = '';
  lines.forEach(line => {
    const cols = line.split(/\t|,/);
    body.appendChild(buildGridRow((cols[0]||'').trim(), (cols[1]||'').trim(), (cols[2]||'').trim()));
  });
  for (let i = 0; i < 3; i++) body.appendChild(buildGridRow());
  toast(`${lines.length}명 명단 붙여넣기 완료`);
  applyStudents();
});

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    const lines = text.trim().split('\n').filter(l => l.trim());
    const body = document.getElementById('student-grid-body');
    body.innerHTML = '';
    lines.forEach(line => {
      const cols = line.split(/\t|,/);
      body.appendChild(buildGridRow((cols[0]||'').trim(), (cols[1]||'').trim(), (cols[2]||'').trim()));
    });
    for (let i = 0; i < 3; i++) body.appendChild(buildGridRow());
    toast(`${lines.length}명 명단 붙여넣기 완료`);
    applyStudents();
  } catch {
    toast('클립보드 접근에 실패했습니다. 표 안에서 직접 Ctrl+V 를 눌러주세요.', true);
  }
}

function applyStudents() {
  const rows = document.querySelectorAll('#student-grid-body .student-row');
  const parsed = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const id = inputs[0].value.trim();
    const name = inputs[1].value.trim();
    const gender = inputs[2].value.trim();
    if (id && name) parsed.push({ id, name, gender, c1: '', c2: '', note: '' });
  });
  if (parsed.length === 0) { toast('유효한 학생 데이터가 없습니다.', true); return; }
  students = parsed;
  updateStudentListPreview();
  document.getElementById('student-count-info').textContent = `총 ${students.length}명 등록됨`;
  toast(`${students.length}명의 학생 명단이 적용되었습니다.`);
}

function updateStudentListPreview() {
  const el = document.getElementById('student-list-preview');
  if (!el) return;
  if (students.length === 0) { el.innerHTML = '<span style="color:var(--textm);">등록된 학생이 없습니다.</span>'; return; }
  el.innerHTML = students.map(s =>
    `<div style="display:flex;gap:8px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <span style="background:var(--accent);color:#fff;border-radius:4px;padding:0 5px;font-size:10px;font-weight:800;min-width:24px;text-align:center;line-height:1.9;">${s.id}</span>
      <span>${s.name}</span>
      ${s.gender ? `<span style="color:${s.gender==='남'?'#60a5fa':'#f472b6'};font-size:10px;">${s.gender}</span>` : ''}
    </div>`
  ).join('');
}



function onLayoutChange() {
  const newLayout = document.getElementById('layout-type').value;
  const isChanged = cfg.layoutType !== newLayout;
  cfg.layoutType = newLayout;
  
  if (isChanged) {
    const colGapInput = document.getElementById('col-gap-range');
    if (cfg.layoutType === 'pair') {
      cfg.seatCount = 30;
      cfg.colCount = 3;
      cfg.colGap = 48;
      document.getElementById('seat-count').value = 30;
      document.getElementById('col-count').value = 3;
      if (colGapInput) colGapInput.value = 48;
    } else if (cfg.layoutType === 'single') {
      cfg.seatCount = 30;
      cfg.colCount = 5;
      cfg.colGap = 48;
      document.getElementById('seat-count').value = 30;
      document.getElementById('col-count').value = 5;
      if (colGapInput) colGapInput.value = 48;
    } else if (cfg.layoutType === 'group' || cfg.layoutType === 'group6') {
      cfg.seatCount = 30;
      cfg.colCount = 3;
      cfg.colGap = 12;
      document.getElementById('seat-count').value = 30;
      document.getElementById('col-count').value = 3;
      if (colGapInput) colGapInput.value = 12;
    }
    document.documentElement.style.setProperty('--col-gap', cfg.colGap + 'px');
  }

  updateSelectLogic();
  initSeats(); 
}

function onAlgoChange() {
  cfg.algo = document.getElementById('sort-algo').value;
}

function onSeatCountChange() {
  cfg.seatCount = parseInt(document.getElementById('seat-count').value) || 30;
  initSeats();
}

function onColCountChange() {
  cfg.colCount = Math.max(2, Math.min(6, parseInt(document.getElementById('col-count').value) || 5));
  document.getElementById('col-count').value = cfg.colCount;
  initSeats();
}

function onGapChange() {
  const rEl = document.getElementById('row-gap-range');
  const cEl = document.getElementById('col-gap-range');
  if (rEl) cfg.rowGap = parseInt(rEl.value) || 0;
  if (cEl) cfg.colGap = parseInt(cEl.value) || 0;
  document.documentElement.style.setProperty('--row-gap', cfg.rowGap + 'px');
  document.documentElement.style.setProperty('--col-gap', cfg.colGap + 'px');
  renderSeats();
}

function onFontChange() {
  const el = document.getElementById('font-family');
  cfg.fontFamily = el ? el.value : "'Gowun Dodum', sans-serif";
  document.documentElement.style.setProperty('--seat-font', cfg.fontFamily);
}

function updateBadge() {
  const badge = document.getElementById('avail-badge');
  if (badge) {
    badge.textContent = seats.filter(s => !s.isGhost && !s.excluded).length + '석';
  }
}

let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.innerHTML = msg;
  if(isError) {
      el.classList.add('error');
  } else {
      el.classList.remove('error');
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 4000 : 2500);
}

function showConfirm(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-modal').style.display = 'flex';
  confirmCallback = cb;
}

function confirmOk() {
  document.getElementById('confirm-modal').style.display = 'none';
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
}

function confirmCancel() {
  document.getElementById('confirm-modal').style.display = 'none';
  confirmCallback = null;
}

function confirmResetArrangement() {
  showConfirm('현재 배치를 초기화하시겠습니까?\n(학생 명단은 유지됩니다.)', () => {
    seats.forEach(s => { s.student = null; s.isLocked = false; s.fixedFor = null; });
    renderSeats(); toast('배치가 초기화되었습니다.');
  });
}

// ── 파일 저장 API 연동 ──
async function saveFile() {
  const jsonStr = window.getArrangementDataForSave();
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `자리배치 정보(${yy}.${mm}.${dd}).rsb`;
  
  if (window.pywebview && window.pywebview.api && window.pywebview.api.save_data_file) {
    const result = await window.pywebview.api.save_data_file(filename, jsonStr);
    if (result.ok) {
      toast(`저장 완료`);
    } else if (result.error) {
      toast('저장 취소 또는 실패: ' + result.error, true);
    }
  } else {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    toast('파일이 저장되었습니다.');
  }
}

// ── 파일 불러오기 API 연동 ──
async function loadFile() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.load_data_file) {
    const result = await window.pywebview.api.load_data_file();
    if (result.ok) {
      processLoadedData(result.content);
    } else if (result.error) {
      toast('불러오기 실패: ' + result.error, true);
    }
  } else {
    document.getElementById('load-input').click();
  }
}

function onLoadFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    processLoadedData(ev.target.result);
    e.target.value = '';
  };
  reader.readAsText(file);
}

function processLoadedData(jsonStr) {
  try {
    const d = JSON.parse(jsonStr);
    if (d.students) {
      students = d.students;
      initGrid(Math.max(INIT_ROWS, students.length + 3));
      const rows = document.querySelectorAll('#student-grid-body .student-row');
      students.forEach((st, i) => {
        if (rows[i]) {
          const inputs = rows[i].querySelectorAll('input');
          inputs[0].value = st.id; inputs[1].value = st.name; inputs[2].value = st.gender||'';
        }
      });
      updateStudentListPreview();
      document.getElementById('student-count-info').textContent = `총 ${students.length}명 등록됨`;
    }
    if (d.cfg) Object.assign(cfg, d.cfg);
    
    document.getElementById('seat-count').value = cfg.seatCount;
    document.getElementById('col-count').value = cfg.colCount;
    
    if(LAYOUTS[cfg.layoutType]) {
      document.getElementById('layout-type').value = cfg.layoutType;
    } else {
      cfg.layoutType = 'single';
      document.getElementById('layout-type').value = 'single';
    }
    
    // row-gap-range removed
    // col-gap-range removed
    
    if(cfg.fontFamily) {
  const fontSelect = document.getElementById('font-family');
  if (fontSelect) {
    const optionExists = Array.from(fontSelect.options).some(opt => opt.value === cfg.fontFamily);
    if (optionExists) {
      fontSelect.value = cfg.fontFamily;
    } else {
      cfg.fontFamily = "'Gowun Dodum', sans-serif";
      fontSelect.value = cfg.fontFamily;
    }
  }
}
    
    updateSelectLogic();
    
    const algoSelect = document.getElementById('sort-algo');
    const isValid = Array.from(algoSelect.options).some(opt => opt.value === cfg.algo);
    if(!isValid) {
        cfg.algo = 'random';
        algoSelect.value = 'random';
    } else {
        algoSelect.value = cfg.algo;
    }

    onFontChange(); 
    initSeats();
    
    if (d.seats) {
      d.seats.forEach(saved => {
        const seat = seats.find(s => s.id === saved.id); if (!seat) return;
        seat.isGhost = saved.isGhost; seat.excluded = saved.excluded;
        seat.isLocked = saved.isLocked; seat.orderIdx = saved.orderIdx;
        seat.fixedFor = saved.fixedFor;
        seat.student = saved.studentId ? students.find(s => s.id === saved.studentId)||null : null;
      });
    }
    
    renderSeats(); updateBadge();
    toast('불러왔습니다.');
  } catch { toast('잘못된 파일 형식입니다.', true); }
}

async function exportToExcel() {
  if (!seats.some(s => s.student)) {
    toast('먼저 자리를 배치해주세요.', true);
    return;
  }

  let tableHtml = '<table border="1" style="border-collapse:collapse; text-align:center; font-family:\'Malgun Gothic\', sans-serif;">';
  const container = document.getElementById('seats-container');
  const cols = [...container.querySelectorAll('.col-group')];

  const colWidths = cols.map(c => {
     const blockDivs = [...c.children].filter(ch => !ch.classList.contains('col-label'));
     let maxSeats = 0;
     blockDivs.forEach(block => {
        const rowDivs = [...block.children];
        rowDivs.forEach(r => {
           maxSeats = Math.max(maxSeats, r.querySelectorAll('.seat').length);
        });
     });
     return Math.max(1, maxSeats);
  });

  const spacerWidth = Math.max(10, Math.floor(cfg.colGap / 2));
  const extraCols = cfg.colGap > 0 ? (cols.length - 1) : 0;
  const totalColumns = colWidths.reduce((a,b) => a+b, 0) + extraCols;

  const boardText = teacherView ? '칠판 — 교사 시점' : '칠판';
  
  tableHtml += `<tr><th colspan="${totalColumns}" style="background-color:#2d4a2e; color:#a7f3c4; height:50px; font-size:16px;">${boardText}</th></tr>`;
  tableHtml += `<tr><td colspan="${totalColumns}" style="height:20px; border:none;"></td></tr>`; 

  tableHtml += `<tr>`;
  cols.forEach((c, i) => {
     const label = c.querySelector('.col-label').textContent;
     tableHtml += `<th colspan="${colWidths[i]}" style="background-color:#f5ede3; color:#3e2410; padding:10px; font-size:14px; border:1px solid #d9bda0;">${label}</th>`;
     
     if (i < cols.length - 1 && cfg.colGap > 0) {
         tableHtml += `<th style="border:none; width:${spacerWidth}px;"></th>`;
     }
  });
  tableHtml += `</tr>`;

  let maxRows = 0;
  const gridData = []; 
  
  cols.forEach((c, colIndex) => {
     const blockDivs = [...c.children].filter(ch => !ch.classList.contains('col-label'));
     let rowIndex = 0;
     
     blockDivs.forEach(block => {
        const rowDivs = [...block.children];
        rowDivs.forEach(r => {
           if(!gridData[rowIndex]) gridData[rowIndex] = [];
           gridData[rowIndex][colIndex] = r; 
           rowIndex++;
        });
        rowIndex++; 
     });
     maxRows = Math.max(maxRows, rowIndex);
  });

  for (let r = 0; r < maxRows; r++) {
     tableHtml += `<tr>`;
     for(let i=0; i<cols.length; i++) {
        const seatCount = colWidths[i];
        const rowDiv = gridData[r] ? gridData[r][i] : null;

        if (!rowDiv) {
           for(let s=0; s<seatCount; s++) tableHtml += `<td style="border:none;"></td>`;
        } else {
           const seatEls = [...rowDiv.querySelectorAll('.seat')];
           for(let s=0; s<seatCount; s++) {
              const seat = seatEls[s];
              if (!seat || seat.classList.contains('ghost')) {
                 tableHtml += `<td style="border:none;"></td>`;
              } else if (seat.classList.contains('excluded')) {
                 tableHtml += `<td style="border:1px dashed #fca5a5; background-color:#fef2f2; color:#fca5a5; width:80px; height:60px; font-size:16px;">✕</td>`;
              } else {
                 const stId = seat.querySelector('.seat-id')?.textContent || '';
                 const stName = seat.querySelector('.seat-name')?.textContent || '';
                 
                 const isOccupied = seat.classList.contains('occupied');
                 const isMale = seat.classList.contains('male');
                 const isFemale = seat.classList.contains('female');
                 
                 const bgColor = isOccupied ? '#fdf6ec' : '#d4a76a';
                 let borderColor = '#a0714a';
                 let borderWidth = '2px';
                 let idColor = '#a0714a';
                 
                 let finalBgColor = bgColor;
                 if (isMale) {
                    finalBgColor = '#dbeafe'; 
                    borderColor = '#93c5fd';
                    idColor = '#2563eb';
                 } else if (isFemale) {
                    finalBgColor = '#fce7f3'; 
                    borderColor = '#f9a8d4';
                    idColor = '#db2777';
                 }
                 
                 const textColor = isOccupied ? '#1a1d26' : '#ffffff';
                 tableHtml += `<td style="border:${borderWidth} solid ${borderColor}; background-color:${finalBgColor}; color:${textColor}; width:80px; height:60px; font-weight:bold; mso-number-format:'\\@';">`;
                 if (stName) {
                    tableHtml += `<span style="color:${idColor}; font-size:10px;">${stId}</span><br><span style="font-size:12px;">${stName}</span>`;
                 }
                 tableHtml += `</td>`;
              }
           }
        }
        
        if (i < cols.length - 1 && cfg.colGap > 0) {
           tableHtml += `<td style="border:none; width:${spacerWidth}px;"></td>`;
        }
     }
     tableHtml += `</tr>`;
  }

  tableHtml += '</table>';

  const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${tableHtml}
  <!-- 불러온 명단 확인 모달 -->
  <div id="student-list-modal" class="mbg" style="display:none; z-index:900;">
    <div class="modal" style="width: min(400px, 92vw); max-height:80vh; display:flex; flex-direction:column; padding:0; overflow:hidden; border-radius:16px;">
      <div style="padding:16px 20px; background:var(--accent); color:#fff; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:16px; color:#fff; font-weight:800;">현재 적용된 학생 명단</h3>
        <button onclick="closeStudentModal()" style="background:none; border:none; color:#fff; font-size:24px; cursor:pointer; line-height:1;">&times;</button>
      </div>
      <div id="modal-student-list-content" style="padding:16px; overflow-y:auto; flex:1; background:var(--bg);">
        <!-- students go here -->
      </div>
    </div>
  </div>
</body>
</html>`;
  
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `자리배치(${yy}.${mm}.${dd}).xls`;

  if (window.pywebview && window.pywebview.api && window.pywebview.api.save_excel_file) {
    const result = await window.pywebview.api.save_excel_file(filename, htmlContent);
    if (result.ok) {
      toast(`엑셀 저장 완료`);
    } else if (result.error) {
      toast('저장 취소 또는 실패: ' + result.error, true);
    }
  } else {
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    toast('엑셀 파일이 저장되었습니다!');
  }
}

async function saveAsImage() {
  const boardArea = document.getElementById('board-area');
  
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `자리배치(${yy}.${mm}.${dd}).png`;

  toast('이미지 생성 중...');

  try {
    const canvas = await html2canvas(boardArea, {
      backgroundColor: '#fdf8f3',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const padded = document.createElement('canvas');
    const pad = 40;
    padded.width  = canvas.width  + pad * 2;
    padded.height = canvas.height + pad * 2;
    const ctx = padded.getContext('2d');
    ctx.fillStyle = '#fdf8f3';
    ctx.fillRect(0, 0, padded.width, padded.height);
    ctx.drawImage(canvas, pad, pad);

    const dataUrl = padded.toDataURL('image/png');

    if (window.pywebview && window.pywebview.api && window.pywebview.api.save_file) {
      const result = await window.pywebview.api.save_file(filename, dataUrl);
      if (result.ok) {
        toast(`저장 완료`);
      } else if (result.error) {
        toast('저장 취소 또는 실패: ' + result.error, true);
      }
    } else {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast('이미지가 저장되었습니다!');
    }
  } catch(err) {
    toast('이미지 생성 실패: ' + err.message, true);
  }
}

// ── 인쇄 기능 (명단 표 포함 및 여백 최적화) ─────────────────────────
function printScreen() {
  if (!seats.some(s => s.student)) { toast('먼저 학생 명단을 적용하고 자리를 배치해주세요.', true); return; }
  if (document.getElementById('temp-print-wrap')) return;
  toast('인쇄를 준비합니다...');

  const boardArea = document.getElementById('board-area'), workspace = document.getElementById('workspace');
  const printWrap = document.createElement('div');
  printWrap.id = 'temp-print-wrap';
  printWrap.style.cssText = 'display:flex; gap:30px; align-items:flex-start; justify-content:center; transform-origin:top center; width:max-content; margin: 0 auto;';

  const listDiv = document.createElement('div');
  const sortedStudents = [...students].sort((a, b) => String(a.id||'').localeCompare(String(b.id||''), 'ko', { numeric: true }));

  let tableHtml = '<table style="border-collapse: collapse; font-size: 12px; text-align: center; border: 2px solid var(--text1); background: #fff; min-width: 120px;">';
  tableHtml += '<tr><th colspan="2" style="border: 1px solid var(--border2); padding: 4px; background:var(--sidebar); color:var(--text1); font-size:13px; font-weight:800;">학생 명단</th></tr>';
  tableHtml += '<tr><th style="border: 1px solid var(--border2); padding: 3px; background:var(--sidebar2); width: 40px; color:var(--text1);">번호</th><th style="border: 1px solid var(--border2); padding: 3px; background:var(--sidebar2); color:var(--text1);">이름</th></tr>';

  sortedStudents.forEach(st => {
    tableHtml += `<tr><td style="border: 1px solid var(--border2); padding: 2px 4px; color:var(--text1); font-weight:700;">${st.id}</td><td style="border: 1px solid var(--border2); padding: 2px 4px; color:var(--text1);">${st.name}</td></tr>`;
  });
  tableHtml += '</table>'; listDiv.innerHTML = tableHtml;

  workspace.insertBefore(printWrap, boardArea);
  printWrap.appendChild(listDiv); printWrap.appendChild(boardArea);

  // 1페이지 압축 및 하단 여백 축소 (targetH를 730으로 상향 조정)
  const w = printWrap.scrollWidth, h = printWrap.scrollHeight;
  const targetW = 1040; 
  const targetH = 730; 

  let scale = Math.min(targetW / w, targetH / h, 1);
  printWrap.style.transform = `scale(${scale})`;
  printWrap.style.height = `${h * scale}px`;
  printWrap.style.overflow = 'hidden'; 
  printWrap.style.pageBreakInside = 'avoid';

  setTimeout(() => { window.print(); workspace.appendChild(boardArea); printWrap.remove(); }, 300);
}


function toggleTeacherView() {
  const checkbox = document.getElementById('teacher-view-toggle');
  if (checkbox) {
    teacherView = checkbox.checked;
  } else {
    teacherView = !teacherView;
  }
  const blackboard = document.getElementById('blackboard-el');
  const boardArea = document.getElementById('board-area');

  if (teacherView) {
    if (checkbox) checkbox.checked = true;
    blackboard.textContent = '칠판';
    boardArea.classList.add('teacher-mode');
  } else {
    if (checkbox) checkbox.checked = false;
    blackboard.textContent = '칠판';
    boardArea.classList.remove('teacher-mode');
  }
  renderSeats();
}


  async function downloadTemplate() {
    if (!window.pywebview) {
      toast('브라우저 환경에서는 지원하지 않습니다.', true);
      return;
    }
    const res = await window.pywebview.api.download_template();
    if (res && res.ok) {
      toast('양식을 성공적으로 내려받았습니다.');
    } else if (res && !res.ok && res.error) {
      toast('저장 취소 또는 오류가 발생했습니다.', true);
    }
  }

  async function loadStudentExcel() {
    if (!window.pywebview) {
      toast('브라우저 환경에서는 지원하지 않습니다.', true);
      return;
    }
    const res = await window.pywebview.api.load_excel();
    if (res && res.ok) {
      students = res.students;
      const countEl = document.getElementById('count-num');
      if (countEl) countEl.textContent = students.length;
      
      const btnView = document.getElementById('btn-view-students');
      if (btnView) btnView.style.display = 'block';
      
      const seatInput = document.getElementById('seat-count');
      if (seatInput) {
        seatInput.value = students.length;
        onSeatCountChange();
      } else {
        initSeats();
        renderSeats();
      }
      toast(`${students.length}명의 학생 명단을 불러왔습니다.`);
    } else if (res && !res.ok && res.error) {
      toast('명단을 불러오는 데 실패했습니다: ' + res.error, true);
    }
  }

  function openStudentModal() {
    const m = document.getElementById('student-list-modal');
    if (!m) return;
    
    if (students.length === 0) {
      toast('불러온 학생 명단이 없습니다.', true);
      return;
    }
    
    const listHtml = students.map(s => {
      let genderBadge = '';
      if (s.gender === '남') genderBadge = `<span style="background:#dbeafe; color:#1e40af; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; gap:3px;">♂ 남</span>`;
      else if (s.gender === '여') genderBadge = `<span style="background:#fce7f3; color:#9d174d; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; gap:3px;">♀ 여</span>`;
      
      return `<div style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid var(--border2); background:#fff; border-radius:10px; margin-bottom:6px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="background:var(--accent); color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; flex-shrink:0;">${s.id}</div>
        <div style="flex:1; font-weight:800; font-size:14px; color:var(--text1);">${s.name}</div>
        <div>${genderBadge}</div>
      </div>`;
    }).join('');
    
    document.getElementById('modal-student-list-content').innerHTML = listHtml;
    m.style.display = 'flex';
  }

  function closeStudentModal() {
    const m = document.getElementById('student-list-modal');
    if (m) m.style.display = 'none';
  }

function showHelp() { document.getElementById('help-modal').style.display = 'flex'; }

  function fitToWorkspace() {
    const workspace = document.getElementById('workspace');
    const boardArea = document.getElementById('board-area');
    if (!workspace || !boardArea) return;
    
    try {
      boardArea.style.zoom = '1';
      boardArea.style.transform = 'none';
      
      const baseCellW = 100;
      const baseCellH = 75;
      const baseColGap = 40;
      const baseRowGap = 15;
      
      const cols = cfg.colCount || 1;
      const layoutCols = (LAYOUTS[cfg.layoutType] || LAYOUTS.single).cols;
      const maxRows = seats.length > 0 ? Math.max(...seats.map(s => s.rowIdx + 1)) : 6;
      
      const isTeacherMode = document.getElementById('board-area').classList.contains('teacher-mode');
      
      const fixedW = 60; 
      const fixedH = isTeacherMode ? 320 : 270; 
      
      let scalableAvailW = workspace.clientWidth - fixedW;
      let scalableAvailH = workspace.clientHeight - fixedH;
      
      if (scalableAvailW <= 0 || scalableAvailH <= 0) return;
      
      const baseTotalW = (baseCellW * cols * layoutCols) + (2 * (layoutCols - 1) * cols) + (baseColGap * (cols - 1));
      const baseTotalH = (baseCellH * maxRows) + (baseRowGap * (maxRows - 1));
      
      const scaleX = scalableAvailW / baseTotalW;
      const scaleY = scalableAvailH / baseTotalH;
      
      // Always match the smaller scale so it NEVER overflows vertically or horizontally
      let scale = Math.min(scaleX, scaleY);
      
      if (scale > 1.8) scale = 1.8;
      if (scale < 0.25) scale = 0.25;
      
      const cellW = baseCellW * scale;
      const cellH = baseCellH * scale;
      const colGap = Math.max(6, baseColGap * scale);
      const rowGap = Math.max(4, baseRowGap * scale);
      
      document.documentElement.style.setProperty('--cell-w', cellW + 'px');
      document.documentElement.style.setProperty('--cell-h', cellH + 'px');
      document.documentElement.style.setProperty('--col-gap', colGap + 'px');
      document.documentElement.style.setProperty('--row-gap', rowGap + 'px');
      
      document.documentElement.style.setProperty('--name-size', Math.max(10, 15 * scale) + 'px');
      document.documentElement.style.setProperty('--id-size', Math.max(8, 11 * scale) + 'px');
      
      const container = document.getElementById('seats-container');
      if (container) container.style.gap = colGap + 'px';
      document.querySelectorAll('.col-group').forEach(c => c.style.gap = rowGap + 'px');
    } catch(e) {}
  }

  // ─── 렌더링 안정화: 끊임없는 100ms 폴링 및 Border 토글 제거 (꿈틀거림 완벽 방지) ───
  window.addEventListener('resize', fitToWorkspace);

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      fitToWorkspace();
    });
    const ws = document.getElementById('workspace');
    if (ws) ro.observe(ws);
  }


(function() {
  const resizer = document.getElementById('sb-resizer');
  let dragging = false, startX, startW;
  resizer.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX;
    startW = document.getElementById('sidebar').offsetWidth;
    document.body.style.cursor = 'col-resize';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.max(220, Math.min(400, startW + e.clientX - startX));
    const sb = document.getElementById('sidebar');
    sb.style.width = w + 'px'; sb.style.minWidth = w + 'px'; sb.style.maxWidth = w + 'px';
    fitToWorkspace();
  });
  document.addEventListener('mouseup', () => { dragging = false; document.body.style.cursor = ''; });
})();

// ─── 초기화 실행 ─────────────────────────────────────────────────────────────
initGrid(INIT_ROWS);
updateSelectLogic(); 
initSeats();
updateStudentListPreview();
// font-family removed
cfg.fontFamily = "'Gowun Dodum', sans-serif";
  document.documentElement.style.setProperty('--seat-font', cfg.fontFamily);


/* ── Save Popover Controls ── */
function toggleSaveMenu(e) {
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

function hideSaveMenu() {
  const pop = document.getElementById('save-popover');
  if (pop) pop.style.display = 'none';
}

document.addEventListener('click', hideSaveMenu);