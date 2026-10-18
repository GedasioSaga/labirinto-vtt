// GERADO por gerar-provas.cjs a partir de prototipo/index.html (bloco SOM). Não editar à mão.
// @ts-nocheck
const SOM = (() => {
  const GANHO = 1.0;
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
    n.buffer = ruido(ctx); n.loop = true;
    giro = (giro + 0.173) % 0.7;
    n.start(t, giro); n.stop(t + dur);
    return n;
  }
  function filtro(ctx, tipo, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q; return b; }
  function osc(ctx, tipo, f) { const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = f; return o; }
  /** Ganho que nasce em 0 (o padrão do GainNode é 1 e deixaria passar uma amostra cheia antes do envelope). */
  function vca(ctx) { const g = ctx.createGain(); g.gain.value = 0; return g; }
  function tom(ctx, out, tipo, f, t, pico, ataque, queda, corte) {
    const o = osc(ctx, tipo, f), g = vca(ctx);
    envelope(g.gain, t, pico, ataque, queda);
    if (corte) o.connect(filtro(ctx, 'lowpass', corte)).connect(g); else o.connect(g);
    g.connect(out); o.start(t); o.stop(t + ataque + queda + 0.03);
    return o;
  }
  function chiado(ctx, out, t, tipo, f, q, pico, ataque, queda) {
    const n = fonteRuido(ctx, t, ataque + queda + 0.03), b = filtro(ctx, tipo, f, q), g = vca(ctx);
    envelope(g.gain, t, pico, ataque, queda); n.connect(b).connect(g).connect(out);
    return b;
  }
  const desce = (p, de, para, t, d) => { p.setValueAtTime(de, t); p.exponentialRampToValueAtTime(para, t + d); };
  /** Cadeia de saída: ganho geral e um compressor rápido que segura os picos quando tiros se encostam. */
  function cadeia(ctx, destino) {
    const g = ctx.createGain(), c = ctx.createDynamicsCompressor();
    g.gain.value = GANHO; c.threshold.value = -9; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.12;
    g.connect(c).connect(destino);
    return g;
  }
  /** Tiro de revólver: estalo agudo, corpo de ruído que fecha, baque grave e um rabo de sala. */
  function tiro(ctx, out, t) {
    chiado(ctx, out, t, 'highpass', 1800, 0.7, 0.26, 0.001, 0.05);
    desce(chiado(ctx, out, t, 'lowpass', 3200, 0.9, 0.32, 0.002, 0.32).frequency, 3200, 260, t, 0.3);
    desce(tom(ctx, out, 'sine', 150, t, 0.36, 0.002, 0.2).frequency, 150, 42, t, 0.16);
    chiado(ctx, out, t + 0.02, 'bandpass', 700, 0.6, 0.06, 0.03, 0.55);
  }
  /** Acerto na madeira: "toc" seco, um pouco depois do tiro. */
  function madeira(ctx, out, t) {
    t += 0.025;
    desce(tom(ctx, out, 'sine', 620, t, 0.32, 0.002, 0.1).frequency, 620, 280, t, 0.08);
    tom(ctx, out, 'triangle', 1240, t, 0.1, 0.001, 0.04);
    chiado(ctx, out, t, 'bandpass', 1500, 3, 0.3, 0.001, 0.035);
  }
  /** Garrafa: estilhaço de ruído agudo e quatro tilintares. */
  function vidro(ctx, out, t) {
    t += 0.02;
    chiado(ctx, out, t, 'highpass', 3000, 0.7, 0.3, 0.001, 0.12);
    [2900, 3700, 4600, 5300].forEach((f, i) => tom(ctx, out, 'sine', f, t + 0.02 + i * 0.035, 0.07, 0.002, 0.18));
  }
  /** Moeda: dois sinos claros, a segunda nota mais longa. */
  function moeda(ctx, out, t) {
    t += 0.02;
    tom(ctx, out, 'sine', 1976, t, 0.2, 0.002, 0.28);
    tom(ctx, out, 'sine', 2637, t + 0.07, 0.2, 0.002, 0.45);
    tom(ctx, out, 'triangle', 3951, t + 0.07, 0.04, 0.002, 0.3);
  }
  /** Ricochete do erro: assobio que cai com um tremido. */
  function ricochete(ctx, out, t) {
    t += 0.03;
    const o = tom(ctx, out, 'sine', 2800, t, 0.12, 0.01, 0.32), lfo = osc(ctx, 'sine', 31), prof = ctx.createGain();
    desce(o.frequency, 2800, 1000, t, 0.3);
    prof.gain.value = 60; lfo.connect(prof).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.36);
  }
  /** Clique seco do cão batendo na câmara vazia. */
  function seco(ctx, out, t, v = 1) {
    chiado(ctx, out, t, 'bandpass', 4200, 6, 0.55 * v, 0.001, 0.014);
    tom(ctx, out, 'square', 2200, t, 0.04 * v, 0.001, 0.016, 5000);
  }
  /** Engatilhar: dois estalos metálicos. */
  function engatilhar(ctx, out, t) {
    chiado(ctx, out, t, 'bandpass', 3000, 5, 0.4, 0.001, 0.015);
    chiado(ctx, out, t + 0.08, 'bandpass', 2200, 4, 0.5, 0.001, 0.02);
    tom(ctx, out, 'sine', 900, t + 0.08, 0.05, 0.001, 0.03);
  }
  /** Tambor girando na recarga: zunido baixo e uma catraca de 12 dentes (passo de até 0,1 s, para soar como giro e não como estalos soltos). */
  function tambor(ctx, out, t, dura = 1) {
    chiado(ctx, out, t, 'lowpass', 700, 0.7, 0.05, 0.05, dura * 0.85);
    const passo = Math.min(0.1, (dura * 0.6) / 12);
    for (let i = 0; i < 12; i++) chiado(ctx, out, t + 0.06 + i * passo, 'bandpass', 3600, 6, 0.32, 0.001, 0.012);
  }
  /** Alvo proibido: zumbido dissonante que desce. */
  function proibido(ctx, out, t) {
    t += 0.03;
    tom(ctx, out, 'square', 196, t, 0.1, 0.004, 0.34, 1400);
    tom(ctx, out, 'square', 208, t, 0.1, 0.004, 0.34, 1400);
    desce(tom(ctx, out, 'triangle', 330, t, 0.16, 0.004, 0.32).frequency, 330, 160, t, 0.3);
  }
  /** Sino do fim: duas batidas com parciais de sino. */
  function sino(ctx, out, t) {
    for (const d of [0, 0.32]) [[1, 0.16, 1.6], [2, 0.07, 1], [2.76, 0.055, 0.7], [4.07, 0.028, 0.4], [5.4, 0.02, 0.25]].forEach(([k, a, q]) => tom(ctx, out, 'sine', 740 * k, t + d, a, 0.002, q));
  }
  /** Realejo de feira: valsa curta e baixa (oom-pa-pa), timbre de tubo. */
  function realejo(ctx, out, t) {
    const b = 0.17, mel = [[67, 1], [72, 1], [76, 1], [79, 2], [77, 1], [76, 1], [74, 1], [76, 2], [72, 1], [67, 1], [72, 3]];
    let k = 0;
    for (const [m, d] of mel) {
      const ti = t + k * b, du = d * b * 0.92;
      tom(ctx, out, 'square', mtof(m), ti, 0.035, 0.012, du, 1600);
      tom(ctx, out, 'triangle', mtof(m) * 1.0035, ti, 0.04, 0.012, du);
      k += d;
    }
    for (let c = 0; c < Math.ceil(k / 3); c++) {
      const ti = t + c * 3 * b, raiz = c % 2 ? 43 : 48;
      tom(ctx, out, 'triangle', mtof(raiz), ti, 0.07, 0.01, b * 0.9);
      [1, 2].forEach((j) => { tom(ctx, out, 'triangle', mtof(raiz + 16), ti + j * b, 0.03, 0.01, b * 0.6); tom(ctx, out, 'triangle', mtof(raiz + 19), ti + j * b, 0.03, 0.01, b * 0.6); });
    }
  }
  /** Catálogo das provas: todos os sons, um depois do outro. */
  const SEQ = [['realejo', 0.1], ['engatilhar', 3.0], ['tiro', 3.5], ['madeira', 3.5], ['tiro', 4.2], ['ricochete', 4.2], ['tiro', 4.9], ['vidro', 4.9], ['tiro', 5.6], ['moeda', 5.6], ['tiro', 6.3], ['proibido', 6.3], ['seco', 7.0], ['seco', 7.25], ['tambor', 7.6, 1.0], ['engatilhar', 8.65], ['sino', 9.2]];
  const DURACAO_SEQ = 11.2;
  const SONS = { tiro, madeira, vidro, moeda, ricochete, seco, engatilhar, tambor, proibido, sino, realejo };
  function sequencia(ctx, out, t0) { for (const [nome, t, v] of SEQ) SONS[nome](ctx, out, t0 + t, v); }
  return { GANHO, SEQ, DURACAO_SEQ, SONS, cadeia, sequencia, ...SONS };
})();

export default function criar() {
  return {
    criarSom(kit) { const e = SOM.cadeia(kit.ctx, kit.destino); SOM.sequencia(kit.ctx, e, kit.ctx.currentTime); return { atualizar() {} } },
    atualizar() {},
    descartar() {},
  }
}
