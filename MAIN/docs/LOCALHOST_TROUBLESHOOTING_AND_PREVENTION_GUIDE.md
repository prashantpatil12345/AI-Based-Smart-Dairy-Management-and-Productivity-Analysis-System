# SmartDairy Localhost Troubleshooting and Prevention Guide

This guide is based on the current source/configuration audit and the incident history provided for SmartDairy. Historical symptoms are not treated as proof that the same defect is still active.

## 1. Executive summary

“Localhost failed” can describe several different failures:

- The browser cannot reach Vite because Vite is stopped, or the URL/port is wrong.
- Vite responds, but React crashes before it can render the page.
- React renders, but a route, authentication check, data request, or external service fails.

Those failures happen at different points and need different fixes. Restarting Vite only helps when the problem is the local development server. It cannot repair a missing React import, invalid credentials, a paused Supabase project, a database policy, or an unavailable AI service.

The active frontend root is `cow-care-chronicles-main`. Run its `npm` commands there. Vite is configured for port `8080`; because `strictPort` is not set, Vite can choose the next available port (for example, `8081`) when `8080` is occupied. Always use the `Local:` URL printed by the Vite process you just started.

The current UI uses Supabase Cloud for authentication, database/storage operations, and Edge Functions. Breed recognition calls the Supabase `breed-recognition` Edge Function, which in turn calls a hosted classifier. A local Python service exists and Vite has an `/api` proxy for it, but the current React source does not call that local API. It is not required to open the current UI or use its implemented breed-recognition flow.

During this audit, the page loaded at `http://localhost:8080/`, the Vite listener was present on port 8080, and Supabase DNS/TCP/TLS checks succeeded. An unauthenticated Supabase health request returned HTTP 401; this proves the remote endpoint responded, not that a user can sign in or that every Edge Function works.

Two narrow source changes were made:

1. Login and Google sign-in now display thrown network errors instead of allowing them to escape without a visible toast.
2. The optional Python Roboflow service no longer contains a hard-coded API-key fallback. It loads its ignored, service-local `.env` and requires the key to come from configuration. A credential-like value had been present in source; if it was real or used, rotate it with the provider. No credential value is included in this guide.

## 2. Current development setup

### Correct root and commands

The active frontend package is:

```text
C:\Users\prashantpatil\OneDrive\Documents\Desktop\SmartDairy\cow-care-chronicles-main
```

Its scripts include `dev`, `build`, `lint`, and `test`. A second Vite package also exists under `cattle-breed-classifier-webapp-master\frontend`; that is a separate app, not the main SmartDairy UI. Running commands from the wrong folder can start a different project.

The main Vite configuration:

- Binds to host `::`.
- Prefers port `8080`.
- Does not set `strictPort: true`, so Vite is allowed to try another port when the preferred port is occupied.
- Proxies `/api` to `http://localhost:8000`.

The main frontend source does not currently contain a request to `/api` or `localhost:8000`. The proxy is not evidence that a Python server is necessary for the current UI.

### Current architecture

```text
CURRENT

[Browser]
    |
    | GET HTML, JavaScript, CSS, HMR
    v
[Vite dev server: localhost:8080, or the port Vite prints]
    |
    | serves the app files
    v
[React app running in the browser]
    | \
    |  \ Auth, database queries, storage uploads, Edge Function calls
    |   \
    v    v
[Supabase Cloud: Auth + Postgres/RLS + Storage + Edge Functions]
                         |
                         | breed-recognition function sends image to
                         v
              [Hosted cattle-breed classifier]

OPTIONAL / NOT CALLED BY THE CURRENT REACT UI

[Vite /api proxy] ---> [Local Python FastAPI service: localhost:8000]
```

Vite is a development server and build tool; it does not run React on the server. The browser downloads the app, and React executes there. Supabase Cloud is remote; no local Supabase database process is needed for the current setup. A local Supabase stack would only be needed if the project intentionally chose to run Supabase locally.

The local Python service is implemented under `ml-service`. Its entry point declares port 8000 and includes Roboflow prediction routes. The current breed-recognition page instead uploads to Supabase Storage and calls the Supabase Edge Function. That function forwards the image to a hosted classifier. Therefore:

