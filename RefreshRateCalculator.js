//-----------------------------------------------------------------------------------------------------------------------------
//  RefreshRateCalculator CLASS
//
//  PURPOSE: Accurate cross-platform display refresh rate estimator / dejittered VSYNC timestamp estimator.
//
//    Input: Series of frame timestamps during fixed-Hz framerate=Hz (Jittery/lossy)
//    Output: Accurate filtered and dejittered floating-point Hz estimate & refresh cycle timestamps.
//    Algorithm: Combination of frame counting, jitter filtering, ignoring missed frames, and averaging.
//
//    This is also a way to measure a GPU clock source indirectly, since the GPU generates the refresh rate during fixed Hz.
//
//    IMPORTANT VRR NOTE: This algorithm does not generate a GPU clock source when running this on a variable refresh rate 
//    display (e.g. GSYNC/FreeSync), but can still measure the foreground software application's fixed-framerate operation 
//    during windowed-VRR-enabled operation, such as desktop compositor (e.g. DWM). This can allow a background application 
//    to match the frame rate of the desktop compositor or foreground application (e.g. 60fps capped app on VRR display).
//    This algorithm currently degrades severely during varying-framerate operation on a VRR display.
//
//  JAVASCRIPT VSYNC API / REFRESH CYCLE TIME STAMPS
// 
//    More info: http://www.vsynctester.com/howtocomputevsync.html
//    In Javascript, requestAnimationFrame() generally tries to syncs to VSYNC, so that is the source of VSYNC
//    web browsers, for deriving refresh cycle timestamps from.  The longer this algorithm runs, the more accurate
//    the refresh rate estimate becomes, when running on a fixed-Hz display.  
//    JavaScript Compatibility: ES6 / ECMAScript 2015 (Chrome, FireFox, Edge, Safari, Opera)
//
//  CODE PORTING 
//
//    This algorithm is very portable to most languages, on most platforms, via high level and low level graphics frameworks.
//    Generic VSYNC timestamps is usually immediately after exit of frame presentation API during VSYNC ON framerate=Hz
//    APIs for timestamps include RTDSC / QueryPerformanceCounter() / std::chrono::high_resolution_clock::now()
//    APIs for low level frame presentation include DirectX Present(), OpenGL glFinish(), Vulkan vkQueuePresentKHR()
//    APIs for high level frame presentation include XBox/MonoGame Draw(), Unity3D Update()
//    APIs for zero-graphics timestamps (e.g. independent/separate thread) include Windows D3DKMTWaitForVerticalBlankEvent()
//    While not normally used for beam racing, this algorithm is sufficiently accurate enough for cross-platform 
//      raster estimates for beam racing applications, based on a time offset between refresh cycle timestamps! 
//      (~1% error vs vertical resolution is possible on modern AMD/NVIDIA GPUs).
//
//=============================================================================================================================
//
//  LICENSE - Apache-2.0
//
//    Copyright 2014-2023 by Jerry Jongerius of DuckWare (https://www.duckware.com) - original code and algorithm
//    Copyright 2017-2023 by Mark Rejhon of Blur Busters / TestUFO (https://www.testufo.com) - refactoring and improvements
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
//
//    *** First publicly released July 2023 under mutual agreement
//    *** between Rejhon Technologies Inc. (Blur Busters) and Jongerius LLC (DuckWare)
//    *** PLEASE DO NOT DELETE THIS COPYRIGHT NOTICE
//    
//-----------------------------------------------------------------------------------------------------------------------------

class RefreshRateCalculator
{
  constructor()
  {
    // CONSTANTS: tune these for the expected environment (eg: optimize when converting this code to native code)
    this._VALIDATEMS = 100.0;    // tune: ms: how frequently timebase/interval is computed/validated
    this._TIGHTGROUPMS = 1.0;    // tune: ms: the far majority of inter-frame times expected to be within this grouping (a 'tight group' frame; discard outside this range)
    this._MSCHANGE = 1.0;        // tune: ms: an interval change more than this ms is considered a change in Hz
    this._MAXSTORE = 5000000;    // tune: int: store a maximum of this many 'tight group' frame times
    this._LOWESTVALIDHZ = 35;    // tune: int: lowest valid Hz -- filters out timings while web browser tab is inactive
    this._nJavaScriptSkip = 60;  // tune: int: ignore this many initial times -- ONE time at startup (allow JavaScript to settle down; not needed in native code)
    this.__reset();
  }

