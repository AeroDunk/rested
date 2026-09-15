// Age-band reference data. DATA ONLY — no logic belongs in this file.
//
// Every numeric range carries a tier and a source URL. See
// docs/superpowers/specs/2026-09-14-baby-sleep-app-design.md Appendix A.
//
// Interpretation note: Mindell 2016 reports naps "clustering around 09:30
// and 14:00" at 8-12 months. We read those as nap ONSET times. The paper
// does not state whether they are onsets or midpoints.

export const TIERS = ['A1', 'A2', 'B', 'C'];

const AASM = 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866';
const IGLOW = 'https://publications.aap.org/pediatrics/article/111/2/302/66745/';
const GALLAND = 'https://www.sciencedirect.com/science/article/abs/pii/S1087079211000682';
const MINDELL = 'https://pubmed.ncbi.nlm.nih.gov/27252030/';
const TCB = 'https://www.takingcarababies.com/blogs/sleep-basics/wake-windows-and-baby-sleep';

export function hoursToMinutes(h) {
  return Math.round(h * 60);
}

export const BANDS = {
  '4-5': {
    key: '4-5', label: '4–5 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 9.5, maxHours: 11.5, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 3, maxHours: 4.5, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 3, min: 2, max: 5, tier: 'A2', source: GALLAND },
    napAnchors: null,
    wakeWindows: {
      first: { minMin: 90, maxMin: 135 }, middle: { minMin: 105, maxMin: 150 },
      last: { minMin: 120, maxMin: 180 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '6-7': {
    key: '6-7', label: '6–7 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10, maxHours: 11.5, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 2.5, maxHours: 4, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 3, min: 2, max: 4, tier: 'A2', source: GALLAND },
    napAnchors: null,
    wakeWindows: {
      first: { minMin: 120, maxMin: 165 }, middle: { minMin: 135, maxMin: 180 },
      last: { minMin: 150, maxMin: 210 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '8-9': {
    key: '8-9', label: '8–9 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10, maxHours: 11.5, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 2.25, maxHours: 3.5, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 2, min: 1, max: 3, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['09:30', '14:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 120, maxMin: 165 }, middle: { minMin: 150, maxMin: 195 },
      last: { minMin: 165, maxMin: 240 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '10-11': {
    key: '10-11', label: '10–11 months', typicalWake: '07:00',
    total24h: { minHours: 12, maxHours: 16, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 2, maxHours: 3, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 2, min: 1, max: 3, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['09:45', '14:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 150, maxMin: 195 }, middle: { minMin: 165, maxMin: 210 },
      last: { minMin: 180, maxMin: 255 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '12-14': {
    key: '12-14', label: '12–14 months', typicalWake: '07:15',
    total24h: { minHours: 11, maxHours: 14, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: false },
    dayTotal: { minHours: 2, maxHours: 3, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 2, min: 1, max: 2, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['10:00', '14:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 180, maxMin: 225 }, middle: { minMin: 195, maxMin: 240 },
      last: { minMin: 210, maxMin: 270 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '15-17': {
    key: '15-17', label: '15–17 months', typicalWake: '07:15',
    total24h: { minHours: 11, maxHours: 14, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: true },
    dayTotal: { minHours: 1.75, maxHours: 2.75, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 1, min: 1, max: 2, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['13:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 210, maxMin: 270 }, middle: { minMin: 225, maxMin: 285 },
      last: { minMin: 240, maxMin: 330 }, tier: 'C', source: TCB,
    },
    napCapMinutes: null,
  },
  '18-24': {
    key: '18-24', label: '18–24 months', typicalWake: '07:15',
    total24h: { minHours: 11, maxHours: 14, tier: 'A1', source: AASM },
    nightInBed: { minHours: 10.5, maxHours: 12, tier: 'A2', source: IGLOW, interpolated: false },
    dayTotal: { minHours: 1.25, maxHours: 2.5, tier: 'A2', source: IGLOW, interpolated: true },
    napCount: { typical: 1, min: 1, max: 1, tier: 'A2', source: GALLAND },
    napAnchors: { times: ['13:00'], tier: 'B', source: MINDELL },
    wakeWindows: {
      first: { minMin: 270, maxMin: 330 }, middle: { minMin: 285, maxMin: 345 },
      last: { minMin: 300, maxMin: 390 }, tier: 'C', source: TCB,
    },
    // Soft guidance only, and on nap END TIME rather than duration.
    // Nakagawa 2016: nap end time correlates with delayed sleep onset (r=0.52)
    // more strongly than nap duration does (r=0.37).
    napCapMinutes: 150,
  },
};
