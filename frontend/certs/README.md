# Local HTTPS certificates

Vite `dev` and `preview` load:

- `frontend/192.168.1.90+1.pem`
- `frontend/192.168.1.90+1-key.pem`

`*.pem` files are gitignored. Do not generate replacements unless those files are missing.

```bash
npm run certs:export-ca
npm run preview
```

Phone URL: `https://192.168.1.90:4173`  
Queue QR: `https://192.168.1.90:4173/queue`

Install `certs/rootCA.pem` on the phone as a CA so Chrome can treat the origin as secure and offer PWA install.
