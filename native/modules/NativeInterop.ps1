# Fullscreen Win32 API, Keyboard Media Key Fallbacks, and C# StdinListener
$pinvoke = @'
using System;
using System.Text;
using System.Threading;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;

public class Win32Helper {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT {
        public uint type;
        public KEYBDINPUT ki;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    public static bool SendMediaKey(byte vk) {
        INPUT[] inputs = new INPUT[2];
        inputs[0].type = 1;
        inputs[0].ki.wVk = vk;
        inputs[1].type = 1;
        inputs[1].ki.wVk = vk;
        inputs[1].ki.dwFlags = 0x0002;
        return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) == inputs.Length;
    }
}

// Core Audio (default render endpoint) for reading and setting the real system mute state
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
internal class MMDeviceEnumeratorCom {}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumerator {
    int NotImpl_EnumAudioEndpoints();
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioEndpointVolume {
    int NotImpl_RegisterControlChangeNotify();
    int NotImpl_UnregisterControlChangeNotify();
    int NotImpl_GetChannelCount();
    int NotImpl_SetMasterVolumeLevel();
    [PreserveSig] int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
    int NotImpl_GetMasterVolumeLevel();
    [PreserveSig] int GetMasterVolumeLevelScalar(out float pfLevel);
    int NotImpl_SetChannelVolumeLevel();
    int NotImpl_SetChannelVolumeLevelScalar();
    int NotImpl_GetChannelVolumeLevel();
    int NotImpl_GetChannelVolumeLevelScalar();
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
}

public static class AudioHelper {
    // Re-resolved on every call so switching output devices is picked up
    private static IAudioEndpointVolume GetEndpoint() {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom());
            IMMDevice device;
            // eRender = 0, eMultimedia = 1
            if (enumerator.GetDefaultAudioEndpoint(0, 1, out device) != 0 || device == null) return null;
            Guid iid = typeof(IAudioEndpointVolume).GUID;
            object o;
            // CLSCTX_ALL = 23
            if (device.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) return null;
            return o as IAudioEndpointVolume;
        } catch {
            return null;
        }
    }

    // Returns 1 = muted, 0 = unmuted, -1 = unavailable
    public static int GetMute() {
        var ep = GetEndpoint();
        if (ep == null) return -1;
        bool muted;
        if (ep.GetMute(out muted) != 0) return -1;
        return muted ? 1 : 0;
    }

    // Returns 0-100, or -1 when unavailable
    public static int GetVolume() {
        var ep = GetEndpoint();
        if (ep == null) return -1;
        float level;
        if (ep.GetMasterVolumeLevelScalar(out level) != 0) return -1;
        return (int)Math.Round(level * 100);
    }

    // level 0-100; also unmutes, like the Windows volume flyout does
    public static bool SetVolume(int level) {
        var ep = GetEndpoint();
        if (ep == null) return false;
        Guid ctx = Guid.Empty;
        float scalar = Math.Max(0, Math.Min(100, level)) / 100f;
        if (ep.SetMasterVolumeLevelScalar(scalar, ref ctx) != 0) return false;
        if (level > 0) ep.SetMute(false, ref ctx);
        return true;
    }

    public static bool SetMute(bool mute) {
        var ep = GetEndpoint();
        if (ep == null) return false;
        Guid ctx = Guid.Empty;
        return ep.SetMute(mute, ref ctx) == 0;
    }
}

// Core Audio capture sessions: which processes are recording from a microphone right now
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceEnumeratorAll {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection ppDevices);
}

[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out int pcDevices);
    [PreserveSig] int Item(int nDevice, out IMMDevice ppDevice);
}

[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionManager2 {
    int NotImpl_GetAudioSessionControl();
    int NotImpl_GetSimpleAudioVolume();
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
}

[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int sessionCount);
    [PreserveSig] int GetSession(int sessionIndex, out IAudioSessionControl2 session);
}

[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IAudioSessionControl2 {
    [PreserveSig] int GetState(out int pRetVal);
    int NotImpl_GetDisplayName();
    int NotImpl_SetDisplayName();
    int NotImpl_GetIconPath();
    int NotImpl_SetIconPath();
    int NotImpl_GetGroupingParam();
    int NotImpl_SetGroupingParam();
    int NotImpl_RegisterAudioSessionNotification();
    int NotImpl_UnregisterAudioSessionNotification();
    int NotImpl_GetSessionIdentifier();
    int NotImpl_GetSessionInstanceIdentifier();
    [PreserveSig] int GetProcessId(out uint pRetVal);
}

public static class MicHelper {
    // Process IDs with an active capture session on any enabled microphone
    public static int[] GetActiveCapturePids() {
        var pids = new System.Collections.Generic.List<int>();
        try {
            var enumerator = (IMMDeviceEnumeratorAll)(new MMDeviceEnumeratorCom());
            IMMDeviceCollection devices;
            // eCapture = 1, DEVICE_STATE_ACTIVE = 1
            if (enumerator.EnumAudioEndpoints(1, 1, out devices) != 0 || devices == null) return pids.ToArray();
            int deviceCount;
            devices.GetCount(out deviceCount);
            for (int d = 0; d < deviceCount; d++) {
                IMMDevice device;
                if (devices.Item(d, out device) != 0 || device == null) continue;
                Guid iid = typeof(IAudioSessionManager2).GUID;
                object o;
                if (device.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) continue;
                var manager = o as IAudioSessionManager2;
                IAudioSessionEnumerator sessions;
                if (manager == null || manager.GetSessionEnumerator(out sessions) != 0 || sessions == null) continue;
                int sessionCount;
                sessions.GetCount(out sessionCount);
                for (int s = 0; s < sessionCount; s++) {
                    IAudioSessionControl2 session;
                    if (sessions.GetSession(s, out session) != 0 || session == null) continue;
                    int state;
                    uint pid;
                    // AudioSessionStateActive = 1
                    if (session.GetState(out state) == 0 && state == 1 && session.GetProcessId(out pid) == 0 && pid != 0 && !pids.Contains((int)pid)) {
                        pids.Add((int)pid);
                    }
                }
            }
        } catch {}
        return pids.ToArray();
    }
}

public static class StdinListener {
    public static readonly ConcurrentQueue<string> Commands = new ConcurrentQueue<string>();
    private static Thread _thread;

    public static void Start() {
        if (_thread != null) return;
        _thread = new Thread(() => {
            while (true) {
                try {
                    string line = Console.ReadLine();
                    if (line == null) break;
                    string trimmed = line.Trim();
                    if (!string.IsNullOrEmpty(trimmed)) {
                        Commands.Enqueue(trimmed);
                    }
                } catch {
                    break;
                }
            }
        });
        _thread.IsBackground = true;
        _thread.Start();
    }

    public static string ReadNext() {
        string cmd;
        if (Commands.TryDequeue(out cmd)) {
            return cmd;
        }
        return null;
    }
}
'@
Add-Type -TypeDefinition $pinvoke -Language CSharp -ErrorAction SilentlyContinue

# Start background stdin thread safely in C#
[StdinListener]::Start()
