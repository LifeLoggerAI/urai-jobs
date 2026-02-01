export default function JobPage({ params }: { params: { jobId: string } }) {
  return (
    <main>
      <h1>Job: {params.jobId}</h1>
    </main>
  );
}
