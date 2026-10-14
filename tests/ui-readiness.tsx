// Local component harness only: no API, credentials, or production data.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AdminStudentDetailModal} from '../src/components/admin/AdminStudentDetailModal';
import {AdminPrintView} from '../src/components/admin/AdminPrintView';
import '../src/index.css';
const long=Array.from({length:80},(_,i)=>`합성 긴 답안 ${i+1}: 진로 상담과 페이지 분할을 확인합니다.`).join('\n');
const students=Array.from({length:25},(_,i)=>({grade:3,classNum:1,number:i+1,name:`합성학생${i+1}`,studentKey:`3-1-${i+1}`,googleId:`synthetic${i+1}@example.invalid`,currentStep:10,isFinalSubmitted:true,isTestCompleted:true,step1:{roleModelName:'합성 멘토',roleModelJob:'합성 연구자'},step2:{chatbotPurposes:[]},step3:{personalityTraits:[]},step4:{},step5:{},step6:{chatbotName:'합성 긴 문서',finalPrompt:i===0?long+'\n프롬프트끝':'합성 짧은 프롬프트 '+(i+1)},step8:{tests:{}},step9:{},step10:{gemUrl:'https://example.invalid',barrierAnswer:i===0?long+'\n상담끝':'합성 짧은 상담 '+(i+1),finalCareerReflection:i===0?long+'\n성찰끝':'합성 짧은 성찰 '+(i+1)}})) as any;
function Harness(){const [view,setView]=useState('detail'),[preview,setPreview]=useState(false);return view.startsWith('print')?<AdminPrintView studentsToPrint={view==='print25'?students:[students[0]]} onBack={()=>setView('home')}/>:<><nav><button onClick={()=>setView('detail')}>상세 열기</button><button onClick={()=>setView('print1')}>학생 인쇄</button><button onClick={()=>setView('print25')}>학급 인쇄</button></nav><p>{preview?'학생 미리보기 동작 확인':'로컬 합성 검증'}</p>{view==='detail'&&<AdminStudentDetailModal student={students[0]} onClose={()=>setView('home')} onPreviewStudentMode={()=>setPreview(true)} onPrintStudent={()=>setView('print1')}/>}</>}
createRoot(document.getElementById('root')!).render(<Harness/>);
