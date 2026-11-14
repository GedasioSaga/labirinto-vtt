import { BlurFilter, Color, ColorMatrixFilter, Container, Graphics } from 'pixi.js'
import type { AlturaDoPiso, FloorPiece, MapData } from '../types/map'
import { EFEITO_DA_ALTURA } from '../lib/terrenoAlto'

/**
 * TERRENO ALTO NO EDITOR (pedido de 14/11/2026): ao desenhar o 1º piso (a
 * muralha), o mestre vê o piso de baixo borrado e escurecido por baixo, para
 * acertar a muralha em cima do reino. É uma PLANTA simples — chão, salas,
 * paredes e fichas —, não a cena inteira: serve de guia, e borrada a
 * diferença some.
 *
 * Desempenho: a planta vira UMA textura (`cacheAsTexture`, lado máximo
 * `LADO_MAXIMO_DA_PLANTA`), refeita só quando o piso de baixo ou a altura
 * mudam (as listas do mapa são imutáveis: compara-se a referência). Cada
 * quadro do editor só desenha a textura, sem borrar de novo.
 */

/** Lado máximo da textura da planta, em pixels: borrada, mais resolução não aparece. */
const LADO_MAXIMO_DA_PLANTA = 2048
/** O borrão no editor, em casas por altura: o mesmo jeito da tela do jogador, na escala do mapa. */
const BORRAO_EM_CASAS: Readonly<Record<AlturaDoPiso, number>> = { baixa: 0.12, media: 0.25, alta: 0.42 }
/** Opacidade da planta inteira: guia por baixo, não o piso de cima. */
const ALFA_DA_PLANTA = 0.85
const COR_DA_PAREDE = 0xd9d2c3
const COR_DA_FICHA = 0xe0a44a
const COR_DO_BURACO = 0x1d1d1d
const PASSOS_DA_ELIPSE = 24

export interface PisoDeBaixoNoEditor {
  /** Vai no mundo do editor, logo acima do fundo e abaixo do chão do piso em edição. */
  readonly camada: Container
  /** O piso de baixo e a altura do piso em edição; `null` = nada por baixo (térreo, ou cena sem pisos). */
  atualizar(entrada: { mapa: MapData; altura: AlturaDoPiso } | null): void
  destruir(): void
}

export function criarPisoDeBaixoNoEditor(): PisoDeBaixoNoEditor {
  const camada = new Container()
  camada.label = 'piso-de-baixo'
  camada.eventMode = 'none'
  camada.visible = false
  camada.alpha = ALFA_DA_PLANTA
  // Os filtros ficam DENTRO do que é guardado em textura: borra uma vez, não a cada quadro.
  const borrado = new Container()
  const planta = new Graphics()
  borrado.addChild(planta)
  camada.addChild(borrado)
  const borrao = new BlurFilter({ strength: 0, quality: 3, resolution: 'inherit' })
  const cor = new ColorMatrixFilter()
  borrado.filters = [borrao, cor]
  let ultimaChave: readonly unknown[] | null = null

  const atualizar: PisoDeBaixoNoEditor['atualizar'] = (entrada) => {
    if (entrada === null) {
      camada.visible = false
      return
    }
    const { mapa, altura } = entrada
    const chave = [mapa.floor, mapa.regions, mapa.walls, mapa.tokens, mapa.grid, mapa.width, mapa.height, mapa.floorStyle.fillColor, altura]
    camada.visible = true
    if (ultimaChave !== null && chave.length === ultimaChave.length && chave.every((v, i) => v === ultimaChave?.[i])) return
    ultimaChave = chave
    desenharPlanta(planta, mapa)
    const efeito = EFEITO_DA_ALTURA[altura]
    borrao.strength = BORRAO_EM_CASAS[altura] * mapa.grid
    cor.reset()
    cor.brightness(efeito.brilho, true)
    cor.saturate(efeito.saturacao - 1, true)
    const lado = Math.max(1, mapa.width * mapa.grid, mapa.height * mapa.grid)
    camada.cacheAsTexture(false)
    camada.cacheAsTexture({ resolution: Math.min(1, LADO_MAXIMO_DA_PLANTA / lado), antialias: false })
  }

  return {
    camada,
    atualizar,
    destruir() {
      camada.cacheAsTexture(false)
      camada.destroy({ children: true })
    },
  }
}

