import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { andarPeloTrajeto, TENTAR_DE_NOVO_MS } from '../andarPeloCaminho'
import { segmentsIntersect } from '../collision'
import { type ConsultaDeCaminho, type FichaNoCaminho, fichaNoTraco, type MotivoSemCaminho, obstaculosPara, passaPeloArrasto, type PontoDoCaminho, type ResultadoDoCaminho, TOLERANCIA_ENTRE_FICHAS } from './busca'
import { distanciaAoTraco, type Malha, malhaPronta } from './malha'

/**
 * ANDARILHO — quem anda sozinho por um trecho (de onde está até `destino`),
 * um tique de cada vez. Pede caminho ao motor, anda por ele parando em cada
 * canto, abre a porta diante dela e a fecha atrás de si, e confere a cada
 * tique se o próximo traço ainda passa (porta que fechou, ficha que entrou na
 * frente): se não passa, replaneja.
 *
 * Nunca fica parado em silêncio:
 * - sem caminho: espera e tenta de novo; depois de algumas vezes, DESISTE com
 *   o motivo (`porta-trancada`, `sem-caminho`, `ocupado`);
 * - ANTI-TRAVA: tentando andar sem sair do lugar por `TIQUES_SEM_PROGRESSO`
 *   tiques, replaneja com folga maior das fichas; ainda preso, espera; ainda
 *   preso, desiste (com o último motivo, ou `sem-progresso`);
 * - vai e volta sem chegar (ficha que entra na frente de novo e de novo): o
 *   trecho tem teto de `LIMITE_DE_PEDIDOS` caminhos; passou, desiste.
 *
 * Puro: o mundo entra por parâmetro, as portas saem como ações para quem aplica.
 */

export type MotivoDoAndarilho = MotivoSemCaminho | 'sem-progresso'

export type FimDoTrecho = { tipo: 'chegou' } | { tipo: 'desistiu'; motivo: MotivoDoAndarilho; portas: readonly string[]; fichas: readonly string[] }

export interface Andarilho {
  readonly destino: Point
  /** Os cantos que faltam (o primeiro é o próximo). `null`: precisa de caminho. */
  readonly pontos: readonly PontoDoCaminho[] | null
  /** Pediu caminho e espera a resposta. */
  readonly aguardando: boolean
  /** Parado de propósito (depois de falhar) até este instante. */
  readonly esperaAte: number
  /** Pedidos seguidos que voltaram sem caminho. */
  readonly falhas: number
  readonly ultimaFalha: Extract<ResultadoDoCaminho, { tipo: 'sem-caminho' }> | null
  /** Anti-trava: 0 normal; 1 já replanejou largo; 2 já esperou. */
  readonly nivel: number
  /** Caminhos pedidos neste trecho: seguir um caminho sempre encurta o que falta, então só replanejar pode girar em falso. */
  readonly pedidos: number
  /** Onde a ficha estava quando andou de verdade pela última vez, e quantos tiques tentou desde então. */
  readonly marco: { readonly x: number; readonly y: number; readonly tiques: number }
  /** Portas por onde passou e ainda vai fechar. */
  readonly fechar: readonly string[]
  /**
   * Portas que ela abriu e ainda não cruzou. Um caminho novo (replanejou com a
   * porta já aberta) não diz onde fechá-la: `receber` marca de novo.
   */
  readonly abertas: readonly string[]
  readonly fim: FimDoTrecho | null
}

export interface AcaoNaPorta {
  tipo: 'abrir' | 'fechar'
  wallId: string
}

export interface MundoDoAndarilho {
  aqui: Point
  agora: number
  /** Quanto a ficha anda num tique, em px. */
  passo: number
  /** A malha do mapa para o raio desta ficha (`agenda.cache.malhaPara`), talvez ainda por montar. */
  malha: Malha
  /** As paredes de agora (portas no estado atual). */
  paredes: readonly Wall[]
  /** As outras fichas do piso. */
  fichas: readonly FichaNoCaminho[]
}

export type Situacao = 'andando' | 'abrindo' | 'planejando' | 'esperando' | 'chegou' | 'desistiu'

export interface TiqueDoAndarilho {
  andarilho: Andarilho
  para: Point
  acoes: AcaoNaPorta[]
  /** Pedido de caminho novo para a agenda (`null`: nada a pedir). */
  pedido: ConsultaDeCaminho | null
  situacao: Situacao
}

