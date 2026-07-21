import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { load, dump } from 'js-yaml';

const [outputPath, ...inputPaths] = process.argv.slice(2);
if (!outputPath || inputPaths.length !== 2) {
  throw new Error('Usage: merge-update-info.mjs <output> <x64-yml> <arm64-yml>');
}

const documents = await Promise.all(
  inputPaths.map(async (inputPath) => ({
    inputPath,
    value: load(await readFile(inputPath, 'utf8')),
  })),
);
const versions = new Set(documents.map(({ value }) => value?.version));
if (versions.size !== 1 || versions.has(undefined)) {
  throw new Error(`Update metadata versions disagree: ${[...versions].join(', ')}`);
}

const files = documents.flatMap(({ inputPath, value }) => {
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new Error(`${inputPath} does not contain update files`);
  }
  return value.files;
});
const uniqueFiles = [...new Map(files.map((file) => [file.url, file])).values()].sort((a, b) =>
  a.url.localeCompare(b.url),
);
if (
  !uniqueFiles.some(({ url }) => url.includes('arm64')) ||
  !uniqueFiles.some(({ url }) => url.includes('x64'))
) {
  throw new Error('Combined update metadata must contain both arm64 and x64 files');
}

for (const { url } of uniqueFiles) {
  await access(path.join(path.dirname(outputPath), path.basename(url)));
}

const x64Document = documents.find(({ value }) =>
  value.files.some(({ url }) => url.includes('x64')),
)?.value;
const releaseDates = documents
  .map(({ value }) => value.releaseDate)
  .filter(Boolean)
  .sort();
const merged = {
  ...x64Document,
  version: [...versions][0],
  files: uniqueFiles,
  releaseDate: releaseDates.at(-1),
};

await writeFile(outputPath, dump(merged, { lineWidth: -1, noRefs: true }));
process.stdout.write(`Combined ${uniqueFiles.length} update files in ${outputPath}\n`);
