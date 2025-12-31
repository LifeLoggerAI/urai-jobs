import { useParams } from 'react-router-dom';

function Apply() {
  const { jobId } = useParams();
  return <h1>Apply for {jobId}</h1>;
}

export default Apply;
