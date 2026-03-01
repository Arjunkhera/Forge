#!/usr/bin/env node
import { Command } from 'commander';
import { ForgeCore, loadGlobalConfig, saveGlobalConfig, addGlobalRegistry, removeGlobalRegistry, GLOBAL_CONFIG_PATH } from '@forge/core';
import { RegistryConfigSchema } from '@forge/core';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();

program
  .name('forge')
  .description('Package manager and compiler for AI agent workspaces')
  .version('0.1.0')
  .option('--config <path>', 'Path to forge.yaml', process.cwd());

// forge init <name>
program
  .command('init <name>')
  .description('Initialize a new Forge workspace')
  .action(async (name: string, options: any) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      await forge.init(name);
      console.log(chalk.green(`✓ Initialized workspace '${name}'`));
      console.log(`  Created forge.yaml and forge.lock`);
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      if (err.suggestion) console.error(chalk.gray(`  Hint: ${err.suggestion}`));
      process.exit(1);
    }
  });

// forge add <refs...>
program
  .command('add <refs...>')
  .description('Add one or more artifacts to forge.yaml (e.g., skill:developer@1.0.0)')
  .action(async (refs: string[]) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const config = await forge.add(refs);
      console.log(chalk.green(`✓ Added ${refs.join(', ')}`));
      const skillCount = Object.keys(config.artifacts.skills).length;
      const agentCount = Object.keys(config.artifacts.agents).length;
      console.log(`  Skills: ${skillCount}, Agents: ${agentCount}`);
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      if (err.suggestion) console.error(chalk.gray(`  Hint: ${err.suggestion}`));
      process.exit(1);
    }
  });

// forge install [--target <target>]
program
  .command('install')
  .description('Install all artifacts from forge.yaml into the workspace')
  .option('-t, --target <target>', 'Compile target (claude-code|cursor|plugin)', 'claude-code')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--conflict <strategy>', 'Conflict strategy (overwrite|skip|backup)', 'backup')
  .action(async (options: { target: string; dryRun: boolean; conflict: string }) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const report = await forge.install({
        target: options.target as any,
        dryRun: options.dryRun,
        conflictStrategy: options.conflict as any,
      });
      if (options.dryRun) {
        console.log(chalk.yellow('Dry run — no files written'));
      } else {
        console.log(chalk.green(`✓ Installed ${report.installed.length} artifact(s) in ${report.duration}ms`));
      }
      console.log(`  Files: ${report.filesWritten.length} written, ${report.conflicts.length} conflicts`);
      for (const f of report.filesWritten) {
        console.log(chalk.gray(`    + ${f}`));
      }
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      if (err.suggestion) console.error(chalk.gray(`  Hint: ${err.suggestion}`));
      process.exit(1);
    }
  });

