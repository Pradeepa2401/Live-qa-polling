# Live Q&A and Polling System

A simple Next.js + React + TypeScript + Tailwind CSS + Supabase project.

## Features
- Name, question and optional answer submission
- Pending / Answered sections
- Question search
- Question voting
- Polls and poll results
- Supabase database integration
- Responsive UI

## Run in VS Code

1. Extract the ZIP.
2. Open the extracted folder in VS Code.
3. Open Terminal.
4. Run:
   npm install
5. Create `.env.local` from `.env.local.example`.
6. Add your Supabase URL and anon/publishable key.
7. In Supabase SQL Editor, run `supabase/schema.sql`.
8. Start:
   npm run dev
9. Open the local URL shown by Next.js.

## Supabase
Use the project URL and client-side anon/publishable key. Do not put a Supabase secret/service-role key in the browser.

## Vercel
https://live-qa-polling-wlo4-ozgcswya1-pradeepa2401.vercel.app

## Note
The demo poll data is intentionally kept in the frontend in this starter version. Questions and votes are connected to Supabase. The poll tables/API can be added next if required by your internship assignment.
