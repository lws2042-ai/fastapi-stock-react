import { useEffect, useRef, useState } from 'react';
import { fetchRanking, prefetchChart } from './api.js';
import { NAMES, QUOTES } from './names.js';

const REFRESH_MS = 5_000; // 서버가 5초 캐시하므로 그보다 자주 부를 필요 없다

const MARKETS = [
  { value: 'kospi', label: '코스피' },
  { value: 'kosdaq', label: '코스닥' },
  { value: 'all', label: '전체' },
];

const fmt = (v) => (v ?? 0).toLocaleString('ko-KR');
const fmtWon = (v) => (v == null ? '-' : v >= 1e12 ? `${(v / 1e12).toFixed(2)}조` : `${fmt(Math.round(v / 1e8))}억`);
const fmtVol = (v) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)}억주` : v >= 1e4 ? `${fmt(Math.round(v / 1e4))}만주` : `${fmt(v)}주`);
const signClass = (s) => (s === '1' || s === '2' ? 'up' : s === '4' || s === '5' ? 'down' : '');

const BOARDS = [
  {
    kind: 'gainers',
    title: '🚀 실시간 급등주 TOP 10',
    cols: [{ head: '거래량', cell: (r) => fmtVol(r.volume) }],
  },
  {
    kind: 'active',
    title: '💰 거래대금 + 거래량 TOP 10',
    note: '거래대금과 거래량을 각각 1위 대비 비율로 바꿔 더한 점수 순',
    cols: [
      { head: '거래대금', cell: (r) => fmtWon(r.trade_value) },
      { head: '거래량', cell: (r) => fmtVol(r.volume) },
    ],
  },
];

function Board({ board, rows, error, onSelect, flashed }) {
  return (
    <div className="card">
      <h2>{board.title}</h2>
      {board.note && <div className="note board-note">{board.note}</div>}
      {error && <div className="msg">⚠️ {error}</div>}
      <div className="table-wrap">
        <table className="rank">
          <thead>
            <tr>
              <th>#</th>
              <th>종목</th>
              <th>현재가</th>
              <th>등락률</th>
              {board.cols.map((c) => <th key={c.head}>{c.head}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows == null ? (
              <tr><td colSpan={4 + board.cols.length} className="empty">불러오는 중…</td></tr>
            ) : (
              rows.map((r) => {
                const cls = signClass(r.sign);
                return (
                  <tr
                    key={r.code}
                    onClick={() => onSelect(r.code, r.name)}
                    onPointerEnter={() => prefetchChart(r.code)}
                    onTouchStart={() => prefetchChart(r.code)}
                  >
                    <td className="muted">{r.rank}</td>
                    <td className="nm" title={`${r.name} (${r.code})`}>{r.name}</td>
                    <td className={`${cls}${flashed.has(`${board.kind}:${r.code}`) ? ' flash' : ''}`}>{fmt(r.price)}</td>
                    <td className={cls}>{r.change_rate > 0 ? '+' : ''}{r.change_rate.toFixed(2)}%</td>
                    {board.cols.map((c) => <td key={c.head} className="muted">{c.cell(r)}</td>)}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Home({ onSelect, active = true }) {
  const [market, setMarket] = useState('kospi');
  const [live, setLive] = useState(true);
  const [state, setState] = useState({ market: null, rows: {}, errors: {}, at: null });
  const [flashed, setFlashed] = useState(new Set());
  const [input, setInput] = useState('');
  const [formError, setFormError] = useState('');
  const prices = useRef(new Map());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const results = await Promise.allSettled(BOARDS.map((b) => fetchRanking(b.kind, market)));
      if (!alive) return;
      const changed = new Set();
      setState((prev) => {
        const rows = prev.market === market ? { ...prev.rows } : {};
        const errors = {};
        results.forEach((res, i) => {
          const kind = BOARDS[i].kind;
          if (res.status === 'fulfilled') {
            rows[kind] = res.value;
            res.value.forEach((r) => {
              NAMES.set(r.code, r.name);
              QUOTES.set(r.code, r);
              const key = `${kind}:${r.code}`;
              const before = prices.current.get(key);
              if (before != null && before !== r.price) changed.add(key);
              prices.current.set(key, r.price);
            });
          } else {
            errors[kind] = res.reason.message;
          }
        });
        return { market, rows, errors, at: new Date() };
      });
      setFlashed(changed);
    };
    // 상세 화면을 보는 동안(active=false)에는 순위를 새로 받지 않는다
    if (!active) return () => { alive = false; };
    load();
    if (!live) return () => { alive = false; };
    const id = setInterval(() => !document.hidden && load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [market, live, active]);

  const onSubmit = (e) => {
    e.preventDefault();
    const c = input.trim();
    if (!/^\d{6}$/.test(c)) {
      setFormError('종목코드는 6자리 숫자입니다. (예: 005930)');
      return;
    }
    setFormError('');
    onSelect(c);
  };

  const current = state.market === market;

  return (
    <div className="wrap">
      <h1>
        📈 주식 시세 <span className="sub">React + FastAPI</span>
      </h1>

      <div className="toolbar">
        <div className="seg">
          {MARKETS.map((m) => (
            <button key={m.value} className={m.value === market ? 'on' : ''} onClick={() => setMarket(m.value)}>
              {m.label}
            </button>
          ))}
        </div>
        <button className={`live live-btn ${live ? 'on' : ''}`} onClick={() => setLive((v) => !v)} title="5초마다 자동 갱신">
          <span className="dot" />
          {live ? '실시간' : '일시정지'}
        </button>
        {state.at && <span className="muted small">{state.at.toLocaleTimeString('ko-KR')} 기준</span>}
        <span className="grow" />
        <form className="search" onSubmit={onSubmit}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="종목코드로 검색 (예: 005930)" maxLength={6} />
          <button>조회</button>
        </form>
      </div>
      {formError && <div className="msg">⚠️ {formError}</div>}

      <div className="boards">
        {BOARDS.map((b) => (
          <Board
            key={b.kind}
            board={b}
            rows={current ? state.rows[b.kind] : null}
            error={current ? state.errors[b.kind] : ''}
            onSelect={onSelect}
            flashed={flashed}
          />
        ))}
      </div>
      <div className="note">종목을 누르면 차트·호가·실시간 체결 화면으로 이동합니다.</div>
    </div>
  );
}
