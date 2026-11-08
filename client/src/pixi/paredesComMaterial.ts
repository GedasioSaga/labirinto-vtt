import { Container, ImageSource, Mesh, MeshGeometry, Texture, type Graphics } from 'pixi.js'
import type { MaterialDaParede, Wall } from '../types/map'
import { ehMaterialDaParede, FORMATO_DA_IMAGEM, materialDoCatalogo } from '../texturas/paredes/catalogo'
import { imagemDoMaterial } from '../texturas/paredes/materiais'
import { SELECTION_COLOR } from './constants'
import { clampWallWidth, groupWallChains, selectionOutlineWidth, traceWallChain, wallAlphaFor, type WallWithStyle } from './drawWalls'

/**
 * A PAREDE COM TEXTURA (pedido de 07/11/2026, `Wall.material`): a imagem do
 * material repetida ao longo das paredes, numa malha por material e opacidade
 * do nó da faixa das paredes (editor e jogador, `paredesDesenhadas.ts`). Vale em
 * qualquer estilo do mapa; a visão, a névoa e o bloqueio não passam por aqui, e o
 * jogador só recebe as paredes que já recebia (o nó desenha `pedido.walls`).
 *
 * - ESPESSURA do mundo, como no Desenhado: fina 12, média 20, grossa 32 px (vezes
 *   `grid / 64`); a contínua (o ajuste fino) passa direto.
 * - ESCALA da imagem (`FORMATO_DA_IMAGEM`): 1 texel = 1 px do mundo a 64 px por
 *   casa. O x anda ao longo da parede, girando com ela; o meio do traço cai na
 *   linha `meioY` do material (o meio de uma fiada), e a espessura mostra a faixa
 *   em volta.
 * - CADEIA: paredes do mesmo material, espessura e opacidade que se tocam ponta
 *   com ponta (a Sala, ou soltas) viram um percurso só, e a imagem CONTINUA de uma
 *   para a outra (o x é o comprimento andado). No laço fechado o x se ajusta (até
 *   25%) para fechar num número inteiro de ladrilhos: a volta não deixa emenda.
 * - QUINA em esquadro, pela bissetriz. Do lado de fora do canto, a coluna da quina
 *   é esticada pelo canto: as duas metades leem o mesmo texel na diagonal, sem
 *   costura. Canto mais fechado que 60 graus, ou trecho curto demais para o corte
 *   da bissetriz (a costa serrilhada, a curva de muitos trechos): CHANFRO — cada
 *   trecho acaba reto no ponto, o vão de fora se fecha com o triângulo do chanfro e
 *   a imagem continua de um para o outro. Antes ali cada trecho era um ladrilho
 *   solto com a imagem recomeçando, e a cadeia saía em tiras espetadas. T e
 *   cruzamento: ponta reta.
 */

/** Espessura em px do mundo por degrau, a 64 px por casa (a mesma proposta do Desenhado, CONTRATO 11.15). */
export const ESPESSURA_DO_MATERIAL_PX = { thin: 12, medium: 20, thick: 32 } as const

/** Ângulo entre as duas paredes abaixo do qual a quina não fecha em esquadro (a ponta da bissetriz iria longe). */
const COS_DO_CANTO_MAIS_FECHADO = Math.cos((60 * Math.PI) / 180)

/** Quanto o laço fechado pode esticar ou encolher a imagem para fechar em ladrilhos inteiros. */
const AJUSTE_MAXIMO_DO_LACO = 0.25

const PERTO = 1e-6

export type ParedeComMaterial = WallWithStyle & { material: MaterialDaParede }

/** A parede sai com textura: material do catálogo, sem porta, nem janela, nem invisível (essas têm desenho próprio). */
export function paredeComMaterial(w: WallWithStyle): w is ParedeComMaterial {
  return ehMaterialDaParede(w.material) && w.door === null && w.hidden !== true && w.janela !== true
}

