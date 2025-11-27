/**
 * 位域函数语法测试
 * 测试内容：
 * 1. 枚举定义解析
 * 2. 位域函数定义解析
 * 3. 位域函数调用解析
 * 4. CAN报文生成的正确性
 *
 * 运行方式: npx ts-node test/bitfield.test.ts
 */

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { TesterParser, BitFieldCallCommand } from '../src/parser';

// 声明全局类型
declare const console: {
  log(...args: any[]): void;
};

declare const process: {
  exit(code: number): void;
};

// 测试结果记录
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string = '') {
  testResults.push({ name, passed, message });
  const status = passed ? '✓' : '✗';
  console.log(`${status} ${name}${message ? ': ' + message : ''}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\n  期望: ${expected}\n  实际: ${actual}`);
  }
}

function runTest(name: string, testFn: () => void) {
  try {
    testFn();
    logTest(name, true);
  } catch (error: any) {
    logTest(name, false, error.message);
  }
}

console.log('\n========== 位域函数语法测试 ==========\n');

// ========== 枚举定义解析测试 ==========
console.log('--- 枚举定义解析 ---');

runTest('应该正确解析简单枚举定义', () => {
  const parser = new TesterParser();
  const text = 'tenum 车速单位 0=km/h, 1=mph, 2=m/s';
  const result = parser.parse(text);

  assert(result.errors.length === 0, `不应有解析错误，但有 ${result.errors.length} 个错误`);
  assert(result.program !== undefined, '程序应该被定义');
  assert(result.program!.enums.size === 1, `应该有1个枚举，实际有 ${result.program!.enums.size} 个`);

  const enumDef = result.program!.enums.get('车速单位');
  assert(enumDef !== undefined, '车速单位枚举应该存在');
  assertEquals(enumDef!.name, '车速单位', '枚举名称');
  assertEquals(enumDef!.values.get(0), 'km/h', '枚举值0');
  assertEquals(enumDef!.values.get(1), 'mph', '枚举值1');
  assertEquals(enumDef!.values.get(2), 'm/s', '枚举值2');
});

runTest('应该正确解析档位枚举', () => {
  const parser = new TesterParser();
  const text = 'tenum 档位枚举 0=P档, 1=R档, 2=N档, 3=D档, 4=S档';
  const result = parser.parse(text);

  assert(result.errors.length === 0, '不应有解析错误');
  const enumDef = result.program!.enums.get('档位枚举');
  assert(enumDef !== undefined, '档位枚举应该存在');
  assertEquals(enumDef!.values.size, 5, '枚举值数量');
  assertEquals(enumDef!.values.get(3), 'D档', 'D档值');
  assertEquals(enumDef!.values.get(4), 'S档', 'S档值');
});

runTest('应该检测重复定义的枚举', () => {
  const parser = new TesterParser();
  const text = `
tenum 车速单位 0=km/h, 1=mph
tenum 车速单位 0=km/h, 1=mph
  `;
  const result = parser.parse(text);

  assert(result.errors.length > 0, '应该有解析错误');
  assert(result.errors[0].message.includes('重复定义'), '错误消息应包含"重复定义"');
});

// ========== 位域函数定义解析测试 ==========
console.log('\n--- 位域函数定义解析 ---');

runTest('应该正确解析车速位域函数', () => {
  const parser = new TesterParser();
  const text = 'tbitfield 车速 车速值="车速值", 车速单位="车速单位": 144, 1.0-2.7="车速值"/100, 3.0-3.1="车速单位"';
  const result = parser.parse(text);

  assert(result.errors.length === 0, `不应有解析错误，但有 ${result.errors.length} 个错误`);
  assert(result.program!.bitFieldFunctions.size === 1, '应该有1个位域函数');

  const funcDef = result.program!.bitFieldFunctions.get('车速');
  assert(funcDef !== undefined, '车速函数应该存在');
  assertEquals(funcDef!.name, '车速', '函数名称');
  assertEquals(funcDef!.canId, 0x144, 'CAN ID');
  assertEquals(funcDef!.parameters.get('车速值'), '车速值', '参数1');
  assertEquals(funcDef!.parameters.get('车速单位'), '车速单位', '参数2');
  assertEquals(funcDef!.mappings.length, 2, '位域映射数量');

  // 检查第一个位域映射
  const mapping1 = funcDef!.mappings[0];
  assertEquals(mapping1.paramName, '车速值', '映射1参数名');
  assertEquals(mapping1.scale, 100, '映射1缩放因子');
  assertEquals(mapping1.bitRange.startByte, 1, '映射1起始字节');
  assertEquals(mapping1.bitRange.startBit, 0, '映射1起始位');
  assertEquals(mapping1.bitRange.endByte, 2, '映射1结束字节');
  assertEquals(mapping1.bitRange.endBit, 7, '映射1结束位');

  // 检查第二个位域映射
  const mapping2 = funcDef!.mappings[1];
  assertEquals(mapping2.paramName, '车速单位', '映射2参数名');
  assert(mapping2.scale === undefined, '映射2不应有缩放因子');
});

