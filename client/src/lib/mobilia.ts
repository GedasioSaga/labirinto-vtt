import type { Prop, TipoMobilia } from '../types/map'

/**
 * MOBÍLIA DESENHADA — catre, mesa e baú como objetos sem imagem, desenhados no
 * estilo do minimapa: a silhueta chapada de todo objeto
 * (`pixi/drawPropSilhouettes.ts`) e, por cima, poucos traços finos que dizem
 * o que o móvel é. Nada de imagem, sombra, hachura ou gradiente.
 *
 * Aqui mora só o que não depende de Pixi: o catálogo, o móvel que o painel da
 * sala põe no mapa e a geometria do glifo (testados sem tela).
 */

/** Ordem em que o painel da sala oferece os móveis. */
export const TIPOS_MOBILIA: readonly TipoMobilia[] = ['catre', 'mesa', 'bau']

/** Nome que o painel mostra em cada botão. */
export const ROTULO_MOBILIA: Readonly<Record<TipoMobilia, string>> = { catre: 'Catre', mesa: 'Mesa', bau: 'Baú' }

/** Artigo + nome, para a dica do botão ("Pôr um catre no centro da sala"). */
export const NOME_COM_ARTIGO: Readonly<Record<TipoMobilia, string>> = { catre: 'um catre', mesa: 'uma mesa', bau: 'um baú' }

/**
 * Tamanho padrão em CASAS da grade (largura x altura, sem giro). O catre é em
 * pé (uma pessoa deitada ocupa duas casas), a mesa deitada, o baú mais baixo
 * que uma casa. O mestre ajusta depois pelos controles de sempre do objeto.
 */
const TAMANHO_EM_CASAS: Readonly<Record<TipoMobilia, { largura: number; altura: number }>> = {
  catre: { largura: 1, altura: 2 },
  mesa: { largura: 2, altura: 1 },
  bau: { largura: 1, altura: 0.6 },
}

export function ehTipoMobilia(valor: unknown): valor is TipoMobilia {
  return TIPOS_MOBILIA.some((tipo) => tipo === valor)
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

/**
 * Os traços finos que dizem o que o móvel é, dentro do retângulo `largura` x
 * `altura` (centro na origem, "cima" = cabeceira/tampa antes do giro):
 * - catre: travesseiro na cabeceira e a dobra da coberta;
 * - mesa: o tampo, um retângulo recuado;
 * - baú: a linha da tampa e o fecho no meio dela.
 * Tamanho não desenhável (zero, negativo, não finito) não tem traço.
 */
export function tracosDoGlifo(tipo: TipoMobilia, largura: number, altura: number): TracoDoGlifo[] {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return []
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  const menorLado = Math.min(largura, altura)
  switch (tipo) {
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
 * Leitura do disco: tipo do catálogo fica; qualquer outro valor (arquivo
 * editado à mão, versão futura com móvel que esta não conhece) some, e o
 * objeto continua no mapa como objeto comum. Sem o campo, passa igual.
 */
export function propMobiliaFromFile(prop: Prop): Prop {
  if (!('mobilia' in prop) || ehTipoMobilia(prop.mobilia)) return prop
  const { mobilia: _descartada, ...resto } = prop
  return resto
}
