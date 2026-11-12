import type { MapData, Prop, RegionPoint, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { paredesParaAndar } from './barranco'
import { ehMovelDoChao, ehMovelQueBarra, ehMovelRedondo, vistaDoMovel } from './mobilia'
import { pisoDe } from './pisos'
import { rotatePointAround, rotationTrig } from './roomRotation'

/**
 * OBJETO GRANDE BARRA A FICHA DO JOGADOR (pedido do mestre de 12/11/2026: "esse
 * tipo de construto mais grande como o cata-vento e alguns outros tem que ter
 * uma colisão para os jogadores não passarem por dentro").
 *
 * O obstáculo sai do próprio objeto, sem campo de geometria: a caixa girada, ou
 * a elipse de `LADOS_DA_ELIPSE` lados quando a silhueta é redonda
 * (`ehMovelRedondo`). Vira PAREDES SINTÉTICAS, como as do barranco
 * (`lib/barranco.ts`): seguram o andar (`blocksMove`), deixam ver
 * (`blocksLight: false`), e só existem nas contas de andar do JOGADOR (arrasto,
 * clique para andar, "Andar até aqui", batalha, modo teste). Nunca vão para
 * `map.walls`, para o desenho nem para a visão.
 *
 * - Quem barra: `objetoBarraPassagem` (a lista de saída é `ehMovelQueBarra`).
 * - NUNCA PRENDER: a ficha que começa o passo dentro da forma de um objeto
 *   ignora as paredes DELE naquele passo. Só a entrada é barrada.
 * - O MESTRE atravessa sempre: o arrasto dele usa `paredesParaAndar`, sem objeto.
 * - "Fora do Chão: livre" (`lib/offFloor.ts`) não muda nada aqui.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/**
 * Quanto a forma cresce para fora da silhueta, em casas. ZERO: a conta do passo
 * é pelo centro da ficha, como na parede, e a malha do clique para andar já
 * guarda a folga dela (`folgaDaParede`, 0,2 casa). Os nós dessa malha ficam a
 * 1/4 de casa da borda da casa: com a forma crescida 1/4 de casa eles cairiam
 * em cima dela, e o corredor de 1 casa entre dois pilares fecharia para o clique.
 */
export const FOLGA_DO_OBJETO_EM_CASAS = 0
/** Lados do polígono que faz a vez da elipse do objeto redondo. */
const LADOS_DA_ELIPSE = 12
/** Começo do id de toda parede de objeto: `objeto:<id do objeto>:<lado>`. */
const PREFIXO_DO_ID = 'objeto:'
/** Até quanto da borda, em px, a ficha conta como DENTRO da forma: em cima da linha ela não fica presa. */
const TOLERANCIA_DA_BORDA = 0.01

/** O obstáculo de um objeto: o contorno fechado e as paredes dele. */
export interface ObstaculoDeObjeto {
  readonly prop: Prop
  readonly contorno: readonly RegionPoint[]
  readonly paredes: readonly Wall[]
}

/**
 * O objeto PODE barrar? O objeto de chão (tapete, ponte) e o item no chão
 * nunca: a ficha pisa neles. Para eles o botão "Barra a passagem" nem aparece.
 */
export function objetoPodeBarrar(prop: Pick<Prop, 'mobilia' | 'item'>): boolean {
  return prop.item === undefined && !ehMovelDoChao(prop.mobilia)
}

/**
 * O que o botão "Barra a passagem" mostra: a escolha do mestre
 * (`Prop.barraPassagem`), senão o padrão do tipo (`ehMovelQueBarra`; a imagem
 * solta não barra). É a regra do objeto, sem olhar se ele está escondido.
 */
export function barraPassagemEscolhida(prop: Pick<Prop, 'mobilia' | 'item' | 'barraPassagem'>): boolean {
  if (!objetoPodeBarrar(prop)) return false
  return typeof prop.barraPassagem === 'boolean' ? prop.barraPassagem : ehMovelQueBarra(prop.mobilia)
}

/**
 * O objeto barra a passagem da ficha do jogador AGORA? A escolha acima, menos o
 * objeto escondido (`hidden`) e o secreto (`secret`): esses o jogador nem
 * recebe, e barrar seria uma parede invisível que conta que há algo ali.
 */
export function objetoBarraPassagem(prop: Prop): boolean {
  if (prop.hidden === true || prop.secret === true) return false
  return barraPassagemEscolhida(prop)
}

/**
 * O objeto com o botão em `barra`. O campo só fica quando difere do padrão do
 * tipo: voltar ao padrão o apaga, e o mapa salva como antes. O que já vale
 * devolve o MESMO objeto (sem passo vazio no desfazer). Objeto que não pode
 * barrar não ganha o campo.
 */
export function comBarraPassagem(prop: Prop, barra: boolean): Prop {
  const { barraPassagem: antes, ...resto } = prop
  // O que fica gravado: só a escolha que difere do padrão, e só no objeto que pode barrar.
  const gravado = objetoPodeBarrar(prop) && barra !== ehMovelQueBarra(prop.mobilia) ? barra : undefined
  if (gravado === antes) return prop
  return gravado === undefined ? resto : { ...resto, barraPassagem: gravado }
}

/** O mapa com o botão do objeto `id` em `barra`; sem o objeto, ou sem nada a mudar, o MESMO mapa. */
export function comBarraPassagemNoMapa(map: MapData, id: string, barra: boolean): MapData {
  const antes = map.props.find((p) => p.id === id)
  if (antes === undefined) return map
  const depois = comBarraPassagem(antes, barra)
  return depois === antes ? map : { ...map, props: map.props.map((p) => (p === antes ? depois : p)) }
}

/**
 * Leitura do disco: o campo só fica quando é booleano, o objeto pode barrar e
 * o valor difere do padrão do tipo. O resto (texto, número, o próprio padrão
 * gravado por engano, objeto de chão) some. Sem nada a consertar, o mesmo objeto.
 */
export function lerBarraPassagem(prop: Prop): Prop {
  if (!Object.hasOwn(prop, 'barraPassagem')) return prop
  const valor: unknown = prop.barraPassagem
  if (typeof valor === 'boolean' && objetoPodeBarrar(prop) && valor !== ehMovelQueBarra(prop.mobilia)) return prop
  const { barraPassagem: _torto, ...resto } = prop
  return resto
}

/** O id é de uma parede de objeto (e não de uma parede do mapa)? */
export function ehParedeDeObjeto(id: string): boolean {
  return id.startsWith(PREFIXO_DO_ID)
}

/** O contorno do objeto em px de mundo, ou `null` quando as medidas não servem (arquivo estragado). */
function contornoDoObjeto(prop: Prop, folga: number): RegionPoint[] | null {
  if (![prop.x, prop.y, prop.width, prop.height].every(Number.isFinite) || !(prop.width > 0) || !(prop.height > 0)) return null
  const meiaLargura = prop.width / 2 + folga
  const meiaAltura = prop.height / 2 + folga
  const centro = { x: prop.x, y: prop.y }
  const retos: RegionPoint[] = ehMovelRedondo(prop.mobilia, vistaDoMovel(prop))
    ? Array.from({ length: LADOS_DA_ELIPSE }, (_, k) => {
        const angulo = (k / LADOS_DA_ELIPSE) * 2 * Math.PI
        return { x: prop.x + Math.cos(angulo) * meiaLargura, y: prop.y + Math.sin(angulo) * meiaAltura }
      })
    : [
        { x: prop.x - meiaLargura, y: prop.y - meiaAltura },
        { x: prop.x + meiaLargura, y: prop.y - meiaAltura },
        { x: prop.x + meiaLargura, y: prop.y + meiaAltura },
        { x: prop.x - meiaLargura, y: prop.y + meiaAltura },
      ]
  const giro = prop.rotation !== undefined && Number.isFinite(prop.rotation) ? prop.rotation : 0
  if (giro === 0) return retos
  const trig = rotationTrig(giro)
  return retos.map((ponto) => rotatePointAround(ponto, centro, trig))
}

function obstaculoDe(prop: Prop, grid: number, piso: number): ObstaculoDeObjeto | null {
  const contorno = contornoDoObjeto(prop, grid * FOLGA_DO_OBJETO_EM_CASAS)
  if (contorno === null) return null
  const paredes = contorno.map((a, k): Wall => {
    const b = contorno[(k + 1) % contorno.length] ?? a
    return { id: `${PREFIXO_DO_ID}${prop.id}:${k}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: false, blocksMove: true, door: null, ...(piso !== 0 ? { piso } : {}) }
  })
  return { prop, contorno, paredes }
}

const SEM_OBSTACULOS: readonly ObstaculoDeObjeto[] = []
const cacheDeObstaculos = new WeakMap<readonly Prop[], Map<string, readonly ObstaculoDeObjeto[]>>()

/**
 * Os obstáculos dos objetos deste piso. Guardado pela lista de objetos: a mesma
 * lista (mesma referência), a mesma grade e o mesmo piso devolvem a MESMA
 * resposta, sem refazer conta nenhuma. Sem objeto que barra, a lista vazia de sempre.
 */
export function obstaculosDeObjeto(props: readonly Prop[], grid: number, piso: number): readonly ObstaculoDeObjeto[] {
  if (props.length === 0) return SEM_OBSTACULOS
  const chave = `${piso}:${grid}`
  let porChave = cacheDeObstaculos.get(props)
  if (porChave === undefined) {
    porChave = new Map()
    cacheDeObstaculos.set(props, porChave)
  }
  const guardado = porChave.get(chave)
  if (guardado !== undefined) return guardado
  const feitos: ObstaculoDeObjeto[] = []
  for (const prop of props) {
    if (pisoDe(prop) !== piso || !objetoBarraPassagem(prop)) continue
    const obstaculo = obstaculoDe(prop, grid, piso)
    if (obstaculo !== null) feitos.push(obstaculo)
  }
  const resposta = feitos.length === 0 ? SEM_OBSTACULOS : feitos
  porChave.set(chave, resposta)
  return resposta
}

function distanciaAoLado(p: Point, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento = dx * dx + dy * dy
  const t = comprimento === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** O ponto está DENTRO da forma do obstáculo, ou em cima da borda dela? */
export function pontoNoObstaculo(obstaculo: ObstaculoDeObjeto, p: Point): boolean {
  const anel = obstaculo.contorno
  let dentro = false
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const a = anel[j]
    const b = anel[i]
    if (a === undefined || b === undefined) continue
    if (distanciaAoLado(p, a, b) <= TOLERANCIA_DA_BORDA) return true
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

/** O que as contas de andar leem do mapa: as paredes vêm à parte (são as do piso). */
type MapaComObjetos = Pick<MapData, 'barranco' | 'grid' | 'props'>

const cacheDeParedes = new WeakMap<Wall[], WeakMap<readonly ObstaculoDeObjeto[], Map<string, Wall[]>>>()

/**
 * As paredes que seguram o ANDAR DO JOGADOR neste piso: as de `paredesParaAndar`
 * (mapa mais barranco) e as dos objetos que barram.
 *
 * `de` é onde a ficha está: o objeto que a contém fica de fora (nunca prender).
 * `escondido` é do HOST: o objeto que o recorte nunca entrega a este jogador
 * (camada que ele não vê, zona oculta, sala secreta) também fica de fora, senão
 * a recusa contaria que ele existe. Na tela do jogador o mapa já é o recorte.
 *
 * As mesmas entradas devolvem o MESMO array (as malhas e os blocos da batalha
 * guardam cache pela referência das paredes). Sem objeto que barre, é a própria
 * lista de `paredesParaAndar`.
 */
export function paredesParaAndarDoJogador(walls: Wall[], map: MapaComObjetos, piso: number, de: Point | null, escondido?: (prop: Prop) => boolean): Wall[] {
  const base = paredesParaAndar(walls, map, piso)
  const obstaculos = obstaculosDeObjeto(map.props, map.grid, piso)
  if (obstaculos.length === 0) return base
  const valem = obstaculos.filter((o) => !(de !== null && pontoNoObstaculo(o, de)) && escondido?.(o.prop) !== true)
  if (valem.length === 0) return base
  let porObstaculos = cacheDeParedes.get(base)
  if (porObstaculos === undefined) {
    porObstaculos = new WeakMap()
    cacheDeParedes.set(base, porObstaculos)
  }
  let porChave = porObstaculos.get(obstaculos)
  if (porChave === undefined) {
    porChave = new Map()
    porObstaculos.set(obstaculos, porChave)
  }
  const chave = valem.length === obstaculos.length ? '' : valem.map((o) => o.prop.id).join('|')
  const guardado = porChave.get(chave)
  if (guardado !== undefined) return guardado
  const todas = [...base, ...valem.flatMap((o) => o.paredes)]
  porChave.set(chave, todas)
  return todas
}

/** As paredes sem as de objeto: a conta de "passaria se não fosse o objeto?" da recusa `objeto`. */
export function semParedesDeObjeto<W extends { readonly id: string }>(paredes: readonly W[]): W[] {
  return paredes.filter((w) => !ehParedeDeObjeto(w.id))
}

const cacheDeMapas = new WeakMap<MapData, WeakMap<Wall[], MapData>>()

/**
 * O mapa com as paredes de andar do jogador (`paredesParaAndarDoJogador`), para
 * quem planeja caminho na tela dele: o clique para andar, o "Andar até aqui" e
 * o preparo da malha, que têm de usar o MESMO mapa. Sem barranco e sem objeto
 * que barre, é o próprio mapa.
 */
export function mapaParaAndarDoJogador(map: MapData, piso: number, de: Point | null): MapData {
  const walls = paredesParaAndarDoJogador(map.walls, map, piso, de)
  if (walls === map.walls) return map
  let porParedes = cacheDeMapas.get(map)
  if (porParedes === undefined) {
    porParedes = new WeakMap()
    cacheDeMapas.set(map, porParedes)
  }
  const guardado = porParedes.get(walls)
  if (guardado !== undefined) return guardado
  const novo = { ...map, walls }
  porParedes.set(walls, novo)
  return novo
}

/**
 * O ponto cai dentro de um objeto que barra, sem ser o objeto em que a ficha
 * (`de`) já está? É o que separa o aviso "Objeto no caminho" do "Você não
 * conhece o caminho" no clique que não saiu.
 */
export function objetoBarraOPonto(map: Pick<MapData, 'grid' | 'props'>, piso: number, p: Point, de: Point | null): boolean {
  return obstaculosDeObjeto(map.props, map.grid, piso).some((o) => pontoNoObstaculo(o, p) && !(de !== null && pontoNoObstaculo(o, de)))
}
