import type { FogoDoMovel, FormaDoTapete, FormaDosPratos, MapData, Prop, TipoMobilia, VistaMobilia } from '../types/map'
import { CURVE_EPSILON_PX, curvaForTurnDegrees, stairArcOf, stairArcPoint, STAIR_CURVE_MAX_TURN_DEGREES, type StairArc } from './stairCurve'
import { TIPOS_MOBILIA } from './mobilia/tipos'
import {
  contornoDaPecaNovaDeLado,
  ehPecaNova,
  FICHAS_DAS_PECAS_NOVAS,
  PECAS_NOVAS_COM_VISTA,
  porPecaNova,
  TAMANHO_DE_LADO_DAS_PECAS_NOVAS,
  tracosDaPecaNova,
} from './mobilia/pecasNovas'
import { ofereceDesenhoEmLinhas } from './mobilia/desenhoDoMovel'
import { ehMovelComFogoDeCasa, FOGOS_DO_MOVEL, linguasDoFogoDeCasa } from './mobilia/fogoDeCasa'
import { CASAS_DA_FORMA_DA_PILHA, ehMovelDePilha, formaDaPilha, formaDoMovelDePilha, normalizarFormaDaPilha, type FormaDaPilha } from './mobilia/pilhas'

/**
 * MOBÍLIA DESENHADA — barril, caixa, baú, cama, mesa, cadeira, cerca, armário
 * de cozinha, aparador e fogueira como objetos sem imagem, desenhados no estilo do minimapa: a silhueta chapada de todo
 * objeto (`pixi/drawPropSilhouettes.ts`) e, por cima, poucos traços finos que
 * dizem o que o móvel é. Nada de imagem, sombra, hachura ou gradiente.
 *
 * Aqui mora só o que não depende de Pixi: o catálogo, o móvel que a ferramenta
 * Objetos põe no mapa e a geometria do glifo (testados sem tela).
 *
 * Cadeira, baú, armário de cozinha, aparador e fogueira têm também a VISTA de
 * lado (`TIPOS_COM_VISTA`): a silhueta vira o perfil do móvel (a cadeira em L,
 * o baú com a tampa em arco, a frente do armário e a do aparador, as pedras da
 * fogueira) numa pegada própria. De frente é o desenho de sempre.
 *
 * A fogueira é o único móvel com parte ANIMADA: a chama, numa camada à parte
 * (`pixi/chamasDasFogueiras.ts`), que nasce de `chamaDaFogueira`.
 *
 * A cama guarda o id antigo `catre`: mapas salvos com o catre abrem com a cama.
 * Ela tem TRÊS cores: a "Cor" pinta a madeira, e "Cor do travesseiro" e "Cor
 * do cobertor" (`Prop.mobiliaCorDoTravesseiro`/`mobiliaCorDoCobertor`) pintam
 * os tecidos (`regioesDaCama`); sem elas, a cama sai como sempre.
 *
 * A cerca é um TRECHO: o clique põe 2 casas; o mestre estica, gira e move com
 * os controles de sempre do objeto, e o glifo reparte os mourões redondos,
 * ligados por um fio, pelo comprimento que ela tiver (`tracosDaCerca`). É o
 * único móvel vazado (`ehMovelVazado`): sem caixa chapada atrás. E o único que
 * CURVA: um arco só, até meia volta, pela alça do meio do fio
 * (`Prop.mobiliaCurva`, em graus; a alça e o arrasto em `lib/cercaCurva.ts`).
 *
 * O TAPETE fica no CHÃO: por baixo de todo objeto, no editor e na tela do
 * jogador (`emOrdemDeDesenho`), e o clique pega primeiro o que está em cima
 * dele. Tem "Forma" (retangular ou redondo, `Prop.mobiliaForma`) e vista de
 * lado (a faixa deitada no chão); a "Cor" pinta o campo e a borda e o
 * medalhão saem a mesma cor mais escura (`desenhoDoTapete`).
 */

/** Ordem em que a setinha da ferramenta Objetos oferece os móveis: a lista mora em `lib/mobilia/tipos.ts`. */
export { TIPOS_MOBILIA }

/** Nome que a setinha mostra em cada opção. */
export const ROTULO_MOBILIA: Readonly<Record<TipoMobilia, string>> = {
  barril: 'Barril',
  caixa: 'Caixa',
  bau: 'Baú',
  catre: 'Cama',
  mesa: 'Mesa',
  cadeira: 'Cadeira',
  cerca: 'Cerca',
  // Nome inteiro, como o mestre chama: "Armário" sozinho não diz que é o da cozinha.
  armario: 'Armário de cozinha',
  aparador: 'Aparador',
  fogueira: 'Fogueira',
  tapete: 'Tapete',
  // As peças novas do lote 1 (MT4): o registro mora em `mobilia/pecasNovas.ts`.
  ...porPecaNova((ficha) => ficha.rotulo),
}

/** Artigo + nome, para a dica de cada opção ("Clique no mapa para pôr uma cama."). */
export const NOME_COM_ARTIGO: Readonly<Record<TipoMobilia, string>> = {
  barril: 'um barril',
  caixa: 'uma caixa',
  bau: 'um baú',
  catre: 'uma cama',
  mesa: 'uma mesa',
  cadeira: 'uma cadeira',
  cerca: 'uma cerca',
  armario: 'um armário de cozinha',
  aparador: 'um aparador',
  fogueira: 'uma fogueira',
  tapete: 'um tapete',
  ...porPecaNova((ficha) => ficha.artigo),
}

/** Espessura padrão da cerca, em casas: é a régua dos mourões (`tracosDaCerca`). */
const ESPESSURA_DA_CERCA_EM_CASAS = 0.25

/**
 * Tamanho padrão em CASAS da grade (largura x altura, sem giro). A cama é em
 * pé (uma pessoa deitada ocupa duas casas), a mesa deitada, o baú mais baixo
 * que uma casa; barril, caixa e cadeira cabem numa casa com folga; a cerca é
 * um trecho de 2 casas, fino como um mourão visto de cima; armário de cozinha
 * e aparador são rasos (meia casa de fundo, encostados na parede), o aparador
 * com o dobro da frente. O mestre
 * ajusta depois pelos controles de sempre do objeto. É o tamanho de FRENTE; o
 * de lado está em `TAMANHO_DE_LADO_EM_CASAS`. O tapete tem tamanho por forma
 * (`TAMANHO_DO_TAPETE_EM_CASAS`).
 */
const TAMANHO_EM_CASAS: Readonly<Record<Exclude<TipoMobilia, 'tapete'>, { largura: number; altura: number }>> = {
  barril: { largura: 0.7, altura: 0.7 },
  caixa: { largura: 0.8, altura: 0.8 },
  bau: { largura: 1, altura: 0.6 },
  catre: { largura: 1, altura: 2 },
  mesa: { largura: 2, altura: 1 },
  cadeira: { largura: 0.5, altura: 0.5 },
  cerca: { largura: 2, altura: ESPESSURA_DA_CERCA_EM_CASAS },
  armario: { largura: 1, altura: 0.5 },
  aparador: { largura: 2, altura: 0.5 },
  fogueira: { largura: 1, altura: 1 },
  ...porPecaNova((ficha) => ficha.tamanho),
}

export function ehTipoMobilia(valor: unknown): valor is TipoMobilia {
  return TIPOS_MOBILIA.some((tipo) => tipo === valor)
}

/** Móvel que tem vista de lado. */
export type TipoComVista = Extract<TipoMobilia, 'cadeira' | 'bau' | 'armario' | 'aparador' | 'fogueira' | 'tapete' | 'barraca' | 'carroca'>

/**
 * Tipos com "Vista" (Frente | Lado). Lista, não `if` espalhado: outro móvel
 * entra acrescentando o tipo aqui, o tamanho de lado dele
 * (`TAMANHO_DE_LADO_EM_CASAS`) e o desenho de lado (`contornoDeLado` e
 * `tracosDeLado`) — o compilador cobra os três. O tapete de lado é a faixa
 * deitada no chão, com o tamanho por forma (`TAMANHO_DO_TAPETE_EM_CASAS`).
 */
export const TIPOS_COM_VISTA: readonly TipoComVista[] = ['cadeira', 'bau', 'armario', 'aparador', 'fogueira', 'tapete', ...PECAS_NOVAS_COM_VISTA]

/** O tipo tem vista de lado. Tipo ausente (objeto comum) não tem. */
export function aceitaVista(tipo: TipoMobilia | undefined): tipo is TipoComVista {
  return TIPOS_COM_VISTA.some((comVista) => comVista === tipo)
}

/** Ordem em que o painel oferece as vistas. */
export const VISTAS_MOBILIA: readonly VistaMobilia[] = ['frente', 'lado']

/** Nome de cada vista no painel. */
export const ROTULO_VISTA: Readonly<Record<VistaMobilia, string>> = {
  frente: 'Frente',
  lado: 'Lado',
}

/**
 * Pegada de LADO em casas (largura x altura, sem giro). O baú de lado é mais
 * estreito que de frente (a profundidade da caixa é menor que o comprimento),
 * com a mesma altura; a cadeira de lado é mais alta que larga, porque o encosto
 * sobe acima do assento. Armário de cozinha e aparador de lado mostram a FRENTE
 * do móvel em pé: a mesma largura de cima e a altura do móvel (o armário, com o
 * de cima, vai a uma casa e meia).
 */
const TAMANHO_DE_LADO_EM_CASAS: Readonly<Record<Exclude<TipoComVista, 'tapete'>, { largura: number; altura: number }>> = {
  bau: { largura: 0.6, altura: 0.6 },
  cadeira: { largura: 0.5, altura: 0.75 },
  armario: { largura: 1, altura: 1.5 },
  aparador: { largura: 2, altura: 0.9 },
  // Mais alta que larga: a chama e as fagulhas cabem dentro do objeto.
  fogueira: { largura: 1, altura: 1.25 },
  ...TAMANHO_DE_LADO_DAS_PECAS_NOVAS,
}

/**
 * Tamanho padrão do TAPETE em casas (largura x altura, sem giro). O retangular
 * cabe uma mesa de 2 x 1 com as cadeiras em volta; o redondo é o círculo de 2
 * (esticado, vira oval). De lado é a faixa deitada no chão: a mesma largura e
 * 1/4 de casa de altura (a da cerca), para o clique ainda pegar.
 */
const TAMANHO_DO_TAPETE_EM_CASAS: Readonly<Record<FormaDoTapete, Readonly<Record<VistaMobilia, { largura: number; altura: number }>>>> = {
  retangular: { frente: { largura: 3, altura: 2 }, lado: { largura: 3, altura: 0.25 } },
  redondo: { frente: { largura: 2, altura: 2 }, lado: { largura: 2, altura: 0.25 } },
}

/**
 * Tamanho padrão do tipo na vista, em px de mundo. Vista de lado num tipo sem
 * vista vale como frente. `forma` só vale no tapete.
 */
function tamanhoPadrao(tipo: TipoMobilia, vista: VistaMobilia, grade: number, forma: FormaDoTapete = 'retangular'): { width: number; height: number } {
  const tamanho =
    tipo === 'tapete'
      ? TAMANHO_DO_TAPETE_EM_CASAS[forma][vista]
      : vista === 'lado' && aceitaVista(tipo)
        ? TAMANHO_DE_LADO_EM_CASAS[tipo]
        : TAMANHO_EM_CASAS[tipo]
  return { width: tamanho.largura * grade, height: tamanho.altura * grade }
}

/** Ordem em que o painel oferece as formas do tapete. */
export const FORMAS_DO_TAPETE: readonly FormaDoTapete[] = ['retangular', 'redondo']

/** Nome de cada forma no painel. */
export const ROTULO_FORMA: Readonly<Record<FormaDoTapete, string>> = {
  retangular: 'Retangular',
  redondo: 'Redondo',
}

/**
 * A forma do tapete na forma única que o mapa guarda: só `'redondo'`, e só no
 * tapete; qualquer outra coisa (`'retangular'`, que é o padrão, texto torto,
 * outro tipo) vira `undefined`. É a mesma porta na leitura do arquivo, na
 * edição, na travessia para o jogador e no desenho.
 */
export function normalizarFormaDoTapete(tipo: TipoMobilia | undefined, valor: unknown): 'redondo' | undefined {
  return tipo === 'tapete' && valor === 'redondo' ? 'redondo' : undefined
}