- Vite is required to serve the local frontend.
- Supabase Cloud and its configured resources are required for backend-backed app features.
- The hosted classifier is required for the current AI breed-recognition path.
- The local Python API is optional for the current React app unless the UI is deliberately changed to call its `/api` endpoint.
- A PyTorch checkpoint at `ml-service\models\best_model.pth` was not present during this audit. The local `/predict/url` route may therefore be unavailable; the current UI does not use that route.

The checked-in Supabase function sources exist under `supabase/functions`. Their handlers check for a bearer token and validate the user. The root `supabase/config.toml` also sets `verify_jwt = false` for those functions, so the function-side authentication checks matter; do not assume the platform gateway alone enforces authentication.

### Configuration observed

- The root `.env` file exists and the expected `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` names are populated. Values are intentionally not reproduced here.
- There is no `.env.example` in the active frontend root.
- `.env` is ignored by Git according to the root `.gitignore`.
- `VITE_` variables are compiled into browser-accessible frontend code. Only public/publishable values belong there; never put a service-role key or private provider credential in a `VITE_` variable.
- The optional Python service has its own ignored `ml-service\.env`. Its Roboflow integration now loads that file and reads the key from the environment; the key is not embedded in source.
- The browser does not need the Python service’s credentials.

## 3. Historical incident timeline

The “Evidence” column distinguishes source/configuration evidence from facts in the supplied incident history. When a past screenshot, network trace, or server log was not supplied, the exact historical cause is marked unconfirmed.

| Incident | Observed symptom | Confirmed root cause | Evidence | Correct resolution | Is recurrence still possible? |
|---|---|---|---|---|---|
| `ERR_CONNECTION_REFUSED` at `localhost:8080` | Browser could not connect. | At that time there was no server listening on the requested port. | The supplied history says Vite was subsequently started; the earlier investigation also found no listener before starting it. In the current audit, Vite is listening on 8080. | Start Vite from the main app root and open the exact `Local:` URL it prints. | Yes, whenever Vite is stopped, the terminal/session closes, or a different URL is used. |
| White screen after the page began loading | Browser reached a server but showed no usable page. | The historical cause cannot be confirmed from the supplied summary alone. A frontend runtime exception is a likely category, not a proven root cause for that specific event. | Current `index.html` contains `#root` and loads `/src/main.tsx`; the current browser page rendered the landing page. | Inspect the first meaningful Console error and its source location. Do not restart Vite unless evidence points to Vite. | Yes. A JavaScript exception in the React tree can still prevent rendering. |
| `Identifier 'toast' has already been declared` in `BreedRecognition.tsx` | JavaScript/TypeScript module failed to compile or load. | Duplicate declaration/import in that file, as reported in the incident history. | The current file has one `toast` import from `sonner` and no second `toast` declaration. | Remove the duplicate declaration/import, then reload and verify the module compiles. | Possible if a duplicate is reintroduced; not present in the current file. |
| Markdown fences appeared outside the app in `index.html` | Raw backticks/text appeared around the page. | Literal Markdown fence text had been pasted into HTML, as reported in the incident history. | Current `index.html` has a normal HTML document, a `#root` element, and a module script; no Markdown fence remains. | Remove accidental Markdown syntax from HTML and verify the document in Elements/View Source. | Possible if documentation text is pasted into the HTML file again; not present now. |
| Login showed `Failed to fetch` | Authentication request could not complete. | The supplied incident history confirms the configured Supabase hostname failed DNS resolution while the project was paused; the project was later resumed. | Current `.env` has the expected URL/key variable names. During this audit, DNS and TCP/443 succeeded and an unauthenticated HTTPS check received a response. | Check DNS and HTTPS first, then the Supabase project status. The project owner must confirm the project remains active. | Yes. Cloud pause/outage, DNS/network problems, or a changed/mistyped URL can recur. Current sign-in itself was not tested. |
| Dashboard blank after sign-in; `useState is not defined` at `Dashboard.tsx:21` | Dashboard component threw during render. | `useState` was used without being imported, according to the supplied incident history. | Current `Dashboard.tsx` imports `useState` from React and uses it for the `seeding` state. | Add the missing React import, then build and revisit the dashboard. | Not in the current Dashboard file; similar import mistakes remain possible elsewhere. |
| Ports varied (`8080`, `8081`, and once `5173`) | Tabs showed different ports or did not show the expected app. | The configured port is 8080 with no strict-port requirement; Vite can move if it is busy. In the earlier troubleshooting attempt, an extra positional argument was interpreted as Vite’s root, resulting in a 5173 server serving the wrong location and returning 404. | Current `vite.config.ts` declares `port: 8080` and omits `strictPort`. The earlier process log showed a 5173 Vite server; the corrected start used 8080. | Start with the plain `npm run dev` command from the main root; use the URL printed by that run. Stop only a verified stale process. | Yes. Port 8080 can be occupied, and old tabs can remain open at earlier ports. |
| Possible Python inference service on port 8000 | It was unclear whether the UI needs a separate process. | A Python FastAPI service exists, but the current React app’s breed flow calls Supabase, not localhost:8000. | Vite has an `/api` proxy and `ml-service/main.py` declares port 8000; current `src` references Supabase functions/storage and has no `/api`/localhost:8000 call. | Do not start Python to fix a frontend connection error. Start it only for a feature that actually calls its API. | Only if a future or separate client is wired to the proxy/API. It is not required by the current React UI. |

