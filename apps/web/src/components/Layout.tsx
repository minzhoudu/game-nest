import { Link } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDashboardSocket } from '../hooks/useDashboardSocket';
import { NodesBar } from './NodesBar';

/** Only ever rendered inside RequireAuth, so useDashboardSocket() here only runs for a logged-in session. */
export function Layout() {
  useDashboardSocket();
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          <h1>GameNest</h1>
        </Link>
        <div className="app-header-right">
          <NodesBar />
          {user && (
            <div className="user-menu">
              <span className="muted">{user.email}</span>
              <button type="button" className="ghost" onClick={logout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
