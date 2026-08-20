/**
 * Returns complete Google Apps Script code ready to be pasted into
 * Google Sheets > Extensions > Apps Script and deployed as a Web App.
 */
export function getGoogleAppsScriptCode(): string {
  return `/**
 * 나의 롤모델 챗봇 만들기 - Google Apps Script 백엔드
 * 
 * [시트 구성 안내]
 * 1. Roster: grade, class, number, name
 * 2. Progress: studentKey, grade, class, number, name, currentStep, roleModelName, roleModelJob, roleModelReason, jobDescription, competencies, careerHistory, strengths, values, challengeExperience, chatbotPurposes, targetUser, expectedOutcome, personality, speakingStyle, honorificStyle, desiredFeeling, answerLength, answerElements, chatbotName, initialPrompt, revisedPrompt, finalPrompt, createdAt, updatedAt
 * 3. Tests: studentKey, test1Result, test2Result, test3Result, test4Result, test5Result, test6Result, problemDescription, revisionNote, testedAt
 * 4. Submissions: submittedAt, grade, class, number, name, roleModelName, roleModelJob, chatbotName, finalPrompt, gemUrl, sampleQuestion1, sampleAnswer1, sampleQuestion2, sampleAnswer2, sampleQuestion3, sampleAnswer3, revisionSummary, reflection
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
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
    initSheetsIfNeeded(ss);
    
    var result = { success: true };
    
    if (action === 'verifyStudent') {
      result = verifyStudent(ss, params);
    } else if (action === 'getRosterOptions') {
      result = getRosterOptions(ss);
    } else if (action === 'getProgress') {
      result = getProgress(ss, params.studentKey);
    } else if (action === 'saveProgress') {
      result = saveProgress(ss, params.progress);
    } else if (action === 'submitFinal') {
      result = submitFinal(ss, params.submission);
    } else if (action === 'getAllProgress') {
      result = getAllProgress(ss);
    } else if (action === 'updateRoster') {
      result = updateRoster(ss, params.roster, params.mode);
    } else {
      result = { success: false, message: '알 수 없는 요청입니다.' };
    }
    
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: err.toString() }));
  }
  
  return output;
}

function initSheetsIfNeeded(ss) {
  var sheetNames = ['Roster', 'Progress', 'Tests', 'Submissions'];
  var headers = {
    'Roster': ['grade', 'class', 'number', 'name'],
    'Progress': ['studentKey', 'grade', 'class', 'number', 'name', 'currentStep', 'roleModelName', 'roleModelJob', 'roleModelReason', 'jobDescription', 'competencies', 'careerHistory', 'strengths', 'values', 'challengeExperience', 'chatbotPurposes', 'targetUser', 'expectedOutcome', 'personality', 'speakingStyle', 'honorificStyle', 'desiredFeeling', 'answerLength', 'answerElements', 'chatbotName', 'initialPrompt', 'revisedPrompt', 'finalPrompt', 'createdAt', 'updatedAt'],
    'Tests': ['studentKey', 'test1Result', 'test2Result', 'test3Result', 'test4Result', 'test5Result', 'test6Result', 'problemDescription', 'revisionNote', 'testedAt'],
    'Submissions': ['submittedAt', 'grade', 'class', 'number', 'name', 'roleModelName', 'roleModelJob', 'chatbotName', 'finalPrompt', 'gemUrl', 'sampleQuestion1', 'sampleAnswer1', 'sampleQuestion2', 'sampleAnswer2', 'sampleQuestion3', 'sampleAnswer3', 'revisionSummary', 'reflection']
  };
  
  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers[name]);
    }
  });
}

function verifyStudent(ss, params) {
  var sheet = ss.getSheetByName('Roster');
  var data = sheet.getDataRange().getValues();
  var grade = parseInt(params.grade);
  var classNum = parseInt(params.classNum);
  var number = parseInt(params.number);
  var name = String(params.name || '').trim();
  
  for (var i = 1; i < data.length; i++) {
    var rGrade = parseInt(data[i][0]);
    var rClass = parseInt(data[i][1]);
    var rNum = parseInt(data[i][2]);
    var rName = String(data[i][3] || '').trim();
    
    if (rGrade === grade && rClass === classNum && rNum === number && rName === name) {
      var studentKey = grade + '-' + classNum + '-' + number;
      var existingProgress = getProgress(ss, studentKey);
      return {
        success: true,
        student: { grade: grade, classNum: classNum, number: number, name: name, studentKey: studentKey },
        hasExisting: existingProgress.hasData,
        progress: existingProgress.progress
      };
    }
  }
  return { success: false, message: '입력한 학생 정보를 확인할 수 없습니다. 학년, 반, 번호, 이름을 다시 확인해 주세요.' };
}

function getRosterOptions(ss) {
  var sheet = ss.getSheetByName('Roster');
  var data = sheet.getDataRange().getValues();
  var options = {}; // { grade: { classNum: [numbers] } }
  
  for (var i = 1; i < data.length; i++) {
    var g = parseInt(data[i][0]);
    var c = parseInt(data[i][1]);
    var n = parseInt(data[i][2]);
    if (!isNaN(g) && !isNaN(c) && !isNaN(n)) {
      if (!options[g]) options[g] = {};
      if (!options[g][c]) options[g][c] = [];
      if (options[g][c].indexOf(n) === -1) options[g][c].push(n);
    }
  }
  return { success: true, options: options };
}

function getProgress(ss, studentKey) {
  var sheet = ss.getSheetByName('Progress');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentKey)) {
      try {
        var rawJson = data[i][27]; // or store JSON payload
        return { success: true, hasData: true, progress: JSON.parse(rawJson) };
      } catch (e) {
        return { success: true, hasData: false };
      }
    }
  }
  return { success: true, hasData: false };
}

function saveProgress(ss, progress) {
  var sheet = ss.getSheetByName('Progress');
  var data = sheet.getDataRange().getValues();
  var studentKey = progress.studentKey;
  var rowIndex = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentKey)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  var now = new Date().toISOString();
  var rowData = [
    studentKey, progress.grade, progress.classNum, progress.number, progress.name,
    progress.currentStep,
    progress.step1 ? progress.step1.roleModelName : '',
    progress.step1 ? progress.step1.roleModelJob : '',
    progress.step1 ? progress.step1.roleModelReason : '',
    progress.step1 ? progress.step1.jobDescription : '',
    progress.step1 && progress.step1.competencies ? progress.step1.competencies.join(', ') : '',
    progress.step1 ? progress.step1.careerHistory : '',
    progress.step1 && progress.step1.strengths ? progress.step1.strengths.join(', ') : '',
    progress.step1 && progress.step1.values ? progress.step1.values.join(', ') : '',
    progress.step1 ? progress.step1.challengeExperience : '',
    progress.step2 && progress.step2.chatbotPurposes ? progress.step2.chatbotPurposes.join(', ') : '',
    progress.step2 ? progress.step2.targetUser : '',
    progress.step2 ? progress.step2.expectedOutcome : '',
    progress.step3 && progress.step3.personalities ? progress.step3.personalities.join(', ') : '',
    progress.step3 ? progress.step3.speakingStyle : '',
    progress.step3 ? progress.step3.honorificStyle : '',
    progress.step3 ? progress.step3.desiredFeeling : '',
    progress.step4 ? progress.step4.answerLength : '',
    progress.step4 && progress.step4.answerElements ? progress.step4.answerElements.join(', ') : '',
    progress.step6 ? progress.step6.chatbotName : '',
    progress.step6 ? progress.step6.initialPrompt : '',
    progress.step6 ? progress.step6.revisedPrompt : '',
    progress.step6 ? progress.step6.finalPrompt : '',
    progress.createdAt || now,
    now,
    JSON.stringify(progress)
  ];
  
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  
  return { success: true, savedAt: now };
}

function submitFinal(ss, submission) {
  var sheet = ss.getSheetByName('Submissions');
  var now = new Date().toISOString();
  sheet.appendRow([
    now, submission.grade, submission.classNum, submission.number, submission.name,
    submission.roleModelName, submission.roleModelJob, submission.chatbotName,
    submission.finalPrompt, submission.gemUrl,
    submission.sampleQuestion1, submission.sampleAnswer1,
    submission.sampleQuestion2, submission.sampleAnswer2,
    submission.sampleQuestion3, submission.sampleAnswer3,
    submission.revisionSummary, submission.reflection
  ]);
  return { success: true, submittedAt: now };
}

function getAllProgress(ss) {
  var sheet = ss.getSheetByName('Progress');
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    try {
      var jsonCol = data[i][26]; // or last col
      if (jsonCol) list.push(JSON.parse(jsonCol));
    } catch(e) {}
  }
  return { success: true, list: list };
}

function updateRoster(ss, rosterItems, mode) {
  var sheet = ss.getSheetByName('Roster');
  if (mode === 'replace') {
    sheet.clearContents();
    sheet.appendRow(['grade', 'class', 'number', 'name']);
  }
  rosterItems.forEach(function(item) {
    sheet.appendRow([item.grade, item.classNum, item.number, item.name]);
  });
  return { success: true, count: rosterItems.length };
}
`;
}
