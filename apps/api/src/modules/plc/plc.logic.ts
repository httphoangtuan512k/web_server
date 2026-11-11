/**
 * Thuật toán SCADA tính tại server – port NGUYÊN VĂN từ server.js cũ (plcNum, plcTag, plcProcessMachine).
 * Khác biệt duy nhất: state không lấy từ Map trong RAM mà được truyền vào (đọc từ plc_machine_states) và
 * hàm trả về state mới để lưu lại DB.
 */
export const PLC_DEVICE_ID = 'MAY_B';
export const PLC_HISTORY_INTERVAL_MS = 60 * 1000;
/** Khoảng cách giữa 2 bản tin vượt ngưỡng này = mất kết nối → lần nhận kế tiếp chỉ lấy mốc (rebaseline). */
export const PLC_RECONNECT_MS = 5000;
/** /latest coi là đang kết nối nếu bản tin gần nhất không cũ hơn ngưỡng này. */
export const PLC_CONNECTED_MS = 5000;
export const PLC_MACHINES = ['may1', 'may2', 'may3', 'may4'] as const;
export type PlcMachine = (typeof PLC_MACHINES)[number];

type TagConfig = Record<
  | 'currentWeight'
  | 'hopperHigh'
  | 'feedSiloA'
  | 'feedSiloB'
  | 'modeA'
  | 'modeB'
  | 'jbATotal'
  | 'bagATotal'
  | 'jbBTotal'
  | 'bagBTotal'
  | 'production'
  | 'millRun',
  string
>;

export const PLC_SCADA_CONFIGS: Record<PlcMachine, TagConfig> = {
  may1: {
    currentWeight: 'Trọng lượng hiện tại', hopperHigh: '200 cao',
    feedSiloA: 'Xilo A', feedSiloB: 'Xilo B', modeA: 'JB vs DB A', modeB: 'JB vs DB B',
    jbATotal: 'JB A', bagATotal: 'Dong bao A', jbBTotal: 'JB B to', bagBTotal: 'Dong bao B',
    production: 'Cân định lượng', millRun: 'M321 may nghien HZ',
  },
  may2: {
    currentWeight: 'Trọng lượng hiện tại', hopperHigh: '200 cao',
    feedSiloA: 'Xilo A', feedSiloB: 'Xilo B', modeA: 'JB vs DB A', modeB: 'JB vs DB B',
    jbATotal: 'JB A to', bagATotal: 'Dong bao A', jbBTotal: 'JB B to', bagBTotal: 'Dong bao B',
    production: 'Cân định lượng', millRun: 'M321 may nghien HZ',
  },
  // Tạm dùng cùng tên tag như máy 2; mỗi máy nhận bộ dữ liệu riêng trong machines.
  may3: {
    currentWeight: 'Trọng lượng hiện tại', hopperHigh: '200 cao',
    feedSiloA: 'Xilo A', feedSiloB: 'Xilo B', modeA: 'JB vs DB A', modeB: 'JB vs DB B',
    jbATotal: 'JB A to', bagATotal: 'Dong bao A', jbBTotal: 'JB B to', bagBTotal: 'Dong bao B',
    production: 'Cân định lượng', millRun: 'M321 may nghien HZ',
  },
  may4: {
    currentWeight: 'Trọng lượng hiện tại', hopperHigh: '200 cao',
    feedSiloA: 'Xilo A', feedSiloB: 'Xilo B', modeA: 'JB vs DB A', modeB: 'JB vs DB B',
    jbATotal: 'JB A to', bagATotal: 'Dong bao A', jbBTotal: 'JB B to', bagBTotal: 'Dong bao B',
    production: 'Cân định lượng', millRun: 'M321 may nghien HZ',
  },
};

export type PlcState = Record<string, any>;

export const PLC_STATE_DEFAULTS: PlcState = {
  hopperSetpoint: 20, hopper: 20, stockA: 0, stockB: 0, coeffA: 1, coeffB: 1,
  lastWeight: null, lastRawCounterA: null, lastRawCounterB: null,
  lastCounterModeA: null, lastCounterModeB: null, needsRebaseline: true,
};

/** Các thông số người vận hành được phép chỉnh qua PATCH /api/plc/operation-state/:machine. */
export const PLC_EDITABLE_KEYS = new Set(['hopperSetpoint', 'hopper', 'stockA', 'stockB', 'coeffA', 'coeffB']);

export function plcNum(v: unknown): number {
  if (v === null || v === undefined || String(v).trim() === '') return NaN;
  return Number(String(v).trim().replace(',', '.'));
}

export function plcTag(data: any, name: string): unknown {
  if (!data || typeof data !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(data, name)) return data[name];
  const wanted = String(name).trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
  const key = Object.keys(data).find((k) => String(k).trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ') === wanted);
  return key === undefined ? undefined : data[key];
}

/** state trong DB (có thể thiếu khóa) → state đầy đủ (giống `{ ...PLC_STATE_DEFAULTS, ...JSON.parse(state_json) }` cũ). */
export function plcStateFrom(raw: unknown): PlcState {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as PlcState) : {};
  return { ...PLC_STATE_DEFAULTS, ...obj };
}

