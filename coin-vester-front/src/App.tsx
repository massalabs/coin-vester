import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from 'react-router-dom';

import { Toast } from '@massalabs/react-ui-kit';

import HomePage from './pages/HomePage';
import LegacyPage from './pages/LegacyPage';
import SendPage from './pages/SendPage';
import ByAddressPage from './pages/ByAddressPage';

function App() {
  return (
    <Router>
      <Toast />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/legacy" element={<LegacyPage />} />
        <Route path="/address" element={<ByAddressPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