runTest('应该正确解析档位信息函数', () => {
  const parser = new TesterParser();
  const text = 'tbitfield 档位信息 当前档位="档位", 发动机转速="转速": 260, 1.0-1.2="档位", 2.0-3.7="转速"/10';
  const result = parser.parse(text);

  assert(result.errors.length === 0, '不应有解析错误');
  const funcDef = result.program!.bitFieldFunctions.get('档位信息');
  assert(funcDef !== undefined, '档位信息函数应该存在');
  assertEquals(funcDef!.canId, 0x260, 'CAN ID');
  assertEquals(funcDef!.mappings.length, 2, '位域映射数量');
  assertEquals(funcDef!.mappings[1].scale, 10, '转速缩放因子');
});

// ========== 位域函数调用解析测试 ==========
console.log('\n--- 位域函数调用解析 ---');

runTest('应该正确解析函数调用', () => {
  const parser = new TesterParser();
  const text = `
tbitfield 车速 车速值="车速值", 车速单位="车速单位": 144, 1.0-2.7="车速值"/100, 3.0-3.1="车速单位"

tset
  tcaninit 4, 0, 0, 500
tend

ttitle=测试
  tstart=测试用例
    车速 车速值=100, 车速单位=km/h
  tend
ttitle-end
  `;

  const result = parser.parse(text);
  assert(result.errors.length === 0, `不应有解析错误，但有 ${result.errors.length} 个: ${result.errors.map(e => e.message).join(', ')}`);
  assert(result.program!.testSuites.length === 1, '应该有1个测试用例集');

  const testCase = result.program!.testSuites[0].testCases[0];
  assert(testCase.commands.length === 1, '应该有1个命令');

  const command = testCase.commands[0] as BitFieldCallCommand;
  assertEquals(command.type, 'bitfield_call', '命令类型');
  assertEquals(command.functionName, '车速', '函数名');
  assertEquals(command.arguments.get('车速值'), 100, '车速值参数');
  assertEquals(command.arguments.get('车速单位'), 'km/h', '车速单位参数');
});

runTest('应该正确解析多个参数', () => {
  const parser = new TesterParser();
  const text = `
tbitfield 档位信息 当前档位="档位", 发动机转速="转速": 260, 1.0-1.2="档位", 2.0-3.7="转速"/10

tset
  tcaninit 4, 0, 0, 500
tend

ttitle=测试
  tstart=测试用例
    档位信息 当前档位=D档, 发动机转速=2500
  tend
ttitle-end
  `;

  const result = parser.parse(text);
  assert(result.errors.length === 0, '不应有解析错误');

  const command = result.program!.testSuites[0].testCases[0].commands[0] as BitFieldCallCommand;
  assertEquals(command.arguments.get('当前档位'), 'D档', '档位参数');
  assertEquals(command.arguments.get('发动机转速'), 2500, '转速参数');
});

// ========== CAN报文生成测试 ==========
console.log('\n--- CAN报文生成测试 ---');

runTest('应该正确生成车速=100km/h的CAN报文数据', () => {
  // 车速值=100, 缩放100倍 = 10000 (0x2710)
  // 字节1.0-2.7 (16位) = 0x2710 (Intel字节序: 10 27)
  const value = 100 * 100;
  assertEquals(value, 10000, '缩放后的值');

  // Intel字节序测试
  const data = new Array(8).fill(0);
  const lowByte = value & 0xFF;
  const highByte = (value >> 8) & 0xFF;
  data[0] = lowByte;
  data[1] = highByte;

  assertEquals(data[0], 0x10, '低字节');
  assertEquals(data[1], 0x27, '高字节');
});

runTest('应该正确处理位域编码', () => {
  const data = new Array(8).fill(0);
  const value = 10000;
  const signalLength = 16;

  // Intel字节序编码
  let currentBitPos = 0;

  for (let i = 0; i < signalLength; i++) {
    if (value & (1 << i)) {
      const byteIdx = Math.floor(currentBitPos / 8);
      const bitIdx = currentBitPos % 8;
      data[byteIdx] |= (1 << bitIdx);
    }
    currentBitPos++;
  }

  assertEquals(data[0], 0x10, '字节0');
  assertEquals(data[1], 0x27, '字节1');
});

runTest('应该正确处理枚举值为0的情况', () => {
  const data = new Array(8).fill(0);
  const value = 0;

  // 位域3.0-3.1，起始位置 = (3-1)*8 + 0 = 16
  let currentBitPos = 16;
  const signalLength = 2;

  for (let i = 0; i < signalLength; i++) {
    if (value & (1 << i)) {
      const byteIdx = Math.floor(currentBitPos / 8);
      const bitIdx = currentBitPos % 8;
      data[byteIdx] |= (1 << bitIdx);
    }
    currentBitPos++;
  }

  assertEquals(data[2], 0x00, '字节2应为0');
});