/** Tiques tentando andar sem sair do lugar antes de o anti-trava agir (2 s com o tique de 200 ms). */
export const TIQUES_SEM_PROGRESSO = 10
/** Andar menos que isto, em casas, desde o marco não conta como sair do lugar. */
export const PROGRESSO_MINIMO = 0.25
/** Folga a mais das fichas no replanejar do anti-trava, em casas. */
export const FOLGA_LARGA = 0.5
/** A espera do anti-trava antes da última tentativa. */
export const ESPERA_DO_ANTITRAVA_MS = 1500
/** Quantas vezes seguidas sem caminho antes de desistir, por motivo. */
export const LIMITE_DE_FALHAS: Readonly<Record<MotivoSemCaminho, number>> = {
  ocupado: 6,
  'porta-trancada': 3,
  'sem-caminho': 3,
}
/** Teto de caminhos pedidos num trecho. */
export const LIMITE_DE_PEDIDOS = 40
/** Longe assim da porta, em casas, e ainda sem poder fechá-la (alguém no vão): deixa aberta. */
const ALCANCE_PARA_FECHAR = 3

/** O trecho de `aqui` a `destino`. `fechar`: portas que o trecho anterior deixou abertas atrás dela. */
export function novoAndarilho(destino: Point, aqui: Point, fechar: readonly string[] = []): Andarilho {
  return {
    destino: { x: destino.x, y: destino.y },
    pontos: null,
    aguardando: false,
    esperaAte: 0,
    falhas: 0,
    ultimaFalha: null,
    nivel: 0,
    pedidos: 0,
    marco: { x: aqui.x, y: aqui.y, tiques: 0 },
    fechar,
    abertas: [],
    fim: null,
  }
}

function desistir(a: Andarilho, motivo: MotivoDoAndarilho): Andarilho {
  const falha = a.ultimaFalha
  return { ...a, pontos: null, aguardando: false, fim: { tipo: 'desistiu', motivo, portas: falha?.portas ?? [], fichas: falha?.fichas ?? [] } }
}

function paradaComo(a: Andarilho, aqui: Point, situacao: Situacao, pedido: ConsultaDeCaminho | null = null, acoes: AcaoNaPorta[] = []): TiqueDoAndarilho {
  return { andarilho: a, para: { x: aqui.x, y: aqui.y }, acoes, pedido, situacao }
}

/**
 * As portas que ela abriu e não cruzou, no caminho novo: cruza de novo, fecha
 * no primeiro canto depois dela; o caminho não passa mais por ela, entra para
 * fechar assim que o vão ficar livre.
 */
function remarcarAbertas(a: Andarilho, pontos: readonly PontoDoCaminho[], paredes: readonly Wall[], aqui: Point): Andarilho {
  if (a.abertas.length === 0) return { ...a, pontos }
  const marcados = [...pontos]
  const abertas: string[] = []
  let fechar = a.fechar
  for (const id of a.abertas) {
    const w = paredes.find((p) => p.id === id)
    if (w === undefined || w.door === null || !w.door.open) continue
    const k = marcados.findIndex((p, i) => segmentsIntersect(marcados[i - 1] ?? aqui, p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }))
    const canto = marcados[k]
    if (canto !== undefined && canto.fechar === undefined) marcados[k] = { ...canto, fechar: id }
    else if (canto !== undefined) abertas.push(id)
    else if (!fechar.includes(id)) fechar = [...fechar, id]
  }
  return { ...a, pontos: marcados, abertas, fechar }
}

/** A resposta da agenda entra no andarilho. */
function receber(a: Andarilho, resposta: ResultadoDoCaminho, mundo: MundoDoAndarilho): Andarilho {
  if (resposta.tipo === 'caminho') {
    // O primeiro ponto é onde ela está; fica só se diz para abrir a porta que já está diante dela.
    const [aqui, ...resto] = resposta.pontos
    const pontos = aqui?.abrir !== undefined ? resposta.pontos : resto
    return remarcarAbertas({ ...a, aguardando: false, falhas: 0 }, pontos, mundo.paredes, mundo.aqui)
  }
  const agora = mundo.agora
  const falhas = a.falhas + 1
  const comFalha = { ...a, aguardando: false, pontos: null, falhas, ultimaFalha: resposta }
  if (falhas >= LIMITE_DE_FALHAS[resposta.motivo]) return desistir(comFalha, resposta.motivo)
  return { ...comFalha, esperaAte: agora + TENTAR_DE_NOVO_MS }
}

