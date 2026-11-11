// 서버 캔들 ↔ 차트 시간 변환, 실시간 체결로 마지막 캔들 갱신

// 'YYYYMMDD' → 'YYYY-MM-DD', 'YYYYMMDDHHMM'(60분봉) → UTC 초 (차트가 UTC로 표시하므로 한국시간 그대로 보임)
export function toChartTime(date) {
  if (date.length === 8) return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const [y, m, d, H, M] = [0, 4, 6, 8, 10].map((i, k) => Number(date.slice(i, i + (k ? 2 : 4))));
  return Date.UTC(y, m - 1, d, H, M) / 1000;
}

export function todayKST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).replaceAll('-', '');
}

/**
 * 실시간 체결(tick)을 마지막 캔들에 반영한 새 캔들을 돌려준다. 반영할 게 없으면 null.
 * - D: 오늘 캔들이면 당일 시/고/저/종/누적거래량으로 갱신, 오늘 첫 체결이면 새 캔들 추가
 * - W/M: 종가·고가·저가만 갱신 (누적거래량이 당일 기준이라 주/월 거래량은 다음 조회 때 반영)
 * - 60: 체결 시각으로 60분 구간을 정해 갱신하거나 새 캔들 추가
 */
export function applyTick(last, tick, period) {
  if (!last || !tick?.price) return null;
  const today = todayKST();

  if (period === 'D') {
    const live = { open: tick.open || tick.price, high: tick.high, low: tick.low, close: tick.price, volume: tick.volume };
    if (last.date === today) return { ...last, ...live };
    if (last.date < today && !tick.snapshot) return { date: today, ...live };
    return null;
  }

  if (period === 'W' || period === 'M') {
    return { ...last, close: tick.price, high: Math.max(last.high, tick.price), low: Math.min(last.low, tick.price) };
  }

  // 60분봉
  if (tick.snapshot || !tick.time) return null;
  const mins = Number(tick.time.slice(0, 2)) * 60 + Number(tick.time.slice(2, 4));
  const start = 9 * 60 + Math.max(0, Math.floor((mins - 9 * 60) / 60)) * 60;
  const key = `${today}${String(Math.floor(start / 60)).padStart(2, '0')}${String(start % 60).padStart(2, '0')}`;
  if (key === last.date) {
    return {
      ...last,
      close: tick.price,
      high: Math.max(last.high, tick.price),
      low: Math.min(last.low, tick.price),
      volume: last.volume + tick.tick_volume,
    };
  }
  if (key > last.date) {
    return { date: key, open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume: tick.tick_volume };
  }
  return null;
}