// forge search <query> [--type <type>]
program
  .command('search <query>')
  .description('Search the registry for artifacts')
  .option('-t, --type <type>', 'Filter by type (skill|agent|plugin|workspace-config)')
  .action(async (query: string, options: { type?: string }) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const results = await forge.search(query, options.type as any);
      if (results.length === 0) {
        console.log(chalk.yellow(`No results for '${query}'`));
        return;
      }
      const table = new Table({
        head: [chalk.bold('Type'), chalk.bold('ID'), chalk.bold('Version'), chalk.bold('Description')],
        colWidths: [20, 20, 10, 50],
      });
      for (const r of results) {
        table.push([r.ref.type, r.ref.id, r.ref.version, r.meta.description.slice(0, 47) + (r.meta.description.length > 47 ? '...' : '')]);
      }
      console.log(table.toString());
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// forge list [--installed | --available]
program
  .command('list')
  .description('List artifacts')
  .option('--installed', 'Show only installed artifacts')
  .option('--available', 'Show available artifacts in registry')
  .option('-t, --type <type>', 'Filter by type (skill|agent|plugin|workspace-config)')
  .action(async (options: { installed?: boolean; available?: boolean; type?: string }) => {
    const forge = new ForgeCore(program.opts().config);
    const scope = options.installed ? 'installed' : 'available';
    try {
      const summaries = await forge.list(scope, options.type as any);
      if (summaries.length === 0) {
        console.log(chalk.yellow(`No ${scope} artifacts found`));
        return;
      }
      const table = new Table({
        head: [chalk.bold('Type'), chalk.bold('ID'), chalk.bold('Version'), chalk.bold('Name')],
        colWidths: [20, 25, 10, 35],
      });
      for (const s of summaries) {
        table.push([s.ref.type, s.ref.id, s.ref.version, s.name]);
      }
      console.log(table.toString());
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// forge show <ref>
program
  .command('show <ref>')
  .description('Show detailed info about an artifact (e.g., skill:developer)')
  .action(async (refStr: string) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const resolved = await forge.resolve(refStr);
      const { meta } = resolved.bundle;
      console.log(chalk.bold(`\n${meta.name}`));
      console.log(`  ID:          ${meta.id}`);
      console.log(`  Type:        ${meta.type}`);
      console.log(`  Version:     ${meta.version}`);
      console.log(`  Description: ${meta.description}`);
      if (meta.tags.length > 0) {
        console.log(`  Tags:        ${meta.tags.join(', ')}`);
      }

      // Show workspace-config specific fields
      if (meta.type === 'workspace-config') {
        if (Object.keys(meta.mcp_servers).length > 0) {
          const serverList = Object.entries(meta.mcp_servers)
            .map(([name, config]) => `${name}${config.required ? ' (required)' : ' (optional)'}`)
            .join(', ');
          console.log(`  MCP Servers: ${serverList}`);
        }
        if (meta.plugins.length > 0) {
          console.log(`  Plugins:     ${meta.plugins.join(', ')}`);
        }
        if (meta.skills.length > 0) {
          console.log(`  Skills:      ${meta.skills.join(', ')}`);
        }
        if (Object.keys(meta.git_workflow).length > 0) {
          const gwc = meta.git_workflow;
          console.log(`  Git Workflow: branch=${gwc.branch_pattern}, base=${gwc.base_branch}, format=${gwc.commit_format}`);
        }
      }

      if (resolved.dependencies.length > 0) {
        console.log(`  Deps:        ${resolved.dependencies.map(d => d.ref.id).join(', ')}`);
      }
      console.log();
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      if (err.suggestion) console.error(chalk.gray(`  Hint: ${err.suggestion}`));
      process.exit(1);
    }
  });

// forge remove <refs...>
program
  .command('remove <refs...>')
  .description('Remove artifacts from forge.yaml')
  .action(async (refs: string[]) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      await forge.remove(refs);
      console.log(chalk.green(`✓ Removed ${refs.join(', ')}`));
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// forge repo — repository index management
const repo = program.command('repo').description('Manage the local git repository index');

repo
  .command('scan')
  .description('Scan configured directories for git repositories')
  .action(async () => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const index = await forge.repoScan();
      console.log(chalk.green(`✓ Scanned ${index.scanPaths.length} path(s), found ${index.repos.length} repositories`));
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      if (err.suggestion) console.error(chalk.gray(`  Hint: ${err.suggestion}`));
      process.exit(1);
    }
  });

repo
  .command('list')
  .description('List all indexed repositories')
  .option('-q, --query <query>', 'filter by name or URL')
  .option('-l, --language <lang>', 'filter by language')
  .action(async (options: { query?: string; language?: string }) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      let repos = await forge.repoList(options.query);
      if (options.language) {
        repos = repos.filter(r => r.language?.toLowerCase() === options.language!.toLowerCase());
      }
      if (repos.length === 0) {
        console.log('No repositories found. Run: forge repo scan');
        return;
      }
      const table = new Table({
        head: [chalk.bold('Name'), chalk.bold('Path'), chalk.bold('Language'), chalk.bold('Last Commit')],
        colWidths: [25, 35, 15, 15],
      });
      for (const r of repos) {
        table.push([r.name, r.localPath, r.language ?? '—', r.lastCommitDate.slice(0, 10)]);
      }
      console.log(table.toString());
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

repo
  .command('show <name>')
  .description('Show details for a single repository')
  .action(async (name: string) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const entry = await forge.repoResolve({ name });
      if (!entry) {
        console.error(`Repository '${name}' not found. Run: forge repo scan`);
        process.exit(1);
      }
      console.log(`Name:         ${entry.name}`);
      console.log(`Path:         ${entry.localPath}`);
      console.log(`Remote:       ${entry.remoteUrl ?? '(none)'}`);
      console.log(`Branch:       ${entry.defaultBranch}`);
      console.log(`Language:     ${entry.language ?? '—'}`);
      console.log(`Framework:    ${entry.framework ?? '—'}`);
      console.log(`Last Commit:  ${entry.lastCommitDate}`);
      console.log(`Last Scanned: ${entry.lastScannedAt}`);
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

repo
  .command('find <query>')
  .description('Search for repositories by name or URL')
  .action(async (query: string) => {
    const forge = new ForgeCore(program.opts().config);
    try {
      const results = await forge.repoList(query);
      if (results.length === 0) {
        console.log('No matches found.');
        return;
      }
      for (const r of results) {
        console.log(`${r.name.padEnd(30)} ${r.localPath}`);
      }
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// forge serve — starts MCP server
program
  .command('serve')
  .description('Start the Forge MCP server')
  .action(async () => {
    try {
      // Dynamically import mcp-server to avoid hard dep if not installed
      const { startMcpServer } = await import('@forge/mcp-server');
      const workspaceRoot = program.opts().config;
      await startMcpServer(workspaceRoot);
    } catch (err: any) {
      console.error(chalk.red(`✗ Could not start MCP server: ${err.message}`));
      console.error(chalk.gray(`  Ensure @forge/mcp-server is installed`));
      process.exit(1);
    }
  });

// forge config — global config management
const configCmd = program
  .command('config')
  .description('Manage global Forge configuration (~/.forge/config.yaml)');

// forge config add-registry
configCmd
  .command('add-registry')
  .description('Add a registry to the global config')
  .requiredOption('-n, --name <name>', 'Registry name')
  .requiredOption('-t, --type <type>', 'Registry type (filesystem|git)')
  .option('-u, --url <url>', 'Git clone URL (required for git type)')
  .option('-p, --path <path>', 'Path or registry subdirectory', 'registry')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .action(async (options: { name: string; type: string; url?: string; path: string; branch: string }) => {
    try {
      let registryConfig: any;
      if (options.type === 'filesystem') {
        registryConfig = { type: 'filesystem', name: options.name, path: options.path };
      } else if (options.type === 'git') {
        if (!options.url) {
          console.error(chalk.red('✗ --url is required for git registries'));
          process.exit(1);
        }
        registryConfig = { type: 'git', name: options.name, url: options.url, branch: options.branch, path: options.path };
      } else {
        console.error(chalk.red(`✗ Unsupported registry type: ${options.type}`));
        process.exit(1);
      }

      const parsed = RegistryConfigSchema.parse(registryConfig);
      const config = await addGlobalRegistry(parsed);
      console.log(chalk.green(`✓ Added registry '${options.name}' to global config`));
      console.log(chalk.gray(`  ${GLOBAL_CONFIG_PATH}`));
      console.log(chalk.gray(`  Total registries: ${config.registries.length}`));
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// forge config remove-registry <name>
configCmd
  .command('remove-registry <name>')
  .description('Remove a registry from the global config')
  .action(async (name: string) => {
    try {
      const config = await removeGlobalRegistry(name);
      console.log(chalk.green(`✓ Removed registry '${name}' from global config`));
      console.log(chalk.gray(`  Remaining registries: ${config.registries.length}`));
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

// forge config list
configCmd
  .command('list')
  .description('Show the current global config')
  .action(async () => {
    try {
      const config = await loadGlobalConfig();
      if (config.registries.length === 0) {
        console.log(chalk.yellow('No global registries configured'));
        console.log(chalk.gray(`  Config: ${GLOBAL_CONFIG_PATH}`));
        return;
      }
      console.log(chalk.bold('Global registries:'));
      const table = new Table({
        head: [chalk.bold('Name'), chalk.bold('Type'), chalk.bold('Location')],
        colWidths: [20, 12, 50],
      });
      for (const reg of config.registries) {
        const location = reg.type === 'filesystem' ? reg.path
          : reg.type === 'git' ? (reg as any).url
          : (reg as any).url;
        table.push([reg.name, reg.type, location]);
      }
      console.log(table.toString());
      console.log(chalk.gray(`  Config: ${GLOBAL_CONFIG_PATH}`));
    } catch (err: any) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
