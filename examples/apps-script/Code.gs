const RAW_SHEET = 'Sheet1';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('WhatsApp Flows')
    .addItem('Settings', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('WhatsApp Flow Trigger Settings')
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

function initializeTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RAW_SHEET);
  
  if (!sheet) {
    return "Error: Sheet named '" + RAW_SHEET + "' not found.";
  }

  // Setup Triggers
  const triggers = ScriptApp.getProjectTriggers();
  let hasOnChange = false;

  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'triggerWebhook') {
      hasOnChange = true;
    } else {
      // Clean up old triggers
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  if (!hasOnChange) {
    ScriptApp.newTrigger('triggerWebhook').forSpreadsheet(ss).onChange().create();
  }
  
  // Set initial last processed row
  const props = PropertiesService.getDocumentProperties();
  if (!props.getProperty('lastProcessedRow')) {
    props.setProperty('lastProcessedRow', sheet.getLastRow() > 1 ? sheet.getLastRow().toString() : '1');
  }

  return "Trigger Initialized! Listening for new rows.";
}

function triggerWebhook(e) {
  // Only trigger on INSERT_ROW or generic change
  if (e && e.changeType && !['INSERT_ROW', 'EDIT'].includes(e.changeType)) {
    return;
  }

  const props = PropertiesService.getDocumentProperties();
  const webhookUrl = props.getProperty('webhookUrl');
  
  if (!webhookUrl) return; // No webhook configured

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RAW_SHEET);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  let lastProcessedRow = parseInt(props.getProperty('lastProcessedRow') || '1', 10);
  
  if (lastRow <= lastProcessedRow) {
    return; // No new rows
  }

  // Get Headers
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Get all new rows
  const newRows = sheet.getRange(lastProcessedRow + 1, 1, lastRow - lastProcessedRow, sheet.getLastColumn()).getValues();

  // Process each new row
  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    
    // Create JSON payload
    let payload = {};
    for (let j = 0; j < headers.length; j++) {
      let key = headers[j];
      if (key) {
        // Clean key name slightly (optional)
        key = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        payload[key] = row[j];
      }
    }
    
    // Add raw original data mapping
    payload.raw_data = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) payload.raw_data[headers[j]] = row[j];
    }

    sendWebhook(webhookUrl, payload);
  }

  // Update last processed row
  props.setProperty('lastProcessedRow', lastRow.toString());
}

function sendWebhook(url, payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log("Webhook failed: " + e.message);
  }
}
