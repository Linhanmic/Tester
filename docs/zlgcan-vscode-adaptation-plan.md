# ZLG CAN VSCode 插件适配改进计划

## 背景

新的 `zlgcan` 模块已重构完成（`src/zlgcan/index.ts`，969行），提供了完整的 ZLG CAN 设备封装。但现有 VSCode 插件存在关键适配问题需要解决。

---

## 关键问题

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| `src/devices.ts` 文件缺失 | **CRITICAL** | executor.ts 和 extension.ts 导入了该文件的接口，但文件不存在，导致无法编译 |
| 同步/异步接口不匹配 | HIGH | zlgcan 使用同步API，executor 期望 Promise 异步API |
| 错误处理不统一 | MEDIUM | zlgcan 使用返回值表示错误，executor 期望抛出异常 |
| 接收机制效率问题 | LOW | 当前使用10ms轮询，可改用回调机制 |

---

## 实施计划

### Phase 1: 创建设备抽象层 [P0 - CRITICAL]

**任务 1.1: 创建 `src/devices.ts` 文件**

定义以下接口和类：

```typescript
// 接口
- ICanDevice          // 抽象CAN设备接口
- ICanChannel         // 抽象CAN通道接口
- IChannelConfig      // 通道配置接口
- ICanFrame           // CAN帧接口
- ICanFDFrame         // CANFD帧接口
- IReceivedFrame      // 接收帧接口
- IReceivedFDFrame    // 接收CANFD帧接口

// 枚举
- CanProtocolType     // CAN协议类型 (CAN/CANFD)
- CanDeviceState      // 设备状态

// 类
- CanDeviceManager    // 设备管理器（单例）
- ZlgCanDriver        // ZLG驱动适配器
- CanDeviceError      // 统一错误类
```

**任务 1.2: 实现 ZlgCanDriver 适配器**

将 `ZlgCanDevice` 的同步API包装为异步Promise API：

```typescript
// zlgcan 同步方式
const result = zlgDevice.transmit(handle, frame); // 返回number

// 适配后的异步方式
async transmit(frame: ICanFrame): Promise<void> {
  const result = this.zlgDevice.transmit(this.handle, frame);
  if (result === 0) {
    throw new CanDeviceError('TRANSMIT_FAILED', '发送失败');
  }
}
```

**任务 1.3: 实现通道句柄自动管理**

```typescript
class ManagedChannel implements ICanChannel {
  private handle: ChannelHandle;  // BigInt句柄
  private zlgDevice: ZlgCanDevice;

  // 封装句柄管理，对外暴露对象接口
  async close(): Promise<void> { ... }
}
```

---

### Phase 2: 错误处理标准化 [P1 - HIGH]

**任务 2.1: 创建统一错误类**

```typescript
export class CanDeviceError extends Error {
  constructor(
    public code: ErrorCode,      // DEVICE_NOT_OPEN, CHANNEL_INIT_FAILED 等
    public message: string,
    public details?: any
  ) { ... }
}
```

**任务 2.2: 错误码定义**

基于 zlgcan 的 ErrorCode 常量，映射为更友好的错误类型：
- `DEVICE_NOT_OPEN` - 设备未打开
- `CHANNEL_INIT_FAILED` - 通道初始化失败
- `TRANSMIT_FAILED` - 发送失败
- `RECEIVE_TIMEOUT` - 接收超时
- `BUFFER_OVERFLOW` - 缓冲区溢出
- `BUS_ERROR` - 总线错误

**任务 2.3: 更新 executor.ts 错误处理**

将返回值检查模式改为 try-catch 异常处理模式。

---

### Phase 3: 接口适配优化 [P1 - HIGH]

**任务 3.1: 统一配置初始化流程**

当前分散的配置步骤：
```
1. setValue() 设置波特率
2. initCanChannel() 获取句柄
3. startCanChannel() 启动
```

改进为统一的初始化方法：
```typescript
async initChannel(config: IChannelConfig): Promise<ICanChannel> {
  // 内部自动处理配置、初始化、启动
}
```

**任务 3.2: 波特率配置适配**

executor.ts 使用字符串格式（如 `"500k"`, `"2M"`），zlgcan 需要具体的 timing 值或 abitTiming/dbitTiming 值。需要创建转换函数。

**任务 3.3: 适配 CANFD 帧标志**

确保 `CanFDFrameFlags` (BRS, ESI) 在收发时正确处理。

---

