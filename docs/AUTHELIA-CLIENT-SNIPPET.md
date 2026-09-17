# Authelia client for Project Worlds (paste into YOUR homelab Authelia)
*No secrets live in this repo. `<GENERATE>` means: generate a long random string
in your homelab secret store, then put the SAME value in Project Worlds' env as
`OIDC_CLIENT_SECRET`. Never commit either copy.*

Add this under `identity_providers.oidc.clients:` in your Authelia config
(e.g. `homelab/services/settings-reconciler/desired/authelia.yml` or
`homelab/authelia/configuration.yml`, whichever your reconciler owns):

```yaml
      - client_id: "project-worlds"
        client_name: "Project Worlds"
        # Confidential client: Project Worlds authenticates with HTTP Basic.
        client_secret: "<GENERATE>"          # Authelia-side copy (your secret store)
        authorization_policy: "two_factor"    # or one_factor if you prefer
        scopes:
          - "openid"
          - "profile"
          - "email"
        redirect_uris:
          - "https://<your-worlds-host>/api/auth/oidc/callback"
          - "http://127.0.0.1:8000/api/auth/oidc/callback"   # loopback dev only
        userinfo_signed_response_alg: "none"
```

Then, on the Project Worlds side:
1. `config/oidc.json` (the setup wizard can write this for you):
   ```json
   {
     "issuer": "https://<your-authelia-issuer>",
     "client_id": "project-worlds",
     "client_secret_env": "OIDC_CLIENT_SECRET",
     "scopes": ["openid", "profile", "email"],
     "display_name": "Home SSO"
   }
   ```
2. Export the same generated secret as `OIDC_CLIENT_SECRET` in the compose env
   (or `.env`, which is git-ignored): `OIDC_CLIENT_SECRET=<GENERATE>`.
3. Restart both. Check `GET /api/auth/oidc/status` → `configured`, then sign in.

Notes:
- The issuer hostname above is YOUR private topology; it belongs in your
  homelab/private config, never in the public Project Worlds repo.
- PKCE is always used by Project Worlds; with a client secret present it also
  sends Basic auth at the token endpoint (standard base64).
- Loopback redirect is for on-box development only; drop it for LAN/public use
  and rely on TLS.