  // Clears history and restarts measuring. 
  //   Useful to call this if refresh rate has changed (e.g. display mode changes).
  restartMeasuring()
  {
    this.__reset();
  };

  // Count this refresh cycle with a frame timestamp
  //   Provide your (jittery) frame timestamp to this function during VSYNC ON frame rate matching refresh rate.
  //   This class will de-jitter the VSYNC timestamp, and ignore missed VSYNC timestamps (frame drops).
  //   For JavaScript, call with performance.now() at beginning of requestAnimationFrame() function.
  //   For other platforms, call with microsecond-accurate timestamps every time your frame presentation API runs/exits.
  countCycle(currentTime)
  {
    this.__add(currentTime);
  };

  // Ignore next few timestamps
  //   This is useful if we already know the next few timestamps are likely going to be bad.
  //   (e.g. resuming from freeze / background / sleep). This reduces polluting of existing historical data.
  ignoreNextCycle(cycles = 1)
  {
    this._nSkip = cycles;
  };

  // Returns the current jitter-free Hz estimate, based on the history of provided data (jittered VSYNC timestamps)
  //   To obtain estimate for a refresh cycle duration, use (1.0/getCurrentFrequency())
  getCurrentFrequency()
  {
    return this.__calc();
  };

  // Returns accurately de-jittered timestamp of VSYNC.  
  //   You can add one refresh interval (1.0/getCurrentFrequency()) to get predicted timestamp of next refresh cycle.
  //   NOTE: Returns 0 if you haven't been calling countCycle() since class creation or restartMeasuring.
  getFilteredCycleTimestamp()
  {
    return this.__snap();
  };

  // Returns count of refresh cycles counted since class creation or restartMeasuring.
  //   Bigger number = indicator of more accurate refresh rate estimate.
  getCount()
  {
    return this._cycleCount;
  };  

  //---------------------------------------------------------------------------------------------------------------------------
  // BELOW IS INTERNAL ONLY.  DO NOT CALL BELOW METHODS DIRECTLY.  USE THE ABOVE METHODS INSTEAD.
  // The below methods are public only as a side effect of needing to be compatible with old JavaScript ES6 (ECMA 2015)
  //---------------------------------------------------------------------------------------------------------------------------

  // INTERNAL: Reset all statistics
  __reset(reason = "")
  {
    //if (reason) console.log( "Resetting Hz statistics: "+reason );
    this._cycleCount = 0;
    this._nSkipBase = 0;
    this._nSkip = 0;
    this._tUpdate = 0.0;
    this._L0 = this._L1 = this._L2 = this._L3 = this._L4 = 0.0;
    this._m_D = [];
    this._m_S = [];
    this._m_ms = 0.0;
    this._m_vi = "";
    this._m_tvsync = 0.0;
    this._m_summs = 0.0;
    this._m_nms = 0;
    this._m_nChange = 0;
  };  

  // INTERNAL: Keep even half of an array, throwing away the odd half
  __cut(arr)
  {
    var ret = [];
    for (var loop = 0; loop < arr.length; loop += 2)
    {
      ret[ret.length] = arr[loop];
    }
    return ret;
  };

