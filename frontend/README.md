# Doctor Clinic frontend

React + Vite PWA. `npm run dev` and `npm run preview` serve **HTTPS** with local mkcert certificates so a phone on the same Wi-Fi can open the app and install it as a PWA.

## Local HTTPS

`vite.config.ts` loads these existing files (gitignored; do not commit the private key):

- `192.168.1.90+1.pem`
- `192.168.1.90+1-key.pem`

```bash
npm run build
npm run preview
```

Always include **`https://`**:

- PC: `https://localhost:4173`
- Phone: `https://192.168.1.90:4173`

The queue QR uses `https://192.168.1.90:4173/queue` even if the dashboard is opened on localhost.

Typing `192.168.1.90:4173` without `https://` uses HTTP and will fail while HTTPS is on.

## Install as a PWA

### PC (Chrome)

1. Open `https://localhost:4173`
2. Click **Install Doctor Clinic**, or the install icon in the address bar

`http://localhost:4173` also allows install, but this project is HTTPS-only.

### Android (Chrome) — required extra step

Chrome will not install a PWA from HTTP, and it will not trust mkcert until you install the local CA on the phone.

1. On the PC: `npm run certs:export-ca`  
   Copies `certs/rootCA.pem` (this is the CA, not the server private key).
2. Send `certs/rootCA.pem` to the phone.
3. Android: **Settings → Security → Encryption & credentials → Install a certificate → CA certificate** (wording varies) and install `rootCA.pem`.
4. Keep `npm run preview` running. On the phone open **`https://192.168.1.90:4173`** (same Wi-Fi).
5. Chrome menu **⋮ → Install app**.

If the phone times out, Node.js is still blocked on the Windows **Private** network. In Administrator PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\allow-phone-lan.ps1
```

### iPhone

Open **`https://192.168.1.90:4173`** in Safari, install the mkcert CA (or trust the warning if shown), then Share → **Add to Home Screen**.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | HTTPS dev server (port 5173, LAN) |
| `npm run build` | Production build |
| `npm run preview` | HTTPS preview of `dist/` on port 4173 |
| `npm run certs:export-ca` | Copy mkcert `rootCA.pem` for the phone |
| `npm run typecheck` | TypeScript check (app + Vite config) |
