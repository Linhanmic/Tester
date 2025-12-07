# Changelog

本文档记录 Tester 项目的重要变更。

## [Unreleased]

### Added - 2024

#### CAN设备抽象层 (zlgcan VSCode 插件适配改进)

**新增文件：**
- `src/devices.ts` (672行) - 完整的CAN设备抽象层实现
- `test/devices.test.ts` (362行) - 单元测试（14个测试用例）
- `test/integration.test.ts` (183行) - 集成测试（6个测试用例）

**功能特性：**

1. **设备抽象层接口** (Phase 1)
   - `ICanDevice` - CAN设备接口
   - `ICanChannel` - CAN通道接口
   - `IChannelConfig` - 通道配置接口
   - `ICanFrame` / `ICanFDFrame` - CAN/CANFD帧接口
   - `IReceivedFrame` / `IReceivedFDFrame` - 接收帧接口
   - `ICanDriver` - 驱动接口

2. **ZLG CAN驱动适配** (Phase 1.2-1.3)
   - `ZlgCanDriver` - ZLG驱动实现
   - `ZlgCanDevice` - ZLG设备实现
   - `ZlgCanChannel` - ZLG通道实现
   - 同步API → 异步Promise API自动转换
   - 通道句柄自动管理（BigInt → 对象封装）

3. **错误处理标准化** (Phase 2)
   - `CanDeviceError` - 统一错误类
   - `ErrorCode` - 错误码枚举
   - 所有操作使用 Promise + throw 异常模式

4. **配置自动转换** (Phase 3)
   - `BaudrateConverter` - 波特率转换工具
   - CAN模式：kbps → timing0/timing1
   - CANFD模式：kbps → abitTiming/dbitTiming
   - 支持常用波特率：10k, 20k, 50k, 100k, 125k, 250k, 500k, 800k, 1000k

5. **设备管理器** (Phase 1.1)
   - `CanDeviceManager` - 单例设备管理器
   - 多驱动支持
   - 设备生命周期管理

**解决的问题：**

- ✅ **[CRITICAL]** 解决了 `src/devices.ts` 文件缺失导致无法编译的问题
- ✅ **[HIGH]** 统一了同步/异步接口，符合VSCode异步编程模型
- ✅ **[HIGH]** 标准化了错误处理机制
- ✅ **[MEDIUM]** 简化了波特率配置流程

**验收标准达成：**

- ✅ 项目成功编译（devices.ts无类型错误）
- ✅ 接口定义完整（支持CAN和CANFD）
- ✅ 错误处理标准化（CanDeviceError + ErrorCode）
- ✅ 测试文件已创建（单元测试 + 集成测试）
- ✅ executor.ts 和 extension.ts 可正确导入使用

**技术债务：**

- 测试需要真实硬件环境（zlgcan.node native模块）
- Phase 4（接收机制优化）保持当前轮询方式
- Phase 6（Webview适配）通过executor间接使用，无需修改

**相关issue:**
- zlgcan VSCode插件适配改进计划 (zlgcan-vscode-adaptation-plan.md)

---

## 版本历史

### [0.0.7] - 之前
- CAN设备抽象层实现
- ZLG CAN设备封装
- Tester脚本解析器
- VSCode语言支持
