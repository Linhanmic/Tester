import * as vscode from "vscode";
import { TesterValidator } from "./validator";
import { TesterFoldingRangeProvider } from "./foldingProvider";
import { TesterDocumentSymbolProvider } from "./symbolProvider";
import { TesterHoverProvider } from "./hoverProvider";
import { TesterCodeLensProvider } from "./codeLensProvider";
import { TesterFormattingProvider } from "./formatting";
import { TestCodeLensProvider, registerTestCommands } from "./testCodeLensProvider";

// 全局诊断集合
let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  console.log("Tester 已激活!");

  // 创建诊断集合
  diagnosticCollection = vscode.languages.createDiagnosticCollection("tester");
  context.subscriptions.push(diagnosticCollection);

  // 创建验证器
  const validator = new TesterValidator(diagnosticCollection);

  // 注册折叠范围提供程序
  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      "tester",
      new TesterFoldingRangeProvider()
    )
  );

  // 注册文档符号提供程序（大纲视图）
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      "tester",
      new TesterDocumentSymbolProvider()
    )
  );

  // 注册悬停提示提供程序
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("tester", new TesterHoverProvider())
  );

  // 注册代码透视提供程序
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      "tester",
      new TesterCodeLensProvider()
    )
  );

  // 注册格式化提供程序
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      "tester",
      new TesterFormattingProvider()
    )
  );

  // 注册TypeScript测试文件的代码透视提供程序
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "typescript", pattern: "**/*.test.ts" },
      new TestCodeLensProvider()
    )
  );

  // 注册测试相关命令
  registerTestCommands(context);

  // 注册tester文件的测试命令
  registerTesterCommands(context);

  // ========== 文档事件监听 ==========

  // 文档打开时验证
  vscode.workspace.textDocuments.forEach((doc) => {
    if (doc.languageId === "tester") {
      validator.validateDocument(doc);
    }
  });

  // 文档更改时验证
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "tester") {
        validator.validateDocument(event.document);
      }
    })
  );

  // 文档打开时验证和刷新视图
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === "tester") {
        validator.validateDocument(doc);
      }
    })
  );

  // 文档关闭时清除诊断
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.languageId === "tester") {
        diagnosticCollection.delete(doc.uri);
      }
    })
  );

  vscode.window.showInformationMessage("Tester Language Support 已加载！");
}

/**
 * 解析tester文件中的tcaninit配置
 */
function parseTcanInitFromDocument(text: string): string[] {
  const lines = text.split('\n');
  const tcanInitCommands: string[] = [];
  let inConfigBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'tset') {
      inConfigBlock = true;
      continue;
    }

    if (trimmed === 'tend' && inConfigBlock) {
      inConfigBlock = false;
      continue;
    }

    if (inConfigBlock && trimmed.startsWith('tcaninit')) {
      tcanInitCommands.push(trimmed);
    }
  }

  return tcanInitCommands;
}

/**
 * 生成测试运行脚本
 */
function generateTestScript(tcanInitCommands: string[], testCaseName?: string): string {
  const lines: string[] = [];

  lines.push('// 自动生成的测试脚本');
  lines.push('const { ZlgCanDevice, DeviceType, parseTcanInitCommand, createConfigFromTcanInit, quickInitChannel } = require("./src/zlgcan");');
  lines.push('');
  lines.push('async function runTest() {');
  lines.push('  const device = new ZlgCanDevice();');
  lines.push('');

  // 解析并添加tcaninit配置
  for (const cmd of tcanInitCommands) {
    lines.push(`  // ${cmd}`);
    lines.push(`  const params = parseTcanInitCommand("${cmd}");`);
    lines.push(`  if (params) {`);
    lines.push(`    device.openDevice(params.deviceId, params.deviceIndex, 0);`);
    lines.push(`    const config = createConfigFromTcanInit(params);`);
    lines.push(`    quickInitChannel(device, params.channelIndex, config);`);
    lines.push(`  }`);
    lines.push('');
  }

  lines.push('  console.log("测试配置完成");');
  if (testCaseName) {
    lines.push(`  console.log("运行测试用例: ${testCaseName}");`);
  }
  lines.push('  device.closeDevice();');
  lines.push('}');
  lines.push('');
  lines.push('runTest().catch(console.error);');

  return lines.join('\n');
}

/**
 * 注册tester文件的测试命令
 */
function registerTesterCommands(context: vscode.ExtensionContext): void {
  // 运行全部测试
  context.subscriptions.push(
    vscode.commands.registerCommand('tester.runAllTests', async (uri: vscode.Uri) => {
      const terminal = getOrCreateTesterTerminal();
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();

      // 解析tcaninit配置
      const tcanInitCommands = parseTcanInitFromDocument(text);

      vscode.window.showInformationMessage('开始运行全部测试...');
      terminal.show();

      if (tcanInitCommands.length > 0) {
        terminal.sendText(`# 文件: ${uri.fsPath}`);
        terminal.sendText(`# 检测到 ${tcanInitCommands.length} 个tcaninit配置:`);
        for (const cmd of tcanInitCommands) {
          terminal.sendText(`#   ${cmd}`);
        }
        terminal.sendText('');
      }

      terminal.sendText(`npm run test:zlgcan`);
    })
  );

  // 运行测试用例集
  context.subscriptions.push(
    vscode.commands.registerCommand('tester.runTestSuiteByLine', async (uri: vscode.Uri, line: number, suiteName: string) => {
      const terminal = getOrCreateTesterTerminal();
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      const tcanInitCommands = parseTcanInitFromDocument(text);

      vscode.window.showInformationMessage(`开始运行测试用例集: ${suiteName}`);
      terminal.show();

      terminal.sendText(`# 测试用例集: ${suiteName}`);
      terminal.sendText(`# 位置: 行 ${line + 1}`);
      if (tcanInitCommands.length > 0) {
        terminal.sendText(`# 使用配置:`);
        for (const cmd of tcanInitCommands) {
          terminal.sendText(`#   ${cmd}`);
        }
      }
      terminal.sendText('');
      terminal.sendText(`npm run test:zlgcan`);
    })
  );

  // 运行单个测试用例
  context.subscriptions.push(
    vscode.commands.registerCommand('tester.runTestCaseByLine', async (uri: vscode.Uri, line: number, caseName: string) => {
      const terminal = getOrCreateTesterTerminal();
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();
      const tcanInitCommands = parseTcanInitFromDocument(text);

      vscode.window.showInformationMessage(`开始运行测试用例: ${caseName}`);
      terminal.show();

      terminal.sendText(`# 测试用例: ${caseName}`);
      terminal.sendText(`# 位置: 行 ${line + 1}`);
      if (tcanInitCommands.length > 0) {
        terminal.sendText(`# 使用配置:`);
        for (const cmd of tcanInitCommands) {
          terminal.sendText(`#   ${cmd}`);
        }
      }
      terminal.sendText('');
      terminal.sendText(`npm run test:zlgcan`);
    })
  );
}

/**
 * 获取或创建Tester测试终端
 */
function getOrCreateTesterTerminal(): vscode.Terminal {
  const terminalName = 'Tester 测试';
  let terminal = vscode.window.terminals.find(t => t.name === terminalName);

  if (!terminal) {
    terminal = vscode.window.createTerminal(terminalName);
  }

  return terminal;
}

// This method is called when your extension is deactivated
export function deactivate() {}
