import type { AlvoDoBalde, AlvoDoBaldePorId, MapData, PinceladaDeTextura, RegionPoint, TexturaImportada, Wall } from '../types/map'
import { distanceToWall } from './doorReach'
import { pointInRing } from './floorContour'
import { caminhosParaJogador, passoDoRisco, tracosSeTocam } from './penhasco'
import { comPiso, pisoDe, pisoLido } from './pisos'

/**
 * TEXTURAS (fatia 4 do plano do relevo de 09/10/2026): a ferramenta em que o
 * mestre pinta uma textura da biblioteca (areia, floresta, neve...) por cima
 * da parte do mapa que quiser — sobre regiões e desenhos, debaixo da luz do
 * relevo. Não é a ferramenta Chão: não cria piso, só pinta por cima.
 *
 * O mapa guarda os PASSOS (`MapData.texturas`), não a imagem: pincelada,
 * balde e borracha, na ordem. Cada tela pinta de novo a partir deles
 * (`pixi/texturasRaster.ts`), com a mesma conta, e o jogador recebe só os
 * passos junto do que conhece (`texturasParaJogador`). Pelo mesmo motivo do
 * penhasco (`lib/penhasco.ts`): um mapa de continente tem dezenas de milhares
 * de px de mundo, e a pintura inteira como imagem não caberia no arquivo nem
 * na rede; o passo é um caminho de poucos pontos.
 *
 * Folha de propósito (só tipos, o penhasco e a distância de `doorReach`, folhas também): o
 * `fogFilter` importa daqui. Quem precisa da geometria das formas (o balde)
 * usa `lib/baldeDeTextura.ts`, que conversa com o relevo.
 */

/** O que o PRÓXIMO gesto da ferramenta faz (preferência da ferramenta, fora do map.json). */
export type ModoDaTextura = 'pincel' | 'balde' | 'borracha'

/**
 * Tamanho do pincel: o DIÂMETRO em px do protótipo do relevo
 * (`LADO_DO_PROTOTIPO`), como o pincel de penhasco — cresce com o mapa, e o
 * mesmo número cobre a mesma fração do continente em qualquer mapa.
 */
export const TAMANHO_DO_PINCEL_MIN = 6
export const TAMANHO_DO_PINCEL_MAX = 160
export const TAMANHO_DO_PINCEL_PADRAO = 32

/**
 * Força: o quanto a pincelada cobre o que veio antes. O padrão não é 100% de
 * propósito: um tanto da cor do desenho de baixo ainda tinge a textura, e ela
 * não "estoura" por cima da pintura do mestre.
 */
export const FORCA_MIN = 0.1
export const FORCA_MAX = 1
export const FORCA_PADRAO = 0.8

/** Raio do pincel em px de mundo (`unidade` = px de mundo por px do protótipo, `unidadeDoRelevo`). */
export function raioDoPincelDeTextura(unidade: number, tamanho: number): number {
  return (limitar(tamanho, TAMANHO_DO_PINCEL_MIN, TAMANHO_DO_PINCEL_MAX) * unidade) / 2
}

/** Passo mínimo entre dois pontos da pincelada: o mesmo do penhasco (um quarto do raio). */
export function passoDaPincelada(raio: number): number {
  return passoDoRisco(raio)
}

export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** O que o soltar do gesto fez, para a tela dizer quando não fez nada. */
export type ResultadoDaTextura =
  | 'pintou'
  /** Borracha onde não há textura nenhuma. */
  | 'nada-a-apagar'
  /** Balde fora de área fechada por paredes, de região e de desenho pintado. */
  | 'fora-de-forma'
  /** Balde com a mesma textura e força do último balde nesta forma: nada muda. */
  | 'igual'
  /** A textura escolhida não existe nesta cena (importada de outra cena ou desfeita, pacote que saiu): nada gravado. */
  | 'textura-ausente'
  /** Área fechada por paredes com cantos demais (`PONTOS_DA_AREA_MAX`): o mapa salvo não a leria de volta; nada gravado. */
  | 'area-grande'
  /** A camada Terreno está travada: nada gravado; a store já avisou com "Destravar". */
  | 'camada-travada'

