const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function client(target,state,fetchImpl=fetch){
  const storage=new Map(),modules=new Map();
  const context=vm.createContext({
    AbortSignal,setTimeout,clearTimeout,console:{log(){},warn(){},error(){}},
    window:{dispatchEvent(){}},Event:class{constructor(type){this.type=type;}},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    sessionStorage:{getItem:()=>null,removeItem(){}},
    fetch:async(url,options)=>{assert.equal(url,'/api/gas-proxy');state.apiCalls++;return fetchImpl(new URL(url,target),options);},
  });
  function load(file){
    const p=path.resolve(__dirname,'..',file);if(modules.has(p))return modules.get(p).exports;
    const source=fs.readFileSync(p,'utf8').replaceAll('import.meta','({env:{}})');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const module={exports:{}};modules.set(p,module);
    vm.runInContext('(function(require,module,exports){'+compiled+'\n})',context)(specifier=>{
      assert.ok(specifier.startsWith('.'));
      const dependency=path.resolve(path.dirname(p),specifier)+'.ts';
      return load(path.relative(path.resolve(__dirname,'..'),dependency));
    },module,module.exports);return module.exports;
  }
  return load('src/api/client.ts');
}

module.exports={client};