/** A escala da grade: quantos px do mundo vale 1 px da casa de 64. */
function escalaDaGrade(grid: number): number {
  return Number.isFinite(grid) && grid > 0 ? grid / FORMATO_DA_IMAGEM.casa : 1
}

/** A espessura da parede com textura em px do mundo. */
export function espessuraDoMaterial(w: Pick<Wall, 'thickness'>, grid: number): number {
  const t = w.thickness
  if (typeof t === 'number' && Number.isFinite(t)) return clampWallWidth(t)
  return (t === 'thin' || t === 'thick' ? ESPESSURA_DO_MATERIAL_PX[t] : ESPESSURA_DO_MATERIAL_PX.medium) * escalaDaGrade(grid)
}

/** A malha de um material numa opacidade: triângulos com o UV da imagem (que passa de 1 e repete). */
export interface MalhaDoMaterial {
  readonly material: MaterialDaParede
  readonly alpha: number
  readonly posicoes: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
}

interface Trecho {
  readonly w: ParedeComMaterial
  /** Sentido do percurso: invertido = a parede é lida de (x2, y2) para (x1, y1). */
  invertido: boolean
  readonly h: number
  readonly comprimento: number
  readonly alpha: number
  /** O trecho de antes e o de depois no percurso (`null` = ponta reta). */
  anterior: number | null
  proximo: number | null
  /** A junta com o de antes e com o de depois é em esquadro (`false` = chanfro). */
  esquadroAntes: boolean
  esquadroDepois: boolean
  /** O x (px do mundo andados na cadeia) no começo do trecho, e quanto ele anda por px. */
  u0: number
  passo: number
}

interface Ponta {
  readonly i: number
  /** 0 = (x1, y1), 1 = (x2, y2), no sentido em que a parede foi riscada. */
  readonly fim: 0 | 1
}

