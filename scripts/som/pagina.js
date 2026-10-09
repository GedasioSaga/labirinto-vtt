// Página de renderização do conferir-som (roda no Edge, montada pelo Vite).
// Renderiza o som de cada transição OFFLINE com o mesmo `criarSom` que o app
// usa e desenha o espectrograma que o Node calcula. Não é código do app: o
// scripts/conferir-som.cjs gera a entrada que importa as cenas e chama instalar().
import { carregarThree } from '@app/transicoes/motor'

// 48 kHz: a taxa mais comum da placa no Windows (o app usa a do aparelho).
const TAXA = 48000
// O motor chama pistas.atualizar(t) a cada quadro (requestAnimationFrame);
// 60 por segundo reproduz o mesmo atraso de até um quadro entre a pista e o som.
const QUADROS_POR_S = 60

function emBase64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength)
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * Mesmo kit do motor (tocarTransicao): ganho de volume no meio, ruído branco
 * reaproveitado. Volume 1 = o volume mais alto do app (o pior caso para corte).
 * O relógio é fingido: as pistas agendam em `ctx.currentTime`, que num
 * contexto offline fica em 0 até renderizar; aqui ele anda com o tempo da cena.
 */
async function renderizar(criar, duracaoNaturalS) {
  const THREE = await carregarThree()
  const offline = new OfflineAudioContext(2, Math.ceil(TAXA * duracaoNaturalS), TAXA)
  let agora = 0
  const ctx = new Proxy(offline, {
    get(alvo, chave) {
      if (chave === 'currentTime') return agora
      const v = Reflect.get(alvo, chave, alvo)
      return typeof v === 'function' ? v.bind(alvo) : v
    },
  })
  const volume = offline.createGain()
  volume.gain.value = 1
  volume.connect(offline.destination)
  const ruidos = new Map()
  const kit = {
    ctx,
    destino: volume,
    ruido: (segundos) => {
      const pronto = ruidos.get(segundos)
      if (pronto) return pronto
      const buffer = offline.createBuffer(1, Math.ceil(TAXA * segundos), TAXA)
      const dados = buffer.getChannelData(0)
      for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
      ruidos.set(segundos, buffer)
      return buffer
    },
  }
  const cena = criar(THREE, { reduzirMovimento: false })
  try {
    if (!cena.criarSom) return { semSom: true }
    const pistas = cena.criarSom(kit)
    // Mesma ordem do tick do motor: a cena anda, depois as pistas. O motor
    // para em t >= duração natural e fecha o contexto (o som corta ali).
    for (let i = 0; i / QUADROS_POR_S < duracaoNaturalS; i++) {
      agora = i / QUADROS_POR_S
      cena.atualizar(agora)
      pistas.atualizar(agora)
    }
    const buffer = await offline.startRendering()
    return { taxa: TAXA, canais: [0, 1].map((c) => emBase64(buffer.getChannelData(c))) }
  } finally {
    cena.descartar()
  }
}

// --- Espectrograma ----------------------------------------------------------

const DB_MIN = -110
const DB_MAX = 0
// Mapa de cor do escuro (silêncio) ao amarelo claro (forte), no espírito do "inferno".
const PARADAS = [
  [0, [0, 0, 4]],
  [0.25, [66, 10, 104]],
  [0.5, [147, 38, 103]],
  [0.7, [221, 81, 58]],
  [0.85, [252, 165, 10]],
  [1, [252, 255, 164]],
]

function cor(v) {
  const x = Math.max(0, Math.min(1, v))
  for (let i = 1; i < PARADAS.length; i++) {
    const [p1, c1] = PARADAS[i]
    const [p0, c0] = PARADAS[i - 1]
    if (x <= p1) {
      const k = (x - p0) / (p1 - p0)
      return c0.map((c, j) => Math.round(c + (c1[j] - c) * k))
    }
  }
  return PARADAS[PARADAS.length - 1][1]
}

const virgula = (v, c = 0) => v.toFixed(c).replace('.', ',')

