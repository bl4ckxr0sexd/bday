/**
 * ============================================================================
 *  BIRTHDAY INVITE — DATA RECEIVER  (Google Apps Script)
 * ============================================================================
 *
 *  This script receives the JSON events sent by index.html and logs each one
 *  as a new row in a Google Sheet. Runs 100% free on Google's servers.
 *
 *  ─────────────────────────  SETUP (5 minutes)  ─────────────────────────
 *
 *  1. Create a new Google Sheet (sheets.new). This is where data lands.
 *
 *  2. In that Sheet:  Extensions ▸ Apps Script.
 *       - Delete any sample code.
 *       - Paste THIS ENTIRE FILE in.
 *       - Click the Save (💾) icon.
 *
 *  3. Deploy it as a Web App:
 *       - Click "Deploy" ▸ "New deployment".
 *       - Click the gear ⚙ next to "Select type" ▸ choose "Web app".
 *       - Description:      Birthday tracker
 *       - Execute as:       Me
 *       - Who has access:   Anyone            <-- IMPORTANT (allows the page to POST)
 *       - Click "Deploy", then "Authorize access" and approve the permissions.
 *
 *  4. Copy the "Web app URL" it gives you (ends in /exec).
 *       - Paste that URL into TRACKING_ENDPOINT in index.html.
 *
 *  5. (Optional) Open your landing page to test — a new row should appear.
 *
 *  NOTE: Every time you EDIT this script, you must "Deploy ▸ Manage
 *  deployments ▸ (edit) ▸ New version" for changes to go live. The /exec
 *  URL stays the same across versions.
 * ============================================================================
 */

// Name of the tab (worksheet) to write into. Auto-created if missing.
var SHEET_NAME = 'Visitors';

// The column order for the log. Keep in sync with rowFromData() below.
var HEADERS = [
  'Received At',   // when the server logged it
  'Event',         // "page_view" or "download_click"
  'Visitor Type',  // "new" or "returning"
  'Is Unique',
  'Visit Count',
  'IP Address',
  'ISP / Org',
  'Country',
  'Region',
  'City',
  'Client Time',   // human-readable timestamp from the browser
  'Page URL',
  'Referrer',
  'Language',
  'User Agent'
];

/**
 * doPost — entry point. Google calls this automatically for every POST
 * request the Web App receives.
 */
function doPost(e) {
  try {
    var data = parseIncoming(e);
    writeRow(data);
    return jsonResponse({ status: 'success' });
  } catch (err) {
    // Log server-side for debugging (View ▸ Executions in the editor).
    console.error('doPost error: ' + err + ' | raw: ' + (e && e.postData ? e.postData.contents : 'n/a'));
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

/**
 * doGet — lets you open the /exec URL in a browser to confirm it's live.
 * Not required for tracking, but handy for a quick sanity check.
 */
function doGet() {
  return jsonResponse({ status: 'ok', message: 'Birthday tracker is live. POST events here.' });
}

/**
 * Parse the request body into an object. The page sends JSON as text/plain,
 * so we JSON.parse the raw contents.
 */
function parseIncoming(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Empty request body');
  }
  return JSON.parse(e.postData.contents);
}

/**
 * Append one row to the sheet, creating the tab + header row if needed.
 * A Lock prevents two simultaneous requests from clobbering each other.
 */
function writeRow(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // wait up to 20s for other writes to finish
  try {
    var sheet = getOrCreateSheet();
    sheet.appendRow(rowFromData(data));
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get the target sheet/tab; create it with a styled header row if absent.
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var header = sheet.getRange(1, 1, 1, HEADERS.length);
    header.setValues([HEADERS]);
    header.setFontWeight('bold').setBackground('#ff6b8a').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Map the incoming data object to a row array in HEADERS order.
 * Missing fields fall back to '' so the row shape is always consistent.
 */
function rowFromData(data) {
  return [
    new Date(),                       // Received At (server time)
    pick(data.event),
    pick(data.visitorType),
    data.isUnique === true ? 'YES' : (data.isUnique === false ? 'NO' : ''),
    pick(data.visitCount),
    pick(data.ip),
    pick(data.isp),
    pick(data.country),
    pick(data.region),
    pick(data.city),
    pick(data.timestamp),             // Client Time (human-readable)
    pick(data.page),
    pick(data.referrer),
    pick(data.language),
    pick(data.userAgent)
  ];
}

/** Return the value, or '' if it's null/undefined. */
function pick(value) {
  return (value === null || value === undefined) ? '' : value;
}

/** Build a JSON response with the correct MIME type. */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
