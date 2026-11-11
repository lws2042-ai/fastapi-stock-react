import { memo } from 'react';

const fmt = (v) => (v ? v.toLocaleString('ko-KR') : '');

// 호가 한 줄. 값이 바뀐 줄만 다시 그려지도록 memo
const Row = memo(function Row({ side, price, qty, max, current, base }) {
  const cls = price > base ? 'up' : price < base ? 'down' : '';
  return (
    <tr className={`${side} ${price === current ? 'cur' : ''}`}>
      <td className="qty">
        {side === 'ask' && (
          <>
            <i style={{ width: `${(qty / max) * 100}%` }} />
            <b>{fmt(qty)}</b>
          </>
        )}
      </td>
      <td className={`p ${cls}`}>{fmt(price)}</td>
      <td className="qty">
        {side === 'bid' && (
          <>
            <i style={{ width: `${(qty / max) * 100}%` }} />
            <b>{fmt(qty)}</b>
          </>
        )}
      </td>
    </tr>
  );
});

export default function OrderBook({ book, tick }) {
  if (!book) return <div className="empty">호가 불러오는 중…</div>;
  const max = Math.max(...book.asks.map((a) => a.qty), ...book.bids.map((b) => b.qty), 1);
  const base = tick ? tick.price - tick.change : 0; // 전일 종가
  return (
    <table className="book">
      <thead>
        <tr><th>매도잔량</th><th>호가</th><th>매수잔량</th></tr>
      </thead>
      <tbody>
        {[...book.asks].reverse().map((a, i) => (
          <Row key={`a${i}`} side="ask" price={a.price} qty={a.qty} max={max} current={tick?.price} base={base} />
        ))}
        {book.bids.map((b, i) => (
          <Row key={`b${i}`} side="bid" price={b.price} qty={b.qty} max={max} current={tick?.price} base={base} />
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>{fmt(book.total_ask)}</td>
          <td className="muted">총잔량</td>
          <td>{fmt(book.total_bid)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
