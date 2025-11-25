import * as vscode from 'vscode';
import { ExecutionState } from './executor';

export class TesterCodeLensProvider implements vscode.CodeLensProvider {
    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    private executionState: ExecutionState = 'idle';

    constructor() {}

    /**
     * 更新执行状态
     */
    public updateExecutionState(state: ExecutionState): void {
        this.executionState = state;
        this.refresh();
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        this.codeLenses = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 在配置块顶部添加控制按钮
            if (line === 'tset') {
                const range = new vscode.Range(i, 0, i, line.length);

                // 运行全部测试按钮
                this.codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(play) 运行全部测试',
                        command: 'tester.runAllTests',
                        arguments: [document.uri]
                    })
                );

                // 根据执行状态显示不同的控制按钮
                if (this.executionState === 'running') {
                    this.codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(debug-pause) 暂停',
                            command: 'tester.pauseExecution',
                            arguments: []
                        })
                    );
                    this.codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(debug-stop) 停止',
                            command: 'tester.stopExecution',
                            arguments: []
                        })
                    );
                } else if (this.executionState === 'paused') {
                    this.codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(debug-continue) 继续',
                            command: 'tester.resumeExecution',
                            arguments: []
                        })
                    );
                    this.codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(debug-stop) 停止',
                            command: 'tester.stopExecution',
                            arguments: []
                        })
                    );
                }
            }

            // 在测试用例集顶部添加"运行测试用例集"
            const ttitleMatch = line.match(/\bttitle\b\s*=\s*(.*)$/);
            if (ttitleMatch) {
                const suiteName = ttitleMatch[1].trim();
                const range = new vscode.Range(i, 0, i, line.length);
                this.codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(play) 运行此用例集',
                        command: 'tester.runTestSuiteByLine',
                        arguments: [document.uri, i, suiteName]
                    })
                );
            }

            // 在测试用例顶部添加"运行测试用例"
            if (line.match(/^(?:\d+\s+)?\btstart\b/)) {
                const match = line.match(/tstart(.+)$/);
                if (match) {
                    const caseName = match[1].trim();
                    const range = new vscode.Range(i, 0, i, line.length);
                    this.codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(play) 运行此用例',
                            command: 'tester.runTestCaseByLine',
                            arguments: [document.uri, i, caseName]
                        })
                    );
                }
            }
        }

        return this.codeLenses;
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }
}
