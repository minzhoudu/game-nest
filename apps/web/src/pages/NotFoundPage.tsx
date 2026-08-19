import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section>
      <p className="muted">Page not found.</p>
      <Link to="/">← Back to servers</Link>
    </section>
  );
}
