import type { Prop, TipoMobilia, VistaMobilia } from '../types/map'

/**
 * MOBÍLIA DESENHADA — barril, caixa, baú, cama, mesa e cadeira como objetos
 * sem imagem, desenhados no estilo do minimapa: a silhueta chapada de todo
 * objeto (`pixi/drawPropSilhouettes.ts`) e, por cima, poucos traços finos que
 * dizem o que o móvel é. Nada de imagem, sombra, hachura ou gradiente.
 *
 * Aqui mora só o que não depende de Pixi: o catálogo, o móvel que a ferramenta
 * Objetos põe no mapa e a geometria do glifo (testados sem tela).
 *
 * Cadeira e baú têm também a VISTA de lado (`TIPOS_COM_VISTA`): a silhueta vira
 * o perfil do móvel (a cadeira em L, o baú com a tampa em arco) numa pegada
 * própria. De frente é o desenho de sempre.
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
 * ajusta depois pelos controles de sempre do objeto. É o tamanho de FRENTE; o
 * de lado está em `TAMANHO_DE_LADO_EM_CASAS`.
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

/** Móvel que tem vista de lado. */
export type TipoComVista = Extract<TipoMobilia, 'cadeira' | 'bau'>

/**
 * Tipos com "Vista" (Frente | Lado). Lista, não `if` espalhado: outro móvel
 * entra acrescentando o tipo aqui, o tamanho de lado dele
 * (`TAMANHO_DE_LADO_EM_CASAS`) e o desenho de lado (`contornoDeLado` e
 * `tracosDeLado`) — o compilador cobra os três.
 */
export const TIPOS_COM_VISTA: readonly TipoComVista[] = ['cadeira', 'bau']

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
 * sobe acima do assento.
 */
const TAMANHO_DE_LADO_EM_CASAS: Readonly<Record<TipoComVista, { largura: number; altura: number }>> = {
  bau: { largura: 0.6, altura: 0.6 },
  cadeira: { largura: 0.5, altura: 0.75 },
}

