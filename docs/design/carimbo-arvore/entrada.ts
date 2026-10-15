import { CARIMBOS_EMBUTIDOS, css, type DefinicaoDeCarimbo, type Rgb } from 'C:/dev/labirinto/client/src/carimbos/embutidos'
import { CARIMBOS_EMBUTIDOS as ANTES } from './embutidos-antes'
import { ALFA_DA_SOMBRA, assarDesenho, miniaturaDaArte, QUADRO_DA_SOMBRA, type ArteEmTela } from 'C:/dev/labirinto/client/src/carimbos/arte'

// A árvore de antes sai do embutidos.ts do último commit (git show HEAD), o resto do código do app.
const porId = (lista: readonly DefinicaoDeCarimbo[], id: string) => lista.find((c) => c.id === id) as DefinicaoDeCarimbo
const ARVORE_ANTES: DefinicaoDeCarimbo = { ...porId(ANTES, 'arvore'), id: 'arvore-antes' }
const ARVORE_NOVA = porId(CARIMBOS_EMBUTIDOS, 'arvore')
const TODOS = [...CARIMBOS_EMBUTIDOS, ARVORE_ANTES]
const def = (id: string) => porId(TODOS, id)
const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1))

const cache = new Map<string, ArteEmTela | null>()
function arte(d: DefinicaoDeCarimbo, variante: number): ArteEmTela | null {
  const chave = `${d.id}:${variante}`
  if (!cache.has(chave)) cache.set(chave, assarDesenho(d.desenhar, d.sombra, (variante * Math.PI) / 4, variante, 384))
  return cache.get(chave) ?? null
}

// 1. O painel OBJETO: antes e depois, com os vizinhos.
for (const [alvo, arvore] of [['painel-antes', ARVORE_ANTES], ['painel-depois', ARVORE_NOVA]] as const) {
  const painel = document.getElementById(alvo) as HTMLElement
  for (const d of [arvore, def('arbusto'), def('pinheiro'), def('palmeira')]) {
    const a = arte(d, 0)
    const tile = document.createElement('figure')
    tile.className = d === arvore ? 'tile destaque' : 'tile'
    const mini = a === null ? null : miniaturaDaArte(a, Math.round(72 * DPR))
    if (mini !== null) {
      mini.style.width = '72px'
      mini.style.height = '72px'
      tile.append(mini)
    }
    const nome = document.createElement('figcaption')
    nome.textContent = d.nome
    tile.append(nome)
    painel.append(tile)
  }
}

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
    const d = def(p.id)
    const a = arte(d, p.v)
    if (a === null || a.sombra === null) continue
    const u = d.tamanho * escala
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
    const d = def(p.id)
    const a = arte(d, p.v)
    if (a === null) continue
    const u = d.tamanho * escala
    const q = a.quadro
    g.drawImage(a.corpo, p.x + q.esquerda * u, p.y + q.topo * u, q.lado * u, q.lado * u)
  }
}

/** A grama do mapa e o chão escuro da floresta (o do print do usuário). */
const GRAMA: Rgb = [118, 142, 86]
const FLORESTA: Rgb = [30, 50, 36]
function chaoDividido(largura: number, altura: number) {
  return (g: CanvasRenderingContext2D) => {
    g.fillStyle = css(GRAMA)
    g.fillRect(0, 0, largura / 2, altura)
    g.fillStyle = css(FLORESTA)
    g.fillRect(largura / 2, 0, largura / 2, altura)
  }
}

/** Em cada chão: três árvores (desenhos diferentes), dois arbustos, um pinheiro e uma palmeira. */
function postosDaCena(idDaArvore: string, largura: number, altura: number, escala: number): Posto[] {
  const postos: Posto[] = []
  const m = 12 * escala
  for (const metade of [0, 1]) {
    const x0 = metade * (largura / 2)
    const v = metade * 4
    postos.push({ id: idDaArvore, x: x0 + m * 1.1, y: altura * 0.6, v: v })
    postos.push({ id: idDaArvore, x: x0 + m * 2.3, y: altura * 0.66, v: v + 1 })
    postos.push({ id: idDaArvore, x: x0 + m * 1.7, y: altura * 0.95, v: v + 2 })
    postos.push({ id: 'arbusto', x: x0 + m * 3.1, y: altura * 0.8, v: v + 3 })
    postos.push({ id: 'arbusto', x: x0 + m * 0.6, y: altura * 0.92, v: v + 1 })
    postos.push({ id: 'pinheiro', x: x0 + m * 3.5, y: altura * 0.45, v: v + 2 })
    postos.push({ id: 'palmeira', x: x0 + m * 4.4, y: altura * 0.7, v: v })
  }
  return postos
}

for (const escala of [2, 3.5, 6]) {
  const largura = Math.round(12 * escala * 5.2 * 2)
  const altura = Math.round(12 * escala * 2.9)
  for (const [lado, id] of [['antes', 'arvore-antes'], ['depois', 'arvore']] as const) {
    const canvas = document.getElementById(`mapa-${lado}-${String(escala).replace('.', '')}`) as HTMLCanvasElement
    pintarMapa(canvas, largura, altura, escala, postosDaCena(id, largura, altura, escala), chaoDividido(largura, altura))
  }
}

// 3. Os oito desenhos da árvore nova (um a cada 45° de giro), grandes, na grama.
const fileira = document.getElementById('oito') as HTMLElement
for (let v = 0; v < 8; v++) {
  const fig = document.createElement('figure')
  const canvas = document.createElement('canvas')
  pintarMapa(canvas, 150, 190, 9, [{ id: 'arvore', x: 62, y: 160, v }], (g) => {
    g.fillStyle = css(GRAMA)
    g.fillRect(0, 0, 150, 190)
  })
  const legenda = document.createElement('figcaption')
  legenda.textContent = `desenho ${v + 1}`
  fig.append(canvas, legenda)
  fileira.append(fig)
}

// Tema: segue o sistema; o botão força claro ou escuro.
const botao = document.getElementById('tema') as HTMLButtonElement
botao.addEventListener('click', () => {
  const raiz = document.documentElement
  const escuroAgora = raiz.dataset.theme === 'dark' || (raiz.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  raiz.dataset.theme = escuroAgora ? 'light' : 'dark'
  botao.setAttribute('aria-pressed', String(!escuroAgora))
})
