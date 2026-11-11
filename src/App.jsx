import { useEffect, useState } from 'react';
import Home from './Home.jsx';
import { NAMES } from './names.js';
import StockDetail from './StockDetail.jsx';

// 주소 해시로 화면을 고른다:  #/  → 순위(메인),  #/stock/005930 → 종목 상세
// 해시를 쓰면 서버 설정 없이 새로고침·뒤로가기·주소 공유가 모두 된다.
const parse = () => location.hash.match(/^#\/stock\/(\d{6})$/)?.[1] ?? null;

function App() {
  const [code, setCode] = useState(parse);

  useEffect(() => {
    const onHash = () => {
      setCode(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const open = (c, name) => {
    if (name) NAMES.set(c, name);
    location.hash = `#/stock/${c}`;
  };
  const back = () => {
    location.hash = '#/';
  };

  if (code) return <StockDetail key={code} code={code} onBack={back} onSelect={open} />;
  return <Home onSelect={open} />;
}

export default App;
