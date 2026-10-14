import { CARIMBOS_EMBUTIDOS, css, type DefinicaoDeCarimbo } from 'C:/dev/labirinto/client/src/carimbos/embutidos'
import { ALFA_DA_SOMBRA, assarDesenho, miniaturaDaArte, QUADRO_DA_SOMBRA, type ArteEmTela } from 'C:/dev/labirinto/client/src/carimbos/arte'
import desenharGirassois from 'C:/dev/labirinto/client/src/animacoes/carimbo/girassois'
import desenharGirassol from 'C:/dev/labirinto/client/src/animacoes/carimbo/girassol'

const GIRASSOIS: DefinicaoDeCarimbo = { id: 'girassois', nome: 'Girassóis', tamanho: 9, sombra: 'em-pe', desenhar: desenharGirassois }
const GIRASSOL: DefinicaoDeCarimbo = { id: 'girassol', nome: 'Girassol', tamanho: 9, sombra: 'em-pe', desenhar: desenharGirassol }
const TODOS = [...CARIMBOS_EMBUTIDOS, GIRASSOL, GIRASSOIS]
const porId = (id: string) => TODOS.find((c) => c.id === id) as DefinicaoDeCarimbo
const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1))

const cache = new Map<string, ArteEmTela | null>()
function arte(def: DefinicaoDeCarimbo, variante: number): ArteEmTela | null {
  const chave = `${def.id}:${variante}`
  if (!cache.has(chave)) cache.set(chave, assarDesenho(def.desenhar, def.sombra, (variante * Math.PI) / 4, variante, 384))
  return cache.get(chave) ?? null
}

// 1. O painel OBJETO, como no app.
const painel = document.getElementById('painel') as HTMLElement
TODOS.forEach((def, i) => {
  const a = arte(def, 0)
  const tile = document.createElement('figure')
  tile.className = def.id.startsWith('girasso') ? 'tile novo' : 'tile'
  const mini = a === null ? null : miniaturaDaArte(a, Math.round(80 * DPR))
  if (mini !== null) {
    mini.style.width = '80px'
    mini.style.height = '80px'
    tile.append(mini)
  }
  const nome = document.createElement('figcaption')
  nome.textContent = def.nome
  tile.append(nome)
  painel.append(tile)
  void i
})

// 2. No mapa: sombras numa camada só (como o drawCarimbos), depois os corpos.
interface Posto { id: string; x: number; y: number; v: number }
function pintarMapa(canvas: HTMLCanvasElement, largura: number, altura: number, escala: number, postos: Posto[], chao: (g: CanvasRenderingContext2D) => void): void {
  canvas.width = Math.round(largura * DPR)
  canvas.height = Math.round(altura * DPR)
  canvas.style.width = `${largura}px`
  canvas.style.height = `${altura}px`
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  g.setTransform(DPR, 0, 0, DPR, 0, 0)
  chao(g)
  const ordem = [...postos].sort((p, q) => p.y - q.y)
  const sombras = document.createElement('canvas')
  sombras.width = canvas.width
  sombras.height = canvas.height
  const gs = sombras.getContext('2d') as CanvasRenderingContext2D
  gs.setTransform(DPR, 0, 0, DPR, 0, 0)
  for (const p of ordem) {
    const def = porId(p.id)
    const a = arte(def, p.v)
    if (a === null || a.sombra === null) continue
    const u = def.tamanho * escala
    const s = QUADRO_DA_SOMBRA
    gs.drawImage(a.sombra, p.x + s.esquerda * u, p.y + s.topo * u, s.largura * u, s.altura * u)
  }
  g.save()
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalAlpha = ALFA_DA_SOMBRA
  g.drawImage(sombras, 0, 0)
  g.restore()
  g.imageSmoothingQuality = 'high'
  for (const p of ordem) {
    const def = porId(p.id)
    const a = arte(def, p.v)
    if (a === null) continue
    const u = def.tamanho * escala
    const q = a.quadro
    g.drawImage(a.corpo, p.x + q.esquerda * u, p.y + q.topo * u, q.lado * u, q.lado * u)
  }
}

const VERDE: [number, number, number] = [118, 142, 86]
const TERRA: [number, number, number] = [200, 190, 152]
function chaoDividido(largura: number, altura: number) {
  return (g: CanvasRenderingContext2D) => {
    g.fillStyle = css(VERDE)
    g.fillRect(0, 0, largura / 2, altura)
    g.fillStyle = css(TERRA)
    g.fillRect(largura / 2, 0, largura / 2, altura)
  }
}

/** Uma roça de girassóis em cada chão, com arbusto, juncos, árvore e pinheiro para comparar o tamanho. */
function postosDaCena(largura: number, altura: number, escala: number): Posto[] {
  const postos: Posto[] = []
  const passo = 9 * escala * 0.62
  let v = 0
  for (const metade of [0, 1]) {
    const x0 = metade * (largura / 2) + largura * 0.07
    for (let linha = 0; linha < 3; linha++) {
      for (let col = 0; col < 4; col++) {
        const x = x0 + col * passo + (linha % 2) * passo * 0.5
        const y = altura * 0.32 + linha * passo * 0.72
        if (x > metade * (largura / 2) + largura * 0.36) continue
        postos.push({ id: 'girassois', x, y, v: v++ % 8 })
      }
    }
    // Girassóis soltos, um a um, na frente da roça.
    for (let k = 0; k < 3; k++) postos.push({ id: 'girassol', x: x0 + passo * (0.6 + k * 1.3), y: altura * 0.32 + passo * 2.4 + (k % 2) * passo * 0.3, v: (k * 3 + metade) % 8 })
    const xr = metade * (largura / 2) + largura * 0.42
    postos.push({ id: 'arvore', x: xr, y: altura * 0.42, v: metade * 3 })
    postos.push({ id: 'arbusto', x: xr - passo * 0.4, y: altura * 0.82, v: 2 + metade })
    postos.push({ id: 'juncos', x: xr + passo * 0.5, y: altura * 0.86, v: 5 })
    postos.push({ id: 'pinheiro', x: metade * (largura / 2) + largura * 0.06, y: altura * 0.9, v: 1 + metade })
  }
  return postos
}

for (const [id, escala] of [['mapa-2', 2], ['mapa-35', 3.5], ['mapa-6', 6]] as const) {
  const canvas = document.getElementById(id) as HTMLCanvasElement
  const largura = Math.round(110 * escala * 2)
  const altura = Math.round(70 * escala)
  pintarMapa(canvas, largura, altura, escala, postosDaCena(largura, altura, escala), chaoDividido(largura, altura))
}

// 3. Os oito desenhos de cada (um a cada 45° de giro), grandes, no chão claro.
for (const [alvo, id] of [['oito-um', 'girassol'], ['oito', 'girassois']] as const) {
  const fileira = document.getElementById(alvo) as HTMLElement
  for (let v = 0; v < 8; v++) {
    const fig = document.createElement('figure')
    const canvas = document.createElement('canvas')
    const escala = 13
    pintarMapa(canvas, 150, 170, escala, [{ id, x: 70, y: 150, v }], (g) => {
      g.fillStyle = css(TERRA)
      g.fillRect(0, 0, 150, 170)
    })
    const legenda = document.createElement('figcaption')
    legenda.textContent = `desenho ${v + 1}`
    fig.append(canvas, legenda)
    fileira.append(fig)
  }
}
