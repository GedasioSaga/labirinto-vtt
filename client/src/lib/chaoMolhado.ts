import type { AlvoDoBalde, EfeitoDoAmbiente, FloorPiece, PinceladaDeAmbiente, PinceladaDeTextura, Region, RegionPoint } from '../types/map'
import { temMaterial } from './terrenoDoChao'
import { pedirTerreno } from './terrenoNoWorker'
import { mapFloorClip } from './floorContour'

/**
 * CHÃO MOLHADO E NEVE ACUMULADA (Ambiente, decisão do mestre de 12/11/2026:
 * "o chão molha e junta neve; a chuva bate no telhado"). Com chuva, o chão
 * escurece e abre poças onde chove; com neve, junta uma camada branca em
 * manchas, devagar. O telhado molha (escurece e brilha um pouco) e junta neve.
 * Só onde o efeito cai (mapa inteiro ou pincel), nunca dentro de casa de teto
 * fechado nem de cômodo fechado (`lib/abrigoDoAmbiente.ts`).
 *
 * Só contas puras: o desenho é do `pixi/chaoMolhado.ts` e do
 * `pixi/telhadosRenderer.ts`. Os números vêm do protótipo aprovado
 * (`docs/design/ambiente/prototipo-ambiente.html`, `F_MAPA` e `passo`).
 */

export const AJUSTE_DO_CHAO_MOLHADO = {
  /** Constante de tempo (s) para molhar e secar: o protótipo molha em uns 15 s e seca em mais de meio minuto. */
  molharS: 5,
  secarS: 12,
  /** A neve junta e derrete mais devagar que a chuva molha. */
  juntarS: 8,
  derreterS: 14,
  /** Abaixo disto o nível vale 0 (o chão seco não desenha nada). */
  nivelMinimo: 0.01,
  /** Quanto o nível precisa andar para a tela redesenhar quando nada mais anima (o chão secando sozinho). */
  passoDoNivel: 0.01,
  /** De quanto em quanto tempo o chão secando (sem chuva caindo) pede um quadro. */
  quadroSecandoMs: 250,
  /** Os materiais e as texturas em que a chuva forte abre poça (a rua, a trilha, o pátio do protótipo). Grama, areia e tábua não. */
  texturasComPoca: ['calcamento', 'terra', 'cascalho'] as readonly string[],
  /** Texels da máscara das poças por casa e o teto do lado. */
  texelsDaPocaPorCasa: 2,
  ladoMaximoDaPoca: 1024,
  /** Espera depois da última mudança no chão para refazer as poças (o terreno conta o contorno antes, em 150 ms). */
  esperaDasPocasMs: 400,
  /** O telhado molhado: a tinta (escurece e azula) e o brilho da faixa de luz. */
  telhado: { tintaMolhada: [0.74, 0.78, 0.86] as const, brilho: 0.22, neve: 0.62 },
} as const

/** Os níveis do clima no chão, de 0 a 1: o quanto já molhou e o quanto de neve já juntou. */
export interface NiveisDoChao {
  molhado: number
  neve: number
}

export const CHAO_SECO: Readonly<NiveisDoChao> = { molhado: 0, neve: 0 }

/** Para onde os níveis vão: molha com chuva (do mapa inteiro ou pintada) e junta neve com neve, se a opção do mestre deixar. */
export function alvoDoChao(chaoMolha: boolean, chuva: { inteira: number; pintada: boolean }, neve: { inteira: number; pintada: boolean }): NiveisDoChao {
  if (!chaoMolha) return { molhado: 0, neve: 0 }
  return { molhado: chuva.inteira > 0 || chuva.pintada ? 1 : 0, neve: neve.inteira > 0 || neve.pintada ? 1 : 0 }
}

/**
 * O nível `dt` segundos depois, indo para o alvo com a constante de tempo de
 * subir ou de descer (a mesma conta do `aproximar` do protótipo). Perto do
 * alvo, chega nele (o chão seco volta a não desenhar nada).
 */