/** Tamanho padrão do tipo na vista, em px de mundo. Vista de lado num tipo sem vista vale como frente. */
function tamanhoPadrao(tipo: TipoMobilia, vista: VistaMobilia, grade: number): { width: number; height: number } {
  const tamanho = vista === 'lado' && aceitaVista(tipo) ? TAMANHO_DE_LADO_EM_CASAS[tipo] : TAMANHO_EM_CASAS[tipo]
  return { width: tamanho.largura * grade, height: tamanho.altura * grade }
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

/** Polígono fechado como traços, um por lado. */
function contorno(pontos: readonly { x: number; y: number }[]): TracoDoGlifo[] {
  return pontos.map((p, i) => {
    const proximo = pontos[(i + 1) % pontos.length]
    return { x1: p.x, y1: p.y, x2: proximo.x, y2: proximo.y }
  })
}

/** Tamanho finito e positivo: o resto (zero, negativo, NaN de arquivo estragado) não tem o que desenhar. */
function tamanhoDesenhavel(largura: number, altura: number): boolean {
  return Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0
}

/** Cadeira de lado: a linha de baixo do assento, de onde as pernas descem. */
function baseDoAssento(altura: number): number {
  return -altura / 2 + altura * TOPO_DO_ASSENTO + altura * ESPESSURA_DO_ASSENTO
}

/** Baú de lado: a costura entre a tampa em arco e o corpo. */
function costuraDoBau(altura: number): number {
  return -altura / 2 + altura * ALTURA_DA_TAMPA_DE_LADO
}

/**
 * A silhueta de LADO (centro na origem, sem giro, sentido horário da tela), que
 * toma o lugar do retângulo:
 * - cadeira: o perfil em L — o encosto sobe na ponta esquerda até o topo e o
 *   assento atravessa a largura; as pernas ficam no glifo (`tracosDoGlifo`),
 *   descendo do assento até o chão;
 * - baú: o corpo embaixo e a tampa em meio arco em cima, do canto de uma parede
 *   ao da outra, com o alto no meio do topo.
 * Tipo sem vista ou tamanho não desenhável devolve `null` (vale o retângulo).
 */
export function contornoDeLado(tipo: TipoMobilia | undefined, largura: number, altura: number): { x: number; y: number }[] | null {
  if (!aceitaVista(tipo) || !tamanhoDesenhavel(largura, altura)) return null
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  switch (tipo) {
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
  }
}

/** O glifo de LADO: as duas pernas da cadeira; a costura entre a tampa e o corpo do baú. */
function tracosDeLado(tipo: TipoComVista, largura: number, altura: number): TracoDoGlifo[] {
  const meiaLargura = largura / 2
  const meiaAltura = altura / 2
  switch (tipo) {
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

/**
 * Os traços finos que dizem o que o móvel é, dentro do retângulo `largura` x
 * `altura` (centro na origem, "cima" = cabeceira/tampa/encosto antes do giro):
 * - barril: a borda da tampa, uma elipse menor no meio da silhueta redonda;
 * - caixa: o X das ripas, de canto a canto;
 * - baú: a linha da tampa e o fecho no meio dela;
 * - catre (a cama): travesseiro na cabeceira e a dobra da coberta;
 * - mesa: o tampo, um retângulo recuado;
 * - cadeira: o encosto, uma faixa em cima.
 * Na vista de lado (só nos tipos com vista), o glifo é o de lado
 * (`tracosDeLado`); nos outros tipos a vista não muda nada.
 * Tamanho não desenhável (zero, negativo, não finito) não tem traço.
 */
export function tracosDoGlifo(tipo: TipoMobilia, largura: number, altura: number, vista: VistaMobilia = 'frente'): TracoDoGlifo[] {
  if (!tamanhoDesenhavel(largura, altura)) return []
  if (vista === 'lado' && aceitaVista(tipo)) return tracosDeLado(tipo, largura, altura)
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
 */
export function movelComOutroTipo(prop: Prop, tipo: TipoMobilia, grade: number): Prop {
  const vista = normalizarVistaDoMovel(tipo, prop.mobiliaVista)
  return { ...comVistaGravada(prop, vista), mobilia: tipo, ...tamanhoPadrao(tipo, vista ?? 'frente', grade) }
}

/**
 * A "Vista" do painel (Frente | Lado): o mesmo móvel na outra vista. O tamanho
 * vai para o padrão do tipo nessa vista; centro, giro, camada, trava, ocultos,
 * piso, rótulo e aparência ficam. Só `'lado'` é gravado. Tipo sem vista
 * devolve o mesmo objeto.
 */
export function movelComOutraVista(prop: Prop, vista: VistaMobilia, grade: number): Prop {
  const tipo = prop.mobilia
  if (!aceitaVista(tipo)) return prop
  return { ...comVistaGravada(prop, vista === 'lado' ? 'lado' : undefined), ...tamanhoPadrao(tipo, vista, grade) }
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
    !('mobiliaVista' in prop)
  ) {
    return prop
  }
  const {
    mobilia: _tipo,
    mobiliaPreenchido: _preenchido,
    mobiliaCor: _cor,
    mobiliaCorDaLinha: _corDaLinha,
    mobiliaVista: _vista,
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
  const lido = comVistaGravada(
    comAparenciaGravada(prop, {
      preenchido: prop.mobiliaPreenchido !== false,
      cor: normalizarCorDoMovel(prop.mobiliaCor),
      corDaLinha: normalizarCorDoMovel(prop.mobiliaCorDaLinha),
    }),
    normalizarVistaDoMovel(prop.mobilia, prop.mobiliaVista),
  )
  return mesmaAparenciaDoMovel(lido, prop) && lido.mobiliaVista === prop.mobiliaVista ? prop : lido
}
