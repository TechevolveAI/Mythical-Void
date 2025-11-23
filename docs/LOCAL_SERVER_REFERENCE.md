# Mythical Void – Local Server Reference

Use this quick guide whenever you need to spin up the game or the in-browser test harness. It captures the exact commands, default ports, and common gotchas so different assistants (or future you) follow the same flow.

## Summary

| Purpose | Command | Default Port(s) | Notes |
|---------|---------|-----------------|-------|
| Full game / UX (Vite dev server) | `npm run dev` | 5173 → auto-increment | Starts Vite. Keep the terminal running. Open the URL printed in the console (usually `http://localhost:5173/`). |
| Production preview | `npm run preview` | 4173 → auto-increment | Builds + serves the production bundle. Helpful for final QA. |
| Manual test harness (dashboard) | `npm test` | 8080 → 8081… | Uses `scripts/serve-test-framework.js` to host `test-framework.html`. Prints the exact URL (e.g. `http://localhost:8080/test-framework.html`). Only meant for running the button-driven sanity checks, not full gameplay. |
| Health check helper | `npm run health-check` | — | Outputs a message; available for parity with deployment scripts. |

### Port behaviour details

- **Vite (dev & preview)**: Vite binds to 5173 (preview: 4173) by default. If the port is taken, it prompts and auto-selects the next free port. Always rely on the URL shown in the terminal.
- **Test harness**: The custom server starts at 8080 and walks upward to 8081–8100 until it finds a free port. Every request/response is logged in the terminal to help debug blank pages or missing assets.

## Recommended Workflow

1. Install dependencies once (`npm install`).
2. For gameplay or UX work: `npm run dev` → open the printed URL.
3. For quick regression checks: in a second terminal, run `npm test` and use the Test Framework UI buttons.
4. When switching assistants, link them to this file so everyone follows the same port conventions.

## Troubleshooting

- **“Connection refused”**: The server probably isn’t running or the port changed. Re-run the command and watch the terminal for the actual URL.
- **Blank purple test page**: Make sure you opened the `/test-framework.html` URL and clicked “Run All Tests”. The harness is intentionally minimal until you run a suite.
- **Need a different port**: Set `PORT=<value>` before the command. For example, `PORT=9090 npm test` starts the harness at 9090 and walks upward from there.

Feel free to expand this document if new scripts or environments are introduced.
