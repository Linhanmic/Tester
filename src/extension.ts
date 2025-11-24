import * as vscode from "vscode";
import { TesterValidator } from "./validator";
import { TesterFoldingRangeProvider } from "./foldingProvider";
import { TesterDocumentSymbolProvider } from "./symbolProvider";
import { TesterHoverProvider } from "./hoverProvider";
import { TesterCodeLensProvider } from "./codeLensProvider";
import { TesterFormattingProvider } from "./formatting";
import { TesterExecutor } from "./executor";
import { DeviceStatusViewProvider, MessageMonitorViewProvider, ManualSendViewProvider } from "./views";
import { StatusBarManager } from "./statusBar";

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

  // ========== 视图提供程序注册 ==========

  // 创建视图提供程序
  const deviceStatusProvider = new DeviceStatusViewProvider(context.extensionUri);
  const messageMonitorProvider = new MessageMonitorViewProvider(context.extensionUri);
  const manualSendProvider = new ManualSendViewProvider(context.extensionUri);

  // 注册视图
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DeviceStatusViewProvider.viewType,
      deviceStatusProvider
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MessageMonitorViewProvider.viewType,
      messageMonitorProvider
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ManualSendViewProvider.viewType,
      manualSendProvider
    )
  );

  // ========== 状态栏 ==========

  const statusBar = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBar.dispose() });

  // 注册显示测试输出命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.showTestOutput",
      () => {
        executor.getOutputChannel().show();
      }
    )
  );

  // ========== CodeLens 命令注册 ==========

  // 创建执行器实例
  const executor = new TesterExecutor();

  // 监听执行状态变更，更新CodeLens和状态栏
  executor.onStateChange((state) => {
    codeLensProvider.updateExecutionState(state);
    statusBar.setRunning(state === 'running');
  });

  // 注册运行全部测试命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runAllTests",
      async (documentUri: vscode.Uri) => {
        statusBar.reset();
        const result = await executor.runAllTests(documentUri);
        statusBar.updateResult({
          passed: result.totalPassed,
          failed: result.totalFailed,
          total: result.totalPassed + result.totalFailed,
          running: false
        });
      }
    )
  );

  // 注册运行测试用例集命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runTestSuiteByLine",
      async (documentUri: vscode.Uri, lineNumber: number, suiteName: string) => {
        statusBar.reset();
        const result = await executor.runTestSuiteByLine(documentUri, lineNumber, suiteName);
        statusBar.updateResult({
          passed: result.passed,
          failed: result.failed,
          total: result.passed + result.failed,
          running: false
        });
      }
    )
  );

  // 注册运行单个测试用例命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.runTestCaseByLine",
      async (documentUri: vscode.Uri, lineNumber: number, caseName: string) => {
        statusBar.reset();
        const result = await executor.runTestCaseByLine(documentUri, lineNumber, caseName);
        statusBar.updateResult({
          passed: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
          total: 1,
          running: false
        });
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

  // 注册停止执行命令（同时关闭设备）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.stopExecution",
      () => {
        executor.stopAllTasks(true);
        deviceStatusProvider.updateStatus({
          connected: false,
          deviceType: '',
          deviceIndex: 0,
          channels: [],
        });
      }
    )
  );

  // 注册打开设备命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.openDevice",
      async () => {
        // 获取当前活动编辑器的文档
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'tester') {
          vscode.window.showWarningMessage('请先打开一个 Tester 文件');
          return;
        }
        // 设备打开由执行器在运行测试时自动处理
        vscode.window.showInformationMessage('设备将在运行测试时自动打开');
      }
    )
  );

  // 注册关闭设备命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.closeDevice",
      () => {
        executor.stopAllTasks(true);
        deviceStatusProvider.updateStatus({
          connected: false,
          deviceType: '',
          deviceIndex: 0,
          channels: [],
        });
      }
    )
  );

  // 注册切换监视模式命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.toggleMonitorMode",
      () => {
        messageMonitorProvider.toggleMode();
      }
    )
  );

  // 注册清空报文命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.clearMessages",
      () => {
        messageMonitorProvider.clearMessages();
      }
    )
  );

  // 注册发送报文命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tester.sendMessage",
      () => {
        // 手动发送通过 ManualSendViewProvider 的 webview 处理
        vscode.window.showInformationMessage('请使用侧边栏的手动发送视图');
      }
    )
  );

  // 监听手动发送请求
  manualSendProvider.onSendMessage((request) => {
    // TODO: 实现手动发送逻辑
    // 需要从executor获取设备实例并发送
    manualSendProvider.showSendResult(false, '手动发送功能开发中');
  });

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