// ---------------------------------------------------------------------------
// Ids

/** Prefixo do id de textura importada. O dois-pontos não cabe no id do pacote nem da biblioteca. */
export const PREFIXO_IMPORTADA = 'importada:'

const ID_DA_BIBLIOTECA = /^[a-z0-9-]{1,40}$/
const ID_IMPORTADO = /^importada:[a-z0-9-]{1,40}$/

/** Id que uma textura pode ter: da biblioteca/pacote (`a-z0-9-`) ou importada (`importada:...`). */
export function ehIdDeTextura(valor: unknown): valor is string {
  return typeof valor === 'string' && (ID_DA_BIBLIOTECA.test(valor) || ID_IMPORTADO.test(valor))
}

export function ehIdImportado(id: string): boolean {
  return id.startsWith(PREFIXO_IMPORTADA)
}

// ---------------------------------------------------------------------------
// Leitura do disco (o arquivo não é confiável: map.json editado à mão, versão futura)

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null || !('x' in valor) || !('y' in valor)) return null
  const { x, y } = valor
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function lerPontos(valor: unknown): RegionPoint[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null
  const lidos: RegionPoint[] = []
  for (const item of valor) {
    const ponto = lerPonto(item)
    // Um ponto quebrado mudaria o desenho da pincelada inteira: ela sai toda.
    if (ponto === null) return null
    lidos.push(ponto)
  }
  return lidos
}

function lerForca(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.min(FORCA_MAX, valor) : null
}

/**
 * Limite de pontos no contorno de uma ÁREA: acima dele a leitura descarta o
 * passo (o mapa salvo não cresce sem limite), e o balde nem grava
 * (`encherComTextura`): o que se cria abre de volta.
 */
export const PONTOS_DA_AREA_MAX = 20_000

function lerAlvo(valor: unknown): AlvoDoBalde | null {
  if (typeof valor !== 'object' || valor === null || !('tipo' in valor)) return null
  if (valor.tipo === 'area') {
    const pontos = lerPontos('pontos' in valor ? valor.pontos : undefined)
    return pontos !== null && pontos.length >= 3 && pontos.length <= PONTOS_DA_AREA_MAX ? { tipo: 'area', pontos } : null
  }
  if (!('id' in valor)) return null
  const { tipo, id } = valor
  if ((tipo !== 'regiao' && tipo !== 'desenho') || typeof id !== 'string' || id === '') return null
  return { tipo, id }
}

/** O mesmo alvo: a mesma forma pelo id, ou a área com o mesmo contorno (o clique de novo no mesmo lugar dá os mesmos pontos). */
export function mesmoAlvo(a: AlvoDoBalde, b: AlvoDoBalde): boolean {
  if (a.tipo === 'area' || b.tipo === 'area') {
    return a.tipo === 'area' && b.tipo === 'area' && a.pontos.length === b.pontos.length && a.pontos.every((p, i) => p.x === b.pontos[i].x && p.y === b.pontos[i].y)
  }
  return a.tipo === b.tipo && a.id === b.id
}

function lerPincelada(valor: unknown): PinceladaDeTextura | null {
  if (typeof valor !== 'object' || valor === null || !('id' in valor) || !('tipo' in valor)) return null
  const { id, tipo } = valor
  if (typeof id !== 'string' || id === '') return null
  if (tipo === 'sala') {
    const regiao = 'regiao' in valor ? valor.regiao : undefined
    return typeof regiao === 'string' && regiao !== '' ? { id, tipo, regiao, ...pisoLido(valor) } : null
  }
  if (tipo === 'esvaziar') {
    const alvo = lerAlvo('alvo' in valor ? valor.alvo : undefined)
    return alvo === null ? null : { id, tipo, alvo, ...pisoLido(valor) }
  }
  const forca = lerForca('forca' in valor ? valor.forca : undefined)
  if (forca === null) return null
  if (tipo === 'balde') {
    const textura = 'textura' in valor ? valor.textura : undefined
    const alvo = lerAlvo('alvo' in valor ? valor.alvo : undefined)
    if (!ehIdDeTextura(textura) || alvo === null) return null
    return { id, tipo, textura, forca, alvo, ...pisoLido(valor) }
  }
  if (tipo !== 'pincel' && tipo !== 'borracha') return null
  const raio = 'raio' in valor ? valor.raio : undefined
  const pontos = lerPontos('pontos' in valor ? valor.pontos : undefined)
  if (typeof raio !== 'number' || !Number.isFinite(raio) || raio <= 0 || pontos === null) return null
  if (tipo === 'borracha') return { id, tipo, forca, raio, pontos, ...pisoLido(valor) }
  const textura = 'textura' in valor ? valor.textura : undefined
  if (!ehIdDeTextura(textura)) return null
  return { id, tipo, textura, forca, raio, pontos, ...pisoLido(valor) }
}