export function aproximarNivel(atual: number, alvo: number, dt: number, subirS: number, descerS: number): number {
  if (Math.abs(atual - alvo) < AJUSTE_DO_CHAO_MOLHADO.nivelMinimo) return alvo
  const tau = alvo > atual ? subirS : descerS
  const proximo = alvo + (atual - alvo) * Math.exp(-Math.max(0, dt) / tau)
  return Math.abs(proximo - alvo) < AJUSTE_DO_CHAO_MOLHADO.nivelMinimo ? alvo : proximo
}

/** Os dois níveis `dt` segundos depois. */
export function niveisDepois(atual: NiveisDoChao, alvo: NiveisDoChao, dt: number): NiveisDoChao {
  const a = AJUSTE_DO_CHAO_MOLHADO
  return {
    molhado: aproximarNivel(atual.molhado, alvo.molhado, dt, a.molharS, a.secarS),
    neve: aproximarNivel(atual.neve, alvo.neve, dt, a.juntarS, a.derreterS),
  }
}

function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento = dx * dx + dy * dy
  const t = comprimento === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function tocaAPincelada(p: RegionPoint, passo: PinceladaDeAmbiente): boolean {
  const [primeiro, ...resto] = passo.pontos
  if (primeiro === undefined) return false
  if (resto.length === 0) return Math.hypot(p.x - primeiro.x, p.y - primeiro.y) <= passo.raio
  let anterior = primeiro
  for (const ponto of resto) {
    if (distanciaAoSegmento(p, anterior, ponto) <= passo.raio) return true
    anterior = ponto
  }
  return false
}

/**
 * O quanto o efeito PINTADO cobre um ponto (0 a 1), na ordem das pinceladas,
 * com a mesma regra da máscara (`pixi/drawNeblina.ts`, `pintarMascara`): o
 * pincel deixa a força dele por cima do que havia; a borracha tira a força dela.
 */
export function pintadoNoPonto(lista: readonly PinceladaDeAmbiente[] | undefined, efeito: EfeitoDoAmbiente, p: RegionPoint): number {
  let valor = 0
  for (const passo of lista ?? []) {
    if (passo.efeito !== efeito || !tocaAPincelada(p, passo)) continue
    valor = passo.tipo === 'pincel' ? passo.forca : valor * (1 - passo.forca)
  }
  return Math.min(1, Math.max(0, valor))
}

