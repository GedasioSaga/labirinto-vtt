import type { MapData, Region, RegionPoint, Wall } from '../types/map'
import { pointOnPolygonBorder } from './roomNesting'
import { roomHasRoof, roomIsComodo } from './roomOps'
import { tetoDoPiso } from './terrenoAlto'

/**
 * ONDE O AMBIENTE NÃO ENTRA (pedido de 12/11/2026): chuva, neve, folhas e
 * cinzas não caem dentro de casa de teto fechado nem de cômodo fechado; brasas,
 * fumaça e neblina entram só pela porta aberta, mais fortes perto dela.
 *
 * Puro: devolve as salas secas e as portas abertas delas. A tela pinta isso
 * numa máscara pequena (`pixi/drawAmbiente.ts`), refeita só quando muda.
 *
 * REGRA CONTRA VAZAMENTO: no jogador, o seco vem SÓ das salas que ele recebeu
 * por dentro (`MapData.ambienteSeco`, decidido pelo host em `lib/fogFilter.ts`).
 * Sala que ele não recebeu não muda nada na chuva: o seco dela desenharia a
 * forma do lugar escondido.
 */
export interface AbrigoDoAmbiente {
  /** Os polígonos das salas secas (px de mundo). */
  secas: RegionPoint[][]
  /** O centro de cada porta aberta na beira de uma sala seca: por ela entram brasas, fumaça e neblina. */
  portas: RegionPoint[]
  /**
   * O TETO DO PISO DE CIMA (levantamento de 25/11/2026, Nº 26): faixas em que
   * o piso de cima tem chão (`cobertasDoPisoDeCima`). Só o que cai (chuva,
   * neve, folhas, cinzas) para nelas; a neblina e a fumaça passam, como
   * debaixo de uma passarela. Ausente = nenhuma.
   */
  cobertas?: RegionPoint[][]
}

export const SEM_ABRIGO: AbrigoDoAmbiente = { secas: [], portas: [] }

/** A sala é seca para o mestre: teto de construção ou cômodo. Ele vê tudo, então vê a casa por dentro, seca. */
export function salaSecaDoMestre(regiao: Region): boolean {
  return regiao.room !== undefined && (roomHasRoof(regiao.room) || roomIsComodo(regiao.room)) && regiao.points.length >= 3
}

/** As portas abertas encostadas na beira de alguma sala seca (o meio da porta a até meia casa da beira). */
export function portasAbertasDasSalas(walls: readonly Wall[], secas: readonly RegionPoint[][], grid: number): RegionPoint[] {
  if (secas.length === 0) return []
  const folga = Math.max(1, grid * 0.5)
  const portas: RegionPoint[] = []
  for (const parede of walls) {
    if (parede.door === null || !parede.door.open || parede.door.secret === true) continue
    const meio = { x: (parede.x1 + parede.x2) / 2, y: (parede.y1 + parede.y2) / 2 }
    if (secas.some((sala) => pointOnPolygonBorder(meio, sala, folga))) portas.push(meio)
  }
  return portas
}

function faixa(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

/**
 * As faixas cobertas pelo chão do piso de cima: a regra do teto do terreno
 * alto (`tetoDoPiso`: peça de Chão, Sala, região com fundo, desenho cheio e
 * textura pintada). Chovia dentro do castelo feito de paredes e Balde, com o
 * andar de cima por cima. O centro de cada casa decide, e as casas seguidas de
 * uma linha viram uma faixa só. Sem chão em cima: nenhuma. `conhecida`: no
 * recorte do jogador, só a casa que ele conhece entra (a forma do andar de cima
 * que ele não viu não sai); o mestre vê tudo.
 */
export function cobertasDoPisoDeCima(
  deCima: Pick<MapData, 'floor' | 'regions' | 'drawings' | 'texturas'>,
  cena: Pick<MapData, 'width' | 'height' | 'grid'>,
  conhecida: (ponto: RegionPoint) => boolean = () => true,
): RegionPoint[][] {
  const teto = tetoDoPiso(deCima)
  const { width, height, grid } = cena
  if (teto === null || !(grid > 0)) return []
  const faixas: RegionPoint[][] = []
  for (let row = 0; row < height; row += 1) {
    let inicio = -1
    for (let col = 0; col <= width; col += 1) {
      const centro = { x: (col + 0.5) * grid, y: (row + 0.5) * grid }
      const coberta = col < width && teto(centro) && conhecida(centro)
      if (coberta && inicio < 0) inicio = col
      if (!coberta && inicio >= 0) {
        faixas.push(faixa(inicio * grid, row * grid, col * grid, (row + 1) * grid))
        inicio = -1
      }
    }
  }
  return faixas
}

/**
 * O abrigo na tela do mestre: as salas de teto e os cômodos do piso à vista
 * (`map` já é o do piso) e as faixas cobertas pelo piso de cima (`cobertas`,
 * de `cobertasDoPisoDeCima`).
 */
export function abrigoDoMestre(map: Pick<MapData, 'regions' | 'walls' | 'grid'>, cobertas: RegionPoint[][] = []): AbrigoDoAmbiente {
  return abrigoDasSalas(map.regions.filter(salaSecaDoMestre).map((r) => r.points), map, cobertas)
}

/**
 * O abrigo na tela do jogador, a partir do RECORTE: só as salas que o host pôs
 * em `ambienteSeco` (a casa de teto aberta para ele, o cômodo que ele já viu).
 * As portas são as que ele recebeu. As faixas do piso de cima vêm prontas e
 * já cortadas pelo host (`ambienteCoberto`), como no mestre.
 */
export function abrigoDoJogador(recorte: Pick<MapData, 'regions' | 'walls' | 'grid' | 'ambienteSeco' | 'ambienteCoberto'>): AbrigoDoAmbiente {
  const ids = new Set(recorte.ambienteSeco ?? [])
  const secas = recorte.regions.filter((r) => ids.has(r.id) && r.points.length >= 3).map((r) => r.points)
  return abrigoDasSalas(secas, recorte, recorte.ambienteCoberto ?? [])
}

/** O abrigo das salas secas (com as portas abertas delas) e das faixas cobertas; nada = `SEM_ABRIGO`. */
function abrigoDasSalas(secas: RegionPoint[][], map: Pick<MapData, 'walls' | 'grid'>, cobertas: RegionPoint[][]): AbrigoDoAmbiente {
  const comCobertas = cobertas.length === 0 ? {} : { cobertas }
  if (secas.length === 0) return cobertas.length === 0 ? SEM_ABRIGO : { ...SEM_ABRIGO, ...comCobertas }
  return { secas, portas: portasAbertasDasSalas(map.walls, secas, map.grid), ...comCobertas }
}

/** Uma chave curta do abrigo: igual = a máscara não precisa ser refeita. */
export function chaveDoAbrigo(abrigo: AbrigoDoAmbiente): string {
  return JSON.stringify(abrigo)
}