/** Os passos do arquivo, ou `undefined` (sem o campo). Passo quebrado sai; o resto fica na ordem. */
export function lerTexturas(valor: unknown): PinceladaDeTextura[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: PinceladaDeTextura[] = []
  for (const item of valor) {
    const pincelada = lerPincelada(item)
    if (pincelada !== null) lista.push(pincelada)
  }
  return lista.length > 0 ? lista : undefined
}

/** Nome de textura: o que aparece debaixo da miniatura. */
export const NOME_DE_TEXTURA_MAX = 40

/** Ladrilho importado embutido: só imagem em base64, nunca caminho de disco nem endereço de fora. */
const IMAGEM_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

/**
 * Teto do ladrilho importado, em caracteres. O ladrilho sai com no máximo
 * `LADO_DA_IMPORTADA` px em WebP (~30 a 90 KB); o teto só barra o que veio
 * editado à mão, e o mapa salvo não cresce sem limite.
 */
export const IMAGEM_IMPORTADA_MAX_CHARS = 400_000

export function ehImagemDeTexturaImportada(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= IMAGEM_IMPORTADA_MAX_CHARS && IMAGEM_EMBUTIDA.test(valor)
}

/** As texturas importadas do arquivo, ou `undefined`. A quebrada (sem imagem embutida válida) sai. */
export function lerTexturasImportadas(valor: unknown): TexturaImportada[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: TexturaImportada[] = []
  const vistos = new Set<string>()
  for (const item of valor) {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('nome' in item) || !('imagem' in item)) continue
    const { id, nome, imagem } = item
    if (typeof id !== 'string' || !ID_IMPORTADO.test(id) || vistos.has(id)) continue
    if (typeof nome !== 'string' || !ehImagemDeTexturaImportada(imagem)) continue
    vistos.add(id)
    lista.push({ id, nome: nomeDaTextura(nome), imagem })
  }
  return lista.length > 0 ? lista : undefined
}

/** O nome limpo: espaços nas pontas fora, até `NOME_DE_TEXTURA_MAX`; vazio vira "Textura". */
export function nomeDaTextura(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DE_TEXTURA_MAX)
  return limpo === '' ? 'Textura' : limpo
}

// ---------------------------------------------------------------------------
// O mapa

/** O mapa com estes passos. Lista vazia tira o campo (o mapa volta a ser o de antes das texturas). */
export function comTexturas(map: MapData, lista: readonly PinceladaDeTextura[]): MapData {
  if (lista.length > 0) return { ...map, texturas: [...lista] }
  if (map.texturas === undefined) return map
  const { texturas: _semTexturas, ...resto } = map
  return resto
}

/** O mapa com estas texturas importadas. Lista vazia tira o campo. */
export function comTexturasImportadas(map: MapData, lista: readonly TexturaImportada[]): MapData {
  if (lista.length > 0) return { ...map, texturasImportadas: [...lista] }
  if (map.texturasImportadas === undefined) return map
  const { texturasImportadas: _semImportadas, ...resto } = map
  return resto
}

/** Retângulo de mundo. */
export interface Caixa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function caixaDoCaminho(pontos: readonly RegionPoint[], raio: number): Caixa {
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
  return { minX: minX - raio, minY: minY - raio, maxX: maxX + raio, maxY: maxY + raio }
}