/** A forma que vale para o objeto: `'redondo'` só no tapete redondo; o resto é `'retangular'`. */
export function formaDoTapete(prop: Pick<Prop, 'mobilia' | 'mobiliaForma'>): FormaDoTapete {
  return normalizarFormaDoTapete(prop.mobilia, prop.mobiliaForma) ?? 'retangular'
}

/** Ordem em que o painel oferece as formas dos pratos (a mesa posta). */
export const FORMAS_DOS_PRATOS: readonly FormaDosPratos[] = ['cheio', 'vazio', 'pilha']

/** Nome de cada forma dos pratos no painel. */
export const ROTULO_FORMA_DOS_PRATOS: Readonly<Record<FormaDosPratos, string>> = {
  cheio: 'Prato cheio',
  vazio: 'Prato vazio',
  pilha: 'Pilha',
}

/**
 * A forma dos PRATOS na forma única que o mapa guarda: só `'vazio'` e
 * `'pilha'`, e só nos pratos; o resto (o prato cheio, que é o padrão, texto
 * torto, outro tipo) vira `undefined`. A mesma porta da forma do tapete.
 */
export function normalizarFormaDosPratos(tipo: TipoMobilia | undefined, valor: unknown): 'vazio' | 'pilha' | undefined {
  return tipo === 'pratos' && (valor === 'vazio' || valor === 'pilha') ? valor : undefined
}

/** A forma que vale para os pratos: a gravada ou o prato cheio. */
export function formaDosPratos(prop: Pick<Prop, 'mobilia' | 'mobiliaForma'>): FormaDosPratos {
  return normalizarFormaDosPratos(prop.mobilia, prop.mobiliaForma) ?? 'cheio'
}

/** A forma dos pratos como o desenho com textura a lê (a `variante`, como a da lápide): 0 cheio, 1 vazio, 2 pilha. */
export function varianteDosPratos(prop: Pick<Prop, 'mobilia' | 'mobiliaForma'>): number {
  return FORMAS_DOS_PRATOS.indexOf(formaDosPratos(prop))
}

/**
 * O FOGO da lareira e da fornalha (29/10/2026) na forma única que o mapa
 * guarda: só `'apagado'`, e só nesses dois; o resto (o aceso, que é o padrão,
 * texto torto, outro tipo) vira `undefined`. A mesma porta da forma dos pratos.
 */
export function normalizarFogoDoMovel(tipo: TipoMobilia | undefined, valor: unknown): 'apagado' | undefined {
  return ehMovelComFogoDeCasa(tipo) && valor === 'apagado' ? valor : undefined
}

/** O fogo que vale para a lareira e a fornalha: o gravado ou o aceso. */
export function fogoDoMovel(prop: Pick<Prop, 'mobilia' | 'mobiliaForma'>): FogoDoMovel {
  return normalizarFogoDoMovel(prop.mobilia, prop.mobiliaForma) ?? 'aceso'
}

/** O fogo como o desenho com textura o lê (a `variante`, como a dos pratos): 0 aceso, 1 apagado. */
export function varianteDoFogo(prop: Pick<Prop, 'mobilia' | 'mobiliaForma'>): number {
  return FOGOS_DO_MOVEL.indexOf(fogoDoMovel(prop))
}

/**
 * A forma gravada que o tipo aceita: a do tapete, a dos pratos, o fogo apagado
 * ou a segunda forma dos troncos e do feno (a lenha empilhada, o monte) — a
 * mesma porta da leitura, da edição e da travessia.
 */
function normalizarFormaDoMovel(tipo: TipoMobilia | undefined, valor: unknown): Prop['mobiliaForma'] {
  return normalizarFormaDoTapete(tipo, valor) ?? normalizarFormaDosPratos(tipo, valor) ?? normalizarFogoDoMovel(tipo, valor) ?? normalizarFormaDaPilha(tipo, valor)
}

/** `prop` com a forma na forma que o mapa guarda: o campo só existe no tapete redondo e nos pratos vazio ou em pilha. Mesma referência se nada muda. */
function comFormaGravada(prop: Prop, forma: Prop['mobiliaForma']): Prop {
  if (prop.mobiliaForma === forma) return prop
  const { mobiliaForma: _forma, ...semForma } = prop
  return forma === undefined ? semForma : { ...semForma, mobiliaForma: forma }
}

/**
 * Ordem de desenho: o tapete fica no CHÃO, por baixo de todo objeto (os
 * tapetes na ordem da lista, depois o resto na ordem de sempre). Sem tapete,
 * devolve a mesma lista.
 */
export function emOrdemDeDesenho<T extends Pick<Prop, 'mobilia'>>(props: readonly T[]): readonly T[] {
  if (!props.some((p) => ehMovelDoChao(p.mobilia) || ehMovelDeCimaDaMesa(p.mobilia))) return props
  // A mesa posta (os Pratos) vai por último: por cima da mesa ou do balcão, posta antes ou depois deles.
  const noMeio = props.filter((p) => !ehMovelDoChao(p.mobilia) && !ehMovelDeCimaDaMesa(p.mobilia))
  return [...props.filter((p) => ehMovelDoChao(p.mobilia)), ...noMeio, ...props.filter((p) => ehMovelDeCimaDaMesa(p.mobilia))]
}

/**
 * A vista na forma única que o mapa guarda: só `'lado'`, e só num tipo com
 * vista; qualquer outra coisa (`'frente'`, que é o padrão, texto torto, tipo
 * sem vista) vira `undefined`. É a mesma porta na leitura do arquivo, na
 * edição, na travessia para o jogador e no desenho.
 */
export function normalizarVistaDoMovel(tipo: TipoMobilia | undefined, valor: unknown): 'lado' | undefined {
  return valor === 'lado' && aceitaVista(tipo) ? 'lado' : undefined
}

/** A vista que vale para o objeto: `'lado'` só num tipo com vista; o resto é `'frente'`. */
export function vistaDoMovel(prop: Pick<Prop, 'mobilia' | 'mobiliaVista'>): VistaMobilia {
  return normalizarVistaDoMovel(prop.mobilia, prop.mobiliaVista) ?? 'frente'
}

/**
 * O DESENHO do móvel (`Prop.mobiliaDesenho`, Meio-Termo) na forma única que o
 * mapa guarda: só `'linhas'`, e só num tipo do catálogo; o resto vira
 * `undefined` (o desenho do estilo da casa). Mesma porta na leitura do arquivo
 * e na travessia para o jogador.
 */
export function normalizarDesenhoDoMovel(tipo: unknown, valor: unknown): 'linhas' | undefined {
  return valor === 'linhas' && ehTipoMobilia(tipo) ? 'linhas' : undefined
}

/** `prop` com o desenho na forma que o mapa guarda. Mesma referência se nada muda. */
function comDesenhoGravado(prop: Prop, desenho: 'linhas' | undefined): Prop {
  if (prop.mobiliaDesenho === desenho) return prop
  const { mobiliaDesenho: _desenho, ...semDesenho } = prop
  return desenho === undefined ? semDesenho : { ...semDesenho, mobiliaDesenho: desenho }
}

/**
 * A VISTA DOS MÓVEIS da cena (`MapData.vistaDosMoveis`, Meio-Termo) na forma
 * única que o mapa guarda: só `'tres-quartos'`; o resto (o padrão "de cima",
 * texto torto, arquivo editado à mão) vira `undefined`.
 */
export function lerVistaDosMoveis(valor: unknown): MapData['vistaDosMoveis'] {
  return valor === 'tres-quartos' ? 'tres-quartos' : undefined
}

/**
 * A vista dos móveis como o jogador a recebe: só quando o recorte dele leva
 * algum móvel (é o único desenho que a lê). Sem móvel à vista, ou com a camada
 * dos objetos escondida, o campo nem sai.
 */
export function vistaDosMoveisParaJogador(valor: unknown, propsDoRecorte: readonly Pick<Prop, 'mobilia'>[]): MapData['vistaDosMoveis'] {
  const vista = lerVistaDosMoveis(valor)
  return vista !== undefined && propsDoRecorte.some((p) => ehTipoMobilia(p.mobilia)) ? vista : undefined
}

/**
 * Móvel de silhueta redonda (a elipse dentro do retângulo), visto de cima: o
 * barril e a fogueira. De lado a fogueira é o perfil das pedras
 * (`contornoDeLado`), não a elipse.
 */
export function ehMovelRedondo(tipo: TipoMobilia | undefined, vista: VistaMobilia = 'frente'): boolean {
  // Peças novas redondas (a mesa redonda, o vaso e o poço) não têm vista de lado.
  if (ehPecaNova(tipo)) return FICHAS_DAS_PECAS_NOVAS[tipo].redonda
  return tipo === 'barril' || (tipo === 'fogueira' && vista === 'frente')
}

/**
 * Móvel VAZADO: sem a caixa chapada da silhueta atrás, só o glifo. É a cerca —
 * mourões e fio, com o chão aparecendo entre eles (`pixi/drawPropSilhouettes.ts`).
 */
export function ehMovelVazado(tipo: TipoMobilia | undefined): boolean {
  // A sebe (MT5) também: o provisório dela é só a faixa (`tracosDoGlifo`), sem a caixa reta atrás da curva.
  return tipo === 'cerca' || tipo === 'sebe'
}

/**
 * Tipos com a geometria da cerca e a VOLTA (`Prop.mobiliaCurva`): a cerca e a
 * sebe (MT5). A alça de curvar, o arrasto, a leitura do arquivo, a travessia
 * para o jogador e o desenho leem esta lista.
 */
export function aceitaCurva(tipo: TipoMobilia | undefined): boolean {
  return tipo === 'cerca' || tipo === 'sebe'
}

/**
 * Móveis que moram no CHÃO, por baixo de todo objeto: o tapete e o tapete
 * longo (MT5). A ordem de desenho, o contêiner do chão do editor e o clique
 * (que pega o tapete por último) leem esta lista.
 */
export function ehMovelDoChao(tipo: TipoMobilia | undefined): boolean {
  return tipo === 'tapete' || tipo === 'tapeteLongo'
}

/**
 * Móveis que moram EM CIMA da mesa, por cima de todo objeto: os Pratos (a mesa
 * posta, 28/10/2026). O avesso do tapete: a ordem de desenho (de cima e 3/4),
 * o contêiner da mesa posta do editor e o clique (que pega os pratos primeiro)
 * leem esta lista.
 */
export function ehMovelDeCimaDaMesa(tipo: TipoMobilia | undefined): boolean {
  return tipo === 'pratos'
}

/** Lados do polígono que imita a elipse: redondo a olho no zoom máximo, poucos pontos. */
export const LADOS_DA_ELIPSE = 32

/**
 * Pontos da elipse inscrita no retângulo `largura` x `altura`, centro na
 * origem, sem giro, a partir do ponto mais à direita no sentido horário da tela.
 */
export function pontosDaElipse(largura: number, altura: number, lados = LADOS_DA_ELIPSE): { x: number; y: number }[] {
  const pontos: { x: number; y: number }[] = []
  for (let i = 0; i < lados; i += 1) {
    const angulo = (2 * Math.PI * i) / lados
    pontos.push({ x: (largura / 2) * Math.cos(angulo), y: (altura / 2) * Math.sin(angulo) })
  }
  return pontos
}

/** O móvel pronto para `addProp`: objeto sem imagem, com o tipo, centrado em `centro`. */
export function criarMovel(tipo: TipoMobilia, centro: { x: number; y: number }, grade: number, id: string): Prop {
  return {
    id,
    src: '',
    x: centro.x,
    y: centro.y,
    ...tamanhoPadrao(tipo, 'frente', grade),
    linkedMapPath: null,
    mobilia: tipo,
  }
}

