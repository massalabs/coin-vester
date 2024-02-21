import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import SendPage from './pages/SendPage';
import HomePage from './pages/HomePage';
import { Toast } from '@massalabs/react-ui-kit';
import { STORAGE_KEY_THEME } from './const/const';

function App() {
  return (
    <Router>
      <Toast storageKey={STORAGE_KEY_THEME} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/send" element={<SendPage />} />
      </Routes>
    </Router>
  );
}

export default App;