function pedirCaminho(a: Andarilho, mundo: MundoDoAndarilho): TiqueDoAndarilho {
  if (a.pedidos >= LIMITE_DE_PEDIDOS) return paradaComo(desistir(a, a.ultimaFalha?.motivo ?? 'sem-progresso'), mundo.aqui, 'desistiu')
  const pedido: ConsultaDeCaminho = { de: { x: mundo.aqui.x, y: mundo.aqui.y }, para: a.destino, fichas: mundo.fichas }
  if (a.nivel >= 1) pedido.folgaExtra = FOLGA_LARGA * mundo.malha.grid
  return paradaComo({ ...a, aguardando: true, pontos: null, pedidos: a.pedidos + 1 }, mundo.aqui, 'planejando', pedido)
}

/** O próximo traço ainda serve: regra do arrasto com as portas de agora, sem encostar em ficha. */
function tracoDoPassoServe(mundo: MundoDoAndarilho, alvo: Point): boolean {
  const { malha, paredes, aqui } = mundo
  if (!passaPeloArrasto(malha, paredes, aqui, alvo)) return false
  return fichaNoTraco(aqui, alvo, obstaculosPara(aqui, mundo.fichas, malha.raio, malha.grid)) === null
}

/** Alguma das `fichas` está no vão da porta `w`: fechar a porta passaria por ela. */
function vaoOcupado(w: Wall, fichas: readonly FichaNoCaminho[], grid: number): boolean {
  return fichas.some((f) => distanciaAoTraco(f.x, f.y, w.x1, w.y1, w.x2, w.y2) < f.raio - grid * TOLERANCIA_ENTRE_FICHAS)
}

/** A porta `id` ainda é dela para fechar: existe, está aberta e destrancada. */
function portaAbertaDeFechar(paredes: readonly Wall[], id: string): Wall | null {
  const w = paredes.find((p) => p.id === id)
  return w === undefined || w.door === null || !w.door.open || w.door.locked ? null : w
}

/** As portas a fechar: fecha a que já ficou para trás com o vão vazio; longe demais, deixa aberta. */
function fecharAtras(a: Andarilho, mundo: MundoDoAndarilho, aqui: Point, acoes: AcaoNaPorta[]): readonly string[] {
  if (a.fechar.length === 0) return a.fechar
  const { malha, paredes, fichas } = mundo
  const folga = malha.raio - malha.grid * TOLERANCIA_ENTRE_FICHAS
  const restam: string[] = []
  for (const id of a.fechar) {
    const w = portaAbertaDeFechar(paredes, id)
    if (w === null) continue
    const distancia = distanciaAoTraco(aqui.x, aqui.y, w.x1, w.y1, w.x2, w.y2)
    if (distancia >= folga && !vaoOcupado(w, fichas, malha.grid)) acoes.push({ tipo: 'fechar', wallId: id })
    else if (distancia < ALCANCE_PARA_FECHAR * malha.grid) restam.push(id)
  }
  return restam
}

/**
 * Ela sai da cena (vai de uma vez para outra): fecha o que ficou aberto atrás
 * dela — as portas que ia fechar e as que abriu sem cruzar —, agora que ela
 * mesma não está mais no vão. Com outra ficha no vão, deixa aberta, como
 * quando ela se afasta andando (`ALCANCE_PARA_FECHAR`): de longe, ninguém
 * fecha porta. `paredes` e `fichas`: as da cena que ela deixa, sem ela.
 */
export function fecharAoSair(a: Andarilho, paredes: readonly Wall[], fichas: readonly FichaNoCaminho[], grid: number): AcaoNaPorta[] {
  const acoes: AcaoNaPorta[] = []
  for (const id of new Set([...a.fechar, ...a.abertas])) {
    const w = portaAbertaDeFechar(paredes, id)
    if (w !== null && !vaoOcupado(w, fichas, grid)) acoes.push({ tipo: 'fechar', wallId: id })
  }
  return acoes
}

/**
 * Chegou ao destino: fecha o que ainda está aberto atrás dela. A porta que não
 * deu para fechar (alguém no vão, ela ainda nele) fica em `fechar`: o trecho
 * seguinte a herda (`novoAndarilho`).
 */
function chegada(a: Andarilho, mundo: MundoDoAndarilho, aqui: Point, acoes: AcaoNaPorta[]): TiqueDoAndarilho {
  const restam = fecharAtras({ ...a, fechar: [...a.fechar, ...a.abertas] }, mundo, aqui, acoes)
  return paradaComo({ ...a, pontos: [], aguardando: false, fechar: restam, abertas: [], fim: { tipo: 'chegou' } }, aqui, 'chegou', null, acoes)
}

