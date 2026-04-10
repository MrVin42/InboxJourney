# Live Inbox Setup

This guide assumes the current live setup:

- domain: `InboxJourney.com`
- Cloudflare Email Routing destination: `inboxjourney01@gmail.com`
- Google Cloud OAuth client JSON stored in `Creds/`

## 1. Create the local env file

Create `.env` in the repo root from `.env.example`.

Recommended values:

```env
EMAIL_DOMAIN=InboxJourney.com
GMAIL_FORWARD_INBOX=inboxjourney01@gmail.com
GMAIL_CREDENTIALS_PATH=
GMAIL_MAX_RESULTS=10
GMAIL_LOOKBACK_DAYS=14
```

Notes:

- `GMAIL_CREDENTIALS_PATH` can stay blank if there is exactly one OAuth client JSON file in `Creds/`.
- If you later keep multiple client files there, set `GMAIL_CREDENTIALS_PATH=Creds/your-file.json`.

## 2. Install dependencies

PowerShell may block `npm` directly on some machines, so use:

```powershell
npm.cmd install
```

This project uses the same Gmail Node quickstart libraries Google recommends for local testing:

- `googleapis`
- `@google-cloud/local-auth`

## 3. Confirm Google Cloud settings

In your Google Cloud project:

- Gmail API must be enabled
- the OAuth client should be a Desktop App credential
- if the app is in testing mode and marked external, add `inboxjourney01@gmail.com` as a test user

## 4. Run the first Gmail authorization

This opens a browser and asks the Gmail account to authorize readonly access:

```powershell
npm.cmd run gmail:labels
```

Expected result:

- a browser consent flow opens
- you choose `inboxjourney01@gmail.com`
- the CLI prints Gmail labels after auth succeeds

This confirms the local app can talk to the forwarded inbox.

## 5. Test the catch-all pipeline

Send a message from another inbox to:

`zillow.test.r001@InboxJourney.com`

Then pull recent experiment mail:

```powershell
npm.cmd run gmail:pull -- --alias zillow.test.r001@InboxJourney.com
```

Expected result:

- the CLI returns one or more messages
- each message includes headers, matched aliases, links, and a normalized email record

## 6. Pull real Zillow scenario mail

Example:

```powershell
npm.cmd run gmail:pull -- --alias zillow.new-user.r001@InboxJourney.com
```

You can also pull all recent experiment mail to the domain:

```powershell
npm.cmd run gmail:pull
```

## 6b. Analyze real Zillow scenario mail

Once mail is flowing, you can pull and analyze in one command:

```powershell
npm.cmd run gmail:analyze -- --alias zillow.new-user.r001@InboxJourney.com
```

This command:

- pulls recent Gmail messages
- matches aliases ending in `@InboxJourney.com`
- parses the alias into site, scenario, and run id
- correlates the email to the Zillow scenario library
- runs the heuristic analyzer and returns issues, suggestions, and metrics

Currently supported Zillow alias keys:

- `zillow.new-user.r001@InboxJourney.com`
- `zillow.new-user-saved-search.r001@InboxJourney.com`
- `zillow.return-visit.r002@InboxJourney.com`
- `zillow.return-visit-price-adjustment.r002@InboxJourney.com`

## 6c. Generate the visual timeline report

To generate a clickable visual report:

```powershell
npm.cmd run gmail:report -- --alias zillow.new-user.r001@InboxJourney.com --days 7
```

Or for all recent experiment mail:

```powershell
npm.cmd run gmail:report -- --days 7
```

This writes a report to:

- `reports/latest/index.html`
- `reports/latest/previews/`
- `reports/latest/screenshots/`

The report includes:

- a timeline of arrivals
- category and score visualization
- click-to-select detail view
- a rendered email preview or screenshot for each message

## 7. How alias matching works

The poller:

- reads recent Gmail messages
- checks headers like `To`, `Delivered-To`, and related destination headers
- extracts any addresses ending in `@InboxJourney.com`
- normalizes the email into the platform format used by the repo

This is why catch-all routing works nicely for experiment scenarios: every alias can be traced back to a specific run.

## 8. Recommended first Zillow run

Use:

`zillow.new-user.r001@InboxJourney.com`

Then:

1. create the Zillow account with that address
2. browse a few listings
3. save some homes or a search
4. wait for follow-up emails
5. pull the inbox data with the CLI
6. analyze the resulting emails with `gmail:analyze`

## Troubleshooting

### Browser consent fails

Check:

- Gmail API enabled
- Desktop App OAuth client used
- correct Google account selected during auth
- the Gmail account is added as a test user if needed

### No messages found

Check:

- the alias was sent to exactly as expected
- Cloudflare route is catch-all and active
- the Gmail destination was verified in Cloudflare
- the message really arrived in `inboxjourney01@gmail.com`

### Multiple credential files found

Set `GMAIL_CREDENTIALS_PATH` explicitly in `.env`.
