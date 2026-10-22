#!/usr/bin/env node
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import * as prompts from '@clack/prompts';
import fse from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';

process.noDeprecation = true;

const { version: CLI_VERSION } = createRequire(import.meta.url)('../package.json');

const TEMPLATE_SOURCE = 'github:DevIlannn/open_pack/Source';
const REGISTRY_URL = 'https://registry.npmjs.org/@ilanalimanjs%2Fopen_pack/latest';
const PACKAGE_COMMAND = 'npx @ilanalimanjs/open_pack@latest';
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;
const ENV_EXAMPLE_FILE = '.env.examples';
const ENV_FILE = '.env';
const LINUX_CHASSIS_FILE = '/sys/class/dmi/id/chassis_type';
const LINUX_POWER_SUPPLY_DIRECTORY = '/sys/class/power_supply';
const WINDOWS_CHASSIS_SCRIPT = '(Get-CimInstance -ClassName Win32_SystemEnclosure).ChassisTypes';
const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;
const PORT_SEARCH_RANGE = 50;
const MIN_NODE_VERSION = { major: 20, minor: 11 };
const BANNER_DELAY_MS = 70;
const STEP_MIN_DURATION_MS = 450;
const DETECT_TIMEOUT_MS = 4000;
const UPDATE_TIMEOUT_MS = 2500;
const EXIT_INTERRUPTED = 130;
const GRADIENT = ['#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa'];
const CHASSIS_LAPTOP = new Set([8, 9, 10, 14, 31, 32]);
const CHASSIS_PC = new Set([3, 4, 5, 6, 7, 13, 15, 16, 24, 35, 36]);

const GLYPHS = [
  [String.raw`  ___  `, String.raw` / _ \ `, String.raw`| | | |`, String.raw`| |_| |`, String.raw` \___/ `],
  [String.raw` ____  `, String.raw`|  _ \ `, String.raw`| |_) |`, String.raw`|  __/ `, String.raw`|_|    `],
  [String.raw` _____ `, String.raw`| ____|`, String.raw`|  _|  `, String.raw`| |___ `, String.raw`|_____|`],
  [String.raw` _   _ `, String.raw`| \ | |`, String.raw`|  \| |`, String.raw`| |\  |`, String.raw`|_| \_|`],
  [String.raw` ____  `, String.raw`|  _ \ `, String.raw`| |_) |`, String.raw`|  __/ `, String.raw`|_|    `],
  [String.raw`    _     `, String.raw`   / \    `, String.raw`  / _ \   `, String.raw` / ___ \  `, String.raw`/_/   \_\ `],
  [String.raw`  ____ `, String.raw` / ___|`, String.raw`| |    `, String.raw`| |___ `, String.raw` \____|`],
  [String.raw` _  __ `, String.raw`| |/ / `, String.raw`| ' /  `, String.raw`| . \  `, String.raw`|_|\_\ `]
];

const BANNER_LINES = GLYPHS[0].map((_, row) => GLYPHS.map((glyph) => glyph[row]).join(''));

const PACKAGE_MANAGERS = {
  npm: { label: 'npm', install: ['install'], dev: ['run', 'dev'] },
  pnpm: { label: 'pnpm', install: ['install'], dev: ['run', 'dev'] },
  yarn: { label: 'yarn', install: ['install'], dev: ['run', 'dev'] },
  bun: { label: 'bun', install: ['install'], dev: ['run', 'dev'] }
};

const PLATFORM_LABELS = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
  android: 'Android'
};

const DEVICE_TYPES = {
  phone: 'Phone',
  laptop: 'Laptop',
  pc: 'PC',
  other: 'Other'
};

const MODES = {
  run: 'run',
  install: 'install',
  none: 'none'
};

const CLI_OPTIONS = {
  yes: { type: 'boolean', short: 'y' },
  pm: { type: 'string' },
  port: { type: 'string' },
  'no-install': { type: 'boolean' },
  'no-run': { type: 'boolean' },
  'no-update-check': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' }
};

