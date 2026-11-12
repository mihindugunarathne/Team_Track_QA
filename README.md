# Emp Track Web (Next.js)

Company workspace in the browser. Employees, staff, and admins sign in here.

- Employees see their own home, tasks, projects, reports, timesheet, and profile.
- Admins and staff with access see the existing management screens.

Also used inside the Expo admin app via WebView.

## Run

```bash
cd admin-web
npm run dev
```

The app listens on http://localhost:3000 and calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`).

Keep the Express server running, then open the Expo admin screens. On a physical device, the WebView uses your LAN IP automatically from Expo’s host, or set `EXPO_PUBLIC_ADMIN_WEB_URL`.
