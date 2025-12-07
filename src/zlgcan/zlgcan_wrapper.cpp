#include <napi.h>
#include <string>
#include <vector>
#include <cstring>

#include "zlgcan.h"

// 辅助函数：从Napi::Value获取通道句柄（支持BigInt和Number）
inline CHANNEL_HANDLE GetChannelHandleFromValue(Napi::Env env, Napi::Value value) {
    if (value.IsBigInt()) {
        bool lossless = false;
        uint64_t handle = value.As<Napi::BigInt>().Uint64Value(&lossless);
        return reinterpret_cast<CHANNEL_HANDLE>(handle);
    } else if (value.IsNumber()) {
        // 兼容旧代码，但在64位系统上可能丢失精度
        return reinterpret_cast<CHANNEL_HANDLE>(
            static_cast<uintptr_t>(value.As<Napi::Number>().Int64Value()));
    }
    Napi::TypeError::New(env, "channelHandle must be BigInt or Number").ThrowAsJavaScriptException();
    return nullptr;
}

// ZlgCanDevice 类定义
class ZlgCanDevice : public Napi::ObjectWrap<ZlgCanDevice> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    ZlgCanDevice(const Napi::CallbackInfo& info);
    ~ZlgCanDevice();

private:
    // 设备操作
    Napi::Value OpenDevice(const Napi::CallbackInfo& info);
    Napi::Value CloseDevice(const Napi::CallbackInfo& info);
    Napi::Value GetDeviceInfo(const Napi::CallbackInfo& info);
    Napi::Value GetDeviceInfoEx(const Napi::CallbackInfo& info);
    Napi::Value IsDeviceOnLine(const Napi::CallbackInfo& info);

    // CAN通道操作
    Napi::Value InitCanChannel(const Napi::CallbackInfo& info);
    Napi::Value StartCanChannel(const Napi::CallbackInfo& info);
    Napi::Value ResetCanChannel(const Napi::CallbackInfo& info);
    Napi::Value ClearBuffer(const Napi::CallbackInfo& info);
    Napi::Value ReadChannelErrInfo(const Napi::CallbackInfo& info);
    Napi::Value ReadChannelStatus(const Napi::CallbackInfo& info);
    Napi::Value GetReceiveNum(const Napi::CallbackInfo& info);

    // 数据收发
    Napi::Value Transmit(const Napi::CallbackInfo& info);
    Napi::Value Receive(const Napi::CallbackInfo& info);
    Napi::Value TransmitFD(const Napi::CallbackInfo& info);
    Napi::Value ReceiveFD(const Napi::CallbackInfo& info);
    Napi::Value TransmitData(const Napi::CallbackInfo& info);
    Napi::Value ReceiveData(const Napi::CallbackInfo& info);

    // 属性操作
    Napi::Value SetValue(const Napi::CallbackInfo& info);
    Napi::Value GetValue(const Napi::CallbackInfo& info);

    // IProperty接口
    Napi::Value GetIProperty(const Napi::CallbackInfo& info);
    Napi::Value SetPropertyValue(const Napi::CallbackInfo& info);
    Napi::Value GetPropertyValue(const Napi::CallbackInfo& info);
    Napi::Value ReleaseIProperty(const Napi::CallbackInfo& info);

    DEVICE_HANDLE deviceHandle_;
    IProperty* pProperty_;
};

// 类初始化
Napi::Object ZlgCanDevice::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "ZlgCanDevice", {
        // 设备操作
        InstanceMethod("openDevice", &ZlgCanDevice::OpenDevice),
        InstanceMethod("closeDevice", &ZlgCanDevice::CloseDevice),
        InstanceMethod("getDeviceInfo", &ZlgCanDevice::GetDeviceInfo),
        InstanceMethod("getDeviceInfoEx", &ZlgCanDevice::GetDeviceInfoEx),
        InstanceMethod("isDeviceOnLine", &ZlgCanDevice::IsDeviceOnLine),

        // CAN通道操作
        InstanceMethod("initCanChannel", &ZlgCanDevice::InitCanChannel),
        InstanceMethod("startCanChannel", &ZlgCanDevice::StartCanChannel),
        InstanceMethod("resetCanChannel", &ZlgCanDevice::ResetCanChannel),
        InstanceMethod("clearBuffer", &ZlgCanDevice::ClearBuffer),
        InstanceMethod("readChannelErrInfo", &ZlgCanDevice::ReadChannelErrInfo),
        InstanceMethod("readChannelStatus", &ZlgCanDevice::ReadChannelStatus),
        InstanceMethod("getReceiveNum", &ZlgCanDevice::GetReceiveNum),

        // 数据收发
        InstanceMethod("transmit", &ZlgCanDevice::Transmit),
        InstanceMethod("receive", &ZlgCanDevice::Receive),
        InstanceMethod("transmitFD", &ZlgCanDevice::TransmitFD),
        InstanceMethod("receiveFD", &ZlgCanDevice::ReceiveFD),
        InstanceMethod("transmitData", &ZlgCanDevice::TransmitData),
        InstanceMethod("receiveData", &ZlgCanDevice::ReceiveData),

        // 属性操作
        InstanceMethod("setValue", &ZlgCanDevice::SetValue),
        InstanceMethod("getValue", &ZlgCanDevice::GetValue),

        // IProperty接口
        InstanceMethod("getIProperty", &ZlgCanDevice::GetIProperty),
        InstanceMethod("setPropertyValue", &ZlgCanDevice::SetPropertyValue),
        InstanceMethod("getPropertyValue", &ZlgCanDevice::GetPropertyValue),
        InstanceMethod("releaseIProperty", &ZlgCanDevice::ReleaseIProperty),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("ZlgCanDevice", func);
    return exports;
}

