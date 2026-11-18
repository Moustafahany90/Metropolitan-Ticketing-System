-- Runs once, on first Postgres data-directory initialization.
-- The primary application database (POSTGRES_DB, default "ticketing") is created
-- automatically by the postgres image entrypoint. Create the second database used
-- by the Maintenance module on the same server/cluster.
CREATE DATABASE maintenance;
