// 지수이동평균 (첫 값으로 시작)
function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

// MACD(12, 26, 9)
// macd = EMA12 - EMA26, signal = EMA9(macd), osc = macd - signal
// 데이터가 30건뿐이라 앞쪽 값은 워밍업이 부족한 근사값이다.
export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => f[i] - s[i]);
  const signal = ema(line, signalPeriod);
  return closes.map((_, i) => ({ macd: line[i], signal: signal[i], osc: line[i] - signal[i] }));
}
