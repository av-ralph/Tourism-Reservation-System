# TiDB Cloud setup

The existing NestJS backend supports TiDB through Prisma's MySQL connector. Current local records remain in backend/data/records.json until explicitly imported.

## Connect your cluster

1. Open your TiDB Cloud cluster and select **Connect → Prisma**. Choose the correct database and copy the provided connection string.
2. In backend/.env, replace the placeholder DATABASE_URL with that string. Keep the password in this file only. Password characters in the URL must be percent-encoded; use the connection string supplied by TiDB. Keep `sslaccept=strict`; include `sslcert` if the Connect dialog supplies a certificate.
3. Add `HM_STORAGE=tidb` in the same file. `HM_STORAGE=file` explicitly keeps local storage. With no HM_STORAGE setting, a non-placeholder DATABASE_URL selects TiDB automatically.
4. From the backend directory run `npm run db:generate`, `npm run build`, then `npm run db:deploy` to apply the new HM tables without resetting existing database data.
5. Run `npm run db:check` to verify the live database and tables.
6. Run `npm run db:import` to copy local reservations, reports, and utilization records to TiDB. Existing IDs are skipped, and the source JSON file is retained. Repeating the import does not duplicate records or overwrite reviewed database records.
7. Restart the combined application (`npm run dev` from the frontend directory). The frontend API address remains unchanged.

Official connection instructions: https://docs.pingcap.com/developer/dev-guide-sample-application-nodejs-prisma/

## Temporary admin sign-in

The supplied temporary access key is stored as HM_ADMIN_KEY in the ignored backend/.env. It is separate from the TiDB database password. The frontend does not receive database credentials. No automatic student account sign-in or email verification has been added.

## What is stored

`hm_records` contains one row per reservation, damage/loss report, or utilization record. Indexed fields support type, owner, facility, date, and status; the JSON payload preserves all existing form fields, email, terms acceptance time/version, instructor, equipment, review, and resolution details.

`hm_write_lock` serializes database updates. Booking conflicts are checked inside the same transaction using locking reads, so competing requests cannot both take an overlapping time slot. Conflicting transactions retry up to three times. This simple global lock is suitable for the current small campus system; larger workloads can later use per-facility locking and direct indexed queries.

Database failures do not switch automatically to local storage. When you choose TiDB, the backend must connect successfully before starting. No credentials are printed by the database check/import/deployment helpers. Local tests use disposable files and never write test bookings into the real TiDB database.

## Verification

`npm run db:validate` checks the schema. `npm run build` builds the backend. `node scripts/verify-system.mjs` checks the booking and access rules using local test storage. Live connection verification requires the real DATABASE_URL and is reported separately by `npm run db:check`.


## Current connection status

Connected and verified on October 9, 2026: cec-hm-reservations (10626798825279771951), TiDB Starter, AWS Tokyo, $0 monthly spending limit, database test, strict TLS. HM_STORAGE is explicitly tidb. Migrations, connection checks, database insert, transaction update, and a separate-instance read passed. Verification data was removed, and no local records existed to import. The combined application now starts using TiDB.