const HELP_OPTIONS = [
  ['-y, --yes', 'Skip prompts and use defaults'],
  ['--pm <name>', 'Package manager: npm, pnpm, yarn, bun'],
  ['--port <number>', `Development server port (default ${DEFAULT_PORT})`],
  ['--no-install', 'Create the project without installing dependencies'],
  ['--no-run', 'Install dependencies without starting the server'],
  ['--no-update-check', 'Skip the CLI update check'],
  ['-h, --help', 'Show this help'],
  ['-v, --version', 'Show the CLI version']
];

const accent = chalk.hex('#38bdf8');
const muted = chalk.gray;
const isWindows = process.platform === 'win32';
const isTTY = Boolean(process.stdout.isTTY && process.stdin.isTTY);
const SHELL_TOOLS = new Set(Object.keys(PACKAGE_MANAGERS));

const BAR = muted('│');
const END = muted('└');
const SPINNER = { interval: 80, frames: ['◒', '◐', '◓', '◑'] };
const activity = { spinner: null };

class UsageError extends Error {}

const pause = (ms) => (isTTY ? sleep(ms) : Promise.resolve());

const visibleLength = (value) => value.replace(ANSI_PATTERN, '').length;

const spawnTool = (command, args, options) =>
  isWindows && SHELL_TOOLS.has(command)
    ? spawn([command, ...args].join(' '), { ...options, shell: true })
    : spawn(command, args, options);

const renderCard = (title, rows) => {
  const labelWidth = Math.max(...rows.map((row) => visibleLength(row.label)));
  const lines = rows.map((row) => `${row.label}${' '.repeat(labelWidth - visibleLength(row.label))}  ${row.value}`);
  const width = Math.max(visibleLength(title) + 1, ...lines.map(visibleLength));
  const inner = width + 2;
  const border = chalk.hex('#475569');
  const top = border('╭─ ') + chalk.bold(title) + border(` ${'─'.repeat(inner - visibleLength(title) - 3)}╮`);
  const body = lines.map((line) => `${border('│')} ${line}${' '.repeat(width - visibleLength(line))} ${border('│')}`);
  const bottom = border(`╰${'─'.repeat(inner)}╯`);
  return [top, ...body, bottom].map((line) => `  ${line}`).join('\n');
};

const compareVersions = (left, right) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const validateProjectName = (value) => {
  if (!value) return 'Project name is required';
  if (!NAME_PATTERN.test(value)) return 'Use letters, numbers, dot, dash, or underscore';
  return undefined;
};

const validatePort = (value) => {
  const port = Number(value);
  return /^\d+$/.test(String(value ?? '')) && port >= 1 && port <= MAX_PORT
    ? undefined
    : `Use a port between 1 and ${MAX_PORT}`;
};

const validateFlags = ({ values, positionals }) => {
  const checks = [
    positionals[0] === undefined ? undefined : validateProjectName(positionals[0]),
    values.pm === undefined || PACKAGE_MANAGERS[values.pm] ? undefined : '--pm must be one of npm, pnpm, yarn, bun',
    values.port === undefined ? undefined : validatePort(values.port)
  ];
  return checks.find(Boolean);
};

const resolveFixedMode = (values) => {
  if (values['no-install']) return MODES.none;
  if (values['no-run']) return MODES.install;
  return undefined;
};

const readFixedOptions = ({ values, positionals }) => ({
  name: positionals[0],
  packageManager: values.pm,
  port: values.port === undefined ? undefined : Number(values.port),
  mode: resolveFixedMode(values)
});

const captureCommand = (command, args) =>
  new Promise((resolve) => {
    const child = spawnTool(command, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout: DETECT_TIMEOUT_MS });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? output.trim() : null));
  });

const captureFirstLine = async (command, args) => (await captureCommand(command, args))?.split('\n')[0].trim() ?? null;

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });

const findFreePort = async (start) => {
  for (let offset = 0; offset < PORT_SEARCH_RANGE && start + offset <= MAX_PORT; offset += 1) {
    if (await isPortFree(start + offset)) return start + offset;
  }
  throw new Error(`No free port found from ${start}`);
};

const fetchLatestVersion = async () => {
  try {
    const response = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(UPDATE_TIMEOUT_MS) });
    if (!response.ok) return null;
    const { version } = await response.json();
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
};

