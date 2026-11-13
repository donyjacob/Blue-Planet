# Blue Planet

Share a 6-character room code with friends around the world. Everyone’s local time syncs live, and Blue Planet finds the **golden window** when nobody is asleep — then you can lock a call time and download a calendar invite.

## Features

- Create or join a private room with a shared code
- Auto-detect timezone (optional GPS city pinpoint) or search 55+ cities
- Live world clocks with awake / stretch / sleeping status
- Golden Window scheduler with 24-hour overlap grid
- Lock a call time, copy invites, download `.ics`
- Free in-room video via Jitsi Meet (same meeting for everyone with the room code)

## Local development

```bash
npm install
env -u DATABASE_URL npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Without `DATABASE_URL`, the app uses in-memory PGlite (fine for local testing; data resets on restart).

## Publish

This app declares a Postgres database in `cursor-app.json` so published rooms sync across devices. When you publish from Cursor, choose **public** visibility so friends without Cursor accounts can open the link.
