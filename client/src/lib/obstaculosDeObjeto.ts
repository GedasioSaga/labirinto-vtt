import type { MapData, Prop, RegionPoint, TipoMobilia, Token, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { paredesParaAndar } from './barranco'
import { ehMovelDoChao, ehMovelQueBarra, ehMovelRedondo, vistaDoMovel } from './mobilia'
import { construcaoTapaDeFabrica, ehConstrucao, medidaPeloMenorLado } from './mobilia/construcoes'
import { pisoDe } from './pisos'
import { rotatePointAround, rotationTrig } from './roomRotation'
import type { AlcancePeloObjeto } from './tipoDoAlcancePeloObjeto'

/**
 * OBJETO GRANDE BARRA A FICHA DO JOGADOR (pedido do mestre de 12/11/2026: "esse
 * tipo de construto mais grande como o cata-vento e alguns outros tem que ter
 * uma colisão para os jogadores não passarem por dentro").
 *
 * O obstáculo sai do próprio objeto, sem campo de geometria: a caixa girada, ou
 * a elipse de `LADOS_DA_ELIPSE` lados quando a silhueta é redonda
 * (`ehMovelRedondo`), encolhida à pegada sólida do tipo quando o desenho não
 * ocupa a caixa inteira (`PEGADA_SOLIDA`). Vira PAREDES SINTÉTICAS, como as do barranco
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
/**
 * PEGADA SÓLIDA por tipo: a fração da caixa do objeto que barra, quando o
 * desenho não a ocupa inteira. Quem não está aqui barra com a caixa toda (1).
 * `torreDePedra` 0,8: o raio da parede no desenho (`RAIO_SOLIDO_DA_TORRE` em `texturas/meioTermo/moveis/torreDePedra.ts`, que `lib` não importa).
 */
const PEGADA_SOLIDA: Partial<Record<TipoMobilia, number>> = { torreDePedra: 0.8 }

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

/**
 * TAPA A VISÃO (construções, 12/11/2026, decisão do mestre: "Deve ter a opção de que sim e de que não"). Só a
 * construção (`lib/mobilia/construcoes.ts`) pode tapar; para as outras a chave nem aparece. A forma é a MESMA da
 * colisão (`contornoDoObjeto`: caixa girada ou polígono da elipse, pegada sólida, menor lado), e mesmo a
 * construção que não barra a passagem pode tapar (o mestre liga as duas chaves como quiser).
 */
export function objetoPodeTapar(prop: Pick<Prop, 'mobilia' | 'item'>): boolean {
  return prop.item === undefined && ehConstrucao(prop.mobilia)
}

/** O que a chave "Tapa a visão" mostra: a escolha do mestre (`Prop.tapaVisao`), senão o padrão do tipo. */
export function tapaVisaoEscolhida(prop: Pick<Prop, 'mobilia' | 'item' | 'tapaVisao'>): boolean {
  if (prop.item !== undefined || !ehConstrucao(prop.mobilia)) return false
  return typeof prop.tapaVisao === 'boolean' ? prop.tapaVisao : construcaoTapaDeFabrica(prop.mobilia)
}

/**
 * A construção tapa a visão AGORA? A escolha acima, menos a escondida (`hidden`) e a secreta (`secret`): a sombra
 * dela contaria que ela existe. O lugar escondido (camada, zona oculta, sala secreta) é o RECORTE quem tira
 * (`lib/fogFilter.ts`): na tela do jogador o mapa já é o recorte.
 */
export function objetoTapaVisao(prop: Prop): boolean {
  if (prop.hidden === true || prop.secret === true) return false
  return tapaVisaoEscolhida(prop)
}

/** O padrão do tipo para a chave (só construção tem padrão ligado). */
function tapaDeFabrica(prop: Pick<Prop, 'mobilia'>): boolean {
  return ehConstrucao(prop.mobilia) && construcaoTapaDeFabrica(prop.mobilia)
}

/** A construção com a chave em `tapa`; o campo só fica quando difere do padrão. O que já vale devolve o MESMO objeto. */
export function comTapaVisao(prop: Prop, tapa: boolean): Prop {
  const { tapaVisao: antes, ...resto } = prop
  const gravado = objetoPodeTapar(prop) && tapa !== tapaDeFabrica(prop) ? tapa : undefined
  if (gravado === antes) return prop
  return gravado === undefined ? resto : { ...resto, tapaVisao: gravado }
}

/** O mapa com a chave da construção `id` em `tapa`; sem a construção, ou sem nada a mudar, o MESMO mapa. */
export function comTapaVisaoNoMapa(map: MapData, id: string, tapa: boolean): MapData {
  const antes = map.props.find((p) => p.id === id)
  if (antes === undefined) return map
  const depois = comTapaVisao(antes, tapa)
  return depois === antes ? map : { ...map, props: map.props.map((p) => (p === antes ? depois : p)) }
}

/** Leitura do disco: só booleano, em construção e diferente do padrão fica; o resto some. Sem nada a consertar, o mesmo objeto. */
export function lerTapaVisao(prop: Prop): Prop {
  if (!Object.hasOwn(prop, 'tapaVisao')) return prop
  const valor: unknown = prop.tapaVisao
  if (typeof valor === 'boolean' && objetoPodeTapar(prop) && valor !== tapaDeFabrica(prop)) return prop
  const { tapaVisao: _torto, ...resto } = prop
  return resto
}

/** Um trecho que segura o olhar (o `Segment` de `lib/visibility.ts`, sem importá-lo: ela importa daqui). */
export interface TrechoQueTapa {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

/** Uma construção que tapa: o objeto, o contorno (o mesmo da colisão) e os trechos dele. */
export interface ConstrucaoQueTapa {
  readonly prop: Prop
  readonly contorno: readonly RegionPoint[]
  readonly trechos: readonly TrechoQueTapa[]
}

const SEM_CONSTRUCOES: readonly ConstrucaoQueTapa[] = []
const cacheDasQueTapam = new WeakMap<readonly Prop[], Map<number, readonly ConstrucaoQueTapa[]>>()

/**
 * As construções de `props` que tapam a visão agora (`objetoTapaVisao`), com o contorno e os trechos. Guardado pela
 * lista de objetos e pela grade: a mesma lista devolve a MESMA resposta. NÃO filtra piso nem lugar escondido: quem
 * chama passa a lista do piso de quem olha, já sem o que o jogador não recebe (o recorte, `lib/fogFilter.ts`).
 */
export function construcoesQueTapam(props: readonly Prop[], grid: number): readonly ConstrucaoQueTapa[] {
  if (props.length === 0) return SEM_CONSTRUCOES
  let porGrade = cacheDasQueTapam.get(props)
  if (porGrade === undefined) {
    porGrade = new Map()
    cacheDasQueTapam.set(props, porGrade)
  }
  const guardado = porGrade.get(grid)
  if (guardado !== undefined) return guardado
  const feitas: ConstrucaoQueTapa[] = []
  for (const prop of props) {
    if (!objetoTapaVisao(prop)) continue
    const contorno = contornoDoObjeto(prop, grid * FOLGA_DO_OBJETO_EM_CASAS)
    if (contorno === null) continue
    const trechos = contorno.map((a, k): TrechoQueTapa => {
      const b = contorno[(k + 1) % contorno.length] ?? a
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    })
    feitas.push({ prop, contorno, trechos })
  }
  const resposta = feitas.length === 0 ? SEM_CONSTRUCOES : feitas
  porGrade.set(grid, resposta)
  return resposta
}

/**
 * O contorno de uma construção em px de mundo (a forma da colisão e da sombra), para o recorte medir se o jogador
 * vê uma ponta dela (`lib/fogFilter.ts`, a construção como o telhado). Vale para toda construção, tape ou não;
 * `null` para o que não é construção ou tem medida estragada.
 */
export function contornoDaConstrucao(prop: Prop, grid: number): RegionPoint[] | null {
  return ehConstrucao(prop.mobilia) ? contornoDoObjeto(prop, grid * FOLGA_DO_OBJETO_EM_CASAS) : null
}

/**
 * Os ids das construções que tapam e CONTÊM o ponto (quem olha de dentro da torre não fica cego: a construção que o
 * contém não tapa para ele). Vazio = nenhuma.
 */
export function construcoesQueContem(props: readonly Prop[], grid: number, p: Point): string[] {
  return construcoesQueTapam(props, grid)
    .filter((c) => pontoNoObstaculo({ prop: c.prop, contorno: c.contorno, paredes: [] }, p))
    .map((c) => c.prop.id)
}

/** O id é de uma parede de objeto (e não de uma parede do mapa)? */
export function ehParedeDeObjeto(id: string): boolean {
  return id.startsWith(PREFIXO_DO_ID)
}

/** A fração da caixa que o obstáculo deste tipo ocupa (`PEGADA_SOLIDA`); 1 = a caixa inteira. */
export function pegadaSolidaDoTipo(tipo: TipoMobilia | undefined): number {
  return tipo === undefined ? 1 : (PEGADA_SOLIDA[tipo] ?? 1)
}

/** O contorno do objeto em px de mundo, ou `null` quando as medidas não servem (arquivo estragado). */
function contornoDoObjeto(prop: Prop, folga: number): RegionPoint[] | null {
  if (![prop.x, prop.y, prop.width, prop.height].every(Number.isFinite) || !(prop.width > 0) || !(prop.height > 0)) return null
  // A pegada sólida do tipo encolhe a forma antes de ela virar parede (a torre de pedra: só até a parede desenhada).
  const pegada = pegadaSolidaDoTipo(prop.mobilia)
  // CONSTRUÇÕES (12/11/2026, achado A5): a torre de pedra, a de vigia e o moinho se desenham pelo MENOR lado da
  // caixa, centrados; esticados, a colisão segue o desenho, e não a caixa inteira.
  const menor = medidaPeloMenorLado(prop.mobilia) ? Math.min(prop.width, prop.height) : null
  const meiaLargura = ((menor ?? prop.width) / 2) * pegada + folga
  const meiaAltura = ((menor ?? prop.height) / 2) * pegada + folga
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
 * `base` mais as paredes dos obstáculos `valem` (os de `obstaculos` que
 * contam nesta conta). As mesmas entradas devolvem o MESMO array; sem nenhum
 * que valha, a própria `base`.
 */
function juntarParedes(base: Wall[], obstaculos: readonly ObstaculoDeObjeto[], valem: readonly ObstaculoDeObjeto[]): Wall[] {
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
  return juntarParedes(base, obstaculos, valem)
}

/**
 * As paredes que seguram o NPC que anda sozinho (rotina, patrulha) neste piso:
 * as do piso e as dos objetos que barram (decisão 7 do mestre, 12/11/2026: o
 * jogador via o NPC atravessar o moinho). Sem barranco (o motor do NPC nunca o
 * contou) e sem o filtro de quem não vê o objeto: o NPC é do mestre. O objeto
 * escondido (`hidden`) ou secreto continua sem barrar (`objetoBarraPassagem`):
 * o jogador veria o NPC desviar do nada.
 *
 * `de` é onde o NPC está: o objeto que o contém fica de fora (NUNCA PRENDER: a
 * Vendedora dentro da barraca sai). As mesmas entradas devolvem o MESMO array.
 */
export function paredesDoNpc(walls: Wall[], props: readonly Prop[], grid: number, piso: number, de: Point): Wall[] {
  const obstaculos = obstaculosDeObjeto(props, grid, piso)
  if (obstaculos.length === 0) return walls
  return juntarParedes(walls, obstaculos, obstaculos.filter((o) => !pontoNoObstaculo(o, de)))
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

/** De onde o alcance pelo objeto lê os objetos: o RECORTE do jogador (na tela, o mapa que chegou; no host, o `view.map` dele). */
export type ObjetosDoAlcance = Pick<MapData, 'grid' | 'props'>

/** Distância do ponto à forma do obstáculo: zero dentro dela (ou em cima da borda). */
function distanciaAoObstaculo(obstaculo: ObstaculoDeObjeto, p: Point): number {
  if (pontoNoObstaculo(obstaculo, p)) return 0
  const anel = obstaculo.contorno
  let menor = Number.POSITIVE_INFINITY
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i, i += 1) {
    const a = anel[j]
    const b = anel[i]
    if (a === undefined || b === undefined) continue
    menor = Math.min(menor, distanciaAoLado(p, a, b))
  }
  return menor
}

/**
 * ALCANCE PELO OBJETO (caça de 12/11/2026, J9): quem encosta num objeto que
 * barra alcança o que está DENTRO dele — o item, a passagem ou a escada no
 * meio da torre. Sem isto o alcance ia só até o ponto, e a ficha parada na
 * parede do objeto grande ouvia "Chegue mais perto" para sempre.
 *
 * Se `ponto` cai dentro da forma de um objeto que barra no piso da ficha,
 * mede da ficha até o contorno dessa forma, com o MESMO `alcance` (px) da
 * conta de sempre. `objetos` é o recorte do jogador: objeto que ele não
 * recebe (escondido, secreto, camada, zona oculta, sala secreta) não conta,
 * para o alcance não contar que ele existe. Host e tela passam o mesmo
 * recorte, senão o botão acende e o host recusa.
 */
export function alcancaPeloObjeto(objetos: ObjetosDoAlcance, ficha: Pick<Token, 'x' | 'y' | 'piso'>, ponto: Point, alcance: number): boolean {
  if (!(alcance >= 0) || ![ficha.x, ficha.y, ponto.x, ponto.y].every(Number.isFinite)) return false
  for (const obstaculo of obstaculosDeObjeto(objetos.props, objetos.grid, pisoDe(ficha))) {
    if (pontoNoObstaculo(obstaculo, ponto) && distanciaAoObstaculo(obstaculo, ficha) <= alcance) return true
  }
  return false
}

// O tipo da função presa ao recorte mora em `lib/tipoDoAlcancePeloObjeto.ts` (a guarda da nuvem segue o import de tipo).
export type { AlcancePeloObjeto }

/** `alcancaPeloObjeto` preso ao recorte `objetos` (ver `AlcancePeloObjeto`). */
export function alcancePeloObjeto(objetos: ObjetosDoAlcance): AlcancePeloObjeto {
  return (ficha, ponto, alcance) => alcancaPeloObjeto(objetos, ficha, ponto, alcance)
}

/**
 * O ponto cai dentro de um objeto que barra, sem ser o objeto em que a ficha
 * (`de`) já está? É o que separa o aviso "Objeto no caminho" do "Você não
 * conhece o caminho" no clique que não saiu.
 */
export function objetoBarraOPonto(map: Pick<MapData, 'grid' | 'props'>, piso: number, p: Point, de: Point | null): boolean {
  return obstaculosDeObjeto(map.props, map.grid, piso).some((o) => pontoNoObstaculo(o, p) && !(de !== null && pontoNoObstaculo(o, de)))
}
