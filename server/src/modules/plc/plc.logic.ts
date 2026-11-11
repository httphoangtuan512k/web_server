/**
 * File này: thuật toán SCADA tính tồn phễu, silo A/B và bộ đếm bao cho 4 máy của PLC Máy B (chép nguyên từ server.js cũ).
 * Dùng ở: plc.service.ts – state được đọc từ bảng plc_machine_states, tính xong thì lưu lại DB.
 */
// Mã thiết bị PLC duy nhất: Máy B.
export const PLC_DEVICE_ID = 'MAY_B';
// Cứ 60 giây mới lưu 1 bản ghi lịch sử.
export const PLC_HISTORY_INTERVAL_MS = 60 * 1000;
/** Khoảng cách giữa 2 bản tin vượt ngưỡng này = mất kết nối → lần nhận kế tiếp chỉ lấy mốc (rebaseline). */
export const PLC_RECONNECT_MS = 5000;
/** /latest coi là đang kết nối nếu bản tin gần nhất không cũ hơn ngưỡng này. */
export const PLC_CONNECTED_MS = 5000;
// Danh sách 4 máy nghiền.
export const PLC_MACHINES = ['may1', 'may2', 'may3', 'may4'] as const;
// Kiểu tên máy: chỉ được là 'may1' | 'may2' | 'may3' | 'may4'.
export type PlcMachine = (typeof PLC_MACHINES)[number];

// Khóa chuẩn → tên tag thật trên PLC (cân, phễu đầy, xả silo, chế độ Jumbo/bao, bộ đếm…).
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

// Bảng tên tag của từng máy (máy 1 khác ở tag "JB A").
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

// Trạng thái 1 máy: đối tượng tự do (tồn phễu, silo, mốc bộ đếm…).
export type PlcState = Record<string, any>;

// State mặc định: phễu đầy 20 t, silo 0, hệ số 1, chưa có mốc → cần lấy mốc.
export const PLC_STATE_DEFAULTS: PlcState = {
  hopperSetpoint: 20, hopper: 20, stockA: 0, stockB: 0, coeffA: 1, coeffB: 1,
  lastWeight: null, lastRawCounterA: null, lastRawCounterB: null,
  lastCounterModeA: null, lastCounterModeB: null, needsRebaseline: true,
};

/** Các thông số người vận hành được phép chỉnh qua PATCH /api/plc/operation-state/:machine. */
export const PLC_EDITABLE_KEYS = new Set(['hopperSetpoint', 'hopper', 'stockA', 'stockB', 'coeffA', 'coeffB']);

/** Đổi giá trị PLC gửi lên thành số ("12,5" → 12.5); rỗng → NaN. */
export function plcNum(v: unknown): number {
  if (v === null || v === undefined || String(v).trim() === '') return NaN;
  return Number(String(v).trim().replace(',', '.'));
}

/** Lấy giá trị tag theo tên, không phân biệt hoa/thường và khoảng trắng thừa. */
export function plcTag(data: any, name: string): unknown {
  if (!data || typeof data !== 'object') return undefined;
  // Khớp đúng tên thì lấy luôn.
  if (Object.prototype.hasOwnProperty.call(data, name)) return data[name];
  // Không thì chuẩn hóa tên rồi tìm lại.
  const wanted = String(name).trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
  const key = Object.keys(data).find((k) => String(k).trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ') === wanted);
  return key === undefined ? undefined : data[key];
}

/** state trong DB (có thể thiếu khóa) → state đầy đủ (giống `{ ...PLC_STATE_DEFAULTS, ...JSON.parse(state_json) }` cũ). */
export function plcStateFrom(raw: unknown): PlcState {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as PlcState) : {};
  return { ...PLC_STATE_DEFAULTS, ...obj };
}

// Kiểm tra có phải số hữu hạn (loại NaN, null).
const isFiniteNum = (v: unknown): boolean => Number.isFinite(v as number);

/**
 * Port nguyên văn plcProcessMachine. `state` bị sửa trực tiếp (như object trong Map cũ) – caller lưu lại DB.
 * Ý tưởng: cân và bộ đếm bao là số cộng dồn → so với lần trước để biết vừa tăng bao nhiêu.
 *   Cân tăng → phễu giảm, silo đang xả tăng. Bộ đếm bao tăng × hệ số → silo giảm.
 */
