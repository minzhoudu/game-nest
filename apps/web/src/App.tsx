import './App.css';
import { NodesBar } from './components/NodesBar';
import { ServerList } from './components/ServerList';
import { useDashboardSocket } from './hooks/useDashboardSocket';

function App() {
  useDashboardSocket();

  return (
    <div className="app">
      <header className="app-header">
        <h1>GameNest</h1>
        <NodesBar />
      </header>
      <main>
        <ServerList />
      </main>
    </div>
  );
}

export default App;
