import Link from "next/link";

export default function Home() {
  return (
    <main id="main" className="p-10">
      <Link href="/app">Open app</Link>
    </main>
  );
}