const parseLauncher = () => {
  const [agent] = (process.env.npm_config_user_agent ?? '').split(' ');
  const [name, version] = agent.split('/');
  return PACKAGE_MANAGERS[name] ? { name, version } : null;
};

const isNodeSupported = () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major > MIN_NODE_VERSION.major || (major === MIN_NODE_VERSION.major && minor >= MIN_NODE_VERSION.minor);
};

const classifyChassis = (code) => {
  if (CHASSIS_LAPTOP.has(code)) return DEVICE_TYPES.laptop;
  if (CHASSIS_PC.has(code)) return DEVICE_TYPES.pc;
  return DEVICE_TYPES.other;
};

const isAndroid = () =>
  process.platform === 'android' || Boolean(process.env.TERMUX_VERSION) || (process.env.PREFIX ?? '').includes('com.termux');

const readLinuxChassis = async () => {
  try {
    return Number((await fse.readFile(LINUX_CHASSIS_FILE, 'utf8')).trim());
  } catch {
    return null;
  }
};

const hasLinuxBattery = async () => {
  try {
    return (await fse.readdir(LINUX_POWER_SUPPLY_DIRECTORY)).some((entry) => /^BAT/i.test(entry));
  } catch {
    return false;
  }
};

const detectDeviceType = async () => {
  if (isAndroid()) return DEVICE_TYPES.phone;

  if (process.platform === 'win32') {
    const output = await captureCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_CHASSIS_SCRIPT]);
    return classifyChassis(Number((output ?? '').split(/\s+/).find((token) => /^\d+$/.test(token))));
  }

  if (process.platform === 'darwin') {
    const output = await captureCommand('pmset', ['-g', 'batt']);
    return output?.includes('InternalBattery') ? DEVICE_TYPES.laptop : DEVICE_TYPES.pc;
  }

  if (process.platform === 'linux') {
    const code = await readLinuxChassis();
    if (code !== null) return classifyChassis(code);
    return (await hasLinuxBattery()) ? DEVICE_TYPES.laptop : DEVICE_TYPES.other;
  }

  return DEVICE_TYPES.other;
};

const detectIpAddress = () => {
  const [entry] = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal);
  return entry?.address ?? null;
};

const formatSystem = () => {
  const release = os.release().split('-')[0];
  const arch = os.arch();
  if (isAndroid()) return `Android (kernel ${release}, ${arch})`;
  return `${PLATFORM_LABELS[process.platform] ?? process.platform} ${release} (${arch})`;
};

const detectEnvironment = async ({ port, checkUpdate }) => {
  const managerNames = Object.keys(PACKAGE_MANAGERS);
  const [gitVersion, portFree, latestVersion, device, ...managerVersions] = await Promise.all([
    captureFirstLine('git', ['--version']),
    isPortFree(port),
    checkUpdate ? fetchLatestVersion() : Promise.resolve(null),
    detectDeviceType(),
    ...managerNames.map((name) => captureFirstLine(name, ['--version']))
  ]);
  const managers = Object.fromEntries(
    managerNames.map((name, index) => [name, managerVersions[index]]).filter(([, version]) => version)
  );

  return {
    system: formatSystem(),
    device,
    ipAddress: detectIpAddress(),
    node: process.versions.node,
    nodeSupported: isNodeSupported(),
    launcher: parseLauncher(),
    managers,
    git: gitVersion ? gitVersion.replace(/^git version\s*/, '') : null,
    port,
    portFree,
    latestVersion
  };
};

const printEnvironmentCard = (environment) => {
  const hasUpdate = environment.latestVersion && compareVersions(environment.latestVersion, CLI_VERSION) > 0;
  const nodeValue = environment.nodeSupported
    ? `v${environment.node}`
    : chalk.red(`v${environment.node} (requires >=${MIN_NODE_VERSION.major}.${MIN_NODE_VERSION.minor})`);
  const portValue = environment.portFree
    ? `${environment.port} available`
    : chalk.yellow(`${environment.port} in use`);
  const rows = [
    { label: muted('System'), value: environment.system },
    { label: muted('Device'), value: environment.device },
    { label: muted('IP address'), value: environment.ipAddress ?? muted('unavailable') },
    { label: muted('Node.js'), value: nodeValue },
    { label: muted('Git'), value: environment.git ?? muted('not found') },
    { label: muted('Port'), value: portValue },
    {
      label: muted('Openpack'),
      value: hasUpdate
        ? `v${CLI_VERSION} ${chalk.yellow(`(update available: ${environment.latestVersion})`)}`
        : `v${CLI_VERSION}`
    }
  ];
  console.log(renderCard('Environment', rows));
  console.log();
};

