import { useParams } from 'react-router-dom';

function Referral() {
  const { code } = useParams();

  return <h2>Referral code: {code}</h2>;
}

export default Referral;
