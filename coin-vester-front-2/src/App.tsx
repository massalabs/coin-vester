import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import SendPage from './pages/SendPage';
import HomePage from './pages/HomePage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/send" element={<SendPage />} />
      </Routes>
    </Router>
  );
}

export default App;