/** O meio da caixa de um polígono (o telhado é olhado por ele, como a zona oculta olha o objeto pelo centro). */
export function meioDoPoligono(pontos: readonly RegionPoint[]): RegionPoint {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return pontos.length === 0 ? { x: 0, y: 0 } : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/**
 * O CLIMA DOS TELHADOS (`pixi/telhadosRenderer.ts`, `setClima`): o que cai em
 * cada telhado (pelos pontos dele, sem o tempo) e os níveis de agora. A mesma
 * função `cobertura` = o telhado não reconta; só o nível anda.
 */
export interface ClimaDosTelhados {
  cobertura: (pontos: readonly RegionPoint[]) => { chuva: number; neve: number }
  niveis: NiveisDoChao
}

/** O que cai num telhado: a chuva e a neve que cobrem o meio dele (mapa inteiro ou pincel), de 0 a 1. */
export function climaNoPonto(
  inteira: { chuva: number; neve: number },
  pintada: readonly PinceladaDeAmbiente[] | undefined,
  p: RegionPoint,
): { chuva: number; neve: number } {
  return {
    chuva: inteira.chuva > 0 ? 1 : pintadoNoPonto(pintada, 'chuva', p),
    neve: inteira.neve > 0 ? 1 : pintadoNoPonto(pintada, 'neve', p),
  }
}

// ---------- as poças ----------

/**
 * Um passo do desenho da máscara das poças, na ordem: `poe` deixa poça (a
 * textura ou o material segura água), `tira` cobre a de baixo (grama, areia,
 * tábua, borracha). `traco` é o pincel (os pontos com o raio); `area` é o
 * balde e o terreno (os pontos fechados, par-ímpar).
 */
export type PassoDaPoca =
  | { modo: 'poe' | 'tira'; forma: 'traco'; forca: number; raio: number; pontos: readonly RegionPoint[] }
  | { modo: 'poe' | 'tira'; forma: 'area'; forca: number; pontos: readonly RegionPoint[] }

function seguraAgua(textura: string): boolean {
  return AJUSTE_DO_CHAO_MOLHADO.texturasComPoca.includes(textura)
}

function pontosDoAlvo(alvo: AlvoDoBalde, regioes: readonly Pick<Region, 'id' | 'points'>[]): readonly RegionPoint[] | null {
  if (alvo.tipo === 'area') return alvo.pontos.length >= 3 ? alvo.pontos : null
  if (alvo.tipo === 'regiao') {
    const regiao = regioes.find((r) => r.id === alvo.id)
    return regiao !== undefined && regiao.points.length >= 3 ? regiao.points : null
  }
  // O desenho pintado pelo balde não entra: a poça é do chão de rua, trilha e pátio, não do traço.
  return null
}

/** Os passos das Texturas que mexem nas poças (o pincel e o balde de textura, a borracha e o esvaziar). */
function passosDasTexturas(texturas: readonly PinceladaDeTextura[], regioes: readonly Pick<Region, 'id' | 'points'>[]): PassoDaPoca[] {
  const passos: PassoDaPoca[] = []
  for (const t of texturas) {
    if (t.tipo === 'pincel' || t.tipo === 'borracha') {
      if (t.pontos.length === 0) continue
      const modo = t.tipo === 'pincel' && seguraAgua(t.textura) ? 'poe' : 'tira'
      passos.push({ modo, forma: 'traco', forca: t.forca, raio: t.raio, pontos: t.pontos })
    } else if (t.tipo === 'balde' || t.tipo === 'esvaziar') {
      const pontos = pontosDoAlvo(t.alvo, regioes)
      if (pontos === null) continue
      const modo = t.tipo === 'balde' && seguraAgua(t.textura) ? 'poe' : 'tira'
      passos.push({ modo, forma: 'area', forca: t.tipo === 'balde' ? t.forca : 1, pontos })
    }
  }
  return passos
}

/**
 * Onde a chuva forte pode abrir poça, na ordem do desenho: primeiro as
 * Texturas (abaixo), depois o terreno das peças de Chão com material (acima,
 * o mais novo por cima, `lib/terrenoDoChao.ts`). O contorno do terreno é o
 * mesmo que o pintor do terreno pede ao worker (`pedirTerreno`, guardado pelo
 * desenho das peças). Vazio = nenhuma poça.
 *
 * `null` = o terreno ainda está sendo contado no worker: as poças de agora
 * ficam (nada pisca) e `aoContarOTerreno` avisa quando ele chegar, para pedir
 * de novo. Sem worker (os testes), o terreno conta na hora, como antes.
 */
export function passosDasPocas(
  mapa: { width: number; height: number; grid: number; regions: readonly Pick<Region, 'id' | 'points'>[] },
  texturas: readonly PinceladaDeTextura[] | undefined,
  floor: FloorPiece[],
  aoContarOTerreno?: () => void,
): PassoDaPoca[] | null {
  const passos = passosDasTexturas(texturas ?? [], mapa.regions)
  if (floor.some(temMaterial)) {
    const terreno = pedirTerreno(floor, mapa.grid, mapFloorClip(mapa))
    if (!Array.isArray(terreno)) {
      // Falhou: o pintor do terreno avisa no console; as poças ficam como estão (pedir de novo contaria de novo, sem fim).
      terreno.then(
        () => aoContarOTerreno?.(),
        () => {},
      )
      return null
    }
    for (const t of terreno) {
      if (t.tipo !== 'balde' || t.alvo.tipo !== 'area' || t.alvo.pontos.length < 3) continue
      passos.push({ modo: seguraAgua(t.textura) ? 'poe' : 'tira', forma: 'area', forca: 1, pontos: t.alvo.pontos })
    }
  }
  // Só borracha e o que não segura água: não há poça nenhuma.
  return passos.some((p) => p.modo === 'poe') ? passos : []
}
