import { spawn } from "child_process";
import http from "http";

function curl(path){
  return new Promise((res,rej)=>{
    http.get("http://localhost:3000"+path,r=>{
      r.statusCode===200?res():rej(new Error("bad "+path));
    }).on("error",rej);
  });
}

const srv=spawn("pnpm",["start"],{stdio:"inherit"});
setTimeout(async()=>{
  try{
    await curl("/");
    await curl("/api/health");
    srv.kill();
    process.exit(0);
  }catch(e){
    srv.kill();
    process.exit(1);
  }
},4000);