  // INTERNAL: Adds a VSYNC timestamp, and executes filtering algorithm
  __add(tFrame)
  {
    this._cycleCount++;
    this._L0 = this._L1;
    this._L1 = this._L2;
    this._L2 = this._L3;
    this._L3 = this._L4;
    this._L4 = tFrame;
    var grouping = Math.max(this._L4 - this._L3, this._L3 - this._L2, this._L2 - this._L1, this._L1 - this._L0) - Math.min(this._L4 - this._L3, this._L3 - this._L2, this._L2 - this._L1, this._L1 - this._L0);
    if (grouping < this._TIGHTGROUPMS)
    { // when several successive inter-frame times are very close to each other, assume a good frame time
      if (--this._nJavaScriptSkip < 0 && --this._nSkip < 0)
      {    // skip first so many (allow browser to settle down)
        var avems = (this._L4 - this._L0) / 4;
        if (avems < (1000 / this._LOWESTVALIDHZ))
        {                      // ignore 'inactive' tab timings

          // A change in Hz will be detected by excessive drift in validate code.  But the drift code will
          // not detect a Hz change that is an *exact* multiple of the prior Hz (like: 59.802 -> 119.604).
          // So that is why we expressly check for a Hz change.
          var bHzChanged = (this._m_nms > 10) && (Math.abs(avems - this._m_summs / this._m_nms) > this._MSCHANGE);
          this._m_nChange = bHzChanged ? this._m_nChange + 1 : 0;
          if (!bHzChanged)
          {
            this._m_summs += avems;
            ++this._m_nms;
            if (!this._m_ms && this._m_nms > Math.max(30, grouping * 60))
            {
              this._m_ms = this._m_summs / this._m_nms;        // jump starts iterative 'best line' validate code below
              //console.log( "start="+m_ms+" at "+m_nms );
            }
          }

          if (this._m_nChange > 20)
          {  // do by number, not time (as time does not account for missed frames)
            this.__reset("Change in Hz detected " + (this._m_summs / this._m_nms).toFixed(3) + "->" + avems.toFixed(3));
          }
          else
          {
            if (this._m_D.length >= this._MAXSTORE)
            {
              this._m_D = this.__cut(this._m_D);
              this._m_S = this.__cut(this._m_S);
              this._nSkipBase = this._nSkipBase * 2 + 1;   // series of: 2^n-1
            }
            var at = this._m_D.length;
            this._m_D[at] = this._L2;                  // RAW times (not smoothed) for computing timebase
            this._m_S[at] = (this._L0 + this._L1 + this._L2 + this._L3 + this._L4) / 5;  // smoothed time (for computing interval)
            this._nSkip = this._nSkipBase;

            // update ms/Hz estimate and perform validation every so often
            if (this._m_ms && (tFrame - this._tUpdate > this._VALIDATEMS))
            {
              this._tUpdate = tFrame;
              this._m_vi = this.__validate();
            }
          }
        }
      }
    }
    return "Hz=" + this._m_D.length + "&times;" + (this._nSkipBase + 1) + " samples  " + this._m_vi + "  dpr=" + window.devicePixelRatio + "  cores=" + navigator.hardwareConcurrency;
  };

  // INTERNAL: calculate Hz
  __calc()
  {
    return this._m_ms ? 1000 / this._m_ms : 0;
  };

  // INTERNAL: compute new 'interval' and 'timebase' and validate
  __validate()
  {
    var ret = "";

    // assert m_ms non-zero

    // iteratively compute a new 'interval' -- slope of best fit line (see http://brownmath.com/stat/leastsq.htm for formulas)
    var sx = 0.0;
    var sy = 0.0;
    var sxx = 0.0;
    var sxy = 0.0;
    var X = 0;
    var N = this._m_D.length;
    var loop;
    for (loop = 0; loop < N; ++loop)
    {
      X += (loop > 0 ? Math.round((this._m_S[loop] - this._m_S[loop - 1]) / this._m_ms) : 0);
      var Y = this._m_D[loop] - this._m_D[0];
      sx += X;
      sy += Y;
      sxx += X * X;
      sxy += X * Y;
    }
    var m = (N * sxy - sx * sy) / (N * sxx - sx * sx);
    var b = (sxx * sy - sx * sxy) / (N * sxx - sx * sx);
    this._m_ms = m;                              // best fit line 'interval'
    var tb = this._m_D[0] + b;                   // best fit line 'timebase'

    // adjust new 'timebase' and validate with underlying data (if not consistent, reset)
    var halfms = this._m_ms / 2;   // must NOT change due to pre-Chromium IE/Edge issues
    var max = 0;
    var min = 0;
    for (loop = 1; loop < this._m_D.length; ++loop)
    {
      var off = (this._m_D[loop] - tb + halfms) % this._m_ms - halfms;   // [0..ms] to [-ms/2..ms/2]
      min = Math.min(min, off);
      max = Math.max(max, off);
    }
    //
    if (max - min < halfms)
    {
      this._m_tvsync = tb + min;
      ret = "drift=[" + min.toFixed(2) + ".." + max.toFixed(2) + "]";
    }
    else
    {
      this.__reset("excessive drift");
    }
    return ret;
  };

  // INTERNAL: capture time of vsync and ms; returns null if there is not enough data collected
  __snap()
  {
    return this._m_vi ? {tvsync: this._m_tvsync, ms: this._m_ms} : null;
  };

  // INTERNAL: compute offset from vsync.  Returns range: [-2..ms-2]
  __vso(t, snap)
  {
    return snap && snap.ms ? ((t - snap.tvsync + 2) % snap.ms + snap.ms) % snap.ms - 2 : 0;
  };
}
// END RefreshRateCalculator()
