const RAW_SHEET = 'Sheet1';
const CRM_SHEET = 'Formatted';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WhatsApp CRM')
    .addItem('Open Dashboard', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('WhatsApp CRM Settings')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getSettings() {
  return PropertiesService.getDocumentProperties().getProperties();
}

function saveSettings(data) {
  PropertiesService.getDocumentProperties().setProperties(data);
  return true;
}

function initializeCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Formatted tab if not exists
  let crmSheet = ss.getSheetByName(CRM_SHEET);
  if (!crmSheet) {
    crmSheet = ss.insertSheet(CRM_SHEET);
    const headers = ['Date', 'Form Name', 'Platform', 'Name', 'Phone', 'Email', 'Qualification', 'Occupation', 'WA Status', 'Message ID', 'Last Updated'];
    crmSheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold')
      .setBackground('#f3f4f6');
    crmSheet.setFrozenRows(1);
    crmSheet.autoResizeColumns(1, headers.length);
  }

  // Setup Triggers
  const triggers = ScriptApp.getProjectTriggers();
  let hasOnChange = false;
  let hasHourly = false;

  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processNewLeads') hasOnChange = true;
    if (triggers[i].getHandlerFunction() === 'checkFollowUps') hasHourly = true;
  }

  if (!hasOnChange) {
    ScriptApp.newTrigger('processNewLeads').forSpreadsheet(ss).onChange().create();
  }
  if (!hasHourly) {
    ScriptApp.newTrigger('checkFollowUps').timeBased().everyHours(1).create();
  }

  return "CRM Initialized! Formatted tab created and background triggers actvated.";
}

function sendWhatsAppMessage(number, message) {
  const props = getSettings();
  if (!props.apiUrl || !props.apiKey || !props.accountId) return null;

  const payload = {
    account: props.accountId,
    number: String(number).replace(/[^0-9]/g, ''),
    message: message
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': props.apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const res = UrlFetchApp.fetch(`${props.apiUrl}/messages/send`, options);
    const data = JSON.parse(res.getContentText());
    return data.msgId || "SENT";
  } catch (e) {
    Logger.log("Error: " + e.message);
    return null;
  }
}

function processNewLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName(RAW_SHEET);
  const crmSheet = ss.getSheetByName(CRM_SHEET);
  if (!rawSheet || !crmSheet) return;

  const rawData = rawSheet.getDataRange().getValues();
  const crmData = crmSheet.getDataRange().getValues();
  
  const rawHeaders = rawData[0];
  const crmPhones = crmData.map(row => String(row[4]).replace(/[^0-9]/g, '')); // Index 4 is Phone

  const props = getSettings();
  const template = props.initialTemplate || "Hi {name}, thanks for reaching out!";

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    
    // Map columns from raw sheet dynamically based on headers
    const getVal = (colName) => {
      const idx = rawHeaders.indexOf(colName);
      return idx > -1 ? row[idx] : '';
    };

    const date = getVal('created_time');
    const formName = getVal('form_name');
    const platform = getVal('platform');
    const qualification = getVal('your_qualification_?');
    const occupation = getVal('your_occupation_?');
    const name = getVal('full_name');
    const phone = getVal('phone_number');
    const email = getVal('email');

    if (!phone) continue;

    const cleanPhone = String(phone).replace(/[^0-9]/g, '');

    // Check if lead already exists in Formatted tab
    if (!crmPhones.includes(cleanPhone) && cleanPhone !== '') {
      
      // Personalize message
      const personalizedMsg = template.replace(/{name}/gi, name || "there");
      
      // Send WA Message
      const msgId = sendWhatsAppMessage(cleanPhone, personalizedMsg);
      const status = msgId ? 'SENT_INITIAL' : 'FAILED';
      
      // Append to Formatted Tab
      // ['Date', 'Form Name', 'Platform', 'Name', 'Phone', 'Email', 'Qualification', 'Occupation', 'WA Status', 'Message ID', 'Last Updated']
      crmSheet.appendRow([
        date || new Date().toISOString(),
        formName,
        platform,
        name,
        cleanPhone,
        email,
        qualification,
        occupation,
        status,
        msgId || '',
        new Date().toISOString()
      ]);
      
      // Add to our local array to prevent duplicates in same run
      crmPhones.push(cleanPhone);
    }
  }
}

function checkFollowUps() {
  const crmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CRM_SHEET);
  if (!crmSheet) return;

  const data = crmSheet.getDataRange().getValues();
  const props = getSettings();
  const template = props.followupTemplate;
  if (!template) return;

  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const status = data[i][8]; // WA Status
    const phone = data[i][4]; // Phone
    const lastUpdateStr = data[i][10]; // Last Updated
    const name = data[i][3]; // Name

    if (status === 'SENT_INITIAL' && lastUpdateStr) {
      const lastUpdate = new Date(lastUpdateStr);
      const hoursDiff = Math.abs(now - lastUpdate) / 36e5;

      if (hoursDiff >= 3) {
        const personalizedMsg = template.replace(/{name}/gi, name || "there");
        const msgId = sendWhatsAppMessage(phone, personalizedMsg);
        
        if (msgId) {
          crmSheet.getRange(i + 1, 9).setValue('FOLLOWUP_SENT');
          crmSheet.getRange(i + 1, 10).setValue(msgId);
          crmSheet.getRange(i + 1, 11).setValue(new Date().toISOString());
        }
      }
    }
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const eventType = payload.event;
    
    const crmSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CRM_SHEET);
    if (!crmSheet) return ContentService.createTextOutput('No CRM sheet');

    const data = crmSheet.getDataRange().getValues();

    if (eventType === 'message_status' && payload.status === 'READ') {
      const recipient = payload.recipient;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][4]).includes(recipient) && data[i][8] === 'SENT_INITIAL') {
          crmSheet.getRange(i + 1, 9).setValue('READ');
          crmSheet.getRange(i + 1, 11).setValue(new Date().toISOString());
        }
      }
    }

    if (eventType === 'message_received') {
      const sender = payload.sender;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][4]).includes(sender)) {
          crmSheet.getRange(i + 1, 9).setValue('REPLIED');
          crmSheet.getRange(i + 1, 11).setValue(new Date().toISOString());
        }
      }

      // Auto Responder logic
      const now = new Date();
      const timeAsFloat = now.getHours() + (now.getMinutes() / 60);
      if (timeAsFloat >= 18.0 || timeAsFloat <= 9.16) {
        const offHoursMsg = getSettings().offHoursReply;
        if (offHoursMsg) {
          sendWhatsAppMessage(sender, offHoursMsg);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.message})).setMimeType(ContentService.MimeType.JSON);
  }
}
