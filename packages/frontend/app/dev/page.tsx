'use client'

import { isProd } from '@koh/common'
import { Button, Divider, Input, Tooltip } from 'antd'
import { notFound } from 'next/navigation'
import React, { ReactElement, useState } from 'react'
import { message } from 'antd'
import { getErrorMessage } from '../utils/generalUtils'
import { API } from '../api'

export default function DevPanel(): ReactElement {
  if (isProd()) {
    // shouldn't be needed due to the redirect in layout.tsx but just in case
    notFound()
  }

  const [migrationName, setMigrationName] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)

  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-y-10">
      <h1>[ For Development Use Only ]</h1>
      <div className="flex flex-col items-center justify-center">
        <Divider plain>
          <h3>Seed</h3>
        </Divider>
        <div className="flex items-center justify-center">
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .delete()
                .then(() => {
                  message.success('Data deleted successfully')
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while deleting the data: ${errorMessage}`,
                  )
                })
            }}
          >
            Delete Data
          </Button>
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .create()
                .then(() => {
                  message.success('Data seeded successfully')
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while seeding data: ${errorMessage}`,
                  )
                })
            }}
          >
            Seed Data
          </Button>
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .fillQueue()
                .then(() => {
                  message.success('Queue filled successfully')
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while adding questions to the queue: ${errorMessage}`,
                  )
                })
            }}
          >
            Add Questions to Queue
          </Button>
          <Button
            style={{ marginRight: '15px' }}
            type="default"
            onClick={() => {
              API.seeds
                .fillAnytimeQuestions()
                .then(() => {
                  message.success(
                    'Successfully created 100 test Anytime Questions',
                  )
                })
                .catch((error) => {
                  const errorMessage = getErrorMessage(error)
                  message.error(
                    `Error occurred while creating anytime questions: ${errorMessage}`,
                  )
                })
            }}
          >
            Generate 100 Anytime Questions
          </Button>
          <Tooltip title="Note that 'Seed Data' already does this .">
            <Button
              style={{ marginRight: '15px' }}
              type="default"
              onClick={() => {
                API.seeds
                  .createMailServices()
                  .then((msg) => {
                    message.success(msg)
                  })
                  .catch((error) => {
                    const errorMessage = getErrorMessage(error)
                    message.error(
                      `Error occurred while creating mail services: ${errorMessage}`,
                    )
                  })
              }}
            >
              Create Mail Services & Populate mail subscriptions
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <Divider plain>
          <h3>Database Backups</h3>
        </Divider>
        <p className="mb-4 max-w-xl text-center text-sm text-gray-500">
          Export your dev database before running migrations or switching
          branches, then load it back later. Gets stored at{' '}
          <code>&lt;project-root&gt;/backups/dev-backup.sql.gz</code>. See{' '}
          <a
            href="https://github.com/ubco-db/helpme/blob/master/docs/BACKUPS.md"
            target="_blank"
            rel="noreferrer"
          >
            BACKUPS.md
          </a>{' '}
          for more details.
        </p>
        <div className="flex items-center justify-center">
          <Tooltip title="Creates a gzipped backup of all databases (dev + chatbot) using pg_dumpall. Saved to backups/dev-backup.sql.gz">
            <Button
              style={{ marginRight: '15px' }}
              type="default"
              onClick={() => {
                const hide = message.loading('Exporting backup...', 0)
                API.seeds
                  .exportBackup()
                  .then((msg) => {
                    hide()
                    message.success(msg)
                  })
                  .catch((error) => {
                    hide()
                    const errorMessage = getErrorMessage(error)
                    message.error(`Error exporting backup: ${errorMessage}`)
                  })
              }}
            >
              Export Backup
            </Button>
          </Tooltip>
          <Tooltip title="Drops the dev and chatbot databases, restores from the last exported backup, and flushes redis. You may need to restart the server afterwards.">
            <Button
              style={{ marginRight: '15px' }}
              type="default"
              onClick={() => {
                const hide = message.loading('Loading backup...', 0)
                API.seeds
                  .loadBackup()
                  .then((msg) => {
                    hide()
                    message.success(msg)
                  })
                  .catch((error) => {
                    hide()
                    const errorMessage = getErrorMessage(error)
                    message.error(`Error loading backup: ${errorMessage}`)
                  })
              }}
            >
              Load Backup
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <Divider plain>
          <h3>Migration (do after making database changes)</h3>
        </Divider>
        <p className="mb-4 max-w-xl text-center text-sm text-gray-500">
          Automatically exports a backup, runs{' '}
          <code>yarn migration:generate</code> (which wipes the database), and
          then restores your backup. Commit the generated migration file to Git!
        </p>
        <div className="flex items-center justify-center gap-x-3">
          <Input
            placeholder="migration-name (e.g. add-user-field)"
            value={migrationName}
            onChange={(e) => setMigrationName(e.target.value)}
            style={{ width: 300 }}
            onPressEnter={() => {
              if (migrationName.trim() && !isMigrating) {
                setIsMigrating(true)
                const hide = message.loading(
                  'Running migration (this may take a minute, check server console for progress)...',
                  0,
                )
                API.seeds
                  .migrateWithBackup(migrationName.trim())
                  .then((msg) => {
                    hide()
                    message.success({
                      content:
                        'Migration completed! Check server logs for details.',
                      duration: 8,
                    })
                    console.log('Migration result:', msg)
                  })
                  .catch((error) => {
                    hide()
                    const errorMessage = getErrorMessage(error)
                    message.error(`Error during migration: ${errorMessage}`)
                  })
                  .finally(() => setIsMigrating(false))
              }
            }}
          />
          <Tooltip title="This will: 1) Export a backup, 2) Run yarn migration:generate (wipes the DB), 3) Restore your backup">
            <Button
              type="default"
              loading={isMigrating}
              disabled={!migrationName.trim()}
              onClick={() => {
                setIsMigrating(true)
                const hide = message.loading(
                  'Running migration (this may take a minute)...',
                  0,
                )
                API.seeds
                  .migrateWithBackup(migrationName.trim())
                  .then((msg) => {
                    hide()
                    message.success({
                      content:
                        'Migration completed! Check server logs for details.',
                      duration: 8,
                    })
                    console.log('Migration result:', msg)
                  })
                  .catch((error) => {
                    hide()
                    const errorMessage = getErrorMessage(error)
                    message.error(`Error during migration: ${errorMessage}`)
                  })
                  .finally(() => setIsMigrating(false))
              }}
            >
              Generate Migration
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