export function caixasSeTocam(a: Caixa, b: Caixa): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
}

/**
 * Soma um passo à lista. A borracha que não passa por textura nenhuma pintada
 * antes dela não vira passo (nem passo vazio no desfazer) e devolve o motivo.
 * `caixaDoAlvo` diz onde fica a forma de um balde (`lib/baldeDeTextura.ts`);
 * sem ela, todo balde conta como debaixo da borracha.
 */
export function somarPincelada(
  lista: readonly PinceladaDeTextura[],
  pincelada: PinceladaDeTextura,
  caixaDoAlvo?: (alvo: AlvoDoBalde) => Caixa | null,
): { lista: readonly PinceladaDeTextura[]; resultado: ResultadoDaTextura } {
  if (pincelada.tipo === 'borracha' || pincelada.tipo === 'esvaziar') {
    // O que o passo tira: o caminho da borracha, ou a forma inteira do balde que esvazia (Alt + clique).
    const borracha = pincelada.tipo === 'borracha' ? pincelada : null
    const caixa =
      pincelada.tipo === 'borracha'
        ? caixaDoCaminho(pincelada.pontos, pincelada.raio)
        : caixaDoAlvo === undefined
          ? undefined
          : caixaDoAlvo(pincelada.alvo)
    // Esvaziar uma forma que sumiu não tira nada.
    if (caixa === null) return { lista, resultado: 'nada-a-apagar' }
    const temDebaixo = lista.some((item) => {
      if (item.tipo === 'pincel') {
        if (borracha !== null) return tracosSeTocam(item, borracha)
        return caixa === undefined || caixasSeTocam(caixaDoCaminho(item.pontos, item.raio), caixa)
      }
      if (item.tipo === 'balde') {
        const caixaDoBalde = caixaDoAlvo === undefined ? undefined : caixaDoAlvo(item.alvo)
        return caixa === undefined || caixaDoBalde === undefined || (caixaDoBalde !== null && caixasSeTocam(caixaDoBalde, caixa))
      }
      return false
    })
    if (!temDebaixo) return { lista, resultado: 'nada-a-apagar' }
  }
  if (pincelada.tipo === 'balde') {
    // O mesmo balde de novo na mesma forma não muda nada (o último já cobriu igual).
    const ultimoNaForma = [...lista].reverse().find((item) => item.tipo === 'balde' && mesmoAlvo(item.alvo, pincelada.alvo))
    const ultimo = lista[lista.length - 1]
    if (ultimoNaForma !== undefined && ultimoNaForma === ultimo && ultimo.tipo === 'balde' && ultimo.textura === pincelada.textura && ultimo.forca === pincelada.forca) {
      return { lista, resultado: 'igual' }
    }
  }
  return { lista: [...lista, pincelada], resultado: 'pintou' }
}

/** Os ids de textura que os passos usam (pincel e balde). */
export function texturasUsadas(lista: readonly PinceladaDeTextura[] | undefined): Set<string> {
  const usadas = new Set<string>()
  for (const item of lista ?? []) if (item.tipo === 'pincel' || item.tipo === 'balde') usadas.add(item.textura)
  return usadas
}

/** Tira uma textura importada e os passos que a pintavam (o que ela cobria volta a aparecer). */
export function semTexturaImportada(map: MapData, id: string): MapData {
  const importadas = map.texturasImportadas ?? []
  if (!importadas.some((t) => t.id === id)) return map
  const passos = (map.texturas ?? []).filter((item) => (item.tipo !== 'pincel' && item.tipo !== 'balde') || item.textura !== id)
  return comTexturas(comTexturasImportadas(map, importadas.filter((t) => t.id !== id)), soComTinta(passos))
}

/** Borracha (e sala) no começo da lista não tira nada de ninguém: sai. */
function soComTinta<T extends PinceladaDeTextura>(lista: readonly T[]): T[] {
  const primeira = lista.findIndex((item) => item.tipo === 'pincel' || item.tipo === 'balde')
  return primeira < 0 ? [] : lista.slice(primeira)
}

// ---------------------------------------------------------------------------
// Jogador

