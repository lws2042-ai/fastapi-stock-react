import { useState } from 'react';
import { macd } from './indicators.js';

const W = 800;
const H = 420;
const PAD = { top: 16, right: 64, bottom: 28, left: 12 };
const VOL_H = 50; // 거래량 영역 높이
const MACD_H = 90; // MACD 오실레이터 영역 높이
const GAP = 8; // MACD와 거래량 사이
const MACD_GAP = 32; // 가격 차트와 MACD 사이 (가격 축 라벨 + MACD 제목 공간)

const fmtNum = (v) => v.toLocaleString('ko-KR', { maximumFractionDigits: 1 });

// 라이브러리 없이 SVG로 그리는 종가 라인 + 거래량 + MACD 오실레이터 차트
export default function PriceChart({ rows }) {
  const [hover, setHover] = useState(null);
  if (rows.length < 2) return null;

  const innerW = W - PAD.left - PAD.right;
  const priceH = H - PAD.top - PAD.bottom - VOL_H - GAP - MACD_H - MACD_GAP;

  const closes = rows.map((r) => r.close);
  let min = Math.min(...closes);
  let max = Math.max(...closes);
  const margin = (max - min) * 0.1 || max * 0.01;
  min -= margin;
  max += margin;
  const maxVol = Math.max(...rows.map((r) => r.volume)) || 1;

  const step = innerW / (rows.length - 1);
  const x = (i) => PAD.left + i * step;
  const y = (v) => PAD.top + ((max - v) / (max - min)) * priceH;
  // 배치: 가격 → MACD 오실레이터 → 거래량
  const macdTop = PAD.top + priceH + MACD_GAP;
  const volTop = macdTop + MACD_H + GAP;

  // MACD 오실레이터: 0선을 가운데 두고 위아래 대칭 스케일
  const m = macd(rows.map((r) => r.close));
  const mMax = Math.max(...m.flatMap((v) => [Math.abs(v.osc), Math.abs(v.macd), Math.abs(v.signal)])) || 1;
  const my = (v) => macdTop + MACD_H / 2 - (v / mMax) * (MACD_H / 2);
  const mPath = (key) => m.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${my(v[key])}`).join(' ');

  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.close)}`).join(' ');
  const area = `${line} L${x(rows.length - 1)},${PAD.top + priceH} L${x(0)},${PAD.top + priceH} Z`;
  const rising = rows.at(-1).close >= rows[0].close;
  const color = rising ? 'var(--up)' : 'var(--down)';

  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const labelIdx = [0, Math.floor((rows.length - 1) / 2), rows.length - 1];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round((px - PAD.left) / step);
    setHover(Math.max(0, Math.min(rows.length - 1, i)));
  };

  const h = hover != null ? rows[hover] : null;
  const d = (s) => `${s.slice(4, 6)}/${s.slice(6, 8)}`;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={W - PAD.right + 6} y={y(t) + 4} className="axis">
              {Math.round(t).toLocaleString('ko-KR')}
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const bh = (r.volume / maxVol) * VOL_H;
          return (
            <rect
              key={r.date}
              x={x(i) - Math.max(step * 0.3, 1)}
              y={volTop + VOL_H - bh}
              width={Math.max(step * 0.6, 2)}
              height={bh}
              className={`vol ${i === hover ? 'on' : ''}`}
            />
          );
        })}

        {/* MACD 오실레이터 패널 */}
        <text x={PAD.left} y={macdTop - 8} className="axis">
          MACD Osc (12, 26, 9)
          <tspan className="legend-macd" dx="10">— MACD</tspan>
          <tspan className="legend-signal" dx="8">— Signal</tspan>
          <tspan dx="8">· 30건 기준 근사값</tspan>
        </text>
        <line x1={PAD.left} x2={W - PAD.right} y1={my(0)} y2={my(0)} className="grid" />
        <text x={W - PAD.right + 6} y={my(0) + 4} className="axis">0</text>
        <text x={W - PAD.right + 6} y={macdTop + 10} className="axis">{fmtNum(mMax)}</text>
        <text x={W - PAD.right + 6} y={macdTop + MACD_H} className="axis">{fmtNum(-mMax)}</text>
        {m.map((v, i) => (
          <rect
            key={rows[i].date}
            x={x(i) - Math.max(step * 0.3, 1)}
            y={Math.min(my(v.osc), my(0))}
            width={Math.max(step * 0.6, 2)}
            height={Math.abs(my(v.osc) - my(0))}
            className={`osc ${v.osc >= 0 ? 'pos' : 'neg'} ${i === hover ? 'on' : ''}`}
          />
        ))}
        <path d={mPath('macd')} className="macd-line" />
        <path d={mPath('signal')} className="signal-line" />

        <path d={area} fill="url(#fill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} className="axis" textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}>
            {d(rows[i].date)}
          </text>
        ))}

        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={volTop + VOL_H} className="cross" />
            <circle cx={x(hover)} cy={y(h.close)} r="4" fill={color} stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {h && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{`${h.date.slice(0, 4)}.${h.date.slice(4, 6)}.${h.date.slice(6, 8)}`}</b>
          <span>종가 {h.close.toLocaleString('ko-KR')}</span>
          <span>시/고/저 {h.open.toLocaleString('ko-KR')} / {h.high.toLocaleString('ko-KR')} / {h.low.toLocaleString('ko-KR')}</span>
          <span>거래량 {h.volume.toLocaleString('ko-KR')}</span>
          <span>
            MACD {fmtNum(m[hover].macd)} · Signal {fmtNum(m[hover].signal)} · Osc {fmtNum(m[hover].osc)}
          </span>
        </div>
      )}
    </div>
  );
}
