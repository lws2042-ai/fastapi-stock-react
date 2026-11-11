import { useEffect, useState } from 'react';
import { realtimeUrl } from './api.js';

const FLUSH_MS = 250; // 화면 갱신 주기 (초당 4회). 체결마다 다시 그리지 않는다.
const MAX_TRADES = 30;

/**
 * 서버 WebSocket(/ws/stocks/{code})에서 실시간 체결(tick)·호가(book)를 받는다.
 * 메시지는 ref 성격의 버퍼에 쌓아 두고 FLUSH_MS마다 한 번만 setState → 렌더링 횟수를 제한.
 */
export function useRealtime(code) {
  const [state, setState] = useState({ code: null, status: 'connecting', tick: null, book: null, trades: [], error: '' });

  useEffect(() => {
    const buf = { code, status: 'connecting', tick: null, book: null, trades: [], error: '' };
    let dirty = false;
    let ws = null;
    let retryTimer = null;
    let retry = 0;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(realtimeUrl(code));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === 'tick') {
          buf.tick = m;
          if (!m.snapshot) buf.trades = [m, ...buf.trades].slice(0, MAX_TRADES);
        } else if (m.type === 'book') {
          buf.book = m;
        } else if (m.type === 'status') {
          buf.status = m.state;
          buf.error = m.state === 'error' ? m.message : '';
          if (m.state === 'live') retry = 0;
        }
        dirty = true;
      };
      ws.onclose = () => {
        if (closed) return;
        buf.status = 'reconnecting';
        dirty = true;
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
      };
    };
    connect();

    const flush = setInterval(() => {
      if (!dirty) return;
      dirty = false;
      setState({ ...buf });
    }, FLUSH_MS);

    return () => {
      closed = true;
      clearInterval(flush);
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [code]);

  // 종목을 바꾼 직후에는 이전 종목 데이터를 보여주지 않는다
  return state.code === code ? state : { code, status: 'connecting', tick: null, book: null, trades: [], error: '' };
}
