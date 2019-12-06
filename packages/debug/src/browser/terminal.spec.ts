/********************************************************************************
 * Copyright (C) 2019 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

/**
 * This test suite assumes that we run in a NodeJS environment!
 */

import { spawn, execSync, SpawnOptions, ChildProcess } from 'child_process';
// tslint:disable-next-line:no-implicit-dependencies
import { IContextDefinition } from 'mocha';
import { join } from 'path';

import { TerminalProcessInfo } from '@theia/terminal/lib/common/base-terminal-protocol';

import { prepareCommandLine } from './terminal';

const testResources = join(__dirname, '../../src/browser/test-terminal');
const spawnOptions: SpawnOptions = {
    windowsVerbatimArguments: true,
    stdio: ['pipe', 'pipe', 'inherit'],
};

const bashPath = execCommand(process.platform === 'win32'
    ? 'where bash'
    : 'command -v bash');

const cmdPath = process.platform === 'win32'
    && 'cmd.exe'
    || undefined;

const powershellPath = execCommand(process.platform === 'win32'
    ? 'where pwsh'
    : 'command -v pwsh');

describeOrSkip(bashPath)('test bash commands', () => {
    const { shell, processInfo } = createShell(bashPath!);

    it('command with whitespaces', async () => {
        const left = 'ABC';
        const right = 'DEF';
        shell.stdin.write(peek(prepareCommandLine(processInfo, {
            args: ['node', '-e', `{
                    let left = '${left}';
                    let right = '${right}';
                    console.log(\`\${left}|\${right}\`);
                }`],
            cwd: testResources,
        }) + '\n'));
        await scanOutput<void>(shell, handle => {
            if (handle.line.includes(`${left}|${right}`)) {
                handle.resolve();
            }
        });
    });

    // TODO: Fix
    it.only('use problematic environment variables', async () => {
        const envName = 'TEST;PATH';
        const envValue = 'SUCCESS = YES';
        shell.stdin.write(peek(prepareCommandLine(processInfo, {
            args: ['node', '-p', `process.env['${envName}']`],
            cwd: testResources,
            env: {
                [envName]: envValue,
            }
        }) + '\n'));
        await scanOutput<void>(shell, handle => {
            console.log(handle.text);
            if (handle.line.includes(envValue)) {
                handle.resolve();
            }
        });
    });

});

describeOrSkip(cmdPath)('test cmd commands', () => {
    // const { shell, processInfo } = createShell(cmdPath!);
    // shells.push(shell);

    it('...', () => {

    });

});

describeOrSkip(powershellPath)('test powershell commands', () => {
    const { shell, processInfo } = createShell(powershellPath!);

    it('command with whitespaces', async () => {
        const left = 'ABC';
        const right = 'DEF';
        shell.stdin.write(prepareCommandLine(processInfo, {
            args: ['node', '-e', `{
                    let left = '${left}';
                    let right = '${right}';
                    console.log(\`\${left}|\${right}\`);
                }`],
            cwd: testResources,
        }) + '\n');
        await scanOutput<void>(shell, handle => {
            if (handle.line.includes(`${left}|${right}`)) {
                handle.resolve();
            }
        });
    });

    it('use problematic environment variables', async () => {
        const envName = 'A > B | C $PATH';
        const envValue = 'SUCCESS';
        shell.stdin.write(prepareCommandLine(processInfo, {
            args: ['node', '-p', `process.env['${envName}']`],
            cwd: testResources,
            env: {
                [envName]: envValue,
            }
        }) + '\n');
        await scanOutput<void>(shell, handle => {
            console.log(handle.text);
            if (handle.line.includes(envValue)) {
                handle.resolve();
            }
        });
    });

});

// @ts-ignore
function peek<T>(value: T): T {
    console.log(value);
    return value;
}

// tslint:disable-next-line:no-any
function describeOrSkip(condition: any): IContextDefinition {
    return (condition ? describe : describe.skip) as IContextDefinition;
}

function execCommand(command: string): string | undefined {
    try {
        return execSync(command).toString().trim();
    } catch (error) {
        console.error(command, error);
        return undefined;
    }
}

function createShell(shellExecutable: string, shellArguments: string[] = []): { shell: ChildProcess, processInfo: TerminalProcessInfo } {
    return {
        shell: spawn(shellExecutable, shellArguments, spawnOptions),
        processInfo: {
            executable: shellExecutable,
            arguments: [],
        },
    };
}

/**
 * Fire `callback` once per new detected line.
 *
 * @param pty
 * @param callback
 */
async function scanOutput<T>(process: ChildProcess, callback: (handle: {

    /**
     * Finish listening to new events with a return value.
     */
    resolve: (value: T) => void
    /**
     * Finish listening to new events with an error.
     */
    reject: (reason?: Error) => void
    /**
     * Currently parsed line.
     */
    line: string
    /**
     * The whole output buffer, containing all lines.
     */
    text: string

}) => void): Promise<T> {

    return new Promise((resolve, reject) => {
        let resolved = false;
        let line = '';
        let text = '';
        process.stdout.on('data', data => {
            if (resolved) {
                return;
            }
            const split = data.toString().split('\n');
            while (split.length > 1) {
                line += split.shift()! + '\n';
                text += line + '\n';
                callback({
                    resolve: (value: T) => {
                        resolved = true;
                        resolve(value);
                    },
                    reject: (reason?: Error) => {
                        resolved = true;
                        reject(reason);
                    },
                    line,
                    text,
                });
                line = '';
            }
            line += split[1];
        });
    });

}