/**
 * Folga, em quadrados da grade, com que um canto do contorno da ÁREA conta como
 * em cima de uma parede. A tinta do balde vai até o eixo da parede; a
 * simplificação e a fresta afastam o canto dele no máximo uma célula do balde,
 * e a célula (4 milhões no mapa inteiro) é menor que meio quadrado.
 */
export const FOLGA_DA_AREA_NA_PAREDE = 0.5

/** Seno do maior ângulo (15°) com que uma parede ainda conta como paralela a um lado do contorno. */
const SENO_DE_QUASE_PARALELA = Math.sin((15 * Math.PI) / 180)

type TracoDeParede = Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>

/**
 * A fração do lado que as paredes que correm junto dele precisam cobrir para o
 * lado ser FEITO por elas. O contorno do balde segue as paredes que o cercam,
 * então o lado de uma área de verdade corre em parede (comum ou escondida) de
 * ponta a ponta, tirando a fresta da simplificação.
 */
const LADO_FEITO_DE_PAREDE = 0.5

/**
 * O trecho do lado `a`-`b` do contorno (de, até: posição ao longo dele) em que
 * a parede CORRE JUNTO dele: mais ou menos paralela e a até `folga` dele. A que
 * só encosta a ponta no lado, ou o cruza de través, não corre junto (`null`).
 */
function trechoJuntoDoLado(w: TracoDeParede, a: RegionPoint, b: RegionPoint, folga: number): readonly [number, number] | null {
  // Caixa primeiro: quase nenhuma parede chega perto deste lado.
  if (Math.max(w.x1, w.x2) < Math.min(a.x, b.x) - folga || Math.min(w.x1, w.x2) > Math.max(a.x, b.x) + folga) return null
  if (Math.max(w.y1, w.y2) < Math.min(a.y, b.y) - folga || Math.min(w.y1, w.y2) > Math.max(a.y, b.y) + folga) return null
  const lado = Math.hypot(b.x - a.x, b.y - a.y)
  const comprimento = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
  if (lado === 0 || comprimento === 0) return null
  const ux = (b.x - a.x) / lado
  const uy = (b.y - a.y) / lado
  if (Math.abs(ux * (w.y2 - w.y1) - uy * (w.x2 - w.x1)) > comprimento * SENO_DE_QUASE_PARALELA) return null
  // Cada ponta da parede: a posição ao longo do lado (`t`) e o afastamento da reta dele (`o`).
  const t1 = (w.x1 - a.x) * ux + (w.y1 - a.y) * uy
  const t2 = (w.x2 - a.x) * ux + (w.y2 - a.y) * uy
  const o1 = (w.x1 - a.x) * uy - (w.y1 - a.y) * ux
  const o2 = (w.x2 - a.x) * uy - (w.y2 - a.y) * ux
  // O trecho da parede que cai dentro do lado...
  let de = Math.max(0, Math.min(t1, t2))
  let ate = Math.min(lado, Math.max(t1, t2))
  // ...e, dele, o pedaço a até `folga` da reta (o afastamento muda em linha reta ao longo da parede).
  const inclinacao = (o2 - o1) / (t2 - t1)
  if (inclinacao === 0) {
    if (Math.abs(o1) > folga) return null
  } else {
    const entra = t1 + (-folga - o1) / inclinacao
    const sai = t1 + (folga - o1) / inclinacao
    de = Math.max(de, Math.min(entra, sai))
    ate = Math.min(ate, Math.max(entra, sai))
  }
  return ate > de ? [de, ate] : null
}

/** O lado `a`-`b` é FEITO pelas `paredes`: as que correm junto dele cobrem `LADO_FEITO_DE_PAREDE` dele ou mais. */
function ladoFeitoDeParede(paredes: readonly TracoDeParede[], a: RegionPoint, b: RegionPoint, folga: number): boolean {
  const trechos = paredes
    .flatMap((w) => {
      const trecho = trechoJuntoDoLado(w, a, b, folga)
      return trecho === null ? [] : [trecho]
    })
    .sort((p, q) => p[0] - q[0])
  let coberto = 0
  let fim = -Infinity
  for (const [de, ate] of trechos) {
    if (ate <= fim) continue
    coberto += ate - Math.max(de, fim)
    fim = ate
  }
  return coberto >= Math.hypot(b.x - a.x, b.y - a.y) * LADO_FEITO_DE_PAREDE
}

