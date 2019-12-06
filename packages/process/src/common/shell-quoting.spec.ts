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

import { expect } from 'chai';

import { escapeForShell, BashQuotingFunctions, ShellQuoting, CmdQuotingFunctions, PowershellQuotingFunctions } from './shell-quoting';

describe('Shell arguments escaping:', () => {

    // Procedurally execute tests from this list of data.
    const testData = {
        // https://www.gnu.org/software/bash/manual/html_node/Quoting.html
        bash: {
            quotingFunctions: BashQuotingFunctions,
            data: {
                [ShellQuoting.Escape]: [
                    { input: 'abc', expected: 'abc' },
                    { input: 'ab c', expected: 'ab\\ c' },
                    { input: 'ab"c', expected: 'ab\\"c' },
                    { input: 'ab\'c', expected: 'ab\\\'c' },
                    { input: 'ab\\ c\\', expected: 'ab\\\\\\ c\\\\' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: 'setTimeout\\(\\(\\)\\ =\\>\\ \\{\\ console.log\\(1,\\ \\"2\\\'3\\"\\)\\;\\ \\},\\ 100\\)',
                    },
                ],
                [ShellQuoting.Strong]: [
                    { input: 'abc', expected: '\'abc\'' },
                    { input: 'ab c', expected: '\'ab c\'' },
                    { input: 'ab"c', expected: '\'ab"c\'' },
                    { input: 'ab\'c', expected: '\'ab\'"\'"\'c\'' },
                    { input: 'ab\\ c\\', expected: '\'ab\\ c\\\'' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: '\'setTimeout(() => { console.log(1, "2\'"\'"\'3"); }, 100)\'',
                    },
                ],
                [ShellQuoting.Weak]: [
                    { input: 'abc', expected: '"abc"' },
                    { input: 'ab c', expected: '"ab c"' },
                    { input: 'ab"c', expected: '"ab\\"c"' },
                    { input: 'ab\'c', expected: '"ab\'c"' },
                    { input: 'ab\\ c\\', expected: '"ab\\ c\\\\"' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: '"setTimeout(() => { console.log(1, \\"2\'3\\"); }, 100)"',
                    },
                ]
            },
        },
        // ???
        cmd: {
            quotingFunctions: CmdQuotingFunctions,
            data: {
                [ShellQuoting.Escape]: [
                    { input: 'abc', expected: 'abc' },
                    { input: 'ab c', expected: 'ab^ c' },
                    { input: 'ab"c', expected: 'ab^"c' },
                    { input: 'ab\'c', expected: 'ab\'c' },
                    { input: 'ab^ c^', expected: 'ab^^^ c^^' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: 'setTimeout^(^(^)^ =^>^ {^ console.log^(1,^ ^"2\'3^"^)^;^ },^ 100^)',
                    },
                ],
                // cmd.exe doesn't allow to strongly quote...
                // [ShellQuoting.Strong]: [
                // ],
                [ShellQuoting.Weak]: [
                    { input: 'abc', expected: '"abc"' },
                    { input: 'ab c', expected: '"ab c"' },
                    { input: 'ab"c', expected: '"ab^"c"' },
                    { input: 'ab\'c', expected: '"ab\'c"' },
                    { input: 'ab^ c^', expected: '"ab^ c^^"' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: '"setTimeout(() => { console.log(1, ^"2\'3^"); }, 100)"',
                    },
                ]
            },
        },
        // https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules?view=powershell-6
        powershell: {
            quotingFunctions: PowershellQuotingFunctions,
            data: {
                [ShellQuoting.Escape]: [
                    { input: 'abc', expected: 'abc' },
                    { input: 'ab c', expected: 'ab` c' },
                    { input: 'ab"c', expected: 'ab`"c' },
                    { input: 'ab\'c', expected: 'ab`\'c' },
                    { input: 'ab` c`', expected: 'ab``` c``' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: 'setTimeout`(`(`)` =`>` `{` console.log`(1,` `"2`\'3`"`)`;` `},` 100`)',
                    },
                ],
                [ShellQuoting.Strong]: [
                    { input: 'abc', expected: '\'abc\'' },
                    { input: 'ab c', expected: '\'ab c\'' },
                    { input: 'ab"c', expected: '\'ab"c\'' },
                    { input: 'ab\'c', expected: '\'ab\'\'c\'' },
                    { input: 'ab` c`', expected: '\'ab` c`\'' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: '\'setTimeout(() => { console.log(1, "2\'\'3"); }, 100)\'',
                    },
                ],
                [ShellQuoting.Weak]: [
                    { input: 'abc', expected: '"abc"' },
                    { input: 'ab c', expected: '"ab c"' },
                    { input: 'ab"c', expected: '"ab`"c"' },
                    { input: 'ab\'c', expected: '"ab\'c"' },
                    { input: 'ab` c`', expected: '"ab` c``"' },
                    {
                        input: 'setTimeout(() => { console.log(1, "2\'3"); }, 100)',
                        expected: '"setTimeout(() => { console.log(1, `"2\'3`"); }, 100)"',
                    },
                ]
            },
        }
    } as const;

    // iter through each runtime (bash/cmd/powershell)
    for (const runtime of Object.keys(testData)) {
        const testInfo = testData[runtime as keyof typeof testData];

        // get all quoting types (escape/strong/weak)
        for (const quotingType of Object.keys(testInfo.data)) {
            const testInput = testInfo.data[quotingType as keyof typeof testInfo['data']];

            // run the test for each input
            it(`${runtime}/${quotingType}`, () => {
                for (const test of testInput) {
                    expect(escapeForShell({
                        quoting: quotingType as ShellQuoting,
                        value: test.input,
                    }, testInfo.quotingFunctions)).equal(test.expected);
                }
            });
        }
    }

});
