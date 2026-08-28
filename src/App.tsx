import { Route, Routes, useLocation } from 'react-router-dom';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { TitleModalProvider } from './context/TitleModalContext';
import Planning from './pages/Planning';
import AnimeDetail from './pages/AnimeDetail';
import AnimeFind from './pages/AnimeFind';
import HistoryPage from './pages/HistoryPage';
import Home from './pages/Home';
import MyList from './pages/MyList';
import Search from './pages/Search';
import BrowsePage from './pages/BrowsePage';
import Watch from './pages/Watch';

export default function App() {
  const location = useLocation();
  const watch = location.pathname.startsWith('/watch');

  return (
    <TitleModalProvider>
      <div className={`app flex min-h-screen flex-col ${watch ? 'is-watch' : ''}`}>
        {!watch && <Navbar />}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/liste" element={<MyList />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/search" element={<Search />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/anime/find" element={<AnimeFind />} />
            <Route path="/anime/:id" element={<AnimeDetail />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/watch/:id" element={<Watch />} />
          </Routes>
        </main>
        {!watch && <Footer />}
      </div>
    </TitleModalProvider>
  );
}
