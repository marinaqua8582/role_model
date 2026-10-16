function targetFromEnvironment() {
  const value=process.env.PERF_TARGET_URL;
  if(!value)throw Error('PERF_TARGET_URL must explicitly identify the local mock URL');
  const url=new URL(value);
  // DNS names, HTTPS, credentials and production addresses are all rejected.
  if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')
    throw Error('Only an explicit loopback HTTP mock target is permitted');
  return url;
}
module.exports={targetFromEnvironment};
