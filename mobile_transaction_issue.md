# FinTrack Mobile Production Issue: Transactions Failing to Load

## 1. Problem Description
The FinTrack mobile application exhibits a critical bug exclusively on the standalone Android APK (Release Build) where the transaction list fails to load.
*   **Expo Go (Development):** Fully functional. Connects to the new Render production backend and loads both templates and transactions successfully.
*   **Standalone APK (Production):** Successfully authenticates and loads templates, but silently fails to load any transactions (the list remains entirely empty).
*   **Other details:** Logging out and logging back in does not resolve the issue on the standalone APK.

---

## 2. Identified and Fixed Issues (Already Addressed)

During the debugging process, we identified and deployed fixes for two known culprits in the `packages/shared/src/api-client.ts` file:

### A. The `URLSearchParams` Crash (React Native Polyfill Bug)
*   **The Issue:** The `transactionsApi.list` function was originally constructing query parameters using `new URLSearchParams({ ...params })`. While this works perfectly in Expo Go and web browsers, React Native's Android release runtime (Hermes/JSC) strictly throws a `TypeError` when an object is passed to this constructor.
*   **The Consequence:** Because the UI component (`index.tsx`) wraps the API call in a `try/catch` block that silently swallows errors (`catch { setTransactions([]) }`), this local crash caused the app to immediately set the transaction list to empty without ever making the network request.
*   **The Fix:** We completely removed the `URLSearchParams` dependency and replaced it with a manual, foolproof string builder using `encodeURIComponent()`.

### B. Aggressive OkHttp Caching
*   **The Issue:** Android's native OkHttp client can aggressively cache `GET` requests, sometimes serving stale empty responses from a previous build or disconnected state.
*   **The Fix:** We injected `Cache-Control: no-cache` and `Pragma: no-cache` headers into the global API client configuration.

---

## 3. Root Cause Analysis: Why is it STILL failing?

Since the APK was rebuilt with the fixes above and the issue still persists, the silent failure must be caused by one of the following remaining factors:

### Suspect 1: Stale `fintrack_ledger_id` in AsyncStorage (Most Likely)
*   **How it happens:** The app persists the user's last active ledger ID in the device's local storage (`AsyncStorage`).
*   **The Bug:** The `logout` function currently **does not clear** the `fintrack_ledger_id` from storage.
*   **The Consequence:** If you previously tested the app with a different database (e.g., a local staging DB), your phone might still have `fintrack_ledger_id = "1"` saved. When you log in to the new Render production DB, the app tries to fetch transactions for Ledger "1". If Ledger "1" belongs to someone else or doesn't exist in the new DB, the backend will return an empty list `[]` (or a 403 Forbidden error, which is caught and silently ignored). 

### Suspect 2: OkHttp Network Timeout
*   **How it happens:** The Render free-tier backend takes time to wake up from sleep.
*   **The Bug:** Expo Go has a very forgiving network timeout, but the standalone Android APK (OkHttp) enforces a strict timeout (often 10-15 seconds).
*   **The Consequence:** If the backend takes 20 seconds to wake up, the APK's request times out and throws a "Network request failed" error, which the silent `catch` block swallows, resulting in an empty transaction list.

### Suspect 3: Unhandled 400/500 Backend Rejections
*   **How it happens:** The query parameters (like `date_from=2026-07-01`) are sent to the Go backend. 
*   **The Bug:** If the Go backend database driver (Neon/Postgres) rejects the date format or user context, it returns a 500 error. The `api-client.ts` wrapper throws a JavaScript Error on non-200 responses.
*   **The Consequence:** The UI's `catch` block silently intercepts this error and displays an empty screen.

---

## 4. Immediate Actionable Steps for the Developer

To permanently resolve this and uncover the exact failure point, please follow these steps:

### Step 1: Wipe Stale App Data
Force the app to forget any old ledger IDs that survived logouts.
1. On your Android phone, go to **Settings** > **Apps** > **Fintrack**.
2. Tap **Storage**.
3. Tap **Clear Data** (or Clear Storage). 
4. Re-open the app and log in.

### Step 2: Surface the Silent Errors
I have already uncommented the `Alert.alert` inside the `catch` block of `apps/mobile/app/(tabs)/index.tsx`. 
If clearing the app data (Step 1) does not fix the issue, you must trigger **one final EAS build**. 
When you install that build, instead of silently failing, a visible popup will appear on your phone screen stating exactly why the transaction API failed (e.g., "Network request failed", "403 Forbidden", etc.).

### Step 3: Check Render Backend Logs
While you have the app open on your phone, monitor your Render dashboard logs. When you open the Transactions screen, check if the backend actually receives a request like:
`GET /api/transactions?date_from=...`
If it receives the request but returns a `500` or `400` status, the bug is in the Go backend's request parsing. If it never receives the request, the bug is local to the Android network client.
