import { Route, Routes } from 'react-router-dom';
import './App.css';
import { Layout } from './components/Layout';
import { useDashboardSocket } from './hooks/useDashboardSocket';
import { CreateServerPage } from './pages/CreateServerPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { ServerLogsPage } from './pages/ServerLogsPage';
import { ServersPage } from './pages/ServersPage';

function App() {
  useDashboardSocket();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ServersPage />} />
        <Route path="servers/new" element={<CreateServerPage />} />
        <Route path="servers/:id" element={<ServerDetailPage />} />
        <Route path="servers/:id/logs" element={<ServerLogsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
