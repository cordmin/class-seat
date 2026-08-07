export const state = {
  students: [],
  seats: [],
  selectedSeatId: null,
  dragSrcId: null,
  overSeatId: null,
  countdownTimer: null,
  ctxTarget: null,
  confirmCallback: null,
  teacherView: false,
  isArrangementCancelled: false,
  prevStateJson: null
};

export const cfg = {
  seatCount: 30,
  colCount: 5,
  layoutType: 'single',
  algo: 'random',
  rowGap: 8,
  colGap: 63,
  cellW: 100,
  cellH: 75,
  fontFamily: "'Gowun Dodum', sans-serif"
};

export const INIT_ROWS = 10;

export const ALGO_OPTIONS = {
  single: [
    { val: 'random', text: '무작위' },
    { val: 'idAsc', text: '번호 순서' },
    { val: 'genderMixRow', text: '남녀 줄별 교차' },
    { val: 'genderMixCluster', text: '남녀 분단 교차' },
    { val: 'genderSeparate', text: '남녀 최대 분리' }
  ],
  pair: [
    { val: 'random', text: '무작위' },
    { val: 'idAsc', text: '번호 순서' },
    { val: 'genderPair', text: '남녀 짝궁' },
    { val: 'genderMixCluster', text: '남녀 분단 교차' },
    { val: 'genderMixRow', text: '남녀 줄별 교차' },
    { val: 'genderSeparate', text: '남녀 최대 분리' }
  ],
  group: [
    { val: 'random', text: '무작위' },
    { val: 'idAsc', text: '번호 순서' },
    { val: 'genderMixRow', text: '남녀 줄별 교차' },
    { val: 'genderMixCluster', text: '남녀 분단 교차' },
    { val: 'genderSeparate', text: '남녀 최대 분리' },
    { val: 'genderPair', text: '남녀 짝궁' },
    { val: 'genderSameGroup', text: '동성 짝궁' }
  ],
  group6: [
    { val: 'random', text: '무작위' },
    { val: 'idAsc', text: '번호 순서' },
    { val: 'genderMixRow', text: '남녀 줄별 교차' },
    { val: 'genderMixCluster', text: '남녀 분단 교차' },
    { val: 'genderSeparate', text: '남녀 최대 분리' },
    { val: 'genderPair', text: '남녀 짝궁' },
    { val: 'genderSameGroup', text: '동성 짝궁' }
  ]
};

export const LAYOUTS = {
  single:  { rows: [[0]],                           cols: 1 },
  pair:    { rows: [[0,0]],                         cols: 2 },
  group:   { rows: [[0,0],[0,0]],                   cols: 2 },
  group6:  { rows: [[0,0],[0,0],[0,0]],             cols: 2 }
};

export function getArrangementDataForSave() {
  return JSON.stringify({
    version: 2,
    students: state.students,
    cfg,
    seats: state.seats.map(s => ({
      id: s.id,
      isGhost: s.isGhost,
      excluded: s.excluded,
      isLocked: s.isLocked,
      orderIdx: s.orderIdx,
      colIdx: s.colIdx,
      rowIdx: s.rowIdx,
      fixedFor: s.fixedFor,
      studentId: s.student ? s.student.id : null
    }))
  }, null, 2);
}
