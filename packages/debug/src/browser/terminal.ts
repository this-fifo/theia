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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createShellCommandLine, BashQuotingFunctions, PowershellQuotingFunctions, CmdQuotingFunctions, ShellQuoting, ShellQuotedString } from '@theia/process/lib/common/shell-quoting';
import { TerminalProcessInfo } from '@theia/terminal/lib/common/base-terminal-protocol';

/**
 * Constructs a command line to run in a shell. The shell could be
 * re-used/long-lived, this means we cannot spawn a new process with a nice
 * and fresh environment, we need to encode environment modifications into
 * the returned command.
 *
 * Inspired by VS Code implementation, see:
 * https://github.com/microsoft/vscode/blob/f395cac4fff0721a8099126172c01411812bcb4a/src/vs/workbench/contrib/debug/node/terminals.ts#L79
 *
 * @param processInfo
 * @param options
 */
export function prepareCommandLine(processInfo: TerminalProcessInfo | undefined, options: {
    cwd: string, args: string[], env?: {
        [key: string]: string | null
    }
}): string {

    const executable = processInfo && processInfo.executable;
    const { cwd, args, env } = options;

    if (executable) {
        const args2 = args.map(value => ({
            value, quoting: ShellQuoting.Strong,
        } as ShellQuotedString));

        // tslint:disable-next-line:no-any
        const entries = function* <T extends object>(object: T): IterableIterator<[string, any]> {
            for (const key of Object.keys(object)) {
                // tslint:disable-next-line:no-any
                yield [key, (object as any)[key]];
            }
        };

        let command = '';

        if (/bash(.exe)?$/.test(executable)) {
            if (cwd) {
                command += `cd ${BashQuotingFunctions.strong(cwd)} && `;
            }
            if (env) {
                command += 'env';
                for (const [key, value] of entries(env)) {
                    if (value === null) {
                        command += ` -u ${BashQuotingFunctions.strong(key)}`;
                    } else {
                        command += ` ${BashQuotingFunctions.strong(`${key}=${value}`)}`;
                    }
                }
                command += ' ';
            }
            command += createShellCommandLine(args2, BashQuotingFunctions);
            return command;

        } else if (/(ps|pwsh|powershell)(.exe)?$/i.test(executable)) {
            if (cwd) {
                command += `cd ${PowershellQuotingFunctions.strong(cwd)}; `;
            }
            if (env) {
                for (const [key, value] of entries(env)) {
                    if (value === null) {
                        command += `Remove-Item \${env:${PowershellQuotingFunctions.escape(key)}}; `;
                    } else {
                        command += `\${env:${PowershellQuotingFunctions.escape(key)}}=${PowershellQuotingFunctions.strong(value)}; `;
                    }
                }
            }
            command += '& ' + createShellCommandLine(args2, PowershellQuotingFunctions);
            return command;

        } else if (/cmd(.exe)?$/i.test(executable)) {
            if (cwd) {
                command += `cd ${CmdQuotingFunctions.strong(cwd)}`;
            }
            if (env) {
                command += 'cmd /C "';
                for (const [key, value] of entries(env)) {
                    if (value === null) {
                        command += `set ${key}="" && `;
                    } else {
                        command += `set "${key}=${CmdQuotingFunctions.escape(value)}" && `;
                    }
                }
            }
            command += createShellCommandLine(args2, CmdQuotingFunctions);
            if (env) {
                command += '"';
            }
            return command;
        }
    }
    // If we cannot detect which shell is being used, don't escape.
    console.warn(`Unknown shell, could not escape arguments: ${executable || 'undefined'}`);
    return args.join(' ');
}