/** As paredes que chegam na caixa (a conta fina só roda para elas). */
function paredesNaCaixa(paredes: readonly TracoDeParede[], caixa: Caixa): TracoDeParede[] {
  return paredes.filter(
    (w) => Math.max(w.x1, w.x2) >= caixa.minX && Math.min(w.x1, w.x2) <= caixa.maxX && Math.max(w.y1, w.y2) >= caixa.minY && Math.min(w.y1, w.y2) <= caixa.maxY,
  )
}

/**
 * O contorno da ÁREA fechada por paredes passa por alguma das `paredes`: um
 * canto dele a até `FOLGA_DA_AREA_NA_PAREDE` quadrado do eixo dela, ou um LADO
 * dele correndo junto dela na mesma folga (`trechoJuntoDoLado`: o trecho de
 * parede escondida no meio de uma reta, entre duas paredes comuns, longe de
 * todo canto). O contorno segue o eixo das paredes que cercam a área, então a
 * parede que quem recebe o passo NÃO recebe (a de sala secreta fechada, a
 * invisível, a de camada escondida dos jogadores, a que a imagem exportada
 * tira) sairia desenhada nele: o buraco no formato do cofre no meio do salão,
 * onde quer que o mestre tenha posto a parede dele (12/11/2026).
 *
 * Com `todas` (as paredes do mapa, as escondidas também), o LADO só conta se
 * for feito de parede (`ladoFeitoDeParede`): a faixa que atravessa a sala
 * secreta e passa a meia casa da parede dela por 6 de 44 casas não foi feita
 * por ela e não a desenha. Sem isto a faixa inteira sumia para o jogador, e a
 * falta dela entregava a sala (F-N09 da 0.5.62). O canto em cima da parede
 * escondida continua segurando a área sempre.
 */
export function areaPassaPorParede(pontos: readonly RegionPoint[], paredes: readonly TracoDeParede[], grid: number, todas?: readonly TracoDeParede[]): boolean {
  if (paredes.length === 0 || pontos.length === 0) return false
  const folga = grid * FOLGA_DA_AREA_NA_PAREDE
  // Caixa primeiro: só a parede que chega perto da caixa do contorno entra na conta fina.
  const caixa = caixaDoCaminho(pontos, folga)
  const perto = paredesNaCaixa(paredes, caixa)
  if (perto.length === 0) return false
  if (pontos.some((p) => perto.some((w) => distanceToWall(p, w) <= folga))) return true
  const todasPerto = todas === undefined ? null : paredesNaCaixa(todas, caixa)
  return pontos.some((b, i) => {
    const a = pontos[(i + pontos.length - 1) % pontos.length]
    if (!perto.some((w) => trechoJuntoDoLado(w, a, b, folga) !== null)) return false
    return todasPerto === null || ladoFeitoDeParede(todasPerto, a, b, folga)
  })
}

/** Quanto, em px de mundo, o canto do contorno da ÁREA é puxado para DENTRO dela antes de perguntar se o jogador o conhece. */
const RECUO_DO_CANTO_PX = 2

/**
 * O jogador conhece algum CANTO da área POR DENTRO: o canto do contorno puxado
 * `RECUO_DO_CANTO_PX` para dentro dela, pela bissetriz. O contorno corre no
 * eixo das paredes, e o canto em cima da parede contava como conhecido para
 * quem só via a parede pelo lado de FORA: a área do cômodo fechado ao lado ia
 * inteira no pacote (12/11/2026).
 *
 * "Dentro" é perguntado ao polígono (par-ímpar), não ao sentido do contorno:
 * no canto reentrante e no contorno de um buraco, dentro da área é para o
 * outro lado da bissetriz, então os dois lados são tentados e só vale o que
 * cai na área. O canto sem lado de dentro (ponto repetido, lados um sobre o
 * outro) não conta.
 */
