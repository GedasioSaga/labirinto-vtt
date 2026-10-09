'use strict'
/**
 * Medidas objetivas de um som renderizado (parte pura, sem navegador).
 *
 * Ninguém aqui consegue OUVIR a transição: a conferência do som é por número,
 * comparando com as transições que o mestre já aprovou. Cada função recebe
 * canais em Float32Array (valores em escala cheia: 1,0 = 0 dBFS) e a taxa.
 * Testes em medidas.test.cjs (node --test scripts/som/).
 */

const ESCALA_CHEIA = 1

/** dBFS de uma amplitude; silêncio vira -Infinity (o JSON grava como null). */
function db(amplitude) {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity
}

/** Soma dos canais em um só (média), para medidas que não olham o lado. */
function mono(canais) {
  if (canais.length === 1) return canais[0]
  const n = canais[0].length
  const m = new Float32Array(n)
  for (const c of canais) for (let i = 0; i < n; i++) m[i] += c[i] / canais.length
  return m
}

// ---------------------------------------------------------------------------
// Pico, corte e DC
// ---------------------------------------------------------------------------

function picoDeAmostra(canais) {
  let p = 0
  for (const c of canais) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]))
  return p
}

/** Amostras com |x| >= 1: na saída do app viram corte (o Web Audio entrega float, a placa não). */
function contarCortes(canais) {
  let n = 0
  for (const c of canais) for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) >= ESCALA_CHEIA) n++
  return n
}

/** Média de cada canal em % da escala cheia; devolve o pior (maior em módulo). */
function offsetDC(canais) {
  let pior = 0
  for (const c of canais) {
    let s = 0
    for (let i = 0; i < c.length; i++) s += c[i]
    const pct = (s / Math.max(1, c.length)) * 100
    if (Math.abs(pct) > Math.abs(pior)) pior = pct
  }
  return pior
}

// ---------------------------------------------------------------------------
// Pico verdadeiro (sobreamostragem 4x)
// ---------------------------------------------------------------------------

const MEIA_JANELA = 16 // amostras de cada lado no filtro de interpolação

/**
 * Filtro polifásico de interpolação (sinc com janela de Blackman). O pico
 * entre amostras é o que o conversor da placa reconstrói; um seno perto de
 * Nyquist pode ter amostras a -3 dB e o sinal real em 0 dB.
 */
function filtrosDeInterpolacao(fator) {
  const fases = []
  for (let f = 1; f < fator; f++) {
    const frac = f / fator
    const coef = []
    for (let k = -MEIA_JANELA + 1; k <= MEIA_JANELA; k++) {
      const x = k - frac
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
      const w = (x + MEIA_JANELA) / (2 * MEIA_JANELA)
      const blackman = 0.42 - 0.5 * Math.cos(2 * Math.PI * w) + 0.08 * Math.cos(4 * Math.PI * w)
      coef.push(sinc * blackman)
    }
    fases.push(coef)
  }
  return fases
}

function picoVerdadeiro(canais, fator = 4) {
  const fases = filtrosDeInterpolacao(fator)
  let p = picoDeAmostra(canais)
  for (const c of canais) {
    const n = c.length
    for (let i = 0; i < n - 1; i++) {
      // Só vale interpolar onde o vizinho já é alto: o pico entre amostras
      // nunca passa muito do maior dos dois vizinhos (poupa 90% do trabalho).
      if (Math.max(Math.abs(c[i]), Math.abs(c[i + 1])) < p * 0.5) continue
      for (const coef of fases) {
        let s = 0
        for (let j = 0; j < coef.length; j++) {
          const idx = i + j - MEIA_JANELA + 1
          if (idx >= 0 && idx < n) s += c[idx] * coef[j]
        }
        if (Math.abs(s) > p) p = Math.abs(s)
      }
    }
  }
  return p
}

// ---------------------------------------------------------------------------
// Volume (ITU-R BS.1770-4: ponderação K, LUFS integrado com gating)
// ---------------------------------------------------------------------------

/**
 * Coeficientes da ponderação K para qualquer taxa (mesmas fórmulas do
 * pyloudnorm; em 48 kHz batem com a tabela da norma).
 */