/** Desenha o espectrograma + a envoltória embaixo e devolve o PNG (data URL). */
function desenhar({ titulo, subtitulo, espectro, envoltoria, passoEnvS, duracaoS, fimNaturalS, cliques }) {
  const ESQ = 64
  const LARG = espectro.db.length
  const DIR = 90
  const TOPO = 52
  const ALT_E = espectro.db[0].length
  const VAO = 34
  const ALT_V = 150
  const BASE = 46
  const canvas = document.createElement('canvas')
  canvas.width = ESQ + LARG + DIR
  canvas.height = TOPO + ALT_E + VAO + ALT_V + BASE
  const g = canvas.getContext('2d')
  g.fillStyle = '#fcfcfb'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.fillStyle = '#1d232b'
  g.font = 'bold 16px system-ui, "Segoe UI", sans-serif'
  g.fillText(titulo, ESQ, 22)
  g.font = '12px system-ui, "Segoe UI", sans-serif'
  g.fillStyle = '#5b6470'
  g.fillText(subtitulo, ESQ, 40)

  // Pixels do espectrograma: coluna = tempo, linha 0 (embaixo) = 20 Hz.
  const img = g.createImageData(LARG, ALT_E)
  espectro.db.forEach((coluna, x) => {
    coluna.forEach((v, r) => {
      const [cr, cg, cb] = cor((v - DB_MIN) / (DB_MAX - DB_MIN))
      const p = ((ALT_E - 1 - r) * LARG + x) * 4
      img.data[p] = cr
      img.data[p + 1] = cg
      img.data[p + 2] = cb
      img.data[p + 3] = 255
    })
  })
  g.putImageData(img, ESQ, TOPO)

  const xDoTempo = (t) => ESQ + (t / duracaoS) * LARG
  const yDaFreq = (f) => TOPO + ALT_E - (Math.log(f / espectro.fMin) / Math.log(espectro.fMax / espectro.fMin)) * ALT_E
  g.font = '11px system-ui, "Segoe UI", sans-serif'
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 16000]) {
    const y = yDaFreq(f)
    g.strokeStyle = 'rgba(255,255,255,0.18)'
    g.beginPath()
    g.moveTo(ESQ, y)
    g.lineTo(ESQ + LARG, y)
    g.stroke()
    g.fillStyle = '#1d232b'
    g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), ESQ - 6, y)
  }
  g.save()
  g.translate(16, TOPO + ALT_E / 2)
  g.rotate(-Math.PI / 2)
  g.textAlign = 'center'
  g.fillText('frequência (Hz, escala log)', 0, 0)
  g.restore()

  // Barra de cores.
  const xb = ESQ + LARG + 14
  for (let y = 0; y < ALT_E; y++) {
    const [cr, cg, cb] = cor(1 - y / ALT_E)
    g.fillStyle = `rgb(${cr},${cg},${cb})`
    g.fillRect(xb, TOPO + y, 14, 1)
  }
  g.textAlign = 'left'
  g.fillStyle = '#1d232b'
  for (let d = DB_MAX; d >= DB_MIN; d -= 20) g.fillText(`${d} dB`, xb + 18, TOPO + ((DB_MAX - d) / (DB_MAX - DB_MIN)) * ALT_E)

  // Envoltória (RMS e pico) de -60 a 0 dBFS.
  const topoV = TOPO + ALT_E + VAO
  const yDoDb = (d) => topoV + (Math.min(0, Math.max(-60, d)) / -60) * ALT_V
  g.fillStyle = '#ffffff'
  g.fillRect(ESQ, topoV, LARG, ALT_V)
  g.strokeStyle = '#e6e7e9'
  g.textAlign = 'right'
  for (const d of [0, -12, -24, -36, -48, -60]) {
    g.beginPath()
    g.moveTo(ESQ, yDoDb(d))
    g.lineTo(ESQ + LARG, yDoDb(d))
    g.stroke()
    g.fillStyle = '#1d232b'
    g.fillText(`${d}`, ESQ - 6, yDoDb(d))
  }
  g.save()
  g.translate(16, topoV + ALT_V / 2)
  g.rotate(-Math.PI / 2)
  g.textAlign = 'center'
  g.fillText('volume (dBFS)', 0, 0)
  g.restore()
  g.strokeStyle = '#c0392b'
  g.setLineDash([5, 4])
  g.beginPath()
  g.moveTo(ESQ, yDoDb(-1))
  g.lineTo(ESQ + LARG, yDoDb(-1))
  g.stroke()
  g.setLineDash([])
  const linha = (serie, estilo, largura) => {
    g.strokeStyle = estilo
    g.lineWidth = largura
    g.beginPath()
    serie.forEach((d, i) => {
      const x = xDoTempo((i + 0.5) * passoEnvS)
      const y = yDoDb(d === null ? -60 : d)
      i ? g.lineTo(x, y) : g.moveTo(x, y)
    })
    g.stroke()
    g.lineWidth = 1
  }
  linha(envoltoria.pico, '#9aa5b4', 1)
  linha(envoltoria.rms, '#1f5fa8', 1.5)
  g.textAlign = 'left'
  g.fillStyle = '#c0392b'
  g.fillText('-1 dBFS', ESQ + LARG + 6, yDoDb(-1))
  g.fillStyle = '#1f5fa8'
  g.fillText('RMS (10 ms)', ESQ + LARG + 6, yDoDb(-30))
  g.fillStyle = '#7d8896'
  g.fillText('pico', ESQ + LARG + 6, yDoDb(-42))

  // Fim natural (o app fecha o som aqui) e cliques achados.
  const marcar = (t, estilo, rotulo) => {
    const x = xDoTempo(t)
    g.strokeStyle = estilo
    g.beginPath()
    g.moveTo(x, TOPO)
    g.lineTo(x, topoV + ALT_V)
    g.stroke()
    g.fillStyle = estilo
    g.textAlign = 'center'
    g.fillText(rotulo, x, topoV + ALT_V + 32)
  }
  marcar(fimNaturalS, '#2e7d32', 'fim')
  cliques.forEach((t) => marcar(t, '#e53935', 'clique'))

  // Eixo do tempo em segundos.
  g.textAlign = 'center'
  g.textBaseline = 'top'
  g.fillStyle = '#1d232b'
  for (let s = 0; s <= duracaoS + 1e-9; s += 1) {
    const x = xDoTempo(s)
    g.fillRect(x, topoV + ALT_V, 1, 5)
    // O "0 s" encostado à esquerda não bate no "-60" do eixo do volume.
    g.textAlign = s === 0 ? 'left' : 'center'
    g.fillText(`${virgula(s)} s`, x, topoV + ALT_V + 7)
  }
  return canvas.toDataURL('image/png')
}

/**
 * `cenas`: { [id]: { fabrica: () => Promise<CriarCena>, duracaoNaturalS } }.
 * A fábrica é preguiçosa: um `await import()` no topo da entrada trava, porque
 * o chunk da cena embutida importa de volta o chunk da entrada (ciclo com
 * top-level await). Expõe as funções para o Playwright.
 */
export function instalar(cenas) {
  window.__renderizar = async (id) => renderizar(await cenas[id].fabrica(), cenas[id].duracaoNaturalS)
  window.__desenhar = desenhar
  window.__pronto = Object.keys(cenas)
}
