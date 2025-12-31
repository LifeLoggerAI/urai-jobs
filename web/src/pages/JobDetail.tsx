import { useParams } from 'react-router-dom';

function JobDetail() {
  const { jobId } = useParams();
  return <h1>Job Detail for {jobId}</h1>;
}

export default JobDetail;