/** Um traço reto do glifo, em px de mundo, com o CENTRO do móvel na origem e sem giro. */
export interface TracoDoGlifo {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Os quatro lados de um retângulo alinhado aos eixos. */
function retangulo(esquerda: number, topo: number, direita: number, base: number): TracoDoGlifo[] {
  return [
    { x1: esquerda, y1: topo, x2: direita, y2: topo },
    { x1: direita, y1: topo, x2: direita, y2: base },
    { x1: direita, y1: base, x2: esquerda, y2: base },
    { x1: esquerda, y1: base, x2: esquerda, y2: topo },
  ]
}

/** Recuo do travesseiro do catre, em fração do lado menor. */
const RECUO_TRAVESSEIRO = 0.12
/** Altura do travesseiro, em fração da altura do catre. */
const ALTURA_TRAVESSEIRO = 0.18
/** Onde a coberta dobra, em fração da altura a partir da cabeceira. */
const DOBRA_DA_COBERTA = 0.42
/** O cobertor com cor própria deixa a madeira à vista nos lados e no pé, nesta fração do lado menor. */
const BEIRA_DA_MOLDURA = 0.07
/** Recuo do tampo da mesa, em fração do lado menor. */
const RECUO_TAMPO = 0.18
/** Onde a tampa do baú fecha, em fração da altura a partir de cima. */
const LINHA_DA_TAMPA = 0.35
/** Comprimento do fecho do baú, em fração da altura. */
const FECHO_DO_BAU = 0.25
/** Tamanho da borda da tampa do barril, em fração do barril. */
const TAMPA_DO_BARRIL = 0.6
/** Lados da borda da tampa: menor que a silhueta, pede menos pontos. */
const LADOS_DA_TAMPA = 24
/** Onde o encosto da cadeira termina, em fração da altura a partir de cima. */
const FIM_DO_ENCOSTO = 0.28
/** Cadeira de lado: grossura do encosto, em fração da largura. */
const ESPESSURA_DO_ENCOSTO = 0.2
/** Cadeira de lado: onde o assento começa, em fração da altura a partir de cima. */
const TOPO_DO_ASSENTO = 0.5
/** Cadeira de lado: grossura do assento, em fração da altura. */
const ESPESSURA_DO_ASSENTO = 0.14
/** Baú de lado: altura da tampa em arco, em fração da altura a partir de cima. */
const ALTURA_DA_TAMPA_DE_LADO = 0.4
/** Baú de lado: lados do meio arco da tampa — redondo a olho, poucos pontos. */
const LADOS_DO_ARCO = 16

/**
 * Armário de cozinha visto de cima: o DEGRAU (a frente do armário de cima, mais
 * raso que a base, como num guarda-louça) e os dois puxadores da porta de
 * baixo, riscos curtos que sobem da frente sem tocar o degrau. Alturas em
 * fração a partir de cima (a parede); `x` em fração da largura.
 */
const ARMARIO_DE_CIMA = { degrau: 0.45, pontaDoPuxador: 0.82, xDoPuxador: 0.25 }
/**
 * Armário de cozinha de lado — a frente em pé: em cima a portinha do armário de
 * cima, o nicho aberto (prateleira sem porta), a bancada, duas gavetas com um
 * puxador cada e o rodapé. Alturas em fração a partir de cima; `x` em fração da
 * largura (meia portinha, lateral do nicho, meio puxador).
 */
const ARMARIO_DE_LADO = {
  topoDaPortinha: 0.06,
  baseDaPortinha: 0.25,
  xDaPortinha: 0.34,
  fimDoArmarioDeCima: 0.3,
  xDoNicho: 0.42,
  bancada: 0.56,
  puxadorDeCima: 0.655,
  divisaoDasGavetas: 0.75,
  puxadorDeBaixo: 0.845,
  xDoPuxador: 0.08,
  rodape: 0.94,
}
/**
 * Aparador visto de cima: a borda do tampo sobre as portas, baixa (perto da
 * frente), e o encontro das duas portas descendo dela até a frente — um T
 * invertido, como o fecho do baú projetado na frente.
 */
const APARADOR_DE_CIMA = { frente: 0.72 }
/**
 * Aparador de lado — a frente em pé: o tampo sobra dos dois lados do corpo, as
 * duas portas se encontram no meio (um puxador de cada lado do encontro) e o
 * rodapé fecha embaixo. Alturas em fração a partir de cima; `x` em fração da
 * largura.
 */
const APARADOR_DE_LADO = { baseDoTampo: 0.14, sobraDoTampo: 0.035, rodape: 0.88, topoDoPuxador: 0.38, baseDoPuxador: 0.6, xDoPuxador: 0.045 }

/**
 * Fogueira vista de cima, dentro da silhueta redonda: a borda de dentro da roda
 * de pedras (elipse menor, em fração do objeto), as juntas entre as pedras
 * (raios dela até a silhueta, a meio caminho entre os eixos) e a lenha em X
 * (comprimento e grossura em fração do lado menor, ângulo em graus de cada tora).
 */
const FOGUEIRA_DE_CIMA = { roda: 0.7, juntas: 8, comprimentoDaLenha: 0.56, grossuraDaLenha: 0.08, anguloDaLenha: 35 }
/** Lados da borda de dentro da roda: a mesma régua da tampa do barril. */
const LADOS_DA_RODA = LADOS_DA_TAMPA
/**
 * Fogueira de lado: 4 pedras em domo, um pouco desiguais (`picos`, o alto de
 * cada uma em fração da altura a partir de cima), sobre a faixa do `vale`; a
 * lenha em X (pontas em `x` = ±`xDaLenha`·largura, de `deBaixo` a `deCima` na
 * altura, grossura em fração da largura). O resto do retângulo fica sem fundo,
 * como a cadeira em L: a chama sobe sobre o chão.
 */
const FOGUEIRA_DE_LADO = {
  vale: 0.95,
  picos: [0.81, 0.79, 0.82, 0.8],
  ladosDaPedra: 8,
  xDaLenha: 0.26,
  lenhaDeBaixo: 0.79,
  lenhaDeCima: 0.56,
  grossuraDaLenha: 0.07,
}
/**
 * A chama da fogueira (`chamaDaFogueira`): de cima, a base fica a `baseDeCima`
 * do lado menor abaixo do centro e a altura em repouso é `alturaDeCima` do lado
 * menor; de lado, a base fica na altura `baseDeLado` (a partir de cima), onde a
 * lenha cruza, e a altura é `alturaDeLado` da altura do objeto.
 */
const CHAMA_DA_FOGUEIRA = { baseDeCima: 0.18, alturaDeCima: 0.4, baseDeLado: 0.68, alturaDeLado: 0.464 }

/** Cerca: raio do mourão em fração da espessura — 0,45 de 1/4 de casa dá ~0,22 casa de diâmetro. */
const RAIO_DO_MOURAO = 0.45
/** Lados do polígono do mourão: círculo pequeno, redondo a olho com poucos pontos. */
const LADOS_DO_MOURAO = 12

/** Pedaço do arco do fio da cerca curva, em radianos: com meia volta numa cerca de 10 casas o fio sai a menos de 0,2 px do arco. */
const ANGULO_DO_PEDACO_DO_FIO = Math.PI / 64
/** Pedaço do arco do contorno da cerca curva (clique, borracha, seleção): mais grosso que o do fio, ninguém o vê. */
const ANGULO_DO_PEDACO_DO_CONTORNO = Math.PI / 32

/** Maior volta da cerca curva, em graus: meia volta, o mesmo limite da escada. */
export const CERCA_VOLTA_MAXIMA = STAIR_CURVE_MAX_TURN_DEGREES

/**
 * A volta da cerca na forma única que o mapa guarda: número finito, limitado a
 * meia volta, e só na cerca; zero (a reta) e qualquer outra coisa viram
 * `undefined`. É a mesma porta na leitura do arquivo, na edição, na travessia
 * para o jogador e no desenho.
 */
export function normalizarCurvaDaCerca(tipo: TipoMobilia | undefined, valor: unknown): number | undefined {
  if (!aceitaCurva(tipo) || typeof valor !== 'number' || !Number.isFinite(valor) || valor === 0) return undefined
  return Math.max(-CERCA_VOLTA_MAXIMA, Math.min(CERCA_VOLTA_MAXIMA, valor))
}

/** A volta que vale para o objeto, em graus: 0 fora da cerca, sem curva ou com valor torto. */
export function voltaDaCerca(prop: Pick<Prop, 'mobilia' | 'mobiliaCurva'>): number {
  return normalizarCurvaDaCerca(prop.mobilia, prop.mobiliaCurva) ?? 0
}

/** `prop` com a volta na forma que o mapa guarda: o campo só existe na cerca curva. Mesma referência se nada muda. */
export function comCurvaGravada(prop: Prop, volta: number | undefined): Prop {
  if (prop.mobiliaCurva === volta) return prop
  const { mobiliaCurva: _curva, ...semCurva } = prop
  return volta === undefined ? semCurva : { ...semCurva, mobiliaCurva: volta }
}

/** Mourões da cerca (centros, no referencial do objeto), o raio de todos eles e o arco da cerca curva. */
export interface GeometriaDaCerca {
  mouroes: { x: number; y: number }[]
  raio: number
  /** O arco que passa pelos centros dos mourões; `null` na cerca reta. */
  arco: StairArc | null
}

/** O eixo do trecho, no referencial do objeto: a corda de mourão a mourão das pontas. */
interface EixoDaCerca {
  deitada: boolean
  espessura: number
  raio: number
  /** Centro do mourão da primeira ponta, ao longo do comprimento. */
  primeiro: number
  /** Comprimento da corda, do centro do primeiro mourão ao do último. */
  vao: number
  umaCasa: number
}

function eixoDaCerca(largura: number, altura: number): EixoDaCerca | null {
  if (!tamanhoDesenhavel(largura, altura)) return null
  const deitada = largura >= altura
  const comprimento = deitada ? largura : altura
  const espessura = deitada ? altura : largura
  const raio = espessura * RAIO_DO_MOURAO
  return {
    deitada,
    espessura,
    raio,
    primeiro: -comprimento / 2 + raio,
    vao: comprimento - 2 * raio,
    umaCasa: espessura / ESPESSURA_DA_CERCA_EM_CASAS,
  }
}

/**
 * A corda da cerca (de mourão a mourão das pontas, no referencial do objeto) e
 * a normal dela: o lado para onde a volta positiva arqueia — para baixo na
 * deitada, para a esquerda na em pé (a normal da corda da escada, `stairChord`).
 * É o que a alça de curvar lê (`lib/cercaCurva.ts`). Tamanho não desenhável não
 * tem corda.
 */
export function cordaDaCerca(largura: number, altura: number): { comprimento: number; normal: { x: number; y: number } } | null {
  const eixo = eixoDaCerca(largura, altura)
  if (eixo === null) return null
  return { comprimento: eixo.vao, normal: eixo.deitada ? { x: 0, y: 1 } : { x: -1, y: 0 } }
}

/**
 * O arco da cerca de volta `volta` (graus): passa pelos centros dos mourões das
 * pontas, com a flecha da escada (`curvaForTurnDegrees`, até meia volta).
 * `null` na reta — volta zero, inválida ou de flecha pequena demais para se ver
 * (`CURVE_EPSILON_PX`, a régua da escada).
 */
function arcoDaCerca(eixo: EixoDaCerca, volta: number): StairArc | null {
  const flecha = curvaForTurnDegrees(volta, eixo.vao)
  if (Math.abs(flecha) < CURVE_EPSILON_PX) return null
  const { primeiro, vao } = eixo
  const corda = eixo.deitada ? { x1: primeiro, y1: 0, x2: primeiro + vao, y2: 0 } : { x1: 0, y1: primeiro, x2: 0, y2: primeiro + vao }
  return stairArcOf(corda, flecha)
}

/**
 * Cerca vista de cima: mourões redondos no eixo do trecho, um em cada ponta e
 * um a cada ~1 casa, ligados por um fio (`tracosDaCerca`). O comprimento é o
 * lado maior — esticada na altura, a cerca corre na vertical.
 *
 * A geometria não recebe a grade, então a régua é a própria ESPESSURA: no
 * padrão ela é 1/4 de casa, e 1 casa = espessura / ESPESSURA_DA_CERCA_EM_CASAS.
 * O mestre estica a cerca no comprimento e quase nunca na espessura, então o
 * espaçamento continua ~1 casa em qualquer tamanho; se engrossar a cerca,
 * mourões e vãos crescem junto, o que também lê bem. Os mourões das pontas
 * encostam na borda do trecho por dentro e os vãos são iguais; mínimo de 2
 * mourões. Tamanho não desenhável não tem geometria (`null`).
 *
 * CERCA CURVA (`volta` em graus, `Prop.mobiliaCurva`): os mourões das pontas
 * ficam onde estão na reta e os outros se repartem pelo ARCO, ~1 casa de arco
 * entre vizinhos — a cerca curva tem mais mourões que a corda pediria. Sem
 * volta, a conta é a da reta, número por número.
 */
export function geometriaDaCerca(largura: number, altura: number, volta = 0): GeometriaDaCerca | null {
  const eixo = eixoDaCerca(largura, altura)
  if (eixo === null) return null
  const { deitada, raio, primeiro, vao, umaCasa } = eixo
  const arco = arcoDaCerca(eixo, volta)
  if (arco !== null) return { mouroes: mouroesNoArco(arco, eixo), raio, arco }
  const vaos = Math.max(1, Math.round(vao / umaCasa))
  const mouroes: { x: number; y: number }[] = []
  for (let i = 0; i <= vaos; i += 1) {
    const u = primeiro + (vao * i) / vaos
    mouroes.push(deitada ? { x: u, y: 0 } : { x: 0, y: u })
  }
  return { mouroes, raio, arco: null }
}

/** Mourões da cerca curva: as pontas exatas (as da reta) e os do meio a passos iguais de arco. */
function mouroesNoArco(arco: StairArc, eixo: EixoDaCerca): { x: number; y: number }[] {
  const { deitada, primeiro, vao, umaCasa } = eixo
  const vaos = Math.max(1, Math.round((arco.radius * Math.abs(arco.sweep)) / umaCasa))
  const ponta = (u: number) => (deitada ? { x: u, y: 0 } : { x: 0, y: u })
  const mouroes = [ponta(primeiro)]
  for (let i = 1; i < vaos; i += 1) mouroes.push(stairArcPoint(arco, i / vaos))
  mouroes.push(ponta(primeiro + vao))
  return mouroes
}

/** Ponto do círculo do arco no ângulo `angulo` (radianos de tela), a `raio` do centro. */
function noAngulo(arco: StairArc, angulo: number, raio = arco.radius): { x: number; y: number } {
  return { x: arco.center.x + Math.cos(angulo) * raio, y: arco.center.y + Math.sin(angulo) * raio }
}

/**
 * O fio da cerca curva: entre cada par de mourões vizinhos, o arco de borda a
 * borda (recuado o ângulo cuja corda é o raio do mourão), em pedaços de no
 * máximo `ANGULO_DO_PEDACO_DO_FIO`.
 */
function fioNoArco(arco: StairArc, vaos: number, raio: number): TracoDoGlifo[] {
  const sentido = Math.sign(arco.sweep)
  const recuo = 2 * Math.asin(Math.min(1, raio / (2 * arco.radius)))
  const passo = arco.sweep / vaos
  const fio: TracoDoGlifo[] = []
  for (let i = 0; i < vaos; i += 1) {
    const de = arco.startAngle + passo * i + sentido * recuo
    const ate = arco.startAngle + passo * (i + 1) - sentido * recuo
    if ((ate - de) * sentido <= 0) continue
    const pedacos = Math.max(1, Math.ceil(Math.abs(ate - de) / ANGULO_DO_PEDACO_DO_FIO))
    let anterior = noAngulo(arco, de)
    for (let k = 1; k <= pedacos; k += 1) {
      const proximo = noAngulo(arco, de + ((ate - de) * k) / pedacos)
      fio.push({ x1: anterior.x, y1: anterior.y, x2: proximo.x, y2: proximo.y })
      anterior = proximo
    }
  }
  return fio
}

/**
 * Onde a cerca está, como polígono fechado no referencial do objeto: na reta, o
 * retângulo do objeto (o de sempre); na curva, a mesma faixa DOBRADA no arco —
 * da espessura do objeto, indo um raio de mourão além de cada mourão da ponta,
 * como o retângulo vai. É o que o clique, a borracha, a seleção por área e o
 * destaque de seleção usam na cerca curva (`lib/cercaCurva.ts`). Tamanho não
 * desenhável não tem contorno (lista vazia).
 */
export function contornoDaCerca(largura: number, altura: number, volta: number): { x: number; y: number }[] {
  const eixo = eixoDaCerca(largura, altura)
  if (eixo === null) return []
  const arco = arcoDaCerca(eixo, volta)
  if (arco === null) {
    return [
      { x: -largura / 2, y: -altura / 2 },
      { x: largura / 2, y: -altura / 2 },
      { x: largura / 2, y: altura / 2 },
      { x: -largura / 2, y: altura / 2 },
    ]
  }
  const alem = Math.sign(arco.sweep) * (eixo.raio / arco.radius)
  const inicio = arco.startAngle - alem
  const giro = arco.sweep + 2 * alem
  const pedacos = Math.max(2, Math.ceil(Math.abs(giro) / ANGULO_DO_PEDACO_DO_CONTORNO))
  const fora = arco.radius + eixo.espessura / 2
  const dentro = Math.max(0, arco.radius - eixo.espessura / 2)
  const angulos = Array.from({ length: pedacos + 1 }, (_, k) => inicio + (giro * k) / pedacos)
  return [...angulos.map((a) => noAngulo(arco, a, fora)), ...[...angulos].reverse().map((a) => noAngulo(arco, a, dentro))]
}

/**
 * Glifo da cerca: o contorno de cada mourão e UM fio no eixo, em pedaços de
 * borda a borda entre mourões vizinhos (o fio não risca por dentro do
 * círculo). Sem ripas nem caixa atrás (`ehMovelVazado`): o chão aparece entre
 * os mourões. Na cerca curva o fio segue o arco em pedaços curtos (`fioNoArco`).
 */
function tracosDaCerca(largura: number, altura: number, volta: number): TracoDoGlifo[] {
  const geometria = geometriaDaCerca(largura, altura, volta)
  if (geometria === null) return []
  const { mouroes, raio, arco } = geometria
  const deitada = largura >= altura
  const circulo = pontosDaElipse(2 * raio, 2 * raio, LADOS_DO_MOURAO)
  const circulos = mouroes.flatMap((m) => contorno(circulo.map((p) => ({ x: m.x + p.x, y: m.y + p.y }))))
  if (arco !== null) return [...circulos, ...fioNoArco(arco, mouroes.length - 1, raio)]
  const fio: TracoDoGlifo[] = []
  for (let i = 1; i < mouroes.length; i += 1) {
    const de = mouroes[i - 1]
    const ate = mouroes[i]
    fio.push(
      deitada
        ? { x1: de.x + raio, y1: 0, x2: ate.x - raio, y2: 0 }
        : { x1: 0, y1: de.y + raio, x2: 0, y2: ate.y - raio },
    )
  }
  return [...circulos, ...fio]
}

/** Polígono fechado como traços, um por lado. */
function contorno(pontos: readonly { x: number; y: number }[]): TracoDoGlifo[] {
  return pontos.map((p, i) => {
    const proximo = pontos[(i + 1) % pontos.length]
    return { x1: p.x, y1: p.y, x2: proximo.x, y2: proximo.y }
  })
}

type Ponto = { x: number; y: number }

/**
 * Tora de `de` a `ate`, com `grossura`: o retângulo em volta do segmento, em 4
 * traços. Segmento de tamanho zero não tem tora.
 */
function tora(de: Ponto, ate: Ponto, grossura: number): TracoDoGlifo[] {
  const comprimento = Math.hypot(ate.x - de.x, ate.y - de.y)
  if (comprimento === 0) return []
  const nx = (-(ate.y - de.y) / comprimento) * (grossura / 2)
  const ny = ((ate.x - de.x) / comprimento) * (grossura / 2)
  return contorno([
    { x: de.x + nx, y: de.y + ny },
    { x: ate.x + nx, y: ate.y + ny },
    { x: ate.x - nx, y: ate.y - ny },
    { x: de.x - nx, y: de.y - ny },
  ])
}

/** Tora centrada na origem, inclinada `graus` (positivo = horário na tela). */
function toraCentrada(comprimento: number, grossura: number, graus: number): TracoDoGlifo[] {
  const angulo = (graus * Math.PI) / 180
  const meia = { x: (Math.cos(angulo) * comprimento) / 2, y: (Math.sin(angulo) * comprimento) / 2 }
  return tora({ x: -meia.x, y: -meia.y }, meia, grossura)
}

/** Fogueira de cima: a borda de dentro da roda, as juntas entre as pedras e a lenha em X. */
function tracosDaFogueira(largura: number, altura: number): TracoDoGlifo[] {
  const { roda, juntas, comprimentoDaLenha, grossuraDaLenha, anguloDaLenha } = FOGUEIRA_DE_CIMA
  const menorLado = Math.min(largura, altura)
  const raios: TracoDoGlifo[] = []
  for (let k = 0; k < juntas; k += 1) {
    // A meio caminho entre os eixos: nenhuma junta cai em cima da lenha nem do eixo da tela.
    const angulo = ((k + 0.5) * 2 * Math.PI) / juntas
    const cos = Math.cos(angulo)
    const sin = Math.sin(angulo)
    raios.push({ x1: (roda / 2) * largura * cos, y1: (roda / 2) * altura * sin, x2: (largura / 2) * cos, y2: (altura / 2) * sin })
  }
  return [
    ...contorno(pontosDaElipse(largura * roda, altura * roda, LADOS_DA_RODA)),
    ...raios,
    ...toraCentrada(menorLado * comprimentoDaLenha, menorLado * grossuraDaLenha, anguloDaLenha),
    ...toraCentrada(menorLado * comprimentoDaLenha, menorLado * grossuraDaLenha, -anguloDaLenha),
  ]
}

/**
 * Fogueira de lado: só as pedras, do chão (`altura/2`) ao `vale` e em domos
 * meia elipse (um por quarto da largura, cada um com o pico dele).
 */
function contornoDaFogueiraDeLado(largura: number, altura: number): Ponto[] {
  const { vale: fracaoDoVale, picos, ladosDaPedra } = FOGUEIRA_DE_LADO
  const meiaLargura = largura / 2
  const vale = naAltura(altura, fracaoDoVale)
  const raio = largura / (2 * picos.length)
  const pontos: Ponto[] = [
    { x: -meiaLargura, y: altura / 2 },
    { x: -meiaLargura, y: vale },
  ]
  picos.forEach((pico, i) => {
    const centro = -meiaLargura + (2 * i + 1) * raio
    const subida = vale - naAltura(altura, pico)
    for (let j = 1; j <= ladosDaPedra; j += 1) {
      const angulo = Math.PI + (Math.PI * j) / ladosDaPedra
      pontos.push({ x: centro + raio * Math.cos(angulo), y: vale + subida * Math.sin(angulo) })
    }
  })
  pontos.push({ x: meiaLargura, y: altura / 2 })
  return pontos
}

/** Fogueira de lado: a lenha em X, cruzando logo abaixo da base da chama. */
function tracosDaFogueiraDeLado(largura: number, altura: number): TracoDoGlifo[] {
  const { xDaLenha, lenhaDeBaixo, lenhaDeCima, grossuraDaLenha } = FOGUEIRA_DE_LADO
  const x = largura * xDaLenha
  const baixo = naAltura(altura, lenhaDeBaixo)
  const cima = naAltura(altura, lenhaDeCima)
  return [...tora({ x: -x, y: baixo }, { x, y: cima }, largura * grossuraDaLenha), ...tora({ x, y: baixo }, { x: -x, y: cima }, largura * grossuraDaLenha)]
}

/**
 * Onde a chama da fogueira nasce e o tamanho dela em repouso, no referencial do
 * objeto (centro na origem, sem giro):
 * - `ancora`: o ponto que GIRA com o objeto — de cima, o centro da roda (onde a
 *   lenha cruza); de lado, a base da chama sobre o X da lenha;
 * - `desvio`: quanto a base fica ABAIXO da âncora na TELA, sem girar — de cima,
 *   a chama em pé se apoia um pouco abaixo do centro, para o corpo dela cair no
 *   meio da roda em qualquer giro;
 * - `altura`: a altura da chama em repouso (`H`).
 * A chama fica sempre em pé na tela (ajuste do usuário na aprovação): o giro do
 * objeto move a âncora, nunca vira a chama. Tamanho não desenhável não tem chama.
 */
export function chamaDaFogueira(largura: number, altura: number, vista: VistaMobilia = 'frente'): { ancora: Ponto; desvio: number; altura: number } | null {
  if (!tamanhoDesenhavel(largura, altura)) return null
  if (vista === 'lado') {
    return { ancora: { x: 0, y: naAltura(altura, CHAMA_DA_FOGUEIRA.baseDeLado) }, desvio: 0, altura: altura * CHAMA_DA_FOGUEIRA.alturaDeLado }
  }
  const menorLado = Math.min(largura, altura)
  return { ancora: { x: 0, y: 0 }, desvio: menorLado * CHAMA_DA_FOGUEIRA.baseDeCima, altura: menorLado * CHAMA_DA_FOGUEIRA.alturaDeCima }
}

/** Uma língua a mais da chama (a lareira tem três), em relação à principal. */
export interface LinguaExtraDaChama {
  /** A base, no referencial do objeto (gira com ele), em px de mundo a partir da base da principal. */
  readonly dx: number
  readonly dy: number
  /** A altura em repouso (`H`), em px de mundo. */
  readonly altura: number
  /** Atraso de fase ([0, 1)): as línguas da mesma lareira não pulsam juntas. */
  readonly fase: number
}

/** A chama de um móvel: a principal (a de `chamaDaFogueira`) e as línguas a mais. */
export interface ChamaDoMovel {
  readonly ancora: Ponto
  readonly desvio: number
  readonly altura: number
  readonly extras: readonly LinguaExtraDaChama[]
}

/** Móvel que pode ter chama animada: a fogueira e, com o fogo aceso, a lareira e a fornalha. */
export function temChama(tipo: TipoMobilia | undefined): boolean {
  return tipo === 'fogueira' || ehMovelComFogoDeCasa(tipo)
}

/**
 * A chama de qualquer móvel que tem uma (`null` = não tem, ou está apagada):
 * a fogueira, sempre acesa, e a lareira e a fornalha com o fogo aceso
 * (`lib/mobilia/fogoDeCasa.ts`, a mesma disposição da imagem parada). A
 * língua principal é a última da lista (a da frente, a mais alta na lareira);
 * a âncora dela gira com o objeto e a chama fica em pé na tela, como na fogueira.
 */
export function chamaDoMovel(prop: Pick<Prop, 'mobilia' | 'mobiliaForma' | 'mobiliaVista' | 'width' | 'height'>): ChamaDoMovel | null {
  if (prop.mobilia === 'fogueira') {
    const forma = chamaDaFogueira(prop.width, prop.height, vistaDoMovel(prop))
    return forma === null ? null : { ...forma, extras: [] }
  }
  if (!ehMovelComFogoDeCasa(prop.mobilia) || fogoDoMovel(prop) === 'apagado' || !tamanhoDesenhavel(prop.width, prop.height)) return null
  const linguas = linguasDoFogoDeCasa(prop.mobilia)
  const menorLado = Math.min(prop.width, prop.height)
  const principal = linguas[linguas.length - 1]
  const ancora = { x: principal.x * prop.width, y: principal.y * prop.height }
  const extras = linguas.slice(0, -1).map((lingua) => ({
    dx: lingua.x * prop.width - ancora.x,
    dy: lingua.y * prop.height - ancora.y,
    altura: lingua.altura * menorLado,
    fase: lingua.fase,
  }))
  return { ancora, desvio: 0, altura: principal.altura * menorLado, extras }
}

/** Tamanho finito e positivo: o resto (zero, negativo, NaN de arquivo estragado) não tem o que desenhar. */
function tamanhoDesenhavel(largura: number, altura: number): boolean {
  return Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0
}

/**
 * Tapete visto de cima, em fração do LADO MENOR (`S`): franja nas duas pontas
 * curtas, faixa da borda, medalhão em losango (as pontas dele em fração do
 * campo de dentro da borda) e o miolo do losango. `fios` é quantos fios a
 * franja tem em cada ponta: número fixo, como as juntas da fogueira, para a
 * franja não virar borrão de longe nem ficar rala de perto.
 */
const TAPETE_DE_CIMA = { franja: 0.06, fios: 12, borda: 0.12, medalhaoAoLongo: 0.42, medalhaoAtravessado: 0.62, miolo: 0.45 }
/** Tapete redondo: borda em fração do lado menor; o losango em fração do raio de dentro. Sem franja: em volta toda, viraria roda dentada (a leitura da fogueira). */
const TAPETE_REDONDO = { borda: 0.12, medalhao: 0.6 }
/**
 * Tapete de lado (deitado no chão): a faixa ocupa de `topo` (fração da altura,
 * de cima) até o chão; franja e borda em fração da LARGURA (3 casas dão a mesma
 * franja de 0,12 casa da vista de cima). Os dois fios de cada ponta caem até o chão.
 */
const TAPETE_DE_LADO = { topo: 0.6, franja: 0.04, borda: 0.08, fioDeCima: 0.7, fioDeBaixo: 0.86, pontaDoFioDeBaixo: 0.75 }

/** Eixo do tapete retangular: o comprimento corre em x quando ele é mais largo que alto. */
interface EixoDoTapete {
  /** Meio comprimento do corpo (sem a franja) e meia largura. */
  corpoU: number
  corpoV: number
  franja: number
  borda: number
  /** Ponto no referencial do objeto a partir de (ao longo, atravessado). */
  p: (u: number, v: number) => Ponto
}

function eixoDoTapete(largura: number, altura: number): EixoDoTapete {
  const deitado = largura >= altura
  const comprimento = deitado ? largura : altura
  const lado = deitado ? altura : largura
  const franja = lado * TAPETE_DE_CIMA.franja
  return {
    corpoU: comprimento / 2 - franja,
    corpoV: lado / 2,
    franja,
    borda: lado * TAPETE_DE_CIMA.borda,
    p: (u, v) => (deitado ? { x: u, y: v } : { x: v, y: u }),
  }
}

/** O eixo do tapete redondo: x ao longo, y atravessado, sem franja (só para o losango). */
const EIXO_SEM_GIRO: Pick<EixoDoTapete, 'p'> = { p: (u, v) => ({ x: u, y: v }) }

function retanguloUV(e: Pick<EixoDoTapete, 'p'>, u: number, v: number): Ponto[] {
  return [e.p(-u, -v), e.p(u, -v), e.p(u, v), e.p(-u, v)]
}

function losangoUV(e: Pick<EixoDoTapete, 'p'>, u: number, v: number): Ponto[] {
  return [e.p(u, 0), e.p(0, v), e.p(-u, 0), e.p(0, -v)]
}

/** Losango do medalhão e o miolo, nos meios-eixos (ao longo, atravessado) do campo de dentro. */
function medalhaoDoTapete(e: Pick<EixoDoTapete, 'p'>, campoU: number, campoV: number, aoLongo: number, atravessado: number): { fora: Ponto[]; miolo: Ponto[] } {
  const u = campoU * aoLongo
  const v = campoV * atravessado
  return { fora: losangoUV(e, u, v), miolo: losangoUV(e, u * TAPETE_DE_CIMA.miolo, v * TAPETE_DE_CIMA.miolo) }
}

/**
 * Silhueta do tapete (o que leva o fundo e o fio de fora): de cima, o corpo
 * sem a franja (a franja é vazada, o chão aparece entre os fios, como na cerca)
 * ou a elipse do redondo; de lado, a faixa deitada. `null` = tamanho não desenhável.
 */
export function contornoDoTapete(forma: FormaDoTapete, largura: number, altura: number, vista: VistaMobilia): Ponto[] | null {
  if (!tamanhoDesenhavel(largura, altura)) return null
  if (vista === 'lado') {
    const corpo = largura / 2 - (forma === 'retangular' ? largura * TAPETE_DE_LADO.franja : 0)
    const topo = naAltura(altura, TAPETE_DE_LADO.topo)
    return [
      { x: -corpo, y: topo },
      { x: corpo, y: topo },
      { x: corpo, y: altura / 2 },
      { x: -corpo, y: altura / 2 },
    ]
  }
  if (forma === 'redondo') return pontosDaElipse(largura, altura)
  const e = eixoDoTapete(largura, altura)
  return retanguloUV(e, e.corpoU, e.corpoV)
}

/**
 * Uma área do desenho que leva cor própria: no tapete, a borda e o medalhão
 * (`'escuro'`, a "Cor" mais escura); na cama, o travesseiro e o cobertor. Um
 * anel vem num polígono só, com o buraco dentro (`anel`).
 */
export interface RegiaoDoMovel {
  pontos: Ponto[]
  tom: 'escuro' | 'travesseiro' | 'cobertor'
}

/**
 * Áreas de tecido da cama, sobre os MESMOS traços de hoje (o retângulo do
 * travesseiro e a dobra): o travesseiro é o retângulo dele; o cobertor vai da
 * dobra ao pé, recuado `BEIRA_DA_MOLDURA` nos lados e no pé (a madeira fica à
 * vista). Só entra a área que tem cor própria — sem elas a cama sai pixel a
 * pixel como hoje. Tamanho não desenhável não tem área.
 */
export function regioesDaCama(largura: number, altura: number, comTravesseiro: boolean, comCobertor: boolean): RegiaoDoMovel[] {
  if (!tamanhoDesenhavel(largura, altura)) return []
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  const menorLado = Math.min(largura, altura)
  const recuo = menorLado * RECUO_TRAVESSEIRO
  const topoDoTravesseiro = -meiaAltura + recuo
  const dobra = -meiaAltura + altura * DOBRA_DA_COBERTA
  const beira = menorLado * BEIRA_DA_MOLDURA
  const regioes: RegiaoDoMovel[] = []
  if (comCobertor) {
    regioes.push({ pontos: retanguloXY(-meiaLargura + beira, dobra, meiaLargura - beira, meiaAltura - beira), tom: 'cobertor' })
  }
  if (comTravesseiro) {
    regioes.push({
      pontos: retanguloXY(-meiaLargura + recuo, topoDoTravesseiro, meiaLargura - recuo, topoDoTravesseiro + altura * ALTURA_TRAVESSEIRO),
      tom: 'travesseiro',
    })
  }
  return regioes
}

/** Os quatro cantos de um retângulo alinhado aos eixos, no sentido horário a partir do de cima à esquerda. */
function retanguloXY(esquerda: number, topo: number, direita: number, base: number): Ponto[] {
  return [
    { x: esquerda, y: topo },
    { x: direita, y: topo },
    { x: direita, y: base },
    { x: esquerda, y: base },
  ]
}

/**
 * Anel num polígono só: a volta de fora num sentido e a de dentro no outro,
 * ligadas por uma ponte. O Pixi (earcut) fura o meio sem `cut()`.
 */
function anel(fora: readonly Ponto[], dentro: readonly Ponto[]): Ponto[] {
  return [...fora, fora[0], dentro[0], ...[...dentro].reverse().slice(0, -1), dentro[0]]
}

/**
 * O tapete visto de cima ou de lado: as áreas em tom escuro (o anel da borda e
 * o losango do medalhão; de lado, as duas tiras da borda vista de quina) e os
 * traços do glifo (a beira de dentro da borda, o losango, o miolo e a franja —
 * 12 fios em cada ponta curta do retangular; o redondo não tem franja).
 * Tamanho não desenhável, ou pequeno demais para caber a borda, não tem desenho.
 */
export function desenhoDoTapete(forma: FormaDoTapete, largura: number, altura: number, vista: VistaMobilia): { regioes: RegiaoDoMovel[]; tracos: TracoDoGlifo[] } {
  if (!tamanhoDesenhavel(largura, altura)) return { regioes: [], tracos: [] }
  if (vista === 'lado') return tapeteDeLado(forma, largura, altura)
  return forma === 'redondo' ? tapeteRedondo(largura, altura) : tapeteRetangular(largura, altura)
}

function tapeteRedondo(largura: number, altura: number): { regioes: RegiaoDoMovel[]; tracos: TracoDoGlifo[] } {
  const borda = Math.min(largura, altura) * TAPETE_REDONDO.borda
  const campoU = largura / 2 - borda
  const campoV = altura / 2 - borda
  if (campoU <= 0 || campoV <= 0) return { regioes: [], tracos: [] }
  const dentro = pontosDaElipse(campoU * 2, campoV * 2)
  const { fora, miolo } = medalhaoDoTapete(EIXO_SEM_GIRO, campoU, campoV, TAPETE_REDONDO.medalhao, TAPETE_REDONDO.medalhao)
  return {
    regioes: [
      { pontos: anel(pontosDaElipse(largura, altura), dentro), tom: 'escuro' },
      { pontos: fora, tom: 'escuro' },
    ],
    tracos: [...contorno(dentro), ...contorno(fora), ...contorno(miolo)],
  }
}

function tapeteRetangular(largura: number, altura: number): { regioes: RegiaoDoMovel[]; tracos: TracoDoGlifo[] } {
  const e = eixoDoTapete(largura, altura)
  const campoU = e.corpoU - e.borda
  const campoV = e.corpoV - e.borda
  if (campoU <= 0 || campoV <= 0) return { regioes: [], tracos: [] }
  const campo = retanguloUV(e, campoU, campoV)
  const { fora, miolo } = medalhaoDoTapete(e, campoU, campoV, TAPETE_DE_CIMA.medalhaoAoLongo, TAPETE_DE_CIMA.medalhaoAtravessado)
  const franja: TracoDoGlifo[] = []
  const passo = (2 * e.corpoV) / TAPETE_DE_CIMA.fios
  for (let i = 0; i < TAPETE_DE_CIMA.fios; i += 1) {
    const v = -e.corpoV + (i + 0.5) * passo
    for (const ponta of [-1, 1]) {
      const a = e.p(ponta * e.corpoU, v)
      const b = e.p(ponta * (e.corpoU + e.franja), v)
      franja.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
  }
  return {
    regioes: [
      { pontos: anel(retanguloUV(e, e.corpoU, e.corpoV), campo), tom: 'escuro' },
      { pontos: fora, tom: 'escuro' },
    ],
    tracos: [...contorno(campo), ...contorno(fora), ...contorno(miolo), ...franja],
  }
}

/** De lado: a faixa no chão, a borda vista de quina nas duas pontas e, no retangular, os fios caindo até o chão. */
function tapeteDeLado(forma: FormaDoTapete, largura: number, altura: number): { regioes: RegiaoDoMovel[]; tracos: TracoDoGlifo[] } {
  const franja = forma === 'retangular' ? largura * TAPETE_DE_LADO.franja : 0
  const corpo = largura / 2 - franja
  const dentro = corpo - largura * TAPETE_DE_LADO.borda
  if (dentro <= 0) return { regioes: [], tracos: [] }
  const topo = naAltura(altura, TAPETE_DE_LADO.topo)
  const chao = altura / 2
  const regioes: RegiaoDoMovel[] = []
  const tracos: TracoDoGlifo[] = []
  for (const ponta of [-1, 1]) {
    regioes.push({
      pontos: [
        { x: ponta * corpo, y: topo },
        { x: ponta * dentro, y: topo },
        { x: ponta * dentro, y: chao },
        { x: ponta * corpo, y: chao },
      ],
      tom: 'escuro',
    })
    tracos.push({ x1: ponta * dentro, y1: topo, x2: ponta * dentro, y2: chao })
    if (franja > 0) {
      tracos.push({ x1: ponta * corpo, y1: naAltura(altura, TAPETE_DE_LADO.fioDeCima), x2: ponta * (largura / 2), y2: chao })
      tracos.push({ x1: ponta * corpo, y1: naAltura(altura, TAPETE_DE_LADO.fioDeBaixo), x2: ponta * (corpo + franja * TAPETE_DE_LADO.pontaDoFioDeBaixo), y2: chao })
    }
  }
  return { regioes, tracos }
}

/** Cadeira de lado: a linha de baixo do assento, de onde as pernas descem. */
function baseDoAssento(altura: number): number {
  return -altura / 2 + altura * TOPO_DO_ASSENTO + altura * ESPESSURA_DO_ASSENTO
}

/** Baú de lado: a costura entre a tampa em arco e o corpo. */
function costuraDoBau(altura: number): number {
  return -altura / 2 + altura * ALTURA_DA_TAMPA_DE_LADO
}

/** A linha na fração `fracao` da altura, contada de cima (a parede), com o centro na origem. */
function naAltura(altura: number, fracao: number): number {
  return (fracao - 0.5) * altura
}

/** Linha de lado a lado na fração `fracao` da altura. */
function deLadoALado(largura: number, altura: number, fracao: number): TracoDoGlifo {
  const y = naAltura(altura, fracao)
  return { x1: -largura / 2, y1: y, x2: largura / 2, y2: y }
}

/** Aparador de lado: o meio do corpo (o tampo sobra dos lados) e onde o tampo acaba. */
function corpoDoAparador(largura: number, altura: number): { meioCorpo: number; baseDoTampo: number } {
  return {
    meioCorpo: largura / 2 - largura * APARADOR_DE_LADO.sobraDoTampo,
    baseDoTampo: naAltura(altura, APARADOR_DE_LADO.baseDoTampo),
  }
}

/**
 * A silhueta de LADO (centro na origem, sem giro, sentido horário da tela), que
 * toma o lugar do retângulo:
 * - cadeira: o perfil em L — o encosto sobe na ponta esquerda até o topo e o
 *   assento atravessa a largura; as pernas ficam no glifo (`tracosDoGlifo`),
 *   descendo do assento até o chão;
 * - baú: o corpo embaixo e a tampa em meio arco em cima, do canto de uma parede
 *   ao da outra, com o alto no meio do topo;
 * - armário de cozinha: o retângulo (a frente é reta; o desenho está no glifo);
 * - aparador: o tampo em cima, mais largo que o corpo, que desce até o chão;
 * - fogueira: só as pedras, quatro domos sobre uma faixa baixa; o resto do
 *   retângulo fica sem fundo (a chama sobe sobre o chão);
 * - tapete: a faixa deitada no chão, embaixo do objeto (`contornoDoTapete`,
 *   na `forma` dele; o retangular recua a franja nas pontas).
 * Tipo sem vista ou tamanho não desenhável devolve `null` (vale o retângulo).
 */
export function contornoDeLado(
  tipo: TipoMobilia | undefined,
  largura: number,
  altura: number,
  forma: FormaDoTapete = 'retangular',
): { x: number; y: number }[] | null {
  if (!aceitaVista(tipo) || !tamanhoDesenhavel(largura, altura)) return null
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  switch (tipo) {
    case 'tapete':
      return contornoDoTapete(forma, largura, altura, 'lado')
    case 'fogueira':
      return contornoDaFogueiraDeLado(largura, altura)
    case 'armario':
      return [
        { x: -meiaLargura, y: -meiaAltura },
        { x: meiaLargura, y: -meiaAltura },
        { x: meiaLargura, y: meiaAltura },
        { x: -meiaLargura, y: meiaAltura },
      ]
    case 'aparador': {
      const { meioCorpo, baseDoTampo } = corpoDoAparador(largura, altura)
      return [
        { x: -meiaLargura, y: -meiaAltura },
        { x: meiaLargura, y: -meiaAltura },
        { x: meiaLargura, y: baseDoTampo },
        { x: meioCorpo, y: baseDoTampo },
        { x: meioCorpo, y: meiaAltura },
        { x: -meioCorpo, y: meiaAltura },
        { x: -meioCorpo, y: baseDoTampo },
        { x: -meiaLargura, y: baseDoTampo },
      ]
    }
    case 'cadeira': {
      const fimDoEncosto = -meiaLargura + largura * ESPESSURA_DO_ENCOSTO
      const topoDoAssento = -meiaAltura + altura * TOPO_DO_ASSENTO
      const base = baseDoAssento(altura)
      return [
        { x: -meiaLargura, y: -meiaAltura },
        { x: fimDoEncosto, y: -meiaAltura },
        { x: fimDoEncosto, y: topoDoAssento },
        { x: meiaLargura, y: topoDoAssento },
        { x: meiaLargura, y: base },
        { x: -meiaLargura, y: base },
      ]
    }
    case 'bau': {
      const costura = costuraDoBau(altura)
      // Meia elipse: da parede esquerda (na costura) sobe até o meio do topo e desce à parede direita.
      const raio = costura + meiaAltura
      const arco: { x: number; y: number }[] = []
      for (let k = 0; k <= LADOS_DO_ARCO; k += 1) {
        const angulo = Math.PI + (Math.PI * k) / LADOS_DO_ARCO
        arco.push({ x: meiaLargura * Math.cos(angulo), y: costura + raio * Math.sin(angulo) })
      }
      return [{ x: -meiaLargura, y: meiaAltura }, ...arco, { x: meiaLargura, y: meiaAltura }]
    }
    case 'barraca':
    case 'carroca':
      return contornoDaPecaNovaDeLado(largura, altura)
  }
}

/**
 * O glifo de LADO: as duas pernas da cadeira; a costura entre a tampa e o corpo
 * do baú; a frente do armário de cozinha (`ARMARIO_DE_LADO`) e a do aparador
 * (`APARADOR_DE_LADO`); a lenha em X da fogueira (`FOGUEIRA_DE_LADO`); a
 * borda de quina e os fios do tapete (`desenhoDoTapete`).
 */
function tracosDeLado(tipo: TipoComVista, largura: number, altura: number, forma: FormaDoTapete): TracoDoGlifo[] {
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  switch (tipo) {
    case 'barraca':
    case 'carroca':
      return tracosDaPecaNova(tipo, largura, altura, true)
    case 'tapete':
      return desenhoDoTapete(forma, largura, altura, 'lado').tracos
    case 'fogueira':
      return tracosDaFogueiraDeLado(largura, altura)
    case 'armario':
      return tracosDoArmarioDeLado(largura, altura)
    case 'aparador': {
      const { meioCorpo, baseDoTampo } = corpoDoAparador(largura, altura)
      const rodape = naAltura(altura, APARADOR_DE_LADO.rodape)
      const topoDoPuxador = naAltura(altura, APARADOR_DE_LADO.topoDoPuxador)
      const baseDoPuxador = naAltura(altura, APARADOR_DE_LADO.baseDoPuxador)
      const xDoPuxador = largura * APARADOR_DE_LADO.xDoPuxador
      return [
        { x1: 0, y1: baseDoTampo, x2: 0, y2: rodape },
        { x1: -meioCorpo, y1: rodape, x2: meioCorpo, y2: rodape },
        { x1: -xDoPuxador, y1: topoDoPuxador, x2: -xDoPuxador, y2: baseDoPuxador },
        { x1: xDoPuxador, y1: topoDoPuxador, x2: xDoPuxador, y2: baseDoPuxador },
      ]
    }
    case 'cadeira': {
      const base = baseDoAssento(altura)
      // Cada perna no meio da grossura do encosto, recuada da ponta do assento.
      const recuoDaPerna = (largura * ESPESSURA_DO_ENCOSTO) / 2
      return [
        { x1: -meiaLargura + recuoDaPerna, y1: base, x2: -meiaLargura + recuoDaPerna, y2: meiaAltura },
        { x1: meiaLargura - recuoDaPerna, y1: base, x2: meiaLargura - recuoDaPerna, y2: meiaAltura },
      ]
    }
    case 'bau': {
      const costura = costuraDoBau(altura)
      return [{ x1: -meiaLargura, y1: costura, x2: meiaLargura, y2: costura }]
    }
  }
}

/** Armário de cozinha de lado: 12 traços, de cima para baixo (`ARMARIO_DE_LADO`). */
function tracosDoArmarioDeLado(largura: number, altura: number): TracoDoGlifo[] {
  const a = ARMARIO_DE_LADO
  const xDaPortinha = largura * a.xDaPortinha
  const xDoNicho = largura * a.xDoNicho
  const xDoPuxador = largura * a.xDoPuxador
  const fimDoArmarioDeCima = naAltura(altura, a.fimDoArmarioDeCima)
  const bancada = naAltura(altura, a.bancada)
  const puxador = (fracao: number): TracoDoGlifo => {
    const y = naAltura(altura, fracao)
    return { x1: -xDoPuxador, y1: y, x2: xDoPuxador, y2: y }
  }
  return [
    ...retangulo(-xDaPortinha, naAltura(altura, a.topoDaPortinha), xDaPortinha, naAltura(altura, a.baseDaPortinha)),
    deLadoALado(largura, altura, a.fimDoArmarioDeCima),
    { x1: -xDoNicho, y1: fimDoArmarioDeCima, x2: -xDoNicho, y2: bancada },
    { x1: xDoNicho, y1: fimDoArmarioDeCima, x2: xDoNicho, y2: bancada },
    deLadoALado(largura, altura, a.bancada),
    deLadoALado(largura, altura, a.divisaoDasGavetas),
    puxador(a.puxadorDeCima),
    puxador(a.puxadorDeBaixo),
    deLadoALado(largura, altura, a.rodape),
  ]
}

/**
 * Os traços finos que dizem o que o móvel é, dentro do retângulo `largura` x
 * `altura` (centro na origem, "cima" = cabeceira/tampa/encosto antes do giro):
 * - barril: a borda da tampa, uma elipse menor no meio da silhueta redonda;
 * - caixa: o X das ripas, de canto a canto;
 * - baú: a linha da tampa e o fecho no meio dela;
 * - catre (a cama): travesseiro na cabeceira e a dobra da coberta;
 * - mesa: o tampo, um retângulo recuado;
 * - cadeira: o encosto, uma faixa em cima;
 * - cerca: mourões redondos a cada ~1 casa ligados por um fio
 *   (`tracosDaCerca`), que se repartem quando o mestre estica o trecho;
 *   com `voltaDaCerca` (graus, `Prop.mobiliaCurva`), pelo arco;
 * - armário de cozinha: o degrau no meio (a frente do armário de cima) e dois
 *   puxadores curtos subindo da frente;
 * - aparador: a borda do tampo, baixa, e o encontro das portas descendo dela;
 * - fogueira: a roda de pedras (a borda de dentro e as juntas) e a lenha em X;
 *   a chama é animada, numa camada à parte (`pixi/chamasDasFogueiras.ts`);
 * - tapete: a beira de dentro da borda, o losango do medalhão com o miolo e,
 *   no retangular (`forma`), a franja nas pontas curtas (`desenhoDoTapete`).
 * Na vista de lado (só nos tipos com vista), o glifo é o de lado
 * (`tracosDeLado`); nos outros tipos a vista não muda nada.
 * Tamanho não desenhável (zero, negativo, não finito) não tem traço, nem tipo
 * desconhecido (arquivo de uma versão futura que escapou da leitura): lista
 * vazia em vez de derrubar o desenho.
 */
export function tracosDoGlifo(
  tipo: TipoMobilia,
  largura: number,
  altura: number,
  vista: VistaMobilia = 'frente',
  voltaDaCerca = 0,
  forma: FormaDoTapete = 'retangular',
  /** Só nos troncos e no feno: a forma (0 a de partida, 1 a outra; `varianteDaPilha`). */
  variante = 0,
): TracoDoGlifo[] {
  if (!tamanhoDesenhavel(largura, altura)) return []
  if (vista === 'lado' && aceitaVista(tipo)) return tracosDeLado(tipo, largura, altura, forma)
  // A sebe (MT5) tem a geometria da cerca: o provisório é a faixa dela, reta ou dobrada no arco.
  if (tipo === 'sebe') return contorno(contornoDaCerca(largura, altura, voltaDaCerca))
  if (ehPecaNova(tipo)) return tracosDaPecaNova(tipo, largura, altura, false, variante)
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  const menorLado = Math.min(largura, altura)
  switch (tipo) {
    case 'barril':
      return contorno(pontosDaElipse(largura * TAMPA_DO_BARRIL, altura * TAMPA_DO_BARRIL, LADOS_DA_TAMPA))
    case 'caixa':
      return [
        { x1: -meiaLargura, y1: -meiaAltura, x2: meiaLargura, y2: meiaAltura },
        { x1: meiaLargura, y1: -meiaAltura, x2: -meiaLargura, y2: meiaAltura },
      ]
    case 'cadeira': {
      const encosto = -meiaAltura + altura * FIM_DO_ENCOSTO
      return [{ x1: -meiaLargura, y1: encosto, x2: meiaLargura, y2: encosto }]
    }
    case 'catre': {
      const recuo = menorLado * RECUO_TRAVESSEIRO
      const topoDoTravesseiro = -meiaAltura + recuo
      const dobra = -meiaAltura + altura * DOBRA_DA_COBERTA
      return [
        ...retangulo(-meiaLargura + recuo, topoDoTravesseiro, meiaLargura - recuo, topoDoTravesseiro + altura * ALTURA_TRAVESSEIRO),
        { x1: -meiaLargura, y1: dobra, x2: meiaLargura, y2: dobra },
      ]
    }
    case 'mesa': {
      const recuo = menorLado * RECUO_TAMPO
      return retangulo(-meiaLargura + recuo, -meiaAltura + recuo, meiaLargura - recuo, meiaAltura - recuo)
    }
    case 'bau': {
      const tampa = -meiaAltura + altura * LINHA_DA_TAMPA
      return [
        { x1: -meiaLargura, y1: tampa, x2: meiaLargura, y2: tampa },
        { x1: 0, y1: tampa, x2: 0, y2: tampa + altura * FECHO_DO_BAU },
      ]
    }
    case 'cerca':
      return tracosDaCerca(largura, altura, voltaDaCerca)
    case 'armario': {
      const degrau = deLadoALado(largura, altura, ARMARIO_DE_CIMA.degrau)
      const pontaDoPuxador = naAltura(altura, ARMARIO_DE_CIMA.pontaDoPuxador)
      const xDoPuxador = largura * ARMARIO_DE_CIMA.xDoPuxador
      return [
        degrau,
        { x1: -xDoPuxador, y1: meiaAltura, x2: -xDoPuxador, y2: pontaDoPuxador },
        { x1: xDoPuxador, y1: meiaAltura, x2: xDoPuxador, y2: pontaDoPuxador },
      ]
    }
    case 'aparador': {
      const frente = deLadoALado(largura, altura, APARADOR_DE_CIMA.frente)
      return [frente, { x1: 0, y1: frente.y1, x2: 0, y2: meiaAltura }]
    }
    case 'fogueira':
      return tracosDaFogueira(largura, altura)
    case 'tapete':
      return desenhoDoTapete(forma, largura, altura, 'frente').tracos
    default:
      return []
  }
}

/** `prop` com a vista na forma que o mapa guarda: o campo só existe quando é `'lado'`. */
function comVistaGravada(prop: Prop, vista: 'lado' | undefined): Prop {
  const { mobiliaVista: _vista, ...semVista } = prop
  return vista === undefined ? semVista : { ...semVista, mobiliaVista: vista }
}

/**
 * O "Tipo" do painel: o mesmo móvel com outro tipo. Centro, giro, camada,
 * trava, ocultos, piso, rótulo e aparência ficam; o tamanho vai para o padrão
 * do tipo novo (o da mesa não serve para o barril). `x`/`y` são o centro, então
 * o tamanho novo não tira o móvel do lugar. A vista de lado fica só se o tipo
 * novo também tem vista (com o tamanho de lado dele); num tipo sem vista, some.
 * Na PEÇA NOVA (MT4) o "Preencher" desligado não vai junto: ela sai sempre com
 * textura e o painel dela não tem como religá-lo.
 */
export function movelComOutroTipo(prop: Prop, tipo: TipoMobilia, grade: number): Prop {
  const vista = normalizarVistaDoMovel(tipo, prop.mobiliaVista)
  // A forma é só do tapete e dos pratos, como a curva é só da cerca: outro tipo não tem o que guardar.
  const forma = normalizarFormaDoTapete(tipo, prop.mobiliaForma)
  const trocado = comFormaGravada(
    { ...comVistaGravada(prop, vista), mobilia: tipo, ...tamanhoPadrao(tipo, vista ?? 'frente', grade, forma ?? 'retangular') },
    normalizarFormaDoMovel(tipo, prop.mobiliaForma),
  )
  // As cores de tecido são só da cama: outro tipo não tem travesseiro nem cobertor.
  const curvado = semTecidoForaDaCama(comCurvaGravada(trocado, normalizarCurvaDaCerca(tipo, prop.mobiliaCurva)))
  // A versão em linhas só existe nos 11 de antes (MT12): a peça nova sai sempre com textura.
  const movel = ofereceDesenhoEmLinhas(tipo) ? curvado : comDesenhoGravado(curvado, undefined)
  if (!ehPecaNova(tipo) || !('mobiliaPreenchido' in movel)) return movel
  const { mobiliaPreenchido: _preenchido, ...semPreenchido } = movel
  return semPreenchido
}

/**
 * A "Vista" do painel (Frente | Lado): o mesmo móvel na outra vista. O tamanho
 * vai para o padrão do tipo nessa vista (no tapete, o da forma dele); centro,
 * giro, camada, trava, ocultos, piso, rótulo e aparência ficam. Só `'lado'` é
 * gravado. Tipo sem vista devolve o mesmo objeto.
 */
export function movelComOutraVista(prop: Prop, vista: VistaMobilia, grade: number): Prop {
  const tipo = prop.mobilia
  if (!aceitaVista(tipo)) return prop
  return { ...comVistaGravada(prop, vista === 'lado' ? 'lado' : undefined), ...tamanhoPadrao(tipo, vista, grade, formaDoTapete(prop)) }
}

/**
 * A "Forma" do painel (Retangular | Redondo), só no tapete: o mesmo tapete na
 * outra forma, no tamanho padrão dela na vista atual (como trocar o tipo).
 * Centro, giro, vista, camada, trava, ocultos, piso, rótulo e aparência ficam.
 * Só `'redondo'` é gravado. Outro tipo devolve o mesmo objeto.
 */
/**
 * A "Forma" dos PRATOS (Prato cheio | Prato vazio | Pilha): os mesmos pratos
 * na outra forma, no MESMO tamanho (a mesa posta não muda de pegada). Só
 * `'vazio'` e `'pilha'` são gravados. Outro tipo devolve o mesmo objeto.
 */
export function pratosComOutraForma(prop: Prop, forma: FormaDosPratos): Prop {
  if (prop.mobilia !== 'pratos') return prop
  return comFormaGravada(prop, forma === 'cheio' ? undefined : forma)
}

/**
 * O "Fogo" da LAREIRA e da FORNALHA (Aceso | Apagado): o mesmo móvel com o
 * fogo no outro estado, no MESMO tamanho. Só `'apagado'` é gravado. Outro
 * tipo devolve o mesmo objeto.
 */
export function movelComOutroFogo(prop: Prop, fogo: FogoDoMovel): Prop {
  if (!ehMovelComFogoDeCasa(prop.mobilia)) return prop
  return comFormaGravada(prop, fogo === 'apagado' ? 'apagado' : undefined)
}

/**
 * A "Forma" dos TRONCOS (Pilha de toras | Lenha empilhada) e do FENO (Fardos
 * empilhados | Monte de feno): o mesmo objeto na outra forma, na PEGADA DELA
 * na grade do mapa (`CASAS_DA_FORMA_DA_PILHA`), como a forma do tapete.
 * Centro, giro, camada, trava, ocultos, piso, rótulo e material ficam. Só a
 * segunda forma é gravada. Outro tipo, ou forma do outro objeto, devolve o
 * mesmo objeto.
 */
export function movelComOutraFormaDaPilha(prop: Prop, forma: FormaDaPilha, grade: number): Prop {
  const tipo = prop.mobilia
  if (!ehMovelDePilha(tipo) || !formaDoMovelDePilha(tipo, forma)) return prop
  const casas = CASAS_DA_FORMA_DA_PILHA[forma]
  return { ...comFormaGravada(prop, normalizarFormaDaPilha(tipo, forma)), width: casas.largura * grade, height: casas.altura * grade }
}

/** A forma dos troncos ou do feno deste objeto (`undefined` em outro tipo). */
export function formaDaPilhaDoMovel(prop: Pick<Prop, 'mobilia' | 'mobiliaForma'>): FormaDaPilha | undefined {
  return ehMovelDePilha(prop.mobilia) ? formaDaPilha(prop.mobilia, prop.mobiliaForma) : undefined
}

export function movelComOutraForma(prop: Prop, forma: FormaDoTapete, grade: number): Prop {
  if (prop.mobilia !== 'tapete') return prop
  return { ...comFormaGravada(prop, forma === 'redondo' ? 'redondo' : undefined), ...tamanhoPadrao('tapete', vistaDoMovel(prop), grade, forma) }
}

/** Cor que o móvel aceita: `#rgb` ou `#rrggbb`, sem nada em volta. */
const COR_DO_MOVEL = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * A cor do móvel na forma única que o mapa guarda: `#rrggbb` minúsculo (`#rgb`
 * vira `#rrggbb`). Qualquer outra coisa — nome de cor, `url(...)`, número,
 * espaço em volta — vira `undefined`. É a mesma porta na leitura do arquivo, na
 * edição, na travessia para o jogador e no desenho: o valor acaba no Pixi e no
 * `<input type="color">`, então só passa o que é cor de fato.
 */
export function normalizarCorDoMovel(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const achado = COR_DO_MOVEL.exec(valor)
  if (achado === null) return undefined
  const digitos = achado[1].toLowerCase()
  return digitos.length === 3 ? `#${Array.from(digitos, (d) => d + d).join('')}` : `#${digitos}`
}

/**
 * Cor de TECIDO da cama (travesseiro e cobertor): só na cama, e só `#rrggbb`
 * normalizada (a mesma porta da "Cor"). Em outro tipo, ou cor torta, vira
 * `undefined`. É a porta da leitura do arquivo, da edição, da travessia para
 * o jogador e do desenho.
 */
export function normalizarCorDeTecido(tipo: TipoMobilia | undefined, valor: unknown): string | undefined {
  return tipo === 'catre' ? normalizarCorDoMovel(valor) : undefined
}

/**
 * Paleta de tecido, um clique para o travesseiro e o cobertor. Tons de pano
 * tingido, contidos: nenhum passa de ~45% de saturação (HSL), para não
 * estourar sobre o chão chapado do minimapa. O branco é quebrado (linho), não #fff.
 */
export const PALETA_DE_TECIDO: readonly { nome: string; cor: string }[] = [
  { nome: 'Branco', cor: '#e6e1d6' },
  { nome: 'Creme', cor: '#d6c49e' },
  { nome: 'Cinza', cor: '#8c8a84' },
  { nome: 'Vermelho', cor: '#9a3f36' },
  { nome: 'Azul', cor: '#46638a' },
  { nome: 'Verde', cor: '#55704a' },
  { nome: 'Roxo', cor: '#6c5280' },
  { nome: 'Castanho', cor: '#7a5838' },
]

/**
 * Pedido de aparência vindo do painel. Chave ausente = não mexe; `preenchido:
 * true` e cor `null` = volta ao padrão (o campo sai do objeto). As cores de
 * tecido só valem na cama: em outro tipo o pedido não muda nada.
 */
export interface AparenciaDoMovelPatch {
  preenchido?: boolean
  cor?: string | null
  corDaLinha?: string | null
  corDoTravesseiro?: string | null
  corDoCobertor?: string | null
  /**
   * O DESENHO com o Meio-Termo (MT12): `'linhas'` pede a versão de antes, `null`
   * volta à textura (o campo sai do objeto). Só os tipos com versão em linhas
   * (`ofereceDesenhoEmLinhas`) aceitam; nos outros o pedido não muda nada.
   */
  desenho?: 'linhas' | null
}

interface AparenciaDoMovel {
  preenchido: boolean
  cor: string | undefined
  corDaLinha: string | undefined
  corDoTravesseiro: string | undefined
  corDoCobertor: string | undefined
}

/** `prop` com a aparência na forma que o mapa guarda: cada campo só quando foge do padrão. */
function comAparenciaGravada(prop: Prop, aparencia: AparenciaDoMovel): Prop {
  const {
    mobiliaPreenchido: _preenchido,
    mobiliaCor: _cor,
    mobiliaCorDaLinha: _corDaLinha,
    mobiliaCorDoTravesseiro: _corDoTravesseiro,
    mobiliaCorDoCobertor: _corDoCobertor,
    ...semAparencia
  } = prop
  return {
    ...semAparencia,
    ...(aparencia.preenchido ? {} : { mobiliaPreenchido: false }),
    ...(aparencia.cor === undefined ? {} : { mobiliaCor: aparencia.cor }),
    ...(aparencia.corDaLinha === undefined ? {} : { mobiliaCorDaLinha: aparencia.corDaLinha }),
    ...(aparencia.corDoTravesseiro === undefined ? {} : { mobiliaCorDoTravesseiro: aparencia.corDoTravesseiro }),
    ...(aparencia.corDoCobertor === undefined ? {} : { mobiliaCorDoCobertor: aparencia.corDoCobertor }),
  }
}

/** A cor depois do pedido: sem pedido fica a de antes, `null` tira, cor torta é ignorada (fica a de antes). */
function corDepoisDoPedido(antes: string | undefined, pedido: string | null | undefined): string | undefined {
  if (pedido === undefined) return antes
  if (pedido === null) return undefined
  return normalizarCorDoMovel(pedido) ?? antes
}

/**
 * "Preencher", "Cor", "Cor da linha" e, na cama, "Cor do travesseiro" e "Cor
 * do cobertor" do painel aplicados ao móvel. Cor torta não apaga a cor que
 * havia: o pedido é ignorado, como o arquivo faria.
 */
export function comAparenciaDoMovel(prop: Prop, patch: AparenciaDoMovelPatch): Prop {
  const pintado = comAparenciaGravada(prop, {
    preenchido: patch.preenchido ?? prop.mobiliaPreenchido !== false,
    cor: corDepoisDoPedido(prop.mobiliaCor, patch.cor),
    corDaLinha: corDepoisDoPedido(prop.mobiliaCorDaLinha, patch.corDaLinha),
    corDoTravesseiro: normalizarCorDeTecido(prop.mobilia, corDepoisDoPedido(prop.mobiliaCorDoTravesseiro, patch.corDoTravesseiro)),
    corDoCobertor: normalizarCorDeTecido(prop.mobilia, corDepoisDoPedido(prop.mobiliaCorDoCobertor, patch.corDoCobertor)),
  })
  return comDesenhoGravado(pintado, desenhoDepoisDoPedido(prop, patch.desenho))
}

/** O desenho depois do pedido: sem pedido fica o de antes, `null` tira, `'linhas'` só no tipo que tem a versão em linhas. */
function desenhoDepoisDoPedido(prop: Prop, pedido: 'linhas' | null | undefined): 'linhas' | undefined {
  if (pedido === undefined) return prop.mobiliaDesenho
  if (pedido === null) return undefined
  return ofereceDesenhoEmLinhas(prop.mobilia) ? 'linhas' : prop.mobiliaDesenho
}

/** Os dois objetos têm a mesma aparência de móvel ("Preencher", as três cores da cama, "Cor da linha"). */
export function mesmaAparenciaDoMovel(a: Prop, b: Prop): boolean {
  return (
    a.mobiliaPreenchido === b.mobiliaPreenchido &&
    a.mobiliaCor === b.mobiliaCor &&
    a.mobiliaCorDaLinha === b.mobiliaCorDaLinha &&
    a.mobiliaCorDoTravesseiro === b.mobiliaCorDoTravesseiro &&
    a.mobiliaCorDoCobertor === b.mobiliaCorDoCobertor &&
    a.mobiliaDesenho === b.mobiliaDesenho
  )
}

/** `prop` sem as cores de tecido quando ele não é a cama: elas só valem nela. */
function semTecidoForaDaCama(prop: Prop): Prop {
  if (prop.mobilia === 'catre' || (!('mobiliaCorDoTravesseiro' in prop) && !('mobiliaCorDoCobertor' in prop))) return prop
  const { mobiliaCorDoTravesseiro: _corDoTravesseiro, mobiliaCorDoCobertor: _corDoCobertor, ...semTecido } = prop
  return semTecido
}

/**
 * Objeto comum: tira o tipo, a aparência e a vista de móvel, se houver (sem
 * tipo, a aparência não tem o que pintar nem a vista o que virar).
 */
function semNadaDeMovel(prop: Prop): Prop {
  if (
    !('mobilia' in prop) &&
    !('mobiliaPreenchido' in prop) &&
    !('mobiliaCor' in prop) &&
    !('mobiliaCorDaLinha' in prop) &&
    !('mobiliaVista' in prop) &&
    !('mobiliaCurva' in prop) &&
    !('mobiliaForma' in prop) &&
    !('mobiliaCorDoTravesseiro' in prop) &&
    !('mobiliaCorDoCobertor' in prop) &&
    !('mobiliaDesenho' in prop)
  ) {
    return prop
  }
  const {
    mobilia: _tipo,
    mobiliaPreenchido: _preenchido,
    mobiliaCor: _cor,
    mobiliaCorDaLinha: _corDaLinha,
    mobiliaVista: _vista,
    mobiliaCurva: _curva,
    mobiliaForma: _forma,
    mobiliaCorDoTravesseiro: _corDoTravesseiro,
    mobiliaCorDoCobertor: _corDoCobertor,
    mobiliaDesenho: _desenho,
    ...comum
  } = prop
  return comum
}

/**
 * Leitura do disco: tipo do catálogo fica; qualquer outro valor (arquivo
 * editado à mão, versão futura com móvel que esta não conhece) some, e o
 * objeto continua no mapa como objeto comum, sem a aparência nem a vista de
 * móvel. Com tipo válido, a aparência e a vista passam pela mesma porta da
 * edição: "Preencher" só guarda o desligado, cor só `#rrggbb` normalizada (a
 * torta some), vista só `'lado'` num tipo com vista (o resto some). Sem nada a
 * consertar, devolve o mesmo objeto.
 */
export function propMobiliaFromFile(prop: Prop): Prop {
  if (!ehTipoMobilia(prop.mobilia)) return semNadaDeMovel(prop)
  // DESENHO (Meio-Termo): só `'linhas'`; o resto some.
  const lido = comDesenhoGravado(comFormaGravada(
    comCurvaGravada(
      comVistaGravada(
        comAparenciaGravada(prop, {
          preenchido: prop.mobiliaPreenchido !== false,
          cor: normalizarCorDoMovel(prop.mobiliaCor),
          corDaLinha: normalizarCorDoMovel(prop.mobiliaCorDaLinha),
          // CAMA EM TRÊS CORES: só na cama, só `#rrggbb`; o resto some.
          corDoTravesseiro: normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoTravesseiro),
          corDoCobertor: normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoCobertor),
        }),
        normalizarVistaDoMovel(prop.mobilia, prop.mobiliaVista),
      ),
      // CERCA CURVA: só na cerca, número finito até meia volta; o resto some.
      normalizarCurvaDaCerca(prop.mobilia, prop.mobiliaCurva),
    ),
    // TAPETE: só `'redondo'`, e só no tapete; PRATOS: só `'vazio'` e `'pilha'`; o resto some.
    normalizarFormaDoMovel(prop.mobilia, prop.mobiliaForma),
  ), normalizarDesenhoDoMovel(prop.mobilia, prop.mobiliaDesenho))
  const mesmo =
    mesmaAparenciaDoMovel(lido, prop) &&
    lido.mobiliaVista === prop.mobiliaVista &&
    lido.mobiliaCurva === prop.mobiliaCurva &&
    lido.mobiliaForma === prop.mobiliaForma &&
    lido.mobiliaDesenho === prop.mobiliaDesenho
  return mesmo ? prop : lido
}

