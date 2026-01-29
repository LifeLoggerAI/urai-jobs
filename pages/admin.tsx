export default function Admin(){
  const allow=(process.env.ADMIN_EMAILS||"").split(",").filter(Boolean);
  if(!allow.length){
    return <div style={{padding:24}}>Access restricted</div>;
  }
  return <div style={{padding:24}}>Admin</div>;
}
