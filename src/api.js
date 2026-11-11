// FastAPI(Python) 연동. 데이터 수집·지표 계산은 서버가 하고, 리액트는 받아서 그리기만 한다.

const BASE = '/api';

// 한 번 받은 차트는 브라우저 메모리에 두고, 다시 열면 바로 보여준 뒤 뒤에서 새로 받는다.
const chartCache = new Map(); // `${code}|${period}` → { at, data }
const inflight = new Map(); // 같은 차트를 동시에 두 번 요청하지 않도록
const PREFETCH_FRESH_MS = 30_000;

export function peekChart(code, period) {
  return chartCache.get(`${code}|${period}`)?.data ?? null;
}

export function fetchChart(code, period, count = 120) {
  const key = `${code}|${period}`;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const res = await fetch(`${BASE}/stocks/${code}/chart?period=${period}&count=${count}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail;
      throw new Error(detail || `요청 실패 (${res.status})`);
    }
    chartCache.set(key, { at: Date.now(), data });
    if (chartCache.size > 60) chartCache.delete(chartCache.keys().next().value); // 오래된 것부터 정리
    return data; // { candles, indicators, signals }
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// 마우스를 올렸을 때 미리 받아 둔다 (최근에 받았으면 생략). 서버가 같은 요청을 하나로 합치므로 중복 호출은 없다.
export function prefetchChart(code, period = 'D') {
  const hit = chartCache.get(`${code}|${period}`);
  if (hit && Date.now() - hit.at < PREFETCH_FRESH_MS) return;
  fetchChart(code, period).catch(() => {});
}

// kind: gainers(급등) / active(거래대금+거래량 종합) / volume / trade-value / market-cap
export async function fetchRanking(kind, market = 'kospi', limit = 10) {
  const res = await fetch(`${BASE}/rankings/${kind}?market=${market}&limit=${limit}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `요청 실패 (${res.status})`);
  return data; // [{ rank, code, name, price, change, change_rate, sign, volume, trade_value, score }]
}

export function realtimeUrl(code) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${BASE}/ws/stocks/${code}`;
}
