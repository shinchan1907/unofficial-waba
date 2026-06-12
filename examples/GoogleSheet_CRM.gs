/**
 * WhatsApp Server Automation - Production Google Apps Script
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Click Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Create two tabs in your Sheet: 'Sheet1' and 'Settings'
 * 5. Deploy as Web App and copy the URL to your WA Server Dashboard.
 */

const SHEET_NAME = 'Sheet1';
const SETTINGS_NAME = 'Settings';

// Adds a Custom Menu to your Google Sheet
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('WhatsApp Admin')
    .addItem('Send Initial Messages', 'sendInitialMessages')
    .addItem('Check & Send Follow-ups', 'checkFollowUps')
    .addToUi();
}

// Helper to pull settings from the Settings tab
function getSetting(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_NAME);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

// Sends Message via WA Server API
function sendWhatsAppMessage(number, message) {
  const apiUrl = getSetting('API_URL');
  const apiKey = getSetting('API_KEY');
  const accountId = getSetting('ACCOUNT_ID');

  const payload = {
    account: accountId,
    number: String(number).replace(/[^0-9]/g, ''),
    message: message
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey },
    payload: JSON.stringify(payload)
  };

  try {
    const res = UrlFetchApp.fetch(`${apiUrl}/messages/send`, options);
    const data = JSON.parse(res.getContentText());
    return data.msgId || "SENT";
  } catch (e) {
    Logger.log("Error sending message: " + e.message);
    return null;
  }
}

// Triggered via Menu UI: Sends Initial Messages
function sendInitialMessages() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const phoneCol = headers.indexOf('phone_number');
  const statusCol = headers.indexOf('status');
  const msgIdCol = headers.indexOf('message_id');
  const timeCol = headers.indexOf('last_updated');
  
  const template = getSetting('INITIAL_TEMPLATE');

  for (let i = 1; i < data.length; i++) {
    const status = data[i][statusCol];
    const number = data[i][phoneCol];
    
    // Only send to empty/pending statuses
    if (!status && number) {
      const msgId = sendWhatsAppMessage(number, template);
      if (msgId) {
        sheet.getRange(i + 1, statusCol + 1).setValue('SENT_INITIAL');
        sheet.getRange(i + 1, msgIdCol + 1).setValue(msgId);
        sheet.getRange(i + 1, timeCol + 1).setValue(new Date().toISOString());
      }
    }
  }
}

// Check for Follow-ups (Triggered Hourly via Triggers)
function checkFollowUps() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const phoneCol = headers.indexOf('phone_number');
  const statusCol = headers.indexOf('status');
  const timeCol = headers.indexOf('last_updated');
  
  const template = getSetting('FOLLOWUP_TEMPLATE');
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const status = data[i][statusCol];
    const lastUpdateStr = data[i][timeCol];
    const number = data[i][phoneCol];

    // If sent initial, but NO Read or Reply status yet
    if (status === 'SENT_INITIAL' && lastUpdateStr) {
      const lastUpdate = new Date(lastUpdateStr);
      const hoursDiff = Math.abs(now - lastUpdate) / 36e5; // Convert ms to hours

      // If it's been more than 3 hours
      if (hoursDiff >= 3) {
        const msgId = sendWhatsAppMessage(number, template);
        if (msgId) {
          sheet.getRange(i + 1, statusCol + 1).setValue('FOLLOWUP_SENT');
          sheet.getRange(i + 1, timeCol + 1).setValue(new Date().toISOString());
        }
      }
    }
  }
}

// Webhook Handler for Incoming Events (from WA Server)
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const eventType = payload.event; // 'message_received' or 'message_status'
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const phoneCol = data[0].indexOf('phone_number');
    const statusCol = data[0].indexOf('status');
    const timeCol = data[0].indexOf('last_updated');

    // 1. Handle Read Receipts
    if (eventType === 'message_status' && payload.status === 'READ') {
      const recipient = payload.recipient;
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][phoneCol]).includes(recipient) && data[i][statusCol] === 'SENT_INITIAL') {
          sheet.getRange(i + 1, statusCol + 1).setValue('READ');
          sheet.getRange(i + 1, timeCol + 1).setValue(new Date().toISOString());
        }
      }
    }

    // 2. Handle Incoming Replies & Auto-Responder
    if (eventType === 'message_received') {
      const sender = payload.sender;
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][phoneCol]).includes(sender)) {
          sheet.getRange(i + 1, statusCol + 1).setValue('REPLIED');
          sheet.getRange(i + 1, timeCol + 1).setValue(new Date().toISOString());
        }
      }

      // Check Non-Working Hours (6:00 PM to 9:10 AM)
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const timeAsFloat = hour + (minutes / 60);

      // Between 18.00 (6 PM) and 9.16 (9:10 AM)
      if (timeAsFloat >= 18.0 || timeAsFloat <= 9.16) {
        const offHoursMsg = getSetting('OFF_HOURS_REPLY');
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
