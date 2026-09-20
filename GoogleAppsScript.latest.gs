/**
 * 나의 롤모델 챗봇 만들기 - Google Apps Script 백엔드
 * 
 * [시트 구성 안내]
 * 1. Roster: grade, class, number, name
 * 2. Progress: studentKey, grade, class, number, name, currentStep, roleModelName, roleModelJob, roleModelReason, jobDescription, competencies, careerHistory, strengths, values, challengeExperience, chatbotPurposes, targetUser, expectedOutcome, personality, speakingStyle, honorificStyle, desiredFeeling, answerLength, answerElements, chatbotName, initialPrompt, revisedPrompt, finalPrompt, createdAt, updatedAt
 * 3. Tests: studentKey, test1Result, test2Result, test3Result, test4Result, test5Result, test6Result, problemDescription, revisionNote, testedAt
 * 4. Submissions: studentKey, grade, class, number, name, roleModelName, roleModelJob, chatbotName, finalPrompt, gemUrl, sampleQuestion1, sampleAnswer1, sampleQuestion2, sampleAnswer2, sampleQuestion3, sampleAnswer3, revisionSummary, reflection, submittedAt
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = null;
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    var params = {};
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }
    
    var action = params.action || (e.parameter && e.parameter.action);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (action !== 'getRosterOptions' && action !== 'checkAdminConfig') {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) throw new Error('저장 요청이 많습니다. 잠시 후 다시 저장해 주세요.');
    }
    initSheetsIfNeeded(ss);
    if (['loadProgress', 'getProgress', 'saveProgress', 'saveTests', 'updateRevision', 'submitFinal', 'submitCounseling', 'resetStudentData'].indexOf(action) !== -1) {
      authorizeStudent_(ss, params);
    }

    
    // Validate admin secret for privileged teacher/admin actions
    if (
      action === 'checkAdminConfig' ||
      action === 'getAdminDashboard' ||
      action === 'getStudentDetail' ||
      action === 'updateRoster' ||
      action === 'deleteRosterStudents' ||
      action === 'getAllProgress'
    ) {
      if (!isValidAdminRequest_(params)) {
        output.setContent(JSON.stringify({
          success: false,
          message: '관리자 권한이 없습니다. (ADMIN_API_SECRET 불일치)'
        }));
        return output;
      }
    }

    var result = { success: true };
    
    if (action === 'logoutStudent') {
      CacheService.getScriptCache().remove('student:' + String(params.studentToken || ''));
      result = {success:true};
    } else if (action === 'checkAdminConfig') {
      result = {success:true};
    } else if (action === 'verifyStudent') {
      result = verifyStudent(ss, params);
    } else if (action === 'getRosterOptions') {
      result = getRosterOptions(ss);
    } else if (action === 'getAdminDashboard') {
      result = getAdminDashboard(ss);
    } else if (action === 'getStudentDetail') {
      result = getStudentDetail(ss, params.studentKey);
    } else if (action === 'getProgress' || action === 'loadProgress') {
      result = loadProgress(ss, params.studentKey);
    } else if (action === 'saveProgress') {
      result = saveProgress(ss, params.progress || params);
    } else if (action === 'resetStudentData') {
      result = resetStudentData(ss, params);
    } else if (action === 'saveTests') {
      result = saveTests(ss, params.tests || params);
    } else if (action === 'updateRevision') {
      result = updateRevision(ss, params);
    } else if (action === 'submitFinal') {
      result = submitFinal(ss, params.submission || params);
    } else if (action === 'submitCounseling') {
      result = submitCounseling(ss, params.counseling || params);
    } else if (action === 'getAllProgress') {
      result = getAllProgress(ss);
    } else if (action === 'updateRoster') {
      var rosterData = params.students || params.roster || params.data || [];
      result = updateRoster(ss, rosterData, params.mode || 'replace');
    } else if (action === 'deleteRosterStudents') {
      var studentsToDelete = params.students || [];
      result = deleteRosterStudents(ss, studentsToDelete);
    } else {
      result = { success: false, message: '알 수 없는 요청입니다: ' + action };
    }
    
    if (result.success && ['saveProgress','saveTests','updateRevision','submitFinal','submitCounseling'].indexOf(action) !== -1) {
      var body = params.progress || params.submission || params.counseling || params.tests || params;
      var affected = action === 'saveProgress' ? ['Progress'] : action === 'saveTests' ? ['Tests'] : action === 'updateRevision' ? ['Progress','Tests'] : action === 'submitFinal' ? ['Submissions'] : ['Counseling'];
      affected.forEach(function(name) {
        var sheet = ss.getSheetByName(name), selected = sheet && selectStudentRow_(sheet, body.studentKey);
        if (selected) recordOwner_(sheet, selected.index, body);
      });
    }
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, message: err.message || err.toString() }));
  } finally {
    if (lock && lock.hasLock()) {
      try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
    }
  }
  
  return output;
}


function studentKey_(value) {
  var parts = typeof value === 'object' ? [value.grade, value.classNum || value.classNo || value.class, value.number] : String(value || '').split('-');
  if (parts.length !== 3) throw new Error('학년, 반, 번호를 확인해 주세요.');
  parts = parts.map(function(v) { return Number(String(v || '').normalize('NFKC').trim()); });
  if (parts.some(function(v) { return !Number.isInteger(v) || v <= 0; })) throw new Error('학년, 반, 번호를 확인해 주세요.');
  return parts.join('-');
}

function objectJson_(value) {
  try { var parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch (err) { return {}; }
}

// Pick the newest valid row; fill missing cells from older rows of the same identity.
// Never delete duplicates or rewrite the other rows.
function selectStudentRow_(sheet, key) {
  var data = readTable_(sheet);
  var headers = data[0] || [];
  var map = getHeaderMap(sheet);
  var matches = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (isUnownedLegacyTest_(sheet, row, map)) continue;
    var rowKey;
    try { rowKey = studentKey_(getValByHeader(row, map, ['studentKey', 'student_key', 'key']) || row[0]); }
    catch (err) {
      try { rowKey = studentKey_({ grade: getValByHeader(row, map, ['grade', '학년']), classNum: getValByHeader(row, map, ['class', 'classNum', '반']), number: getValByHeader(row, map, ['number', '번호']) }); }
      catch (ignored) { continue; }
    }
    if (rowKey !== key) continue;
    var time = new Date(getValByHeader(row, map, ['updatedAt', 'testedAt', 'submittedAt', 'createdAt']) || 0).getTime();
    matches.push({ row: row, index: i + 1, time: isNaN(time) ? 0 : time });
  }
  matches.sort(function(a, b) { return b.time - a.time || b.index - a.index; });
  if (!matches.length) return null;
  var selected = matches[0];
  var merged = selected.row.slice();
  var explicit = objectJson_(getValByHeader(merged, map, ['writtenFields'])).fields || [];
  var name = String(getValByHeader(merged, map, ['name', '이름']) || '').normalize('NFC').replace(/\s+/g, '');
  var gid = String(getValByHeader(merged, map, ['googleId']) || '').trim().toLowerCase();
  matches.slice(1).forEach(function(entry) {
    var otherName = String(getValByHeader(entry.row, map, ['name', '이름']) || '').normalize('NFC').replace(/\s+/g, '');
    var otherGid = String(getValByHeader(entry.row, map, ['googleId']) || '').trim().toLowerCase();
    if ((name && otherName && name !== otherName) || (gid && otherGid && gid !== otherGid)) return;
    for (var col = 0; col < headers.length; col++) {
      if (headers[col] === 'stepData') {
        merged[col] = JSON.stringify(Object.assign({}, objectJson_(entry.row[col]), objectJson_(merged[col])));
      } else if (explicit.indexOf(headerName_(headers[col])) === -1 && (merged[col] === '' || merged[col] === null || merged[col] === undefined)) merged[col] = entry.row[col];
      else if (headers[col] === 'currentStep') merged[col] = Math.max(Number(merged[col]) || 1, Number(entry.row[col]) || 1);
    }
  });
  merged[0] = key;
  return { index: selected.index, row: merged };
}

function studentRowsForRead_(sheet, key) {
  var selected = selectStudentRow_(sheet, key);
  return selected ? [readTable_(sheet)[0], selected.row] : [readTable_(sheet)[0]];
}

function writeExtraJson_(sheet, rowIndex, header, value) {
  var patch = {}; patch[header] = JSON.stringify(value);
  writePatch_(sheet, rowIndex, patch);
}

function issueStudentToken_(student) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('student:' + token, JSON.stringify(student), 21600);
  return token;
}

function authorizeStudent_(ss, params) {
  var raw = CacheService.getScriptCache().get('student:' + String(params.studentToken || ''));
  if (!raw) throw new Error('학생 세션이 만료되었습니다. 다시 로그인해 주세요.');
  var student = JSON.parse(raw);
  var payload = params.progress || params.submission || params.counseling || params.tests || params;
  var key = studentKey_(payload.studentKey || payload);
  if (key !== student.studentKey) throw new Error('본인의 자료만 조회하거나 저장할 수 있습니다.');
  // Roster changes invalidate a previous occupant's session without changing the login form.
  var sheet = ss.getSheetByName('Roster');
  var data = readTable_(sheet);
  var map = getHeaderMap(sheet);
  var valid = data.slice(1).some(function(row) {
    var rowKey;
    try { rowKey = studentKey_({grade: getValByHeader(row, map, ['grade', '학년']), classNum: getValByHeader(row, map, ['class', 'classNum', 'classNo', '반']), number: getValByHeader(row, map, ['number', '번호'])}); }
    catch (err) { return false; }
    var name = String(getValByHeader(row, map, ['name', '이름']) || '').normalize('NFC').replace(/\s+/g, '');
    var gid = String(getValByHeader(row, map, ['googleId', 'google_id', 'google id', 'googleid', '구글아이디', '구글id', '구글 id', '이메일', 'email', 'google', '계정', '아이디']) || row[4] || '').trim();
    return rowKey === key && name === student.name.normalize('NFC').replace(/\s+/g, '') && gid === student.googleId;
  });
  if (!valid) throw new Error('학생 명단이 변경되었습니다. 다시 로그인해 주세요.');
  assertStudentOwnsRows_(ss, student);
  payload.studentKey = key;
  payload.grade = student.grade; payload.classNum = student.classNum; payload.class = student.classNum;
  payload.number = student.number; payload.name = student.name; payload.googleId = student.googleId;
  return student;
}

// The legacy presentation code consumes a canonical logical table. Only these
// helpers touch physical cells: columns are resolved by header, never position.
function schemas_() {
  return {
    'Roster': ['grade', 'class', 'number', 'name', 'googleId'],
    'Progress': ['studentKey', 'grade', 'class', 'number', 'name', 'currentStep', 'roleModelName', 'roleModelJob', 'roleModelReason', 'jobDescription', 'competencies', 'careerHistory', 'strengths', 'values', 'challengeExperience', 'chatbotPurposes', 'targetUser', 'expectedOutcome', 'personality', 'speakingStyle', 'honorificStyle', 'desiredFeeling', 'answerLength', 'answerElements', 'chatbotName', 'initialPrompt', 'revisedPrompt', 'finalPrompt', 'createdAt', 'updatedAt', 'googleId'],
    'Tests': ['studentKey', 'test1Result', 'test2Result', 'test3Result', 'test4Result', 'test5Result', 'test6Result', 'problemDescription', 'revisionNote', 'testedAt'],
    'Submissions': ['studentKey', 'grade', 'class', 'number', 'name', 'roleModelName', 'roleModelJob', 'chatbotName', 'finalPrompt', 'gemUrl', 'barrierAnswer', 'barrierReflection', 'decisionAnswer', 'decisionReflection', 'educationAnswer', 'educationReflection', 'finalCareerReflection', 'revisionSummary', 'submittedAt']
  ,
    'Counseling': ['studentKey','grade','class','number','name','roleModelName','roleModelJob','chatbotName','gemUrl','barrierAnswer','barrierReflection','decisionAnswer','decisionReflection','educationAnswer','educationReflection','finalCareerReflection','completedAt']
  };
}
function headerName_(name) {
  var norm = String(name || '').trim().toLowerCase().replace(/[\s_.:/-]+/g, '');
  var aliases = {
    '학년':'grade', 'classnum':'class', 'classno':'class', '반':'class',
    'num':'number','studentnumber':'number','번호':'number','이름':'name',
    'key':'studentkey','googleid':'googleid','email':'googleid','이메일':'googleid',
    '구글아이디':'googleid','구글id':'googleid','구글계정':'googleid','google':'googleid','계정':'googleid','아이디':'googleid',
    'rolemodel':'rolemodelname','롤모델이름':'rolemodelname','롤모델':'rolemodelname',
    'job':'rolemodeljob','롤모델직업':'rolemodeljob','직업':'rolemodeljob','reason':'rolemodelreason',
    'personalities':'personality','botname':'chatbotname','챗봇이름':'chatbotname','챗봇명':'chatbotname',
    'gemlink':'gemurl','gem링크':'gemurl','챗봇링크':'gemurl',
    'samplequestion1':'barrieranswer','sampleanswer1':'barrierreflection',
    'samplequestion2':'decisionanswer','sampleanswer2':'decisionreflection',
    'samplequestion3':'educationanswer','sampleanswer3':'educationreflection','reflection':'finalcareerreflection',
    'test1':'test1result','test2':'test2result','test3':'test3result',
    'test4':'test4result','test5':'test5result','test6':'test6result'
  };
  return aliases[norm] || norm;
}
function physicalHeaders_(sheet) {
  return sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
}
function logicalHeaders_(sheet) {
  var names = (schemas_()[sheet.getName()] || []).slice();
  physicalHeaders_(sheet).forEach(function(header) {
    if (names.every(function(name) { return headerName_(name) !== headerName_(header); })) names.push(header);
  });
  return names;
}
function readTable_(sheet) {
  var data = sheet.getDataRange().getValues();
  var physical = data[0] || [];
  var logical = logicalHeaders_(sheet);
  var columns = logical.map(function(header) { return physical.findIndex(function(h) { return headerName_(h) === headerName_(header); }); });
  return [logical].concat(data.slice(1).map(function(row) {
    return columns.map(function(col) { return col < 0 ? undefined : row[col]; });
  }));
}
function writePatch_(sheet, index, patch) {
  var headers = physicalHeaders_(sheet), originalLength = headers.length;
  var entries = Object.keys(patch).filter(function(key) { return patch[key] !== undefined; }).map(function(key) {
    var matches = [];
    headers.forEach(function(h, i) { if (headerName_(h) === headerName_(key)) matches.push(i + 1); });
    if (matches.length > 1) throw new Error('중복된 시트 헤더를 확인해 주세요: ' + key);
    if (!matches.length) { headers.push(key); matches.push(headers.length); }
    return {col:matches[0],value:patch[key]};
  });
  if (headers.length > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  if (headers.length > originalLength) sheet.getRange(1, originalLength + 1, 1, headers.length - originalLength).setValues([headers.slice(originalLength)]);
  index = index > 0 ? index : Math.max(2, sheet.getLastRow() + 1);
  entries.sort(function(a,b) { return a.col-b.col; });
  // Batch adjacent known cells, never include unknown columns in a write range.
  for (var i=0;i<entries.length;) {
    var start=entries[i].col, values=[entries[i++].value];
    while(i<entries.length && entries[i].col===start+values.length) values.push(entries[i++].value);
    sheet.getRange(index,start,1,values.length).setValues([values]);
  }
  return index;
}
function writeRow_(sheet, index, row) {
  var headers = logicalHeaders_(sheet);
  var patch = {};
  row.forEach(function(value, i) { if (headers[i] && value !== undefined) patch[headers[i]] = value; });
  if (patch.updatedAt === undefined) patch.updatedAt = new Date().toISOString();
  index = writePatch_(sheet, index, patch);
  // Explicit blanks must not be filled from old duplicates on subsequent reads.
  var table = readTable_(sheet);
  var existing = objectJson_(table[index - 1][table[0].indexOf('writtenFields')]);
  var fields = (existing.fields || []).concat(Object.keys(patch).map(headerName_));
  writePatch_(sheet, index, {writtenFields: JSON.stringify({fields: fields.filter(function(v, i) { return fields.indexOf(v) === i; })})});
  return index;
}
function matchingRows_(sheet, key) {
  var data = readTable_(sheet);
  var map = getHeaderMap(sheet);
  return data.slice(1).map(function(row, i) { return {row:row,index:i+2}; }).filter(function(entry) {
    try {
      var rawKey = getValByHeader(entry.row,map,['studentKey']);
      var rowKey = rawKey ? studentKey_(rawKey) : studentKey_({grade:getValByHeader(entry.row,map,['grade']),classNum:getValByHeader(entry.row,map,['class']),number:getValByHeader(entry.row,map,['number'])});
      return rowKey === key;
    } catch (e) { return false; }
  });
}
function normalizeName_(name) { return String(name || '').normalize('NFC').replace(/\s+/g, ''); }
// Quarantine by exclusion: never adopt, return, update or delete unidentified Tests.
function isUnownedLegacyTest_(sheet, row, map) {
  return sheet.getName() === 'Tests' && ['ownerName','ownerGoogleId','name','googleId'].every(function(field) {
    return !String(getValByHeader(row,map,[field]) || '').trim();
  });
}
function assertStudentOwnsRows_(ss, student) {
  var rows = [];
  ['Progress','Tests','Submissions','Counseling'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var map = getHeaderMap(sheet);
    matchingRows_(sheet, student.studentKey).forEach(function(entry) {
      if (isUnownedLegacyTest_(sheet, entry.row, map)) return;
      if (!getValByHeader(entry.row,map,['ownerName','name'])) throw new Error('기존 자료의 학생 신원을 확인할 수 없습니다. 선생님께 확인해 주세요.');
      ['name','ownerName'].forEach(function(field) { rows.push({name:String(getValByHeader(entry.row,map,[field]) || ''),gid:''}); });
      ['googleId','ownerGoogleId'].forEach(function(field) { rows.push({name:'',gid:String(getValByHeader(entry.row,map,[field]) || '')}); });
    });
  });
  var identified = false;
  rows.forEach(function(row) {
    if (row.name && normalizeName_(row.name) !== normalizeName_(student.name)) throw new Error('이 학번에 다른 학생의 자료가 있습니다. 선생님께 확인해 주세요.');
    if (row.gid && row.gid.trim().toLowerCase() !== String(student.googleId || '').trim().toLowerCase()) throw new Error('저장된 학생 계정이 일치하지 않습니다. 선생님께 확인해 주세요.');
    if (row.name) identified = true;
  });
  if (rows.length && !identified) throw new Error('기존 자료의 학생 신원을 확인할 수 없습니다. 선생님께 확인해 주세요.');
}
function recordOwner_(sheet, index, student) {
  writePatch_(sheet,index,{ownerName:student.name,ownerGoogleId:student.googleId || ''});
}
function latestTable_(sheet) {
  var data=readTable_(sheet), map=getHeaderMap(sheet), keys={};
  data.slice(1).forEach(function(row) {
    try { var key=studentKey_(getValByHeader(row,map,['studentKey']) || {grade:getValByHeader(row,map,['grade']),classNum:getValByHeader(row,map,['class']),number:getValByHeader(row,map,['number'])}); keys[key]=true; } catch(e) {}
  });
  return [data[0]].concat(Object.keys(keys).sort().map(function(key){return selectStudentRow_(sheet,key);}).filter(function(selected){return Boolean(selected);}).map(function(selected){return selected.row;}));
}

function isValidAdminRequest_(data) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_API_SECRET');
  // Administrative data stays inaccessible until the shared secret is configured.
  if (!expected) {
    return false;
  }
  return Boolean(data && data.adminSecret && String(data.adminSecret) === String(expected));
}

function initSheetsIfNeeded(ss) {
  var sheetNames = ['Roster', 'Progress', 'Tests', 'Submissions'];
  var headers = {
    'Roster': ['grade', 'class', 'number', 'name', 'googleId'],
    'Progress': ['studentKey', 'grade', 'class', 'number', 'name', 'currentStep', 'roleModelName', 'roleModelJob', 'roleModelReason', 'jobDescription', 'competencies', 'careerHistory', 'strengths', 'values', 'challengeExperience', 'chatbotPurposes', 'targetUser', 'expectedOutcome', 'personality', 'speakingStyle', 'honorificStyle', 'desiredFeeling', 'answerLength', 'answerElements', 'chatbotName', 'initialPrompt', 'revisedPrompt', 'finalPrompt', 'createdAt', 'updatedAt', 'googleId'],
    'Tests': ['studentKey', 'test1Result', 'test2Result', 'test3Result', 'test4Result', 'test5Result', 'test6Result', 'problemDescription', 'revisionNote', 'testedAt'],
    'Submissions': ['studentKey', 'grade', 'class', 'number', 'name', 'roleModelName', 'roleModelJob', 'chatbotName', 'finalPrompt', 'gemUrl', 'barrierAnswer', 'barrierReflection', 'decisionAnswer', 'decisionReflection', 'educationAnswer', 'educationReflection', 'finalCareerReflection', 'revisionSummary', 'submittedAt']
  };
  
  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers[name]);
    }
  });
}

function getHeaderMap(sheet) {
  if (!sheet) return {};
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return {};
  var headers = logicalHeaders_(sheet);
  var map = {};
  for (var c = 0; c < headers.length; c++) {
    var rawHeader = String(headers[c] || '').trim();
    if (!rawHeader) continue;
    var norm = rawHeader.toLowerCase().replace(/[\s_.:/-]+/g, '');
    map[norm] = c;
    map[rawHeader] = c;
  }
  return map;
}

function getValByHeader(row, headerMap, aliases, defaultVal) {
  if (!aliases) return defaultVal !== undefined ? defaultVal : '';
  if (!Array.isArray(aliases)) aliases = [aliases];
  for (var i = 0; i < aliases.length; i++) {
    var alias = aliases[i];
    var norm = String(alias).toLowerCase().replace(/[\s_.:/-]+/g, '');
    if (headerMap[norm] !== undefined) {
      var colIdx = headerMap[norm];
      if (row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== '') {
        return row[colIdx];
      }
    }
    if (headerMap[alias] !== undefined) {
      var colIdx = headerMap[alias];
      if (row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== '') {
        return row[colIdx];
      }
    }
  }
  return defaultVal !== undefined ? defaultVal : '';
}

function verifyStudent(ss, params) {
  var sheet = ss.getSheetByName('Roster');
  if (!sheet) return { success: false, message: 'Roster 시트를 찾을 수 없습니다.' };
  var data = readTable_(sheet);
  if (data.length <= 1) return { success: false, message: '등록된 학생 명단이 없습니다.' };

  var headerMap = getHeaderMap(sheet);
  var grade = parseInt(params.grade, 10);
  var classNum = parseInt(params.classNo || params.classNum || params.class, 10);
  var number = parseInt(params.number, 10);
  var name = String(params.name || '').normalize('NFC').trim().replace(/\s+/g, '');
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rGrade = parseInt(String(getValByHeader(row, headerMap, ['grade', '학년']) || row[0]).trim(), 10);
    var rClass = parseInt(String(getValByHeader(row, headerMap, ['class', 'classNum', 'classNo', '반']) || row[1]).trim(), 10);
    var rNum = parseInt(String(getValByHeader(row, headerMap, ['number', 'num', '번호']) || row[2]).trim(), 10);
    var rRawName = String(getValByHeader(row, headerMap, ['name', '이름']) || row[3] || '').trim();
    var rName = rRawName.normalize('NFC').replace(/\s+/g, '');
    var rGoogleId = String(getValByHeader(row, headerMap, ['googleId', 'google_id', 'google id', 'googleid', '구글아이디', '구글id', '구글 id', '이메일', 'email', 'google', '계정', '아이디']) || (row.length > 4 ? row[4] : '') || '').trim();
    
    if (rGrade === grade && rClass === classNum && rNum === number && rName === name) {
      var studentKey = studentKey_({grade: grade, classNum: classNum, number: number});
      assertStudentOwnsRows_(ss, {studentKey:studentKey,name:rRawName,googleId:rGoogleId});
      var existingProgress = getProgress(ss, studentKey);
      var progressData = existingProgress.data || {};
      var savedName = String(progressData.name || '').trim().replace(/\s+/g, '');
      var savedGoogleId = String(progressData.googleId || '').trim().toLowerCase();
      var rosterGoogleId = String(rGoogleId || '').trim().toLowerCase();
      var identityMismatch = Boolean(
        existingProgress.found &&
        ((savedName && savedName !== rName) ||
         (savedGoogleId && rosterGoogleId && savedGoogleId !== rosterGoogleId))
      );
      if (identityMismatch) {
        progressData = {};
      } else if (typeof progressData === 'object') {
        progressData.googleId = rGoogleId;
      }
      return {
        success: true,
        student: {
          studentKey: studentKey,
          grade: grade,
          classNum: classNum,
          number: number,
          name: rRawName || name,
          googleId: rGoogleId
        },
        studentToken: issueStudentToken_({studentKey: studentKey, grade: grade, classNum: classNum, number: number, name: rRawName || name, googleId: rGoogleId}),
        hasExisting: existingProgress.found && !identityMismatch,
        identityMismatch: identityMismatch,
        progress: progressData
      };
    }
  }
  return { success: false, message: '학생 정보를 확인할 수 없습니다.\n학년, 반, 번호, 이름을 다시 확인해 주세요.' };
}

function getRosterOptions(ss) {
  var sheet = ss.getSheetByName('Roster');
  if (!sheet) return { success: false, message: 'Roster 시트를 찾을 수 없습니다.' };
  var data = readTable_(sheet);
  var gradesSet = {};
  var classesByGrade = {};
  var numbersByClass = {};
  var headerMap = getHeaderMap(sheet);
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var g = parseInt(String(getValByHeader(row, headerMap, ['grade', '학년']) || row[0]).trim(), 10);
    var c = parseInt(String(getValByHeader(row, headerMap, ['class', 'classNum', '반']) || row[1]).trim(), 10);
    var n = parseInt(String(getValByHeader(row, headerMap, ['number', 'num', '번호']) || row[2]).trim(), 10);
    if (!isNaN(g) && !isNaN(c) && !isNaN(n) && g > 0 && c > 0 && n > 0) {
      gradesSet[g] = true;
      if (!classesByGrade[g]) classesByGrade[g] = [];
      if (classesByGrade[g].indexOf(c) === -1) classesByGrade[g].push(c);
      
      var classKey = g + '-' + c;
      if (!numbersByClass[classKey]) numbersByClass[classKey] = [];
      if (numbersByClass[classKey].indexOf(n) === -1) numbersByClass[classKey].push(n);
    }
  }
  
  var grades = Object.keys(gradesSet).map(function(k) { return parseInt(k, 10); }).sort(function(a, b) { return a - b; });
  grades.forEach(function(g) {
    if (classesByGrade[g]) classesByGrade[g].sort(function(a, b) { return a - b; });
  });
  Object.keys(numbersByClass).forEach(function(k) {
    numbersByClass[k].sort(function(a, b) { return a - b; });
  });

  return {
    success: true,
    data: {
      grades: grades,
      classesByGrade: classesByGrade,
      numbersByClass: numbersByClass
    }
  };
}

function getStudentTests(ss, studentKey) {
  var sheet = ss.getSheetByName('Tests');
  if (!sheet) return null;
  var data = studentRowsForRead_(sheet, studentKey_(studentKey));
  if (data.length <= 1) return null;

  var headerMap = getHeaderMap(sheet);
  var targetKey = studentKey_(studentKey);
  var parts = targetKey.split('-');
  var targetGrade = parts.length >= 1 ? parseInt(parts[0], 10) : -1;
  var targetClass = parts.length >= 2 ? parseInt(parts[1], 10) : -1;
  var targetNum = parts.length >= 3 ? parseInt(parts[2], 10) : -1;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowKey = String(getValByHeader(row, headerMap, ['studentKey', 'student_key', 'key']) || row[0] || '').trim();
    var rGrade = parseInt(String(getValByHeader(row, headerMap, ['grade', '학년'])).trim(), 10);
    var rClass = parseInt(String(getValByHeader(row, headerMap, ['class', 'classNum', 'classNo', '반'])).trim(), 10);
    var rNum = parseInt(String(getValByHeader(row, headerMap, ['number', 'num', '번호'])).trim(), 10);

    if (!rowKey && !isNaN(rGrade) && !isNaN(rClass) && !isNaN(rNum) && rGrade > 0 && rClass > 0 && rNum > 0) {
      rowKey = rGrade + '-' + rClass + '-' + rNum;
    }

    var isMatch = (rowKey && targetKey && rowKey === targetKey);
    if (!isMatch && targetGrade > 0 && targetClass > 0 && targetNum > 0) {
      if (rGrade === targetGrade && rClass === targetClass && rNum === targetNum) {
        isMatch = true;
      } else {
        var rParts = rowKey.split('-');
        if (rParts.length >= 3 && parseInt(rParts[0], 10) === targetGrade && parseInt(rParts[1], 10) === targetClass && parseInt(rParts[2], 10) === targetNum) {
          isMatch = true;
        }
      }
    }

    if (isMatch) {
      return {
        step8: objectJson_(getValByHeader(row, headerMap, ['step8Data'])),
        test1Result: String(getValByHeader(row, headerMap, ['test1Result', 'test1']) || row[1] || ''),
        test2Result: String(getValByHeader(row, headerMap, ['test2Result', 'test2']) || row[2] || ''),
        test3Result: String(getValByHeader(row, headerMap, ['test3Result', 'test3']) || row[3] || ''),
        test4Result: String(getValByHeader(row, headerMap, ['test4Result', 'test4']) || row[4] || ''),
        test5Result: String(getValByHeader(row, headerMap, ['test5Result', 'test5']) || row[5] || ''),
        test6Result: String(getValByHeader(row, headerMap, ['test6Result', 'test6']) || row[6] || ''),
        problemDescription: String(getValByHeader(row, headerMap, ['problemDescription', 'problem', '문제점']) || row[7] || ''),
        revisionNote: String(getValByHeader(row, headerMap, ['revisionNote', 'revision', '수정계획']) || row[8] || ''),
        testedAt: String(getValByHeader(row, headerMap, ['testedAt', 'timestamp', 'date', '일시']) || row[9] || '')
      };
    }
  }
  return null;
}

function getStudentSubmission(ss, studentKey) {
  var sheet = ss.getSheetByName('Submissions');
  if (!sheet) return null;
  var data = studentRowsForRead_(sheet, studentKey_(studentKey));
  if (data.length <= 1) return null;

  var headerMap = getHeaderMap(sheet);
  var targetKey = studentKey_(studentKey);
  var parts = targetKey.split('-');
  var targetGrade = parts.length >= 1 ? parseInt(parts[0], 10) : -1;
  var targetClass = parts.length >= 2 ? parseInt(parts[1], 10) : -1;
  var targetNum = parts.length >= 3 ? parseInt(parts[2], 10) : -1;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowKey = String(getValByHeader(row, headerMap, ['studentKey', 'student_key', 'key']) || '').trim();
    var rGrade = parseInt(String(getValByHeader(row, headerMap, ['grade', '학년'])).trim(), 10);
    var rClass = parseInt(String(getValByHeader(row, headerMap, ['class', 'classNum', 'classNo', 'class_num', '반'])).trim(), 10);
    var rNum = parseInt(String(getValByHeader(row, headerMap, ['number', 'num', 'studentNumber', '번호'])).trim(), 10);

    if (!rowKey && !isNaN(rGrade) && !isNaN(rClass) && !isNaN(rNum) && rGrade > 0 && rClass > 0 && rNum > 0) {
      rowKey = rGrade + '-' + rClass + '-' + rNum;
    }

    var isMatch = false;
    if (rowKey && targetKey && rowKey === targetKey) {
      isMatch = true;
    } else if (targetGrade > 0 && targetClass > 0 && targetNum > 0 && rGrade === targetGrade && rClass === targetClass && rNum === targetNum) {
      isMatch = true;
    }

    if (isMatch) {
      var barrierAnswer = String(getValByHeader(row, headerMap, ['barrierAnswer', 'sampleQuestion1', 'barrierQ', 'barrier', '진로장벽답변', '진로장벽', '질문1']) || '');
      var barrierReflection = String(getValByHeader(row, headerMap, ['barrierReflection', 'sampleAnswer1', 'barrierA', '진로장벽성찰', '성찰1']) || '');
      var decisionAnswer = String(getValByHeader(row, headerMap, ['decisionAnswer', 'sampleQuestion2', 'decisionQ', 'decision', '진로의사결정답변', '진로선택답변', '질문2']) || '');
      var decisionReflection = String(getValByHeader(row, headerMap, ['decisionReflection', 'sampleAnswer2', 'decisionA', '진로의사결정성찰', '진로선택성찰', '성찰2']) || '');
      var educationAnswer = String(getValByHeader(row, headerMap, ['educationAnswer', 'sampleQuestion3', 'educationQ', 'education', '진학설계답변', '진학답변', '질문3']) || '');
      var educationReflection = String(getValByHeader(row, headerMap, ['educationReflection', 'sampleAnswer3', 'educationA', '진학설계성찰', '진학성찰', '성찰3']) || '');
      var finalCareerReflection = String(getValByHeader(row, headerMap, ['finalCareerReflection', 'reflection', 'careerReflection', '최종진로성찰', '최종성찰', '진로성찰', '소감']) || '');
      var revisionSummary = String(getValByHeader(row, headerMap, ['revisionSummary', 'revisionNote', 'problemDescription', '수정요약', '수정내용']) || '');
      var submittedAt = String(getValByHeader(row, headerMap, ['submittedAt', 'createdAt', 'updatedAt', 'timestamp', 'date', '제출시간', '제출일시', '일시']) || '');
      var gemUrl = String(getValByHeader(row, headerMap, ['gemUrl', 'gem_url', 'gem', 'gemlink', 'gem링크', '챗봇링크']) || '');

      return {
        studentKey: rowKey || targetKey,
        grade: !isNaN(rGrade) ? rGrade : targetGrade,
        class: !isNaN(rClass) ? rClass : targetClass,
        classNum: !isNaN(rClass) ? rClass : targetClass,
        number: !isNaN(rNum) ? rNum : targetNum,
        name: String(getValByHeader(row, headerMap, ['name', '이름']) || '').trim(),
        roleModelName: String(getValByHeader(row, headerMap, ['roleModelName', 'roleModel', '롤모델이름', '롤모델']) || ''),
        roleModelJob: String(getValByHeader(row, headerMap, ['roleModelJob', 'job', '롤모델직업', '직업']) || ''),
        chatbotName: String(getValByHeader(row, headerMap, ['chatbotName', 'botName', '챗봇이름', '챗봇명']) || ''),
        finalPrompt: String(getValByHeader(row, headerMap, ['finalPrompt', 'prompt', '최종프롬프트', '프롬프트']) || ''),
        gemUrl: gemUrl,
        barrierAnswer: barrierAnswer,
        barrierReflection: barrierReflection,
        decisionAnswer: decisionAnswer,
        decisionReflection: decisionReflection,
        educationAnswer: educationAnswer,
        educationReflection: educationReflection,
        finalCareerReflection: finalCareerReflection,
        revisionSummary: revisionSummary,
        sampleQuestion1: barrierAnswer,
        sampleAnswer1: barrierReflection,
        sampleQuestion2: decisionAnswer,
        sampleAnswer2: decisionReflection,
        sampleQuestion3: educationAnswer,
        sampleAnswer3: educationReflection,
        reflection: finalCareerReflection,
        submittedAt: submittedAt
      };
    }
  }
  return null;
}

function getProgress(ss, studentKey) {
  return loadProgress(ss, studentKey);
}

function loadProgress(ss, studentKey) {
  var targetKey = studentKey_(studentKey);
  var parts = targetKey.split('-');
  var targetGrade = parts.length >= 1 ? parseInt(parts[0], 10) : -1;
  var targetClass = parts.length >= 2 ? parseInt(parts[1], 10) : -1;
  var targetNum = parts.length >= 3 ? parseInt(parts[2], 10) : -1;

  var sheet = ss.getSheetByName('Progress');
  var progressData = null;

  if (sheet) {
    var data = studentRowsForRead_(sheet, studentKey_(studentKey));
    if (data.length > 1) {
      var headerMap = getHeaderMap(sheet);
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var rowKey = String(getValByHeader(row, headerMap, ['studentKey', 'student_key', 'key']) || row[0] || '').trim();
        var rGrade = parseInt(String(getValByHeader(row, headerMap, ['grade', '학년']) || row[1]).trim(), 10);
        var rClass = parseInt(String(getValByHeader(row, headerMap, ['class', 'classNum', 'classNo', '반']) || row[2]).trim(), 10);
        var rNum = parseInt(String(getValByHeader(row, headerMap, ['number', 'num', '번호']) || row[3]).trim(), 10);

        if (!rowKey && !isNaN(rGrade) && !isNaN(rClass) && !isNaN(rNum) && rGrade > 0 && rClass > 0 && rNum > 0) {
          rowKey = rGrade + '-' + rClass + '-' + rNum;
        }

        var isMatch = false;
        if (rowKey && targetKey && rowKey === targetKey) {
          isMatch = true;
        } else if (targetGrade > 0 && targetClass > 0 && targetNum > 0 && rGrade === targetGrade && rClass === targetClass && rNum === targetNum) {
          isMatch = true;
        }

        if (isMatch) {
          progressData = {
            stepData: objectJson_(getValByHeader(row, headerMap, ['stepData'])),
            studentKey: targetKey,
            grade: !isNaN(rGrade) ? rGrade : targetGrade,
            class: !isNaN(rClass) ? rClass : targetClass,
            classNum: !isNaN(rClass) ? rClass : targetClass,
            number: !isNaN(rNum) ? rNum : targetNum,
            name: String(getValByHeader(row, headerMap, ['name', '이름']) || row[4] || '').trim(),
            currentStep: Number(getValByHeader(row, headerMap, ['currentStep', 'step']) || row[5] || 1),
            roleModelName: String(getValByHeader(row, headerMap, ['roleModelName', 'roleModel', '롤모델이름']) || row[6] || ''),
            roleModelJob: String(getValByHeader(row, headerMap, ['roleModelJob', 'job', '롤모델직업']) || row[7] || ''),
            roleModelReason: String(getValByHeader(row, headerMap, ['roleModelReason', 'reason']) || row[8] || ''),
            jobDescription: String(getValByHeader(row, headerMap, ['jobDescription']) || row[9] || ''),
            competencies: String(getValByHeader(row, headerMap, ['competencies']) || row[10] || ''),
            careerHistory: String(getValByHeader(row, headerMap, ['careerHistory']) || row[11] || ''),
            strengths: String(getValByHeader(row, headerMap, ['strengths']) || row[12] || ''),
            values: String(getValByHeader(row, headerMap, ['values']) || row[13] || ''),
            challengeExperience: String(getValByHeader(row, headerMap, ['challengeExperience']) || row[14] || ''),
            chatbotPurposes: String(getValByHeader(row, headerMap, ['chatbotPurposes']) || row[15] || ''),
            targetUser: String(getValByHeader(row, headerMap, ['targetUser']) || row[16] || ''),
            expectedOutcome: String(getValByHeader(row, headerMap, ['expectedOutcome']) || row[17] || ''),
            personality: String(getValByHeader(row, headerMap, ['personality', 'personalities']) || row[18] || ''),
            speakingStyle: String(getValByHeader(row, headerMap, ['speakingStyle']) || row[19] || ''),
            honorificStyle: String(getValByHeader(row, headerMap, ['honorificStyle']) || row[20] || ''),
            desiredFeeling: String(getValByHeader(row, headerMap, ['desiredFeeling']) || row[21] || ''),
            answerLength: String(getValByHeader(row, headerMap, ['answerLength']) || row[22] || ''),
            answerElements: String(getValByHeader(row, headerMap, ['answerElements']) || row[23] || ''),
            chatbotName: String(getValByHeader(row, headerMap, ['chatbotName']) || row[24] || ''),
            initialPrompt: String(getValByHeader(row, headerMap, ['initialPrompt']) || row[25] || ''),
            revisedPrompt: String(getValByHeader(row, headerMap, ['revisedPrompt']) || row[26] || ''),
            finalPrompt: String(getValByHeader(row, headerMap, ['finalPrompt']) || row[27] || ''),
            createdAt: String(getValByHeader(row, headerMap, ['createdAt']) || row[28] || ''),
            updatedAt: String(getValByHeader(row, headerMap, ['updatedAt']) || row[29] || ''),
            googleId: String(getValByHeader(row, headerMap, ['googleId', 'google_id']) || row[30] || '')
          };
          break;
        }
      }
    }
  }

  // Load associated Tests and Submissions data
  var testData = getStudentTests(ss, targetKey);
  var subData = getStudentSubmission(ss, targetKey);

  // If not found in Progress sheet, but exists in Submissions, reconstruct progressData
  if (!progressData && subData) {
    progressData = {
      studentKey: targetKey,
      grade: subData.grade || targetGrade,
      class: subData.class || targetClass,
      classNum: subData.class || targetClass,
      number: subData.number || targetNum,
      name: subData.name || '',
      currentStep: 10,
      roleModelName: subData.roleModelName || '',
      roleModelJob: subData.roleModelJob || '',
      roleModelReason: '',
      jobDescription: '',
      competencies: '',
      careerHistory: '',
      strengths: '',
      values: '',
      challengeExperience: '',
      chatbotPurposes: '',
      targetUser: '이 직업에 관심 있는 중학생',
      expectedOutcome: '',
      personality: '',
      speakingStyle: '선배처럼 조언하듯이',
      honorificStyle: '친근한 존댓말',
      desiredFeeling: '',
      answerLength: 'medium',
      answerElements: '',
      chatbotName: subData.chatbotName || '',
      initialPrompt: '',
      revisedPrompt: '',
      finalPrompt: subData.finalPrompt || '',
      createdAt: subData.submittedAt || new Date().toISOString(),
      updatedAt: subData.submittedAt || new Date().toISOString()
    };
  }

  if (!progressData && !subData && !testData) {
    return { success: true, found: false };
  }

  if (!progressData) {
    progressData = {
      studentKey: targetKey,
      grade: targetGrade > 0 ? targetGrade : 1,
      class: targetClass > 0 ? targetClass : 1,
      classNum: targetClass > 0 ? targetClass : 1,
      number: targetNum > 0 ? targetNum : 1,
      name: '',
      currentStep: 1,
      roleModelName: '',
      roleModelJob: '',
      roleModelReason: '',
      jobDescription: '',
      competencies: '',
      careerHistory: '',
      strengths: '',
      values: '',
      challengeExperience: '',
      chatbotPurposes: '',
      targetUser: '이 직업에 관심 있는 중학생',
      expectedOutcome: '',
      personality: '',
      speakingStyle: '선배처럼 조언하듯이',
      honorificStyle: '친근한 존댓말',
      desiredFeeling: '',
      answerLength: 'medium',
      answerElements: '',
      chatbotName: '',
      initialPrompt: '',
      revisedPrompt: '',
      finalPrompt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Attach tests and submission objects
  if (testData) progressData.tests = testData;
  if (subData) {
    progressData.submission = subData;
    progressData.step10 = subData;
    if (subData.gemUrl) progressData.gemUrl = subData.gemUrl;
    if (subData.barrierAnswer) progressData.barrierAnswer = subData.barrierAnswer;
    if (subData.barrierReflection) progressData.barrierReflection = subData.barrierReflection;
    if (subData.decisionAnswer) progressData.decisionAnswer = subData.decisionAnswer;
    if (subData.decisionReflection) progressData.decisionReflection = subData.decisionReflection;
    if (subData.educationAnswer) progressData.educationAnswer = subData.educationAnswer;
    if (subData.educationReflection) progressData.educationReflection = subData.educationReflection;
    if (subData.finalCareerReflection) progressData.finalCareerReflection = subData.finalCareerReflection;
    if (subData.revisionSummary) progressData.revisionSummary = subData.revisionSummary;
    if (subData.submittedAt) progressData.submittedAt = subData.submittedAt;
  }

  // Infer actual max reached step
  var isFinalSubmitted = Boolean(subData && subData.submittedAt);

  var inferredStep = 1;
  if (isFinalSubmitted) {
    inferredStep = 10;
  } else if ((progressData && progressData.revisedPrompt) || (testData && (testData.revisionNote || testData.problemDescription))) {
    inferredStep = 9;
  } else if (testData && (testData.testedAt || testData.test1Result || testData.test2Result || testData.test3Result || testData.test4Result || testData.test5Result || testData.test6Result)) {
    inferredStep = 8;
  } else if (progressData && (progressData.finalPrompt || progressData.initialPrompt || progressData.chatbotName)) {
    inferredStep = 6;
  }

  var effectiveCurrentStep = Math.max(Number((progressData && progressData.currentStep) || 1), inferredStep);
  if (isFinalSubmitted) {
    effectiveCurrentStep = 10;
  }
  progressData.currentStep = effectiveCurrentStep;
  progressData.isFinalSubmitted = isFinalSubmitted;
  progressData.isGemSubmitted = Boolean(subData && subData.gemUrl);
  progressData.isTestCompleted = Boolean(testData && (testData.testedAt || testData.test1Result)) || effectiveCurrentStep >= 8;
  progressData.isPromptCompleted = Boolean((progressData && (progressData.finalPrompt || progressData.initialPrompt)) || (subData && subData.finalPrompt)) || effectiveCurrentStep >= 6;

  // Lookup and retain googleId from Roster sheet
  try {
    var rosterSheet = ss.getSheetByName('Roster');
    if (rosterSheet) {
      var rData = readTable_(rosterSheet);
      if (rData.length > 1) {
        var rHeaderMap = getHeaderMap(rosterSheet);
        for (var rIdx = 1; rIdx < rData.length; rIdx++) {
          var rRow = rData[rIdx];
          var rg = parseInt(String(getValByHeader(rRow, rHeaderMap, ['grade', '학년']) || rRow[0]).trim(), 10);
          var rc = parseInt(String(getValByHeader(rRow, rHeaderMap, ['class', 'classNum', 'classNo', '반']) || rRow[1]).trim(), 10);
          var rn = parseInt(String(getValByHeader(rRow, rHeaderMap, ['number', 'num', '번호']) || rRow[2]).trim(), 10);
          if (targetGrade > 0 && targetClass > 0 && targetNum > 0 && rg === targetGrade && rc === targetClass && rn === targetNum) {
            var rGid = String(getValByHeader(rRow, rHeaderMap, ['googleId', 'google_id', 'google id', 'googleid', '구글아이디', '구글id', '구글 id', '이메일', 'email', 'google', '계정', '아이디']) || (rRow.length > 4 ? rRow[4] : '') || '').trim();
            if (rGid) {
              progressData.googleId = rGid;
            }
            break;
          }
        }
      }
    }
  } catch (eRoster) {}

  return {
    success: true,
    found: true,
    data: progressData
  };
}

function saveProgress(ss, progress) {
  var sheet = ss.getSheetByName('Progress');
  if (!sheet) return { success: false, message: 'Progress 시트를 찾을 수 없습니다.' };
  var studentKey = studentKey_(progress.studentKey || progress);
  var selected = selectStudentRow_(sheet, studentKey);
  var rowIndex = selected ? selected.index : -1;
  var existingRow = selected ? selected.row : null;
  var now = new Date().toISOString();
  var grade = progress.grade !== undefined ? progress.grade : (existingRow ? existingRow[1] : '');
  var classNum = progress.class !== undefined ? progress.class : (progress.classNum !== undefined ? progress.classNum : (existingRow ? existingRow[2] : ''));
  var number = progress.number !== undefined ? progress.number : (existingRow ? existingRow[3] : '');
  var name = progress.name || (existingRow ? existingRow[4] : '');
  var currentStep = Math.max(Number(progress.currentStep) || 1, Number(existingRow && existingRow[5]) || 1);

  var roleModelName = progress.roleModelName !== undefined ? progress.roleModelName : ((progress.step1 && progress.step1.roleModelName !== undefined) ? progress.step1.roleModelName : (existingRow ? existingRow[6] : ''));
  var roleModelJob = progress.roleModelJob !== undefined ? progress.roleModelJob : ((progress.step1 && progress.step1.roleModelJob !== undefined) ? progress.step1.roleModelJob : (existingRow ? existingRow[7] : ''));
  var roleModelReason = progress.roleModelReason !== undefined ? progress.roleModelReason : ((progress.step1 && progress.step1.roleModelReason !== undefined) ? progress.step1.roleModelReason : (existingRow ? existingRow[8] : ''));
  var jobDescription = progress.jobDescription !== undefined ? progress.jobDescription : ((progress.step1 && progress.step1.jobDescription !== undefined) ? progress.step1.jobDescription : (existingRow ? existingRow[9] : ''));
  
  var competencies = progress.competencies !== undefined ? progress.competencies : ((progress.step1 && progress.step1.competencies !== undefined) ? progress.step1.competencies : (existingRow ? existingRow[10] : ''));
  if (Array.isArray(competencies)) competencies = competencies.join(', ');
  
  var careerHistory = progress.careerHistory !== undefined ? progress.careerHistory : ((progress.step1 && progress.step1.careerHistory !== undefined) ? progress.step1.careerHistory : (existingRow ? existingRow[11] : ''));
  
  var strengths = progress.strengths !== undefined ? progress.strengths : ((progress.step1 && progress.step1.strengths !== undefined) ? progress.step1.strengths : (existingRow ? existingRow[12] : ''));
  if (Array.isArray(strengths)) strengths = strengths.join(', ');
  
  var values = progress.values !== undefined ? progress.values : ((progress.step1 && progress.step1.values !== undefined) ? progress.step1.values : (existingRow ? existingRow[13] : ''));
  if (Array.isArray(values)) values = values.join(', ');
  
  var challengeExperience = progress.challengeExperience !== undefined ? progress.challengeExperience : ((progress.step1 && progress.step1.challengeExperience !== undefined) ? progress.step1.challengeExperience : (existingRow ? existingRow[14] : ''));

  var chatbotPurposes = progress.chatbotPurposes !== undefined ? progress.chatbotPurposes : ((progress.step2 && progress.step2.chatbotPurposes !== undefined) ? progress.step2.chatbotPurposes : (existingRow ? existingRow[15] : ''));
  if (Array.isArray(chatbotPurposes)) chatbotPurposes = chatbotPurposes.join(', ');

  var targetUser = progress.targetUser !== undefined ? progress.targetUser : ((progress.step2 && progress.step2.targetUser !== undefined) ? progress.step2.targetUser : (existingRow ? existingRow[16] : ''));
  var expectedOutcome = progress.expectedOutcome !== undefined ? progress.expectedOutcome : ((progress.step2 && progress.step2.expectedOutcome !== undefined) ? progress.step2.expectedOutcome : (existingRow ? existingRow[17] : ''));

  var personality = progress.personality !== undefined ? progress.personality : (progress.personalities !== undefined ? progress.personalities : ((progress.step3 && progress.step3.personalities !== undefined) ? progress.step3.personalities : (existingRow ? existingRow[18] : '')));
  if (Array.isArray(personality)) personality = personality.join(', ');

  var speakingStyle = progress.speakingStyle !== undefined ? progress.speakingStyle : ((progress.step3 && progress.step3.speakingStyle !== undefined) ? progress.step3.speakingStyle : (existingRow ? existingRow[19] : ''));
  var honorificStyle = progress.honorificStyle !== undefined ? progress.honorificStyle : ((progress.step3 && progress.step3.honorificStyle !== undefined) ? progress.step3.honorificStyle : (existingRow ? existingRow[20] : ''));
  var desiredFeeling = progress.desiredFeeling !== undefined ? progress.desiredFeeling : ((progress.step3 && progress.step3.desiredFeeling !== undefined) ? progress.step3.desiredFeeling : (existingRow ? existingRow[21] : ''));

  var answerLength = progress.answerLength !== undefined ? progress.answerLength : ((progress.step4 && progress.step4.answerLength !== undefined) ? progress.step4.answerLength : (existingRow ? existingRow[22] : ''));
  var answerElements = progress.answerElements !== undefined ? progress.answerElements : ((progress.step4 && progress.step4.answerElements !== undefined) ? progress.step4.answerElements : (existingRow ? existingRow[23] : ''));
  if (Array.isArray(answerElements)) answerElements = answerElements.join(', ');

  var chatbotName = progress.chatbotName !== undefined ? progress.chatbotName : ((progress.step6 && progress.step6.chatbotName !== undefined) ? progress.step6.chatbotName : (existingRow ? existingRow[24] : ''));
  var initialPrompt = progress.initialPrompt !== undefined ? progress.initialPrompt : ((progress.step6 && progress.step6.initialPrompt !== undefined) ? progress.step6.initialPrompt : (existingRow ? existingRow[25] : ''));
  var revisedPrompt = progress.revisedPrompt !== undefined ? progress.revisedPrompt : ((progress.step6 && progress.step6.revisedPrompt !== undefined) ? progress.step6.revisedPrompt : (existingRow ? existingRow[26] : ''));
  var finalPrompt = progress.finalPrompt !== undefined ? progress.finalPrompt : ((progress.step6 && progress.step6.finalPrompt !== undefined) ? progress.step6.finalPrompt : (existingRow ? existingRow[27] : ''));

  var createdAt = (existingRow && existingRow[28]) ? existingRow[28] : (progress.createdAt || now);
  var googleId = progress.googleId !== undefined ? String(progress.googleId || '').trim() : (existingRow ? String(existingRow[30] || '').trim() : '');

  var rowData = [
    studentKey, grade, classNum, number, name,
    currentStep,
    roleModelName,
    roleModelJob,
    roleModelReason,
    jobDescription,
    competencies,
    careerHistory,
    strengths,
    values,
    challengeExperience,
    chatbotPurposes,
    targetUser,
    expectedOutcome,
    personality,
    speakingStyle,
    honorificStyle,
    desiredFeeling,
    answerLength,
    answerElements,
    chatbotName,
    initialPrompt,
    revisedPrompt,
    finalPrompt,
    createdAt,
    now,
    googleId
  ];
  
  if (rowIndex > 0) {
    writeRow_(sheet, rowIndex, rowData);
  } else {
    rowIndex = writeRow_(sheet, -1, rowData);
  }
  
  var extra = existingRow ? objectJson_(getValByHeader(existingRow, getHeaderMap(sheet), ['stepData'])) : {};
  ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'].forEach(function(key) {
    if (progress[key] !== undefined) extra[key] = progress[key];
  });
  if (Object.keys(extra).length) writeExtraJson_(sheet, rowIndex > 0 ? rowIndex : sheet.getLastRow(), 'stepData', extra);
  return { success: true, message: '진행 상황이 저장되었습니다.', studentKey: studentKey, savedAt: now };
}

function resetStudentData(ss, params) {
  assertStudentOwnsRows_(ss, params);
  ['Progress','Tests','Submissions','Counseling'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    matchingRows_(sheet, params.studentKey).filter(function(entry){return !isUnownedLegacyTest_(sheet,entry.row,getHeaderMap(sheet));}).sort(function(a,b){return b.index-a.index;}).forEach(function(entry){sheet.deleteRow(entry.index);});
  });
  return {success:true,message:'기존 활동 자료를 초기화했습니다.'};
}

function advanceProgress_(ss, key, step, now) {
  var sheet=ss.getSheetByName('Progress'), selected=sheet && selectStudentRow_(sheet,key);
  if(selected) writePatch_(sheet,selected.index,{currentStep:Math.max(Number(selected.row[5]) || 1,step),updatedAt:now});
}
function submittedValue_(payload, selected, column, names) {
  for(var i=0;i<names.length;i++) if(payload[names[i]] !== undefined) return payload[names[i]];
  return selected && selected.row[column] !== undefined ? selected.row[column] : '';
}

function saveTests(ss, params) {
  var sheet = ss.getSheetByName('Tests');
  if (!sheet) return { success: false, message: 'Tests 시트를 찾을 수 없습니다.' };
  var studentKey = studentKey_(params.studentKey);
  var selected = selectStudentRow_(sheet, studentKey);
  var rowIndex = selected ? selected.index : -1;
  var previous = selected ? selected.row : [];
  var now = params.testedAt || new Date().toISOString();
  var rowData = [
    studentKey,
    params.test1Result !== undefined ? params.test1Result : (previous[1] || ''),
    params.test2Result !== undefined ? params.test2Result : (previous[2] || ''),
    params.test3Result !== undefined ? params.test3Result : (previous[3] || ''),
    params.test4Result !== undefined ? params.test4Result : (previous[4] || ''),
    params.test5Result !== undefined ? params.test5Result : (previous[5] || ''),
    params.test6Result !== undefined ? params.test6Result : (previous[6] || ''),
    params.problemDescription !== undefined ? params.problemDescription : (previous[7] || ''),
    params.revisionNote !== undefined ? params.revisionNote : (previous[8] || ''),
    now
  ];
  
  if (rowIndex > 0) {
    writeRow_(sheet, rowIndex, rowData);
  } else {
    rowIndex = writeRow_(sheet, -1, rowData);
  }
  
  recordOwner_(sheet, rowIndex, params);
  if (params.step8) writeExtraJson_(sheet, rowIndex > 0 ? rowIndex : sheet.getLastRow(), 'step8Data', params.step8);

  // Update currentStep in Progress sheet to at least 8
  advanceProgress_(ss, studentKey, 8, now);
  
  return { success: true, message: '테스트 결과가 저장되었습니다.', studentKey: studentKey, savedAt: now };
}

function updateRevision(ss, params) {
  var result = saveProgress(ss, params);
  if (!result.success) return result;
  return saveTests(ss, {studentKey: params.studentKey, name:params.name, googleId:params.googleId, problemDescription: params.problemDescription, revisionNote: params.revisionNote});
}

function submitFinal(ss, submission) {
  var sheet = ss.getSheetByName('Submissions');
  if (!sheet) {
    initSheetsIfNeeded(ss);
    sheet = ss.getSheetByName('Submissions');
  }
  if (!sheet) return { success: false, message: 'Submissions 시트를 찾을 수 없습니다.' };
  
  var headers = ['studentKey', 'grade', 'class', 'number', 'name', 'roleModelName', 'roleModelJob', 'chatbotName', 'finalPrompt', 'gemUrl', 'barrierAnswer', 'barrierReflection', 'decisionAnswer', 'decisionReflection', 'educationAnswer', 'educationReflection', 'finalCareerReflection', 'revisionSummary', 'submittedAt'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);

  }
  
  var studentKey = studentKey_(submission.studentKey || submission);
  var now = new Date().toISOString();
  
  var data = readTable_(sheet);
  var selected = selectStudentRow_(sheet, studentKey);
  var rowIndex = selected ? selected.index : -1;

  var submittedAt = (selected && selected.row[18]) || submission.submittedAt || now;
  var grade = submission.grade !== undefined ? Number(submission.grade) : '';
  var classNum = submission.class !== undefined ? Number(submission.class) : (submission.classNum !== undefined ? Number(submission.classNum) : '');
  var number = submission.number !== undefined ? Number(submission.number) : '';
  var name = String(submission.name || '').trim();
  
  var rowData = [
    studentKey,
    grade,
    classNum,
    number,
    name,
    submittedValue_(submission, selected, 5, ['roleModelName']),
    submittedValue_(submission, selected, 6, ['roleModelJob']),
    submittedValue_(submission, selected, 7, ['chatbotName']),
    submittedValue_(submission, selected, 8, ['finalPrompt']),
    submittedValue_(submission, selected, 9, ['gemUrl']),
    submittedValue_(submission, selected, 10, ['barrierAnswer','sampleQuestion1']),
    submittedValue_(submission, selected, 11, ['barrierReflection','sampleAnswer1']),
    submittedValue_(submission, selected, 12, ['decisionAnswer','sampleQuestion2']),
    submittedValue_(submission, selected, 13, ['decisionReflection','sampleAnswer2']),
    submittedValue_(submission, selected, 14, ['educationAnswer','sampleQuestion3']),
    submittedValue_(submission, selected, 15, ['educationReflection','sampleAnswer3']),
    submittedValue_(submission, selected, 16, ['finalCareerReflection','reflection']),
    submittedValue_(submission, selected, 17, ['revisionSummary']),
    submittedAt
  ];
  
  if (rowIndex > 0) {
    writeRow_(sheet, rowIndex, rowData);
  } else {
    rowIndex = writeRow_(sheet, -1, rowData);
  }
  
  // Update Progress sheet: currentStep = 10
  advanceProgress_(ss, studentKey, 10, now);
  
  return { success: true, message: '제출이 완료되었습니다.', studentKey: studentKey, submittedAt: submittedAt };
}

function submitCounseling(ss, counseling) {
  var sheet = ss.getSheetByName('Counseling');
  if (!sheet) return { success: false, message: 'Counseling 시트를 찾을 수 없습니다.' };
  
  var studentKey = studentKey_(counseling.studentKey || counseling);
  var now = new Date().toISOString();
  
  var data = readTable_(sheet);
  var selected = selectStudentRow_(sheet, studentKey);
  var rowIndex = selected ? selected.index : -1;

  var grade = counseling.grade !== undefined ? Number(counseling.grade) : '';
  var classNum = counseling.class !== undefined ? Number(counseling.class) : Number(counseling.classNum || '');
  var number = counseling.number !== undefined ? Number(counseling.number) : '';
  var name = String(counseling.name || '').trim();
  var completedAt = counseling.counselingCompletedAt || counseling.completedAt || now;
  
  var rowData = [
    studentKey,
    grade,
    classNum,
    number,
    name,
    submittedValue_(counseling, selected, 5, ['roleModelName']),
    submittedValue_(counseling, selected, 6, ['roleModelJob']),
    submittedValue_(counseling, selected, 7, ['chatbotName']),
    submittedValue_(counseling, selected, 8, ['gemUrl']),
    submittedValue_(counseling, selected, 9, ['barrierAnswer']),
    submittedValue_(counseling, selected, 10, ['barrierReflection']),
    submittedValue_(counseling, selected, 11, ['decisionAnswer']),
    submittedValue_(counseling, selected, 12, ['decisionReflection']),
    submittedValue_(counseling, selected, 13, ['educationAnswer']),
    submittedValue_(counseling, selected, 14, ['educationReflection']),
    submittedValue_(counseling, selected, 15, ['finalCareerReflection']),
    completedAt
  ];
  
  if (rowIndex > 0) {
    writeRow_(sheet, rowIndex, rowData);
  } else {
    rowIndex = writeRow_(sheet, -1, rowData);
  }
  
  // Update currentStep in Progress sheet to 11
  advanceProgress_(ss, studentKey, 11, now);
  
  return { success: true, message: '진로 상담 활동이 완료되었습니다.', studentKey: studentKey, completedAt: completedAt };
}

function getAllProgress(ss) {
  var sheet = ss.getSheetByName('Progress');
  if (!sheet) return { success: true, list: [] };
  var data = latestTable_(sheet);
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      list.push({
        studentKey: String(data[i][0]),
        grade: Number(data[i][1]),
        class: Number(data[i][2]),
        number: Number(data[i][3]),
        name: String(data[i][4]),
        currentStep: Number(data[i][5] || 1),
        roleModelName: String(data[i][6] || ''),
        roleModelJob: String(data[i][7] || ''),
        roleModelReason: String(data[i][8] || ''),
        jobDescription: String(data[i][9] || ''),
        competencies: String(data[i][10] || ''),
        careerHistory: String(data[i][11] || ''),
        strengths: String(data[i][12] || ''),
        values: String(data[i][13] || ''),
        challengeExperience: String(data[i][14] || ''),
        chatbotPurposes: String(data[i][15] || ''),
        targetUser: String(data[i][16] || ''),
        expectedOutcome: String(data[i][17] || ''),
        personality: String(data[i][18] || ''),
        speakingStyle: String(data[i][19] || ''),
        honorificStyle: String(data[i][20] || ''),
        desiredFeeling: String(data[i][21] || ''),
        answerLength: String(data[i][22] || ''),
        answerElements: String(data[i][23] || ''),
        chatbotName: String(data[i][24] || ''),
        initialPrompt: String(data[i][25] || ''),
        revisedPrompt: String(data[i][26] || ''),
        finalPrompt: String(data[i][27] || ''),
        createdAt: String(data[i][28] || ''),
        updatedAt: String(data[i][29] || '')
      });
    }
  }
  return { success: true, list: list };
}

function updateRoster(ss, rosterItems, mode) {
  var sheet=ss.getSheetByName('Roster');
  if (!Array.isArray(rosterItems)) throw new Error('학생 명단 형식을 확인해 주세요.');
  var items=rosterItems.map(function(item){
    var key=studentKey_(item), name=String(item.name || '').trim();
    if (!name) throw new Error('학생 이름이 필요합니다.');
    var parts=key.split('-');
    return {key:key,patch:{grade:Number(parts[0]),class:Number(parts[1]),number:Number(parts[2]),name:name,googleId:String(item.googleId || '').trim()}};
  });
  var incoming={}; items.forEach(function(item){if(incoming[item.key])throw new Error('명단에 중복 학번이 있습니다.');incoming[item.key]=true;});
  if (mode === 'replace') {
    var data=readTable_(sheet), map=getHeaderMap(sheet);
    data.slice(1).forEach(function(row,i){
      try {var key=studentKey_({grade:getValByHeader(row,map,['grade']),classNum:getValByHeader(row,map,['class']),number:getValByHeader(row,map,['number'])});}
      catch(e){return;}
      if(!incoming[key])writePatch_(sheet,i+2,{grade:'',class:'',number:'',name:'',googleId:''});
    });
  }
  var added=0;
  items.forEach(function(item){
    var existing=matchingRows_(sheet,item.key);
    if(!existing.length){writePatch_(sheet,-1,item.patch);added++;}
    else if(mode==='replace')existing.forEach(function(entry){writePatch_(sheet,entry.index,item.patch);});
  });
  return {success:true,count:mode==='replace'?items.length:added,mode:mode,message:'학생 명단이 반영되었습니다.'};
}
function deleteRosterStudents(ss, students) {
  var sheet=ss.getSheetByName('Roster'), count=0;
  (students || []).forEach(function(student){
    matchingRows_(sheet,studentKey_(student)).sort(function(a,b){return b.index-a.index;}).forEach(function(entry){
      var known=schemas_().Roster.map(headerName_);
      var hasExtra=physicalHeaders_(sheet).some(function(h){return known.indexOf(headerName_(h))===-1;});
      if(hasExtra)writePatch_(sheet,entry.index,{grade:'',class:'',number:'',name:'',googleId:''});
      else sheet.deleteRow(entry.index);
      count++;
    });
  });
  return {success:true,deletedCount:count,message:'선택한 학생이 명단에서 삭제되었습니다.'};
}

function getAdminDashboard(ss) {
  var rosterSheet = ss.getSheetByName('Roster');
  var progressSheet = ss.getSheetByName('Progress');
  var testSheet = ss.getSheetByName('Tests');
  var subSheet = ss.getSheetByName('Submissions');
  
  var rosterList = [];
  var rosterKeys = {};
  if (rosterSheet) {
    var rData = readTable_(rosterSheet);
    for (var i = 1; i < rData.length; i++) {
      var g = parseInt(rData[i][0]);
      var c = parseInt(rData[i][1]);
      var n = parseInt(rData[i][2]);
      var nm = String(rData[i][3] || '').trim();
      var gid = String(rData[i][4] || '').trim();
      if (!isNaN(g) && !isNaN(c) && !isNaN(n) && nm) {
        var key = g + '-' + c + '-' + n;
        rosterKeys[key] = true;
        rosterList.push({ grade: g, classNum: c, number: n, name: nm, googleId: gid, studentKey: key });
      }
    }
  }

  var progressMap = {};
  if (progressSheet) {
    var pData = latestTable_(progressSheet);
    for (var j = 1; j < pData.length; j++) {
      var pKey = String(pData[j][0] || '');
      if (pKey) {
        progressMap[pKey] = {
          studentKey: pKey,
          grade: Number(pData[j][1]),
          classNum: Number(pData[j][2]),
          number: Number(pData[j][3]),
          name: String(pData[j][4] || ''),
          currentStep: Number(pData[j][5] || 1),
          roleModelName: String(pData[j][6] || ''),
          roleModelJob: String(pData[j][7] || ''),
          chatbotName: String(pData[j][24] || ''),
          initialPrompt: String(pData[j][25] || ''),
          revisedPrompt: String(pData[j][26] || ''),
          finalPrompt: String(pData[j][27] || ''),
          createdAt: String(pData[j][28] || ''),
          updatedAt: String(pData[j][29] || '')
        };
        if (!rosterKeys[pKey]) {
          rosterKeys[pKey] = true;
          rosterList.push({
            grade: Number(pData[j][1]),
            classNum: Number(pData[j][2]),
            number: Number(pData[j][3]),
            name: String(pData[j][4] || ''),
            googleId: '',
            studentKey: pKey
          });
        }
      }
    }
  }

  var testMap = {};
  if (testSheet) {
    var tData = latestTable_(testSheet);
    for (var k = 1; k < tData.length; k++) {
      var tKey = String(tData[k][0] || '');
      if (tKey) {
        testMap[tKey] = {
          test1Result: String(tData[k][1] || ''),
          test2Result: String(tData[k][2] || ''),
          test3Result: String(tData[k][3] || ''),
          test4Result: String(tData[k][4] || ''),
          test5Result: String(tData[k][5] || ''),
          test6Result: String(tData[k][6] || ''),
          problemDescription: String(tData[k][7] || ''),
          revisionNote: String(tData[k][8] || ''),
          testedAt: String(tData[k][9] || '')
        };
      }
    }
  }

  var subMap = {};
  if (subSheet) {
    var sData = latestTable_(subSheet);
    if (sData.length > 1) {
      var sHeaderMap = getHeaderMap(subSheet);
      for (var m = 1; m < sData.length; m++) {
        var sRow = sData[m];
        var sKey = String(getValByHeader(sRow, sHeaderMap, ['studentKey', 'student_key', 'key']) || '').trim();
        var sGrade = parseInt(String(getValByHeader(sRow, sHeaderMap, ['grade', '학년'])).trim(), 10);
        var sClass = parseInt(String(getValByHeader(sRow, sHeaderMap, ['class', 'classNum', 'classNo', '반'])).trim(), 10);
        var sNum = parseInt(String(getValByHeader(sRow, sHeaderMap, ['number', 'num', '번호'])).trim(), 10);

        if (!sKey && !isNaN(sGrade) && !isNaN(sClass) && !isNaN(sNum) && sGrade > 0 && sClass > 0 && sNum > 0) {
          sKey = sGrade + '-' + sClass + '-' + sNum;
        }

        if (sKey) {
          var barrierAnswer = String(getValByHeader(sRow, sHeaderMap, ['barrierAnswer', 'sampleQuestion1', 'barrierQ', 'barrier', '진로장벽답변', '진로장벽']) || '');
          var barrierReflection = String(getValByHeader(sRow, sHeaderMap, ['barrierReflection', 'sampleAnswer1', 'barrierA', '진로장벽성찰']) || '');
          var decisionAnswer = String(getValByHeader(sRow, sHeaderMap, ['decisionAnswer', 'sampleQuestion2', 'decisionQ', 'decision', '진로의사결정답변', '진로선택답변']) || '');
          var decisionReflection = String(getValByHeader(sRow, sHeaderMap, ['decisionReflection', 'sampleAnswer2', 'decisionA', '진로의사결정성찰', '진로선택성찰']) || '');
          var educationAnswer = String(getValByHeader(sRow, sHeaderMap, ['educationAnswer', 'sampleQuestion3', 'educationQ', 'education', '진학설계답변', '진학답변']) || '');
          var educationReflection = String(getValByHeader(sRow, sHeaderMap, ['educationReflection', 'sampleAnswer3', 'educationA', '진학설계성찰', '진학성찰']) || '');
          var finalCareerReflection = String(getValByHeader(sRow, sHeaderMap, ['finalCareerReflection', 'reflection', 'careerReflection', '최종진로성찰', '최종성찰', '소감']) || '');
          var revisionSummary = String(getValByHeader(sRow, sHeaderMap, ['revisionSummary', 'revisionNote', 'problemDescription', '수정요약', '수정내용']) || '');
          var submittedAt = String(getValByHeader(sRow, sHeaderMap, ['submittedAt', 'createdAt', 'updatedAt', 'timestamp', 'date', '제출시간', '제출일시']) || '');
          var gemUrl = String(getValByHeader(sRow, sHeaderMap, ['gemUrl', 'gem_url', 'gem', 'gemlink', 'gem링크']) || '');

          subMap[sKey] = {
            studentKey: sKey,
            grade: !isNaN(sGrade) ? sGrade : Number(sRow[1]),
            classNum: !isNaN(sClass) ? sClass : Number(sRow[2]),
            number: !isNaN(sNum) ? sNum : Number(sRow[3]),
            name: String(getValByHeader(sRow, sHeaderMap, ['name', '이름']) || sRow[4] || ''),
            roleModelName: String(getValByHeader(sRow, sHeaderMap, ['roleModelName', 'roleModel', '롤모델이름']) || ''),
            roleModelJob: String(getValByHeader(sRow, sHeaderMap, ['roleModelJob', 'job', '롤모델직업']) || ''),
            chatbotName: String(getValByHeader(sRow, sHeaderMap, ['chatbotName', 'botName', '챗봇이름']) || ''),
            finalPrompt: String(getValByHeader(sRow, sHeaderMap, ['finalPrompt', 'prompt', '최종프롬프트']) || ''),
            gemUrl: gemUrl,
            barrierAnswer: barrierAnswer,
            barrierReflection: barrierReflection,
            decisionAnswer: decisionAnswer,
            decisionReflection: decisionReflection,
            educationAnswer: educationAnswer,
            educationReflection: educationReflection,
            finalCareerReflection: finalCareerReflection,
            revisionSummary: revisionSummary,
            sampleQuestion1: barrierAnswer,
            sampleAnswer1: barrierReflection,
            sampleQuestion2: decisionAnswer,
            sampleAnswer2: decisionReflection,
            sampleQuestion3: educationAnswer,
            sampleAnswer3: educationReflection,
            reflection: finalCareerReflection,
            submittedAt: submittedAt
          };
          if (!rosterKeys[sKey]) {
            rosterKeys[sKey] = true;
            rosterList.push({
              grade: !isNaN(sGrade) ? sGrade : Number(sRow[1]),
              classNum: !isNaN(sClass) ? sClass : Number(sRow[2]),
              number: !isNaN(sNum) ? sNum : Number(sRow[3]),
              name: String(getValByHeader(sRow, sHeaderMap, ['name', '이름']) || sRow[4] || ''),
              googleId: '',
              studentKey: sKey
            });
          }
        }
      }
    }
  }

  var studentList = [];
  var classMap = {};
  var totalStudents = rosterList.length;
  var startedStudents = 0;
  var inProgressStudents = 0;
  var promptCompletedStudents = 0;
  var testingStudents = 0;
  var submittedStudents = 0;
  var testCompletedStudents = 0;

  rosterList.sort(function(a, b) {
    if (a.grade !== b.grade) return a.grade - b.grade;
    if (a.classNum !== b.classNum) return a.classNum - b.classNum;
    return a.number - b.number;
  });

  rosterList.forEach(function(r) {
    var key = r.studentKey;
    var p = progressMap[key];
    var t = testMap[key];
    var s = subMap[key];

    var currentStep = 1;
    if (s && s.submittedAt) {
      currentStep = 10;
    } else if (p && p.currentStep) {
      currentStep = p.currentStep;
    } else if (t) {
      currentStep = 8;
    }

    var roleModelName = (p && p.roleModelName) || (s && s.roleModelName) || '';
    var roleModelJob = (p && p.roleModelJob) || (s && s.roleModelJob) || '';
    var chatbotName = (p && p.chatbotName) || (s && s.chatbotName) || '';
    var gemUrl = (s && s.gemUrl) || '';
    var submitted = Boolean(s && s.submittedAt);
    var testCompleted = Boolean(t || currentStep >= 9);
    var promptCompleted = Boolean((p && (p.finalPrompt || p.initialPrompt)) || currentStep >= 6 || submitted);
    var hasStarted = Boolean(roleModelName || currentStep > 1 || p);

    var updatedAt = (s && s.submittedAt) || (p && p.updatedAt) || (t && t.testedAt) || '';

    var studentItem = {
      studentKey: key,
      grade: r.grade,
      class: r.classNum,
      classNum: r.classNum,
      number: r.number,
      name: r.name,
      googleId: r.googleId || '',
      roleModelName: roleModelName,
      roleModelJob: roleModelJob,
      roleModelReason: (p && p.roleModelReason) || '',
      jobDescription: (p && p.jobDescription) || '',
      competencies: (p && p.competencies) || '',
      careerHistory: (p && p.careerHistory) || '',
      strengths: (p && p.strengths) || '',
      values: (p && p.values) || '',
      challengeExperience: (p && p.challengeExperience) || '',
      chatbotPurposes: (p && p.chatbotPurposes) || '',
      targetUser: (p && p.targetUser) || '',
      expectedOutcome: (p && p.expectedOutcome) || '',
      personality: (p && p.personality) || '',
      speakingStyle: (p && p.speakingStyle) || '',
      honorificStyle: (p && p.honorificStyle) || '',
      desiredFeeling: (p && p.desiredFeeling) || '',
      answerLength: (p && p.answerLength) || '',
      answerElements: (p && p.answerElements) || '',
      chatbotName: chatbotName,
      initialPrompt: (p && p.initialPrompt) || '',
      revisedPrompt: (p && p.revisedPrompt) || '',
      finalPrompt: (s && s.finalPrompt) || (p && p.finalPrompt) || (p && p.revisedPrompt) || (p && p.initialPrompt) || '',
      currentStep: currentStep,
      updatedAt: updatedAt,
      promptCompleted: promptCompleted,
      testCompleted: testCompleted,
      gemUrl: gemUrl,
      submitted: submitted,
      problemDescription: (t && t.problemDescription) || '',
      revisionNote: (t && t.revisionNote) || (s && s.revisionSummary) || '',
      testedAt: (t && t.testedAt) || '',
      sampleQuestion1: (s && s.sampleQuestion1) || '',
      sampleAnswer1: (s && s.sampleAnswer1) || '',
      sampleQuestion2: (s && s.sampleQuestion2) || '',
      sampleAnswer2: (s && s.sampleAnswer2) || '',
      sampleQuestion3: (s && s.sampleQuestion3) || '',
      sampleAnswer3: (s && s.sampleAnswer3) || '',
      revisionSummary: (s && s.revisionSummary) || (t && t.revisionNote) || '',
      reflection: (s && s.reflection) || '',
      submittedAt: (s && s.submittedAt) || ''
    };
    studentList.push(studentItem);

    var cKey = r.grade + '-' + r.classNum;
    if (!classMap[cKey]) {
      classMap[cKey] = {
        grade: r.grade,
        classNum: r.classNum,
        total: 0,
        notStarted: 0,
        inProgress: 0,
        promptCompleted: 0,
        testing: 0,
        submitted: 0
      };
    }
    var cStat = classMap[cKey];
    cStat.total++;

    if (submitted) {
      submittedStudents++;
      cStat.submitted++;
    } else if (testCompleted || currentStep >= 8) {
      testingStudents++;
      testCompletedStudents++;
      cStat.testing++;
    } else if (promptCompleted || currentStep >= 6) {
      promptCompletedStudents++;
      cStat.promptCompleted++;
    } else if (hasStarted) {
      inProgressStudents++;
      cStat.inProgress++;
    } else {
      cStat.notStarted++;
    }

    if (hasStarted) {
      startedStudents++;
    }
  });

  var byClassList = Object.keys(classMap).map(function(k) {
    return classMap[k];
  }).sort(function(a, b) {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.classNum - b.classNum;
  });

  return {
    success: true,
    data: {
      totalStudents: totalStudents,
      startedStudents: startedStudents,
      inProgressStudents: inProgressStudents,
      promptCompletedStudents: promptCompletedStudents,
      testingStudents: testingStudents,
      submittedStudents: submittedStudents,
      gemCreatedStudents: studentList.filter(function(st) { return st.currentStep >= 7; }).length,
      testCompletedStudents: testCompletedStudents,
      finalSubmittedStudents: submittedStudents,
      byClass: byClassList,
      students: studentList,
      roster: rosterList
    }
  };
}

function getStudentDetail(ss, studentKey) {
  studentKey = studentKey_(studentKey);
  if (!studentKey) return { success: false, message: 'studentKey가 필요합니다.' };

  var parts = studentKey.split('-');
  var parsedGrade = parts.length >= 3 ? Number(parts[0]) : 0;
  var parsedClass = parts.length >= 3 ? Number(parts[1]) : 0;
  var parsedNumber = parts.length >= 3 ? Number(parts[2]) : 0;

  var progressRes = loadProgress(ss, studentKey);
  var p = (progressRes && progressRes.data) || {};

  var grade = Number(p.grade || parsedGrade || 1);
  var classNum = Number(p.class || parsedClass || 1);
  var number = Number(p.number || parsedNumber || 1);
  var name = String(p.name || '').trim();
  var studentGoogleId = String(p.googleId || '').trim();

  var rosterSheet = ss.getSheetByName('Roster');
  if (rosterSheet) {
    var rData = readTable_(rosterSheet);
    for (var i = 1; i < rData.length; i++) {
      if (
        String(rData[i][0]) === studentKey ||
        (Number(rData[i][0]) === grade && Number(rData[i][1]) === classNum && Number(rData[i][2]) === number)
      ) {
        if (!name) name = String(rData[i][3] || '').trim();
        if (!studentGoogleId) studentGoogleId = String(rData[i][4] || '').trim();
        break;
      }
    }
  }

  // Load Tests
  var testsObj = {
    test1: { result: '', note: '' },
    test2: { result: '', note: '' },
    test3: { result: '', note: '' },
    test4: { result: '', note: '' },
    test5: { result: '', note: '' },
    test6: { result: '', note: '' }
  };
  var problemDescription = '';
  var revisionNote = '';
  var testedAt = '';

  var testSheet = ss.getSheetByName('Tests');
  if (testSheet) {
    var tData = latestTable_(testSheet);
    for (var j = 1; j < tData.length; j++) {
      var rowKey = String(tData[j][0] || '').trim();
      if (rowKey === studentKey || (parsedGrade && rowKey === (grade + '-' + classNum + '-' + number))) {
        testsObj.test1 = { result: String(tData[j][1] || ''), note: '' };
        testsObj.test2 = { result: String(tData[j][2] || ''), note: '' };
        testsObj.test3 = { result: String(tData[j][3] || ''), note: '' };
        testsObj.test4 = { result: String(tData[j][4] || ''), note: '' };
        testsObj.test5 = { result: String(tData[j][5] || ''), note: '' };
        testsObj.test6 = { result: String(tData[j][6] || ''), note: '' };
        problemDescription = String(tData[j][7] || '');
        revisionNote = String(tData[j][8] || '');
        testedAt = String(tData[j][9] || '');
        break;
      }
    }
  }

  // Load Submissions
  var subDataLoaded = getStudentSubmission(ss, studentKey);
  var subObj = subDataLoaded || {
    gemUrl: '',
    barrierAnswer: '',
    barrierReflection: '',
    decisionAnswer: '',
    decisionReflection: '',
    educationAnswer: '',
    educationReflection: '',
    finalCareerReflection: '',
    revisionSummary: '',
    submittedAt: ''
  };
  if (subDataLoaded && subDataLoaded.name && !name) {
    name = subDataLoaded.name;
  }

  function toArr(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return String(val).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  }

  var currentStep = Number(p.currentStep || (subObj.gemUrl || subObj.submittedAt ? 10 : (testedAt ? 8 : 1)));
  var initialPrompt = p.initialPrompt || '';
  var revisedPrompt = p.revisedPrompt || '';
  var finalPrompt = p.finalPrompt || '';
  if (!finalPrompt && revisedPrompt) finalPrompt = revisedPrompt;
  if (!finalPrompt && initialPrompt) finalPrompt = initialPrompt;

  var progressData = {
    stepData: p.stepData || {},
    currentStep: currentStep,
    roleModelName: p.roleModelName || '',
    roleModelJob: p.roleModelJob || '',
    roleModelReason: p.roleModelReason || '',
    jobDescription: p.jobDescription || '',
    competencies: toArr(p.competencies).join(', '),
    careerHistory: p.careerHistory || '',
    strengths: toArr(p.strengths).join(', '),
    values: toArr(p.values).join(', '),
    challengeExperience: p.challengeExperience || '',
    chatbotPurposes: toArr(p.chatbotPurposes).join(', '),
    targetUser: p.targetUser || '이 직업에 관심 있는 중학생',
    expectedOutcome: p.expectedOutcome || '',
    personality: toArr(p.personality).join(', '),
    speakingStyle: p.speakingStyle || '멘토처럼 따뜻하게',
    honorificStyle: p.honorificStyle || '친근한 존댓말',
    desiredFeeling: p.desiredFeeling || '',
    answerLength: p.answerLength || 'medium',
    answerElements: toArr(p.answerElements).join(', '),
    chatbotName: p.chatbotName || '',
    initialPrompt: initialPrompt,
    revisedPrompt: revisedPrompt,
    finalPrompt: finalPrompt,
    createdAt: p.createdAt || subObj.submittedAt || '',
    updatedAt: subObj.submittedAt || p.updatedAt || testedAt || ''
  };

  var testsData = {
    step8: (p.tests && p.tests.step8) || {},
    test1Result: testsObj.test1.result,
    test2Result: testsObj.test2.result,
    test3Result: testsObj.test3.result,
    test4Result: testsObj.test4.result,
    test5Result: testsObj.test5.result,
    test6Result: testsObj.test6.result,
    problemDescription: problemDescription,
    revisionNote: revisionNote,
    testedAt: testedAt
  };

  var studentInfo = {
    grade: Number(grade || 1),
    class: Number(classNum || 1),
    classNum: Number(classNum || 1),
    number: Number(number || 1),
    name: String(name || '').trim(),
    studentKey: studentKey,
    googleId: studentGoogleId
  };

  var studentDetailFull = {
    studentKey: studentKey,
    grade: Number(grade || 1),
    classNum: Number(classNum || 1),
    number: Number(number || 1),
    name: String(name || '').trim(),
    googleId: studentGoogleId,
    currentStep: currentStep,
    step1: {
      roleModelName: p.roleModelName || '',
      roleModelJob: p.roleModelJob || '',
      roleModelReason: p.roleModelReason || '',
      jobDescription: p.jobDescription || '',
      competencies: toArr(p.competencies),
      competencyCustom: '',
      careerHistory: p.careerHistory || '',
      strengths: toArr(p.strengths),
      strengthCustom: '',
      values: toArr(p.values),
      valueCustom: '',
      challengeExperience: p.challengeExperience || ''
    },
    step2: {
      chatbotPurposes: toArr(p.chatbotPurposes),
      targetUser: p.targetUser || '이 직업에 관심 있는 중학생',
      targetUserCustom: '',
      expectedOutcome: p.expectedOutcome || '',
      purposeSummarySentence: ''
    },
    step3: {
      personalities: toArr(p.personality),
      speakingStyle: p.speakingStyle || '멘토처럼 따뜻하게',
      honorificStyle: p.honorificStyle || '친근한 존댓말',
      desiredFeeling: p.desiredFeeling || '',
      personalityRulesSummary: ''
    },
    step4: {
      answerLength: p.answerLength || 'medium',
      answerElements: toArr(p.answerElements)
    },
    step5: {
      quizAnswer: 'C',
      quizPassed: true,
      agreedToRules: currentStep >= 5,
      checkedFactualityRules: [true, true, true, true, true],
      checkedDisclaimer: true,
      checkedSafetyRules: [true, true, true, true],
      allRulesChecked: true
    },
    step6: {
      chatbotName: p.chatbotName || '',
      initialPrompt: initialPrompt,
      revisedPrompt: revisedPrompt,
      finalPrompt: finalPrompt,
      isConfirmed: Boolean(finalPrompt || initialPrompt)
    },
    step8: {
      tests: testsObj,
      problemDescription: problemDescription,
      revisionNote: revisionNote,
      testedAt: testedAt
    },
    step10: subObj,
    createdAt: p.createdAt || subObj.submittedAt || new Date().toISOString(),
    updatedAt: subObj.submittedAt || p.updatedAt || testedAt || new Date().toISOString(),
    isPromptCompleted: Boolean(finalPrompt || initialPrompt || currentStep >= 6),
    isTestCompleted: Boolean(testedAt || currentStep >= 9),
    isGemSubmitted: Boolean(subObj.gemUrl),
    isFinalSubmitted: Boolean(subObj.submittedAt)
  };

  return {
    success: true,
    studentKey: studentKey,
    student: studentInfo,
    progress: progressData,
    tests: testsData,
    submission: subObj,
    data: {
      student: studentInfo,
      progress: progressData,
      tests: testsData,
      submission: subObj,
      detail: studentDetailFull
    }
  };
}