ZlgCanDevice::ZlgCanDevice(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<ZlgCanDevice>(info), deviceHandle_(INVALID_DEVICE_HANDLE), pProperty_(nullptr) {
}

ZlgCanDevice::~ZlgCanDevice() {
    if (pProperty_ != nullptr) {
        ::ReleaseIProperty(pProperty_);
        pProperty_ = nullptr;
    }
    if (deviceHandle_ != INVALID_DEVICE_HANDLE) {
        ZCAN_CloseDevice(deviceHandle_);
        deviceHandle_ = INVALID_DEVICE_HANDLE;
    }
}

// ==================== 设备操作 ====================

Napi::Value ZlgCanDevice::OpenDevice(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要至少2个参数: deviceType, deviceIndex").ThrowAsJavaScriptException();
        return env.Null();
    }

    UINT deviceType = info[0].As<Napi::Number>().Uint32Value();
    UINT deviceIndex = info[1].As<Napi::Number>().Uint32Value();
    UINT reserved = info.Length() > 2 ? info[2].As<Napi::Number>().Uint32Value() : 0;

    deviceHandle_ = ZCAN_OpenDevice(deviceType, deviceIndex, reserved);

    return Napi::Boolean::New(env, deviceHandle_ != INVALID_DEVICE_HANDLE);
}

Napi::Value ZlgCanDevice::CloseDevice(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (pProperty_ != nullptr) {
        ::ReleaseIProperty(pProperty_);
        pProperty_ = nullptr;
    }

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        return Napi::Boolean::New(env, false);
    }

    UINT result = ZCAN_CloseDevice(deviceHandle_);
    deviceHandle_ = INVALID_DEVICE_HANDLE;

    return Napi::Boolean::New(env, result == STATUS_OK);
}

Napi::Value ZlgCanDevice::GetDeviceInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    ZCAN_DEVICE_INFO deviceInfo;
    memset(&deviceInfo, 0, sizeof(deviceInfo));

    UINT result = ZCAN_GetDeviceInf(deviceHandle_, &deviceInfo);
    if (result != STATUS_OK) {
        return env.Null();
    }

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("hardwareVersion", Napi::Number::New(env, deviceInfo.hw_Version));
    obj.Set("firmwareVersion", Napi::Number::New(env, deviceInfo.fw_Version));
    obj.Set("driverVersion", Napi::Number::New(env, deviceInfo.dr_Version));
    obj.Set("libraryVersion", Napi::Number::New(env, deviceInfo.in_Version));
    obj.Set("irqNumber", Napi::Number::New(env, deviceInfo.irq_Num));
    obj.Set("canNumber", Napi::Number::New(env, deviceInfo.can_Num));
    obj.Set("serialNumber", Napi::String::New(env, reinterpret_cast<const char*>(deviceInfo.str_Serial_Num)));
    obj.Set("hardwareType", Napi::String::New(env, reinterpret_cast<const char*>(deviceInfo.str_hw_Type)));

    return obj;
}

Napi::Value ZlgCanDevice::GetDeviceInfoEx(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    ZCAN_DEVICE_INFO_EX deviceInfoEx;
    memset(&deviceInfoEx, 0, sizeof(deviceInfoEx));

    UINT result = ZCAN_GetDeviceInfoEx(deviceHandle_, &deviceInfoEx);
    if (result != STATUS_OK) {
        return env.Null();
    }

    Napi::Object obj = Napi::Object::New(env);

    // 硬件版本
    Napi::Object hwVer = Napi::Object::New(env);
    hwVer.Set("major", Napi::Number::New(env, deviceInfoEx.hardware_version.major_version));
    hwVer.Set("minor", Napi::Number::New(env, deviceInfoEx.hardware_version.minor_version));
    hwVer.Set("patch", Napi::Number::New(env, deviceInfoEx.hardware_version.patch_version));
    obj.Set("hardwareVersion", hwVer);

    // 固件版本
    Napi::Object fwVer = Napi::Object::New(env);
    fwVer.Set("major", Napi::Number::New(env, deviceInfoEx.firmware_version.major_version));
    fwVer.Set("minor", Napi::Number::New(env, deviceInfoEx.firmware_version.minor_version));
    fwVer.Set("patch", Napi::Number::New(env, deviceInfoEx.firmware_version.patch_version));
    obj.Set("firmwareVersion", fwVer);

    // 驱动版本
    Napi::Object drVer = Napi::Object::New(env);
    drVer.Set("major", Napi::Number::New(env, deviceInfoEx.driver_version.major_version));
    drVer.Set("minor", Napi::Number::New(env, deviceInfoEx.driver_version.minor_version));
    drVer.Set("patch", Napi::Number::New(env, deviceInfoEx.driver_version.patch_version));
    obj.Set("driverVersion", drVer);

    // 库版本
    Napi::Object libVer = Napi::Object::New(env);
    libVer.Set("major", Napi::Number::New(env, deviceInfoEx.library_version.major_version));
    libVer.Set("minor", Napi::Number::New(env, deviceInfoEx.library_version.minor_version));
    libVer.Set("patch", Napi::Number::New(env, deviceInfoEx.library_version.patch_version));
    obj.Set("libraryVersion", libVer);

    obj.Set("deviceName", Napi::String::New(env, reinterpret_cast<const char*>(deviceInfoEx.device_name)));
    obj.Set("hardwareType", Napi::String::New(env, reinterpret_cast<const char*>(deviceInfoEx.hardware_type)));
    obj.Set("serialNumber", Napi::String::New(env, reinterpret_cast<const char*>(deviceInfoEx.serial_number)));
    obj.Set("canChannelNumber", Napi::Number::New(env, deviceInfoEx.can_channel_number));
    obj.Set("linChannelNumber", Napi::Number::New(env, deviceInfoEx.lin_channel_number));

    return obj;
}

