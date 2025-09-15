import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const r = useRouter();
  const active = (href: string) => r.pathname.startsWith(href) ? 'nav-link active' : 'nav-link';
  return (
    <div>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand">StructX</Link>
          <div className="nav-links">
            <Link href="/projects" className={active('/projects')}>Projects</Link>
            <Link href="/workflows" className={active('/workflows')}>Workflows</Link>
            <Link href="/settings" className={active('/settings')}>Settings</Link>
          </div>
        </div>
      </nav>
      <main className="container">
        {children}
      </main>
    </div>
  );
}

