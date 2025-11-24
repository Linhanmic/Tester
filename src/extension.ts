import * as vscode from "vscode";
import { TesterValidator } from "./validator";
import { TesterFoldingRangeProvider } from "./foldingProvider";
import { TesterDocumentSymbolProvider } from "./symbolProvider";
import { TesterHoverProvider } from "./hoverProvider";
import { TesterCodeLensProvider } from "./codeLensProvider";
import { TesterFormattingProvider } from "./formatting";
import { TesterExecutor } from "./executor";

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

  // 创建代码透视提供程序
  const codeLensProvider = new TesterCodeLensProvider();

  // 注册代码透视提供程序
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      "tester",
      codeLensProvider
    )
  );

  // 注册格式化提供程序
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      "tester",
      new TesterFormattingProvider()
    )
  );

  // ========== CodeLens 命令注册 ==========

  // 创建执行器实例
  const executor = new TesterExecutor();

  // 监听执行状态变更，更新CodeLens
  executor.onStateChange((state) => {
    codeLensProvider.updateExecutionState(state);
  });

  // 注册运行全部测试命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runAllTests",
      async (documentUri: vscode.Uri) => {
        await executor.runAllTests(documentUri);
      }
    )
  );

  // 注册运行测试用例集命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runTestSuiteByLine",
      async (documentUri: vscode.Uri, lineNumber: number, suiteName: string) => {
        await executor.runTestSuiteByLine(documentUri, lineNumber, suiteName);
      }
    )
  );

  // 注册运行单个测试用例命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runTestCaseByLine",
      async (documentUri: vscode.Uri, lineNumber: number, caseName: string) => {
        await executor.runTestCaseByLine(documentUri, lineNumber, caseName);
      }
    )
  );

  // 注册暂停执行命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.pauseExecution",
      () => {
        executor.pauseAllTasks();
      }
    )
  );

  // 注册继续执行命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.resumeExecution",
      () => {
        executor.resumeAllTasks();
      }
    )
  );

  // 注册停止执行命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.stopExecution",
      () => {
        executor.stopAllTasks();
      }
    )
  );

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

// This method is called when your extension is deactivated
export function deactivate() {}
