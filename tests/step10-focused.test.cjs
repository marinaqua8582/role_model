const {test}=require('node:test'),assert=require('node:assert/strict');
const {mount,component,writes,textOf,header,renderer}=require('./ui-harness.cjs');
const {act}=renderer;
const done=tree=>act(async()=>tree.unmount());
for(const [field,message] of [['gemUrl','올바른 Gemini'],['barrierAnswer','상담 1'],['barrierReflection','상담 1'],['decisionAnswer','상담 2'],['decisionReflection','상담 2'],['educationAnswer','상담 3'],['educationReflection','상담 3'],['finalCareerReflection','최소 30자']])test(`STEP10 missing ${field}: disabled, specific validation, zero submit requests`,async()=>{
 const {c,tree}=await mount(10),C=component(c,10);
 await act(async()=>tree.root.findByType(C).props.onChange({...tree.root.findByType(C).props.data,[field]:field==='finalCareerReflection'?'짧은 성찰':''}));
 assert.equal(tree.root.findAllByType('button').find(b=>b.props.type==='submit').props.disabled,true);
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.match(textOf(tree.root),new RegExp(message));assert.equal(writes(c).length,0);assert.notEqual(header(c,tree).currentStudent.isFinalSubmitted,true);await done(tree);
});
test('STEP10 deferred acknowledgement and rapid repeated submit: one request, no premature completion',async()=>{
 const {c,tree}=await mount(10),original=c.api.submitFinal;let release;const hold=new Promise(r=>release=r);let calls=0;
 c.api.submitFinal=async(...args)=>{calls++;await hold;return original(...args);};
 const submit=tree.root.findByType('form').props.onSubmit;let first,second;
 await act(async()=>{first=submit({preventDefault(){}});second=submit({preventDefault(){}});});
 assert.equal(calls,1);assert.equal(tree.root.findAllByType('button').find(b=>b.props.type==='submit').props.disabled,true);assert.notEqual(header(c,tree).currentStudent.isFinalSubmitted,true);assert.ok(!textOf(tree.root).includes('진로 상담 및 최종 제출이 완료되었습니다!'));
 await act(async()=>{release();await Promise.all([first,second]);});assert.equal(writes(c).filter(p=>p.action==='submitFinal').length,1);assert.equal(header(c,tree).currentStudent.isFinalSubmitted,true);assert.ok(textOf(tree.root).includes('진로 상담 및 최종 제출이 완료되었습니다!'));await done(tree);
});
test('STEP10 rejected save keeps entered data and never displays completion',async()=>{
 const {c,tree}=await mount(10),C=component(c,10),before=JSON.stringify(tree.root.findByType(C).props.data);c.api.submitFinal=async()=>({success:false,message:'검증용 서버 거절'});
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.notEqual(header(c,tree).currentStudent.isFinalSubmitted,true);assert.equal(JSON.stringify(tree.root.findByType(C).props.data),before);assert.match(textOf(tree.root),/검증용 서버 거절/);assert.ok(!textOf(tree.root).includes('진로 상담 및 최종 제출이 완료되었습니다!'));await done(tree);
});
for(const completed of [false,true])test(`STEP10 receipt-confirmed server completion updates the existing screen without re-login (previously submitted ${completed})`,async()=>{
 const {c,tree}=await mount(10,{completed}),original=c.api.submitFinal;
 if(completed){await act(async()=>tree.root.findAllByType('button').find(b=>textOf(b)==='제출 내용 수정하기').props.onClick());assert.equal(tree.root.findAllByType('form').length,1);}
 c.api.submitFinal=async(...args)=>{const result=await original(...args);assert.equal(result.success,true);c.api.isSaveOutcomeUnknown=()=>true;c.api.hasUncertainSave=()=>true;c.api.isStudentSaving=()=>true;return {success:false,message:'저장 결과를 확인할 수 없습니다.'};};
 c.api.confirmPendingSave=async()=>{c.api.isSaveOutcomeUnknown=()=>false;c.api.hasUncertainSave=()=>false;c.api.isStudentSaving=()=>false;return {state:'completed'};};
 await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});c.window.dispatchEvent({type:'student-save-state'});});
 assert.ok(!textOf(tree.root).includes('진로 상담 및 최종 제출이 완료되었습니다!'));
 await act(async()=>tree.root.findAllByType('button').find(b=>textOf(b)==='저장 결과 확인').props.onClick());
 assert.equal(header(c,tree).currentStudent.isFinalSubmitted,true);
 try{assert.ok(textOf(tree.root).includes('진로 상담 및 최종 제출이 완료되었습니다!'));assert.equal(writes(c).filter(p=>p.action==='submitFinal').length,1);}finally{await done(tree);}
});
test('STEP10 completed submission can still be edited without a server state change',async()=>{
 const {c,tree}=await mount(10,{completed:true}),C=component(c,10);await act(async()=>tree.root.findAllByType('button').find(b=>textOf(b)==='제출 내용 수정하기').props.onClick());
 await act(async()=>tree.root.findByType(C).props.onChange({...tree.root.findByType(C).props.data,revisionSummary:'검증용 수정'}));
 assert.equal(tree.root.findAllByType('form').length,1);assert.equal(writes(c).length,0);assert.ok(!textOf(tree.root).includes('진로 상담 및 최종 제출이 완료되었습니다!'));await done(tree);
});
