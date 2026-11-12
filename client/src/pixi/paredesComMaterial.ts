import { Container, ImageSource, Mesh, MeshGeometry, Texture, type Graphics } from 'pixi.js'
import { escalaDaGrade, espessuraDoMaterial, paredeComMaterial, type ParedeComMaterial } from '../lib/faixasDaParede'
import { imagemDoMaterial } from '../texturas/paredes/materiais'
import { SELECTION_COLOR } from './constants'
import { groupWallChains, selectionOutlineWidth, traceWallChain, wallAlphaFor, type WallWithStyle } from './drawWalls'
import { CONTORNO_PX, montarParedes, type MalhaEmPecas, type TriangulosDaParede } from './paredeEmPecas'

// A espessura e o "sai com textura" moram em `lib/faixasDaParede.ts` (o recorte do mestre mede a mesma parede sem o Pixi).
export { ESPESSURA_DO_MATERIAL_PX, espessuraDoMaterial, paredeComMaterial, type ParedeComMaterial } from '../lib/faixasDaParede'

/**
 * A PAREDE COM TEXTURA (pedido de 07/11/2026, `Wall.material`; refeita em
 * 10/11/2026: "parece mais chão do que uma parede"): a parede do material vista
 * de cima, com volume. Vale em qualquer estilo do mapa, no nó da faixa das
 * paredes (editor e jogador, `paredesDesenhadas.ts`); a visão, a névoa e o
 * bloqueio não passam por aqui, e o jogador só vê as paredes que já via.
 *
 * - ESPESSURA do mundo, como no Desenhado: fina 12, média 20, grossa 32 px (vezes
 *   `grid / 64`); a contínua (o ajuste fino) passa direto.
 * - O DESENHO é de `paredeEmPecas.ts`: sombra de contato e contorno por baixo e,
 *   por cima, o topo em peças do material (blocos em fiadas ao longo da parede,
 *   pilar no canto, tampa na ponta solta), com a luz do mapa em cada aresta.
 *   A imagem do material (`texturas/paredes/imagens/<material>.png`) é a folha de
 *   peças dele: uma textura por material, como antes.
 * - DUAS malhas por material e opacidade: todas as de baixo antes de qualquer uma
 *   de cima, para o topo de uma parede cobrir o contorno e a sombra da outra no
 *   encontro (o T e a cruz se fundem, também entre materiais diferentes).
 * - A FORMA das pontas sai de TODAS as paredes com textura do nó (`todas`): o
 *   jogador, que só desenha as de perto, vê os mesmos cantos e os mesmos blocos
 *   do mestre.
 */

/**
 * As malhas das paredes com textura de um nó, duas por material e opacidade.
 * `todas`: as paredes de que saem os encontros (o jogador manda todas as do nó);
 * sem ela, as mesmas que saem na tela. Função pura: a mesma lista dá a mesma
 * malha (e o teste a confere sem placa).
 */
export function malhasDosMateriais(walls: readonly WallWithStyle[], grid: number, todas?: readonly WallWithStyle[]): MalhaEmPecas[] {
  const saem = new Set<string>()
  for (const w of walls) if (paredeComMaterial(w)) saem.add(w.id)
  if (saem.size === 0) return []
  const entradas = []
  for (const w of todas ?? walls) {
    if (!paredeComMaterial(w)) continue
    entradas.push({ id: w.id, x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, h: espessuraDoMaterial(w, grid) / 2, alpha: wallAlphaFor(w), material: w.material, desenha: saem.has(w.id) })
  }
  return montarParedes(entradas, grid)
}

/** O contorno amarelo da seleção das paredes com textura, por baixo delas, na espessura do mundo (com o contorno da parede). */
export function pintarSelecaoDosMateriais(
  g: Graphics,
  walls: readonly ParedeComMaterial[],
  pedido: { selectedWallId: string | null; highlightedRegionId: string | null; cameraScale: number; grid: number },
): void {
  const borda = 2 * selectionOutlineWidth(pedido.cameraScale) + 2 * CONTORNO_PX * escalaDaGrade(pedido.grid)
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
    // A face do bloco é uma janela que começa em qualquer x da faixa: o x repete (512 px, potência de 2).
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
  pintar: (walls: readonly ParedeComMaterial[], grid: number, todas?: readonly WallWithStyle[]) => void
  destroy: () => void
}

function chaveDa(w: WallWithStyle): string {
  return `${w.id};${w.x1};${w.y1};${w.x2};${w.y2};${w.material};${String(w.thickness)};${w.wallKind ?? ''}`
}

export function criarPintorDeMateriais(): PintorDeMateriais {
  const container = new Container()
  container.eventMode = 'none'
  // Todas as de baixo (sombra e contorno) antes de qualquer uma de cima (o topo).
  const baixo = new Container()
  const cima = new Container()
  container.addChild(baixo, cima)
  let meshes: Mesh[] = []
  let chave = ''

  function soltar(): void {
    for (const mesh of meshes) {
      mesh.removeFromParent()
      const { geometry } = mesh
      mesh.destroy()
      geometry.destroy()
    }
    meshes = []
  }

  function por(no: Container, t: TriangulosDaParede, textura: Texture, alpha: number): void {
    if (t.indices.length === 0) return
    const geometry = new MeshGeometry({ positions: t.posicoes, uvs: t.uvs, indices: t.indices })
    geometry.batchMode = 'no-batch'
    const mesh = new Mesh({ geometry, texture: textura })
    mesh.alpha = alpha
    mesh.eventMode = 'none'
    meshes.push(mesh)
    no.addChild(mesh)
  }

  function pintar(walls: readonly ParedeComMaterial[], grid: number, todas?: readonly WallWithStyle[]): void {
    if (walls.length === 0) {
      if (meshes.length > 0) soltar()
      chave = ''
      return
    }
    // As outras paredes com textura do nó só entram na chave quando há (o jogador): dão forma aos encontros.
    const contexto = todas === undefined ? '' : `#${todas.filter(texturaPronta).map(chaveDa).join('|')}`
    const nova = `${grid}#${walls.map(chaveDa).join('|')}${contexto}`
    if (nova === chave) return
    soltar()
    chave = nova
    for (const malha of malhasDosMateriais(walls, grid, todas?.filter(texturaPronta))) {
      const imagem = imagemDoMaterial(malha.material)
      if (imagem === null) continue
      const textura = texturaDa(imagem)
      por(baixo, malha.baixo, textura, malha.alpha)
      por(cima, malha.cima, textura, malha.alpha)
    }
  }

  return {
    container,
    pintar,
    destroy: () => {
      soltar()
      container.destroy({ children: true })
    },
  }
}
