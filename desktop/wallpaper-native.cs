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
    [StructLayout(LayoutKind.Sequential)] struct Placement { public int Length, Flags, ShowCmd; public Point Min, Max; public Rect Normal; }
    [DllImport("user32.dll")] static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr unused);
    [DllImport("user32.dll")] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool GetWindowPlacement(IntPtr hwnd, ref Placement placement);
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
    public sealed class WindowInfo { public long Handle, Parent; public string Class; public uint ProcessId; public bool Visible; public long Style, ExStyle; }
    public sealed class Status {
        public long Window, Parent, Icons; public string Kind; public bool Child, Visible, BehindIcons, Verified;
        public int X, Y, Width, Height, ExpectedX, ExpectedY, ExpectedWidth, ExpectedHeight;
    }
    readonly IntPtr hwnd;
    IntPtr inputWindow;
    long inputStyle, inputExStyle;
    readonly long originalStyle, originalExStyle;
    Rect originalRect;
    public bool Attached { get; private set; }
    public MusicWallWallpaper(string handle, uint ownerPid) {
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        hwnd = new IntPtr(Convert.ToInt64(handle, 16));
        uint pid; GetWindowThreadProcessId(hwnd, out pid);
        if (!IsWindow(hwnd) || pid != ownerPid) throw new InvalidOperationException("Wallpaper HWND does not belong to the Electron parent.");
        originalStyle = GetLong(hwnd, -16).ToInt64(); originalExStyle = GetLong(hwnd, -20).ToInt64();
        CaptureNormalBounds();
    }
    static string Class(IntPtr w) { var s = new StringBuilder(256); GetClassName(w, s, s.Capacity); return s.ToString(); }
    static void ProbeWindow(List<WindowInfo> list, IntPtr w, bool children) {
        uint pid; GetWindowThreadProcessId(w,out pid);
        list.Add(new WindowInfo { Handle=w.ToInt64(), Parent=GetParent(w).ToInt64(), Class=Class(w), ProcessId=pid,
            Visible=IsWindowVisible(w), Style=GetLong(w,-16).ToInt64(), ExStyle=GetLong(w,-20).ToInt64() });
        if (children) for (IntPtr c=FindWindowEx(w,IntPtr.Zero,null,null); c!=IntPtr.Zero; c=FindWindowEx(w,c,null,null))
            ProbeWindow(list,c,true);
    }
    public static WindowInfo[] DesktopWindows() {
        var list = new List<WindowInfo>();
        EnumWindows(delegate(IntPtr w, IntPtr unused) {
            string cls=Class(w);
            // Read-only host tree in sibling z-order, without window titles/content.
            if (cls=="Progman" || cls=="WorkerW" || cls=="Shell_TrayWnd") ProbeWindow(list,w,cls!="Shell_TrayWnd");
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
    public void SetInputWindow(string handle, uint ownerPid) {
        IntPtr candidate=new IntPtr(Convert.ToInt64(handle,16)); uint pid;
        GetWindowThreadProcessId(candidate,out pid);
        if (!IsWindow(candidate) || candidate==hwnd || pid!=ownerPid)
            throw new InvalidOperationException("Wallpaper input HWND does not belong to the Electron parent.");
        inputWindow=candidate; inputStyle=GetLong(candidate,-16).ToInt64(); inputExStyle=GetLong(candidate,-20).ToInt64();
    }
    public static long InputExStyle(long original) {
        // A child above DefView must be layered to composite over the wallpaper.
        // Do not retain Chromium's NOREDIRECTIONBITMAP on this input-only surface.
        return (original & ~0x08240000L) | 0x00080080L;
    }
    public static long InputStyle(long original) {
        // Keyboard input needs an ordinary activatable popup, not a child in
        // Explorer's input queue. The actual wallpaper stays a desktop child.
        return (original & ~0x61CF0000L) | 0x80000000L;
    }
    void AttachInput(IntPtr icons, int x, int y, int width, int height) {
        if (inputWindow==IntPtr.Zero) return;
        if (!IsWindow(inputWindow)) throw new InvalidOperationException("Wallpaper input window was destroyed.");
        IntPtr desktop=GetParent(icons);
        while ((GetLong(desktop,-16).ToInt64() & 0x40000000L)!=0) desktop=GetParent(desktop);
        long style=InputStyle(inputStyle);
        long currentStyle=GetLong(inputWindow,-16).ToInt64();
        if ((currentStyle & ~0x10000000L)!=(style & ~0x10000000L) || GetParent(inputWindow)!=desktop) {
            // Detach only our own input HWND; Explorer remains untouched.
            if ((GetLong(inputWindow,-16).ToInt64() & 0x40000000L)!=0) SetParent(inputWindow,IntPtr.Zero);
            Style(inputWindow,-16,style | (currentStyle & 0x10000000L));
            Style(inputWindow,-20,InputExStyle(inputExStyle));
            // An owner keeps the popup associated with the desktop, without
            // sharing its child focus behavior or creating a taskbar window.
            Style(inputWindow,-8,desktop.ToInt64());
            // Zero alpha makes Windows pass clicks through; one keeps native
            // hit testing while making this empty surface visually negligible.
            if (!SetLayeredWindowAttributes(inputWindow,0,1,2))
                throw new Win32Exception(Marshal.GetLastWin32Error(),"Could not make the input surface transparent.");
        }
        // Place just above the desktop root, below ordinary applications.
        // Never promote the input popup to an always-on-top window.
        IntPtr after=GetWindow(desktop,3);
        if (after==inputWindow) after=GetWindow(inputWindow,3);
        if (after!=IntPtr.Zero && (GetLong(after,-20).ToInt64() & 0x8L)!=0) after=new IntPtr(-2);
        if (!SetWindowPos(inputWindow,after,x,y,width,height,0x10|0x20))
            throw new Win32Exception(Marshal.GetLastWin32Error(),"Could not place the input surface.");
    }
    void CaptureNormalBounds() {
        if (IsIconic(hwnd)) {
            var placement=new Placement { Length=Marshal.SizeOf(typeof(Placement)) };
            if (GetWindowPlacement(hwnd,ref placement)) originalRect=placement.Normal;
        } else {
            Rect rect;
            if (GetWindowRect(hwnd,out rect) && UsableNormalBounds(rect)) originalRect=rect;
        }
    }
    public static bool UsableNormalBounds(Rect rect) {
        return rect.Left > -30000 && rect.Top > -30000 && rect.Right-rect.Left >= 200 && rect.Bottom-rect.Top >= 100;
    }
    public static long WallpaperExStyle(long original, bool raisedDesktop) {
        long result=(original & ~0x00040000L) | 0x08000080L;
        // Do not change Chromium's surface ownership on a live HWND. Windows
        // rejects removing NOREDIRECTIONBITMAP while enabling this layered style.
        if (raisedDesktop) result |= 0x00080000L;
        return result;
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
            if (!Attached) CaptureNormalBounds();
            Style(hwnd,-16,(originalStyle & ~0xA1CF0000L) | 0x40000000L);
            long ext=WallpaperExStyle(originalExStyle,h.Kind=="progman-layered");
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
        AttachInput(icons,x,y,width,height);
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
        if (inputWindow!=IntPtr.Zero && IsWindow(inputWindow)) {
            ShowWindow(inputWindow,0); SetParent(inputWindow,IntPtr.Zero);
            Style(inputWindow,-8,0);
            Style(inputWindow,-16,inputStyle); Style(inputWindow,-20,inputExStyle);
        }
        if (!IsWindow(hwnd)) return;
        Parent(IntPtr.Zero); Style(hwnd,-16,originalStyle & ~0x20000000L); Style(hwnd,-20,originalExStyle);
        // Restore iconic state before applying the saved ordinary bounds; applying
        // bounds to a minimized HWND otherwise leaves it parked at (-32000,-32000).
        ShowWindow(hwnd,show ? 9 : 0);
        if (!SetWindowPos(hwnd,IntPtr.Zero,originalRect.Left,originalRect.Top,originalRect.Right-originalRect.Left,originalRect.Bottom-originalRect.Top,0x14|0x20))
            throw new Win32Exception(Marshal.GetLastWin32Error(),"Could not restore normal window bounds.");
        ShowWindow(hwnd,show ? 9 : 0); Attached=false;
    }
}