/** Os pontos de `pontos` girados `graus` em volta de (`cx`, `cy`), achatados para o `poly` do Pixi. */
function girados(pontos: readonly { x: number; y: number }[], cx: number, cy: number, graus: number): number[] {
  const rad = (graus * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return pontos.flatMap((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
  })
}

/** Uma peça do chão, aproximada pela forma (sem borda irregular nem arredondamento: vai borrada). */
function desenharPeca(g: Graphics, peca: FloorPiece, cor: number): void {
  const s = peca.shape
  const giro = peca.rotation ?? 0
  switch (s.kind) {
    case 'rect': {
      const cantos = [
        { x: s.cx - s.w / 2, y: s.cy - s.h / 2 },
        { x: s.cx + s.w / 2, y: s.cy - s.h / 2 },
        { x: s.cx + s.w / 2, y: s.cy + s.h / 2 },
        { x: s.cx - s.w / 2, y: s.cy + s.h / 2 },
      ]
      g.poly(girados(cantos, s.cx, s.cy, giro), true).fill({ color: cor })
      return
    }
    case 'ellipse': {
      const pontos = Array.from({ length: PASSOS_DA_ELIPSE }, (_, i) => {
        const a = (i / PASSOS_DA_ELIPSE) * Math.PI * 2
        return { x: s.cx + Math.cos(a) * s.rx, y: s.cy + Math.sin(a) * s.ry }
      })
      g.poly(girados(pontos, s.cx, s.cy, giro), true).fill({ color: cor })
      return
    }
    case 'polygon': {
      const lados = Math.max(3, Math.round(s.sides))
      const pontos = Array.from({ length: lados }, (_, i) => {
        const a = (i / lados) * Math.PI * 2 - Math.PI / 2
        return { x: s.cx + Math.cos(a) * s.radius, y: s.cy + Math.sin(a) * s.radius }
      })
      g.poly(girados(pontos, s.cx, s.cy, giro), true).fill({ color: cor })
      return
    }
    case 'corridor': {
      for (let i = 1; i < s.points.length; i += 1) {
        const a = s.points[i - 1]
        const b = s.points[i]
        if (a === undefined || b === undefined) continue
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: Math.max(1, (a.width + b.width) / 2), color: cor, cap: 'round', join: 'round' })
      }
      return
    }
    case 'blocos': {
      for (const c of s.cells) g.rect(c.col * s.cell, c.row * s.cell, s.cell, s.cell)
      if (s.cells.length > 0) g.fill({ color: cor })
      return
    }
    case 'poly': {
      if (s.points.length < 3) return
      const xs = s.points.map((p) => p.x)
      const ys = s.points.map((p) => p.y)
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      g.poly(girados(s.points, cx, cy, giro), true).fill({ color: cor })
      return
    }
  }
}

/** A planta do piso de baixo: chão na ordem (o buraco por cima), salas, paredes e fichas. */
function desenharPlanta(g: Graphics, mapa: MapData): void {
  g.clear()
  const corDoChao = new Color(mapa.floorStyle.fillColor).toNumber()
  for (const peca of mapa.floor) {
    if (peca.hidden === true) continue
    desenharPeca(g, peca, peca.op === 'subtract' ? COR_DO_BURACO : peca.fillColor === undefined ? corDoChao : new Color(peca.fillColor).toNumber())
  }
  for (const sala of mapa.regions) {
    if (sala.points.length < 3) continue
    const pontos = sala.points.flatMap((p) => [p.x, p.y])
    g.poly(pontos, true).fill({ color: new Color(sala.fillColor).toNumber(), alpha: 0.55 })
  }
  const largura = Math.max(2, mapa.grid * 0.12)
  for (const w of mapa.walls) g.moveTo(w.x1, w.y1).lineTo(w.x2, w.y2)
  if (mapa.walls.length > 0) g.stroke({ width: largura, color: COR_DA_PAREDE, cap: 'round' })
  for (const t of mapa.tokens) g.circle(t.x, t.y, (Math.max(0.25, t.size) * mapa.grid * 0.8) / 2)
  if (mapa.tokens.length > 0) g.fill({ color: COR_DA_FICHA })
}
