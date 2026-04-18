# FinTrack Mobile (Expo)

This app is the phase-1 mobile bootstrap for FinTrack.

## What this verifies

- App runs on a physical device using Expo Go
- App can connect to backend over LAN
- Environment variable based API base URL works

## Prerequisites

- Backend running locally and reachable on LAN
- Phone and laptop on the same Wi-Fi network
- Expo Go app installed on your phone

## 1) Configure API URL

Create a `.env` file in `apps/mobile`:

```bash
cp .env.example .env
```

Update `EXPO_PUBLIC_API_BASE_URL` with your machine LAN IP and backend port:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8080/api
```

## 2) Install workspace dependencies with pnpm

From repository root:

```bash
pnpm install
```

## 3) Start backend

From repository root:

```bash
cd apps/backend
pnpm dev
```

## 4) Start mobile app

From repository root:

```bash
cd apps/mobile
pnpm dev
```

Then:
- Scan the QR code in terminal with Expo Go (Android) or Camera (iOS) and open in Expo Go.
- Verify `Hello world!` appears.
- Tap `Test Backend` and confirm it reaches `/health`.

## Start everything from parent folder

From repository root:

```bash
pnpm dev
```

This runs Turbo and starts all app `dev` scripts, including `apps/mobile`.

## Android device setup (step-by-step)

1. Install **Expo Go** from Play Store on your Android phone.
2. Connect your laptop and Android phone to the **same Wi-Fi**.
3. Find your laptop LAN IP:
   - macOS: `ipconfig getifaddr en0` (or `en1` on some setups)
4. Set `apps/mobile/.env` with that IP:
   - `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8080/api`
5. Start backend: `pnpm --filter backend dev`
6. Start mobile: `pnpm --filter mobile dev`
7. In Expo terminal UI, keep connection mode as **LAN**.
8. Open Expo Go on Android and scan the QR code from terminal.
9. App opens on device, showing `Hello world!`.
10. Tap **Test Backend** to verify `/health` connectivity.

## Troubleshooting

- **`expo: command not found`**: use `pnpm dev` (or `pnpm --filter mobile dev`) instead of running `expo` globally.
- **Network request failed**: confirm phone and laptop are on same Wi-Fi, and backend listens on a reachable interface.
- **Wrong URL**: verify `.env` value uses LAN IP, not `localhost`.
- **No /health response**: ensure backend exposes `GET /api/health` and backend process is running.
