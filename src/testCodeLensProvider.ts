import * as vscode from 'vscode';
import * as path from 'path';

/**
 * TypeScript测试文件的CodeLens Provider
 * 为测试函数提供"运行测试"按钮
 */
export class TestCodeLensProvider implements vscode.CodeLensProvider {
    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    /**
     * 匹配测试函数的正则表达式
     * 支持:
     * - export function testXxx
     * - export async function testXxx
     * - 带有 @test 注释的函数
     */
    private readonly testFunctionPattern = /^\s*(?:export\s+)?(?:async\s+)?function\s+(test\w+)\s*\(/;
    private readonly testAnnotationPattern = /^\s*\*\s*@test\s+(.+)$/;

    constructor() {}

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] {
        // 只处理TypeScript测试文件
        if (!this.isTestFile(document)) {
            return [];
        }

        this.codeLenses = [];
        const text = document.getText();
        const lines = text.split('\n');

        let pendingTestAnnotation: { line: number; description: string } | null = null;
        let testFunctions: { name: string; line: number; description?: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检查 @test 注释
            const annotationMatch = line.match(this.testAnnotationPattern);
            if (annotationMatch) {
                pendingTestAnnotation = {
                    line: i,
                    description: annotationMatch[1].trim()
                };
                continue;
            }

            // 检查测试函数定义
            const functionMatch = line.match(this.testFunctionPattern);
            if (functionMatch) {
                const functionName = functionMatch[1];
                const testInfo: { name: string; line: number; description?: string } = {
                    name: functionName,
                    line: i
                };

                // 如果有pending的@test注释，关联到这个函数
                if (pendingTestAnnotation && i - pendingTestAnnotation.line <= 5) {
                    testInfo.description = pendingTestAnnotation.description;
                }
                pendingTestAnnotation = null;

                testFunctions.push(testInfo);
            }
        }

        // 为每个测试函数添加CodeLens
        for (const test of testFunctions) {
            const range = new vscode.Range(test.line, 0, test.line, lines[test.line].length);

            // 运行单个测试按钮
            this.codeLenses.push(
                new vscode.CodeLens(range, {
                    title: '$(play) 运行测试',
                    command: 'tester.runSingleTest',
                    arguments: [document.uri, test.name]
                })
            );

            // 调试单个测试按钮
            this.codeLenses.push(
                new vscode.CodeLens(range, {
                    title: '$(debug) 调试',
                    command: 'tester.debugSingleTest',
                    arguments: [document.uri, test.name]
                })
            );

            // 如果有描述，显示描述
            if (test.description) {
                this.codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `$(info) ${test.description}`,
                        command: ''
                    })
                );
            }
        }

        // 如果文件中有测试函数，在文件顶部添加"运行全部测试"
        if (testFunctions.length > 0) {
            const topRange = new vscode.Range(0, 0, 0, lines[0].length);
            this.codeLenses.unshift(
                new vscode.CodeLens(topRange, {
                    title: `$(run-all) 运行全部测试 (${testFunctions.length}个)`,
                    command: 'tester.runAllFileTests',
                    arguments: [document.uri]
                })
            );
        }

        return this.codeLenses;
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * 判断是否为测试文件
     */
    private isTestFile(document: vscode.TextDocument): boolean {
        const fileName = path.basename(document.fileName);
        const isTypeScript = document.languageId === 'typescript' || document.languageId === 'typescriptreact';
        const isTestFile = fileName.endsWith('.test.ts') ||
                          fileName.endsWith('.spec.ts') ||
                          fileName.includes('test');
        return isTypeScript && isTestFile;
    }
}

/**
 * 注册测试相关命令
 */
export function registerTestCommands(context: vscode.ExtensionContext): void {
    // 运行单个测试
    context.subscriptions.push(
        vscode.commands.registerCommand('tester.runSingleTest', async (uri: vscode.Uri, testName: string) => {
            const terminal = getOrCreateTestTerminal();
            const relativePath = vscode.workspace.asRelativePath(uri);

            // 使用ts-node运行测试，通过环境变量传递要运行的测试名
            terminal.sendText(`npx ts-node -e "
const test = require('./${relativePath}');
if (typeof test.${testName} === 'function') {
    const result = test.${testName}();
    if (result instanceof Promise) {
        result.then(() => console.log('测试完成')).catch(console.error);
    }
} else {
    console.error('未找到测试函数: ${testName}');
}
"`);
            terminal.show();
        })
    );

    // 调试单个测试
    context.subscriptions.push(
        vscode.commands.registerCommand('tester.debugSingleTest', async (uri: vscode.Uri, testName: string) => {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('无法确定工作区');
                return;
            }

            const relativePath = vscode.workspace.asRelativePath(uri);

            // 启动调试会话
            await vscode.debug.startDebugging(workspaceFolder, {
                type: 'node',
                request: 'launch',
                name: `调试测试: ${testName}`,
                runtimeExecutable: 'npx',
                runtimeArgs: ['ts-node', relativePath],
                env: {
                    TEST_NAME: testName
                },
                console: 'integratedTerminal',
                cwd: workspaceFolder.uri.fsPath
            });
        })
    );

    // 运行文件中的所有测试
    context.subscriptions.push(
        vscode.commands.registerCommand('tester.runAllFileTests', async (uri: vscode.Uri) => {
            const terminal = getOrCreateTestTerminal();
            const relativePath = vscode.workspace.asRelativePath(uri);

            terminal.sendText(`npx ts-node ${relativePath}`);
            terminal.show();
        })
    );

    // 运行波特率配置测试（单元测试）
    context.subscriptions.push(
        vscode.commands.registerCommand('tester.runBaudRateUnitTests', async () => {
            const terminal = getOrCreateTestTerminal();
            terminal.sendText('npx ts-node test/baud-rate-config.test.ts --unit');
            terminal.show();
        })
    );

    // 运行波特率配置测试（设备测试）
    context.subscriptions.push(
        vscode.commands.registerCommand('tester.runBaudRateDeviceTests', async () => {
            const terminal = getOrCreateTestTerminal();
            terminal.sendText('npx ts-node test/baud-rate-config.test.ts --device');
            terminal.show();
        })
    );

    // 运行ZLG CAN测试
    context.subscriptions.push(
        vscode.commands.registerCommand('tester.runZlgCanTests', async () => {
            const terminal = getOrCreateTestTerminal();
            terminal.sendText('npm run test:zlgcan');
            terminal.show();
        })
    );
}

/**
 * 获取或创建测试终端
 */
function getOrCreateTestTerminal(): vscode.Terminal {
    const terminalName = 'Tester 测试';
    let terminal = vscode.window.terminals.find(t => t.name === terminalName);

    if (!terminal) {
        terminal = vscode.window.createTerminal(terminalName);
    }

    return terminal;
}
