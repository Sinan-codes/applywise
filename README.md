# Applywise

Applywise is a Chrome extension and local web app that helps candidates prepare job applications faster. It scans a job application form, matches detected fields to a saved candidate profile, drafts AI-generated answers, and lets the user review each response before filling the form. It is designed to assist with drafting, not to submit applications automatically.

## Project name and description

Project name: Applywise

Applywise is a personal job-application assistant built for Chrome. It combines a React-based extension UI with a Node.js/Express server and MongoDB storage to save candidate details, scan application fields, and draft tailored answers using an OpenAI-compatible AI provider.

## Features

- Save and manage a candidate profile in the browser extension
- Scan a job application page and detect fields automatically
- Match scanned fields to relevant profile data
- Generate draft answers using AI for supported long-form fields
- Review and edit the generated answers before applying them
- Fill form fields only after the user explicitly confirms
- Keep the app focused on local development and user-controlled workflow

## Technologies used

- React + Vite for the extension frontend
- Chrome Manifest V3 extension APIs
- Node.js + Express for the backend API
- MongoDB + Mongoose for data persistence
- OpenAI-compatible AI API for answer generation
- dotenv, CORS, and rate limiting middleware

## Setup and installation instructions

### Prerequisites

- Node.js 20 or newer
- npm 9 or newer
- MongoDB running locally or a valid MongoDB connection URI
- API key for an OpenAI-compatible model provider

### Installation

```bash
npm install
cp server/.env.example server/.env
```

Then update `server/.env` with your values:

- `MONGODB_URI` — your MongoDB connection string
- `APPLYWISE_API_TOKEN` — a secure secret for protecting profile and AI endpoints
- `AI_API_KEY` — your AI provider API key
- `AI_BASE_URL` — optional OpenAI-compatible endpoint
- `AI_MODEL` — optional model name such as `gpt-4o-mini`

## How to run the application

### Start the project

```bash
npm run dev
```

This starts:

- API server at `http://localhost:3001`
- Vite dev server at `http://127.0.0.1:5173`

### Load the Chrome extension

1. Build the extension:

```bash
npm run build
```

2. Open `chrome://extensions` in Chrome.
3. Enable Developer mode.
4. Click Load unpacked and select `extension/dist`.
5. Pin the extension and open the side panel.
6. Go to My profile, enter your API token, save your candidate details, and then scan a job application page.
7. Review and edit the generated drafts, then click Fill reviewed answers.

## AI tool used

I used CodeZero throughout this project.

## AI Development Experience

CodeZero helped speed up the development process by accelerating the setup of the project structure, generating backend and frontend code patterns, and assisting with debugging and iteration. It was especially useful for turning the initial idea into a working extension + API workflow quickly, while keeping the development process structured and efficient.

## Specific AI-assisted tasks

Here are several concrete tasks where I used Kiro:

1. Project scaffolding and architecture planning for the Chrome extension and Express API
2. Building the backend API routes for profile management and AI answer generation
3. Designing and implementing MongoDB schema integration for storing candidate profile data
4. Debugging field-matching logic and AI response formatting issues during answer generation
5. Refactoring and improving the extension flow for scanning, review, and form-filling behavior
6. Validating the app with test runs and build checks to catch integration issues early

