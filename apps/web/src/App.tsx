import { Route, Routes } from 'react-router-dom';
import './App.css';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { CreateServerPage } from './pages/CreateServerPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ServerDetailPage } from './pages/ServerDetailPage';
import { ServerLogsPage } from './pages/ServerLogsPage';
import { ServersPage } from './pages/ServersPage';
import { SignupPage } from './pages/SignupPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<ServersPage />} />
          <Route path="servers/new" element={<CreateServerPage />} />
          <Route path="servers/:id" element={<ServerDetailPage />} />
          <Route path="servers/:id/logs" element={<ServerLogsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
