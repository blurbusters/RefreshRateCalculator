# RefreshRateCalculator CLASS

## PURPOSE: Accurate cross-platform display refresh rate estimator / dejittered VSYNC timestamp estimator.

* **Input:** Series of frame timestamps during framerate=Hz (Jittery/lossy)
* **Output:** Accurate filtered and dejittered floating-point Hz estimate & refresh cycle timestamps.
* **Algorithm:** Combination of frame counting, jitter filtering, ignoring missed frames, and averaging.

1. This is also a way to measure a GPU clock source indirectly, since the GPU generates the refresh rate during fixed Hz.
2. IMPORTANT VRR NOTE: This algorithm does not generate a GPU clock source when running this on a variable refresh rate display 
(e.g. GSYNC/FreeSync), but can still measure the foreground software application's fixed-framerate operation during
windowed-VRR-enabled operation, such as desktop compositor (e.g. DWM). This can allow a background application 
to match the frame rate of the desktop compositor or foreground application (e.g. 60fps capped app on VRR display).
This algorithm currently degrades severely during varying-framerate operation on a VRR display.

## JAVASCRIPT VSYNC API / REFRESH CYCLE TIME STAMPS

* Info: https://www.vsynctester.com/howtocomputevsync.html
* Used by both https://www.vsynctester.com and https://www.testufo.com/refreshrate
* [requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) generally tries to syncs to VSYNC, so that is the source of VSYNC in web browsers, for deriving refresh cycle timestamps from.  The longer this algorithm runs, the more accurate the refresh rate estimate becomes.
* **JavaScript Compatibility**: ES6 / ECMAScript 2015 (Chrome, FireFox, Edge, Safari, Opera)

## CODE PORTING 

* This algorithm is very portable to most high level and low level graphics frameworks, on most platforms.
* Generic VSYNC timestamps is usually immediately after exit of almost any frame presentation API during VSYNC ON framerate=Hz
* APIs for timestamps include RTDSC / QueryPerformanceCounter() / std\:\:chrono\:\:high_resolution_clock\:\:now()
* APIs for low level frame presentation include DirectX Present(), OpenGL glFinish(), Vulkan vkQueuePresentKHR()
* APIs for high level frame presentation include XBox/MonoGame Draw(), Unity3D Update(), etc.
* APIs for zero-graphics timestamps (e.g. independent/separate thread) include Windows D3DKMTWaitForVerticalBlankEvent()
* While not normally used for beam racing, tis algorithm is sufficiently accurate enough for cross-platform raster estimates for beam racing applications (~1% error vs vertical resolution is possible on modern AMD/NVIDIA GPUs).

## SIMPLE CODE EXAMPLE

```
var hertz = new RefreshRateCalculator();

[...]

  // Call this inside your full frame rate VSYNC ON frame presentation or your VSYNC listener.
  // It will automatically filter-out the jitter and dropped frames.
  // For JavaScript, most accurate timestamp occurs if called at very top of your requestAnimationFrame() callback.

hertz.countCycle(performance.now());

[...]

  // This data becomes accurate after a few seconds

var accurateRefreshRate = hertz.getCurrentFrequency();
var accurateRefreshCycleTimestamp = hertz.getFilteredCycleTimestamp();

  // See code for more good helper functions
```
