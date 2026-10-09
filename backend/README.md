# Cristal e-College HM Laboratory Reservation System

A local development version using the supplied college seal and navy, orange, and gold branding.

## Start

In one terminal, inside backend: `npm run start:dev`
In another terminal, inside frontend: `npm run dev`
Open http://127.0.0.1:5173. The frontend forwards API requests to port 3000.

## Included

Ten facilities, searchable category filters, reservation creation and cancellation, server-side conflict and date checks, laboratory utilization records, damage/loss reports, draft guidelines, and contact information. Records are saved in backend/data/records.json and persist across restarts. No sample reservations or invented contact details are included.

## Before campus deployment

This version runs locally without authentication. Add verified student/staff sign-in, role-based access and ownership checks, department approval rules, an approved database with backups, and official guidelines and contact details before using real student information or making it publicly accessible. Facility names transcribed from the handwritten reference should be confirmed by the department.

A QR code pointing to the final deployed dashboard URL can be added once a permanent address is available.