const printBanner = async () => {
  console.log();
  for (const [index, line] of BANNER_LINES.entries()) {
    console.log(`  ${chalk.hex(GRADIENT[index % GRADIENT.length])(line)}`);
    await pause(BANNER_DELAY_MS);
  }
  console.log();
  console.log(`  ${chalk.bold('Openpack')} ${muted('Fast starter for Node.js, Express, and PostgreSQL')}`);
  console.log();
};

const printHelp = () => {
  const width = Math.max(...HELP_OPTIONS.map(([flag]) => flag.length));
  console.log();
  console.log(`  ${chalk.bold('Openpack')} ${muted(`v${CLI_VERSION}`)}`);
  console.log();
  console.log(`  ${muted('Usage')}`);
  console.log(`  ${PACKAGE_COMMAND} ${accent('[project-name] [options]')}`);
  console.log();
  console.log(`  ${muted('Options')}`);
  HELP_OPTIONS.forEach(([flag, description]) => {
    console.log(`  ${accent(flag.padEnd(width))}  ${description}`);
  });
  console.log();
  console.log(`  ${muted('Example')}`);
  console.log(`  ${PACKAGE_COMMAND} ${accent('my-project --yes --pm pnpm --no-run')}`);
  console.log();
};

const printFailure = (title, detail) => {
  console.log();
  console.log(`  ${chalk.red('●')} ${chalk.bold(title)}`);
  if (detail) console.log(`    ${muted(detail)}`);
  console.log();
  process.exitCode = 1;
};

const runCommand = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawnTool(command, args, { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    const errors = [];
    child.stderr.on('data', (chunk) => errors.push(chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const tail = errors.join('').trim().split('\n').slice(-5).join('\n');
      reject(new Error(tail || `${command} exited with code ${code}`));
    });
  });

const runInteractive = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawnTool(command, args, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', () => resolve());
  });

