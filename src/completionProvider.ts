import * as vscode from 'vscode';
import { TesterParser, BitFieldFunction, EnumDefinition } from './parser';

/**
 * 代码补全提供程序 - 为位域函数提供智能提示
 */
export class TesterCompletionProvider implements vscode.CompletionItemProvider {
  /**
   * 构建位域函数补全项
   */
  private buildBitFieldCompletionItem(
    funcName: string,
    funcDef: BitFieldFunction,
    includeDetailedDocs: boolean = true
  ): vscode.CompletionItem {
    const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);

    // 生成参数列表
    const params: string[] = [];
    funcDef.parameters.forEach((paramName, displayName) => {
      params.push(`${displayName}=\${${params.length + 1}:值}`);
    });

    item.insertText = new vscode.SnippetString(`${funcName} ${params.join(', ')}`);
    item.detail = includeDetailedDocs ? '位域函数' : '位域函数调用';

    // 生成文档说明
    const canIds = funcDef.messages.map(m => `0x${m.canId.toString(16).toUpperCase()}`).join(', ');

    if (includeDetailedDocs) {
      const paramDocs: string[] = [];
      funcDef.parameters.forEach((param, display) => {
        paramDocs.push(`- \`${display}\` → \`${param}\``);
      });
      item.documentation = new vscode.MarkdownString(
        `**位域函数**: ${funcName}\n\n` +
        `**CAN ID**: ${canIds}\n\n` +
        `**参数**:\n${paramDocs.join('\n')}`
      );
    } else {
      const paramNames: string[] = [];
      funcDef.parameters.forEach((param, display) => {
        paramNames.push(display);
      });
      item.documentation = new vscode.MarkdownString(
        `**位域函数**: ${funcName}\n\n` +
        `**CAN ID**: ${canIds}\n\n` +
        `**参数**: ${paramNames.join(', ')}`
      );
    }

    return item;
  }

  /**
   * 提供代码补全
   */
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // 解析整个文档以获取枚举和位域函数定义
    const parser = new TesterParser();
    const parseResult = parser.parse(document.getText());

    if (parseResult.errors.length > 0 || !parseResult.program) {
      return [];
    }

    const enums = parseResult.program.enums;
    const bitFieldFunctions = parseResult.program.bitFieldFunctions;

    // 场景1: 提供位域函数名补全
    // 当用户在测试用例中输入时（不在函数定义行）
    if (!linePrefix.includes('tbitfield') && !linePrefix.includes('tenum')) {
      // 检查是否在函数调用上下文中
      const functionCallMatch = linePrefix.match(/(\w+)\s+/);
      if (functionCallMatch) {
        const partialName = functionCallMatch[1];

        // 查找匹配的位域函数
        const matchingFunctions: vscode.CompletionItem[] = [];
        bitFieldFunctions.forEach((funcDef, funcName) => {
          if (funcName.startsWith(partialName) || partialName === '') {
            matchingFunctions.push(this.buildBitFieldCompletionItem(funcName, funcDef, true));
          }
        });

        if (matchingFunctions.length > 0) {
          return matchingFunctions;
        }
      }

      // 如果没有匹配的函数调用，提供所有位域函数列表
      const functionItems: vscode.CompletionItem[] = [];
      bitFieldFunctions.forEach((funcDef, funcName) => {
        functionItems.push(this.buildBitFieldCompletionItem(funcName, funcDef, false));
      });

      if (functionItems.length > 0) {
        return functionItems;
      }
    }

    // 场景2: 提供枚举值补全
    // 当用户在参数值位置输入时（检测 "参数名=" 模式）
    const parameterMatch = linePrefix.match(/(\w+)=(\w*)$/);
    if (parameterMatch) {
      const paramDisplayName = parameterMatch[1];
      const partialValue = parameterMatch[2];

      // 查找当前行的函数调用
      const functionNameMatch = linePrefix.match(/^\s*(\w+)\s+/);
      if (functionNameMatch) {
        const funcName = functionNameMatch[1];
        const funcDef = bitFieldFunctions.get(funcName);

        if (funcDef) {
          // 找到参数对应的枚举类型
          const paramName = funcDef.parameters.get(paramDisplayName);
          if (paramName) {
            // 在所有枚举中查找匹配的枚举类型
            let matchedEnum: EnumDefinition | undefined;
            enums.forEach((enumDef, enumName) => {
              // 检查枚举名是否与参数名相关
              if (paramName.includes(enumName) || enumName.includes(paramName)) {
                matchedEnum = enumDef;
              }
            });

            // 如果找到枚举，提供枚举值补全
            if (matchedEnum) {
              const enumItems: vscode.CompletionItem[] = [];
              matchedEnum.values.forEach((displayValue, numericValue) => {
                if (displayValue.includes(partialValue) || partialValue === '') {
                  const item = new vscode.CompletionItem(displayValue, vscode.CompletionItemKind.EnumMember);
                  item.insertText = displayValue;
                  item.detail = `枚举值 (${numericValue})`;
                  item.documentation = `数值: ${numericValue}`;
                  enumItems.push(item);
                }
              });

              if (enumItems.length > 0) {
                return enumItems;
              }
            }
          }
        }
      }
    }

    // 场景3: 提供关键字补全
    const keywords: vscode.CompletionItem[] = [
      {
        label: 'tenum',
        kind: vscode.CompletionItemKind.Keyword,
        insertText: new vscode.SnippetString('tenum ${1:枚举名} ${2:0=值1}, ${3:1=值2}'),
        detail: '定义枚举类型',
        documentation: '定义可重用的枚举类型，用于CAN信号值映射'
      },
      {
        label: 'tbitfield',
        kind: vscode.CompletionItemKind.Keyword,
        insertText: new vscode.SnippetString(
          'tbitfield ${1:函数名} ${2:参数1}="${3:变量1}", ${4:参数2}="${5:变量2}":\n  ${6:0x100}, ${7:1.0-1.7}="${3}"/100, ${8:2.0-2.7}="${5}"'
        ),
        detail: '定义位域函数',
        documentation: '将CAN信号位封装为参数化函数'
      },
      {
        label: 'tconfirm',
        kind: vscode.CompletionItemKind.Keyword,
        insertText: new vscode.SnippetString('tconfirm ${1:请确认操作结果}'),
        detail: '用户确认',
        documentation: '要求用户手动确认某个操作或状态'
      }
    ];

    return keywords;
  }

  /**
   * 提供补全项的详细信息
   */
  public resolveCompletionItem(
    item: vscode.CompletionItem,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CompletionItem> {
    return item;
  }
}
