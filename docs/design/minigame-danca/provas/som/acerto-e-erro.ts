// GERADO por gerar-provas.cjs a partir de prototipo/index.html (bloco SOM). Não editar à mão.
// @ts-nocheck
const SOM = (() => {
  const BPM = 116;
  const PASSO = 60 / BPM / 4;
  const COMPASSO = PASSO * 16;
  const ULTIMO = 21;
  const DURACAO = ULTIMO * COMPASSO + 2.2;
  const GANHO = 0.42;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const ruidos = new WeakMap();
  let giro = 0;

  function ruido(ctx) {
    let b = ruidos.get(ctx);
    if (!b) {
      b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      let s = 0x2545f491;
      for (let i = 0; i < d.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 4294967296) * 2 - 1; }
      ruidos.set(ctx, b);
    }
    return b;
  }
  function envelope(p, t, pico, ataque, queda) {
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(pico, t + ataque);
    p.exponentialRampToValueAtTime(0.0001, t + ataque + queda);
  }
  function fonteRuido(ctx, t, dur) {
    const n = ctx.createBufferSource();
    n.buffer = ruido(ctx);
    n.loop = true;
    giro = (giro + 0.173) % 0.7;
    n.start(t, giro);
    n.stop(t + dur);
    return n;
  }
  function filtro(ctx, tipo, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q; return b; }
  function osc(ctx, tipo, f) { const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = f; return o; }
  /** Ganho que nasce em 0. O padrão do GainNode é 1: quando o início cai bem numa amostra, o som passava
      1 amostra cheia antes do envelope valer, e isso era o estalo de 7,5 s da faixa demo. */
  function vca(ctx) { const g = ctx.createGain(); g.gain.value = 0; return g; }

  const INST = {
    bumbo(ctx, out, t, e) {
      const o = osc(ctx, 'sine', 150), g = vca(ctx);
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      envelope(g.gain, t, 0.9 * e.v, 0.003, 0.36);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.42);
      const n = fonteRuido(ctx, t, 0.03), f = filtro(ctx, 'lowpass', 2600), gn = vca(ctx);
      envelope(gn.gain, t, 0.2 * e.v, 0.001, 0.016);
      n.connect(f).connect(gn).connect(out);
    },
    caixa(ctx, out, t, e) {
      const n = fonteRuido(ctx, t, 0.22), f = filtro(ctx, 'highpass', 1100), g = vca(ctx);
      envelope(g.gain, t, 0.42 * e.v, 0.002, 0.16);
      n.connect(f).connect(g).connect(out);
      const o = osc(ctx, 'triangle', 196), go = vca(ctx);
      o.frequency.setValueAtTime(196, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      envelope(go.gain, t, 0.34 * e.v, 0.002, 0.08);
      o.connect(go).connect(out); o.start(t); o.stop(t + 0.12);
    },
    palma(ctx, out, t, e) {
      const n = fonteRuido(ctx, t, 0.24), f = filtro(ctx, 'bandpass', 1450, 1.3), g = vca(ctx), p = g.gain;
      p.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) { const ti = t + i * 0.011; p.exponentialRampToValueAtTime(0.5 * e.v, ti + 0.001); p.exponentialRampToValueAtTime(0.06 * e.v, ti + 0.009); }
      p.exponentialRampToValueAtTime(0.32 * e.v, t + 0.035);
      p.exponentialRampToValueAtTime(0.0001, t + 0.2);
      n.connect(f).connect(g).connect(out);
    },
    chimbal(ctx, out, t, e) {
      const d = e.aberto ? 0.24 : 0.04;
      const n = fonteRuido(ctx, t, d + 0.05), f = filtro(ctx, 'highpass', 7200), g = vca(ctx);
      envelope(g.gain, t, 0.15 * e.v, 0.001, d);
      n.connect(f).connect(g).connect(out);
    },
    prato(ctx, out, t, e) {
      const n = fonteRuido(ctx, t, 1.9), f = filtro(ctx, 'highpass', 3800), g = vca(ctx);
      envelope(g.gain, t, 0.13 * e.v, 0.002, 1.7);
      n.connect(f).connect(g).connect(out);
    },
    baqueta(ctx, out, t, e) {
      for (const [f, a] of [[1850, 0.3], [2750, 0.12]]) {
        const o = osc(ctx, 'sine', f), g = vca(ctx);
        envelope(g.gain, t, a * e.v, 0.001, 0.06);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.08);
      }
    },
    baixo(ctx, out, t, e) {
      const f0 = mtof(e.midi), dur = Math.max(0.1, e.dur);
      const o = osc(ctx, 'sawtooth', f0), s = osc(ctx, 'sine', f0);
      const lp = filtro(ctx, 'lowpass', 1500, 5);
      lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(320, t + 0.14);
      const g = vca(ctx), p = g.gain;
      p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(0.3 * e.v, t + 0.005);
      p.exponentialRampToValueAtTime(0.2 * e.v, t + 0.1); p.setValueAtTime(0.2 * e.v, t + dur);
      p.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
      const gs = vca(ctx); gs.gain.value = 0.9;
      o.connect(lp); s.connect(gs).connect(lp); lp.connect(g).connect(out);
      const fim = t + dur + 0.07; o.start(t); s.start(t); o.stop(fim); s.stop(fim);
    },
    batida(ctx, out, t, e) {
      const f = filtro(ctx, 'bandpass', 1700, 0.8), g = vca(ctx);
      f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(2300, t + 0.05);
      envelope(g.gain, t, 0.07 * e.v, 0.002, 0.11);
      f.connect(g).connect(out);
      for (const m of e.notas) { const o = osc(ctx, 'square', mtof(m)); o.detune.value = ((m % 3) - 1) * 6; o.connect(f); o.start(t); o.stop(t + 0.14); }
    },
    melodia(ctx, out, t, e) {
      const f0 = mtof(e.midi), o = osc(ctx, 'square', f0), tri = osc(ctx, 'triangle', f0 * 2);
      const vib = osc(ctx, 'sine', 5.5), gv = vca(ctx);
      gv.gain.setValueAtTime(0, t); gv.gain.linearRampToValueAtTime(7, t + Math.min(0.25, e.dur));
      vib.connect(gv); gv.connect(o.detune); gv.connect(tri.detune);
      const lp = filtro(ctx, 'lowpass', 2600, 0.6), g = vca(ctx), p = g.gain, gt = vca(ctx);
      gt.gain.value = 0.35;
      p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(0.085 * e.v, t + 0.01);
      p.setValueAtTime(0.085 * e.v, t + e.dur); p.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.08);
      o.connect(lp); tri.connect(gt).connect(lp); lp.connect(g).connect(out);
      const fim = t + e.dur + 0.1;
      for (const x of [o, tri, vib]) { x.start(t); x.stop(fim); }
    },
    tapete(ctx, out, t, e) {
      const lp = filtro(ctx, 'lowpass', 1100, 0.5), g = vca(ctx), p = g.gain;
      p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(0.045 * e.v, t + 0.3);
      p.setValueAtTime(0.045 * e.v, t + e.dur); p.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.45);
      lp.connect(g).connect(out);
      for (const m of e.notas) for (const d of [-8, 8]) { const o = osc(ctx, 'sawtooth', mtof(m)); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + e.dur + 0.5); }
    },
  };

  // Mi dórico: Em7 e A se alternando, riff de baixo de dois compassos e um tema pentatônico.
  const RIFF_A = [[0, 40, 3], [3, 52, 1], [6, 43, 2], [8, 45, 2], [11, 47, 2], [14, 50, 2]];
  const RIFF_B = [[0, 40, 3], [3, 52, 1], [6, 43, 2], [8, 47, 2], [10, 45, 2], [12, 43, 2], [14, 40, 2]];
  const FRASE_1 = [[0, 64, 2], [2, 67, 2], [4, 69, 3], [7, 71, 1], [8, 69, 2], [10, 67, 2], [12, 64, 4], [16, 62, 2], [18, 64, 2], [20, 67, 4], [24, 69, 2], [26, 67, 2], [28, 64, 4]];
  const FRASE_2 = [[0, 71, 2], [2, 74, 2], [4, 71, 2], [6, 69, 2], [8, 67, 4], [12, 69, 2], [14, 71, 2], [16, 76, 4], [20, 74, 2], [22, 71, 2], [24, 69, 3], [27, 67, 1], [28, 64, 4]];
  const EM7 = [52, 55, 59, 62], LA = [57, 61, 64], SOL = [55, 59, 62], RE = [50, 54, 57];

  /** Seções: 0 contagem · 1-4 entrada · 5-12 balanço com tema · 13-16 pausa com notas longas · 17-20 final · 21 acorde. */
  function secaoDe(c) { return c === 0 ? 'contagem' : c <= 4 ? 'entrada' : c <= 12 ? 'balanco' : c <= 16 ? 'pausa' : c <= 20 ? 'final' : 'fim'; }

  function eventos() {
    const ev = [];
    const add = (c, p, inst, v, extra) => ev.push(Object.assign({ t: (c * 16 + p) * PASSO, c, p, inst, v }, extra));
    for (let b = 0; b < 4; b++) add(0, b * 4, 'baqueta', b === 0 ? 0.9 : 0.6);
    for (let c = 1; c <= 20; c++) {
      const secao = secaoDe(c), par = c % 2 === 0;
      if (secao === 'pausa') {
        add(c, 0, 'bumbo', 0.9); add(c, 4, 'palma', 0.8); add(c, 12, 'palma', 0.8);
        for (const p of [2, 6, 10, 14]) add(c, p, 'chimbal', 0.5, { aberto: true });
        const longas = { 13: [[0, 40, 8], [8, 43, 8]], 14: [[0, 45, 16]], 15: [[0, 43, 8], [8, 47, 8]], 16: [[0, 50, 8]] }[c];
        for (const [p, m, d] of longas) add(c, p, 'baixo', 0.85, { midi: m, dur: d * PASSO * 0.96 });
        add(c, 0, 'tapete', 0.8, { notas: { 13: EM7, 14: LA, 15: SOL, 16: RE }[c], dur: (c === 16 ? 8 : 16) * PASSO });
        if (c === 16) for (let p = 8; p < 16; p++) add(c, p, 'caixa', 0.35 + 0.06 * (p - 8));
        continue;
      }
      for (const p of secao === 'entrada' ? [0, 8] : [0, 7, 8, 10]) add(c, p, 'bumbo', p === 0 ? 1 : 0.85);
      add(c, 4, 'caixa', 0.9); add(c, 12, 'caixa', 0.9);
      if (secao !== 'entrada') add(c, 14, 'caixa', 0.22);
      if (secao === 'final') { add(c, 4, 'palma', 0.6); add(c, 12, 'palma', 0.6); }
      for (let p = 0; p < 16; p += secao === 'entrada' ? 2 : 1) add(c, p, 'chimbal', p % 4 === 0 ? 0.6 : p % 2 === 0 ? 0.42 : 0.22, { aberto: p === 14 && !par && secao !== 'entrada' });
      if (c === 5 || c === 9 || c === 17) add(c, 0, 'prato', 0.8);
      for (const [p, m, d] of par ? RIFF_B : RIFF_A) add(c, p, 'baixo', 0.8, { midi: m, dur: d * PASSO * 0.92 });
      if (c >= 3) for (const p of [2, 6, 10, 14]) add(c, p, 'batida', 0.55, { notas: par ? LA : EM7 });
      if (secao !== 'entrada') {
        const frase = (c >= 9 && c <= 12) || c >= 19 ? FRASE_2 : FRASE_1;
        const metade = (c - 1) % 2;
        for (const [p, m, d] of frase) if (Math.floor(p / 16) === metade) add(c, p % 16, 'melodia', 0.8, { midi: m, dur: d * PASSO * 0.95 });
      }
    }
    add(ULTIMO, 0, 'bumbo', 1); add(ULTIMO, 0, 'prato', 1);
    add(ULTIMO, 0, 'batida', 0.9, { notas: EM7 });
    add(ULTIMO, 0, 'baixo', 0.9, { midi: 40, dur: 1.3 });
    add(ULTIMO, 0, 'tapete', 0.9, { notas: EM7, dur: 1.6 });
    add(ULTIMO, 0, 'melodia', 0.8, { midi: 76, dur: 1.2 });
    return ev.sort((a, b) => a.t - b.t);
  }

  function agendar(ctx, destino, lista, t0) {
    const pan = { chimbal: 0.3, batida: -0.25, melodia: 0.12, prato: -0.15, palma: 0.08 };
    const bus = {};
    for (const k of Object.keys(INST)) {
      if (pan[k] && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan[k]; p.connect(destino); bus[k] = p; } else bus[k] = destino;
    }
    for (const e of lista) INST[e.inst](ctx, bus[e.inst], t0 + e.t, e);
  }

  async function renderizar(taxa = 48000) {
    const off = new OfflineAudioContext(2, Math.ceil(taxa * DURACAO), taxa);
    const g = off.createGain();
    g.gain.value = GANHO;
    g.connect(off.destination);
    agendar(off, g, eventos(), 0);
    return off.startRendering();
  }

  /** "Toc" curto de madeira no acerto. Baixo de propósito: não pode cobrir a música. */
  function acerto(ctx, out, t, forte) {
    const o = osc(ctx, 'sine', forte ? 1568 : 1319), g = vca(ctx);
    envelope(g.gain, t, 0.16, 0.001, 0.05);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.07);
  }
  /** "Tum" abafado no erro; na Diversão sai mais baixo. */
  function erro(ctx, out, t, gentil) {
    const o = osc(ctx, 'triangle', 170), lp = filtro(ctx, 'lowpass', 700), g = vca(ctx);
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(85, t + 0.13);
    envelope(g.gain, t, gentil ? 0.1 : 0.18, 0.004, 0.14);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 0.18);
  }
  function clique(ctx, out, t, forte) {
    const o = osc(ctx, 'sine', forte ? 1760 : 1175), g = vca(ctx);
    envelope(g.gain, t, forte ? 0.3 : 0.2, 0.001, 0.05);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.07);
  }

  return { BPM, PASSO, COMPASSO, ULTIMO, DURACAO, GANHO, secaoDe, eventos, agendar, renderizar, acerto, erro, clique };
})();

export default function criar() {
  return {
    criarSom(kit) { const g = kit.ctx.createGain(); g.gain.value = SOM.GANHO * 2; g.connect(kit.destino); const t = kit.ctx.currentTime; SOM.acerto(kit.ctx, g, t + 0.1, true); SOM.acerto(kit.ctx, g, t + 0.35, false); SOM.erro(kit.ctx, g, t + 0.6, true); SOM.erro(kit.ctx, g, t + 0.9, false); return { atualizar() {} } },
    atualizar() {},
    descartar() {},
  }
}