/** Anti-trava: conta o tique que tentou andar; sem sair do lugar por tempo demais, sobe de nível. */
function vigiarProgresso(a: Andarilho, mundo: MundoDoAndarilho, aqui: Point): Andarilho {
  const andou = Math.hypot(aqui.x - a.marco.x, aqui.y - a.marco.y) >= PROGRESSO_MINIMO * mundo.malha.grid
  if (andou) return { ...a, nivel: 0, marco: { x: aqui.x, y: aqui.y, tiques: 0 } }
  const tiques = a.marco.tiques + 1
  if (tiques < TIQUES_SEM_PROGRESSO) return { ...a, marco: { ...a.marco, tiques } }
  const zerado = { x: a.marco.x, y: a.marco.y, tiques: 0 }
  if (a.nivel === 0) return { ...a, nivel: 1, pontos: null, marco: zerado }
  if (a.nivel === 1) return { ...a, nivel: 2, pontos: null, esperaAte: mundo.agora + ESPERA_DO_ANTITRAVA_MS, marco: zerado }
  return desistir(a, a.ultimaFalha?.motivo ?? 'sem-progresso')
}

/**
 * Um tique do trecho. `resposta`: o caminho que a agenda devolveu para o
 * pedido anterior, se já saiu. As `acoes` (abrir, fechar porta) são de quem
 * aplica no mapa, antes do próximo tique.
 */
export function tiqueDoAndarilho(andarilho: Andarilho, mundo: MundoDoAndarilho, resposta?: ResultadoDoCaminho): TiqueDoAndarilho {
  let a = andarilho
  const { aqui, agora } = mundo
  if (a.fim !== null) return paradaComo(a, aqui, a.fim.tipo === 'chegou' ? 'chegou' : 'desistiu')
  if (resposta !== undefined && a.aguardando) {
    a = receber(a, resposta, mundo)
    if (a.fim !== null) return paradaComo(a, aqui, 'desistiu')
  }
  if (aqui.x === a.destino.x && aqui.y === a.destino.y) return chegada(a, mundo, aqui, [])
  if (a.aguardando) return paradaComo(a, aqui, 'planejando')
  if (agora < a.esperaAte) return paradaComo(a, aqui, 'esperando')
  // Malha por montar (mapa novo, parede mudou): sem ela o passo não se confere, e
  // a agenda só a monta para quem pede caminho. O caminho velho fica para trás.
  if (a.pontos === null || !malhaPronta(mundo.malha)) return pedirCaminho(a, mundo)
  const alvo = a.pontos[0]
  if (alvo === undefined) return pedirCaminho(a, mundo)
  if (!tracoDoPassoServe(mundo, alvo)) {
    const vigiado = vigiarProgresso({ ...a, pontos: null }, mundo, aqui)
    if (vigiado.fim !== null) return paradaComo(vigiado, aqui, 'desistiu')
    if (agora < vigiado.esperaAte) return paradaComo(vigiado, aqui, 'esperando')
    return pedirCaminho(vigiado, mundo)
  }
  const { para, resta } = andarPeloTrajeto(aqui, a.pontos, mundo.passo)
  const acoes: AcaoNaPorta[] = []
  let fechar = a.fechar
  let abertas = a.abertas
  let situacao: Situacao = 'andando'
  if (resta.length < a.pontos.length) {
    // Chegou ao canto: fecha a porta que acabou de passar, abre a que tem diante de si.
    const passou = alvo.fechar
    if (passou !== undefined) {
      if (!fechar.includes(passou)) fechar = [...fechar, passou]
      abertas = abertas.filter((id) => id !== passou)
    }
    if (alvo.abrir !== undefined) {
      const porta = mundo.paredes.find((w) => w.id === alvo.abrir)
      if (porta !== undefined && porta.door !== null && !porta.door.open && !porta.door.locked) {
        acoes.push({ tipo: 'abrir', wallId: porta.id })
        if (!abertas.includes(porta.id)) abertas = [...abertas, porta.id]
        situacao = 'abrindo'
      }
    }
  }
  fechar = fecharAtras({ ...a, fechar }, mundo, para, acoes)
  // O passo que pisa no destino já é a chegada: a parada no posto começa neste tique, como antes do motor.
  if (resta.length === 0 && para.x === a.destino.x && para.y === a.destino.y) return chegada({ ...a, fechar, abertas }, mundo, para, acoes)
  const andou = vigiarProgresso({ ...a, pontos: resta, fechar, abertas }, mundo, para)
  if (andou.fim !== null) return { andarilho: andou, para, acoes, pedido: null, situacao: 'desistiu' }
  return { andarilho: andou, para, acoes, pedido: null, situacao }
}
