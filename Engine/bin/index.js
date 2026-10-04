#!/usr/bin/env node
import path from 'node:path';
import { downloadTemplate } from 'giget';

const TEMPLATE_SOURCE = 'github:DevIlannn/open_pack/Source';
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const [projectName] = process.argv.slice(2);

async function main() {
  if (!projectName) {
    console.log('Usage: npx open_pack@latest <project-name>');
    process.exitCode = 1;
    return;
  }

  if (!NAME_PATTERN.test(projectName)) {
    console.error('Invalid project name. Use letters, numbers, dot, dash, or underscore.');
    process.exitCode = 1;
    return;
  }

  const targetDirectory = path.resolve(process.cwd(), projectName);

  console.log(`Creating ${projectName} from Open Pack...`);
  await downloadTemplate(TEMPLATE_SOURCE, { dir: targetDirectory });

  console.log(
    `\nDone. Next steps:\n\n  cd ${projectName}\n  npm install\n  cp .env.examples .env\n  node --env-file=.env core/index.js\n`
  );
}

main().catch((error) => {
  console.error(`Failed to create project: ${error.message}`);
  process.exitCode = 1;
});