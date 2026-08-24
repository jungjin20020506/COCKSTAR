import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/tutorial.css';
import App from './App.jsx';
import { initErrorTracking } from './lib/errorLog';

// 잡히지 않은 오류를 기기에 남긴다 (문의 메일에 자동으로 붙는다).
// 화면을 그리기 전에 켜야 초기 로딩 중 오류도 잡힌다.
initErrorTracking();

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
