# Backups

## Saving backups

There are three types of database backups and one for the uploads directory in the backend:

- Database
  - **Semi-Hourly**: Every 3 hours. These are rolling (we only keep 5 days of these). We also only take these from 7am to 10pm.
  - **Daily**: Every day at midnight. These are rolling (we only keep 1 month of these)
  - **Monthly**: The first of every month at midnight. These are kept indefinitely.
- Uploads
  - **Every 4 Days**: Every day at midnight. These are rolling (we keep the last 12 days worth / the last 3 backups)

All of these can be adjusted easily in backup.service.ts

For database backups, we are using `pg_dumpall` which back ups both our `prod` as well as our `chatbot` databases.

For uploads backups, we are simply using `tar` to compress the files of the uploads directory.

## Restoring a database backup

NOTE: my database container name is `helpme-postgresql-1`, you may need to change that in the commands.

To restore a backup, you must first delete all the data in the database. You can do this by running the following command (make sure to change it to the database you want to drop):
`docker exec -i helpme-postgresql-1 psql -U postgres -c "DROP DATABASE IF EXISTS dev/prod/chatbot/etc.;"`

To restore a backup, you can navigate to backups/[daily/semi-hourly/monthly] and use the following command (change the backup file name to the one you want to restore):
`gunzip -c backup-2024-09-30.sql.gz | docker exec -i helpme-postgresql-1 psql -U postgres`
This will restore any deleted databases. Any non-deleted database will just tell you some warnings that data already exists etc. and won't actually do anything.

Don't forget to enter the redis container ("Exec" tab), run `redis-cli` and run `flushall` so that redis doesn't have the old data!

Note: You might want to restart the server since routing can get a little messed up after restoring?

Prod's postgres docker container is called `helpme_2024_03_18-postgresql-1`

## Restoring an Uploads Backup

To avoid filename conflicts, delete all files in the uploads folder before beginning the data restoration process. You can do this through an available GUI (decompress the backup) or through the command: `tar -xzf ../../backups/uploads-daily/uploads_backup-YYYY-MM-DD.tar.gz -C ./uploads/`. Bear in mind that this should be run from the ```./packages/server``` directory.