## 4. Localhost, ports, and the request path

- **`localhost`** means “this same computer.” It does not mean “the Supabase cloud server.”
- **A port** is a numbered doorway into a computer. Here Vite normally listens on `8080`; the optional Python service declares `8000`.
- **Vite** serves the development HTML/JS/CSS and provides hot reload. Its terminal must remain open while you use the app.
- **React** starts after the browser downloads the app. If React throws while importing or rendering, Vite can still be reachable while the page is blank.
- **A closed Vite terminal** usually stops the local server. The browser tab remains open but cannot reach it.
- **Port 8081** can appear when Vite cannot use 8080 and is allowed to select another port. That is not necessarily a code error.
- **A stale tab** may still point to 8080 after the app restarted on 8081, or vice versa. A stale URL can refuse the connection even though another port is working.
- **A working frontend can still fail at Supabase.** The browser-to-Vite connection and browser-to-Supabase connection are separate network paths.
- **Supabase Cloud normally needs no local database startup.** Start a local database only if the project is intentionally configured for local Supabase development.
- **Python inference is separate.** It is only required when the active page calls the local API. The current breed-recognition flow goes through Supabase Edge Functions to a hosted classifier.

## 5. Reusable error-diagnosis decision tree

Start with the exact browser symptom. Do not edit code or reinstall packages until a check points to that layer.

### A. `ERR_CONNECTION_REFUSED`

**Usually means:** Nothing accepted a connection at that host and port. This is a local server/URL problem, not a React rendering error.

1. In PowerShell, check port listeners:

   ```powershell
   $ports = 8080, 8081, 8000
   Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
     Where-Object { $ports -contains $_.LocalPort } |
     Select-Object LocalAddress, LocalPort, OwningProcess
   ```

2. No row for the port means no listener was found. Confirm the terminal running Vite is still open and shows `VITE ... ready`.
3. Confirm the current directory is the main frontend root and run `npm run dev`.
4. Open the exact `Local:` address in that terminal. If it says 8081, do not keep retrying 8080.
5. If a listener exists but the page still refuses, inspect the owning PID and bind address. `localhost`, `127.0.0.1`, and IPv6 `::1` can behave differently on some configurations.

**Do not:** Restart Supabase, change credentials, or reinstall dependencies before checking the local listener and URL.

### B. Timeout or `ERR_NAME_NOT_RESOLVED`

These symptoms can occur on different network paths:

- For `localhost`, check Vite and the local port first.
- For the Supabase hostname, check DNS, network/TLS reachability, project status, and configured URL.

