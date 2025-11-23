#include <napi.h>
#include <windows.h>
#include <thread>
#include <chrono>
#include <vector>
#include <map>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <atomic>

// 包含ZLG CAN头文件
extern "C" {
#include "zlgcan.h"
}

// 接收数据的结构体（用于在线程间传递）
struct ReceiveContext {
    std::vector<ZCAN_Receive_Data> frames;
};

// 接收线程的管理结构
struct ReceiveThreadContext {
    CHANNEL_HANDLE channelHandle;
    Napi::ThreadSafeFunction tsfn;
    std::atomic<bool> shouldStop;
    std::thread thread;

    ReceiveThreadContext(CHANNEL_HANDLE handle, Napi::ThreadSafeFunction func)
        : channelHandle(handle), tsfn(func), shouldStop(false) {}
};

// 全局变量存储接收线程上下文
std::map<CHANNEL_HANDLE, std::unique_ptr<ReceiveThreadContext>> receiveThreads;
std::mutex threadsMutex;

class ZlgCanDevice : public Napi::ObjectWrap<ZlgCanDevice> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "ZlgCanDevice", {
            InstanceMethod("openDevice", &ZlgCanDevice::OpenDevice),
            InstanceMethod("closeDevice", &ZlgCanDevice::CloseDevice),
            InstanceMethod("getDeviceInfo", &ZlgCanDevice::GetDeviceInfo),
            InstanceMethod("initCanChannel", &ZlgCanDevice::InitCanChannel),
            InstanceMethod("startCanChannel", &ZlgCanDevice::StartCanChannel),
            InstanceMethod("transmit", &ZlgCanDevice::Transmit),
            InstanceMethod("transmitFD", &ZlgCanDevice::TransmitFD),
            InstanceMethod("receive", &ZlgCanDevice::Receive),
            InstanceMethod("receiveFD", &ZlgCanDevice::ReceiveFD),
            InstanceMethod("setReceiveCallback", &ZlgCanDevice::SetReceiveCallback),
            InstanceMethod("clearReceiveCallback", &ZlgCanDevice::ClearReceiveCallback)
        });

        constructor = Napi::Persistent(func);
        constructor.SuppressDestruct();

        exports.Set("ZlgCanDevice", func);
        return exports;
    }

    ZlgCanDevice(const Napi::CallbackInfo& info) : Napi::ObjectWrap<ZlgCanDevice>(info) {
        deviceHandle = INVALID_DEVICE_HANDLE;
    }

    ~ZlgCanDevice() {
        // 确保所有接收线程都被停止
        CleanupAllReceiveThreads();
        
        if (deviceHandle != INVALID_DEVICE_HANDLE) {
            ZCAN_CloseDevice(deviceHandle);
        }
    }

