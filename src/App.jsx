import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Footer from './components/layout/Footer.jsx';
import Cursor from './components/layout/Cursor.jsx';
import Home from './pages/Home.jsx';
import ProductPage from './pages/ProductPage.jsx';
import NotFound from './pages/NotFound.jsx';
import { scrollTo, startSmoothScroll, stopSmoothScroll } from './lib/scroll.js';

/** Переход между маршрутами: новая страница всегда начинается сверху, якорь — от якоря. */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Секция может появиться на кадр позже монтирования маршрута.
      const id = window.requestAnimationFrame(() => scrollTo(hash, { duration: 1 }));
      return () => window.cancelAnimationFrame(id);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [pathname, hash]);

  return null;
}

export default function App() {
  useEffect(() => {
    startSmoothScroll();
    return stopSmoothScroll;
  }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержанию
      </a>
      <Cursor />
      <Header />
      <ScrollManager />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products/:productId" element={<ProductPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