Use the Supabase checks in [Section 7](#7-supabase-connectivity-troubleshooting). A successful DNS lookup only proves the name resolves. A successful TCP/TLS request proves the remote endpoint answered; it does not prove sign-in, table permissions, or Edge Functions are correct.

**Do not:** Treat invalid email/password as a DNS problem. Invalid credentials normally produce an HTTP authentication response, commonly 400/401, from a reachable Auth endpoint.

### C. HTTP 404

**Usually means:** A server answered, but the requested path/resource was not found. This differs from connection refusal.

1. Check the complete URL and port.
2. Confirm Vite started in `cow-care-chronicles-main`, not the nested `cattle-breed-classifier-webapp-master\frontend` project.
3. If the response is Vite HTML but the page shows SmartDairy’s `NotFound` route, React loaded and the client-side route is unknown.
4. If an API/Edge Function request is 404, check the function name, deployment, and endpoint path; restarting Vite will not deploy a missing cloud function.
5. The earlier 5173 incident was a 404 because the mistaken Vite invocation used a positional root instead of the intended app root.

**Do not:** Assume every 404 is a React crash or a Supabase outage.

### D. Blank or white screen

1. Press **F12** and open **Console**.
2. Find the first meaningful red error after reloading. Follow the linked file and line.
3. Open **Elements** and inspect `<div id="root">`.
   - Empty `#root` plus a JavaScript exception often means React did not mount or render.
   - Rendered elements inside `#root` mean React mounted; inspect styles, route content, and data state next.
4. Check **Network** for failed JavaScript module requests (for example `/src/main.tsx` or an imported page).
5. If a specific route is blank, navigate to `/` and then to that route to separate startup from routing/component failures.

The historical `useState is not defined` error is a good example: the browser supplied a component filename and line, which pointed to a missing import. A Vite restart would not fix that import.

### E. React runtime or compile errors

- **Missing import:** `useState is not defined` means the module refers to a symbol unavailable at runtime. Check that it is imported from React or declared locally.
- **Duplicate declaration:** `Identifier 'toast' has already been declared` means the same identifier was declared/imported twice in one module. Remove the duplicate, not the unrelated toast provider.
- **Invalid component code:** JSX syntax/type/build diagnostics point to the source module. Use the error location and `npm run build`.
- **Missing provider:** Hooks such as `useAuth` require their provider. In this app, `AuthProvider` wraps the routes in `App.tsx`; a hook used outside it throws by design.
- **Incorrect hook usage:** Call React hooks at the top level of a function component/custom hook, not conditionally or inside loops/handlers.
- **Import-time failure:** `App.tsx` imports page modules eagerly. A broken imported module can prevent the whole app from booting, even if that page is not currently selected.
- **Error boundaries:** The current app does not add a React error boundary. An uncaught descendant render error can replace the whole UI; an error boundary is a useful improvement, but it does not repair the underlying exception.

After fixing a source error, verify with the build/test commands in [Section 6](#6-windows-and-powershell-command-reference).

### F. Login says `Failed to fetch`

1. Open DevTools → **Network** → select **Fetch/XHR**.
2. Clear the log, retry once, and inspect the Auth request, usually containing `/auth/v1/token?grant_type=password`.
3. Interpret the result:
   - **No request / failed before HTTP:** inspect Console, DNS, browser network, VPN/proxy, and the configured URL.
   - **DNS/name-resolution error:** check the hostname and Supabase project state.
   - **CORS error:** inspect the exact request and response; do not disable browser security as a workaround.
   - **HTTP 400/401:** the server responded; inspect the safe response message for credentials, confirmation, or Auth configuration.
   - **HTTP 429:** rate limiting; wait and check Auth logs/configuration.
   - **HTTP 5xx:** service-side failure; check Supabase status/logs.
4. The current Login code now catches thrown sign-in/OAuth errors and displays a toast. A reachable Auth response with a normal error is also surfaced.

**Do not:** Share screenshots containing passwords, access/refresh tokens, cookies, authorization headers, or full request payloads.

### G. Sign-in works but the dashboard is blank

1. Inspect **Console** for the first uncaught error and source location.
2. Confirm the URL is `/dashboard`. `ProtectedRoute` waits while auth is loading and redirects a missing user to `/login`.
3. Check whether the page shows the protected-route spinner indefinitely. That points to auth/session initialization or an unresolved state, not Vite.
4. In **Network → Fetch/XHR**, inspect requests to Supabase tables and `/functions/v1/reports`. Check status and response without copying tokens.
5. `Dashboard` reads `useReports()` and `useProfile()`. A table, RLS, or function failure may be a data problem even if authentication succeeded.
6. Current dashboard widgets do not render a dedicated `isError` state for those queries; some query failures can look like empty/zero data instead of a clear error. This is a known observability gap, not proof of a blank-screen cause.
7. Confirm that the required provider is present and that a component exception is not interrupting render.

**Do not:** Disable RLS, alter schema, or change authentication methods to troubleshoot a React crash.

### H. Page loads but data or AI features fail

Use the request path for the feature:

- **Cattle/milk/health/profile data:** browser → Supabase PostgREST/database with the current session and RLS.
- **Dashboard report:** browser → Supabase `reports` Edge Function → database.
- **Breed recognition:** browser → Supabase Storage upload/signed URL → `breed-recognition` Edge Function → hosted classifier.
- **Confirming a breed or loading demo data:** browser → the respective Supabase Edge Function.
- **Optional local Python path:** only a client request to `/api/...` uses Vite’s proxy to `localhost:8000`. The current main React app has no such call.

Read the Network status:

- **401:** missing/invalid session or token.
- **403:** permission/RLS/policy issue.
- **404:** wrong/missing function or route, or deployment mismatch.
- **400:** request body, image URL, or upload validation issue.
- **502/503:** downstream classifier/service unavailable or returned an invalid response.
- **5xx from Supabase:** function/database/service failure; inspect function logs.

For breed recognition, a working landing page does not prove Storage, the Edge Function, or the hosted classifier is available. Check each request in order and fix the first failed hop.

## 6. Windows and PowerShell command reference

Run commands from PowerShell. Paths are quoted because the user profile path contains spaces.

### Navigate and confirm the correct project

```powershell
Set-Location 'C:\Users\prashantpatil\OneDrive\Documents\Desktop\SmartDairy\cow-care-chronicles-main'
Get-Location
Test-Path .\package.json
```

Expected: `Get-Location` ends in `cow-care-chronicles-main` and `Test-Path` returns `True`. If it returns `False`, do not run `npm install`; locate the correct project root first.

### Check Node/npm and available scripts

```powershell
node --version
npm --version
npm run
```

Expected: version numbers and the package scripts. In this project, `dev`, `build`, `lint`, and `test` are available.

### Start the frontend

```powershell
npm run dev
```

Expected output includes `VITE ... ready` and a line like `Local: http://localhost:8080/`. Keep this terminal open. Use the URL it prints. If it selects 8081, check why 8080 is occupied before stopping anything.

### Check common ports and owning processes

```powershell
$ports = 8080, 8081, 8000
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $ports -contains $_.LocalPort } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

No row for a port means no listener was found. To inspect a PID shown above:

```powershell
Get-Process -Id <PID>
```

Only if you have confirmed that the PID is your stale Vite/Python process and you intend to stop it:

```powershell
Stop-Process -Id <PID>
```

Replace `<PID>` with the numeric PID. Do not stop a process just because it owns a port; first inspect what it is.

### Test the local homepage

```powershell
try {
  $response = Invoke-WebRequest -Uri 'http://localhost:8080/' -TimeoutSec 5 -UseBasicParsing
  "HTTP $([int]$response.StatusCode)"
} catch {
  if ($_.Exception.Response) {
    "HTTP $([int]$_.Exception.Response.StatusCode)"
  } else {
    "No HTTP response: $($_.Exception.Message)"
  }
}
```

`HTTP 200` means a server responded; it does not guarantee React rendered or Supabase is reachable. A connection error points to server/port/bind address. A 404 means a server answered on the wrong path/root or a resource is missing.

### Check Supabase DNS and HTTPS without printing the `.env` contents

```powershell
$line = Get-Content .\.env |
  Where-Object { $_ -match '^\s*VITE_SUPABASE_URL\s*=' } |
  Select-Object -First 1
$supabaseUrl = (($line -split '=', 2)[1].Trim()).Trim('"').Trim("'")
$supabaseHost = ([uri]$supabaseUrl).DnsSafeHost
Resolve-DnsName $supabaseHost
Test-NetConnection -ComputerName $supabaseHost -Port 443
curl.exe -sS -o NUL -w "HTTP %{http_code}; TLS verify %{ssl_verify_result}`n" --max-time 15 "$supabaseUrl/auth/v1/health"
```

Interpretation:

- `Resolve-DnsName` returns addresses: DNS resolved. An error means check the URL spelling, DNS/network/VPN, and project status.
- `TcpTestSucceeded: True`: TCP port 443 was reachable. `False` means network/firewall/remote reachability needs investigation.
- Any HTTP status and TLS verify `0` mean HTTPS reached a responding server. A 401/404 from this unauthenticated health check is not a successful login test, but it is different from DNS failure.

These commands do not send a password or API key. Do not add an authorization header or print `.env` values when debugging.

### Build, test, and lint

```powershell
npm run build
npm test
npm run lint
```

Use the build to catch module/TypeScript/bundling errors, tests for automated behavior, and lint for static issues. A passing build does not prove cloud Auth, RLS, Edge Functions, or AI service availability.

### Restart after environment changes

Vite reads environment variables at startup. After editing the root `.env`:

1. Return to the Vite terminal.
2. Press **Ctrl+C**.
3. Run `npm run dev` again.
4. Use the newly printed `Local:` URL.

Do not paste `.env` values into chat or screenshots.

## 7. Supabase connectivity troubleshooting

The frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `src/integrations/supabase/client.ts`. These configure the browser client; they do not start a local database.

1. Check that the root `.env` exists and that the variable names are present. Do not print the values.
2. Derive the hostname and run DNS/TCP/HTTPS checks from Section 6.
3. If DNS fails, verify the URL and the project’s state in the Supabase dashboard, then check local DNS/VPN/network. A paused or removed project can make a previously valid URL unavailable.
4. If DNS and HTTPS work but Auth fails, inspect the Auth request response. Check whether credentials, email confirmation, redirect URLs, provider configuration, or service availability are the issue.
5. If Auth succeeds but a table request fails, inspect HTTP status and the response. Check RLS policies and the signed-in user; never disable RLS as a troubleshooting shortcut.
6. If an Edge Function fails, check its name, deployment status, function logs, required secrets, and response status. Local function source alone does not prove the cloud deployment matches it.
7. The historical incident says the project was paused and later resumed. The current DNS/TLS check succeeded, but only the project owner/dashboard and an actual authenticated request can confirm current project health.

## 8. Browser DevTools workflow

1. Open the app in Edge or Chrome and press **F12**.
2. Select **Console**. Reload once and read the first meaningful red error, not just later errors caused by it. Click the source link (for example, `Dashboard.tsx:21`) to open the responsible code.
3. Select **Network**. Enable **Preserve log** if navigation/redirects would otherwise clear the evidence. Clear the log immediately before one retry so older requests are not confused with the new attempt.
4. Choose **Fetch/XHR**, retry the action once, and inspect the request’s URL path, status, duration, and safe response text.
5. For email/password sign-in, look for a request containing `/auth/v1/token`. A completed 400/401 is a response from Auth; a request marked failed with no HTTP status suggests browser/network/DNS/TLS/CORS before a usable Auth response.
6. A request stuck at **Pending** is still waiting; it is not the same as an immediate DNS failure or completed HTTP error. Note duration and whether it eventually completes.
7. In **Elements**, search for `#root`. If it is empty, check Console for a startup/render exception. If it contains the page, React rendered and the issue may be CSS, route state, loading, or data.
8. Do not share screenshots or HAR files without removing passwords, tokens, cookies, `Authorization` headers, publishable keys if policy requires, user email, and sensitive request/response data. Never share a raw login request payload.

The old `useState is not defined` error was actionable because it named both the symbol and source line. That points to a React/module problem, not a port or Supabase problem.

## 9. Why failures can recur and current recurrence risks

| Potential source | Current assessment | What to do |
|---|---|---|
| Vite terminal closed | Confirmed general recurrence path; Vite must be running for localhost. It is currently listening on 8080 in this audit. | Keep the terminal open and check the listener before changing code. |
| Multiple Vite servers | Possible. At audit time, port 8080 was listening; 8081 and 8000 had no listener. A single port check cannot rule out a server on another port. | Inspect the printed Vite URL and listener PID; avoid launching repeated terminals blindly. |
| Wrong project directory | Confirmed risk: another Vite package exists in the nested classifier project. | Run `Get-Location` and `Test-Path .\package.json` before `npm run dev`. |
| Port switching | Confirmed configuration behavior: 8080 is preferred, strict-port behavior is not enabled. | Use the `Local:` URL. Optionally set strict-port behavior if a fixed URL is more important than automatic fallback. |
| Stale browser tabs | Possible and consistent with the historical mix of ports. | Close/reload stale tabs and open the URL from the current Vite terminal. |
| Startup import/runtime crash | Possible because page modules are eagerly imported by `App.tsx`; no current startup crash was observed. | Check Console and build output; fix the first source error. |
| Missing `useState` import in Dashboard | Historical issue, currently ruled out in `Dashboard.tsx`. | Keep build/type checks; inspect any new stack trace rather than assuming it returned. |
| Duplicate toast declaration | Historical issue, currently ruled out in `BreedRecognition.tsx`. | Keep declarations/imports unique. |
| HTML Markdown fences | Historical issue, currently ruled out in `index.html`. | Keep Markdown in `.md` files, not `index.html`. |
| Supabase project/DNS outage | Historical project pause is confirmed by supplied history; current DNS/TLS check succeeds, but ongoing cloud health is not guaranteed. | Check the exact cloud request and project dashboard/status. |
| Missing frontend env variables | Not observed: expected variable names were populated in `.env`; their values were not printed. | Validate names/non-empty values safely; restart Vite after changes. |
| Python service not started | Not an explanation for current React startup or current breed UI path. It matters only if a caller uses `/api` through the Vite proxy. | Do not start it unless the failing request actually targets `/api` or port 8000. |
| Dashboard query errors | Current observability gap: `Dashboard` does not show dedicated errors for its reports/profile queries. This can make data failures look like empty values. | Improve the dashboard error UI in a separate targeted change if users encounter this. |
| Auth network exception | Current Login code now catches thrown sign-in/OAuth errors and presents a toast. | Use Network to find whether the failure is DNS, HTTP Auth, or provider configuration. |
| Secret handling in optional Python service | A hard-coded credential-like fallback was removed; the service now reads its configured environment and loads its ignored `.env`. If that old value was real or active, rotate it with the provider. | Keep credentials out of source and browser variables; do not include values in logs/docs. |

## 10. Prevention recommendations

### Required fixes for demonstrated/current defects

- **Applied:** Catch thrown email/password and Google sign-in errors in `src/pages/Login.tsx` and show a safe toast.
- **Applied:** Removed the hard-coded Roboflow API-key fallback in `ml-service/roboflow_service.py`; the optional service now loads its service-local ignored `.env` and requires configured credentials.
- **Action outside source code:** Treat the removed credential-like literal as exposed unless confirmed to be a dummy. Rotate it with the provider if it was real or used. Do not paste it into a ticket or commit another key.
- **No code change needed for the historical fixes:** Current `Dashboard.tsx` imports `useState`; `BreedRecognition.tsx` has one toast import; `index.html` contains no stray Markdown fences.

### Useful preventive improvements

- Make the startup routine consistent: main project root → `npm run dev` → open the printed URL.
- Consider `strictPort: true` if silently switching away from 8080 is more confusing than refusing to start when it is occupied. This is a behavior choice; it has not been changed.
- Show explicit error states for `useReports` and `useProfile` on the Dashboard instead of presenting query failures as empty/zero values.
- Consider a React error boundary to show a recoverable message around render exceptions. Keep Console details for developers and avoid leaking data in the UI.
- Add a safe environment validation step that checks the required `VITE_` values are non-empty without logging the values.
- Add focused tests for login network rejection and dashboard query error presentation. The existing test suite currently contains only a trivial example test.
- Improve the root README, which is currently only a placeholder, with the exact root/start/test commands from this guide.

### Optional enhancements

- Add a local Python `/health` probe only if the app is intentionally wired to that service. The optional service already exposes a health route, but a health route does not prove model/provider readiness.
- Add integration checks for deployed Supabase functions and the hosted classifier in an environment where those services and test credentials are intentionally available.
- Keep an `.env.example` with variable names and dummy placeholders only; never copy real values into it.

## 11. Quick-reference checklist

When localhost fails:

1. Read the exact browser error: connection refused, timeout, 404, blank page, or feature failure.
2. In PowerShell, confirm the folder ends in `cow-care-chronicles-main`.
3. Confirm `package.json` exists there.
4. Check whether the port in the URL is listening.
5. If not, run `npm run dev` and keep the terminal open.
6. Use the exact URL printed by the current Vite process.
7. If HTTP responds but the page is blank, inspect the first Console exception and `#root`.
8. If only Auth/data/AI fails, inspect Network → Fetch/XHR and identify the first failed request.
9. Check Supabase DNS/TLS separately from local Vite.
10. Do not reinstall packages, change ports, disable RLS, or alter credentials without evidence.
11. After code changes, run `npm run build` and `npm test`.
12. Redact secrets and personal data before sharing diagnostics.

## 12. Worked example: diagnose a new localhost failure

Suppose the browser shows `ERR_CONNECTION_REFUSED` at `http://localhost:8080/`.

1. Confirm the folder:

   ```powershell
   Set-Location 'C:\Users\prashantpatil\OneDrive\Documents\Desktop\SmartDairy\cow-care-chronicles-main'
   Get-Location
   Test-Path .\package.json
   ```

2. Check for a listener on 8080. If none exists, this is not yet a React or Supabase problem.
3. Run `npm run dev` and wait for `VITE ... ready`.
4. If Vite prints `http://localhost:8081/`, inspect why 8080 was occupied and use 8081 for this run.
5. Request the printed URL. If it returns HTTP 200, local networking now works.
6. If the browser still shows a white screen, keep the server running and switch to Console/Elements. The failure has moved to the browser application layer.
7. If the landing page renders but login fails, inspect the Auth network request and test Supabase DNS/HTTPS. Do not restart Vite repeatedly: the frontend-to-cloud request is a different connection.

This method identifies the layer first and changes only the component that evidence implicates.

## 13. Glossary

- **Browser runtime:** JavaScript executing inside Edge/Chrome.
- **CORS:** Browser-enforced rules controlling which origins may read cross-origin responses.
- **DNS:** Resolves a hostname to network addresses.
- **Edge Function:** A server-side function deployed by Supabase and invoked over HTTPS.
- **HTTP status:** Server response code such as 200, 401, 404, or 503.
- **localhost:** A hostname for the same computer running the browser.
- **Port:** A numbered endpoint on a computer, such as Vite 8080 or optional Python 8000.
- **RLS:** Supabase Row-Level Security rules controlling which database rows a user may access.
- **Runtime exception:** An error thrown while JavaScript executes, potentially interrupting React rendering.
- **TCP/TLS:** Network transport and HTTPS encryption layers; reaching them does not prove app-level authentication.
- **Vite:** The frontend development server/build tool used by this project.
- **`#root`:** The HTML element into which React mounts the application.

## 14. Remaining uncertainties and checks that need an owner

- The historical white-screen event has no exact error trace in the supplied record, so its specific root cause cannot be proven.
- The current Supabase hostname resolves and responds over HTTPS, but a real authenticated sign-in and every cloud function were not exercised during this audit. Confirm project status and deployment in the owner’s Supabase dashboard.
- The hosted classifier’s current availability was not tested. Check its request status/logs only when breed recognition is the failing feature.
- The local Python service was not started or tested end-to-end. Its service-local `.env` is present, but its PyTorch checkpoint was absent during this audit.
- Confirm whether the removed credential-like source fallback was a real provider credential. Rotate it if real or ever used.
- The current dashboard’s data-query errors are not presented as dedicated error states. If this affects users, implement and test that UI separately.

## 15. Files changed for this investigation

- `docs/LOCALHOST_TROUBLESHOOTING_AND_PREVENTION_GUIDE.md` — this guide.
- `src/pages/Login.tsx` — visible handling for thrown sign-in/OAuth network errors.
- `ml-service/roboflow_service.py` — removed the hard-coded credential fallback and load the service-local `.env`.
