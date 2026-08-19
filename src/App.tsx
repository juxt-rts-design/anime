import { Routes, Route } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import Planning from './pages/Planning';
import AnimeDetail from './pages/AnimeDetail';
import AnimeFind from './pages/AnimeFind';
import Home from './pages/Home';
import Search from './pages/Search';
import Watch from './pages/Watch';

export default function App() {
  return (
    <div className="app flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pt-[calc(64px+env(safe-area-inset-top,0px))] lg:pt-[calc(76px+env(safe-area-inset-top,0px))]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/anime/find" element={<AnimeFind />} />
          <Route path="/anime/:id" element={<AnimeDetail />} />
          <Route path="/watch/:id" element={<Watch />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
