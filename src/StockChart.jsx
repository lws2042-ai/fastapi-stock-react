import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { applyTick, toChartTime } from './candles.js';

const MA = [
  { key: 'ma3', label: 'MA3', color: '#dc2626', width: 2 },
  { key: 'ma20', label: 'MA20', color: '#10b981', width: 1 },
  { key: 'ma60', label: 'MA60', color: '#8b5cf6', width: 1 },
];
const SIG_COLOR = '#f59f00';
const OBV_COLOR = '#0ea5e9';
const SIG_TEXT = { MACD: 'MACD', RSI: 'RSI', STOCH: 'Stoch', MA: '이평', OBV: 'OBV' };

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (v) => (v == null ? '-' : Math.round(v).toLocaleString('ko-KR'));

/**
 * 서버가 계산한 캔들·지표·신호를 그리고, 실시간 체결(tick)로 마지막 캔들만 갱신한다.
 * 패널: 가격(캔들+이평+신호) → MACD 오실레이터 → OBV → 거래량
 * OBV 신호는 가격 패널이 복잡해지지 않도록 OBV 패널에만 표시한다.
 */
export default function StockChart({ data, period, tick, resetKey }) {
  const boxRef = useRef(null);
  const subLegendRef = useRef(null);
  const obvLegendRef = useRef(null);
  const api = useRef(null);
  const lastRef = useRef(null); // 마지막 캔들 (실시간 갱신 대상)
  const fittedKey = useRef(null);
  const sigByTime = useRef(new Map()); // 차트 시간 → 그 봉의 신호 목록 (마우스 오버 시 표시)
  const [hover, setHover] = useState(null);

  // 차트 생성 (한 번)
  useEffect(() => {
    const up = cssVar('--up');
    const down = cssVar('--down');
    const chart = createChart(boxRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: cssVar('--muted'),
        fontSize: 11,
        panes: { separatorColor: cssVar('--line') },
      },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar('--line') } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
      localization: { priceFormatter: (p) => Math.round(p).toLocaleString('ko-KR') },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false,
    });
    const mas = MA.map((m) =>
      chart.addSeries(LineSeries, {
        color: m.color, lineWidth: m.width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      }),
    );
    const markers = createSeriesMarkers(candle, []);

    const osc = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1);
    const macd = chart.addSeries(LineSeries, { color: cssVar('--text'), lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 1);
    const signal = chart.addSeries(LineSeries, { color: SIG_COLOR, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 1);

    const volFmt = { type: 'volume' };
    const obv = chart.addSeries(LineSeries, { color: OBV_COLOR, lineWidth: 1.5, priceFormat: volFmt, priceLineVisible: false, lastValueVisible: false }, 2);
    const obvSignal = chart.addSeries(LineSeries, { color: SIG_COLOR, lineWidth: 1, priceFormat: volFmt, priceLineVisible: false, lastValueVisible: false }, 2);
    const obvMarkers = createSeriesMarkers(obv, []);

    const volume = chart.addSeries(HistogramSeries, { priceFormat: volFmt, priceLineVisible: false }, 3);

    // 패널 높이 비율: 가격 5 : MACD 1.6 : OBV 1.4 : 거래량 1.2
    chart.panes()[0].setStretchFactor(5);
    chart.panes()[1].setStretchFactor(1.6);
    chart.panes()[2].setStretchFactor(1.4);
    chart.panes()[3].setStretchFactor(1.2);

    // 보조지표 패널 제목을 실제 패널 위치에 붙인다
    const placeLabel = () => {
      [[1, subLegendRef], [2, obvLegendRef]].forEach(([idx, ref]) => {
        const el = chart.panes()[idx]?.getHTMLElement();
        if (el && ref.current && boxRef.current) {
          const top = el.getBoundingClientRect().top - boxRef.current.getBoundingClientRect().top;
          ref.current.style.top = `${top + boxRef.current.offsetTop + 4}px`;
        }
      });
    };
    const raf = requestAnimationFrame(placeLabel);

    chart.subscribeCrosshairMove((p) => {
      const c = p.seriesData?.get(candle);
      setHover(c ? { ...c, ma: mas.map((s) => p.seriesData.get(s)?.value), sigs: sigByTime.current.get(p.time) } : null);
    });

    api.current = { chart, candle, mas, markers, osc, macd, signal, obv, obvSignal, obvMarkers, volume, up, down, placeLabel };
    return () => {
      cancelAnimationFrame(raf);
      chart.remove();
      api.current = null;
    };
  }, []);

  // 서버 데이터 반영 (처음 + 주기적 재조회)
  useEffect(() => {
    const a = api.current;
    if (!a || !data) return;
    const { candles, indicators: ind, signals } = data;
    const t = candles.map((c) => toChartTime(c.date));
    const volColor = (c) => (c.close >= c.open ? a.up : a.down) + '66';
    const line = (arr) => arr.map((v, i) => (v == null ? { time: t[i] } : { time: t[i], value: v }));

    a.candle.setData(candles.map((c, i) => ({ time: t[i], open: c.open, high: c.high, low: c.low, close: c.close })));
    MA.forEach((m, k) => a.mas[k].setData(line(ind[m.key])));
    a.osc.setData(ind.macd_osc.map((v, i) => (v == null ? { time: t[i] } : { time: t[i], value: v, color: (v >= 0 ? a.up : a.down) + '99' })));
    a.macd.setData(line(ind.macd));
    a.signal.setData(line(ind.macd_signal));
    if (ind.obv) {
      a.obv.setData(line(ind.obv));
      a.obvSignal.setData(line(ind.obv_signal));
    }
    a.volume.setData(candles.map((c, i) => ({ time: t[i], value: c.volume, color: volColor(c) })));
    const toMarker = (s) => ({
      time: t[s.index],
      position: s.type === 'buy' ? 'belowBar' : 'aboveBar',
      shape: s.type === 'buy' ? 'arrowUp' : 'arrowDown',
      color: s.type === 'buy' ? a.up : a.down,
      size: 0.8,
    });
    a.obvMarkers.setMarkers(signals.filter((s) => s.indicator === 'OBV').map(toMarker));
    a.markers.setMarkers(
      signals.filter((s) => s.indicator !== 'OBV').map((s) => ({
        time: t[s.index],
        position: s.type === 'buy' ? 'belowBar' : 'aboveBar',
        shape: s.type === 'buy' ? 'arrowUp' : 'arrowDown',
        color: s.type === 'buy' ? a.up : a.down,
        size: 0.8,
      })),
    );
    a.placeLabel();
    lastRef.current = candles.at(-1);
    sigByTime.current = new Map();
    signals.forEach((s) => {
      const k = t[s.index];
      sigByTime.current.set(k, [...(sigByTime.current.get(k) || []), s]);
    });

    // 종목/주기를 바꿨을 때만 최근 80봉으로 맞춤 (재조회 때는 사용자가 보던 위치 유지)
    if (fittedKey.current !== resetKey) {
      fittedKey.current = resetKey;
      a.chart.timeScale().setVisibleLogicalRange({ from: candles.length - 80, to: candles.length + 3 });
    }
  }, [data, resetKey]);

  // 실시간 체결 → 마지막 캔들만 update (전체 다시 그리지 않음)
  useEffect(() => {
    const a = api.current;
    const c = applyTick(lastRef.current, tick, period);
    if (!a || !c) return;
    const time = toChartTime(c.date);
    a.candle.update({ time, open: c.open, high: c.high, low: c.low, close: c.close });
    a.volume.update({ time, value: c.volume, color: (c.close >= c.open ? a.up : a.down) + '66' });
    lastRef.current = c;
  }, [tick, period]);

  // 마우스가 차트 밖이면 마지막 캔들(실시간 반영)을 보여준다
  const lastCandle = data?.candles.at(-1);
  const legend =
    hover ||
    (lastCandle
      ? { ...(applyTick(lastCandle, tick, period) || lastCandle), ma: MA.map((m) => data.indicators[m.key].at(-1)) }
      : null);

  return (
    <div className="stock-chart">
      <div className="chart-legend">
        {legend && (
          <span>
            시 {fmt(legend.open)} 고 {fmt(legend.high)} 저 {fmt(legend.low)} 종 {fmt(legend.close)}
          </span>
        )}
        {MA.map((m, k) => (
          <span key={m.key} style={{ color: m.color }}>
            {m.label} {legend ? fmt(legend.ma?.[k]) : ''}
          </span>
        ))}
        {hover?.sigs?.map((s) => (
          <span key={s.indicator + s.type} className={s.type === 'buy' ? 'up' : 'down'}>
            {s.type === 'buy' ? '▲' : '▼'} {SIG_TEXT[s.indicator] || s.indicator} · {s.label}
          </span>
        ))}
      </div>
      <div ref={subLegendRef} className="chart-sub-legend">
        MACD Osc (12, 26, 9) <span style={{ color: 'var(--text)' }}>— MACD</span>{' '}
        <span style={{ color: SIG_COLOR }}>— Signal</span>
      </div>
      <div ref={obvLegendRef} className="chart-sub-legend">
        <span style={{ color: OBV_COLOR }}>— OBV</span> <span style={{ color: SIG_COLOR }}>— Signal (9)</span>
      </div>
      <div ref={boxRef} className="chart-box" />
    </div>
  );
}
