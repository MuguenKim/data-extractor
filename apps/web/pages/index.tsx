import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>LangExtract Demo</h1>
      <ul>
        <li><Link href="/workflows">Workflows</Link></li>
      </ul>
    </main>
  );
}

