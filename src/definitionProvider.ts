import * as vscode from 'vscode';
import { TesterParser } from './parser';

/**
 * 定义提供程序 - 实现"跳转到定义"功能
 */
export class TesterDefinitionProvider implements vscode.DefinitionProvider {
  /**
   * 提供定义位置
   */
  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const line = document.lineAt(position.line).text;

    // 解析整个文档
    const parser = new TesterParser();
    const parseResult = parser.parse(document.getText());

    if (parseResult.errors.length > 0 || !parseResult.program) {
      return null;
    }

    const enums = parseResult.program.enums;
    const bitFieldFunctions = parseResult.program.bitFieldFunctions;

    // 场景1: 从位域函数调用跳转到函数定义
    // 检查当前行是否为函数调用（格式：函数名 参数1=值1, ...）
    const funcCallMatch = line.trim().match(/^(\w+)\s+\w+\s*=\s*.+$/);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1];

      if (word === funcName && bitFieldFunctions.has(funcName)) {
        const funcDef = bitFieldFunctions.get(funcName);
        if (funcDef) {
          // 跳转到函数定义行
          return new vscode.Location(
            document.uri,
            new vscode.Position(funcDef.line, 0)
          );
        }
      }
    }

    // 场景2: 从枚举值跳转到枚举定义
    // 检查当前是否在参数值位置（格式：参数名=枚举值）
    const paramAssignMatch = line.match(/(\w+)\s*=\s*(\w+)/g);
    if (paramAssignMatch) {
      for (const match of paramAssignMatch) {
        const [, , value] = match.match(/(\w+)\s*=\s*(\w+)/) || [];
        if (value === word) {
          // 检查是否为枚举值
          for (const [enumName, enumDef] of enums.entries()) {
            for (const [numericValue, displayValue] of enumDef.values.entries()) {
              if (displayValue === word) {
                // 跳转到枚举定义行
                return new vscode.Location(
                  document.uri,
                  new vscode.Position(enumDef.line, 0)
                );
              }
            }
          }
        }
      }
    }

    // 场景3: 从函数定义中的参数引用跳转到对应的枚举定义
    if (line.includes('tbitfield')) {
      // 在位域函数定义中，检查是否点击了参数的内部名称
      // 例如：tbitfield 函数名 参数="内部名":
      const paramDefMatch = line.match(/(\w+)\s*=\s*"(\w+)"/g);
      if (paramDefMatch) {
        for (const match of paramDefMatch) {
          const [, , internalName] = match.match(/(\w+)\s*=\s*"(\w+)"/) || [];
          if (internalName === word) {
            // 查找包含此名称的枚举
            for (const [enumName, enumDef] of enums.entries()) {
              if (internalName.includes(enumName) || enumName.includes(internalName)) {
                return new vscode.Location(
                  document.uri,
                  new vscode.Position(enumDef.line, 0)
                );
              }
            }
          }
        }
      }
    }

    return null;
  }
}
