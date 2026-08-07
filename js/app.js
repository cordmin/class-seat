import { state, cfg, INIT_ROWS, getArrangementDataForSave, saveAutoState, loadAutoState } from './state.js';
import { initSeats, updateSelectLogic, onSeatCountChange, onColCountChange, onLayoutChange, onAlgoChange } from './layout.js';
import { renderSeats, updateBadge, toggleTeacherView, executeArrangement, resetArrangement } from './view.js';
import { downloadTemplate, loadStudentExcel, exportToExcel, saveAsImage, printScreen, saveFile, loadFile, onLoadFile, addStudentRow, initGrid, processLoadedData } from './io.js';
import { toast, showConfirm, confirmOk, confirmCancel, updateStudentListPreview, openStudentModal, closeStudentModal, toggleSaveMenu, hideSaveMenu } from './ui.js';

window.getArrangementDataForSave = getArrangementDataForSave;
window.saveAutoState = saveAutoState;

window.onSeatCountChange = () => { onSeatCountChange(); renderSeats(); updateBadge(); saveAutoState(); };
window.onColCountChange = () => { onColCountChange(); renderSeats(); updateBadge(); saveAutoState(); };
window.onLayoutChange = () => { onLayoutChange(); renderSeats(); updateBadge(); saveAutoState(); };
window.onAlgoChange = () => { onAlgoChange(); saveAutoState(); };
window.toggleTeacherView = () => { toggleTeacherView(); saveAutoState(); };

window.downloadTemplate = downloadTemplate;
window.loadStudentExcel = loadStudentExcel;
window.exportToExcel = exportToExcel;
window.saveAsImage = saveAsImage;
window.printScreen = printScreen;
window.saveFile = saveFile;
window.loadFile = loadFile;
window.onLoadFile = onLoadFile;
window.openStudentModal = openStudentModal;
window.closeStudentModal = closeStudentModal;
window.toggleSaveMenu = toggleSaveMenu;
window.hideSaveMenu = hideSaveMenu;
window.showConfirm = showConfirm;
window.confirmOk = confirmOk;
window.confirmCancel = confirmCancel;

window.executeArrangement = () => { executeArrangement(); saveAutoState(); };
window.resetArrangement = () => { resetArrangement(); saveAutoState(); };
window.addStudentRow = addStudentRow;
window.processLoadedData = (data) => { processLoadedData(data); saveAutoState(); };

// 자동 로드 복원 실행
const loaded = loadAutoState();

if (loaded) {
  // 저장된 명단으로 모달 그리드 채우기
  initGrid(Math.max(INIT_ROWS, state.students.length + 3));
  const rows = document.querySelectorAll('#student-grid-body .student-row');
  state.students.forEach((st, i) => {
    if (rows[i]) {
      const inputs = rows[i].querySelectorAll('input');
      inputs[0].value = st.id || '';
      inputs[1].value = st.name || '';
      inputs[2].value = st.gender || '';
    }
  });

  // UI 컨트롤 입력값 복원
  const seatInput = document.getElementById('seat-count');
  const colInput = document.getElementById('col-count');
  const layoutSelect = document.getElementById('layout-type');
  const teacherToggle = document.getElementById('teacher-view-toggle');

  if (seatInput) seatInput.value = cfg.seatCount;
  if (colInput) colInput.value = cfg.colCount;
  if (layoutSelect) layoutSelect.value = cfg.layoutType;
  if (teacherToggle) teacherToggle.checked = state.teacherView;

  updateSelectLogic();
  updateBadge();
  renderSeats();
  updateStudentListPreview();
} else {
  initGrid(INIT_ROWS);
  updateSelectLogic();
  initSeats();
  updateBadge();
  renderSeats();
  updateStudentListPreview();
}

document.documentElement.style.setProperty('--seat-font', cfg.fontFamily);

// 창 닫기/새로그침 전 자동 저장
window.addEventListener('beforeunload', () => {
  saveAutoState();
});
