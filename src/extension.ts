import * as vscode from "vscode";
import { TesterValidator } from "./validator";
import { TesterFoldingRangeProvider } from "./foldingProvider";

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