/**
 * O MÓVEL como o jogador o recebe: a PORTA ÚNICA da travessia (`lib/fogFilter.ts`).
 * Só os campos que o desenho dele pinta, cada um pela mesma porta da leitura
 * do arquivo (a travessia não confia no mapa do mestre: colar, acervo e a
 * cópia de recuperação não passam pela leitura). Só o que difere do padrão
 * vira campo, na ordem de sempre. Objeto sem tipo do catálogo: nada.
 */
export function mobiliaParaJogador(prop: Prop): Partial<Prop> {
  if (prop.mobilia === undefined) return {}
  const paraJogador: Partial<Prop> = { mobilia: prop.mobilia }
  // A APARÊNCIA ("Preencher", "Cor", "Cor da linha"): só `#rrggbb`.
  if (prop.mobiliaPreenchido === false) paraJogador.mobiliaPreenchido = false
  const cor = normalizarCorDoMovel(prop.mobiliaCor)
  if (cor !== undefined) paraJogador.mobiliaCor = cor
  const corDaLinha = normalizarCorDoMovel(prop.mobiliaCorDaLinha)
  if (corDaLinha !== undefined) paraJogador.mobiliaCorDaLinha = corDaLinha
  // A VISTA: só `'lado'` num tipo com vista; de frente (o padrão), nada.
  const vista = normalizarVistaDoMovel(prop.mobilia, prop.mobiliaVista)
  if (vista !== undefined) paraJogador.mobiliaVista = vista
  // A CURVA da cerca: só na cerca, número finito até meia volta; a reta não vira campo.
  const curva = normalizarCurvaDaCerca(prop.mobilia, prop.mobiliaCurva)
  if (curva !== undefined) paraJogador.mobiliaCurva = curva
  // A FORMA do tapete (só `'redondo'`) e a dos pratos (só `'vazio'` e `'pilha'`).
  const forma = normalizarFormaDoMovel(prop.mobilia, prop.mobiliaForma)
  if (forma !== undefined) paraJogador.mobiliaForma = forma
  // As cores de TECIDO da cama: só na cama e só `#rrggbb`.
  const corDoTravesseiro = normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoTravesseiro)
  if (corDoTravesseiro !== undefined) paraJogador.mobiliaCorDoTravesseiro = corDoTravesseiro
  const corDoCobertor = normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoCobertor)
  if (corDoCobertor !== undefined) paraJogador.mobiliaCorDoCobertor = corDoCobertor
  // O DESENHO (Meio-Termo): só `'linhas'` num tipo do catálogo.
  const desenho = normalizarDesenhoDoMovel(prop.mobilia, prop.mobiliaDesenho)
  if (desenho !== undefined) paraJogador.mobiliaDesenho = desenho
  return paraJogador
}