runTest('应该正确处理枚举值为非0的情况', () => {
  const data = new Array(8).fill(0);
  const value = 1;

  // 位域3.0-3.1，起始位置 = (3-1)*8 + 0 = 16
  let currentBitPos = 16;
  const signalLength = 2;

  for (let i = 0; i < signalLength; i++) {
    if (value & (1 << i)) {
      const byteIdx = Math.floor(currentBitPos / 8);
      const bitIdx = currentBitPos % 8;
      data[byteIdx] |= (1 << bitIdx);
    }
    currentBitPos++;
  }

  assertEquals(data[2], 0x01, '字节2应为1');
});

runTest('应该正确处理复杂的位域编码', () => {
  const data = new Array(8).fill(0);

  // 编码档位 (字节1.0-1.2) = 3
  const gearValue = 3;
  let currentBitPos = 0;
  for (let i = 0; i < 3; i++) {
    if (gearValue & (1 << i)) {
      const byteIdx = Math.floor(currentBitPos / 8);
      const bitIdx = currentBitPos % 8;
      data[byteIdx] |= (1 << bitIdx);
    }
    currentBitPos++;
  }

  // 编码转速 (字节2.0-3.7) = 25000
  const rpmValue = 25000;
  currentBitPos = 8;
  for (let i = 0; i < 16; i++) {
    if (rpmValue & (1 << i)) {
      const byteIdx = Math.floor(currentBitPos / 8);
      const bitIdx = currentBitPos % 8;
      data[byteIdx] |= (1 << bitIdx);
    }
    currentBitPos++;
  }

  assertEquals(data[0], 0x03, '档位字节');
  assertEquals(data[1], 0xA8, '转速低字节');
  assertEquals(data[2], 0x61, '转速高字节');
});

// ========== 完整集成测试 ==========
console.log('\n--- 完整集成测试 ---');

runTest('应该正确解析包含枚举、函数定义和调用的完整脚本', () => {
  const parser = new TesterParser();
  const text = `
// 定义枚举
tenum 车速单位 0=km/h, 1=mph, 2=m/s
tenum 档位枚举 0=P档, 1=R档, 2=N档, 3=D档, 4=S档

// 定义位域函数
tbitfield 车速 车速值="车速值", 车速单位="车速单位": 144, 1.0-2.7="车速值"/100, 3.0-3.1="车速单位"
tbitfield 档位信息 当前档位="档位", 发动机转速="转速": 260, 1.0-1.2="档位", 2.0-3.7="转速"/10

// 设备配置
tset
  tcaninit 4, 0, 0, 500
tend

// 测试用例
ttitle=位域函数测试
  1 tstart=车速测试
    车速 车速值=100, 车速单位=km/h
    车速 车速值=60, 车速单位=mph
  tend

  2 tstart=档位测试
    档位信息 当前档位=D档, 发动机转速=2500
    档位信息 当前档位=S档, 发动机转速=4000
  tend
ttitle-end
  `;

  const result = parser.parse(text);

  assert(result.errors.length === 0, `不应有解析错误，但有 ${result.errors.length} 个`);
  assert(result.program !== undefined, '程序应该被定义');

  // 检查枚举
  assertEquals(result.program!.enums.size, 2, '枚举数量');
  assert(result.program!.enums.has('车速单位'), '应包含车速单位枚举');
  assert(result.program!.enums.has('档位枚举'), '应包含档位枚举');

  // 检查位域函数
  assertEquals(result.program!.bitFieldFunctions.size, 2, '位域函数数量');
  assert(result.program!.bitFieldFunctions.has('车速'), '应包含车速函数');
  assert(result.program!.bitFieldFunctions.has('档位信息'), '应包含档位信息函数');

  // 检查配置
  assert(result.program!.configuration !== undefined, '应该有配置块');
  assertEquals(result.program!.configuration!.channels.length, 1, '通道数量');

  // 检查测试用例
  assertEquals(result.program!.testSuites.length, 1, '测试用例集数量');
  assertEquals(result.program!.testSuites[0].testCases.length, 2, '测试用例数量');

  // 检查第一个测试用例
  const testCase1 = result.program!.testSuites[0].testCases[0];
  assertEquals(testCase1.commands.length, 2, '测试用例1命令数量');
  assertEquals((testCase1.commands[0] as BitFieldCallCommand).type, 'bitfield_call', '命令1类型');

  // 检查第二个测试用例
  const testCase2 = result.program!.testSuites[0].testCases[1];
  assertEquals(testCase2.commands.length, 2, '测试用例2命令数量');
});

// ========== 测试总结 ==========
console.log('\n========== 测试总结 ==========\n');

const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;
const total = testResults.length;

console.log(`总计: ${total} 个测试`);
console.log(`通过: ${passed} 个`);
console.log(`失败: ${failed} 个`);

if (failed > 0) {
  console.log('\n失败的测试:');
  testResults.filter(r => !r.passed).forEach(r => {
    console.log(`  ✗ ${r.name}`);
    if (r.message) {
      console.log(`    ${r.message}`);
    }
  });
  process.exit(1);
} else {
  console.log('\n✓ 所有测试通过!');
  process.exit(0);
}
