import ProductStory from '../components/story/ProductStory.jsx';
import About from '../components/sections/About.jsx';
import Solutions from '../components/sections/Solutions.jsx';
import Software from '../components/sections/Software.jsx';
import { Advantages, Services, Support } from '../components/sections/Services.jsx';
import CtaBand from '../components/sections/CtaBand.jsx';
import Pricing from '../components/sections/Pricing.jsx';
import Faq from '../components/sections/Faq.jsx';
import Contact from '../components/sections/Contact.jsx';
import '../components/ui/ui.css';
import '../components/sections/sections.css';

/**
 * Главная: интерактивная продуктовая история и следом обычная часть сайта.
 * Порядок продуман как маршрут читателя: что это → какие продукты → чем
 * управляется → кто внедряет и поддерживает → сколько стоит → как начать.
 */
export default function Home() {
  return (
    <>
      <ProductStory />
      <About />
      <Solutions />
      <Software />
      <Services />
      <Support />
      <CtaBand />
      <Advantages />
      <Pricing />
      <Faq />
      <Contact />
    </>
  );
}
