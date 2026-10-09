# Cristal e-College HM Laboratory Reservation System

A local development version using the supplied college seal and navy, orange, and gold branding.

## Start

First run `npm install` in both backend and frontend, configure backend/.env from backend/.env.example, then run `npm run db:generate` in backend. Inside frontend, run `npm run dev`. This builds and starts the backend and website together. Open http://127.0.0.1:5174. Stop a previous reservation server before restarting.

## Included

Ten facilities, searchable category filters, reservation creation and cancellation, server-side conflict and date checks, laboratory utilization records, damage/loss reports, document-based guidelines, and contact information. Records are saved in the configured TiDB Cloud database. Local file storage remains available for development. No sample reservations or invented contact details are included.

## Before campus deployment

This version uses a local administrator access key and browser-session ownership. Add verified college account sign-in, an approved database with backups, and department-confirmed guidelines and contact details before using real student information or making it publicly accessible. Facility names transcribed from the handwritten reference should be confirmed by the department.

A QR code pointing to the final deployed dashboard URL can be added once a permanent address is available.

## Supplied college documents

About CeC presents the supplied vision, mission, philosophy, quality objectives, quality policy, institutional goals, core values, and organization. Original Word documents are available to download from the website. Historical targets, including 2024, are preserved. Leadership listings are attributed to the supplied file.

The HRM laboratory form supplies six guidelines and the two-day minimum advance reservation rule. Requests collect subject, instructor/signatory, and equipment quantities and are marked Awaiting signature. Use the downloadable form for physical signatures; administrator decisions are recorded in the admin portal after checking the physical signature. Existing records remain unchanged.

## Separate portals

- User portal: http://127.0.0.1:5174/ (or the port reported by Vite). Users browse facilities, check shared occupied slots, submit requests, track their own reservations and reports, and access guidelines and college documents.
- Admin portal: /admin. Administrators review requests, verify instructor signatures, approve or reject requests, see all facility bookings and utilization records, and resolve damage/loss reports.
- Admin access uses HM_ADMIN_KEY if configured, otherwise a generated key in backend/data/admin-access-key.txt. This local file is ignored by Git. Enter its contents at the admin sign-in screen. Do not share the key with students. Signing out clears the browser's admin session.
- User record ownership is tied to an opaque browser session stored on that device, not to a verified college account. Clearing browser storage loses that association. This is a local prototype; add institutional login and verified staff roles before campus deployment.
- Older records without a browser owner are visible only in the admin workspace. They are preserved.
- Approval requires confirmation that the instructor signature was checked; signatures remain on the downloaded physical form. Rejection requires a reason and releases the time slot. Resolved reports include an administrator resolution note.
- Backend guard checks enforce admin access and user cancellation ownership. The shared schedule does not include requester names, IDs, equipment, or session identifiers.


## Student and visitor experience

The user side uses a public website layout with top navigation, a welcome page, a three-step reservation guide, facility browsing, and personal booking cards. Shared occupied times can be filtered by space and date. Help groups guidelines, concerns, visit records, and contact information. Students enter a school ID; visitors can enter Visitor as their reference. Submitting a request opens My bookings with approval progress and the form download. The admin workspace remains a separate management interface at /admin.

## Booking contact and agreement

New reservation requests require a valid email address and acceptance of the Terms and Conditions. ID number is optional for bookings. The booking terms display the requirements from the supplied HRM laboratory form. Acceptance time and terms version are saved with each request, and the admin can see the email and acceptance date. This does not send email automatically or verify email ownership. Existing records are preserved; utilization and incident forms retain their previous ID requirement.

## Refined user booking flow

The user homepage opens directly with facility browsing and a compact booking guide; no hero is included. Facility cards use local SVG illustrations. Search and category filters show result counts and can be cleared. All ten facilities are shown. Availability is available from the main navigation.

Booking uses three steps: space/date/time, required name/email and optional ID, then activity details, request summary, required terms acceptance and submission. The selected date shows existing occupied time slots and overlapping times are checked before continuing; the server rechecks on submission. Going back preserves entered fields. My bookings has All, Upcoming, Waiting for approval and Past/closed filters with loading and empty states. Dialogs trap keyboard focus and prevent background scrolling. Admin behavior is unchanged.

## TiDB Cloud

The NestJS backend supports local file storage and TiDB Cloud via Prisma. The temporary admin access key is configured in backend/.env. TiDB credentials are configured privately in backend/.env. See backend/TIDB-SETUP.md for connection setup, schema deployment, checks, and non-destructive import. Existing local records remain intact. Placeholder credentials keep file mode; a real configured connection selects TiDB, and errors do not silently fall back to files.


## Complete backend workflows

Users book as guests; no account or sign-in is required. Each request requires full name, valid email, acceptance of laboratory terms, and an optional ID number. An opaque browser identifier limits access to that browser's records. Email is stored for contact but automated email delivery is not configured.

Facility lists and descriptions now come from the backend. Admins can change availability and descriptions and supply a notice for a closure. Unavailable spaces cannot receive new bookings or approvals. Existing bookings are preserved for review/cancellation. Admin cancellation requires a reason, visible in the user's record. Approvals still require verification of the instructor's physical signature.

Requests, reviews, cancellation, utilization, reports and resolutions are saved by the backend. Both portals refresh automatically every 30 seconds while visible and when their window regains focus. Shared schedules do not expose requester details. Facility settings survive a restart and are included in the TiDB import.

From backend, `npm run verify:workflows` exercises the actual website proxy and API with disposable records, including conflicts, authorization, facility closures, review decisions, incident resolution, and restart persistence. The verified storage mode is now TiDB Cloud. Schema deployment, database connection, record insertion, transaction update, and reads from a separate backend instance have passed.

All guest submissions (bookings, incident reports and visit records) now collect full name, valid email and an optional ID number. No student/user sign-in is required. Administrator sign-in remains separate. The live workflow suite passed 37 HTTP checks through the website proxy with temporary records. Current preview startup verifies records, schedules, facility lists and configured administrator access before showing ready.

## Connected TiDB instance

On October 9, 2026, the backend was switched to TiDB Cloud instance cec-hm-reservations, ID 10626798825279771951, AWS Tokyo, Starter plan with a $0 monthly spending limit. The application uses the test database with strict TLS. Migrations and live read/write/transaction checks passed; the temporary test record was removed. There were no local records to import. Credentials remain in the ignored backend/.env.


## Netlify frontend deployment

The root netlify.toml builds frontend with npm run build and publishes frontend/dist. SPA redirects support /admin and refreshed page URLs. Database credentials and HM_ADMIN_KEY belong only in the backend hosting environment, never in frontend variables.

After the backend is deployed to Vercel, set VITE_API_BASE_URL in Netlify to its HTTPS origin (without /api) and trigger a new frontend build. Configure the backend to allow this Netlify origin, Content-Type, Authorization and X-User-Session headers for CORS. Until the public backend is configured, the site offers facility and college information and clearly marks online booking as unavailable; it does not pretend to save requests.
