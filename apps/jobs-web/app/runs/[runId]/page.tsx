export default function RunPage({ params }: { params: { runId: string } }) {
  return (
    <main>
      <h1>Run: {params.runId}</h1>
    </main>
  );
}
