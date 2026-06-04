const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PG_VERSION = '16.14-1';
const DOWNLOAD_URL = 'https://get.enterprisedb.com/postgresql/postgresql-16.14-1-windows-x64-binaries.zip';
const BASE_DIR = path.resolve(__dirname, '..');
const PG_DIR = path.join(BASE_DIR, '.postgres');
const PG_BIN_DIR = path.join(PG_DIR, 'pgsql', 'bin');
const DATA_DIR = path.join(PG_DIR, 'data');
const TEMP_ZIP = path.join(PG_DIR, 'pg_temp.zip');
const SCHEMA_FILE = path.join(BASE_DIR, 'server', 'database', 'schema.sql');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Starting download from: ${url}`);
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP Status ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      let lastPercent = -1;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = Math.floor((downloaded / totalSize) * 100);
        if (percent % 10 === 0 && percent !== lastPercent) {
          console.log(`Downloading PostgreSQL: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
          lastPercent = percent;
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log('Download complete.');
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function runCommand(cmd, options = {}) {
  try {
    return execSync(cmd, { stdio: 'inherit', ...options });
  } catch (error) {
    if (options.ignoreError) {
      console.log(`Command failed (ignored): ${cmd}`);
      return null;
    }
    throw error;
  }
}

async function main() {
  try {
    if (!fs.existsSync(PG_DIR)) {
      fs.mkdirSync(PG_DIR, { recursive: true });
    }

    const initdbExe = path.join(PG_BIN_DIR, 'initdb.exe');
    if (!fs.existsSync(initdbExe)) {
      console.log('PostgreSQL binaries not found. Downloading...');
      if (!fs.existsSync(TEMP_ZIP)) {
        await downloadFile(DOWNLOAD_URL, TEMP_ZIP);
      }
      
      console.log('Extracting PostgreSQL binaries...');
      // Use built-in Windows tar utility to extract zip
      runCommand(`tar -xf "${TEMP_ZIP}" -C "${PG_DIR}"`);
      
      console.log('Cleaning up temporary download file...');
      fs.unlinkSync(TEMP_ZIP);
      console.log('PostgreSQL binaries extracted successfully.');
    } else {
      console.log('PostgreSQL binaries already present.');
    }

    // Initialize database if data directory is empty
    if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
      console.log('Initializing database cluster...');
      runCommand(`"${path.join(PG_BIN_DIR, 'initdb.exe')}" -U postgres -A trust -D "${DATA_DIR}"`);
    } else {
      console.log('Database cluster already initialized.');
    }

    // Start PostgreSQL
    console.log('Starting PostgreSQL server on port 5433...');
    const pgLog = path.join(PG_DIR, 'pg.log');
    // Stop server first in case it is already running
    try {
      execSync(`"${path.join(PG_BIN_DIR, 'pg_ctl.exe')}" -D "${DATA_DIR}" stop`, { stdio: 'ignore' });
    } catch (e) {}
    
    // Start it up
    runCommand(`"${path.join(PG_BIN_DIR, 'pg_ctl.exe')}" -D "${DATA_DIR}" -l "${pgLog}" -o "-p 5433" start`);
    
    // Wait a brief moment for startup
    console.log('Waiting for PostgreSQL to start...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create database
    console.log('Creating database "exp_tracker"...');
    try {
      execSync(`"${path.join(PG_BIN_DIR, 'createdb.exe')}" -U postgres -p 5433 exp_tracker`, { stdio: 'ignore' });
      console.log('Database "exp_tracker" created successfully.');
    } catch (error) {
      console.log('Database "exp_tracker" already exists or could not be created (this is usually fine if it already exists).');
    }

    // Run schema
    console.log('Running database schema.sql...');
    runCommand(`"${path.join(PG_BIN_DIR, 'psql.exe')}" -U postgres -d exp_tracker -p 5433 -f "${SCHEMA_FILE}"`);
    
    console.log('\n=========================================');
    console.log('PostgreSQL Setup Completed Successfully!');
    console.log('Server is running on port 5433.');
    console.log('Database: exp_tracker');
    console.log('User: postgres');
    console.log('No password required (trust authentication).');
    console.log('=========================================\n');

  } catch (error) {
    console.error('Error during database setup:', error);
    process.exit(1);
  }
}

main();
