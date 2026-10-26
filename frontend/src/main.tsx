import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import BuildingsPage from './pages/BuildingsPage';
import InterventionsPage from './pages/InterventionsPage';
import ScenarioBuilder from './pages/ScenarioBuilder';
import ResultPage from './pages/ResultPage';
import ComparePage from './pages/ComparePage';
import ImportPage from './pages/ImportPage';
import SensitivityPage from './pages/SensitivityPage';
import { AppShell } from './components/shell/AppShell';
import { ToastProvider } from './components/ui/Toast';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components-structure.css';
import './styles/components-controls.css';
import './styles/components-data.css';
import './styles/components-feedback.css';
import './styles/components-content.css';
import './styles/components-responsive.css';
import './styles/charts.css';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/buildings" element={<BuildingsPage />} />
            <Route path="/interventions" element={<InterventionsPage />} />
            <Route path="/scenario" element={<ScenarioBuilder />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/sensitivity" element={<SensitivityPage />} />
            <Route path="/import" element={<ImportPage />} />
          </Routes>
        </AppShell>
      </ToastProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
