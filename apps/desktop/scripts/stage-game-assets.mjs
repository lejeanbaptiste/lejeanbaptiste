import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(scriptDir, '../resources/game-assets/assets.bin');

export default async function stageGameAssets(context) {
  const destination = path.join(context.appOutDir, 'resources', 'game-assets', 'assets.bin');
  await mkdir(path.dirname(destination), { recursive: true });

  const attempts = 5;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await copyFile(source, destination);
      console.log(`Staged game asset bundle on attempt ${attempt}: ${destination}`);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.warn(`Game asset bundle is busy on attempt ${attempt}; retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }
}
