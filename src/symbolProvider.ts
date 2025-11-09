import * as vscode from 'vscode';

export class TesterDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let inConfigBlock = false;
        let configSymbol: vscode.DocumentSymbol | null = null;
        let currentSuite: vscode.DocumentSymbol | null = null;
        let currentCase: vscode.DocumentSymbol | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineRange = new vscode.Range(i, 0, i, lines[i].length);

            // 配置块
            if (line === 'tset') {
                inConfigBlock = true;
                configSymbol = new vscode.DocumentSymbol(
                    '配置块',
                    '',
                    vscode.SymbolKind.Module,
                    lineRange,
                    lineRange
                );
                symbols.push(configSymbol);
            } else if (line === 'tend' && inConfigBlock) {
                if (configSymbol) {
                    configSymbol.range = new vscode.Range(
                        configSymbol.range.start,
                        new vscode.Position(i, lines[i].length)
                    );
                }
                inConfigBlock = false;
                configSymbol = null;
            }

            // 通道初始化
            if (inConfigBlock && line.startsWith('tcaninit')) {
                const match = line.match(/tcaninit\s+(\d+),(\d+),(\d+),(\d+)(?:,(\d+))?/);
                if (match && configSymbol) {
                    const detail = match[5] 
                        ? `设备${match[1]}-索引${match[2]}-通道${match[3]} (${match[4]}/${match[5]}kbps)`
                        : `设备${match[1]}-索引${match[2]}-通道${match[3]} (${match[4]}kbps)`;
                    const channelSymbol = new vscode.DocumentSymbol(
                        `项目通道${configSymbol.children.length}`,
                        detail,
                        vscode.SymbolKind.Interface,
                        lineRange,
                        lineRange
                    );
                    configSymbol.children.push(channelSymbol);
                }
            }

            // 诊断配置
            if (inConfigBlock && line.match(/^tdiagnose_/)) {
                if (configSymbol) {
                    const diagSymbol = new vscode.DocumentSymbol(
                        line.split(/\s+/)[0],
                        line.substring(line.indexOf(' ') + 1),
                        vscode.SymbolKind.Property,
                        lineRange,
                        lineRange
                    );
                    configSymbol.children.push(diagSymbol);
                }
            }

            // 测试用例集
            const suiteMatch = line.match(/^ttitle\s*=\s*(.+)$/);
            if (suiteMatch) {
                const suiteName = suiteMatch[1];
                currentSuite = new vscode.DocumentSymbol(
                    suiteName,  // 使用完整名称作为主标题
                    '测试用例集',  // 详细信息
                    vscode.SymbolKind.Class,
                    lineRange,
                    lineRange
                );
                symbols.push(currentSuite);
            } else if (line === 'ttitle-end' && currentSuite) {
                currentSuite.range = new vscode.Range(
                    currentSuite.range.start,
                    new vscode.Position(i, lines[i].length)
                );
                currentSuite = null;
            }

            // 测试用例
            const caseMatch = line.match(/^(?:(\d+)\s+)?tstart\s*=\s*(.+)$/);
            if (caseMatch && currentSuite) {
                const caseNumber = caseMatch[1] || '';
                const caseName = caseMatch[2];
                // 使用完整名称，不缩写
                const displayName = caseNumber ? `${caseNumber}. ${caseName}` : caseName;
                
                currentCase = new vscode.DocumentSymbol(
                    displayName,  // 完整的测试用例名称
                    '',  // 不使用detail，避免VS Code自动省略
                    vscode.SymbolKind.Method,
                    lineRange,
                    lineRange
                );
                currentSuite.children.push(currentCase);
            } else if (line === 'tend' && currentCase) {
                currentCase.range = new vscode.Range(
                    currentCase.range.start,
                    new vscode.Position(i, lines[i].length)
                );
                currentCase = null;
            }

            // 测试命令
            if (currentCase && line.match(/^t(cans|canr|delay)\b/)) {
                const cmdMatch = line.match(/^(\w+)/);
                if (cmdMatch) {
                    const cmdSymbol = new vscode.DocumentSymbol(
                        cmdMatch[1],
                        line.substring(cmdMatch[1].length).trim(),
                        vscode.SymbolKind.Function,
                        lineRange,
                        lineRange
                    );
                    currentCase.children.push(cmdSymbol);
                }
            }
        }

        return symbols;
    }
}
