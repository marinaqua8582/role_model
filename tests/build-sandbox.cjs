// Equivalent production bundle verification when native child processes are blocked.
// Normal deployments should continue to use "npm run build".
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
global.self=global;
const wasm=require('esbuild-wasm/lib/browser.js');
(async()=>{
  const module=await WebAssembly.compile(fs.readFileSync(require.resolve('esbuild-wasm/esbuild.wasm')));
  await wasm.initialize({wasmModule:module,worker:false});
  const nativePath=require.resolve('esbuild');
  require.cache[nativePath]={id:nativePath,filename:nativePath,loaded:true,exports:wasm};
  process.chdir(root);
  try {
    const {build}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')).href);
    const react=(await import(pathToFileURL(path.join(root,'node_modules/@vitejs/plugin-react/dist/index.js')).href)).default;
    const tailwind=(await import(pathToFileURL(path.join(root,'node_modules/@tailwindcss/vite/dist/index.mjs')).href)).default;
    // Express configureServer is dev-only. This workspace has no symlinks.
    await build({configFile:false,root,plugins:[react(),tailwind()],resolve:{alias:{'@':root},preserveSymlinks:true}});
    const assets=fs.readdirSync(path.join(root,'dist/assets')).filter(n=>n.endsWith('.js'));
    const code=assets.map(n=>fs.readFileSync(path.join(root,'dist/assets',n),'utf8')).join('\n');
    if(/AKfy|a@example\.invalid|b@example\.invalid|mock\d+@example\.invalid|가상학생/.test(code))throw Error('Forbidden deployment URL or synthetic fixture in bundle');
    if(!fs.readFileSync(path.join(root,'dist/index.html'),'utf8').includes('translate="no"'))throw Error('Translation protection is missing');
    console.log('BUNDLE_CHECK: fixture/deployment URL absent; translation protection present');
  } finally {await wasm.stop();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