function conheceUmCantoPorDentro(pontos: readonly RegionPoint[], conhece: (p: RegionPoint) => boolean): boolean {
  const n = pontos.length
  if (n < 3) return false
  const anel = [...pontos]
  for (let i = 0; i < n; i += 1) {
    const p = anel[i]
    const antes = anel[(i + n - 1) % n]
    const depois = anel[(i + 1) % n]
    const atras = Math.hypot(antes.x - p.x, antes.y - p.y)
    const adiante = Math.hypot(depois.x - p.x, depois.y - p.y)
    if (atras === 0 || adiante === 0) continue
    // A bissetriz: a soma dos rumos (de tamanho 1) do canto aos dois vizinhos.
    let dx = (antes.x - p.x) / atras + (depois.x - p.x) / adiante
    let dy = (antes.y - p.y) / atras + (depois.y - p.y) / adiante
    const soma = Math.hypot(dx, dy)
    if (soma > 2 - 1e-9) continue
    // Lados em linha reta: não há bissetriz, vale a perpendicular ao lado.
    if (soma < 1e-9) {
      dx = -(depois.y - p.y) / adiante
      dy = (depois.x - p.x) / adiante
    }
    const escala = RECUO_DO_CANTO_PX / Math.hypot(dx, dy)
    for (const lado of [1, -1]) {
      const q = { x: p.x + lado * dx * escala, y: p.y + lado * dy * escala }
      // `conhece` primeiro: a conta do polígono (o contorno inteiro) só roda para o ponto que ele conhece.
      if (conhece(q) && pointInRing(q, anel)) return true
    }
  }
  return false
}

/**
 * Os passos que vão ao jogador:
 * - pincel e borracha: só os pedaços cujo disco encosta no que ele conhece
 *   (`caminhosParaJogador`, o mesmo corte do penhasco). O resto do caminho do
 *   mestre não sai: diria onde ele pintou floresta na névoa;
 * - balde (e o esvaziar dele): só se a forma que ele enche chegou no recorte
 *   (`formaNoRecorte`). A forma já está com ele; o balde não diz nada que ela
 *   não diga. A ÁREA fechada por paredes não é forma do mapa: vai quando ele
 *   conhece algum canto dela POR DENTRO (`conheceUmCantoPorDentro`: a parede
 *   vista só pelo lado de fora não conta) ou,
 *   com `conhecidaPorDentro`, quando ele a conhece POR DENTRO (a visão entra
 *   nela, ou o explorado tem ponto dentro; ver `knownFromInside` no recorte):
 *   o contorno são só os cantos, e no meio de um salão grande ele não via
 *   nenhum (12/11/2026). Nunca a área cujo contorno `denunciaSegredo`: o
 *   buraco no formato da sala secreta que ele não conhece (`areaPassaPorParede`).
 * A tela dele ainda guarda a textura sob a máscara do conhecido. Borracha no
 * começo (sem tinta antes dela no que sobrou) sai.
 */
export function texturasParaJogador(
  lista: readonly PinceladaDeTextura[] | undefined,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
  formaNoRecorte: (alvo: AlvoDoBaldePorId) => boolean,
  conhecidaPorDentro: (pontos: readonly RegionPoint[]) => boolean = () => false,
  denunciaSegredo: (pontos: readonly RegionPoint[]) => boolean = () => false,
): PinceladaDeTextura[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const noRecorte = (alvo: AlvoDoBalde): boolean =>
    alvo.tipo === 'area'
      ? !denunciaSegredo(alvo.pontos) && (conheceUmCantoPorDentro(alvo.pontos, conhece) || conhecidaPorDentro(alvo.pontos))
      : formaNoRecorte(alvo)
  const saida: PinceladaDeTextura[] = []
  for (const item of lista) {
    if (item.tipo === 'balde' || item.tipo === 'esvaziar') {
      if (noRecorte(item.alvo)) saida.push(item)
      continue
    }
    // A sala que ele não conhece não abre buraco na textura: fica como estava para ele.
    if (item.tipo === 'sala') {
      if (formaNoRecorte({ tipo: 'regiao', id: item.regiao })) saida.push(item)
      continue
    }
    saida.push(...caminhosParaJogador([item], conhece, escondido))
  }
  const comTinta = soComTinta(saida)
  return comTinta.length > 0 ? comTinta : undefined
}

