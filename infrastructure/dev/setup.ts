import * as fs from 'node:fs'
import { exec } from 'node:child_process'

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

function log(msg: string, color?: string) {
  if (!color || !colors[color]) {
    process.stdout.write(`${colors['reset']}[${new Date().toLocaleTimeString('en-US',{ hour: 'numeric', minute: 'numeric', second: 'numeric' })}] ${msg}`);
    return;
  }
  process.stdout.write(`${colors[color]}[${new Date().toLocaleTimeString('en-US',{ hour: 'numeric', minute: 'numeric', second: 'numeric' })}] ${msg}${colors['reset']}`);
}

const SERVER_ROOT = './packages/server/';
const FRONTEND_ROOT = './packages/frontend/';

function initEnv(env: string, template: string, root: string) {
  if (!fs.existsSync(`${root}${env}`)) {
    log(`Initializing ${root}${env} to ${root}${template}\n`,'green');
    fs.copyFileSync(`${root}${env}`,`${root}${template}`);
  } else {
    log(`${root}${env} already exists, skipping\n`,'yellow');
  }
}

const envs = [
  { env: '.env', template: 'env.development', root: SERVER_ROOT },
  { env: 'postgres.env', template: 'postgres.env.example', root: SERVER_ROOT },
  { env: '.env', template: 'dev.env', root: FRONTEND_ROOT },
]

log(`Initializing environment variable files\n`,'blue');
for (const { env, template, root } of envs) {
  initEnv(env,template,root)
}

async function runDocker(){
  return new Promise<void>((resolve, reject) => {
    log(`Spinning up Docker environment\n`,'blue');

    const child = exec('docker compose up -d');

    // docker writes to stderr no matter what
    child.stderr.on('data', function(data) {
      data = data.toString();
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.trim().length === 0) {
          continue;
        }
        log(`${line}\n`,'blue');
      }
    });
    child.on('close', function(code) {
      log(`Process exited with code ${code}`, code != 0 ? 'red' : undefined)
      child.kill()
      if (code != 0) {
        reject()
      } else {
        resolve()
      }
    });
  });
}

(async () => {
  try {
    await runDocker();
    process.stdout.write('\n')
    log('Successfully initialized! Next step: run \'yarn dev\' from project root directory.\n','green')
  } catch (e) {
    log(e.toString(),'red')
  }
})()