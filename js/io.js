import { state, cfg, INIT_ROWS, LAYOUTS } from './state.js';
import { initSeats, updateSelectLogic, onSeatCountChange, applyAlgo } from './layout.js';
import { renderSeats, updateBadge } from './view.js';
import { toast, updateStudentListPreview } from './ui.js';

export function buildGridRow(id = '', name = '', gender = '') {
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

export function initGrid(count = INIT_ROWS) {
  const body = document.getElementById('student-grid-body');
  if (!body) return;
  body.innerHTML = '';
  for (let i = 0; i < count; i++) body.appendChild(buildGridRow());
}

export function addStudentRow() {
  const body = document.getElementById('student-grid-body');
  if (!body) return;
  body.appendChild(buildGridRow());
}

export async function downloadTemplate() {
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

export async function loadStudentExcel() {
  if (!window.pywebview) {
    toast('브라우저 환경에서는 지원하지 않습니다.', true);
    return;
  }
  const res = await window.pywebview.api.load_excel();
  if (res && res.ok) {
    state.students = res.students;
    const countEl = document.getElementById('count-num');
    if (countEl) countEl.textContent = state.students.length;
    const btnView = document.getElementById('btn-view-students');
    if (btnView) btnView.style.display = 'block';
    const seatInput = document.getElementById('seat-count');
    if (seatInput) {
      seatInput.value = state.students.length;
      onSeatCountChange();
      renderSeats();
      updateBadge();
    } else {
      initSeats();
      renderSeats();
    }
    toast(`${state.students.length}명의 학생 명단을 불러왔습니다.`);
  } else if (res && !res.ok && res.error) {
    toast('명단을 불러오는 데 실패했습니다: ' + res.error, true);
  }
}

export async function exportToExcel() {
  if (!state.seats.some(s => s.student)) {
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
  const boardText = state.teacherView ? '칠판 — 교사 시점' : '칠판';

  tableHtml += `<tr><th colspan="${totalColumns}" style="background-color:#2d4a2e; color:#a7f3c4; height:50px; font-size:16px;">${boardText}</th></tr>`;
  tableHtml += '<tr><td colspan="' + totalColumns + '" style="height:20px; border:none;"></td></tr>';
  tableHtml += '<tr>';

  cols.forEach((c, i) => {
    const label = c.querySelector('.col-label').textContent;
    tableHtml += `<th colspan="${colWidths[i]}" style="background-color:#f5ede3; color:#3e2410; padding:10px; font-size:14px; border:1px solid #d9bda0;">${label}</th>`;
    if (i < cols.length - 1 && cfg.colGap > 0) {
      tableHtml += `<th style="border:none; width:${spacerWidth}px;"></th>`;
    }
  });
  tableHtml += '</tr>';

  let maxRows = 0;
  const gridData = [];
  cols.forEach((c, colIndex) => {
    const blockDivs = [...c.children].filter(ch => !ch.classList.contains('col-label'));
    let rowIndex = 0;
    blockDivs.forEach(block => {
      const rowDivs = [...block.children];
      rowDivs.forEach(r => {
        if (!gridData[rowIndex]) gridData[rowIndex] = [];
        gridData[rowIndex][colIndex] = r;
        rowIndex++;
      });
      rowIndex++;
    });
    maxRows = Math.max(maxRows, rowIndex);
  });

  for (let r = 0; r < maxRows; r++) {
    tableHtml += '<tr>';
    for (let i = 0; i < cols.length; i++) {
      const seatCount = colWidths[i];
      const rowDiv = gridData[r] ? gridData[r][i] : null;
      if (!rowDiv) {
        for (let s = 0; s < seatCount; s++) tableHtml += '<td style="border:none;"></td>';
      } else {
        const seatEls = [...rowDiv.querySelectorAll('.seat')];
        for (let s = 0; s < seatCount; s++) {
          const seat = seatEls[s];
          if (!seat || seat.classList.contains('ghost')) {
            tableHtml += '<td style="border:none;"></td>';
          } else if (seat.classList.contains('excluded')) {
            tableHtml += '<td style="border:1px dashed #fca5a5; background-color:#fef2f2; color:#fca5a5; width:80px; height:60px; font-size:16px;">✕</td>';
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
            tableHtml += '</td>';
          }
        }
      }
      if (i < cols.length - 1 && cfg.colGap > 0) {
        tableHtml += `<td style="border:none; width:${spacerWidth}px;"></td>`;
      }
    }
    tableHtml += '</tr>';
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
      <div id="modal-student-list-content" style="padding:16px; overflow-y:auto; flex:1; background:var(--bg);"></div>
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

export async function saveAsImage() {
  const boardArea = document.getElementById('board-area');
  if (!boardArea) return;

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
    padded.width = canvas.width + pad * 2;
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
  } catch (err) {
    toast('이미지 생성 실패: ' + err.message, true);
  }
}

export async function printScreen() {
  if (!state.seats.some(s => s.student)) {
    toast('먼저 학생 명단을 적용하고 자리를 배치해주세요.', true);
    return;
  }
  if (document.getElementById('temp-print-wrap')) return;
  toast('인쇄를 준비합니다...');

  const seatsWrap = document.getElementById('seats-wrap');
  if (!seatsWrap) return;

  const originalParent = seatsWrap.parentElement;
  const originalNextSibling = seatsWrap.nextSibling;

  const printWrap = document.createElement('div');
  printWrap.id = 'temp-print-wrap';
  printWrap.style.cssText = 'position:absolute; left:0; top:0; width:1020px; background:#ffffff; padding:15px; box-sizing:border-box; display:flex; flex-direction:row; gap:20px; align-items:flex-start; justify-content:flex-start; z-index:99999;';

  // 1. 좌측 학생 명단 표 생성 (번호 | 이름 | 성별)
  const listDiv = document.createElement('div');
  listDiv.style.cssText = 'width:210px; flex-shrink:0; box-sizing:border-box;';
  
  let tableHtml = `
    <table style="width:100%; border-collapse:collapse; font-family:'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size:11px; border:2px solid #000000;">
      <thead>
        <tr style="background:#fbbf24; color:#000000; font-size:12px; font-weight:900; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
          <th style="border:1px solid #000000; padding:4px 2px; width:45px; text-align:center;">번호</th>
          <th style="border:1px solid #000000; padding:4px 2px; text-align:center;">이 름</th>
          <th style="border:1px solid #000000; padding:4px 2px; width:45px; text-align:center;">성별</th>
        </tr>
      </thead>
      <tbody>
  `;

  const sortedStudents = [...state.students].sort((a, b) => 
    String(a.id || '').localeCompare(String(b.id || ''), 'ko', { numeric: true })
  );

  sortedStudents.forEach(st => {
    tableHtml += `
      <tr style="background:#ffffff;">
        <td style="border:1px solid #000000; padding:3px 2px; text-align:center; font-weight:700; color:#000000;">${st.id || ''}</td>
        <td style="border:1px solid #000000; padding:3px 4px; text-align:center; font-weight:700; color:#000000;">${st.name || ''}</td>
        <td style="border:1px solid #000000; padding:3px 2px; text-align:center; color:#000000;">${st.gender || ''}</td>
      </tr>
    `;
  });
  tableHtml += '</tbody></table>';
  listDiv.innerHTML = tableHtml;

  // 2. 우측 분단 배치 영역
  const isTeacher = state.teacherView;
  const rightWrap = document.createElement('div');
  rightWrap.style.cssText = 'flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; box-sizing:border-box; overflow:hidden; gap:12px;';

  const bbEl = document.createElement('div');
  bbEl.style.cssText = 'width:70%; max-width:380px; padding:12px 5px; background:#2e4a38; color:#ffffff; font-weight:900; text-align:center; border-radius:6px; font-size:14px; letter-spacing:4px; -webkit-print-color-adjust:exact; print-color-adjust:exact;';
  bbEl.textContent = isTeacher ? '칠 판 (교사 시점)' : '칠 판';

  printWrap.appendChild(listDiv);
  
  const originalSeatsWrapOrder = seatsWrap.style.order;

  if (isTeacher) {
    seatsWrap.style.order = '1';
    bbEl.style.order = '2';
    rightWrap.appendChild(seatsWrap);
    rightWrap.appendChild(bbEl);
  } else {
    bbEl.style.order = '1';
    seatsWrap.style.order = '2';
    rightWrap.appendChild(bbEl);
    rightWrap.appendChild(seatsWrap);
  }
  
  printWrap.appendChild(rightWrap);
  document.body.appendChild(printWrap);

  // A4 가로 1페이지 초과 방지 자동 스케일링
  const targetW = 990;
  const targetH = 650;
  const w = printWrap.scrollWidth || 1020;
  const h = printWrap.scrollHeight || 700;
  const scale = Math.min(targetW / w, targetH / h, 1);
  if (scale < 1) {
    printWrap.style.transform = `scale(${scale})`;
    printWrap.style.transformOrigin = 'top left';
    printWrap.style.width = `${w}px`;
  }

  setTimeout(() => {
    window.print();
    seatsWrap.style.order = originalSeatsWrapOrder;
    if (originalNextSibling) {
      originalParent.insertBefore(seatsWrap, originalNextSibling);
    } else {
      originalParent.appendChild(seatsWrap);
    }
    printWrap.remove();
  }, 300);
}

export async function saveFile() {
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

export async function loadFile() {
  if (window.pywebview && window.pywebview.api && window.pywebview.api.load_data_file) {
    const result = await window.pywebview.api.load_data_file();
    if (result.ok) {
      processLoadedData(result.content);
    } else if (result.error) {
      toast('불러오기 실패: ' + result.error, true);
    }
  } else {
    document.getElementById('load-input')?.click();
  }
}

export function onLoadFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    processLoadedData(ev.target.result);
    e.target.value = '';
  };
  reader.readAsText(file);
}

export function processLoadedData(jsonStr) {
  try {
    const d = JSON.parse(jsonStr);
    if (d.students) {
      state.students = d.students;
      initGrid(Math.max(INIT_ROWS, state.students.length + 3));
      const rows = document.querySelectorAll('#student-grid-body .student-row');
      state.students.forEach((st, i) => {
        if (rows[i]) {
          const inputs = rows[i].querySelectorAll('input');
          inputs[0].value = st.id;
          inputs[1].value = st.name;
          inputs[2].value = st.gender || '';
        }
      });
      updateStudentListPreview();
      document.getElementById('student-count-info').textContent = `총 ${state.students.length}명 등록됨`;
    }
    if (d.cfg) Object.assign(cfg, d.cfg);
    document.getElementById('seat-count').value = cfg.seatCount;
    document.getElementById('col-count').value = cfg.colCount;
    if (LAYOUTS[cfg.layoutType]) {
      document.getElementById('layout-type').value = cfg.layoutType;
    } else {
      cfg.layoutType = 'single';
      document.getElementById('layout-type').value = 'single';
    }
    updateSelectLogic();
    const algoSelect = document.getElementById('sort-algo');
    const isValid = Array.from(algoSelect.options).some(opt => opt.value === cfg.algo);
    if (!isValid) {
      cfg.algo = 'random';
      algoSelect.value = 'random';
    } else {
      algoSelect.value = cfg.algo;
    }

    document.documentElement.style.setProperty('--seat-font', cfg.fontFamily);
    initSeats();
    if (d.seats) {
      d.seats.forEach(saved => {
        const seat = state.seats.find(s => s.id === saved.id);
        if (!seat) return;
        seat.isGhost = saved.isGhost;
        seat.excluded = saved.excluded;
        seat.isLocked = saved.isLocked;
        seat.orderIdx = saved.orderIdx;
        seat.fixedFor = saved.fixedFor;
        seat.student = saved.studentId ? state.students.find(s => s.id === saved.studentId) || null : null;
      });
    }

    renderSeats();
    updateBadge();
    toast('불러왔습니다.');
  } catch {
    toast('잘못된 파일 형식입니다.', true);
  }
}