/** O nome que a importada leva para fora do editor (recorte do jogador, imagem exportada). */
const NOME_DA_IMPORTADA_NO_RECORTE = 'Textura'

/** As texturas importadas que os passos do jogador usam, sem o nome do mestre; as outras ficam com ele. */
export function importadasParaJogador(
  importadas: readonly TexturaImportada[] | undefined,
  passos: readonly PinceladaDeTextura[] | undefined,
): TexturaImportada[] | undefined {
  if (importadas === undefined || passos === undefined) return undefined
  const usadas = texturasUsadas(passos)
  // O nome sai do nome do arquivo do mestre ("lava-covil-do-dragao.png"): o
  // jogador só precisa do id e da imagem para pintar, então vai um nome neutro.
  const vao = importadas.filter((t) => usadas.has(t.id)).map((t) => ({ id: t.id, nome: NOME_DA_IMPORTADA_NO_RECORTE, imagem: t.imagem }))
  return vao.length > 0 ? vao : undefined
}

/** Assinatura do que os passos pintam: a pintura só é refeita quando ela muda. */
export function assinaturaDasTexturas(lista: readonly PinceladaDeTextura[] | undefined): string {
  if (lista === undefined) return ''
  return lista
    .map((item) =>
      item.tipo === 'sala'
        ? `${item.id}:s:${item.regiao}`
        : item.tipo === 'balde'
        ? `${item.id}:b:${item.textura}:${item.forca}:${assinaturaDoAlvo(item.alvo)}`
        : item.tipo === 'esvaziar'
        ? `${item.id}:v:${assinaturaDoAlvo(item.alvo)}`
        : `${item.id}:${item.tipo === 'pincel' ? `p:${item.textura}` : 'e'}:${item.forca}:${item.raio}:${item.pontos.map((p) => `${p.x},${p.y}`).join(' ')}`,
    )
    .join('|')
}

function assinaturaDoAlvo(alvo: AlvoDoBalde): string {
  return alvo.tipo === 'area' ? `area:${alvo.pontos.map((p) => `${p.x},${p.y}`).join(' ')}` : `${alvo.tipo}:${alvo.id}`
}

// ---------------------------------------------------------------------------
// Sala por cima

/**
 * SALA POR CIMA DA TEXTURA (pedido de 12/10/2026: "A sala é para ficar acima
 * das texturas caso a sala tenha sido feito depois de ter colocado a
 * textura"). A sala nova (id que não existia em `antes`) num piso que já tem
 * textura ganha um passo `sala` no fim da lista: na pintura ele tira de
 * dentro dela a textura dos passos de antes (`lib/planoDasTexturas.ts`), e o
 * que o mestre pintar depois cobre a sala de novo. Vale para toda forma de
 * criar (ferramenta, colar, duplicar): roda no `withHistory` da store, no
 * mesmo passo do desfazer da sala. Só salas (`room`): a região comum segue
 * debaixo da textura, como antes. Nada mudou: `depois` ele mesmo.
 */
export function salasPorCimaDasTexturas(antes: MapData, depois: MapData): MapData {
  const passos = depois.texturas
  if (passos === undefined || passos.length === 0 || antes.regions === depois.regions) return depois
  const existiam = new Set(antes.regions.map((r) => r.id))
  const novos: PinceladaDeTextura[] = []
  for (const regiao of depois.regions) {
    if (regiao.room === undefined || existiam.has(regiao.id)) continue
    const piso = pisoDe(regiao)
    if (!passos.some((p) => pisoDe(p) === piso)) continue
    novos.push(comPiso<PinceladaDeTextura>({ id: crypto.randomUUID(), tipo: 'sala', regiao: regiao.id }, piso))
  }
  return novos.length === 0 ? depois : { ...depois, texturas: [...passos, ...novos] }
}
