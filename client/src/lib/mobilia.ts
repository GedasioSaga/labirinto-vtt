import type { Prop, TipoMobilia } from '../types/map'

/**
 * MOBÍLIA DESENHADA — barril, caixa, baú, cama, mesa e cadeira como objetos
 * sem imagem, desenhados no estilo do minimapa: a silhueta chapada de todo
 * objeto (`pixi/drawPropSilhouettes.ts`) e, por cima, poucos traços finos que
 * dizem o que o móvel é. Nada de imagem, sombra, hachura ou gradiente.
 *
 * Aqui mora só o que não depende de Pixi: o catálogo, o móvel que a ferramenta
 * Objetos põe no mapa e a geometria do glifo (testados sem tela).
 *
 * A cama guarda o id antigo `catre`: mapas salvos com o catre abrem com a cama.
 */

/** Ordem em que a setinha da ferramenta Objetos oferece os móveis. */
export const TIPOS_MOBILIA: readonly TipoMobilia[] = ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira']

/** Nome que a setinha mostra em cada opção. */
export const ROTULO_MOBILIA: Readonly<Record<TipoMobilia, string>> = {
  barril: 'Barril',
  caixa: 'Caixa',
  bau: 'Baú',
  catre: 'Cama',
  mesa: 'Mesa',
  cadeira: 'Cadeira',
}

/** Artigo + nome, para a dica de cada opção ("Clique no mapa para pôr uma cama."). */
export const NOME_COM_ARTIGO: Readonly<Record<TipoMobilia, string>> = {
  barril: 'um barril',
  caixa: 'uma caixa',
  bau: 'um baú',
  catre: 'uma cama',
  mesa: 'uma mesa',
  cadeira: 'uma cadeira',
}

/**
 * Tamanho padrão em CASAS da grade (largura x altura, sem giro). A cama é em
 * pé (uma pessoa deitada ocupa duas casas), a mesa deitada, o baú mais baixo
 * que uma casa; barril, caixa e cadeira cabem numa casa com folga. O mestre
 * ajusta depois pelos controles de sempre do objeto.
 */
const TAMANHO_EM_CASAS: Readonly<Record<TipoMobilia, { largura: number; altura: number }>> = {
  barril: { largura: 0.7, altura: 0.7 },
  caixa: { largura: 0.8, altura: 0.8 },
  bau: { largura: 1, altura: 0.6 },
  catre: { largura: 1, altura: 2 },
  mesa: { largura: 2, altura: 1 },
  cadeira: { largura: 0.5, altura: 0.5 },
}

export function ehTipoMobilia(valor: unknown): valor is TipoMobilia {
  return TIPOS_MOBILIA.some((tipo) => tipo === valor)
}

