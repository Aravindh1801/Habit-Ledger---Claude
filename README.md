# Ledger — installable habit tracker

A fully self-contained PWA. No build step, no external CDN calls at runtime —
React is bundled in this folder, so once it's loaded once it works fully offline.

## Deploy it (pick one — both are free)

### Option A: GitHub Pages
1. Unzip this folder.
2. Create a new **public** GitHub repository.
3. Upload every file, keeping the `icons/` folder as a subfolder (drag-and-drop
   works on github.com, including from a phone browser).
4. Repo → **Settings → Pages** → Source: **Deploy from a branch** → branch
   `main`, folder `/ (root)` → Save.
5. Wait ~1 minute, then open the URL GitHub gives you
   (`https://<username>.github.io/<repo>/`).

### Option B: Netlify Drop
1. Unzip this folder.
2. Go to **app.netlify.com/drop** and drag the unzipped folder in.
3. You'll get an instant `https://...netlify.app` URL.

## Install it on Android
1. Open the deployed `https://` URL in **Chrome**.
2. Tap the **⋮** menu → **Add to Home screen** (or **Install app**, if
   Chrome offers it directly).
3. Launch it from your home screen — it opens full-screen, no browser bar.

It must be served over `https://` (not opened as a local file) for the
install prompt and offline caching to work — that's a browser security
requirement for service workers, not something specific to this app.

## Your data
Everything is stored locally in the browser (`localStorage`), on-device only.
Nothing is sent anywhere. Clearing the app's site data / browsing data in
Chrome will erase it, so nothing to back up unless you want to keep a copy
yourself.
