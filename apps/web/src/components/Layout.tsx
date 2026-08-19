import { Link, Outlet } from 'react-router-dom';
import { NodesBar } from './NodesBar';

export function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          <h1>GameNest</h1>
        </Link>
        <NodesBar />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
