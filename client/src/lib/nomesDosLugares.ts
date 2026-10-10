import type { Drawing, MapData, Region, RegionPoint } from '../types/map'
import { CURVAS } from '../cenario/revelacao/tempo'
import { isPointExplored } from './exploration'
import { isContinente } from './marcadorDeContinente'
import { assinaturaDaTerra, coresDoChao, type ConhecidoDoRelevo } from './relevo'
import { pointInPolygonInclusive } from './roomNesting'
import { roomCentroid } from './roomRotation'
import { parseHexColor } from './tokenColor'

/**
 * NOMES DOS LUGARES (fatia 2 do relevo, plano de 09/10/2026): o nome de cada
 * lugar do mapa de continente numa PÍLULA colorida, com uma haste até o lugar
 * — a única parte da "Maquete do continente" que o usuário quis ("a animação
 * de aparição do nome dos lugares, só isso"). A pílula tem tamanho fixo na
 * TELA (o continente inteiro cabe na tela a 7% de zoom, onde o nome comum da
 * sala, em px de mundo, já sumiu), e entra em cascata curta quando o mapa abre
 * e quando o jogador descobre o lugar.
 *
 * "Lugar" é a REGIÃO com nome (`room.name`). Desenho não tem nome no app; o
 * Texto livre é conteúdo do mapa, não nome de lugar.
 *
 * Puro: sem DOM, sem Pixi. Cada tela (mestre e jogador) monta as pílulas das
 * regiões que ELA recebeu: nome escondido do jogador chega vazio
 * (`lib/fogFilter.ts`) e nem vira pílula.
 */

/**
 * A chave "Nomes dos lugares" está ligada nesta cena? A escolha do mestre,
 * quando ele escolheu; sem ela, o padrão do tipo de mapa: ligada no
 * Continente, desligada no Normal (masmorra segue com a plaquinha de sempre).
 */
export function nomesDosLugaresLigados(map: Pick<MapData, 'nomesDosLugares' | 'continente' | 'worldMap'>): boolean {
  return map.nomesDosLugares ?? isContinente(map)
}

/** Um lugar com nome, pronto para virar pílula. */
export interface LugarComNome {
  /** Id da região. */
  id: string
  texto: string
  /** Onde a haste encosta, em px de mundo: dentro do lugar. */
  ancora: RegionPoint
  /** Fundo da pílula, `0xRRGGBB`: a cor do chão no lugar, escurecida até o texto claro passar o AA. */
  fundo: number
  /** Nome que os jogadores não veem (`nameHiddenFromPlayers`): só o mestre recebe, e esmaecido. */
  esmaecido: boolean
}

/** Letra da pílula: branco puro, o que dá mais contraste em qualquer fundo escurecido. */
export const TINTA_DA_PILULA = 0xffffff

/**
 * Contraste mínimo entre a letra e o fundo da pílula. O nome é texto pequeno
 * (14 px em negrito fica abaixo dos 18,66 px de "texto grande" da WCAG), então
 * vale o AA de 4,5:1; a folga de 0,1 cobre o arredondamento da cor.
 */
export const CONTRASTE_MINIMO = 4.6

/**
 * Quanto a cor do chão escurece de saída. A pílula é o MESMO bioma, mais
 * fundo: escurecida já se separa do chão em volta (ela fica sobre ele), e
 * qualquer cor de bioma clara (areia, gelo, campo) ainda passa do AA.
 */
const ESCURECER_DE_SAIDA = 0.72
/** Cada passo a mais de escurecer, quando o primeiro não bastou para o AA. */
const ESCURECER_PASSO = 0.04
/** Lugar sem cor de chão legível (região só contorno, cor torta): um ardósia neutro, primo da tinta do app. */
const COR_NEUTRA = 0x4a5560

/** Luminância relativa da WCAG 2 (sRGB linearizado). */
function luminancia(cor: number): number {
  const canal = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal((cor >> 16) & 255) + 0.7152 * canal((cor >> 8) & 255) + 0.0722 * canal(cor & 255)
}