const setEnvValue = (content, key, value) => {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, () => `${key}=${value}`);
  const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${separator}${key}=${value}\n`;
};

const createRollback = (targetDirectory, originalCwd, enabled) => {
  let armed = enabled;
  return {
    disarm: () => {
      armed = false;
    },
    run: async () => {
      if (!armed) return false;
      armed = false;
      process.chdir(originalCwd);
      try {
        await fse.remove(targetDirectory);
        return true;
      } catch {
        return false;
      }
    }
  };
};

const resolveManagerChoices = (environment) => {
  const detected = Object.keys(environment.managers);
  const names = detected.length ? detected : ['npm'];
  const launcherName = environment.launcher?.name;
  return { names, initial: names.includes(launcherName) ? launcherName : names[0] };
};

const needsPortChoice = async (port, mode) => mode === MODES.run && !(await isPortFree(port));

const askOptions = async (cli, environment) => {
  const fixed = readFixedOptions(cli);
  const managers = resolveManagerChoices(environment);

  const answers = await prompts.group(
    {
      name: () =>
        fixed.name !== undefined
          ? Promise.resolve(fixed.name)
          : prompts.text({
              message: 'What is your project name?',
              placeholder: 'my-project',
              validate: validateProjectName
            }),
      packageManager: () => {
        if (fixed.packageManager !== undefined) return Promise.resolve(fixed.packageManager);
        if (managers.names.length === 1) return Promise.resolve(managers.names[0]);
        return prompts.select({
          message: 'Choose a package manager',
          initialValue: managers.initial,
          options: managers.names.map((value) => ({
            value,
            label: PACKAGE_MANAGERS[value].label,
            hint: environment.managers[value] ? `v${environment.managers[value]}` : undefined
          }))
        });
      },
      mode: () =>
        fixed.mode !== undefined
          ? Promise.resolve(fixed.mode)
          : prompts.select({
              message: 'Once the template is ready',
              initialValue: MODES.run,
              options: [
                { value: MODES.run, label: 'Install dependencies and start the server', hint: 'recommended' },
                { value: MODES.install, label: 'Install dependencies only' },
                { value: MODES.none, label: 'Create the project only' }
              ]
            }),
      port: async ({ results }) => {
        const desired = fixed.port ?? DEFAULT_PORT;
        if (!(await needsPortChoice(desired, results.mode))) return desired;
        return prompts.text({
          message: `Port ${desired} is in use. Choose another port`,
          initialValue: String(await findFreePort(desired + 1)),
          validate: validatePort
        });
      }
    },
    {
      onCancel: () => {
        prompts.cancel('Cancelled');
        process.exit(0);
      }
    }
  );

  return { ...answers, port: Number(answers.port) };
};

const resolveDefaultOptions = async (cli, environment) => {
  const fixed = readFixedOptions(cli);
  if (fixed.name === undefined) throw new UsageError('Project name is required in non-interactive mode');

  const mode = fixed.mode ?? (process.stdout.isTTY ? MODES.run : MODES.install);
  const desired = fixed.port ?? DEFAULT_PORT;
  let port = desired;

  if (await needsPortChoice(desired, mode)) {
    if (fixed.port !== undefined) throw new UsageError(`Port ${desired} is already in use`);
    port = await findFreePort(desired + 1);
  }

  return {
    name: fixed.name,
    packageManager: fixed.packageManager ?? resolveManagerChoices(environment).initial,
    mode,
    port
  };
};

const buildSteps = ({ name, packageManager, mode, port }) => {
  const targetDirectory = path.resolve(process.cwd(), name);
  const manager = PACKAGE_MANAGERS[packageManager];
  const steps = [
    {
      active: 'Fetching template',
      done: 'Template fetched',
      task: async () => {
        const { downloadTemplate } = await import('giget');
        await downloadTemplate(TEMPLATE_SOURCE, { dir: targetDirectory });
      }
    },
    {
      active: 'Configuring environment',
      done: 'Environment configured',
      task: async () => {
        const source = path.join(targetDirectory, ENV_EXAMPLE_FILE);
        if (!(await fse.pathExists(source))) throw new Error(`${ENV_EXAMPLE_FILE} not found in the template`);
        const withSecret = setEnvValue(
          await fse.readFile(source, 'utf8'),
          'SESSION_SECRET',
          randomBytes(32).toString('hex')
        );
        const content = port === DEFAULT_PORT ? withSecret : setEnvValue(withSecret, 'PORT', String(port));
        await fse.writeFile(path.join(targetDirectory, ENV_FILE), content);
        process.chdir(targetDirectory);
      }
    }
  ];

  if (mode !== MODES.none) {
    steps.push({
      active: `Installing dependencies with ${manager.label}`,
      done: 'Dependencies installed',
      task: () => runCommand(packageManager, manager.install, targetDirectory),
      minDuration: 0
    });
  }

  return { steps, targetDirectory, manager };
};

const runSteps = async (steps) => {
  for (const step of steps) {
    console.log(BAR);
    const spinner = ora({ text: ` ${step.active}`, spinner: SPINNER, color: 'magenta' }).start();
    activity.spinner = spinner;
    const startedAt = Date.now();
    try {
      await step.task();
      const remaining = (step.minDuration ?? STEP_MIN_DURATION_MS) - (Date.now() - startedAt);
      if (remaining > 0) await pause(remaining);
      spinner.stopAndPersist({ symbol: chalk.green('◇'), text: ` ${step.done}` });
    } catch (error) {
      spinner.stopAndPersist({ symbol: chalk.red('■'), text: ` ${step.active} ${chalk.red('failed')}` });
      throw error;
    } finally {
      activity.spinner = null;
    }
  }
};

const printSummary = ({ name, packageManager, mode, port, startedAt }) => {
  const duration = ((performance.now() - startedAt) / 1000).toFixed(1);
  const devUrl = `http://localhost:${port}`;
  const devCommand = [packageManager, ...PACKAGE_MANAGERS[packageManager].dev].join(' ');
  const pending = [`cd ${name}`];
  if (mode === MODES.none) pending.push(`${packageManager} install`);
  if (mode !== MODES.run) pending.push(devCommand);

  console.log(BAR);
  console.log(`${chalk.green('◇')}  ${chalk.bold(name)} is ready ${muted(`in ${duration}s`)}`);
  if (mode === MODES.run) {
    console.log(`${BAR}  ${muted('Server')}  ${accent(devUrl)}`);
    console.log(`${BAR}  ${muted('Health')}  ${accent(`${devUrl}/api/health`)}`);
    console.log(`${END}  ${muted('Press Ctrl+C to stop')}`);
    console.log();
    return;
  }
  pending.forEach((step) => console.log(`${BAR}  ${accent(step)}`));
  console.log(`${END}  ${muted('Health')}  ${accent(`${devUrl}/api/health`)}`);
  console.log();
};

