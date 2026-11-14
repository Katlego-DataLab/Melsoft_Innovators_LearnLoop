# LearnLoop

LearnLoop is a responsive student-success POC built with React, TypeScript, and Vite. Its frontend uses the LearnLoop API described at `/docs`; the demo role selector is a UI-only switch and is not authentication.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` to the backend API base URL (not the `/docs` URL). The included local Vite proxy forwards `/api/public` to the supplied backend and avoids its current cross-origin browser restriction:

```dotenv
VITE_API_BASE_URL=/api/public
```

The app also uses that path when the variable is unset. It checks `/health` when it starts. If the API cannot be reached, the app clearly switches to **Demo mode**: write actions are disabled and the seeded Python Basics module is shown as reference data only. A failed API request is shown as an error; it never becomes a mock success.

For a deployed frontend, configure a same-origin reverse proxy for `/api/public` or enable CORS on the backend for the frontend’s origin. The live backend currently does not return an `Access-Control-Allow-Origin` header, so direct cross-origin browser calls are blocked.

Build for production with `npm run build`.

On Netlify, [netlify.toml](./netlify.toml) proxies `/api/public/*` to the backend, so no CORS setup or environment variable is needed.

## Connected backend endpoints

- `GET /health`
- `POST /students`, `GET /students/{student_id}`, `PATCH /students/{student_id}`
- `POST /modules`, `POST /content`
- `POST /modules/{module_id}/level-check`, `POST /modules/{module_id}/retest`
- `POST /attempts`
- `POST /study-plans`
- `GET /students/{student_id}/progress`
- `GET /modules/{module_id}/insights`
- `POST /students/{student_id}/wellbeing-checkins`
- `POST /gamma/study-material`, `POST /gamma/institution-report`, `GET /gamma/jobs/{job_id}`

Requests follow the live OpenAPI schemas. In particular, quiz submissions use `selected_index`, while wellbeing check-ins use integer `mood` and `stress` values from 1 to 5.

## Backend limitations surfaced in the UI

The current API does not expose a module-list or module-edit endpoint, student enrolment, or storage for student number and institution. The UI offers the seeded module and modules created during this browser session; created module references and extra profile details are kept in local browser storage, not represented as backend records. Student name, course, and consent use the documented student API. No individual student or wellbeing data is requested for lecturer insights.

The API is an unauthenticated POC. Do not use it with real student data.

## Gamma + audio (no Lovable changes needed)

Gamma study material/reports (PDF export) and ElevenLabs audio notes are called through a server-side proxy so the keys stay private.
- Local: put `GAMMA=...` and `ELEVANLABS=...` in `.env` (git-ignored); the Vite dev server proxies `/api/gamma` and `/api/tts`.
- Netlify: add the same two environment variables; `netlify/functions/gamma.mts` and `tts.mts` do the proxying.

## AI-written walkthrough (optional)

Add `OPENAI=sk-...` to `.env` (and as a Netlify environment variable). The "Visual walkthrough" panel then asks OpenAI (`gpt-4o-mini`, server-side via `server/walkthrough.ts`) to write its 3 scenes, narration, key terms and illustration choice. Without a key it falls back to scenes cut from the study plan.