/** Razão de contraste da WCAG entre duas cores `0xRRGGBB` (1 a 21). */
export function contraste(a: number, b: number): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function vezes(cor: number, fator: number): number {
  const c = (deslocamento: number) => Math.round(((cor >> deslocamento) & 255) * fator)
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

/**
 * Fundo da pílula a partir da cor do chão: escurece mantendo o tom (multiplicar
 * os três canais não mexe no matiz) até a letra branca passar o AA.
 */
export function corDaPilula(chao: number): number {
  let fator = ESCURECER_DE_SAIDA
  let cor = vezes(chao, fator)
  while (contraste(TINTA_DA_PILULA, cor) < CONTRASTE_MINIMO && fator > ESCURECER_PASSO) {
    fator -= ESCURECER_PASSO
    cor = vezes(chao, fator)
  }
  return cor
}

/** O nome que a pílula mostra; vazio = este lugar não tem pílula. */
function nomeDoLugar(region: Region): string {
  return region.room?.name.trim() ?? ''
}

function poligonoUsavel(points: readonly RegionPoint[]): boolean {
  return points.length >= 3 && points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
}

/**
 * Esta região vira pílula com a chave ligada: tem nome e polígono de verdade.
 * Com a chave ligada, o nome dela NÃO sai também na plaquinha de sempre
 * (`pixi/drawRoomNames.ts`) — seriam dois nomes iguais, um sobre o outro.
 */
export function temPilula(region: Region): boolean {
  return nomeDoLugar(region) !== '' && poligonoUsavel(region.points)
}

/** As regiões cujo nome continua na plaquinha: todas com a chave desligada, só as sem pílula com ela ligada. */
export function regioesSemPilula<T extends Region>(regioes: T[], ligado: boolean): T[] {
  return ligado ? regioes.filter((r) => !temPilula(r)) : regioes
}

/** Quantas colunas e linhas a busca do ponto de dentro varre na caixa do lugar (17 × 17 candidatos). */
const PASSOS_DA_BUSCA = 16

function distanciaAoLado(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento = dx * dx + dy * dy
  const t = comprimento === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/**
 * O ponto da grade mais LONGE das bordas, dentro do polígono: o "coração" do
 * lugar. Usado quando o centróide cai fora (costa em C, região em L) — a haste
 * apontando para o mar não diria de que lugar é o nome. `null` = nenhum
 * candidato dentro (polígono fino demais para a grade).
 */
function pontoMaisDentro(points: readonly RegionPoint[]): RegionPoint | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  let melhor: RegionPoint | null = null
  let folgaDoMelhor = -Infinity
  for (let iy = 1; iy < PASSOS_DA_BUSCA; iy += 1) {
    const y = minY + ((maxY - minY) * iy) / PASSOS_DA_BUSCA
    for (let ix = 1; ix < PASSOS_DA_BUSCA; ix += 1) {
      const candidato = { x: minX + ((maxX - minX) * ix) / PASSOS_DA_BUSCA, y }
      if (!pointInPolygonInclusive(candidato, points, 0)) continue
      let folga = Infinity
      for (let i = 0; i < points.length; i += 1) folga = Math.min(folga, distanciaAoLado(candidato, points[i], points[(i + 1) % points.length]))
      // Empate fica com o primeiro da varredura: o resultado é sempre o mesmo.
      if (folga > folgaDoMelhor) {
        melhor = candidato
        folgaDoMelhor = folga
      }
    }
  }
  return melhor
}

/**
 * Onde a haste encosta: o nome arrastado pelo mestre (`labelOffset`) fica
 * onde ele soltou, como a plaquinha; sem arrasto, o centróide (o mesmo ponto
 * da plaquinha), ou o coração do lugar quando o centróide cai fora dele.
 */
export function ancoraDoLugar(region: Pick<Region, 'points' | 'room'>): RegionPoint {
  const centro = roomCentroid(region.points)
  const arrasto = region.room?.labelOffset
  if (arrasto !== undefined) return { x: centro.x + arrasto.x, y: centro.y + arrasto.y }
  if (pointInPolygonInclusive(centro, region.points)) return centro
  return pontoMaisDentro(region.points) ?? centro
}

export interface OpcoesDosLugares {
  /**
   * O texto da pílula de uma região com nome. Padrão: o nome. O editor do
   * mestre acrescenta a marca de "ver através das paredes", como na plaquinha.
   */
  textoDe?: (region: Region) => string
}

/**
 * Os lugares com nome das regiões DESTA tela, na ordem da cascata (de cima
 * para baixo, depois da esquerda para a direita: a ordem de leitura do mapa).
 * A cor sai do chão que esta tela pinta no ponto da haste (`coresDoChao`): a
 * região e os desenhos com fundo por cima dela.
 */
export function lugaresComNome(regioes: readonly Region[], desenhos: readonly Drawing[], opcoes: OpcoesDosLugares = {}): LugarComNome[] {
  const comPilula = regioes.filter(temPilula)
  if (comPilula.length === 0) return []
  const ancoras = comPilula.map(ancoraDoLugar)
  const cores = coresDoChao(regioes, desenhos, ancoras)
  const lugares = comPilula.map((region, i): LugarComNome => {
    const chao = cores[i] ?? parseHexColor(region.fillColor) ?? COR_NEUTRA
    return {
      id: region.id,
      texto: opcoes.textoDe?.(region) ?? nomeDoLugar(region),
      ancora: ancoras[i],
      fundo: corDaPilula(chao),
      esmaecido: region.room?.nameHiddenFromPlayers === true,
    }
  })
  return lugares.sort((a, b) => a.ancora.y - b.ancora.y || a.ancora.x - b.ancora.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * JOGADOR: só o lugar cujo ponto da haste ele já viu (agora ou na memória da
 * névoa) tem pílula. O recorte manda a região inteira assim que um pedaço
 * dela é visto; a pílula no centro de um lugar ainda na névoa diria onde fica
 * o coração dele. É o mesmo "conhecido" do relevo (`ConhecidoDoRelevo`).
 *
 * `ocultos` são as zonas ocultas ativas do mestre (`snapshot.concealed`): a
 * visão ATRAVESSA a zona (o jogador pinta o preto por cima), e a camada das
 * pílulas fica acima desse preto. Ponto da haste dentro de uma delas = sem
 * pílula, senão nome, haste e ponto sairiam por cima da zona. É obrigatório
 * para nenhuma tela do jogador esquecer de passar.
 */
export function lugaresConhecidos(
  lugares: readonly LugarComNome[],
  conhecido: ConhecidoDoRelevo,
  ocultos: readonly (readonly RegionPoint[])[],
): LugarComNome[] {
  const visao = conhecido.visao.filter((poligono) => poligono.length >= 3)
  const zonas = ocultos.filter((anel) => anel.length >= 3)
  const explorado = conhecido.explorado
  return lugares.filter(
    (l) =>
      !zonas.some((anel) => pointInPolygonInclusive(l.ancora, anel)) &&
      ((explorado !== undefined && isPointExplored(explorado, l.ancora)) || visao.some((poligono) => pointInPolygonInclusive(l.ancora, poligono))),
  )
}

/**
 * O que decide as pílulas de um recorte: a terra e os desenhos que pintam o
 * chão (`assinaturaDaTerra`, a cor) e, de cada lugar com nome, o nome e o
 * arrasto do mestre (a âncora). A tela do jogador recebe tudo de novo a cada
 * pacote; com a mesma assinatura, a lista de antes vale.
 */
export function assinaturaDosLugares(regioes: readonly Region[], desenhos: readonly Drawing[]): string {
  const nomes = regioes
    .filter(temPilula)
    .map((r) => `${r.id}:${r.room?.name ?? ''}:${r.room?.labelOffset?.x ?? ''},${r.room?.labelOffset?.y ?? ''}:${r.room?.nameHiddenFromPlayers === true ? 1 : 0}`)
    .join('|')
  return `${nomes}§${assinaturaDaTerra(regioes, desenhos)}`
}

// ---------------------------------------------------------------------------
// COLISÃO (em px de TELA: a pílula tem tamanho fixo na tela, a distância
// entre os lugares cresce com o zoom)

export interface PilulaNaTela {
  id: string
  /** Âncora do lugar na tela (o deslocamento da câmera não importa: só a diferença entre elas). */
  x: number
  y: number
  largura: number
  altura: number
}

export interface MedidasDoArranjo {
  /** Da âncora até a base da pílula, sem subida. */
  haste: number
  /** Respiro mínimo entre duas pílulas. */
  folga: number
  /**
   * Meia largura do ponto no chão (com o aro). Pílula também não cobre o
   * ponto de OUTRO lugar: sem isto o nome de baixo tampava o ponto do vizinho
   * e a haste dele parecia nascer da pílula errada (visto no mapa real).
   */
  raioDoPonto: number
  /**
   * Quanto uma pílula pode subir. Acima disto ela some neste zoom (`null`):
   * com o continente inteiro na tela, dez nomes empilhados numa torre de
   * hastes diriam menos que os nomes que cabem. Aproximar traz de volta.
   */
  tetoDeSubida: number
}

/** Quantas vezes uma pílula tenta subir por cima da que ela bateu, antes de desistir. */
const TENTATIVAS_DE_SUBIR = 12

/** Um retângulo já ocupado na tela: pílula colocada, ponto de lugar ou haste. */
interface Ocupado {
  x: number
  largura: number
  topo: number
  altura: number
  /** De qual lugar: o ponto do próprio lugar não barra a pílula dele. */
  dono: string
  /**
   * Respiro até isto. Entre pílulas, a folga inteira; até ponto e haste, 1 px
   * (são finos, e a folga cheia empurrava a pílula para cima à toa num
   * aglomerado de lugares — visto no oeste do mapa real).
   */
  folga: number
}

/** Respiro entre a pílula e um ponto ou haste de outro lugar. */
const FOLGA_DO_TRACO = 1

/** Onde a pílula ficou: quanto subiu e quanto deslizou de lado (a haste fica no lugar), em px de tela. */
export interface Arranjo {
  subida: number
  deslize: number
}

/** Meia largura da haste com o halo, como obstáculo: pílula de cima não senta em cima da haste de outra. */
const MEIA_HASTE = 2

function bate(x: number, largura: number, topo: number, altura: number, c: Ocupado): boolean {
  return Math.abs(x - c.x) < (largura + c.largura) / 2 + c.folga && topo < c.topo + c.altura + c.folga && topo + altura > c.topo - c.folga
}

/**
 * Quanto a pílula pode deslizar de lado sem a haste sair da parte reta de
 * baixo dela (o canto é arredondado: meia altura de raio, mais 2 px).
 */
function deslizeMaximo(p: PilulaNaTela): number {
  return Math.max(0, p.largura / 2 - p.altura / 2 - 2)
}

/**
 * Onde cada pílula fica para não encostar em outra (porte do protótipo
 * "Maquete", mais um passo): a de BAIXO na tela fica no lugar; a de CIMA
 * primeiro DESLIZA de lado (a haste continua no ponto, encostando noutro
 * trecho da base dela) e, se não bastar, SOBE, com a haste esticando até ela.
 * Pílula também não cobre o ponto de outro lugar nem a haste de uma já
 * colocada. `null` = não coube nem subindo até o teto (some neste zoom).
 * Determinístico: o empate de altura fica com o x e depois com o id.
 */
export function arranjarPilulas(pilulas: readonly PilulaNaTela[], medidas: MedidasDoArranjo): Map<string, Arranjo | null> {
  const arranjos = new Map<string, Arranjo | null>()
  const r = medidas.raioDoPonto
  const ocupados: Ocupado[] = pilulas.map((p) => ({ x: p.x, largura: r * 2, topo: p.y - r, altura: r * 2, dono: p.id, folga: FOLGA_DO_TRACO }))
  const ordem = [...pilulas].sort((a, b) => b.y - a.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const p of ordem) {
    const topoNatural = p.y - medidas.haste - p.altura
    const maximo = deslizeMaximo(p)
    let topo = topoNatural
    let escolha: Arranjo | null = null
    for (let volta = 0; volta < TENTATIVAS_DE_SUBIR && escolha === null; volta += 1) {
      const batida = ocupados.find((c) => c.dono !== p.id && bate(p.x, p.largura, topo, p.altura, c))
      if (batida === undefined) {
        escolha = { subida: topoNatural - topo, deslize: 0 }
        break
      }
      // Desliza para longe do que bateu: meio caminho, depois o máximo.
      const lado = batida.x > p.x ? -1 : 1
      for (const deslize of [lado * maximo * 0.5, lado * maximo, -lado * maximo * 0.5, -lado * maximo]) {
        if (deslize === 0) continue
        const x = p.x + deslize
        if (!ocupados.some((c) => c.dono !== p.id && bate(x, p.largura, topo, p.altura, c))) {
          escolha = { subida: topoNatural - topo, deslize }
          break
        }
      }
      if (escolha === null) topo = batida.topo - p.altura - batida.folga
    }
    if (escolha === null || escolha.subida > medidas.tetoDeSubida) {
      arranjos.set(p.id, null)
      continue
    }
    const base = topo + p.altura
    ocupados.push({ x: p.x + escolha.deslize, largura: p.largura, topo, altura: p.altura, dono: p.id, folga: medidas.folga })
    // A haste esticada também é ocupada (a de tamanho natural mora logo acima do ponto, que já conta).
    if (escolha.subida > 0) ocupados.push({ x: p.x, largura: MEIA_HASTE * 2, topo: base, altura: p.y - r - base, dono: p.id, folga: FOLGA_DO_TRACO })
    arranjos.set(p.id, escolha)
  }
  return arranjos
}

// ---------------------------------------------------------------------------
// APARIÇÃO (a da "Maquete": cascata curta, entrada com escala e opacidade)

/**
 * A animação de aparição, nos números do protótipo aprovado ("Maquete do
 * continente", `estilo.css`): cada pílula sobe 6 px e cresce de 94% enquanto
 * aparece, 45 ms depois da anterior. Ease-out forte (`CURVAS.saida`, o mesmo
 * cubic-bezier(0.23, 1, 0.32, 1) do protótipo), sem quique. Regra do usuário:
 * aparição até 5 s — com muitos lugares o passo da cascata encurta para a
 * última pílula assentar dentro do teto.
 */
export const APARICAO = {
  passoMs: 45,
  duracaoMs: 280,
  /** A opacidade chega antes da escala, como no protótipo (240 de 280 ms). */
  opacidadeMs: 240,
  tetoMs: 5000,
  escalaInicial: 0.94,
  descidaInicialPx: 6,
  /** "Reduzir movimento": só a opacidade, sem crescer nem subir. */
  reduzidaMs: 200,
} as const

/** Quando a pílula `indice` (de `total` que aparecem juntas) começa, em ms. */
export function atrasoNaCascata(indice: number, total: number, reduzido = false): number {
  if (total <= 1 || indice <= 0) return 0
  const duracao = reduzido ? APARICAO.reduzidaMs : APARICAO.duracaoMs
  const passo = Math.min(APARICAO.passoMs, (APARICAO.tetoMs - duracao) / (total - 1))
  return Math.min(indice, total - 1) * passo
}

export interface QuadroDaAparicao {
  alfa: number
  escala: number
  /** Px de tela abaixo do lugar final (0 = assentada). */
  descida: number
  terminou: boolean
}

/**
 * A pílula `ms` depois do começo DELA (antes do começo: negativo, invisível).
 * Pura, para a tela, os testes e o gráfico do movimento usarem a mesma conta.
 */
export function quadroDaAparicao(ms: number, reduzido = false): QuadroDaAparicao {
  if (reduzido) {
    const t = Math.min(1, Math.max(0, ms / APARICAO.reduzidaMs))
    return { alfa: CURVAS.saida.f(t), escala: 1, descida: 0, terminou: t >= 1 }
  }
  const t = Math.min(1, Math.max(0, ms / APARICAO.duracaoMs))
  const e = CURVAS.saida.f(t)
  return {
    alfa: CURVAS.saida.f(Math.min(1, Math.max(0, ms / APARICAO.opacidadeMs))),
    escala: APARICAO.escalaInicial + (1 - APARICAO.escalaInicial) * e,
    descida: APARICAO.descidaInicialPx * (1 - e),
    terminou: t >= 1,
  }
}
