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
