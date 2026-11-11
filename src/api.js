// FastAPI(Python) 연동. 데이터 수집·지표 계산은 서버가 하고, 리액트는 받아서 그리기만 한다.

const BASE = '/api';

export async function fetchChart(code, period, count = 120) {
  const res = await fetch(`${BASE}/stocks/${code}/chart?period=${period}&count=${count}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail.map((d) => d.msg).join(', ') : data.detail;
    throw new Error(detail || `요청 실패 (${res.status})`);
  }
  return data; // { candles, indicators, signals }
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