Napi::Value ZlgCanDevice::IsDeviceOnLine(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        return Napi::Boolean::New(env, false);
    }

    UINT result = ZCAN_IsDeviceOnLine(deviceHandle_);
    return Napi::Boolean::New(env, result == STATUS_ONLINE);
}

// ==================== CAN通道操作 ====================

Napi::Value ZlgCanDevice::InitCanChannel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要2个参数: channelIndex, config").ThrowAsJavaScriptException();
        return env.Null();
    }

    UINT channelIndex = info[0].As<Napi::Number>().Uint32Value();
    Napi::Object config = info[1].As<Napi::Object>();

    ZCAN_CHANNEL_INIT_CONFIG initConfig;
    memset(&initConfig, 0, sizeof(initConfig));

    initConfig.can_type = config.Get("canType").As<Napi::Number>().Uint32Value();

    if (initConfig.can_type == TYPE_CAN) {
        // CAN模式
        initConfig.can.acc_code = config.Has("accCode") ?
            config.Get("accCode").As<Napi::Number>().Uint32Value() : 0;
        initConfig.can.acc_mask = config.Has("accMask") ?
            config.Get("accMask").As<Napi::Number>().Uint32Value() : 0xFFFFFFFF;
        initConfig.can.reserved = config.Has("reserved") ?
            config.Get("reserved").As<Napi::Number>().Uint32Value() : 0;
        initConfig.can.filter = config.Has("filter") ?
            static_cast<BYTE>(config.Get("filter").As<Napi::Number>().Uint32Value()) : 0;
        initConfig.can.timing0 = config.Has("timing0") ?
            static_cast<BYTE>(config.Get("timing0").As<Napi::Number>().Uint32Value()) : 0;
        initConfig.can.timing1 = config.Has("timing1") ?
            static_cast<BYTE>(config.Get("timing1").As<Napi::Number>().Uint32Value()) : 0x1C;
        initConfig.can.mode = config.Has("mode") ?
            static_cast<BYTE>(config.Get("mode").As<Napi::Number>().Uint32Value()) : 0;
    } else {
        // CANFD模式
        initConfig.canfd.acc_code = config.Has("accCode") ?
            config.Get("accCode").As<Napi::Number>().Uint32Value() : 0;
        initConfig.canfd.acc_mask = config.Has("accMask") ?
            config.Get("accMask").As<Napi::Number>().Uint32Value() : 0xFFFFFFFF;
        initConfig.canfd.abit_timing = config.Has("abitTiming") ?
            config.Get("abitTiming").As<Napi::Number>().Uint32Value() : 0;
        initConfig.canfd.dbit_timing = config.Has("dbitTiming") ?
            config.Get("dbitTiming").As<Napi::Number>().Uint32Value() : 0;
        initConfig.canfd.brp = config.Has("brp") ?
            config.Get("brp").As<Napi::Number>().Uint32Value() : 0;
        initConfig.canfd.filter = config.Has("filter") ?
            static_cast<BYTE>(config.Get("filter").As<Napi::Number>().Uint32Value()) : 0;
        initConfig.canfd.mode = config.Has("mode") ?
            static_cast<BYTE>(config.Get("mode").As<Napi::Number>().Uint32Value()) : 0;
        initConfig.canfd.pad = config.Has("pad") ?
            static_cast<USHORT>(config.Get("pad").As<Napi::Number>().Uint32Value()) : 0;
        initConfig.canfd.reserved = config.Has("reserved") ?
            config.Get("reserved").As<Napi::Number>().Uint32Value() : 0;
    }

    CHANNEL_HANDLE channelHandle = ZCAN_InitCAN(deviceHandle_, channelIndex, &initConfig);

    // 返回通道句柄(使用BigInt确保64位指针精度)
    return Napi::BigInt::New(env, reinterpret_cast<uint64_t>(channelHandle));
}

Napi::Value ZlgCanDevice::StartCanChannel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: channelHandle").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    UINT result = ZCAN_StartCAN(channelHandle);
    return Napi::Boolean::New(env, result == STATUS_OK);
}

Napi::Value ZlgCanDevice::ResetCanChannel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: channelHandle").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    UINT result = ZCAN_ResetCAN(channelHandle);
    return Napi::Boolean::New(env, result == STATUS_OK);
}

Napi::Value ZlgCanDevice::ClearBuffer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: channelHandle").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    UINT result = ZCAN_ClearBuffer(channelHandle);
    return Napi::Boolean::New(env, result == STATUS_OK);
}

Napi::Value ZlgCanDevice::ReadChannelErrInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: channelHandle").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    ZCAN_CHANNEL_ERR_INFO errInfo;
    memset(&errInfo, 0, sizeof(errInfo));

    UINT result = ZCAN_ReadChannelErrInfo(channelHandle, &errInfo);
    if (result != STATUS_OK) {
        return env.Null();
    }

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("errorCode", Napi::Number::New(env, errInfo.error_code));

    Napi::Array passiveErrData = Napi::Array::New(env, 3);
    for (int i = 0; i < 3; i++) {
        passiveErrData[i] = Napi::Number::New(env, errInfo.passive_ErrData[i]);
    }
    obj.Set("passiveErrData", passiveErrData);
    obj.Set("arLostErrData", Napi::Number::New(env, errInfo.arLost_ErrData));

    return obj;
}

