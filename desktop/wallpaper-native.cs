using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Concurrent;
using System.Threading;

// Only the owning Electron HWND is changed. Explorer's styles/process are never changed.
public sealed class MusicWallWallpaper {
    static readonly ConcurrentQueue<string> input = new ConcurrentQueue<string>();
    public static volatile bool InputClosed;
    public static void StartInput() {
        var reader = new Thread(delegate() {
            try { string line; while ((line=Console.In.ReadLine())!=null) input.Enqueue(line); }
            finally { InputClosed=true; }
        });
        reader.IsBackground=true; reader.Start();
    }
    public static string ReadCommand() { string line; return input.TryDequeue(out line) ? line : null; }
    public delegate bool EnumProc(IntPtr hwnd, IntPtr unused);
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
    [DllImport("user32.dll")] static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr unused);
    [DllImport("user32.dll")] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetParent(IntPtr hwnd, IntPtr parent);
    [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] static extern IntPtr GetLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW", SetLastError=true)] static extern IntPtr SetLong(IntPtr hwnd, int index, IntPtr value);
    [DllImport("kernel32.dll")] static extern void SetLastError(uint error);
    [DllImport("user32.dll", SetLastError=true)] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] static extern int MapWindowPoints(IntPtr from, IntPtr to, ref Point point, uint count);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll", SetLastError=true)] static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint color, byte alpha, uint flags);
    [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, IntPtr wp, IntPtr lp, uint flags, uint timeout, out IntPtr result);

    public sealed class Host { public long Parent, Icons; public string Kind; }
    public sealed class WindowInfo { public long Handle, Parent; public string Class; public uint ProcessId; public bool Visible; }
    public sealed class Status {
        public long Window, Parent, Icons; public string Kind; public bool Child, Visible, BehindIcons, Verified;
        public int X, Y, Width, Height, ExpectedX, ExpectedY, ExpectedWidth, ExpectedHeight;
    }
    readonly IntPtr hwnd;
    readonly long originalStyle, originalExStyle;
    Rect originalRect;
    public bool Attached { get; private set; }
    public MusicWallWallpaper(string handle, uint ownerPid) {
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        hwnd = new IntPtr(Convert.ToInt64(handle, 16));
        uint pid; GetWindowThreadProcessId(hwnd, out pid);
        if (!IsWindow(hwnd) || pid != ownerPid) throw new InvalidOperationException("Wallpaper HWND does not belong to the Electron parent.");
        originalStyle = GetLong(hwnd, -16).ToInt64(); originalExStyle = GetLong(hwnd, -20).ToInt64();
        GetWindowRect(hwnd, out originalRect);
    }
    static string Class(IntPtr w) { var s = new StringBuilder(256); GetClassName(w, s, s.Capacity); return s.ToString(); }
    public static WindowInfo[] DesktopWindows() {
        var list = new List<WindowInfo>();
        EnumWindows(delegate(IntPtr w, IntPtr unused) {
            string cls = Class(w);
            if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd") {
                uint pid; GetWindowThreadProcessId(w, out pid);
                list.Add(new WindowInfo { Handle=w.ToInt64(), Parent=GetParent(w).ToInt64(), Class=cls, ProcessId=pid, Visible=IsWindowVisible(w) });
                for (IntPtr c=FindWindowEx(w, IntPtr.Zero, null, null); c!=IntPtr.Zero; c=FindWindowEx(w,c,null,null)) {
                    string cc=Class(c); if (cc=="SHELLDLL_DefView" || cc=="WorkerW") {
                        GetWindowThreadProcessId(c,out pid);
                        list.Add(new WindowInfo { Handle=c.ToInt64(), Parent=w.ToInt64(), Class=cc, ProcessId=pid, Visible=IsWindowVisible(c) });
                    }
                }
            }
            return true;
        },IntPtr.Zero);
        return list.ToArray();
    }
    static Host Discover(bool create) {
        IntPtr progman=FindWindow("Progman",null);
        if (progman==IntPtr.Zero) return null;
        uint shellPid; GetWindowThreadProcessId(progman,out shellPid);
        if (create) {
            IntPtr result;
            if (SendMessageTimeout(progman,0x052C,IntPtr.Zero,IntPtr.Zero,2,1000,out result)==IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(),"Explorer did not respond to desktop-host discovery.");
        }
        // Raised desktop: our layered child goes below DefView, above WorkerW.
        IntPtr icons=FindWindowEx(progman,IntPtr.Zero,"SHELLDLL_DefView",null);
        if (icons!=IntPtr.Zero) return new Host { Parent=progman.ToInt64(), Icons=icons.ToInt64(), Kind="progman-layered" };
        Host host=null;
        EnumWindows(delegate(IntPtr top, IntPtr unused) {
            IntPtr view=FindWindowEx(top,IntPtr.Zero,"SHELLDLL_DefView",null);
            if (view==IntPtr.Zero) return true;
            uint viewPid; GetWindowThreadProcessId(view,out viewPid);
            if (viewPid!=shellPid) return true;
            IntPtr worker=FindWindowEx(IntPtr.Zero,top,"WorkerW",null);
            uint workerPid; GetWindowThreadProcessId(worker,out workerPid);
            if (worker!=IntPtr.Zero && workerPid==shellPid && FindWindowEx(worker,IntPtr.Zero,"SHELLDLL_DefView",null)==IntPtr.Zero)
                host=new Host { Parent=worker.ToInt64(), Icons=view.ToInt64(), Kind="workerw" };
            return false;
        },IntPtr.Zero);
        return host;
    }
    static void Style(IntPtr w,int index,long value) {
        SetLastError(0); IntPtr previous=SetLong(w,index,new IntPtr(value));
        int error=Marshal.GetLastWin32Error();
        if (previous==IntPtr.Zero && error!=0) throw new Win32Exception(error,"Could not set wallpaper window style.");
    }
    void Parent(IntPtr parent) {
        SetLastError(0); IntPtr previous=SetParent(hwnd,parent); int error=Marshal.GetLastWin32Error();
        // NULL detaches to the desktop. While WS_CHILD is still set, GetParent
        // can return the desktop HWND rather than NULL; do not mistake that for failure.
        if ((previous==IntPtr.Zero && error!=0) || (parent!=IntPtr.Zero && GetParent(hwnd)!=parent))
            throw new Win32Exception(error,"Could not attach/detach wallpaper parent.");
    }
    public Status EnsureAttached() {
        if (!IsWindow(hwnd)) throw new InvalidOperationException("The wallpaper window was destroyed; recreate the Electron window.");
        Host h=Discover(!Attached || !IsWindow(GetParent(hwnd)));
        if (h==null) throw new InvalidOperationException("Explorer has no verified wallpaper host below its icon view.");
        IntPtr parent=new IntPtr(h.Parent), icons=new IntPtr(h.Icons);
        if (!Attached || GetParent(hwnd)!=parent) {
            if (!Attached) GetWindowRect(hwnd,out originalRect);
            Style(hwnd,-16,(originalStyle & ~0x80CF0000L) | 0x40000000L);
            long ext=(originalExStyle & ~0x00040000L) | 0x08000080L;
            if (h.Kind=="progman-layered") ext|=0x00080000L;
            Style(hwnd,-20,ext); Parent(parent);
            if (h.Kind=="progman-layered" && !SetLayeredWindowAttributes(hwnd,0,255,2))
                throw new Win32Exception(Marshal.GetLastWin32Error(),"Could not enable raised-desktop composition.");
            Attached=true;
        }
        int x=GetSystemMetrics(76), y=GetSystemMetrics(77), width=GetSystemMetrics(78), height=GetSystemMetrics(79);
        if (width<=0 || height<=0) throw new InvalidOperationException("Windows returned invalid virtual-screen bounds.");
        var point=new Point { X=x,Y=y }; MapWindowPoints(IntPtr.Zero,parent,ref point,1);
        IntPtr after=h.Kind=="progman-layered" ? icons : IntPtr.Zero;
        // Avoid forcing a non-client resize every poll; only repair changed bounds,
        // visibility or stacking. This keeps an attached renderer stable at rest.
        var before=Inspect(h);
        if (!before.Verified || !before.Visible) {
            if (!SetWindowPos(hwnd,after,point.X,point.Y,width,height,0x10|0x20|0x40))
                throw new Win32Exception(Marshal.GetLastWin32Error(),"Could not size the wallpaper.");
            ShowWindow(hwnd,4);
        }
        var status=Inspect(h);
        if (!status.Verified) throw new InvalidOperationException("Windows did not retain the requested wallpaper parent/style/bounds.");
        return status;
    }
    Status Inspect(Host h) {
        Rect rect; GetWindowRect(hwnd,out rect);
        int x=GetSystemMetrics(76), y=GetSystemMetrics(77), width=GetSystemMetrics(78), height=GetSystemMetrics(79);
        bool child=(GetLong(hwnd,-16).ToInt64() & 0x40000000L)!=0;
        bool behind=h.Kind=="workerw";
        if (!behind) for (IntPtr p=GetWindow(hwnd,3); p!=IntPtr.Zero; p=GetWindow(p,3))
            if (p.ToInt64()==h.Icons) { behind=true; break; }
        return new Status { Window=hwnd.ToInt64(), Parent=GetParent(hwnd).ToInt64(), Icons=h.Icons, Kind=h.Kind,
            Child=child, Visible=IsWindowVisible(hwnd), BehindIcons=behind, X=rect.Left,Y=rect.Top,Width=rect.Right-rect.Left,Height=rect.Bottom-rect.Top,
            ExpectedX=x,ExpectedY=y,ExpectedWidth=width,ExpectedHeight=height,
            Verified=GetParent(hwnd).ToInt64()==h.Parent && child && behind && IsWindow(new IntPtr(h.Icons)) &&
                Math.Abs(rect.Left-x)<=2 && Math.Abs(rect.Top-y)<=2 && Math.Abs(rect.Right-rect.Left-width)<=2 && Math.Abs(rect.Bottom-rect.Top-height)<=2 };
    }
    public Status InspectNormal() {
        Rect rect; GetWindowRect(hwnd,out rect);
        bool child=(GetLong(hwnd,-16).ToInt64() & 0x40000000L)!=0;
        return new Status { Window=hwnd.ToInt64(), Parent=GetParent(hwnd).ToInt64(), Kind="window",
            Child=child, Visible=IsWindowVisible(hwnd), X=rect.Left,Y=rect.Top,
            Width=rect.Right-rect.Left,Height=rect.Bottom-rect.Top,
            Verified=IsWindow(hwnd) && !child && GetParent(hwnd)==IntPtr.Zero };
    }
    public void Restore(bool show) {
        if (!IsWindow(hwnd)) return;
        Parent(IntPtr.Zero); Style(hwnd,-16,originalStyle); Style(hwnd,-20,originalExStyle);
        if (!SetWindowPos(hwnd,IntPtr.Zero,originalRect.Left,originalRect.Top,originalRect.Right-originalRect.Left,originalRect.Bottom-originalRect.Top,0x14|0x20))
            throw new Win32Exception(Marshal.GetLastWin32Error(),"Could not restore normal window bounds.");
        ShowWindow(hwnd,show ? 9 : 0); Attached=false;
    }
}