export function plcProcessMachine(machine: PlcMachine, state: PlcState, data: any, nowIso: string, reconnect: boolean) {
  // Đọc các tag của máy này ra số.
  const tags = PLC_SCADA_CONFIGS[machine];
  const get = (key: keyof TagConfig) => plcNum(plcTag(data, tags[key]));
  const weight = get('currentWeight');
  const high = get('hopperHigh');
  const feedA = get('feedSiloA') === 1;
  const feedB = get('feedSiloB') === 1;
  // Chế độ đóng hàng: 1 = Jumbo, 0 = bao nhỏ.
  const modeA = get('modeA');
  const modeB = get('modeB');
  // Bộ đếm thô theo chế độ đang chạy (không rõ chế độ → NaN).
  const rawA = modeA === 1 ? get('jbATotal') : modeA === 0 ? get('bagATotal') : NaN;
  const rawB = modeB === 1 ? get('jbBTotal') : modeB === 0 ? get('bagBTotal') : NaN;
  // Hệ số kg mỗi đơn vị bộ đếm (không âm).
  const coeffA = Math.max(0, plcNum(state.coeffA) || 0);
  const coeffB = Math.max(0, plcNum(state.coeffB) || 0);
  // Kết quả lần này: tấn qua cân, kg đóng bao từ silo A/B.
  let addedWeight = 0,
    usedKgA = 0,
    usedKgB = 0;

  // Vừa kết nối lại / cần lấy mốc: chỉ ghi nhớ số hiện tại, không cộng trừ tồn.
  if (reconnect || state.needsRebaseline) {
    state.lastWeight = Number.isFinite(weight) ? weight : null;
    state.lastRawCounterA = Number.isFinite(rawA) ? rawA : null;
    state.lastRawCounterB = Number.isFinite(rawB) ? rawB : null;
    state.lastCounterModeA = modeA === 0 || modeA === 1 ? modeA : null;
    state.lastCounterModeB = modeB === 0 || modeB === 1 ? modeB : null;
    state.needsRebaseline = false;
  } else {
    // B1: lượng vừa qua cân = phần tăng so với lần trước (giảm/reset → 0).
    if (Number.isFinite(weight)) {
      const delta = isFiniteNum(state.lastWeight) ? weight - state.lastWeight : 0;
      addedWeight = delta > 0 ? delta : 0;
      state.lastWeight = weight;
    }
    // B2: phễu đầy → đặt bằng mức đầy; chưa đầy → trừ lượng vừa qua cân.
    if (high === 1) state.hopper = Math.max(0, plcNum(state.hopperSetpoint) || 0);
    else if (high === 0 && addedWeight > 0) state.hopper = Math.max(0, (plcNum(state.hopper) || 0) - addedWeight);
    // B3: cộng vào silo đang xả, chỉ khi đúng một silo mở.
    if (addedWeight > 0 && feedA && !feedB) state.stockA = Math.max(0, (plcNum(state.stockA) || 0) + addedWeight);
    else if (addedWeight > 0 && feedB && !feedA) state.stockB = Math.max(0, (plcNum(state.stockB) || 0) + addedWeight);

    // B4: silo A – cùng chế độ và bộ đếm không giảm → kg đóng = chênh lệch × hệ số.
    if (Number.isFinite(rawA) && (modeA === 0 || modeA === 1)) {
      if (state.lastCounterModeA === modeA && isFiniteNum(state.lastRawCounterA) && rawA >= state.lastRawCounterA)
        usedKgA = (rawA - state.lastRawCounterA) * coeffA;
      state.lastRawCounterA = rawA;
      state.lastCounterModeA = modeA;
    } else {
      // Không đọc được bộ đếm → xóa mốc.
      state.lastRawCounterA = null;
      state.lastCounterModeA = null;
    }
    // B5: silo B – tương tự silo A.
    if (Number.isFinite(rawB) && (modeB === 0 || modeB === 1)) {
      if (state.lastCounterModeB === modeB && isFiniteNum(state.lastRawCounterB) && rawB >= state.lastRawCounterB)
        usedKgB = (rawB - state.lastRawCounterB) * coeffB;
      state.lastRawCounterB = rawB;
      state.lastCounterModeB = modeB;
    } else {
      state.lastRawCounterB = null;
      state.lastCounterModeB = null;
    }
    // B6: trừ tồn silo theo lượng đã đóng (kg → tấn).
    if (usedKgA > 0) state.stockA = Math.max(0, (plcNum(state.stockA) || 0) - usedKgA / 1000);
    if (usedKgB > 0) state.stockB = Math.max(0, (plcNum(state.stockB) || 0) - usedKgB / 1000);
  }
  // Đảm bảo tồn luôn là số không âm.
  state.stockA = Math.max(0, plcNum(state.stockA) || 0);
  state.stockB = Math.max(0, plcNum(state.stockB) || 0);
  state.hopper = Math.max(0, plcNum(state.hopper) || 0);

  // Lưu bộ đếm đã nhân hệ số vào state để API /api/plc/latest trả về giao diện.
  state.counterA = Number.isFinite(rawA) ? rawA * coeffA : null;
  state.counterB = Number.isFinite(rawB) ? rawB * coeffB : null;

  // Trả state + số phụ (lượng vừa qua cân, kg đóng bao, năng suất, tần số máy nghiền).
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