const isFiniteNum = (v: unknown): boolean => Number.isFinite(v as number);

/**
 * Port nguyên văn plcProcessMachine. `state` bị sửa trực tiếp (như object trong Map cũ) – caller lưu lại DB.
 */
export function plcProcessMachine(machine: PlcMachine, state: PlcState, data: any, nowIso: string, reconnect: boolean) {
  const tags = PLC_SCADA_CONFIGS[machine];
  const get = (key: keyof TagConfig) => plcNum(plcTag(data, tags[key]));
  const weight = get('currentWeight');
  const high = get('hopperHigh');
  const feedA = get('feedSiloA') === 1;
  const feedB = get('feedSiloB') === 1;
  const modeA = get('modeA');
  const modeB = get('modeB');
  const rawA = modeA === 1 ? get('jbATotal') : modeA === 0 ? get('bagATotal') : NaN;
  const rawB = modeB === 1 ? get('jbBTotal') : modeB === 0 ? get('bagBTotal') : NaN;
  const coeffA = Math.max(0, plcNum(state.coeffA) || 0);
  const coeffB = Math.max(0, plcNum(state.coeffB) || 0);
  let addedWeight = 0,
    usedKgA = 0,
    usedKgB = 0;

  if (reconnect || state.needsRebaseline) {
    state.lastWeight = Number.isFinite(weight) ? weight : null;
    state.lastRawCounterA = Number.isFinite(rawA) ? rawA : null;
    state.lastRawCounterB = Number.isFinite(rawB) ? rawB : null;
    state.lastCounterModeA = modeA === 0 || modeA === 1 ? modeA : null;
    state.lastCounterModeB = modeB === 0 || modeB === 1 ? modeB : null;
    state.needsRebaseline = false;
  } else {
    if (Number.isFinite(weight)) {
      const delta = isFiniteNum(state.lastWeight) ? weight - state.lastWeight : 0;
      addedWeight = delta > 0 ? delta : 0;
      state.lastWeight = weight;
    }
    if (high === 1) state.hopper = Math.max(0, plcNum(state.hopperSetpoint) || 0);
    else if (high === 0 && addedWeight > 0) state.hopper = Math.max(0, (plcNum(state.hopper) || 0) - addedWeight);
    if (addedWeight > 0 && feedA && !feedB) state.stockA = Math.max(0, (plcNum(state.stockA) || 0) + addedWeight);
    else if (addedWeight > 0 && feedB && !feedA) state.stockB = Math.max(0, (plcNum(state.stockB) || 0) + addedWeight);

    if (Number.isFinite(rawA) && (modeA === 0 || modeA === 1)) {
      if (state.lastCounterModeA === modeA && isFiniteNum(state.lastRawCounterA) && rawA >= state.lastRawCounterA)
        usedKgA = (rawA - state.lastRawCounterA) * coeffA;
      state.lastRawCounterA = rawA;
      state.lastCounterModeA = modeA;
    } else {
      state.lastRawCounterA = null;
      state.lastCounterModeA = null;
    }
    if (Number.isFinite(rawB) && (modeB === 0 || modeB === 1)) {
      if (state.lastCounterModeB === modeB && isFiniteNum(state.lastRawCounterB) && rawB >= state.lastRawCounterB)
        usedKgB = (rawB - state.lastRawCounterB) * coeffB;
      state.lastRawCounterB = rawB;
      state.lastCounterModeB = modeB;
    } else {
      state.lastRawCounterB = null;
      state.lastCounterModeB = null;
    }
    if (usedKgA > 0) state.stockA = Math.max(0, (plcNum(state.stockA) || 0) - usedKgA / 1000);
    if (usedKgB > 0) state.stockB = Math.max(0, (plcNum(state.stockB) || 0) - usedKgB / 1000);
  }
  state.stockA = Math.max(0, plcNum(state.stockA) || 0);
  state.stockB = Math.max(0, plcNum(state.stockB) || 0);
  state.hopper = Math.max(0, plcNum(state.hopper) || 0);

  // Lưu bộ đếm đã nhân hệ số vào state để API /api/plc/latest trả về giao diện.
  state.counterA = Number.isFinite(rawA) ? rawA * coeffA : null;
  state.counterB = Number.isFinite(rawB) ? rawB * coeffB : null;

  state.updatedAt = nowIso;
  return {
    ...state,
    addedWeight,
    usedKgA,
    usedKgB,
    counterA: Number.isFinite(rawA) ? rawA * coeffA : null,
    counterB: Number.isFinite(rawB) ? rawB * coeffB : null,
    production: Number.isFinite(get('production')) ? get('production') : null,
    millRun: get('millRun'),
  };
}