private:
    static Napi::FunctionReference constructor;
    DEVICE_HANDLE deviceHandle;

    Napi::Value OpenDevice(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 3) {
            Napi::TypeError::New(env, "Expected deviceType, deviceIndex, and reserved").ThrowAsJavaScriptException();
            return env.Null();
        }

        uint32_t deviceType = info[0].As<Napi::Number>().Uint32Value();
        uint32_t deviceIndex = info[1].As<Napi::Number>().Uint32Value();
        uint32_t reserved = info[2].As<Napi::Number>().Uint32Value();

        deviceHandle = ZCAN_OpenDevice(deviceType, deviceIndex, reserved);

        if (deviceHandle == INVALID_DEVICE_HANDLE) {
            Napi::Error::New(env, "Failed to open device").ThrowAsJavaScriptException();
            return env.Null();
        }

        return Napi::Boolean::New(env, true);
    }

    Napi::Value CloseDevice(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        // 先清理所有接收线程
        CleanupAllReceiveThreads();

        if (deviceHandle != INVALID_DEVICE_HANDLE) {
            ZCAN_CloseDevice(deviceHandle);
            deviceHandle = INVALID_DEVICE_HANDLE;
        }

        return Napi::Boolean::New(env, true);
    }

    Napi::Value GetDeviceInfo(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (deviceHandle == INVALID_DEVICE_HANDLE) {
            Napi::Error::New(env, "Device not opened").ThrowAsJavaScriptException();
            return env.Null();
        }

        ZCAN_DEVICE_INFO deviceInfo;
        if (ZCAN_GetDeviceInf(deviceHandle, &deviceInfo) != STATUS_OK) {
            Napi::Error::New(env, "Failed to get device info").ThrowAsJavaScriptException();
            return env.Null();
        }

        Napi::Object result = Napi::Object::New(env);
        result.Set("hardwareVersion", Napi::Number::New(env, deviceInfo.hw_Version));
        result.Set("firmwareVersion", Napi::Number::New(env, deviceInfo.fw_Version));
        result.Set("driverVersion", Napi::Number::New(env, deviceInfo.dr_Version));
        result.Set("libraryVersion", Napi::Number::New(env, deviceInfo.in_Version));
        result.Set("irqNumber", Napi::Number::New(env, deviceInfo.irq_Num));
        result.Set("canNumber", Napi::Number::New(env, deviceInfo.can_Num));

        // 序列号
        std::string serialNum(reinterpret_cast<char*>(deviceInfo.str_Serial_Num));
        result.Set("serialNumber", Napi::String::New(env, serialNum));

        // 硬件类型
        std::string hardwareType(reinterpret_cast<char*>(deviceInfo.str_hw_Type));
        result.Set("hardwareType", Napi::String::New(env, hardwareType));

        return result;
    }

    Napi::Value InitCanChannel(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected channelIndex and config").ThrowAsJavaScriptException();
            return env.Null();
        }

        uint32_t channelIndex = info[0].As<Napi::Number>().Uint32Value();
        Napi::Object config = info[1].As<Napi::Object>();

        ZCAN_CHANNEL_INIT_CONFIG initConfig = {0};
        initConfig.can_type = config.Get("canType").As<Napi::Number>().Uint32Value();

        // CAN配置
        if (initConfig.can_type == TYPE_CAN) {
            initConfig.can.acc_code = config.Get("accCode").As<Napi::Number>().Uint32Value();
            initConfig.can.acc_mask = config.Get("accMask").As<Napi::Number>().Uint32Value();
            initConfig.can.reserved = config.Get("reserved").As<Napi::Number>().Uint32Value();
            initConfig.can.filter = config.Get("filter").As<Napi::Number>().Uint32Value();
            initConfig.can.timing0 = config.Get("timing0").As<Napi::Number>().Uint32Value();
            initConfig.can.timing1 = config.Get("timing1").As<Napi::Number>().Uint32Value();
            initConfig.can.mode = config.Get("mode").As<Napi::Number>().Uint32Value();
        }
        // CANFD配置
        else if (initConfig.can_type == TYPE_CANFD) {
            initConfig.canfd.acc_code = config.Get("accCode").As<Napi::Number>().Uint32Value();
            initConfig.canfd.acc_mask = config.Get("accMask").As<Napi::Number>().Uint32Value();
            initConfig.canfd.abit_timing = config.Get("abitTiming").As<Napi::Number>().Uint32Value();
            initConfig.canfd.dbit_timing = config.Get("dbitTiming").As<Napi::Number>().Uint32Value();
            initConfig.canfd.brp = config.Get("brp").As<Napi::Number>().Uint32Value();
            initConfig.canfd.filter = config.Get("filter").As<Napi::Number>().Uint32Value();
            initConfig.canfd.mode = config.Get("mode").As<Napi::Number>().Uint32Value();
            initConfig.canfd.pad = config.Get("pad").As<Napi::Number>().Uint32Value();
            initConfig.canfd.reserved = config.Get("reserved").As<Napi::Number>().Uint32Value();
        }

        CHANNEL_HANDLE channelHandle = ZCAN_InitCAN(deviceHandle, channelIndex, &initConfig);

        if (channelHandle == INVALID_CHANNEL_HANDLE) {
            Napi::Error::New(env, "Failed to initialize CAN channel").ThrowAsJavaScriptException();
            return env.Null();
        }

        return Napi::Number::New(env, static_cast<double>(reinterpret_cast<uintptr_t>(channelHandle)));
    }

    Napi::Value StartCanChannel(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1) {
            Napi::TypeError::New(env, "Expected channelHandle").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );

        UINT result = ZCAN_StartCAN(channelHandle);

        return Napi::Boolean::New(env, result == STATUS_OK);
    }

    Napi::Value Transmit(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected channelHandle and frame").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );
        Napi::Object frameObj = info[1].As<Napi::Object>();

        ZCAN_Transmit_Data transmitData = {0};
        can_frame& frame = transmitData.frame;

        // 设置帧ID
        frame.can_id = frameObj.Get("id").As<Napi::Number>().Uint32Value();
        
        // 设置数据长度
        frame.can_dlc = frameObj.Get("dlc").As<Napi::Number>().Uint32Value();
        
        // 设置数据
        Napi::Array dataArray = frameObj.Get("data").As<Napi::Array>();
        for (uint32_t i = 0; i < dataArray.Length() && i < 8; i++) {
            frame.data[i] = dataArray.Get(i).As<Napi::Number>().Uint32Value();
        }

        // 设置传输类型
        transmitData.transmit_type = frameObj.Get("transmitType").As<Napi::Number>().Uint32Value();

        UINT result = ZCAN_Transmit(channelHandle, &transmitData, 1);

        return Napi::Number::New(env, result);
    }

    Napi::Value TransmitFD(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected channelHandle and frame").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );
        Napi::Object frameObj = info[1].As<Napi::Object>();

        ZCAN_TransmitFD_Data transmitData = {0};
        canfd_frame& frame = transmitData.frame;

        // 设置帧ID
        frame.can_id = frameObj.Get("id").As<Napi::Number>().Uint32Value();

        // 设置数据长度
        frame.len = frameObj.Get("len").As<Napi::Number>().Uint32Value();

        // 设置标志 (BRS等)
        if (frameObj.Has("flags")) {
            frame.flags = frameObj.Get("flags").As<Napi::Number>().Uint32Value();
        }

        // 设置数据
        Napi::Array dataArray = frameObj.Get("data").As<Napi::Array>();
        for (uint32_t i = 0; i < dataArray.Length() && i < 64; i++) {
            frame.data[i] = dataArray.Get(i).As<Napi::Number>().Uint32Value();
        }

        // 设置传输类型
        transmitData.transmit_type = frameObj.Get("transmitType").As<Napi::Number>().Uint32Value();

        UINT result = ZCAN_TransmitFD(channelHandle, &transmitData, 1);

        return Napi::Number::New(env, result);
    }

    Napi::Value Receive(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected channelHandle and count").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );
        uint32_t count = info[1].As<Napi::Number>().Uint32Value();
        int32_t waitTime = -1; // 默认阻塞等待

        if (info.Length() > 2) {
            waitTime = info[2].As<Napi::Number>().Int32Value();
        }

        std::vector<ZCAN_Receive_Data> receiveBuffer(count);
        UINT receivedCount = ZCAN_Receive(channelHandle, receiveBuffer.data(), count, waitTime);

        Napi::Array resultArray = Napi::Array::New(env, receivedCount);

        for (UINT i = 0; i < receivedCount; i++) {
            Napi::Object frameObj = Napi::Object::New(env);
            
            frameObj.Set("id", Napi::Number::New(env, receiveBuffer[i].frame.can_id));
            frameObj.Set("dlc", Napi::Number::New(env, receiveBuffer[i].frame.can_dlc));
            frameObj.Set("timestamp", Napi::Number::New(env, receiveBuffer[i].timestamp));

            Napi::Array dataArray = Napi::Array::New(env, 8);
            for (int j = 0; j < 8; j++) {
                dataArray.Set(j, Napi::Number::New(env, receiveBuffer[i].frame.data[j]));
            }
            frameObj.Set("data", dataArray);

            resultArray.Set(i, frameObj);
        }

        return resultArray;
    }

    Napi::Value ReceiveFD(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected channelHandle and count").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );
        uint32_t count = info[1].As<Napi::Number>().Uint32Value();
        int32_t waitTime = -1;

        if (info.Length() > 2) {
            waitTime = info[2].As<Napi::Number>().Int32Value();
        }

        std::vector<ZCAN_ReceiveFD_Data> receiveBuffer(count);
        UINT receivedCount = ZCAN_ReceiveFD(channelHandle, receiveBuffer.data(), count, waitTime);

        Napi::Array resultArray = Napi::Array::New(env, receivedCount);

        for (UINT i = 0; i < receivedCount; i++) {
            Napi::Object frameObj = Napi::Object::New(env);

            frameObj.Set("id", Napi::Number::New(env, receiveBuffer[i].frame.can_id));
            frameObj.Set("len", Napi::Number::New(env, receiveBuffer[i].frame.len));
            frameObj.Set("flags", Napi::Number::New(env, receiveBuffer[i].frame.flags));
            frameObj.Set("timestamp", Napi::Number::New(env, receiveBuffer[i].timestamp));

            Napi::Array dataArray = Napi::Array::New(env, 64);
            for (int j = 0; j < 64; j++) {
                dataArray.Set(j, Napi::Number::New(env, receiveBuffer[i].frame.data[j]));
            }
            frameObj.Set("data", dataArray);

            resultArray.Set(i, frameObj);
        }

        return resultArray;
    }

    Napi::Value SetReceiveCallback(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 2) {
            Napi::TypeError::New(env, "Expected channelHandle and callback").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );
        Napi::Function callback = info[1].As<Napi::Function>();

        // 清理已存在的接收线程（如果有）
        CleanupReceiveThread(channelHandle);

        // 创建线程安全函数
        // 这是关键：ThreadSafeFunction 允许在任意线程中安全地调用 JavaScript 函数
        Napi::ThreadSafeFunction tsfn = Napi::ThreadSafeFunction::New(
            env,
            callback,                    // JavaScript 回调函数
            "CAN Receive Callback",      // 资源名称（用于调试）
            0,                           // 最大队列大小（0表示无限）
            1                            // 初始线程数
            // 不需要 finalizer，因为我们在 CleanupReceiveThread 中处理资源清理
        );

        // 创建接收线程上下文
        auto context = std::make_unique<ReceiveThreadContext>(channelHandle, tsfn);

        // 启动接收线程
        context->thread = std::thread(&ZlgCanDevice::ReceiveThreadFunc, context.get());

        // 存储上下文
        {
            std::lock_guard<std::mutex> lock(threadsMutex);
            receiveThreads[channelHandle] = std::move(context);
        }

        return Napi::Boolean::New(env, true);
    }

    Napi::Value ClearReceiveCallback(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (info.Length() < 1) {
            Napi::TypeError::New(env, "Expected channelHandle").ThrowAsJavaScriptException();
            return env.Null();
        }

        CHANNEL_HANDLE channelHandle = reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(info[0].As<Napi::Number>().DoubleValue())
        );

        CleanupReceiveThread(channelHandle);

        return Napi::Boolean::New(env, true);
    }

    // 接收线程函数（在独立线程中运行）
    static void ReceiveThreadFunc(ReceiveThreadContext* context) {
        while (!context->shouldStop.load()) {
            // 尝试接收数据
            ZCAN_Receive_Data receiveBuffer[10];
            UINT receivedCount = ZCAN_Receive(context->channelHandle, receiveBuffer, 10, 0);

            if (receivedCount > 0) {
                // 准备要传递给 JavaScript 的数据
                auto* receiveContext = new ReceiveContext();
                receiveContext->frames.assign(receiveBuffer, receiveBuffer + receivedCount);

                // 使用 ThreadSafeFunction 调用 JavaScript 回调
                // 这是线程安全的！
                auto status = context->tsfn.BlockingCall(receiveContext, 
                    [](Napi::Env env, Napi::Function jsCallback, ReceiveContext* data) {
                        // 这个 lambda 在 Node.js 主线程中执行
                        // 现在可以安全地创建 JavaScript 对象了
                        
                        Napi::Array resultArray = Napi::Array::New(env, data->frames.size());

                        for (size_t i = 0; i < data->frames.size(); i++) {
                            Napi::Object frameObj = Napi::Object::New(env);
                            
                            frameObj.Set("id", Napi::Number::New(env, data->frames[i].frame.can_id));
                            frameObj.Set("dlc", Napi::Number::New(env, data->frames[i].frame.can_dlc));
                            frameObj.Set("timestamp", Napi::Number::New(env, data->frames[i].timestamp));

                            Napi::Array dataArray = Napi::Array::New(env, 8);
                            for (int j = 0; j < 8; j++) {
                                dataArray.Set(j, Napi::Number::New(env, data->frames[i].frame.data[j]));
                            }
                            frameObj.Set("data", dataArray);

                            resultArray.Set(i, frameObj);
                        }

                        // 调用 JavaScript 回调
                        jsCallback.Call({resultArray});

                        // 清理数据
                        delete data;
                    }
                );

                if (status != napi_ok) {
                    // 如果调用失败，清理数据
                    delete receiveContext;
                }
            }

            // 短暂休眠，避免 CPU 占用过高
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }

    // 清理指定通道的接收线程
    void CleanupReceiveThread(CHANNEL_HANDLE channelHandle) {
        std::unique_ptr<ReceiveThreadContext> context;
        
        {
            std::lock_guard<std::mutex> lock(threadsMutex);
            auto it = receiveThreads.find(channelHandle);
            if (it != receiveThreads.end()) {
                context = std::move(it->second);
                receiveThreads.erase(it);
            }
        }

        if (context) {
            // 通知线程停止
            context->shouldStop.store(true);
            
            // 等待线程结束
            if (context->thread.joinable()) {
                context->thread.join();
            }

            // 释放 ThreadSafeFunction
            context->tsfn.Release();
        }
    }

    // 清理所有接收线程
    void CleanupAllReceiveThreads() {
        std::map<CHANNEL_HANDLE, std::unique_ptr<ReceiveThreadContext>> threads;
        
        {
            std::lock_guard<std::mutex> lock(threadsMutex);
            threads = std::move(receiveThreads);
            receiveThreads.clear();
        }

        for (auto& pair : threads) {
            auto& context = pair.second;
            
            // 通知线程停止
            context->shouldStop.store(true);
            
            // 等待线程结束
            if (context->thread.joinable()) {
                context->thread.join();
            }

            // 释放 ThreadSafeFunction
            context->tsfn.Release();
        }
    }
};

Napi::FunctionReference ZlgCanDevice::constructor;

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return ZlgCanDevice::Init(env, exports);
}

NODE_API_MODULE(zlgcan, Init)