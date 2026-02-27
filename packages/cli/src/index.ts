#!/usr/bin/env node
import { Command } from 'commander';
import { ForgeCore } from '@forge/core';
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
  .option('-t, --type <type>', 'Filter by type (skill|agent|plugin)')
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
        colWidths: [10, 20, 10, 50],
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
  .action(async (options: { installed?: boolean; available?: boolean }) => {
    const forge = new ForgeCore(program.opts().config);
    const scope = options.installed ? 'installed' : 'available';
    try {
      const summaries = await forge.list(scope);
      if (summaries.length === 0) {
        console.log(chalk.yellow(`No ${scope} artifacts found`));
        return;
      }
      const table = new Table({
        head: [chalk.bold('Type'), chalk.bold('ID'), chalk.bold('Version'), chalk.bold('Name')],
        colWidths: [10, 25, 10, 35],
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

program.parse();
