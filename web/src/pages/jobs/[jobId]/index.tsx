import { getJob } from "@/lib/jobs";
import { Job } from "@/types/Job";
import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";

interface JobPageProps {
  job: Job | null;
}

export default function JobPage({ job }: JobPageProps) {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div>
      <h1>{job.title}</h1>
      <h2>{job.company}</h2>
      <p>{job.description}</p>
      <Link href={`/jobs/${job.id}/edit`}>Edit Job</Link>
      <br />
      <Link href={`/jobs/${job.id}/apply`}>Apply for this Job</Link>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { jobId } = context.params!;
  const job = await getJob(jobId as string);
  return {
    props: {
      job,
    },
  };
};