Napi::Value ZlgCanDevice::ReadChannelStatus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: channelHandle").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    ZCAN_CHANNEL_STATUS status;
    memset(&status, 0, sizeof(status));

    UINT result = ZCAN_ReadChannelStatus(channelHandle, &status);
    if (result != STATUS_OK) {
        return env.Null();
    }

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("errInterrupt", Napi::Number::New(env, status.errInterrupt));
    obj.Set("regMode", Napi::Number::New(env, status.regMode));
    obj.Set("regStatus", Napi::Number::New(env, status.regStatus));
    obj.Set("regALCapture", Napi::Number::New(env, status.regALCapture));
    obj.Set("regECCapture", Napi::Number::New(env, status.regECCapture));
    obj.Set("regEWLimit", Napi::Number::New(env, status.regEWLimit));
    obj.Set("regRECounter", Napi::Number::New(env, status.regRECounter));
    obj.Set("regTECounter", Napi::Number::New(env, status.regTECounter));

    return obj;
}

Napi::Value ZlgCanDevice::GetReceiveNum(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要至少1个参数: channelHandle").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    BYTE type = info.Length() > 1 ?
        static_cast<BYTE>(info[1].As<Napi::Number>().Uint32Value()) : TYPE_CAN;

    UINT count = ZCAN_GetReceiveNum(channelHandle, type);
    return Napi::Number::New(env, count);
}

// ==================== 数据收发 ====================

Napi::Value ZlgCanDevice::Transmit(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要2个参数: channelHandle, frame/frames").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    std::vector<ZCAN_Transmit_Data> frames;

    if (info[1].IsArray()) {
        Napi::Array arr = info[1].As<Napi::Array>();
        frames.resize(arr.Length());
        for (uint32_t i = 0; i < arr.Length(); i++) {
            Napi::Object frameObj = arr.Get(i).As<Napi::Object>();

            memset(&frames[i], 0, sizeof(ZCAN_Transmit_Data));
            frames[i].frame.can_id = frameObj.Get("id").As<Napi::Number>().Uint32Value();
            frames[i].frame.can_dlc = static_cast<BYTE>(frameObj.Get("dlc").As<Napi::Number>().Uint32Value());
            frames[i].transmit_type = frameObj.Has("transmitType") ?
                frameObj.Get("transmitType").As<Napi::Number>().Uint32Value() : 0;

            if (frameObj.Has("data")) {
                Napi::Array dataArr = frameObj.Get("data").As<Napi::Array>();
                for (uint32_t j = 0; j < dataArr.Length() && j < CAN_MAX_DLEN; j++) {
                    frames[i].frame.data[j] = static_cast<BYTE>(dataArr.Get(j).As<Napi::Number>().Uint32Value());
                }
            }
        }
    } else {
        frames.resize(1);
        Napi::Object frameObj = info[1].As<Napi::Object>();

        memset(&frames[0], 0, sizeof(ZCAN_Transmit_Data));
        frames[0].frame.can_id = frameObj.Get("id").As<Napi::Number>().Uint32Value();
        frames[0].frame.can_dlc = static_cast<BYTE>(frameObj.Get("dlc").As<Napi::Number>().Uint32Value());
        frames[0].transmit_type = frameObj.Has("transmitType") ?
            frameObj.Get("transmitType").As<Napi::Number>().Uint32Value() : 0;

        if (frameObj.Has("data")) {
            Napi::Array dataArr = frameObj.Get("data").As<Napi::Array>();
            for (uint32_t j = 0; j < dataArr.Length() && j < CAN_MAX_DLEN; j++) {
                frames[0].frame.data[j] = static_cast<BYTE>(dataArr.Get(j).As<Napi::Number>().Uint32Value());
            }
        }
    }

    UINT sentCount = ZCAN_Transmit(channelHandle, frames.data(), static_cast<UINT>(frames.size()));
    return Napi::Number::New(env, sentCount);
}

Napi::Value ZlgCanDevice::Receive(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要至少2个参数: channelHandle, count").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    UINT count = info[1].As<Napi::Number>().Uint32Value();
    int waitTime = info.Length() > 2 ? info[2].As<Napi::Number>().Int32Value() : -1;

    std::vector<ZCAN_Receive_Data> frames(count);
    UINT receivedCount = ZCAN_Receive(channelHandle, frames.data(), count, waitTime);

    Napi::Array result = Napi::Array::New(env, receivedCount);
    for (UINT i = 0; i < receivedCount; i++) {
        Napi::Object frameObj = Napi::Object::New(env);
        frameObj.Set("id", Napi::Number::New(env, frames[i].frame.can_id));
        frameObj.Set("dlc", Napi::Number::New(env, frames[i].frame.can_dlc));
        frameObj.Set("timestamp", Napi::Number::New(env, static_cast<double>(frames[i].timestamp)));

        Napi::Array dataArr = Napi::Array::New(env, frames[i].frame.can_dlc);
        for (BYTE j = 0; j < frames[i].frame.can_dlc; j++) {
            dataArr[j] = Napi::Number::New(env, frames[i].frame.data[j]);
        }
        frameObj.Set("data", dataArr);

        result[i] = frameObj;
    }

    return result;
}

