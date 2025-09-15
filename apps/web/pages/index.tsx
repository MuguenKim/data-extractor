import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Structured Data Extractor</h1>
      <ul>
        <li><Link href="/projects">Projects</Link></li>
      </ul>
      <p>Flow: Create project → Ingest → Choose Format → Extract → View Results.</p>
    </main>
  );
}

