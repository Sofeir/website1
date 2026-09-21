import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { prefersReducedMotion } from './lib/scroll.js';
import './styles/base.css';

// Решение о режиме движения принимается один раз и до первой отрисовки,
// чтобы CSS и сцена одинаково понимали, что происходит.
document.documentElement.dataset.motion = prefersReducedMotion() ? 'reduced' : 'full';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