Napi::Value ZlgCanDevice::TransmitFD(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要2个参数: channelHandle, frame/frames").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    std::vector<ZCAN_TransmitFD_Data> frames;

    if (info[1].IsArray()) {
        Napi::Array arr = info[1].As<Napi::Array>();
        frames.resize(arr.Length());
        for (uint32_t i = 0; i < arr.Length(); i++) {
            Napi::Object frameObj = arr.Get(i).As<Napi::Object>();

            memset(&frames[i], 0, sizeof(ZCAN_TransmitFD_Data));
            frames[i].frame.can_id = frameObj.Get("id").As<Napi::Number>().Uint32Value();
            frames[i].frame.len = static_cast<BYTE>(frameObj.Get("len").As<Napi::Number>().Uint32Value());
            frames[i].frame.flags = frameObj.Has("flags") ?
                static_cast<BYTE>(frameObj.Get("flags").As<Napi::Number>().Uint32Value()) : 0;
            frames[i].transmit_type = frameObj.Has("transmitType") ?
                frameObj.Get("transmitType").As<Napi::Number>().Uint32Value() : 0;

            if (frameObj.Has("data")) {
                Napi::Array dataArr = frameObj.Get("data").As<Napi::Array>();
                for (uint32_t j = 0; j < dataArr.Length() && j < CANFD_MAX_DLEN; j++) {
                    frames[i].frame.data[j] = static_cast<BYTE>(dataArr.Get(j).As<Napi::Number>().Uint32Value());
                }
            }
        }
    } else {
        frames.resize(1);
        Napi::Object frameObj = info[1].As<Napi::Object>();

        memset(&frames[0], 0, sizeof(ZCAN_TransmitFD_Data));
        frames[0].frame.can_id = frameObj.Get("id").As<Napi::Number>().Uint32Value();
        frames[0].frame.len = static_cast<BYTE>(frameObj.Get("len").As<Napi::Number>().Uint32Value());
        frames[0].frame.flags = frameObj.Has("flags") ?
            static_cast<BYTE>(frameObj.Get("flags").As<Napi::Number>().Uint32Value()) : 0;
        frames[0].transmit_type = frameObj.Has("transmitType") ?
            frameObj.Get("transmitType").As<Napi::Number>().Uint32Value() : 0;

        if (frameObj.Has("data")) {
            Napi::Array dataArr = frameObj.Get("data").As<Napi::Array>();
            for (uint32_t j = 0; j < dataArr.Length() && j < CANFD_MAX_DLEN; j++) {
                frames[0].frame.data[j] = static_cast<BYTE>(dataArr.Get(j).As<Napi::Number>().Uint32Value());
            }
        }
    }

    UINT sentCount = ZCAN_TransmitFD(channelHandle, frames.data(), static_cast<UINT>(frames.size()));
    return Napi::Number::New(env, sentCount);
}

Napi::Value ZlgCanDevice::ReceiveFD(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要至少2个参数: channelHandle, count").ThrowAsJavaScriptException();
        return env.Null();
    }

    CHANNEL_HANDLE channelHandle = GetChannelHandleFromValue(env, info[0]);
    if (env.IsExceptionPending()) return env.Null();

    UINT count = info[1].As<Napi::Number>().Uint32Value();
    int waitTime = info.Length() > 2 ? info[2].As<Napi::Number>().Int32Value() : -1;

    std::vector<ZCAN_ReceiveFD_Data> frames(count);
    UINT receivedCount = ZCAN_ReceiveFD(channelHandle, frames.data(), count, waitTime);

    Napi::Array result = Napi::Array::New(env, receivedCount);
    for (UINT i = 0; i < receivedCount; i++) {
        Napi::Object frameObj = Napi::Object::New(env);
        frameObj.Set("id", Napi::Number::New(env, frames[i].frame.can_id));
        frameObj.Set("len", Napi::Number::New(env, frames[i].frame.len));
        frameObj.Set("flags", Napi::Number::New(env, frames[i].frame.flags));
        frameObj.Set("timestamp", Napi::Number::New(env, static_cast<double>(frames[i].timestamp)));

        Napi::Array dataArr = Napi::Array::New(env, frames[i].frame.len);
        for (BYTE j = 0; j < frames[i].frame.len; j++) {
            dataArr[j] = Napi::Number::New(env, frames[i].frame.data[j]);
        }
        frameObj.Set("data", dataArr);

        result[i] = frameObj;
    }

    return result;
}

