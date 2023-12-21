# RefreshRateCalculator CLASS

## PURPOSE: Accurate cross-platform display refresh rate estimator / dejittered VSYNC timestamp estimator.

* **Input:** Series of frame timestamps during framerate=Hz (Jittery/lossy) or from your platform's jittery VSYNC listener
* **Output:** Accurate filtered and dejittered floating-point Hz estimate & refresh cycle timestamps.
* **Algorithm:** Combination of frame counting, jitter filtering, ignoring missed frames, and averaging.

# LICENSE - Apache-2.0

```
Copyright 2014-2023 by Jerry Jongerius of DuckWare (https://www.duckware.com) - original code and algorithm
Copyright 2017-2023 by Mark Rejhon of Blur Busters / TestUFO (https://www.testufo.com) - refactoring and improvements

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*** First publicly released July 2023 under mutual agreement
*** between Rejhon Technologies Inc. (Blur Busters) and Jongerius LLC (DuckWare)
*** PLEASE DO NOT DELETE THIS COPYRIGHT NOTICE
```

## JAVASCRIPT VSYNC API / REFRESH CYCLE TIME STAMPS

* Info: https://www.vsynctester.com/howtocomputevsync.html
* Used by both https://www.vsynctester.com and https://www.testufo.com/refreshrate
* [requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame) generally tries to syncs to VSYNC, so that is the source of VSYNC in web browsers, for deriving refresh cycle timestamps from.  The longer this algorithm runs, the more accurate the refresh rate estimate becomes.
* **JavaScript Compatibility**: ES6 / ECMAScript 2015 (Chrome, FireFox, Edge, Safari, Opera)

## COMMON USE

* Generate ultra-accurate refresh rate estimate from a stream of jittery/skipped refresh cycle timestamps
* Generate ultra-accurate timestamp estimate of next refresh cycle

## KNOWN PLATFORM SPECIFIC LIMITATIONS

* In web browsers, only accurately when run on the primary monitor
* Measuring refresh rate on Windows via Chrome/FireFox/Edge is accurate to 1000Hz (prototype monitors have been tested by Blur Busters).
* Measuring refresh rate on Androids via Chrome is accurate to 240Hz (higher untested)
* Measuring refresh rate on Macs/iPads via Safari browser is accurate only up to 120Hz (if you disable "Prefer Page Rendering Updates near 60fps" setting)
* Measuring refresh rate on iPhones via Safari browser is accurate only to 60Hz
* If using Windows laptop at >120Hz, you may need to enable Performance GPU (AMD/NVIDIA/Intel-ARC) rather than the Integrated GPU where possible.  Intel Iris integrated GPU will usually generate accurate refresh rate up to about ~500Hz if you're not doing animations at the same time.  However, your mileage on older integrated GPUs may vary.

## OTHER ADVANCED NICHE USES / LESS COMMON

* While not normally used for beam racing, this algorithm is sufficiently accurate enough for cross-platform raster estimates for beam racing applications, based on a time offset between refresh cycle timestamps! (~1% error vs vertical resolution is possible on modern AMD/NVIDIA GPUs).  Tearline Jedi (cross platform rasters for retro raster interrupt folks) uses a [similar algorithm](https://www.pouet.net/topic.php?which=11422&page=1) to this for sub-1ms latency between frame Present()-to-photons.
* Can be used for tearingless VSYNC OFF algorithms (scanline-specific tearline steering offscreen ala RTSS Scanline Sync or SpecialK Latent Sync) as long as separate thread is able to monitor and provide your (jittery) VSYNC or refresh cycle timestamps.  Or if your platform/framework supports simultaneous VSYNC ON (offscreen) and VSYNC OFF (visible) in separate threads/contexts.
* This is also a way to measure a GPU clock source indirectly, since the GPU generates the refresh rate during fixed Hz.
HOWEVER, VRR NOTE: This algorithm does not generate a GPU clock source when running this on a variable refresh rate display 
(e.g. GSYNC/FreeSync), but can still measure the foreground software application's fixed-framerate operation during
windowed-VRR-enabled operation, such as desktop compositor (e.g. DWM). This can allow a background application 
to match the frame rate of the desktop compositor or foreground application (e.g. 60fps capped app on VRR display).
This algorithm currently degrades severely during varying-framerate operation on a VRR display.

## CODE PORTING 

* This algorithm is very portable to most languages, on most platforms, via high level and low level graphics frameworks.
* Generic VSYNC timestamps is usually immediately after exit of almost any frame presentation API during VSYNC ON framerate=Hz
* APIs for timestamps include RTDSC / QueryPerformanceCounter() / std\:\:chrono\:\:high_resolution_clock\:\:now()
* APIs for low level frame presentation include DirectX Present(), OpenGL glFinish(), Vulkan vkQueuePresentKHR()
* APIs for high level frame presentation include XBox/MonoGame Draw(), Unity3D Update(), etc.
* APIs for zero-graphics timestamps (e.g. independent/separate thread) include Windows D3DKMTWaitForVerticalBlankEvent()
* Great for dejittering USB-relayed or TCP-relayed VSYNC heartbeats (e.g. software based genlock, shutter glasses emitters, etc)
 
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

# RUNNING FIELD EXAMPLES

[![image](https://github.com/blurbusters/RefreshRateCalculator/assets/59981975/99235dfb-0b93-4352-8732-f2b6edc2db93)](https://www.testufo.com/refreshrate)

[![image](https://github.com/blurbusters/RefreshRateCalculator/assets/59981975/c2f1b4d7-623c-4ce0-8762-beab69e3d981)](https://www.vsynctester.com)