const parseCli = () => {
  try {
    return parseArgs({ args: process.argv.slice(2), options: CLI_OPTIONS, allowPositionals: true });
  } catch (error) {
    throw new UsageError(error.message);
  }
};

async function main() {
  const cli = parseCli();

  if (cli.values.help) return printHelp();
  if (cli.values.version) return console.log(CLI_VERSION);

  await printBanner();

  const flagError = validateFlags(cli);
  if (flagError) throw new UsageError(flagError);

  const inspector = ora({ text: 'Inspecting your environment', indent: 2, spinner: SPINNER, color: 'magenta' }).start();
  const environment = await detectEnvironment({
    port: cli.values.port === undefined ? DEFAULT_PORT : Number(cli.values.port),
    checkUpdate: !cli.values['no-update-check']
  });
  await pause(STEP_MIN_DURATION_MS);
  inspector.stop();
  printEnvironmentCard(environment);

  if (!environment.nodeSupported) {
    throw new UsageError(
      `Openpack requires Node.js >=${MIN_NODE_VERSION.major}.${MIN_NODE_VERSION.minor}, found v${environment.node}`
    );
  }

  if (cli.values.pm && !environment.managers[cli.values.pm]) {
    throw new UsageError(`${cli.values.pm} is not installed`);
  }

  const interactive = isTTY && !cli.values.yes;
  if (!interactive) console.log(`  ${muted('Non-interactive mode')}`);

  const options = interactive ? await askOptions(cli, environment) : await resolveDefaultOptions(cli, environment);
  const originalCwd = process.cwd();
  const { steps, targetDirectory, manager } = buildSteps(options);
  const rollback = createRollback(targetDirectory, originalCwd, !(await fse.pathExists(targetDirectory)));
  const startedAt = performance.now();

  const handleInterrupt = async () => {
    activity.spinner?.stop();
    const removed = await rollback.run();
    console.log(`${chalk.yellow('■')}  Interrupted${removed ? ', partial project removed' : ''}`);
    console.log();
    process.exit(EXIT_INTERRUPTED);
  };

  process.once('SIGINT', handleInterrupt);

  try {
    await runSteps(steps);
    rollback.disarm();
  } catch (error) {
    const removed = await rollback.run();
    if (removed) console.log(`${BAR}  ${muted('Partial project removed')}`);
    const alreadyExists = /already exists/i.test(error.message);
    printFailure(
      alreadyExists ? 'Directory already exists' : 'Failed to create project',
      alreadyExists ? `Choose another name or remove ${targetDirectory}` : error.message
    );
    return;
  } finally {
    process.removeListener('SIGINT', handleInterrupt);
  }

  printSummary({ ...options, startedAt });

  if (options.mode === MODES.run) {
    await runInteractive(options.packageManager, manager.dev, targetDirectory);
  }
}

main().catch((error) => {
  if (error instanceof UsageError) {
    printFailure('Invalid usage', error.message);
    console.log(`  ${muted('Run with --help to see all options')}\n`);
    return;
  }
  printFailure('Unexpected error', error.message);
});