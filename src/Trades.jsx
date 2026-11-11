const signClass = (s) => (s === '1' || s === '2' ? 'up' : s === '4' || s === '5' ? 'down' : '');
const fmtTime = (t) => `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;

// 실시간 체결 내역 (최신순)
export default function Trades({ trades }) {
  if (!trades.length) return <div className="empty">체결이 들어오면 여기에 표시됩니다. (장중에만)</div>;
  return (
    <div className="trades">
      <table>
        <thead>
          <tr><th>시각</th><th>체결가</th><th>체결량</th><th>체결강도</th></tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={`${t.time}-${t.volume}-${i}`}>
              <td>{fmtTime(t.time)}</td>
              <td className={signClass(t.sign)}>{t.price.toLocaleString('ko-KR')}</td>
              <td>{t.tick_volume.toLocaleString('ko-KR')}</td>
              <td>{t.strength?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
