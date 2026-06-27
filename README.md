# Local Form Autofill

![Local Form Autofill icon](assets/icon-128.png)

A simple, private browser extension that autofills repetitive Google Forms and Microsoft Forms from a profile saved in your browser.

No AI model. No Ollama. No cloud API. No automatic form submission.

## Features

- Autofills supported form fields automatically when they are empty.
- Supports Google Forms and Microsoft Forms.
- Saves profile data locally with `chrome.storage.local`.
- Handles:
  - full name
  - admin or student ID
  - phone number
  - class
  - one or more emails
- Lets you pick a default email.
- Shows a dark-mode email picker on forms when multiple saved emails are available.
- Includes an on/off switch that applies immediately.
- Avoids overwriting fields you have already typed into.

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript
- Plain HTML and CSS
- Chrome extension APIs:
  - `chrome.storage.local`
  - extension messaging
  - content scripts
- Node.js test runner

## Install for Development

```powershell
npm install
npm test
```

Then load the extension in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## Build

```powershell
npm run build
```

Chrome loads compiled scripts from `dist/`.

## Supported Sites

- `https://docs.google.com/forms/*`
- `https://forms.office.com/*`

## Privacy

Profile data stays in the browser through `chrome.storage.local`. Form text is processed locally by simple matching rules inside the extension.

## Repository Tags

Suggested GitHub topics:

`chrome-extension`, `forms`, `autofill`, `typescript`, `manifest-v3`, `google-forms`, `microsoft-forms`, `privacy`, `local-first`

## Release Checklist

1. Run `npm test`.
2. Confirm `dist/` is up to date.
3. Load the unpacked extension in Chrome.
4. Smoke-test a Google Form.
5. Tag and publish a release.

```powershell
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0" --notes "Dark UI, black icon, local-only autofill, and phone number support."
```