Napi::Value ZlgCanDevice::TransmitData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: dataObj/dataObjs").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::vector<ZCANDataObj> dataObjs;

    if (info[0].IsArray()) {
        Napi::Array arr = info[0].As<Napi::Array>();
        dataObjs.resize(arr.Length());
        for (uint32_t i = 0; i < arr.Length(); i++) {
            Napi::Object obj = arr.Get(i).As<Napi::Object>();
            memset(&dataObjs[i], 0, sizeof(ZCANDataObj));

            dataObjs[i].dataType = static_cast<BYTE>(obj.Get("dataType").As<Napi::Number>().Uint32Value());
            dataObjs[i].chnl = static_cast<BYTE>(obj.Get("chnl").As<Napi::Number>().Uint32Value());

            if (dataObjs[i].dataType == ZCAN_DT_ZCAN_CAN_CANFD_DATA && obj.Has("canfdData")) {
                Napi::Object canfdData = obj.Get("canfdData").As<Napi::Object>();
                dataObjs[i].data.zcanCANFDData.timeStamp = static_cast<UINT64>(
                    canfdData.Get("timestamp").As<Napi::Number>().Int64Value());
                dataObjs[i].data.zcanCANFDData.flag.rawVal = canfdData.Has("flag") ?
                    canfdData.Get("flag").As<Napi::Number>().Uint32Value() : 0;
                dataObjs[i].data.zcanCANFDData.frame.can_id =
                    canfdData.Get("id").As<Napi::Number>().Uint32Value();
                dataObjs[i].data.zcanCANFDData.frame.len = static_cast<BYTE>(
                    canfdData.Get("len").As<Napi::Number>().Uint32Value());
                dataObjs[i].data.zcanCANFDData.frame.flags = canfdData.Has("flags") ?
                    static_cast<BYTE>(canfdData.Get("flags").As<Napi::Number>().Uint32Value()) : 0;

                if (canfdData.Has("data")) {
                    Napi::Array dataArr = canfdData.Get("data").As<Napi::Array>();
                    for (uint32_t j = 0; j < dataArr.Length() && j < CANFD_MAX_DLEN; j++) {
                        dataObjs[i].data.zcanCANFDData.frame.data[j] =
                            static_cast<BYTE>(dataArr.Get(j).As<Napi::Number>().Uint32Value());
                    }
                }
            }
        }
    } else {
        dataObjs.resize(1);
        Napi::Object obj = info[0].As<Napi::Object>();
        memset(&dataObjs[0], 0, sizeof(ZCANDataObj));

        dataObjs[0].dataType = static_cast<BYTE>(obj.Get("dataType").As<Napi::Number>().Uint32Value());
        dataObjs[0].chnl = static_cast<BYTE>(obj.Get("chnl").As<Napi::Number>().Uint32Value());

        if (dataObjs[0].dataType == ZCAN_DT_ZCAN_CAN_CANFD_DATA && obj.Has("canfdData")) {
            Napi::Object canfdData = obj.Get("canfdData").As<Napi::Object>();
            dataObjs[0].data.zcanCANFDData.timeStamp = static_cast<UINT64>(
                canfdData.Get("timestamp").As<Napi::Number>().Int64Value());
            dataObjs[0].data.zcanCANFDData.flag.rawVal = canfdData.Has("flag") ?
                canfdData.Get("flag").As<Napi::Number>().Uint32Value() : 0;
            dataObjs[0].data.zcanCANFDData.frame.can_id =
                canfdData.Get("id").As<Napi::Number>().Uint32Value();
            dataObjs[0].data.zcanCANFDData.frame.len = static_cast<BYTE>(
                canfdData.Get("len").As<Napi::Number>().Uint32Value());
            dataObjs[0].data.zcanCANFDData.frame.flags = canfdData.Has("flags") ?
                static_cast<BYTE>(canfdData.Get("flags").As<Napi::Number>().Uint32Value()) : 0;

            if (canfdData.Has("data")) {
                Napi::Array dataArr = canfdData.Get("data").As<Napi::Array>();
                for (uint32_t j = 0; j < dataArr.Length() && j < CANFD_MAX_DLEN; j++) {
                    dataObjs[0].data.zcanCANFDData.frame.data[j] =
                        static_cast<BYTE>(dataArr.Get(j).As<Napi::Number>().Uint32Value());
                }
            }
        }
    }

    UINT sentCount = ZCAN_TransmitData(deviceHandle_, dataObjs.data(), static_cast<UINT>(dataObjs.size()));
    return Napi::Number::New(env, sentCount);
}

Napi::Value ZlgCanDevice::ReceiveData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要至少1个参数: count").ThrowAsJavaScriptException();
        return env.Null();
    }

    UINT count = info[0].As<Napi::Number>().Uint32Value();
    int waitTime = info.Length() > 1 ? info[1].As<Napi::Number>().Int32Value() : -1;

    std::vector<ZCANDataObj> dataObjs(count);
    UINT receivedCount = ZCAN_ReceiveData(deviceHandle_, dataObjs.data(), count, waitTime);

    Napi::Array result = Napi::Array::New(env, receivedCount);
    for (UINT i = 0; i < receivedCount; i++) {
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("dataType", Napi::Number::New(env, dataObjs[i].dataType));
        obj.Set("chnl", Napi::Number::New(env, dataObjs[i].chnl));

        if (dataObjs[i].dataType == ZCAN_DT_ZCAN_CAN_CANFD_DATA) {
            Napi::Object canfdData = Napi::Object::New(env);
            canfdData.Set("timestamp", Napi::Number::New(env,
                static_cast<double>(dataObjs[i].data.zcanCANFDData.timeStamp)));
            canfdData.Set("flag", Napi::Number::New(env, dataObjs[i].data.zcanCANFDData.flag.rawVal));
            canfdData.Set("id", Napi::Number::New(env, dataObjs[i].data.zcanCANFDData.frame.can_id));
            canfdData.Set("len", Napi::Number::New(env, dataObjs[i].data.zcanCANFDData.frame.len));
            canfdData.Set("flags", Napi::Number::New(env, dataObjs[i].data.zcanCANFDData.frame.flags));

            Napi::Array dataArr = Napi::Array::New(env, dataObjs[i].data.zcanCANFDData.frame.len);
            for (BYTE j = 0; j < dataObjs[i].data.zcanCANFDData.frame.len; j++) {
                dataArr[j] = Napi::Number::New(env, dataObjs[i].data.zcanCANFDData.frame.data[j]);
            }
            canfdData.Set("data", dataArr);
            obj.Set("canfdData", canfdData);
        } else if (dataObjs[i].dataType == ZCAN_DT_ZCAN_ERROR_DATA) {
            Napi::Object errData = Napi::Object::New(env);
            errData.Set("timestamp", Napi::Number::New(env,
                static_cast<double>(dataObjs[i].data.zcanErrData.timeStamp)));
            errData.Set("errType", Napi::Number::New(env, dataObjs[i].data.zcanErrData.errType));
            errData.Set("errSubType", Napi::Number::New(env, dataObjs[i].data.zcanErrData.errSubType));
            errData.Set("nodeState", Napi::Number::New(env, dataObjs[i].data.zcanErrData.nodeState));
            errData.Set("rxErrCount", Napi::Number::New(env, dataObjs[i].data.zcanErrData.rxErrCount));
            errData.Set("txErrCount", Napi::Number::New(env, dataObjs[i].data.zcanErrData.txErrCount));
            errData.Set("errData", Napi::Number::New(env, dataObjs[i].data.zcanErrData.errData));
            obj.Set("errData", errData);
        } else if (dataObjs[i].dataType == ZCAN_DT_ZCAN_BUSUSAGE_DATA) {
            Napi::Object busUsage = Napi::Object::New(env);
            busUsage.Set("timestampBegin", Napi::Number::New(env,
                static_cast<double>(dataObjs[i].data.busUsage.nTimeStampBegin)));
            busUsage.Set("timestampEnd", Napi::Number::New(env,
                static_cast<double>(dataObjs[i].data.busUsage.nTimeStampEnd)));
            busUsage.Set("chnl", Napi::Number::New(env, dataObjs[i].data.busUsage.nChnl));
            busUsage.Set("busUsage", Napi::Number::New(env, dataObjs[i].data.busUsage.nBusUsage));
            busUsage.Set("frameCount", Napi::Number::New(env, dataObjs[i].data.busUsage.nFrameCount));
            obj.Set("busUsage", busUsage);
        }

        result[i] = obj;
    }

    return result;
}

