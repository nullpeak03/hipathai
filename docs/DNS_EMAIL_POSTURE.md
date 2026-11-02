# DNS & Email Posture Plan for hipathai.me

These records must be added in your DNS provider (not in code). HiPath sends transactional email via Resend and uses Clerk for auth emails.

## 1. MX (email receiving — only if you want to receive mail at the domain)
If you use a hosted mailbox (Google Workspace, Microsoft 365, etc.), add the provider's MX records. If you only send (no inbound), you can skip MX, but some validators expect at least one MX for a mail-capable domain.

## 2. SPF (authorize Resend to send)
Add a TXT record at the root (`@`):
```
v=spf1 include:_spf.resend.com ~all
```
If you also send via another provider, add its `include:` before `~all`.

## 3. DMARC
Add a TXT record at `_dmarc`:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@hipathai.me; ruf=mailto:dmarc@hipathai.me; adkim=s; aspf=s
```
Start with `p=none` for monitoring, then move to `quarantine`/`reject`.

## 4. CAA (restrict certificate issuance)
Add CAA records at root:
```
0 issue "letsencrypt.org"
0 issuewild "letsencrypt.org"
```
Add your CA if Vercel/other uses a different issuer.

## 5. Resend domain verification
In Resend dashboard, add and verify `hipathai.me` (or a subdomain like `mail.hipathai.me`) and follow its DNS instructions (DKIM CNAMEs).

## Verification
- Use `dig TXT hipathai.me`, `dig TXT _dmarc.hipathai.me`, `dig CAA hipathai.me`.
- Re-run the email posture checker after propagation (up to 48h).
EOF