import { useEffect, useState } from 'react';
import PriceChart from './PriceChart.jsx';

const PERIODS = [
  { value: 'D', label: '일' },
  { value: 'W', label: '주' },
  { value: 'M', label: '월' },
];

const QUICK = [
  { code: '005930', name: '삼성전자' },
  { code: '000660', name: 'SK하이닉스' },
  { code: '035420', name: 'NAVER' },
  { code: '035720', name: '카카오' },
  { code: '005380', name: '현대차' },
];

const num = (v) => Number(v || 0);
const fmt = (v) => num(v).toLocaleString('ko-KR');
const fmtDate = (d) => `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;

// KIS 등락 부호: 1 상한, 2 상승, 3 보합, 4 하한, 5 하락
const signClass = (sign) => (sign === '1' || sign === '2' ? 'up' : sign === '4' || sign === '5' ? 'down' : '');

async function fetchDaily(code, period) {
  const res = await fetch(`/api/stocks/${code}/daily?period=${period}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `요청 실패 (${res.status})`);
  // 최신순으로 오므로 날짜 오름차순으로 뒤집어 사용
  return (data.output || [])
    .filter((r) => r.stck_bsop_date)
    .map((r) => ({
      date: r.stck_bsop_date,
      open: num(r.stck_oprc),
      high: num(r.stck_hgpr),
      low: num(r.stck_lwpr),
      close: num(r.stck_clpr),
      volume: num(r.acml_vol),
      change: num(r.prdy_vrss),
      rate: num(r.prdy_ctrt),
      sign: r.prdy_vrss_sign,
    }))
    .reverse();
}

function App() {
  const [input, setInput] = useState('005930');
  const [code, setCode] = useState('005930');
  const [period, setPeriod] = useState('D');
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState({ key: null, rows: [], error: '' });
  const [formError, setFormError] = useState('');

  // 요청 키가 응답 키와 다르면 아직 로딩 중
  const reqKey = `${code}|${period}|${reload}`;
  const loading = result.key !== reqKey;
  const { rows } = result;
  const error = formError || result.error;

  useEffect(() => {
    let alive = true; // 빠르게 종목을 바꿀 때 이전 응답 무시
    fetchDaily(code, period).then(
      (data) => alive && setResult({ key: reqKey, rows: data, error: '' }),
      (e) => alive && setResult({ key: reqKey, rows: [], error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [code, period, reqKey]);

  const onSubmit = (e) => {
    e.preventDefault();
    const c = input.trim();
    if (!/^\d{6}$/.test(c)) {
      setFormError('종목코드는 6자리 숫자입니다. (예: 005930)');
      return;
    }
    setFormError('');
    if (c === code) setReload((n) => n + 1);
    else setCode(c);
  };

  const last = rows.at(-1);
  const first = rows[0];
  const high = rows.length ? Math.max(...rows.map((r) => r.high)) : 0;
  const low = rows.length ? Math.min(...rows.map((r) => r.low)) : 0;
  const totalRate = first && last ? ((last.close - first.close) / first.close) * 100 : 0;

  return (
    <div className="wrap">
      <h1>
        📈 주식 시세 <span className="sub">최근 30건 · FastAPI</span>
      </h1>

      <form className="search" onSubmit={onSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="종목코드 (예: 005930)" maxLength={6} />
        <button disabled={loading}>{loading ? '조회 중…' : '조회'}</button>
      </form>

      <div className="quick">
        {QUICK.map((q) => (
          <button
            key={q.code}
            className={q.code === code ? 'on' : ''}
            onClick={() => {
              setFormError('');
              setInput(q.code);
              setCode(q.code);
            }}
          >
            {q.name}
          </button>
        ))}
      </div>

      {error && <div className="msg">⚠️ {error}</div>}

      {last && (
        <>
          <div className="card summary">
            <div>
              <div className="label">종목코드 {code}</div>
              <div className={`price ${signClass(last.sign)}`}>{fmt(last.close)}원</div>
              <div className={signClass(last.sign)}>
                {last.change > 0 ? '+' : ''}
                {fmt(last.change)} ({last.rate > 0 ? '+' : ''}
                {last.rate.toFixed(2)}%)
              </div>
            </div>
            <dl>
              <div><dt>기간 최고</dt><dd className="up">{fmt(high)}</dd></div>
              <div><dt>기간 최저</dt><dd className="down">{fmt(low)}</dd></div>
              <div>
                <dt>기간 수익률</dt>
                <dd className={totalRate > 0 ? 'up' : totalRate < 0 ? 'down' : ''}>
                  {totalRate > 0 ? '+' : ''}
                  {totalRate.toFixed(2)}%
                </dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>
                {fmtDate(first.date)} ~ {fmtDate(last.date)}
              </h2>
              <div className="seg">
                {PERIODS.map((p) => (
                  <button key={p.value} className={p.value === period ? 'on' : ''} onClick={() => setPeriod(p.value)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart rows={rows} />
          </div>

          <div className="card">
            <h2>시세 내역</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>일자</th><th>종가</th><th>전일대비</th><th>등락률</th>
                    <th>시가</th><th>고가</th><th>저가</th><th>거래량</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.date}>
                      <td>{fmtDate(r.date)}</td>
                      <td className={signClass(r.sign)}>{fmt(r.close)}</td>
                      <td className={signClass(r.sign)}>{r.change > 0 ? '+' : ''}{fmt(r.change)}</td>
                      <td className={signClass(r.sign)}>{r.rate > 0 ? '+' : ''}{r.rate.toFixed(2)}%</td>
                      <td>{fmt(r.open)}</td>
                      <td>{fmt(r.high)}</td>
                      <td>{fmt(r.low)}</td>
                      <td>{fmt(r.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
