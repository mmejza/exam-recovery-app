// =============================================================================
// Code.gs — OM Recovery Lab · Google Apps Script Backend
//
// DEPLOYMENT INSTRUCTIONS
// -----------------------
// 1. Open your Google Sheet → Extensions → Apps Script.
// 2. Paste this entire file, replacing any existing code.
// 3. Save (Ctrl + S / Cmd + S).
// 4. Click Deploy → New deployment.
//      Type:            Web app
//      Execute as:      Me
//      Who has access:  Anyone
// 5. Click Deploy and copy the Web App URL.
// 6. Use that URL as the POST target in your frontend fetch() calls.
//
// To update after code changes:
//   Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy.
// =============================================================================

// ---------------------------------------------------------------------------
// CONFIGURATION — update SHEET_NAME if you rename the tab
// ---------------------------------------------------------------------------

var SHEET_NAME = "Attempts";

// Column order must match the Attempts sheet exactly (left to right).
var COLUMNS = [
  "student_id",
  "canvas_user_id",
  "attempt_number",
  "seed",
  "module_a",
  "module_b",
  "module_c",
  "app_score",
  "recovery",
  "status",
  "started_at",
  "submitted_at"
];

// Fields that the frontend must supply in the POST body.
// canvas_user_id is optional — it may be mapped later by the instructor.
var REQUIRED_FIELDS = [
  "student_id",
  "attempt_number",
  "seed",
  "module_a",
  "module_b",
  "module_c",
  "app_score",
  "recovery"
];


// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Returns the Attempts sheet.
 * Throws a descriptive error if the tab does not exist — this surfaces
 * as { success: false, message: "..." } in the response rather than a
 * silent failure.
 */
function getAttemptsSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      'Sheet "' + SHEET_NAME + '" not found. ' +
      'Create a tab with that exact name and add the header row.'
    );
  }
  return sheet;
}

/**
 * Wraps any plain object in a JSON ContentService response.
 * Apps Script does not allow custom headers (CORS is handled separately
 * by a Cloudflare Worker proxy if needed).
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

/**
 * doPost — receives a JSON body from the frontend and appends one row
 * to the Attempts sheet.
 *
 * Expected JSON body:
 * {
 *   "student_id":      "ABC123",
 *   "canvas_user_id":  "456",
 *   "attempt_number":  1,
 *   "seed":            "98765",
 *   "module_a":        82,
 *   "module_b":        75,
 *   "module_c":        90,
 *   "app_score":       82.3,
 *   "recovery":        8.5,
 *   "status":          "submitted",              // optional — defaults to "submitted"
 *   "started_at":      "2026-04-17T10:00:00Z"   // optional — defaults to server time
 * }
 *
 * Success response:  { "success": true,  "message": "Attempt recorded" }
 * Failure response:  { "success": false, "message": "<error details>"  }
 */
function doPost(e) {
  try {
    // --- 1. Parse JSON body ---
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Request body is empty or not JSON.");
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (_) {
      throw new Error("Could not parse request body as JSON.");
    }

    // --- 2. Validate required fields ---
    var missing = REQUIRED_FIELDS.filter(function (field) {
      return data[field] === undefined || data[field] === null || data[field] === "";
    });
    if (missing.length > 0) {
      throw new Error("Missing required fields: " + missing.join(", "));
    }

    // --- 3. Build the row in column order ---
    var now = new Date();

    var row = COLUMNS.map(function (col) {
      switch (col) {
        case "status":
          // Default to "submitted" if the frontend did not specify
          return data.status || "submitted";

        case "submitted_at":
          // Always use the server timestamp for submission time
          return now.toISOString();

        case "started_at":
          // Accept a value from the frontend (app knows when the timer started)
          return data.started_at || now.toISOString();

        default:
          return data[col] !== undefined ? data[col] : "";
      }
    });

    // --- 4. Append row to sheet ---
    var sheet = getAttemptsSheet();
    sheet.appendRow(row);

    return jsonResponse({ success: true, message: "Attempt recorded" });

  } catch (err) {
    // Return a clean JSON error — never expose a raw Apps Script exception page
    return jsonResponse({ success: false, message: err.message });
  }
}
