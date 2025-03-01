import { chmod } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const startScriptPath = join(__dirname, 'start-app.command');

async function makeExecutable() {
  try {
    // 0o755 gives read, write, execute permissions to owner and read+execute to others
    await chmod(startScriptPath, 0o755);
    console.log('✅ start-app.command is now executable');
    console.log('👉 You can now double-click start-app.command to run the app');
  } catch (error) {
    console.error('Error making file executable:', error);
  }
}

makeExecutable();