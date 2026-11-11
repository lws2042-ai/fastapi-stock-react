import { useEffect, useState } from 'react';
import { fetchChart } from './api.js';
import { NAMES } from './names.js';
import OrderBook from './OrderBook.jsx';
import StockChart from './StockChart.jsx';
import Trades from './Trades.jsx';
import { useRealtime } from './useRealtime.js';

const PERIODS = [
  { value: 'D', label: '일' },
  { value: 'W', label: '주' },
  { value: 'M', label: '월' },
  { value: '60', label: '60분' },
];

const REFRESH_MS = 60_000; // 지표는 서버에서 다시 계산해 1분마다 받아온다

const STATUS = {
  connecting: { text: '연결 중', cls: '' },
  live: { text: '실시간', cls: 'on' },
  reconnecting: { text: '재연결 중', cls: 'warn' },
  error: { text: '실시간 오류', cls: 'warn' },
};

const fmt = (v) => (v ?? 0).toLocaleString('ko-KR');
const signClass = (s) => (s === '1' || s === '2' ? 'up' : s === '4' || s === '5' ? 'down' : '');
const fmtDate = (d) => `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}${d.length > 8 ? ` ${d.slice(8, 10)}:${d.slice(10, 12)}` : ''}`;

export default function StockDetail({ code, onBack, onSelect }) {
  const [input, setInput] = useState(code);
  const [period, setPeriod] = useState('D');
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [formError, setFormError] = useState('');

  const baseKey = `${code}|${period}`;
  const loading = result.key !== baseKey;
  const data = loading ? null : result.data;

  const rt = useRealtime(code);

  // 1) 과거 캔들 + 지표 (REST, 파이썬이 계산)
  useEffect(() => {
    let alive = true;
    fetchChart(code, period).then(
      (d) => alive && setResult({ key: baseKey, data: d, error: '' }),
      (e) => alive && setResult((r) => (r.key === baseKey && r.data ? r : { key: baseKey, data: null, error: e.message })),
    );
    return () => {
      alive = false;
    };
  }, [code, period, baseKey, refresh]);

  // 2) 주기적으로 지표 재조회 (탭이 보일 때만)
  useEffect(() => {
    const id = setInterval(() => !document.hidden && setRefresh((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const c = input.trim();
    if (!/^\d{6}$/.test(c)) {
      setFormError('종목코드는 6자리 숫자입니다. (예: 005930)');
      return;
    }
    setFormError('');
    if (c === code) setRefresh((n) => n + 1);
    else onSelect(c);
  };

  const tick = rt.tick;
  const name = NAMES.get(code) ?? code;
  const status = STATUS[rt.status] ?? STATUS.connecting;
  const error = formError || result.error;
  const candles = data?.candles ?? [];

  return (
    <div className="wrap">
      <div className="toolbar">
        <button className="back" onClick={onBack}>← 순위</button>
        <span className="grow" />
        <form className="search" onSubmit={onSubmit}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="종목코드 (예: 005930)" maxLength={6} />
          <button disabled={loading}>{loading ? '조회 중…' : '조회'}</button>
        </form>
      </div>

      {error && <div className="msg">⚠️ {error}</div>}
      {rt.error && <div className="msg">⚠️ 실시간: {rt.error}</div>}

      <div className="card summary">
        <div>
          <div className="label">
            <b className="stock-name">{name}</b> <span className="muted">{code}</span>
            <span className={`live ${status.cls}`}>
              <span className="dot" />
              {status.text}
            </span>
          </div>
          {tick ? (
            <>
              <div className={`price ${signClass(tick.sign)}`}>{fmt(tick.price)}원</div>
              <div className={signClass(tick.sign)}>
                {tick.change > 0 ? '+' : ''}
                {fmt(tick.change)} ({tick.rate > 0 ? '+' : ''}
                {tick.rate.toFixed(2)}%)
              </div>
            </>
          ) : (
            <div className="price muted">-</div>
          )}
        </div>
        {tick && (
          <dl>
            <div><dt>시가</dt><dd>{fmt(tick.open)}</dd></div>
            <div><dt>고가</dt><dd className="up">{fmt(tick.high)}</dd></div>
            <div><dt>저가</dt><dd className="down">{fmt(tick.low)}</dd></div>
            <div><dt>거래량</dt><dd>{fmt(tick.volume)}</dd></div>
            <div><dt>체결강도</dt><dd>{tick.strength != null ? tick.strength.toFixed(2) : '-'}</dd></div>
          </dl>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-head">
            <h2>차트</h2>
            <div className="seg">
              {PERIODS.map((p) => (
                <button key={p.value} className={p.value === period ? 'on' : ''} onClick={() => setPeriod(p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-wrap">
            <StockChart data={data} period={period} tick={tick} resetKey={baseKey} />
            {loading && (
              <div className="overlay">{period === '60' ? '불러오는 중… (60분봉은 첫 조회에 10초쯤 걸립니다)' : '불러오는 중…'}</div>
            )}
          </div>
          <div className="note">
            ▲ 매수 신호 · ▼ 매도 신호 (마우스를 올리면 내용 표시) · 지표와 신호는 서버(Python)에서 계산해 1분마다 갱신, 마지막 캔들은 실시간 반영
          </div>
        </div>

        <div className="card">
          <h2>호가</h2>
          <OrderBook book={rt.book} tick={tick} />
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>시세 내역</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>일시</th><th>종가</th><th>시가</th><th>고가</th><th>저가</th><th>거래량</th></tr>
              </thead>
              <tbody>
                {candles.slice(-30).reverse().map((c, i, arr) => {
                  const prev = arr[i + 1]?.close;
                  const cls = prev == null ? '' : c.close > prev ? 'up' : c.close < prev ? 'down' : '';
                  return (
                    <tr key={c.date}>
                      <td>{fmtDate(c.date)}</td>
                      <td className={cls}>{fmt(c.close)}</td>
                      <td>{fmt(c.open)}</td>
                      <td>{fmt(c.high)}</td>
                      <td>{fmt(c.low)}</td>
                      <td>{fmt(c.volume)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>실시간 체결</h2>
          <Trades trades={rt.trades} />
        </div>
      </div>
    </div>
  );
}