// ==================== 属性操作 ====================

Napi::Value ZlgCanDevice::SetValue(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要2个参数: path, value").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();
    std::string value = info[1].As<Napi::String>().Utf8Value();

    UINT result = ZCAN_SetValue(deviceHandle_, path.c_str(), value.c_str());
    return Napi::Number::New(env, result);
}

Napi::Value ZlgCanDevice::GetValue(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: path").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();

    const void* result = ZCAN_GetValue(deviceHandle_, path.c_str());
    if (result == nullptr) {
        return env.Null();
    }

    return Napi::String::New(env, static_cast<const char*>(result));
}

// ==================== IProperty接口 ====================

Napi::Value ZlgCanDevice::GetIProperty(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (deviceHandle_ == INVALID_DEVICE_HANDLE) {
        Napi::Error::New(env, "设备未打开").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (pProperty_ != nullptr) {
        ::ReleaseIProperty(pProperty_);
    }

    pProperty_ = ::GetIProperty(deviceHandle_);
    return Napi::Boolean::New(env, pProperty_ != nullptr);
}

Napi::Value ZlgCanDevice::SetPropertyValue(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (pProperty_ == nullptr) {
        Napi::Error::New(env, "IProperty未初始化").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "需要2个参数: path, value").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();
    std::string value = info[1].As<Napi::String>().Utf8Value();

    int result = pProperty_->SetValue(path.c_str(), value.c_str());
    return Napi::Number::New(env, result);
}

Napi::Value ZlgCanDevice::GetPropertyValue(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (pProperty_ == nullptr) {
        Napi::Error::New(env, "IProperty未初始化").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "需要1个参数: path").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();

    const char* result = pProperty_->GetValue(path.c_str());
    if (result == nullptr) {
        return env.Null();
    }

    return Napi::String::New(env, result);
}

Napi::Value ZlgCanDevice::ReleaseIProperty(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (pProperty_ == nullptr) {
        return Napi::Boolean::New(env, false);
    }

    UINT result = ::ReleaseIProperty(pProperty_);
    pProperty_ = nullptr;

    return Napi::Boolean::New(env, result == STATUS_OK);
}

// 模块初始化
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // 导出常量
    // 设备类型
    exports.Set("ZCAN_PCI5121", Napi::Number::New(env, ZCAN_PCI5121));
    exports.Set("ZCAN_PCI9810", Napi::Number::New(env, ZCAN_PCI9810));
    exports.Set("ZCAN_USBCAN1", Napi::Number::New(env, ZCAN_USBCAN1));
    exports.Set("ZCAN_USBCAN2", Napi::Number::New(env, ZCAN_USBCAN2));
    exports.Set("ZCAN_USBCAN_E_U", Napi::Number::New(env, ZCAN_USBCAN_E_U));
    exports.Set("ZCAN_USBCAN_2E_U", Napi::Number::New(env, ZCAN_USBCAN_2E_U));
    exports.Set("ZCAN_USBCAN_4E_U", Napi::Number::New(env, ZCAN_USBCAN_4E_U));
    exports.Set("ZCAN_USBCAN_8E_U", Napi::Number::New(env, ZCAN_USBCAN_8E_U));
    exports.Set("ZCAN_USBCANFD_200U", Napi::Number::New(env, ZCAN_USBCANFD_200U));
    exports.Set("ZCAN_USBCANFD_100U", Napi::Number::New(env, ZCAN_USBCANFD_100U));
    exports.Set("ZCAN_USBCANFD_MINI", Napi::Number::New(env, ZCAN_USBCANFD_MINI));
    exports.Set("ZCAN_USBCANFD_800U", Napi::Number::New(env, ZCAN_USBCANFD_800U));
    exports.Set("ZCAN_USBCANFD_400U", Napi::Number::New(env, ZCAN_USBCANFD_400U));
    exports.Set("ZCAN_PCIE_CANFD_100U", Napi::Number::New(env, ZCAN_PCIE_CANFD_100U));
    exports.Set("ZCAN_PCIE_CANFD_200U", Napi::Number::New(env, ZCAN_PCIE_CANFD_200U));
    exports.Set("ZCAN_PCIE_CANFD_400U", Napi::Number::New(env, ZCAN_PCIE_CANFD_400U));
    exports.Set("ZCAN_CANDTU_200UR", Napi::Number::New(env, ZCAN_CANDTU_200UR));
    exports.Set("ZCAN_CANDTU_MINI", Napi::Number::New(env, ZCAN_CANDTU_MINI));
    exports.Set("ZCAN_CANDTU_NET", Napi::Number::New(env, ZCAN_CANDTU_NET));
    exports.Set("ZCAN_CANDTU_100UR", Napi::Number::New(env, ZCAN_CANDTU_100UR));
    exports.Set("ZCAN_CANFDNET_TCP", Napi::Number::New(env, ZCAN_CANFDNET_TCP));
    exports.Set("ZCAN_CANFDNET_UDP", Napi::Number::New(env, ZCAN_CANFDNET_UDP));
    exports.Set("ZCAN_CANFDWIFI_TCP", Napi::Number::New(env, ZCAN_CANFDWIFI_TCP));
    exports.Set("ZCAN_CANFDWIFI_UDP", Napi::Number::New(env, ZCAN_CANFDWIFI_UDP));
    exports.Set("ZCAN_VIRTUAL_DEVICE", Napi::Number::New(env, ZCAN_VIRTUAL_DEVICE));
    exports.Set("ZCAN_OFFLINE_DEVICE", Napi::Number::New(env, ZCAN_OFFLINE_DEVICE));

    // CAN类型
    exports.Set("TYPE_CAN", Napi::Number::New(env, TYPE_CAN));
    exports.Set("TYPE_CANFD", Napi::Number::New(env, TYPE_CANFD));
    exports.Set("TYPE_ALL_DATA", Napi::Number::New(env, TYPE_ALL_DATA));

    // 数据类型
    exports.Set("ZCAN_DT_ZCAN_CAN_CANFD_DATA", Napi::Number::New(env, ZCAN_DT_ZCAN_CAN_CANFD_DATA));
    exports.Set("ZCAN_DT_ZCAN_ERROR_DATA", Napi::Number::New(env, ZCAN_DT_ZCAN_ERROR_DATA));
    exports.Set("ZCAN_DT_ZCAN_GPS_DATA", Napi::Number::New(env, ZCAN_DT_ZCAN_GPS_DATA));
    exports.Set("ZCAN_DT_ZCAN_LIN_DATA", Napi::Number::New(env, ZCAN_DT_ZCAN_LIN_DATA));
    exports.Set("ZCAN_DT_ZCAN_BUSUSAGE_DATA", Napi::Number::New(env, ZCAN_DT_ZCAN_BUSUSAGE_DATA));

    // CAN标志
    exports.Set("CAN_EFF_FLAG", Napi::Number::New(env, CAN_EFF_FLAG));
    exports.Set("CAN_RTR_FLAG", Napi::Number::New(env, CAN_RTR_FLAG));
    exports.Set("CAN_ERR_FLAG", Napi::Number::New(env, CAN_ERR_FLAG));

    // CANFD标志
    exports.Set("CANFD_BRS", Napi::Number::New(env, CANFD_BRS));
    exports.Set("CANFD_ESI", Napi::Number::New(env, CANFD_ESI));

    // 状态码
    exports.Set("STATUS_ERR", Napi::Number::New(env, STATUS_ERR));
    exports.Set("STATUS_OK", Napi::Number::New(env, STATUS_OK));
    exports.Set("STATUS_ONLINE", Napi::Number::New(env, STATUS_ONLINE));
    exports.Set("STATUS_OFFLINE", Napi::Number::New(env, STATUS_OFFLINE));

    // 错误类型
    exports.Set("ZCAN_ERR_TYPE_NO_ERR", Napi::Number::New(env, ZCAN_ERR_TYPE_NO_ERR));
    exports.Set("ZCAN_ERR_TYPE_BUS_ERR", Napi::Number::New(env, ZCAN_ERR_TYPE_BUS_ERR));
    exports.Set("ZCAN_ERR_TYPE_CONTROLLER_ERR", Napi::Number::New(env, ZCAN_ERR_TYPE_CONTROLLER_ERR));
    exports.Set("ZCAN_ERR_TYPE_DEVICE_ERR", Napi::Number::New(env, ZCAN_ERR_TYPE_DEVICE_ERR));

    // 节点状态
    exports.Set("ZCAN_NODE_STATE_ACTIVE", Napi::Number::New(env, ZCAN_NODE_STATE_ACTIVE));
    exports.Set("ZCAN_NODE_STATE_WARNNING", Napi::Number::New(env, ZCAN_NODE_STATE_WARNNING));
    exports.Set("ZCAN_NODE_STATE_PASSIVE", Napi::Number::New(env, ZCAN_NODE_STATE_PASSIVE));
    exports.Set("ZCAN_NODE_STATE_BUSOFF", Napi::Number::New(env, ZCAN_NODE_STATE_BUSOFF));

    // 无效句柄值 (使用BigInt以匹配64位指针返回值)
    exports.Set("INVALID_DEVICE_HANDLE", Napi::BigInt::New(env, static_cast<uint64_t>(0)));
    exports.Set("INVALID_CHANNEL_HANDLE", Napi::BigInt::New(env, static_cast<uint64_t>(0)));

    return ZlgCanDevice::Init(env, exports);
}

NODE_API_MODULE(zlgcan, Init)
