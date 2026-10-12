#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { downloadTemplate } from 'giget';
import chalk from 'chalk';
import ora from 'ora';

const TEMPLATE_SOURCE = 'github:DevIlannn/open_pack/Source';
const PACKAGE_COMMAND = 'npx @ilanalimanjs/open_pack@latest';
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const [projectName] = process.argv.slice(2);

const accent = chalk.cyan;
const muted = chalk.gray;

const printHeader = () => {
  console.log();
  console.log(`  ${chalk.bold('Open Pack')}  ${muted('Fast starter for Node.js, Express, and PostgreSQL')}`);
  console.log();
};

const printFailure = (title, detail) => {
  console.log(`  ${chalk.red('✖')} ${chalk.bold(title)}`);
  if (detail) console.log(`    ${muted(detail)}`);
  console.log();
  process.exitCode = 1;
};

const printUsage = () => {
  console.log(`  ${muted('Usage')}`);
  console.log(`  ${PACKAGE_COMMAND} ${accent('<project-name>')}`);
  console.log();
  console.log(`  ${muted('Example')}`);
  console.log(`  ${PACKAGE_COMMAND} ${accent('my-project')}`);
  console.log();
};

const printNextSteps = (name, startedAt) => {
  const duration = ((performance.now() - startedAt) / 1000).toFixed(1);
  const steps = [
    `cd ${name}`,
    'npm install',
    'cp .env.examples .env',
    'npm run dev',
  ];

  console.log();
  console.log(`  ${chalk.green('✔')} ${chalk.bold(name)} is ready ${muted(`in ${duration}s`)}`);
  console.log();
  console.log(`  ${muted('Next steps')}`);
  steps.forEach((step, index) => {
    console.log(`  ${muted(`${index + 1}`)}  ${accent(step)}`);
  });
  console.log();
  console.log(`  ${muted('Fill in')} DATABASE_URL ${muted('and')} SESSION_SECRET ${muted('inside .env before running.')}`);
  console.log(`  ${muted('Health check')} http://localhost:3000/api/health`);
  console.log();
};

async function main() {
  printHeader();

  if (!projectName) {
    printFailure('Project name is required');
    printUsage();
    return;
  }

  if (!NAME_PATTERN.test(projectName)) {
    printFailure('Invalid project name', 'Use letters, numbers, dot, dash, or underscore.');
    return;
  }

  const targetDirectory = path.resolve(process.cwd(), projectName);
  const startedAt = performance.now();
  const spinner = ora({ text: `Creating ${chalk.bold(projectName)} from the Open Pack template`, indent: 2 }).start();

  try {
    await downloadTemplate(TEMPLATE_SOURCE, { dir: targetDirectory });
    spinner.stop();
    printNextSteps(projectName, startedAt);
  } catch (error) {
    spinner.stop();
    const alreadyExists = /already exists/i.test(error.message);
    printFailure(
      alreadyExists ? 'Directory already exists' : 'Failed to create project',
      alreadyExists ? `Choose another name or remove ${targetDirectory}` : error.message
    );
  }
}

main();