/** Móvel de silhueta redonda (a elipse dentro do retângulo), visto de cima. */
export function ehMovelRedondo(tipo: TipoMobilia | undefined): boolean {
  return tipo === 'barril'
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
  const tamanho = TAMANHO_EM_CASAS[tipo]
  return {
    id,
    src: '',
    x: centro.x,
    y: centro.y,
    width: tamanho.largura * grade,
    height: tamanho.altura * grade,
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

/** Polígono fechado como traços, um por lado. */
function contorno(pontos: readonly { x: number; y: number }[]): TracoDoGlifo[] {
  return pontos.map((p, i) => {
    const proximo = pontos[(i + 1) % pontos.length]
    return { x1: p.x, y1: p.y, x2: proximo.x, y2: proximo.y }
  })
}

/**
 * Os traços finos que dizem o que o móvel é, dentro do retângulo `largura` x
 * `altura` (centro na origem, "cima" = cabeceira/tampa/encosto antes do giro):
 * - barril: a borda da tampa, uma elipse menor no meio da silhueta redonda;
 * - caixa: o X das ripas, de canto a canto;
 * - baú: a linha da tampa e o fecho no meio dela;
 * - catre (a cama): travesseiro na cabeceira e a dobra da coberta;
 * - mesa: o tampo, um retângulo recuado;
 * - cadeira: o encosto, uma faixa em cima.
 * Tamanho não desenhável (zero, negativo, não finito) não tem traço.
 */
export function tracosDoGlifo(tipo: TipoMobilia, largura: number, altura: number): TracoDoGlifo[] {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return []
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
  }
}

/**
 * O "Tipo" do painel: o mesmo móvel com outro tipo. Centro, giro, camada,
 * trava, ocultos, piso, rótulo e aparência ficam; o tamanho vai para o padrão
 * do tipo novo (o da mesa não serve para o barril). `x`/`y` são o centro, então
 * o tamanho novo não tira o móvel do lugar.
 */
export function movelComOutroTipo(prop: Prop, tipo: TipoMobilia, grade: number): Prop {
  const tamanho = TAMANHO_EM_CASAS[tipo]
  return { ...prop, mobilia: tipo, width: tamanho.largura * grade, height: tamanho.altura * grade }
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
 * Pedido de aparência vindo do painel. Chave ausente = não mexe; `preenchido:
 * true` e cor `null` = volta ao padrão (o campo sai do objeto).
 */
export interface AparenciaDoMovelPatch {
  preenchido?: boolean
  cor?: string | null
  corDaLinha?: string | null
}

interface AparenciaDoMovel {
  preenchido: boolean
  cor: string | undefined
  corDaLinha: string | undefined
}

/** `prop` com a aparência na forma que o mapa guarda: cada campo só quando foge do padrão. */
function comAparenciaGravada(prop: Prop, aparencia: AparenciaDoMovel): Prop {
  const { mobiliaPreenchido: _preenchido, mobiliaCor: _cor, mobiliaCorDaLinha: _corDaLinha, ...semAparencia } = prop
  return {
    ...semAparencia,
    ...(aparencia.preenchido ? {} : { mobiliaPreenchido: false }),
    ...(aparencia.cor === undefined ? {} : { mobiliaCor: aparencia.cor }),
    ...(aparencia.corDaLinha === undefined ? {} : { mobiliaCorDaLinha: aparencia.corDaLinha }),
  }
}

/** A cor depois do pedido: sem pedido fica a de antes, `null` tira, cor torta é ignorada (fica a de antes). */
function corDepoisDoPedido(antes: string | undefined, pedido: string | null | undefined): string | undefined {
  if (pedido === undefined) return antes
  if (pedido === null) return undefined
  return normalizarCorDoMovel(pedido) ?? antes
}

/**
 * "Preencher", "Cor" e "Cor da linha" do painel aplicados ao móvel. Cor torta
 * não apaga a cor que havia: o pedido é ignorado, como o arquivo faria.
 */
export function comAparenciaDoMovel(prop: Prop, patch: AparenciaDoMovelPatch): Prop {
  return comAparenciaGravada(prop, {
    preenchido: patch.preenchido ?? prop.mobiliaPreenchido !== false,
    cor: corDepoisDoPedido(prop.mobiliaCor, patch.cor),
    corDaLinha: corDepoisDoPedido(prop.mobiliaCorDaLinha, patch.corDaLinha),
  })
}

/** Os dois objetos têm a mesma aparência de móvel ("Preencher", "Cor", "Cor da linha"). */
export function mesmaAparenciaDoMovel(a: Prop, b: Prop): boolean {
  return a.mobiliaPreenchido === b.mobiliaPreenchido && a.mobiliaCor === b.mobiliaCor && a.mobiliaCorDaLinha === b.mobiliaCorDaLinha
}

/** Objeto comum: tira o tipo e a aparência de móvel, se houver (sem tipo, a aparência não tem o que pintar). */
function semNadaDeMovel(prop: Prop): Prop {
  if (!('mobilia' in prop) && !('mobiliaPreenchido' in prop) && !('mobiliaCor' in prop) && !('mobiliaCorDaLinha' in prop)) return prop
  const { mobilia: _tipo, mobiliaPreenchido: _preenchido, mobiliaCor: _cor, mobiliaCorDaLinha: _corDaLinha, ...comum } = prop
  return comum
}

/**
 * Leitura do disco: tipo do catálogo fica; qualquer outro valor (arquivo
 * editado à mão, versão futura com móvel que esta não conhece) some, e o
 * objeto continua no mapa como objeto comum, sem a aparência de móvel. Com
 * tipo válido, a aparência passa pela mesma porta da edição: "Preencher" só
 * guarda o desligado, cor só `#rrggbb` normalizada (a torta some). Sem nada a
 * consertar, devolve o mesmo objeto.
 */
export function propMobiliaFromFile(prop: Prop): Prop {
  if (!ehTipoMobilia(prop.mobilia)) return semNadaDeMovel(prop)
  const lido = comAparenciaGravada(prop, {
    preenchido: prop.mobiliaPreenchido !== false,
    cor: normalizarCorDoMovel(prop.mobiliaCor),
    corDaLinha: normalizarCorDoMovel(prop.mobiliaCorDaLinha),
  })
  return mesmaAparenciaDoMovel(lido, prop) ? prop : lido
}