function chaveDoPonto(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`
}

/** A direção unitária de saída da parede pela ponta `fim` (para dentro dela). */
function saida(t: Trecho, fim: 0 | 1): readonly [number, number] {
  const dx = (t.w.x2 - t.w.x1) / t.comprimento
  const dy = (t.w.y2 - t.w.y1) / t.comprimento
  return fim === 0 ? [dx, dy] : [-dx, -dy]
}

/** As duas paredes continuam uma na outra? Mesmo material, espessura e opacidade. */
function continuam(a: Trecho, b: Trecho): boolean {
  return a.w.material === b.w.material && Math.abs(a.h - b.h) <= PERTO && a.alpha === b.alpha
}

/** A junta nesta ponta cabe em esquadro? Canto aberto e trechos que comportam o corte; senão, chanfro. */
function emEsquadro(a: Trecho, fa: 0 | 1, b: Trecho, fb: 0 | 1): boolean {
  const [ax, ay] = saida(a, fa)
  const [bx, by] = saida(b, fb)
  const cos = ax * bx + ay * by
  if (cos > COS_DO_CANTO_MAIS_FECHADO) return false
  // O corte da bissetriz em cada trecho: h * tan(giro / 2), giro = o desvio do percurso.
  const cosGiro = -cos
  const corte = a.h * Math.sqrt(Math.max(0, (1 - cosGiro) / (1 + cosGiro)))
  return corte <= 0.5 * Math.min(a.comprimento, b.comprimento)
}

/** A ponta onde o trecho começa (0) ou termina (1) no percurso, em termos de (x1, y1) / (x2, y2). */
function pontaDoPercurso(t: Trecho, noFim: boolean): 0 | 1 {
  return noFim !== t.invertido ? 1 : 0
}

/**
 * Liga os trechos em percursos: o vizinho em esquadro de cada ponta, o sentido de
 * cada parede (quem chega sai pela ponta de onde o vizinho parte) e o x andado.
 */
function ligarPercursos(trechos: Trecho[], ladrilho: number): void {
  const pontas = new Map<string, Ponta[]>()
  trechos.forEach((t, i) => {
    for (const fim of [0, 1] as const) {
      const chave = fim === 0 ? chaveDoPonto(t.w.x1, t.w.y1) : chaveDoPonto(t.w.x2, t.w.y2)
      const lista = pontas.get(chave)
      if (lista === undefined) pontas.set(chave, [{ i, fim }])
      else lista.push({ i, fim })
    }
  })
  const vizinho: (Ponta | null)[][] = trechos.map(() => [null, null])
  const esquadro: boolean[][] = trechos.map(() => [true, true])
  for (const lista of pontas.values()) {
    if (lista.length !== 2) continue
    const [p, q] = lista
    if (p.i === q.i || !continuam(trechos[p.i], trechos[q.i])) continue
    vizinho[p.i][p.fim] = q
    vizinho[q.i][q.fim] = p
    const cabe = emEsquadro(trechos[p.i], p.fim, trechos[q.i], q.fim)
    esquadro[p.i][p.fim] = cabe
    esquadro[q.i][q.fim] = cabe
  }
  // O sentido: cada componente (caminho ou laço) andado a partir de um trecho.
  const visto = new Array<boolean>(trechos.length).fill(false)
  for (let inicio = 0; inicio < trechos.length; inicio += 1) {
    if (visto[inicio]) continue
    visto[inicio] = true
    const fila = [inicio]
    for (let k = 0; k < fila.length; k += 1) {
      const i = fila[k]
      for (const fim of [0, 1] as const) {
        const v = vizinho[i][fim]
        if (v === null || visto[v.i]) continue
        // Se `fim` é onde i termina no percurso, o vizinho começa ali (e vice-versa).
        const iTerminaAqui = pontaDoPercurso(trechos[i], true) === fim
        trechos[v.i].invertido = iTerminaAqui ? v.fim === 1 : v.fim === 0
        visto[v.i] = true
        fila.push(v.i)
      }
    }
  }
  trechos.forEach((t, i) => {
    const antes = vizinho[i][pontaDoPercurso(t, false)]
    const depois = vizinho[i][pontaDoPercurso(t, true)]
    // Só liga se o vizinho chega (ou parte) pela ponta certa: o percurso é coerente.
    t.anterior = antes !== null && pontaDoPercurso(trechos[antes.i], true) === antes.fim ? antes.i : null
    t.proximo = depois !== null && pontaDoPercurso(trechos[depois.i], false) === depois.fim ? depois.i : null
    t.esquadroAntes = esquadro[i][pontaDoPercurso(t, false)]
    t.esquadroDepois = esquadro[i][pontaDoPercurso(t, true)]
  })
  // O x andado: dos começos dos caminhos para a frente; o que sobra são laços.
  const andado = new Array<boolean>(trechos.length).fill(false)
  const andar = (inicio: number, passo: number): void => {
    let x = 0
    for (let i: number | null = inicio; i !== null && !andado[i]; i = trechos[i].proximo) {
      andado[i] = true
      trechos[i].u0 = x
      trechos[i].passo = passo
      x += trechos[i].comprimento * passo
    }
  }
  trechos.forEach((t, i) => {
    if (t.anterior === null) andar(i, 1)
  })
  trechos.forEach((_, inicio) => {
    if (andado[inicio]) return
    let volta = 0
    let i: number | null = inicio
    do {
      volta += trechos[i].comprimento
      i = trechos[i].proximo
    } while (i !== null && i !== inicio)
    const inteiros = Math.round(volta / ladrilho)
    const ajuste = inteiros >= 1 ? (inteiros * ladrilho) / volta : 1
    andar(inicio, Math.abs(ajuste - 1) <= AJUSTE_MAXIMO_DO_LACO ? ajuste : 1)
  })
}

/** Ponto, sentido e normal de um trecho no percurso. */
function percurso(t: Trecho): { sx: number; sy: number; ex: number; ey: number; dx: number; dy: number; nx: number; ny: number } {
  const [sx, sy, ex, ey] = t.invertido ? [t.w.x2, t.w.y2, t.w.x1, t.w.y1] : [t.w.x1, t.w.y1, t.w.x2, t.w.y2]
  const dx = (ex - sx) / t.comprimento
  const dy = (ey - sy) / t.comprimento
  return { sx, sy, ex, ey, dx, dy, nx: -dy, ny: dx }
}

interface Montagem {
  posicoes: number[]
  uvs: number[]
  indices: number[]
}

type Pt = readonly [number, number]

/** O vizinho de uma ponta no percurso: a direção dele e se a junta é em esquadro (`false` = chanfro). */
interface Vizinho {
  readonly direcao: Pt
  readonly esquadro: boolean
}

/**
 * Uma ponta do trecho: os pontos do lado +n ao lado -n (o contorno do miolo) e,
 * com vizinho, o triângulo de fora do canto, com o sinal do lado de fora.
 */
function ladoDaPonta(px: number, py: number, dx: number, dy: number, h: number, outra: Vizinho | null, noComeco: boolean): { contorno: Pt[]; fora: { tri: [Pt, Pt, Pt]; sinal: number } | null } {
  const nx = -dy
  const ny = dx
  const reta: Pt[] = [[px + nx * h, py + ny * h], [px - nx * h, py - ny * h]]
  if (outra === null) return { contorno: reta, fora: null }
  const [ox, oy] = outra.direcao
  // O giro do percurso (de quem chega para quem sai) vai para o lado +n? Então o de fora é o -n.
  const cruz = noComeco ? ox * dy - oy * dx : dx * oy - dy * ox
  const sinal = cruz > 0 ? -1 : 1
  const perp: Pt = [px + sinal * nx * h, py + sinal * ny * h]
  if (!outra.esquadro) {
    // CHANFRO: ponta reta no ponto e, por fora, metade do triângulo até a borda de
    // fora do vizinho (a normal dele é (-oy, ox)). Na volta quase inteira as duas
    // bordas coincidem e o triângulo some: nada sai espetado do traço.
    const meio: Pt = [px + (sinal * h * (nx - oy)) / 2, py + (sinal * h * (ny + ox)) / 2]
    return { contorno: reta, fora: { tri: [[px, py], perp, meio], sinal } }
  }
  // A bissetriz: a soma das normais dos dois trechos.
  let mx = nx - oy
  let my = ny + ox
  const lm = Math.hypot(mx, my) || 1
  mx /= lm
  my /= lm
  const fator = 1 / Math.max(PERTO, mx * nx + my * ny)
  const quinaFora: Pt = [px + sinal * mx * h * fator, py + sinal * my * h * fator]
  const quinaDentro: Pt = [px - sinal * mx * h * fator, py - sinal * my * h * fator]
  return {
    contorno: sinal > 0 ? [perp, [px, py], quinaDentro] : [quinaDentro, [px, py], perp],
    fora: { tri: [[px, py], perp, quinaFora], sinal },
  }
}

function montarTrecho(t: Trecho, chegada: Vizinho | null, partida: Vizinho | null, ladrilho: number, meio: number, m: Montagem): void {
  const { sx, sy, ex, ey, dx, dy, nx, ny } = percurso(t)
  const h = t.h
  // u e v em ladrilhos: o x andado e o lado do traço (o meio na linha `meio` da imagem).
  const uDe = (x: number, y: number) => (t.u0 + ((x - sx) * dx + (y - sy) * dy) * t.passo) / ladrilho
  const vDe = (desvio: number) => (meio - desvio) / ladrilho
  const comeco = ladoDaPonta(sx, sy, dx, dy, h, chegada, true)
  const fim = ladoDaPonta(ex, ey, dx, dy, h, partida, false)
  // O miolo: o fim de +n a -n, depois o começo de -n a +n (um polígono convexo, em leque).
  const miolo = [...fim.contorno, ...[...comeco.contorno].reverse()]
  const base = m.posicoes.length / 2
  for (const [x, y] of miolo) {
    m.posicoes.push(x, y)
    m.uvs.push(uDe(x, y), vDe((x - sx) * nx + (y - sy) * ny))
  }
  for (let k = 1; k < miolo.length - 1; k += 1) m.indices.push(base, base + k, base + k + 1)
  // Fora do canto: a coluna da ponta esticada (u fixo); o v anda com o lado.
  for (const [lado, u] of [
    [comeco, t.u0 / ladrilho],
    [fim, (t.u0 + t.comprimento * t.passo) / ladrilho],
  ] as const) {
    if (lado.fora === null) continue
    const b = m.posicoes.length / 2
    const [centro, perp, quina] = lado.fora.tri
    const vFora = vDe(lado.fora.sinal * h)
    m.posicoes.push(centro[0], centro[1], perp[0], perp[1], quina[0], quina[1])
    m.uvs.push(u, vDe(0), u, vFora, u, vFora)
    m.indices.push(b, b + 1, b + 2)
  }
}

/**
 * As malhas das paredes com textura de um nó, uma por material e opacidade.
 * Função pura: a mesma lista dá a mesma malha (e o teste a confere sem placa).
 */
export function malhasDosMateriais(walls: readonly WallWithStyle[], grid: number): MalhaDoMaterial[] {
  const trechos: Trecho[] = []
  for (const w of walls) {
    if (!paredeComMaterial(w)) continue
    const comprimento = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    if (!(comprimento > PERTO)) continue
    trechos.push({ w, invertido: false, h: espessuraDoMaterial(w, grid) / 2, comprimento, alpha: wallAlphaFor(w), anterior: null, proximo: null, esquadroAntes: true, esquadroDepois: true, u0: 0, passo: 1 })
  }
  if (trechos.length === 0) return []
  const k = escalaDaGrade(grid)
  const ladrilho = FORMATO_DA_IMAGEM.lado * k
  ligarPercursos(trechos, ladrilho)
  const vizinho = (i: number | null, esquadro: boolean): Vizinho | null => {
    if (i === null) return null
    const q = percurso(trechos[i])
    return { direcao: [q.dx, q.dy], esquadro }
  }
  const grupos = new Map<string, { material: MaterialDaParede; alpha: number; m: Montagem }>()
  // Quem tem menos esquadros primeiro, e a Sala (região) depois: no T, a divisória
  // (ponta solta no meio da outra) passa POR BAIXO da parede que ela encosta.
  const peso = (t: Trecho) => Number(t.anterior !== null) + Number(t.proximo !== null) + (t.w.regionId !== undefined ? 0.5 : 0)
  const ordem = trechos.map((_, i) => i).sort((a, b) => peso(trechos[a]) - peso(trechos[b]))
  for (const i of ordem) {
    const t = trechos[i]
    const chave = `${t.w.material}|${t.alpha}`
    let g = grupos.get(chave)
    if (g === undefined) {
      g = { material: t.w.material, alpha: t.alpha, m: { posicoes: [], uvs: [], indices: [] } }
      grupos.set(chave, g)
    }
    montarTrecho(t, vizinho(t.anterior, t.esquadroAntes), vizinho(t.proximo, t.esquadroDepois), ladrilho, materialDoCatalogo(t.w.material).meioY * k, g.m)
  }
  return [...grupos.values()].map(({ material, alpha, m }) => ({
    material,
    alpha,
    posicoes: new Float32Array(m.posicoes),
    uvs: new Float32Array(m.uvs),
    indices: new Uint32Array(m.indices),
  }))
}

/** O contorno amarelo da seleção das paredes com textura, por baixo delas, na espessura do mundo. */
export function pintarSelecaoDosMateriais(
  g: Graphics,
  walls: readonly ParedeComMaterial[],
  pedido: { selectedWallId: string | null; highlightedRegionId: string | null; cameraScale: number; grid: number },
): void {
  const borda = 2 * selectionOutlineWidth(pedido.cameraScale)
  if (pedido.highlightedRegionId !== null) {
    const proprias = walls.filter((w) => w.regionId === pedido.highlightedRegionId)
    for (const cadeia of groupWallChains(proprias, () => false)) {
      traceWallChain(g, cadeia)
      g.stroke({ width: Math.max(...cadeia.map((w) => espessuraDoMaterial(w, pedido.grid))) + borda, color: SELECTION_COLOR, cap: 'square', join: 'miter' })
    }
  }
  const escolhida = pedido.selectedWallId === null ? undefined : walls.find((w) => w.id === pedido.selectedWallId)
  if (escolhida !== undefined) {
    g.moveTo(escolhida.x1, escolhida.y1).lineTo(escolhida.x2, escolhida.y2)
    g.stroke({ width: espessuraDoMaterial(escolhida, pedido.grid) + borda, color: SELECTION_COLOR, cap: 'square' })
  }
}

// ---------- a placa ----------

/** Uma textura por imagem, para todos os pintores abertos: sobe para a placa uma vez. */
const texturas = new WeakMap<HTMLImageElement, Texture>()

function texturaDa(imagem: HTMLImageElement): Texture {
  const pronta = texturas.get(imagem)
  if (pronta !== undefined) return pronta
  const source = new ImageSource({
    resource: imagem,
    autoGenerateMipmaps: true,
    scaleMode: 'linear',
    mipmapFilter: 'linear',
    // A imagem repete nos dois sentidos (512 px, potência de 2: vale em qualquer placa).
    addressMode: 'repeat',
  })
  const textura = new Texture({ source })
  texturas.set(imagem, textura)
  return textura
}

/** A parede sai com textura AGORA: com material e a imagem já chegou (até ela chegar, a parede sai como linha). */
export function texturaPronta(w: WallWithStyle): w is ParedeComMaterial {
  return paredeComMaterial(w) && imagemDoMaterial(w.material) !== null
}

export interface PintorDeMateriais {
  /** O nó das malhas (o pintor das paredes o põe entre a pedra e as marcas do editor). */
  readonly container: Container
  /** Refaz as malhas só quando muda o que elas desenham; o zoom não refaz nada. */
  pintar: (walls: readonly ParedeComMaterial[], grid: number) => void
  destroy: () => void
}

export function criarPintorDeMateriais(): PintorDeMateriais {
  const container = new Container()
  container.eventMode = 'none'
  let meshes: Mesh[] = []
  let chave = ''

  function soltar(): void {
    for (const mesh of meshes) {
      container.removeChild(mesh)
      const { geometry } = mesh
      mesh.destroy()
      geometry.destroy()
    }
    meshes = []
  }

  function pintar(walls: readonly ParedeComMaterial[], grid: number): void {
    if (walls.length === 0) {
      if (meshes.length > 0) soltar()
      chave = ''
      return
    }
    const nova = `${grid}#${walls.map((w) => `${w.id};${w.x1};${w.y1};${w.x2};${w.y2};${w.material};${String(w.thickness)};${w.wallKind ?? ''}`).join('|')}`
    if (nova === chave) return
    soltar()
    chave = nova
    for (const malha of malhasDosMateriais(walls, grid)) {
      const imagem = imagemDoMaterial(malha.material)
      if (imagem === null) continue
      const geometry = new MeshGeometry({ positions: malha.posicoes, uvs: malha.uvs, indices: malha.indices })
      geometry.batchMode = 'no-batch'
      const mesh = new Mesh({ geometry, texture: texturaDa(imagem) })
      mesh.alpha = malha.alpha
      mesh.eventMode = 'none'
      meshes.push(mesh)
      container.addChild(mesh)
    }
  }

  return {
    container,
    pintar,
    destroy: () => {
      soltar()
      container.destroy()
    },
  }
}