### Phase 4: 接收机制优化 [P2 - MEDIUM]

**任务 4.1: 评估回调vs轮询**

当前 executor 使用 10ms 轮询，zlgcan 支持 `setReceiveCallback()`。评估使用回调机制是否更优。

**任务 4.2: 如决定使用回调**

```typescript
// 使用zlgcan的回调机制
zlgDevice.setReceiveCallback(handle, (frame) => {
  this._onMessageReceived.fire(frame);
});
```

**任务 4.3: 如保持轮询**

优化轮询间隔和批处理逻辑，减少CPU占用。

---

### Phase 5: 测试完善 [P2 - MEDIUM]

**任务 5.1: devices.ts 单元测试**

创建 `test/devices.test.ts`，测试：
- CanDeviceManager 单例行为
- ZlgCanDriver 初始化和注册
- ICanDevice 和 ICanChannel 生命周期

**任务 5.2: 集成测试**

创建 `test/integration.test.ts`，测试：
- executor → devices → zlgcan 完整调用链
- 设备打开、通道初始化、收发报文、关闭设备

**任务 5.3: 错误场景测试**

- 设备未连接时的错误处理
- 通道初始化失败恢复
- 发送失败重试逻辑

---

### Phase 6: Webview 视图适配 [P2 - MEDIUM]

**任务 6.1: deviceStatusView 适配**

确保与新的设备管理器接口兼容：
- `onOpenFromConfig` 事件处理
- 设备状态显示更新

**任务 6.2: messageMonitorView 适配**

确保接收帧格式兼容：
- `IReceivedFrame` 和 `IReceivedFDFrame` 正确转换为 `CanMessage`

**任务 6.3: manualSendView 适配**

确保手动发送使用新接口：
- `ICanFrame` 和 `ICanFDFrame` 构造

---

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| **新建** | `src/devices.ts` | 设备抽象层（约400-500行） |
| 修改 | `src/executor.ts` | 适配新接口，优化错误处理 |
| 修改 | `src/extension.ts` | 确保导入正确 |
| 修改 | `src/views/deviceStatusView.ts` | 适配设备管理器接口 |
| 修改 | `src/views/messageMonitorView.ts` | 适配接收帧格式 |
| 修改 | `src/views/manualSendView.ts` | 适配发送帧格式 |
| **新建** | `test/devices.test.ts` | 设备层单元测试 |
| **新建** | `test/integration.test.ts` | 集成测试 |

---

## 依赖关系

```
Phase 1 (devices.ts)
    ↓
Phase 2 (错误处理) ←→ Phase 3 (接口适配)
    ↓
Phase 4 (接收优化)
    ↓
Phase 5 (测试) ←→ Phase 6 (Webview适配)
```

---

## 验收标准

1. 项目能够成功编译（`npm run compile`）
2. 所有现有测试通过
3. 新增的 devices.ts 测试通过
4. 集成测试通过（设备打开、收发、关闭完整流程）
5. Webview 功能正常（设备状态、报文监视、手动发送）
6. 脚本执行功能正常（tcans、tcanr、位域函数等）

---

## 附录：zlgcan 模块核心接口参考

### ZlgCanDevice 类主要方法

```typescript
// 设备操作
openDevice(deviceType, deviceIndex, reserved): boolean
closeDevice(): boolean
getDeviceInfo(): DeviceInfo | null
isDeviceOnLine(): boolean

// 通道操作
initCanChannel(channelIndex, config): ChannelHandle  // BigInt
startCanChannel(channelHandle): boolean
resetCanChannel(channelHandle): boolean

// 数据收发
transmit(channelHandle, frames: CanFrame[]): number
transmitFD(channelHandle, frames: CanFDFrame[]): number
receive(channelHandle, count, waitTime): ReceivedFrame[]
receiveFD(channelHandle, count, waitTime): ReceivedFDFrame[]

// 回调
setReceiveCallback(channelHandle, callback): boolean
clearReceiveCallback(channelHandle): boolean
```

### 关键数据结构

```typescript
interface CanFrame {
  id: number;
  dlc: number;        // 0-8
  data: number[];
  transmitType?: number;
}

interface CanFDFrame {
  id: number;
  len: number;        // 0-64
  data: number[];
  flags?: number;     // BRS, ESI
  transmitType?: number;
}

interface ReceivedFrame {
  id: number;
  dlc: number;
  data: number[];
  timestamp: number;  // 微秒
}
```
