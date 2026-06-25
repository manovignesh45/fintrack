# Mobile App Deployment Guide (EAS Build)

This app is built and deployed using **Expo Application Services (EAS)**.

- Frontend (web): Vercel
- Backend API: Render (`https://fintrack-gm1c.onrender.com`)
- Mobile (Android): EAS Build → APK / AAB

---

## Environment Variables

The app uses `EXPO_PUBLIC_API_BASE_URL` to point to the backend. It is sourced differently depending on context:

| Context | Source | Value |
|---|---|---|
| Local dev (`expo start`) | `.env.development` (gitignored) | Local LAN IP or emulator address |
| EAS builds (`eas build`) | EAS Secret (Expo servers) | `https://fintrack-gm1c.onrender.com/api` |

> `.env.development` is gitignored — never commit it. Each developer maintains their own copy locally.

---

## One-Time Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log in to Expo

```bash
eas login
```

> Create a free account at https://expo.dev if you don't have one.

### 3. Link the project to Expo servers

Run from the `apps/mobile` directory:

```bash
cd apps/mobile
eas init
```

This will:
- Create the project on Expo's servers
- Add `extra.eas.projectId` to `app.json` automatically

### 4. Set the API URL secret in EAS

```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://fintrack-gm1c.onrender.com/api"
```

This stores the value permanently in Expo's servers — it is injected into every build automatically. You never need to set it again unless the backend URL changes.

---

## Building the App

### Preview build (APK — for testing on a physical device)

```bash
eas build --profile preview --platform android
```

- Outputs a downloadable `.apk` file
- Distributed internally (no Play Store needed)
- Takes ~5–15 minutes on Expo's cloud

### Production build (AAB — for Play Store submission)

```bash
eas build --profile production --platform android
```

- Outputs a `.aab` bundle for Google Play
- Submit via `eas submit` or manually upload to Play Console

---

## Local Development

Create a `.env.development` file in `apps/mobile/` (this file is gitignored):

```bash
# Android emulator → host machine
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:9695/api

# Physical device on same LAN → use your machine's LAN IP
# EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:9695/api
```

Then start the dev server:

```bash
pnpm dev
# or
expo start --port 8082
```

---

## Build Profiles Summary

Defined in `eas.json`:

| Profile | Distribution | Output | API URL source |
|---|---|---|---|
| `development` | Internal | Dev client | `.env.development` (local) |
| `preview` | Internal | APK | EAS Secret |
| `production` | Store | AAB | EAS Secret |

---

## Updating the Backend URL

If the Render backend URL changes:

```bash
# Delete the old secret
eas secret:delete --name EXPO_PUBLIC_API_BASE_URL

# Create with the new value
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://new-url.onrender.com/api"
```

Then trigger a new build for the change to take effect.
