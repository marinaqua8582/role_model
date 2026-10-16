import {planRegisteredMigration} from '../../transactional/migration.mjs';

export function planSourceArchive(source){
  if(source?.format!=='role-model-native-sheet-source-v1'||!source.verification?.sourceDoubleReadMatched||!source.verification?.fullSelectionConfirmedByOperator||!source.verification?.noTestRowsExcluded)throw Error('SOURCE_UNVERIFIED');
  const sheets={};
  for(const name of ['Roster','Progress','Tests','Submissions']){
    const a=source.first?.[name]?.projection,b=source.second?.[name]?.projection;
    if(!a||!b||JSON.stringify(a)!==JSON.stringify(b)||!Array.isArray(a.grid)||a.grid.length<1)throw Error('SOURCE_UNVERIFIED');
    sheets[name]=a.grid.map((row,r)=>row.map((display,c)=>{
      const raw=a.richCells?.[r]?.[c]?.metadata?.['data-sheets-value'];
      if(!raw)return display;
      const value=JSON.parse(raw),type=value['1'];
      if(type===2){if(typeof value['2']!=='string')throw Error('CELL_TYPE_UNVERIFIED');return value['2'];}
      if(type===3){
        if(typeof value['3']!=='number'||!Number.isFinite(value['3']))throw Error('CELL_TYPE_UNVERIFIED');
        // Numeric date serials require the source's verified time-zone/format; do not guess.
        if(r>0&&/(At|Date)$/.test(String(a.grid[0][c])))throw Error('DATE_TYPE_REQUIRES_REVIEW');
        return value['3'];
      }
      if(type===4){if(![0,1,true,false].includes(value['4']))throw Error('CELL_TYPE_UNVERIFIED');return Boolean(value['4']);}
      if(display==='')return '';
      throw Error('CELL_TYPE_UNVERIFIED');
    }));
  }
  return planRegisteredMigration({format:'legacy-sheets-registered-v1',sheets},{excludeStudentKeys:['3-1-26','2003-1-26']});
}
