import { state, cfg, ALGO_OPTIONS, LAYOUTS, INIT_ROWS } from './state.js';

export function updateSelectLogic() {
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

export function getLayoutRows(type) {
  return (LAYOUTS[type] || LAYOUTS.single).rows;
}

export function buildColumnSlots(colIdx, type, pairCount) {
  const rows = getLayoutRows(type);
  const slots = [];
  let rowCounter = 0;

  for (let p = 0; p < pairCount; p++) {
    for (let r = 0; r < rows.length; r++) {
      for (const cell of rows[r]) {
        slots.push({ isGhost: cell === 1, rowIdx: rowCounter, colIdx, groupIdx: p });
      }
      rowCounter++;
    }
  }

  return slots;
}

export function initSeats() {
  const total = cfg.seatCount;
  const cols = cfg.colCount;
  const layout = LAYOUTS[cfg.layoutType] || LAYOUTS.single;
  const seatsPerBlock = layout.rows.reduce((sum, row) => sum + row.filter(v => v === 0).length, 0);

  let allSlots = [];
  const seatsPerCol = Math.ceil(total / cols);
  const pairsPerCol = seatsPerBlock > 0 ? Math.ceil(seatsPerCol / seatsPerBlock) : 1;

  for (let c = 0; c < cols; c++) {
    const colSlots = buildColumnSlots(c, cfg.layoutType, pairsPerCol);
    allSlots.push(...colSlots);
  }

  let availCount = allSlots.filter(slot => !slot.isGhost).length;
  if (availCount > total) {
    let toRemove = availCount - total;
    for (let i = allSlots.length - 1; i >= 0 && toRemove > 0; i--) {
      if (!allSlots[i].isGhost) {
        allSlots[i].isGhost = true;
        toRemove--;
      }
    }
  }

  state.seats = allSlots.map((slot, i) => ({
    id: 'seat-' + i,
    isGhost: slot.isGhost,
    excluded: false,
    student: null,
    isLocked: false,
    orderIdx: i,
    colIdx: slot.colIdx,
    rowIdx: slot.rowIdx,
    groupIdx: slot.groupIdx,
    fixedFor: null
  }));
}

export function onLayoutChange() {
  const newLayout = document.getElementById('layout-type').value;
  const isChanged = cfg.layoutType !== newLayout;
  cfg.layoutType = newLayout;

  if (isChanged) {
    const colGapInput = document.getElementById('col-gap-range');
    if (cfg.layoutType === 'pair') {
      cfg.seatCount = 30;
      cfg.colCount = 3;
      cfg.colGap = 63;
      document.getElementById('seat-count').value = 30;
      document.getElementById('col-count').value = 3;
      if (colGapInput) colGapInput.value = 63;
    } else if (cfg.layoutType === 'single') {
      cfg.seatCount = 30;
      cfg.colCount = 5;
      cfg.colGap = 63;
      document.getElementById('seat-count').value = 30;
      document.getElementById('col-count').value = 5;
      if (colGapInput) colGapInput.value = 63;
    } else if (cfg.layoutType === 'group' || cfg.layoutType === 'group6') {
      cfg.seatCount = 30;
      cfg.colCount = 3;
      cfg.colGap = 27;
      document.getElementById('seat-count').value = 30;
      document.getElementById('col-count').value = 3;
      if (colGapInput) colGapInput.value = 27;
    }
    document.documentElement.style.setProperty('--col-gap', cfg.colGap + 'px');
  }

  updateSelectLogic();
  initSeats();
}

export function onAlgoChange() {
  cfg.algo = document.getElementById('sort-algo').value;
}

export function onSeatCountChange() {
  cfg.seatCount = Math.max(1, parseInt(document.getElementById('seat-count').value) || 30);
  initSeats();
}

export function onColCountChange() {
  cfg.colCount = Math.max(2, Math.min(6, parseInt(document.getElementById('col-count').value) || 5));
  document.getElementById('col-count').value = cfg.colCount;
  initSeats();
}

export function applyAlgo(studentList, algo, freeSeats) {
  const s = [...studentList];
  if (algo === 'random') return shuffle(s);
  if (algo === 'idAsc') {
    return s.sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), 'ko', { numeric: true }));
  }

  let m = shuffle(s.filter(x => x.gender === '남'));
  let f = shuffle(s.filter(x => x.gender === '여'));
  let o = shuffle(s.filter(x => x.gender !== '남' && x.gender !== '여'));

  const popStudent = (pref) => {
    if (pref === '남' && m.length > 0) return m.pop();
    if (pref === '여' && f.length > 0) return f.pop();
    if (o.length > 0) return o.pop();
    if (m.length > 0) return m.pop();
    if (f.length > 0) return f.pop();
    return null;
  };

  let result = new Array(freeSeats.length).fill(null);
  const blocksMap = new Map();

  freeSeats.forEach((seat, idx) => {
    const key = seat.colIdx + '-' + seat.groupIdx;
    if (!blocksMap.has(key)) blocksMap.set(key, { key, idxs: [] });
    blocksMap.get(key).idxs.push(idx);
  });

  let blocks = Array.from(blocksMap.values());
  const lockedConstraints = new Map();
  state.seats.filter(s => s.fixedFor && !s.isGhost && !s.excluded && s.student).forEach(s => {
    const key = s.colIdx + '-' + s.groupIdx;
    if (s.student.gender === '남' || s.student.gender === '여') {
      lockedConstraints.set(key, s.student.gender);
    }
  });

  if (algo === 'genderPair') {
    blocks.forEach(blockObj => {
      blockObj.idxs.forEach(idx => {
        const seat = freeSeats[idx];
        let p = (seat.orderIdx % 2 === 0) ? '남' : '여';
        if (lockedConstraints.has(blockObj.key)) {
          const lockedGender = lockedConstraints.get(blockObj.key);
          p = (lockedGender === '남') ? '여' : '남';
        }
        result[idx] = popStudent(p);
      });
    });
    return result;
  }

  if (algo === 'genderMixCluster' || algo === 'genderMixRow' || algo === 'genderSameGroup') {
    const startMale = Math.random() < 0.5;
    blocks.forEach((blockObj, blockNumber) => {
      let pref = '남';
      const firstSeat = freeSeats[blockObj.idxs[0]];
      if (algo === 'genderMixCluster') {
        pref = (firstSeat.colIdx % 2 === 0) ? (startMale ? '남' : '여') : (startMale ? '여' : '남');
      } else if (algo === 'genderMixRow') {
        pref = (firstSeat.rowIdx % 2 === 0) ? (startMale ? '남' : '여') : (startMale ? '여' : '남');
      } else {
        pref = (blockNumber % 2 === 0) ? (startMale ? '남' : '여') : (startMale ? '여' : '남');
      }

      if (lockedConstraints.has(blockObj.key)) {
        pref = lockedConstraints.get(blockObj.key);
      } else {
        let pool = pref === '남' ? m : f;
        let otherPool = pref === '남' ? f : m;
        if (pool.length < blockObj.idxs.length && otherPool.length >= blockObj.idxs.length) {
          pref = pref === '남' ? '여' : '남';
        }
      }

      blockObj.idxs.forEach((idx) => {
        result[idx] = popStudent(pref);
      });
    });
    return result;
  }

  if (algo === 'genderSeparate') {
    const startMale = Math.random() < 0.5;
    let mainPref = startMale ? '남' : '여';
    let subPref = startMale ? '여' : '남';

    blocks.forEach(blockObj => {
      let targetPref = mainPref;
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

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
