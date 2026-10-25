/**
 * 零素材音效：用 WebAudio 实时合成
 * 不需要任何音频文件；环境不支持时自动静音，不影响游戏。
 */
function createAudio() {
  let ctx = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx || muted) return ctx;
    if (typeof wx.createWebAudioContext !== 'function') {
      muted = true;
      return null;
    }
    try {
      ctx = wx.createWebAudioContext();
    } catch (e) {
      muted = true;
      return null;
    }
    return ctx;
  }

  function tone(opts) {
    const ac = ensure();
    if (!ac) return;
    const { freq, to, dur = 0.08, type = 'square', vol = 0.12, delay = 0 } = opts;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(opts) {
    const ac = ensure();
    if (!ac) return;
    const { dur = 0.25, vol = 0.16 } = opts || {};
    if (!noiseBuffer) {
      const len = Math.floor(ac.sampleRate * 0.4);
      noiseBuffer = ac.createBuffer(1, len, ac.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(gain);
    gain.connect(ac.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

  return {
    /** 首次触摸时调用，满足自动播放策略 */
    unlock() { ensure(); },

    shoot() { tone({ freq: 900, to: 680, dur: 0.04, type: 'square', vol: 0.05 }); },

    hit() { tone({ freq: 320, to: 140, dur: 0.07, type: 'sawtooth', vol: 0.07 }); },

    boom() {
      noise({ dur: 0.24, vol: 0.14 });
      tone({ freq: 130, to: 45, dur: 0.22, type: 'triangle', vol: 0.1 });
    },

    pickup() {
      tone({ freq: 660, to: 990, dur: 0.08, type: 'sine', vol: 0.1 });
      tone({ freq: 990, to: 1320, dur: 0.1, type: 'sine', vol: 0.1, delay: 0.07 });
    },

    hurt() { tone({ freq: 220, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.16 }); },

    over() {
      tone({ freq: 440, to: 220, dur: 0.3, type: 'triangle', vol: 0.14 });
      tone({ freq: 220, to: 70, dur: 0.6, type: 'triangle', vol: 0.14, delay: 0.25 });
    },

    bossWarn() {
      tone({ freq: 240, dur: 0.18, type: 'square', vol: 0.1 });
      tone({ freq: 240, dur: 0.18, type: 'square', vol: 0.1, delay: 0.28 });
    },
  };
}

module.exports = { createAudio };
