// GERADO por gerar-provas.cjs a partir de prototipo/index.html (bloco SOM). Não editar à mão.
// @ts-nocheck
const SOM = (() => {
  const GANHO = 1.7;
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
  /** Ganho que nasce em 0 (o padrão do GainNode é 1 e deixava passar 1 amostra cheia antes do envelope). */
  function vca(ctx) { const g = ctx.createGain(); g.gain.value = 0; return g; }
  function tom(ctx, out, tipo, f, t, pico, ataque, queda, corte) {
    const o = osc(ctx, tipo, f), g = vca(ctx);
    envelope(g.gain, t, pico, ataque, queda);
    if (corte) o.connect(filtro(ctx, 'lowpass', corte)).connect(g); else o.connect(g);
    g.connect(out); o.start(t); o.stop(t + ataque + queda + 0.03);
    return o;
  }
  /** Zunido da linha: ruído em passa-banda que sobe e desce, com um assobio fino por baixo. */
  function lance(ctx, out, t) {
    const n = fonteRuido(ctx, t, 0.62), f = filtro(ctx, 'bandpass', 1200, 4), g = vca(ctx);
    f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(5200, t + 0.18); f.frequency.exponentialRampToValueAtTime(1500, t + 0.56);
    envelope(g.gain, t, 0.9, 0.06, 0.5);
    n.connect(f).connect(g).connect(out);
    const o = tom(ctx, out, 'sine', 900, t, 0.07, 0.05, 0.5);
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1900, t + 0.2); o.frequency.exponentialRampToValueAtTime(1100, t + 0.55);
  }
  /** Boia caindo: chuá de ruído que fecha o filtro e um "bloop" grave. */
  function splash(ctx, out, t, forca = 1) {
    const n = fonteRuido(ctx, t, 0.5), f = filtro(ctx, 'lowpass', 2600, 0.8), g = vca(ctx);
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.4);
    envelope(g.gain, t, 0.45 * forca, 0.004, 0.42);
    n.connect(f).connect(g).connect(out);
    const o = tom(ctx, out, 'sine', 340, t + 0.01, 0.3 * forca, 0.005, 0.15);
    o.frequency.setValueAtTime(340, t + 0.01); o.frequency.exponentialRampToValueAtTime(110, t + 0.15);
  }
  /** Beliscada: plic curto e baixo, para dar a falsa esperança. */
  function beliscada(ctx, out, t) {
    const o = tom(ctx, out, 'sine', 720, t, 0.2, 0.003, 0.07);
    o.frequency.setValueAtTime(720, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.07);
  }
  /** "!" da fisgada: dois bipes quadrados subindo. */
  function fisgada(ctx, out, t) {
    tom(ctx, out, 'square', 988, t, 0.28, 0.003, 0.1, 3800);
    tom(ctx, out, 'square', 1480, t + 0.07, 0.28, 0.003, 0.12, 3800);
  }
  /** Um dente da catraca do molinete; o jogo toca um por trecho de barra subido. */
  function catraca(ctx, out, t, v = 1) {
    const n = fonteRuido(ctx, t, 0.03), f = filtro(ctx, 'bandpass', 3400, 5), g = vca(ctx);
    envelope(g.gain, t, 1.4 * v, 0.001, 0.02);
    n.connect(f).connect(g).connect(out);
  }
  /** Pegou: arpejo curto em triângulo com a oitava de baixo em quadrada. */
  function pegou(ctx, out, t) {
    [72, 76, 79, 84].forEach((m, i) => {
      const d = i * 0.075, dur = i === 3 ? 0.42 : 0.1;
      tom(ctx, out, 'triangle', mtof(m), t + d, 0.34, 0.006, dur);
      tom(ctx, out, 'square', mtof(m - 12), t + d, 0.06, 0.006, dur, 2000);
    });
  }
  /** Escapou: tom que despenca com vibrato e a linha frouxa. */
  function escapou(ctx, out, t) {
    const o = tom(ctx, out, 'triangle', 520, t, 0.34, 0.01, 0.52), lfo = osc(ctx, 'sine', 9), prof = ctx.createGain();
    o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.5);
    prof.gain.value = 18; lfo.connect(prof).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.6);
    const s = tom(ctx, out, 'sawtooth', 150, t, 0.14, 0.004, 0.3, 700);
    s.frequency.setValueAtTime(150, t); s.frequency.exponentialRampToValueAtTime(90, t + 0.3);
  }
  /** Baú: quatro sinos subindo. */
  function bau(ctx, out, t) { [1568, 2093, 2637, 3136].forEach((f, i) => tom(ctx, out, 'sine', f, t + i * 0.06, 0.16, 0.004, 0.5)); }
  /** Linha do tempo das provas: um ciclo inteiro com todos os sons. */
  const SEQ = [['lance', 0.1], ['splash', 0.75, 0.9], ['beliscada', 1.5], ['fisgada', 2.2]];
  for (let k = 0; k < 18; k++) SEQ.push(['catraca', 2.6 + k * 0.055, 0.7 + (k % 3) * 0.1]);
  SEQ.push(['bau', 3.8], ['pegou', 4.5], ['escapou', 5.6]);
  const DURACAO_SEQ = 6.4;
  const SONS = { lance, splash, beliscada, fisgada, catraca, pegou, escapou, bau };
  function sequencia(ctx, out, t0) { for (const [nome, t, v] of SEQ) SONS[nome](ctx, out, t0 + t, v); }
  return { GANHO, SEQ, DURACAO_SEQ, SONS, sequencia, ...SONS };
})();

export default function criar() {
  return {
    criarSom(kit) { const g = kit.ctx.createGain(); g.gain.value = SOM.GANHO; g.connect(kit.destino); SOM.sequencia(kit.ctx, g, kit.ctx.currentTime); return { atualizar() {} } },
    atualizar() {},
    descartar() {},
  }
}
