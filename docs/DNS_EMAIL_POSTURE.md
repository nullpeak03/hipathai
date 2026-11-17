# DNS & Email Posture for hipathai.me

These records live in the DNS provider (not in code). HiPath sends
transactional email via Resend and uses Clerk for auth emails.

## Status — verified live 2026-11-17

| Record | Value found | State |
| --- | --- | --- |
| SPF (`TXT @`) | `v=spf1 include:_spf.resend.com ~all` | published |
| DMARC (`TXT _dmarc`) | `v=DMARC1; p=quarantine; rua=mailto:dmarc@hipathai.me; ruf=mailto:dmarc@hipathai.me; adkim=s; aspf=s` | published |
| CAA (`www`) | `letsencrypt.org`, `pki.goog`, `sectigo.com`, `globalsign.com` | inherited — `www` is a CNAME into `vercel-dns-017.com`, whose zone carries Vercel's CA set |
| CAA (apex) | none | **open** — registrar action, see below |

The zone is hosted at the registrar (`dns1/dns2.registrar-servers.com`,
Namecheap), so Vercel's API cannot manage it: `vercel dns ls hipathai.me`
returns "You don't have permission to list the domain record". Adding the apex
CAA is therefore a manual dashboard step, not something a deploy can do.

The live certificate chain for both `hipathai.me` and `www.hipathai.me` was
issued by **Let's Encrypt (CN=YR1)**. Mirror Vercel's full CA set rather than
publishing only Let's Encrypt: Vercel can switch issuers (Google Trust
Services, Sectigo, GlobalSign) on renewal, and a narrow CAA record would make
that renewal fail.

## 1. MX (receiving mail)

Only needed if you want to receive mail at the domain. Add the mailbox
provider's MX records (Google Workspace, Microsoft 365, …). A send-only domain
can skip this, though some validators expect at least one MX.

## 2. SPF (authorize Resend to send)

TXT at the root (`@`):

```
v=spf1 include:_spf.resend.com ~all
```

Add another `include:` before `~all` for any additional sender.

## 3. DMARC

TXT at `_dmarc`:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@hipathai.me; ruf=mailto:dmarc@hipathai.me; adkim=s; aspf=s
```

Start at `p=none` when monitoring, then move to `quarantine`/`reject`.

## 4. CAA (restrict certificate issuance)

Add at the **apex** (`@`) in the registrar dashboard. This mirrors the set
Vercel already publishes for `www`, so it does not narrow issuance beyond what
Vercel itself allows:

```
0 issue "letsencrypt.org"
0 issue "pki.goog"
0 issue "sectigo.com"
0 issue "globalsign.com"
```

`0 issuewild` is optional. Per RFC 8659, if only `issue` is present it also
governs wildcard issuance, so separate `issuewild` lines are not required to
keep wildcard certs working.

CAA is evaluated per name: records at the apex do **not** constrain `www`, and
the `www` CAA that currently resolves comes from the Vercel CNAME target.

## 5. Resend domain verification

In the Resend dashboard, add and verify `hipathai.me` (or a subdomain like
`mail.hipathai.me`) and follow its DKIM CNAME instructions.

## Verification

```bash
dig +short TXT hipathai.me
dig +short TXT _dmarc.hipathai.me
dig +short CAA hipathai.me
dig +short CAA www.hipathai.me
echo | openssl s_client -connect hipathai.me:443 -servername hipathai.me 2>/dev/null \
  | openssl x509 -noout -issuer
```

Expected after the apex CAA is added: the two `CAA` queries both print four
`issue` records, and the issuer is one of the four CAs above. Allow up to the
record's TTL (and 48h at the outside) before re-checking.