function coeficientesK(taxa) {
  const G = 3.99984385397
  const Q1 = 0.7071752369554193
  const fc1 = 1681.9744509555319
  const K1 = Math.tan((Math.PI * fc1) / taxa)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.499666774155)
  const a0p = 1 + K1 / Q1 + K1 * K1
  const prateleira = {
    b: [(Vh + (Vb * K1) / Q1 + K1 * K1) / a0p, (2 * (K1 * K1 - Vh)) / a0p, (Vh - (Vb * K1) / Q1 + K1 * K1) / a0p],
    a: [(2 * (K1 * K1 - 1)) / a0p, (1 - K1 / Q1 + K1 * K1) / a0p],
  }
  const Q2 = 0.5003270373253953
  const fc2 = 38.13547087613982
  const K2 = Math.tan((Math.PI * fc2) / taxa)
  const a0h = 1 + K2 / Q2 + K2 * K2
  const passaAlta = {
    b: [1, -2, 1],
    a: [(2 * (K2 * K2 - 1)) / a0h, (1 - K2 / Q2 + K2 * K2) / a0h],
  }
  return [prateleira, passaAlta]
}

function biquad(x, { b, a }) {
  const y = new Float64Array(x.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

function ponderarK(canal, taxa) {
  const [s1, s2] = coeficientesK(taxa)
  return biquad(biquad(canal, s1), s2)
}

/** Energia média ponderada de cada bloco (soma dos canais, peso 1 em L e R). */
function energiaPorBloco(canais, taxa, blocoS, passoS) {
  const pond = canais.map((c) => ponderarK(c, taxa))
  const tam = Math.round(blocoS * taxa)
  const passo = Math.round(passoS * taxa)
  const n = canais[0].length
  // Soma acumulada do quadrado: cada bloco sai em O(1).
  const acum = pond.map((c) => {
    const s = new Float64Array(n + 1)
    for (let i = 0; i < n; i++) s[i + 1] = s[i] + c[i] * c[i]
    return s
  })
  const blocos = []
  for (let ini = 0; ini + tam <= n; ini += passo) {
    let z = 0
    for (const s of acum) z += (s[ini + tam] - s[ini]) / tam
    blocos.push(z)
  }
  return blocos
}

const lufsDeEnergia = (z) => (z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity)

/** LUFS integrado: blocos de 400 ms (75% de sobreposição), porta absoluta -70 e relativa -10 LU. */
function lufsIntegrado(canais, taxa) {
  const blocos = energiaPorBloco(canais, taxa, 0.4, 0.1)
  const absolutos = blocos.filter((z) => lufsDeEnergia(z) > -70)
  if (absolutos.length === 0) return -Infinity
  const media = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
  const limiar = lufsDeEnergia(media(absolutos)) - 10
  const relativos = absolutos.filter((z) => lufsDeEnergia(z) > limiar)
  return lufsDeEnergia(media(relativos))
}

/** Maior volume de curto prazo (janela de 3 s, passo de 100 ms). Som mais curto que 3 s: a janela é o som todo. */
function lufsCurtoPrazoMax(canais, taxa) {
  const janela = Math.min(3, canais[0].length / taxa)
  const blocos = energiaPorBloco(canais, taxa, janela, 0.1)
  return blocos.length ? lufsDeEnergia(Math.max(...blocos)) : -Infinity
}

// ---------------------------------------------------------------------------
// Cliques
// ---------------------------------------------------------------------------

/**
 * Salto = degrau abrupto: a segunda diferença (x[n] - 2x[n-1] + x[n-2]) é
 * quase zero em sinal liso de qualquer frequência audível e só dispara num
 * degrau. O salto conta se for bem maior que a aspereza da vizinhança de
 * ±5 ms (sem a guarda de ±0,25 ms em volta dele): numa rajada de ruído (passo,
 * areia) a vizinhança é tão áspera quanto ele e nada dispara.
 *
 * Cada salto que sobra é classificado, porque nem todo degrau é defeito:
 *  - 'ataque': o volume SOBE de vez em volta dele (RMS dos 30 ms seguintes,
 *    pulando 2 ms, >= 4x o dos 30 ms anteriores). É o começo seco de um som
 *    (baque, tranco), um ataque esperado.
 *  - 'trem': há outro salto de tamanho parecido (>= 1/3) entre 10 e 120 ms
 *    dele. É textura de propósito: o rangido do portão é um dente de serra de
 *    11–55 pulsos por segundo ("trem de estalos"), e cada pulso é um degrau.
 *  - 'clique': o resto. Estalo solto no silêncio ou no meio de um som liso,
 *    ou um som cortado de repente (o volume CAI): é defeito.
 * Limite conhecido: um defeito que se repete a 8–100 por segundo (zíper de
 * ganho trocado a cada quadro) passaria como 'trem'; o espectrograma mostra.
 */
const CLIQUE_LIMIAR_ABS = 0.01 // salto mínimo (~-40 dBFS): abaixo disso não se ouve
const CLIQUE_FATOR = 12 // quantas vezes acima da aspereza da vizinhança
const CLIQUE_VIZINHANCA_S = 0.005
const CLIQUE_GUARDA_S = 0.00025
const CLIQUE_AGRUPAR_S = 0.01
const ATAQUE_JANELA_S = 0.03
const ATAQUE_PULO_S = 0.002
const ATAQUE_SUBIDA = 4 // RMS depois / antes (12 dB)
const TREM_MIN_S = 0.01
const TREM_MAX_S = 0.12
const TREM_PROPORCAO = 1 / 3

function detectarCliques(canais, taxa, opcoes = {}) {
  const limiarAbs = opcoes.limiarAbs ?? CLIQUE_LIMIAR_ABS
  const fator = opcoes.fator ?? CLIQUE_FATOR
  const viz = Math.max(4, Math.round(CLIQUE_VIZINHANCA_S * taxa))
  const guarda = Math.max(2, Math.round(CLIQUE_GUARDA_S * taxa))
  const jan = Math.round(ATAQUE_JANELA_S * taxa)
  const pulo = Math.round(ATAQUE_PULO_S * taxa)
  const tremMin = Math.round(TREM_MIN_S * taxa)
  const tremMax = Math.round(TREM_MAX_S * taxa)
  const achados = []
  canais.forEach((c, canal) => {
    const n = c.length
    const e = new Float64Array(n)
    for (let i = 2; i < n; i++) e[i] = c[i] - 2 * c[i - 1] + c[i - 2]
    const acumE = new Float64Array(n + 1)
    const acumX = new Float64Array(n + 1)
    for (let i = 0; i < n; i++) {
      acumE[i + 1] = acumE[i] + e[i] * e[i]
      acumX[i + 1] = acumX[i] + c[i] * c[i]
    }
    const lim = (k) => Math.min(n, Math.max(0, k))
    const media = (acum, a, b) => (lim(b) > lim(a) ? (acum[lim(b)] - acum[lim(a)]) / (lim(b) - lim(a)) : 0)
    // Quanto o salto em i sobressai da aspereza em volta (Infinity = em volta é liso/silêncio).
    const razaoEm = (i) => {
      const fora = acumE[lim(i - guarda)] - acumE[lim(i - viz)] + (acumE[lim(i + viz + 1)] - acumE[lim(i + guarda + 1)])
      const qtd = lim(i - guarda) - lim(i - viz) + (lim(i + viz + 1) - lim(i + guarda + 1))
      const rms = Math.sqrt(fora / Math.max(1, qtd))
      return rms > 0 ? Math.abs(e[i]) / rms : Infinity
    }
    const saltos = []
    for (let i = 2; i < n; i++) {
      const v = Math.abs(e[i])
      if (v < limiarAbs) continue
      const razao = razaoEm(i)
      if (razao >= fator) saltos.push({ amostra: i, canal, salto: v, razao })
    }
    for (const s of saltos) {
      const antes = Math.sqrt(media(acumX, s.amostra - pulo - jan, s.amostra - pulo))
      const depois = Math.sqrt(media(acumX, s.amostra + pulo, s.amostra + pulo + jan))
      if (depois > 0 && depois >= ATAQUE_SUBIDA * antes) s.tipo = 'ataque'
      else {
        // Outro pulso do mesmo trem: degrau parecido que também sobressai (com folga) da vizinhança.
        let vizinho = false
        for (let j = s.amostra - tremMax; j <= s.amostra + tremMax && !vizinho; j++) {
          if (j < 2 || j >= n || Math.abs(j - s.amostra) < tremMin) continue
          if (Math.abs(e[j]) >= s.salto * TREM_PROPORCAO && razaoEm(j) >= fator / 2) vizinho = true
        }
        s.tipo = vizinho ? 'trem' : 'clique'
      }
      achados.push(s)
    }
  })
  achados.sort((a, b) => a.amostra - b.amostra)
  // Saltos colados (impulso = +1, -2, +1; o mesmo estalo nos dois canais) contam
  // uma vez. Se um deles é clique, o evento é clique (o defeito não se esconde).
  const juntar = Math.round(CLIQUE_AGRUPAR_S * taxa)
  const peso = { ataque: 0, trem: 1, clique: 2 }
  const eventos = []
  for (const a of achados) {
    const ult = eventos[eventos.length - 1]
    if (ult && a.amostra - ult.fimAmostra <= juntar) {
      ult.fimAmostra = a.amostra
      if (a.salto > ult.salto) Object.assign(ult, { salto: a.salto, razao: a.razao })
      if (peso[a.tipo] > peso[ult.tipo]) ult.tipo = a.tipo
    } else eventos.push({ amostra: a.amostra, fimAmostra: a.amostra, salto: a.salto, razao: a.razao, tipo: a.tipo })
  }
  return eventos.map((ev) => ({
    t: ev.amostra / taxa,
    tipo: ev.tipo,
    saltoDbfs: db(ev.salto),
    razao: Number.isFinite(ev.razao) ? ev.razao : null,
  }))
}

// ---------------------------------------------------------------------------
// Silêncio, lados, espectro
// ---------------------------------------------------------------------------

const SILENCIO_ABS = 1e-6 // ~-120 dBFS: "silêncio total", não um som baixinho
const SILENCIO_MIN_S = 0.05

/** Trechos de silêncio total entre o primeiro e o último som (buraco no meio). */
function silenciosNoMeio(canais, taxa, minS = SILENCIO_MIN_S) {
  const m = canais
  const n = m[0].length
  const mudo = (i) => m.every((c) => Math.abs(c[i]) < SILENCIO_ABS)
  let primeiro = 0
  while (primeiro < n && mudo(primeiro)) primeiro++
  let ultimo = n - 1
  while (ultimo > primeiro && mudo(ultimo)) ultimo--
  const trechos = []
  let ini = -1
  for (let i = primeiro; i <= ultimo + 1; i++) {
    const quieto = i <= ultimo && mudo(i)
    if (quieto && ini < 0) ini = i
    if (!quieto && ini >= 0) {
      if ((i - ini) / taxa >= minS) trechos.push({ inicio: ini / taxa, fim: i / taxa })
      ini = -1
    }
  }
  return trechos
}

/** RMS do esquerdo menos o do direito, em dB (positivo = puxa para a esquerda); null se mono. */
function equilibrioLR(canais) {
  if (canais.length < 2) return null
  const rms = (c) => Math.sqrt(c.reduce((s, v) => s + v * v, 0) / Math.max(1, c.length))
  const l = rms(canais[0])
  const r = rms(canais[1])
  if (l === 0 && r === 0) return 0
  return db(l) - db(r)
}

/** FFT radix-2 no lugar (re, im com tamanho potência de 2). */
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/**
 * Magnitudes (escala cheia: seno de amplitude 1 = 1,0) de quadros com janela
 * de Hann. Devolve { quadros: Float64Array[], tamanho, passo }.
 */
function espectros(x, tamanho, passo) {
  const janela = new Float64Array(tamanho)
  let somaJ = 0
  for (let i = 0; i < tamanho; i++) {
    janela[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / tamanho)
    somaJ += janela[i]
  }
  const quadros = []
  const re = new Float64Array(tamanho)
  const im = new Float64Array(tamanho)
  for (let ini = 0; ini < x.length; ini += passo) {
    for (let i = 0; i < tamanho; i++) {
      const idx = ini + i - tamanho / 2 // quadro centrado em `ini`
      re[i] = idx >= 0 && idx < x.length ? x[idx] * janela[i] : 0
      im[i] = 0
    }
    fft(re, im)
    const mag = new Float64Array(tamanho / 2)
    for (let k = 0; k < tamanho / 2; k++) mag[k] = (2 * Math.hypot(re[k], im[k])) / somaJ
    quadros.push(mag)
  }
  return quadros
}

/** Centróide espectral (Hz) por segundo inteiro, ponderado pela energia; null onde é silêncio. */
function centroidePorSegundo(canais, taxa) {
  const x = mono(canais)
  const tam = 2048
  const passo = 1024
  const quadros = espectros(x, tam, passo)
  const segundos = Math.ceil(x.length / taxa)
  const num = new Float64Array(segundos)
  const den = new Float64Array(segundos)
  quadros.forEach((mag, q) => {
    const s = Math.min(segundos - 1, Math.floor((q * passo) / taxa))
    for (let k = 1; k < mag.length; k++) {
      const p = mag[k] * mag[k]
      num[s] += p * ((k * taxa) / tam)
      den[s] += p
    }
  })
  return Array.from(num, (v, s) => (den[s] > 1e-12 ? v / den[s] : null))
}

/**
 * Matriz do espectrograma em dBFS: colunas = tempo, linhas = frequência em
 * escala log de fMin a fMax (linha 0 = grave). Cada célula pega o maior bin
 * da faixa (não some pico estreito no agudo, onde a faixa tem muitos bins).
 */
function espectrograma(canais, taxa, { colunas = 1200, linhas = 300, fMin = 20, fMax = 16000, tamanho = 4096 } = {}) {
  const x = mono(canais)
  const passo = Math.max(1, Math.floor(x.length / colunas))
  const quadros = espectros(x, tamanho, passo).slice(0, colunas)
  const bin = (f) => (f * tamanho) / taxa
  const faixas = []
  for (let r = 0; r < linhas; r++) {
    const f0 = fMin * Math.pow(fMax / fMin, r / linhas)
    const f1 = fMin * Math.pow(fMax / fMin, (r + 1) / linhas)
    faixas.push([Math.floor(bin(f0)), Math.max(Math.floor(bin(f0)), Math.ceil(bin(f1)) - 1)])
  }
  const db_ = quadros.map((mag) =>
    faixas.map(([a, b]) => {
      let m = 0
      for (let k = a; k <= b && k < mag.length; k++) m = Math.max(m, mag[k])
      return m > 0 ? Math.max(-140, 20 * Math.log10(m)) : -140
    }),
  )
  return { passoS: passo / taxa, db: db_, fMin, fMax }
}

/** Envoltória: RMS e pico em dBFS a cada `passoS` (para desenhar embaixo do espectrograma). */
function envoltoria(canais, taxa, passoS) {
  const x = mono(canais)
  const passo = Math.max(1, Math.round(passoS * taxa))
  const rms = []
  const pico = []
  for (let ini = 0; ini < x.length; ini += passo) {
    let s = 0
    let p = 0
    const fim = Math.min(x.length, ini + passo)
    for (let i = ini; i < fim; i++) {
      s += x[i] * x[i]
      p = Math.max(p, Math.abs(x[i]))
    }
    rms.push(db(Math.sqrt(s / (fim - ini))))
    pico.push(db(p))
  }
  return { rms, pico }
}

// ---------------------------------------------------------------------------
// Tudo junto e o veredito
// ---------------------------------------------------------------------------

const arred = (v, casas = 2) => (Number.isFinite(v) ? Math.round(v * 10 ** casas) / 10 ** casas : null)

/** Cliques (defeito) com detalhe; ataques e pulsos de trem só contados, os trens como trechos. */
function saltosResumidos(saltos) {
  const trens = []
  for (const s of saltos.filter((x) => x.tipo === 'trem')) {
    const ult = trens[trens.length - 1]
    if (ult && s.t - ult.fim <= TREM_MAX_S) {
      ult.fim = s.t
      ult.pulsos++
    } else trens.push({ inicio: s.t, fim: s.t, pulsos: 1 })
  }
  return {
    cliques: saltos.filter((s) => s.tipo === 'clique').map((c) => ({ t: arred(c.t, 3), saltoDbfs: arred(c.saltoDbfs, 1), razao: arred(c.razao, 1) })),
    ataques: saltos.filter((s) => s.tipo === 'ataque').map((a) => arred(a.t, 3)),
    trensDePulsos: trens.map((t) => ({ inicio: arred(t.inicio, 3), fim: arred(t.fim, 3), pulsos: t.pulsos })),
  }
}

function medirTudo(canais, taxa) {
  return {
    duracaoS: arred(canais[0].length / taxa, 3),
    canais: canais.length,
    taxa,
    picoDbfs: arred(db(picoDeAmostra(canais))),
    picoVerdadeiroDbtp: arred(db(picoVerdadeiro(canais))),
    lufsIntegrado: arred(lufsIntegrado(canais, taxa)),
    lufsCurtoPrazoMax: arred(lufsCurtoPrazoMax(canais, taxa)),
    dcPct: arred(offsetDC(canais), 4),
    cortes: contarCortes(canais),
    ...saltosResumidos(detectarCliques(canais, taxa)),
    silenciosNoMeio: silenciosNoMeio(canais, taxa).map((s) => ({ inicio: arred(s.inicio, 3), fim: arred(s.fim, 3) })),
    equilibrioLRdb: arred(equilibrioLR(canais)),
    centroideHzPorSegundo: centroidePorSegundo(canais, taxa).map((v) => (v === null ? null : Math.round(v))),
  }
}

function mediana(valores) {
  const v = valores.filter(Number.isFinite).sort((a, b) => a - b)
  if (v.length === 0) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

const LIMITE_PICO_VERDADEIRO = -1
const LIMITE_DC_PCT = 0.5
const TOLERANCIA_LU = 3

/** Lista de motivos de reprovação (vazia = passa). `medianaLufs` vem das transições aprovadas. */
function julgar(m, medianaLufs) {
  const motivos = []
  const virg = (v, c = 1) => (v === null ? '?' : v.toFixed(c).replace('.', ','))
  if (m.picoVerdadeiroDbtp === null) motivos.push('o som está mudo (nenhuma amostra acima de zero)')
  else if (m.picoVerdadeiroDbtp > LIMITE_PICO_VERDADEIRO) motivos.push(`pico verdadeiro ${virg(m.picoVerdadeiroDbtp)} dBTP passa de ${LIMITE_PICO_VERDADEIRO} dBTP: pode distorcer na placa de som`)
  if (m.cortes > 0) motivos.push(`${m.cortes} amostra(s) cortada(s) (|x| >= 1): distorce`)
  if (m.cliques.length > 0) motivos.push(`${m.cliques.length} clique(s) em ${m.cliques.map((c) => `${virg(c.t, 3)} s`).join(', ')}: estalo seco fora de um ataque`)
  if (Math.abs(m.dcPct) > LIMITE_DC_PCT) motivos.push(`offset DC de ${virg(m.dcPct, 2)}% (limite ${virg(LIMITE_DC_PCT)}%): gasta volume à toa e estala ao começar/parar`)
  if (medianaLufs !== null && m.lufsIntegrado !== null && Math.abs(m.lufsIntegrado - medianaLufs) > TOLERANCIA_LU) {
    const dif = m.lufsIntegrado - medianaLufs
    motivos.push(`volume ${virg(m.lufsIntegrado)} LUFS está ${virg(Math.abs(dif))} LU ${dif > 0 ? 'ACIMA' : 'ABAIXO'} da mediana das aprovadas (${virg(medianaLufs)} LUFS; tolerância ±${TOLERANCIA_LU} LU): vai soar muito ${dif > 0 ? 'mais alto' : 'mais baixo'} que as outras`)
  }
  return motivos
}

/** WAV PCM 16 bits intercalado (o .wav que o usuário ouve). */
function wav16(canais, taxa) {
  const n = canais[0].length
  const nc = canais.length
  const buf = Buffer.alloc(44 + n * nc * 2)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + n * nc * 2, 4)
  buf.write('WAVEfmt ', 8, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(nc, 22)
  buf.writeUInt32LE(taxa, 24)
  buf.writeUInt32LE(taxa * nc * 2, 28)
  buf.writeUInt16LE(nc * 2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(n * nc * 2, 40)
  let pos = 44
  for (let i = 0; i < n; i++) {
    for (const c of canais) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, c[i])) * 32767), pos)
      pos += 2
    }
  }
  return buf
}

module.exports = {
  db,
  mono,
  picoDeAmostra,
  picoVerdadeiro,
  contarCortes,
  offsetDC,
  lufsIntegrado,
  lufsCurtoPrazoMax,
  detectarCliques,
  silenciosNoMeio,
  equilibrioLR,
  centroidePorSegundo,
  espectrograma,
  envoltoria,
  medirTudo,
  mediana,
  julgar,
  wav16,
  LIMITE_PICO_VERDADEIRO,
  LIMITE_DC_PCT,
  TOLERANCIA_LU,
}
