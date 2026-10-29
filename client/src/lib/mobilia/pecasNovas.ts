/**
 * PEÇAS NOVAS do Meio-Termo, lote 1 (fatia MT4 do plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`): mesa quadrada,
 * mesa redonda, lápide, vaso, lampião, quadro de avisos, poço, barraca de
 * feira e carroça. Aqui mora o registro de cada uma (nome, artigo, tamanho
 * padrão em casas, vista, silhueta e o desenho de linhas provisório) e o
 * CATÁLOGO que o painel oferece. `lib/mobilia.ts` junta este registro ao dos
 * 11 móveis de antes.
 *
 * As peças novas saem SEMPRE com o desenho de textura (a chave de obra só vale
 * para os 11 de antes, `pixi/drawPropSilhouettes.ts`). O desenho de linhas
 * daqui é o provisório que aparece enquanto a imagem não fica pronta.
 *
 * Sem import de `types/map.ts` (o tipo vem de `tipos.ts`), para não criar ciclo.
 */
import { TIPOS_MOBILIA, type TipoMobilia } from './tipos'

/**
 * As 9 peças do lote 1 (MT4) e as 5 do lote 2 (MT5: sebe, jardineira, arco do
 * portão, placa de seta e tapete longo), na ordem do plano.
 */
export const PECAS_NOVAS = [
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
  'sebe', 'jardineira', 'arcoDoPortao', 'placaDeSeta', 'tapeteLongo', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao', 'pratos', 'privada', 'sofa', 'poltrona',
  'lareira', 'fornalha', 'bigorna', 'balde',
  'troncos', 'feno',
] as const satisfies readonly TipoMobilia[]

export type PecaNova = (typeof PECAS_NOVAS)[number]

/** Peças novas com vista de lado (Frente | Lado): a barraca e a carroça. */
export type PecaNovaComVista = Extract<PecaNova, 'barraca' | 'carroca'>

export function ehPecaNova(tipo: TipoMobilia | undefined): tipo is PecaNova {
  return PECAS_NOVAS.some((peca) => peca === tipo)
}

interface Casas {
  readonly largura: number
  readonly altura: number
}

export interface FichaDaPecaNova {
  /** Nome na setinha e no seletor de tipo. */
  readonly rotulo: string
  /** Artigo + nome, para a dica ("Clique no mapa para pôr uma lápide."). */
  readonly artigo: string
  /** Tamanho padrão em casas (largura x altura, sem giro), de frente. */
  readonly tamanho: Casas
  /** Silhueta redonda (a elipse inscrita) vista de cima. */
  readonly redonda: boolean
}

/**
 * Tamanhos do plano. O vaso leva "de planta" no nome e a barraca "de feira":
 * "Vaso" e "Barraca" sozinhos não dizem o que são no meio dos móveis.
 */
export const FICHAS_DAS_PECAS_NOVAS: Readonly<Record<PecaNova, FichaDaPecaNova>> = {
  mesaQuadrada: { rotulo: 'Mesa quadrada', artigo: 'uma mesa quadrada', tamanho: { largura: 1, altura: 1 }, redonda: false },
  mesaRedonda: { rotulo: 'Mesa redonda', artigo: 'uma mesa redonda', tamanho: { largura: 1.25, altura: 1.25 }, redonda: true },
  lapide: { rotulo: 'Lápide', artigo: 'uma lápide', tamanho: { largura: 0.6, altura: 0.35 }, redonda: false },
  vaso: { rotulo: 'Vaso de planta', artigo: 'um vaso de planta', tamanho: { largura: 0.5, altura: 0.5 }, redonda: true },
  lampiao: { rotulo: 'Lampião', artigo: 'um lampião', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  quadroDeAvisos: { rotulo: 'Quadro de avisos', artigo: 'um quadro de avisos', tamanho: { largura: 1, altura: 0.4 }, redonda: false },
  poco: { rotulo: 'Poço', artigo: 'um poço', tamanho: { largura: 1.5, altura: 1.5 }, redonda: true },
  barraca: { rotulo: 'Barraca de feira', artigo: 'uma barraca de feira', tamanho: { largura: 2, altura: 2 }, redonda: false },
  carroca: { rotulo: 'Carroça', artigo: 'uma carroça', tamanho: { largura: 2, altura: 1.25 }, redonda: false },
  // Lote 2 (MT5). A sebe tem a geometria da cerca (estica e curva); o tapete longo corre em pé e estica à vontade.
  sebe: { rotulo: 'Sebe', artigo: 'uma sebe', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  jardineira: { rotulo: 'Jardineira', artigo: 'uma jardineira', tamanho: { largura: 1, altura: 0.5 }, redonda: false },
  arcoDoPortao: { rotulo: 'Arco do portão', artigo: 'um arco do portão', tamanho: { largura: 2, altura: 0.5 }, redonda: false },
  placaDeSeta: { rotulo: 'Placa de seta', artigo: 'uma placa de seta', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  tapeteLongo: { rotulo: 'Tapete longo', artigo: 'um tapete longo', tamanho: { largura: 1, altura: 4 }, redonda: false },
  // Objeto Fogo (27/10/2026): o tamanho padrão é o da Chama; o painel troca para Fogaréu e Incêndio (`TAMANHOS_DO_FOGO`).
  fogo: { rotulo: 'Fogo', artigo: 'um fogo', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Móveis de casa (28/10/2026), época "Fantasia, como os de hoje". A cozinha: o fogão de ferro a lenha,
  // a geladeira de madeira (a caixa de gelo), a pia de pedra e o balcão, esticável como o aparador.
  fogao: { rotulo: 'Fogão', artigo: 'um fogão', tamanho: { largura: 1, altura: 1 }, redonda: false },
  geladeira: { rotulo: 'Geladeira', artigo: 'uma geladeira', tamanho: { largura: 1, altura: 0.75 }, redonda: false },
  pia: { rotulo: 'Pia', artigo: 'uma pia', tamanho: { largura: 1, altura: 0.6 }, redonda: false },
  balcao: { rotulo: 'Balcão', artigo: 'um balcão', tamanho: { largura: 2, altura: 0.6 }, redonda: false },
  // A mesa posta: desenhada por cima da mesa e do balcão (`ehMovelDeCimaDaMesa`), com a forma cheio, vazio ou pilha.
  pratos: { rotulo: 'Pratos', artigo: 'uns pratos', tamanho: { largura: 0.5, altura: 0.5 }, redonda: false },
  // O banheiro e a sala: a privada de madeira e louça, o sofá estofado (estica, uma almofada por casa) e a poltrona, o par dele.
  privada: { rotulo: 'Privada', artigo: 'uma privada', tamanho: { largura: 0.5, altura: 0.6 }, redonda: false },
  sofa: { rotulo: 'Sofá', artigo: 'um sofá', tamanho: { largura: 2, altura: 1 }, redonda: false },
  poltrona: { rotulo: 'Poltrona', artigo: 'uma poltrona', tamanho: { largura: 1, altura: 1 }, redonda: false },
  // Lareira e oficina (29/10/2026), soltos como o fogão: o mestre encosta na parede e gira. A lareira e a
  // fornalha têm a chama da fogueira e o fogo aceso ou apagado (`lib/mobilia/fogoDeCasa.ts`).
  lareira: { rotulo: 'Lareira', artigo: 'uma lareira', tamanho: { largura: 2, altura: 1 }, redonda: false },
  fornalha: { rotulo: 'Fornalha de ferreiro', artigo: 'uma fornalha de ferreiro', tamanho: { largura: 1.5, altura: 1.5 }, redonda: false },
  bigorna: { rotulo: 'Bigorna', artigo: 'uma bigorna', tamanho: { largura: 1, altura: 0.5 }, redonda: false },
  balde: { rotulo: 'Balde de água', artigo: 'um balde de água', tamanho: { largura: 0.5, altura: 0.5 }, redonda: true },
  // Troncos e feno (29/10/2026): uma forma de partida cada (a pilha de toras e os fardos), a outra no painel
  // com a pegada dela (`lib/mobilia/pilhas.ts`). O tamanho daqui é o da forma de partida.
  troncos: { rotulo: 'Troncos', artigo: 'uns troncos', tamanho: { largura: 2, altura: 1 }, redonda: false },
  // "Clique no mapa para pôr feno.": o feno é de monte, não se conta (sem artigo).
  feno: { rotulo: 'Feno', artigo: 'feno', tamanho: { largura: 1.5, altura: 1 }, redonda: false },
}

/** Um valor por peça nova, lido da ficha (o nome, o artigo, o tamanho), para juntar às tabelas de `lib/mobilia.ts`. */
export function porPecaNova<T>(valor: (ficha: FichaDaPecaNova) => T): Readonly<Record<PecaNova, T>> {
  const f = FICHAS_DAS_PECAS_NOVAS
  return {
    mesaQuadrada: valor(f.mesaQuadrada),
    mesaRedonda: valor(f.mesaRedonda),
    lapide: valor(f.lapide),
    vaso: valor(f.vaso),
    lampiao: valor(f.lampiao),
    quadroDeAvisos: valor(f.quadroDeAvisos),
    poco: valor(f.poco),
    barraca: valor(f.barraca),
    carroca: valor(f.carroca),
    sebe: valor(f.sebe),
    jardineira: valor(f.jardineira),
    arcoDoPortao: valor(f.arcoDoPortao),
    placaDeSeta: valor(f.placaDeSeta),
    tapeteLongo: valor(f.tapeteLongo),
    fogo: valor(f.fogo),
    fogao: valor(f.fogao),
    geladeira: valor(f.geladeira),
    pia: valor(f.pia),
    balcao: valor(f.balcao),
    pratos: valor(f.pratos),
    privada: valor(f.privada),
    sofa: valor(f.sofa),
    poltrona: valor(f.poltrona),
    lareira: valor(f.lareira),
    fornalha: valor(f.fornalha),
    bigorna: valor(f.bigorna),
    balde: valor(f.balde),
    troncos: valor(f.troncos),
    feno: valor(f.feno),
  }
}

/** Pegada de LADO em casas: a barraca de lado é o perfil do toldo sobre o balcão; a carroça, a roda e a caixa. */
export const TAMANHO_DE_LADO_DAS_PECAS_NOVAS: Readonly<Record<PecaNovaComVista, Casas>> = {
  barraca: { largura: 2, altura: 2 },
  carroca: { largura: 2, altura: 1.25 },
}

export const PECAS_NOVAS_COM_VISTA: readonly PecaNovaComVista[] = ['barraca', 'carroca']

/**
 * As peças novas PRONTAS: desenho com textura feito e medido. Só elas entram
 * na setinha e no seletor de tipo; a que não está aqui ainda abre de um
 * arquivo (o tipo existe), mas o painel não a oferece. As 9 do lote 1 passaram
 * nos testes de pixel (`moveisMt4.test.ts`) e na semente do app com a
 * varredura das 1000 (`pixi/rasterDosMoveis.sementesMt4.test.ts`); as 5 do
 * lote 2, em `moveisMt5.test.ts` e `pixi/rasterDosMoveis.sementesMt5.test.ts`.
 */
export const PECAS_NOVAS_PRONTAS: readonly PecaNova[] = [
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
  'sebe', 'jardineira', 'tapeteLongo', 'arcoDoPortao', 'placaDeSeta', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao', 'pratos', 'privada', 'sofa', 'poltrona',
  'lareira', 'fornalha', 'bigorna', 'balde',
  'troncos', 'feno',
]

/**
 * Peças novas que entram logo depois de um parente antigo no catálogo, e não
 * no fim: quem procura mesa acha as três juntas, a sebe e a jardineira ficam
 * com a cerca, e o tapete longo com o tapete (MT5).
 */
const DEPOIS_DE: Readonly<Partial<Record<TipoMobilia, readonly PecaNova[]>>> = {
  // A mesa posta (os Pratos) com as mesas, onde ela vai.
  mesa: ['mesaQuadrada', 'mesaRedonda', 'pratos'],
  // A cozinha fica junto do armário de cozinha, e o balcão com o aparador, o parente esticável dele.
  armario: ['fogao', 'geladeira', 'pia', 'privada'],
  // O sofá e a poltrona com a cadeira, os outros assentos.
  cadeira: ['sofa', 'poltrona'],
  aparador: ['balcao'],
  cerca: ['sebe', 'jardineira'],
  tapete: ['tapeteLongo'],
  // O fogo de casa fica com a fogueira e o fogo (a mesma chama), a bigorna com a fornalha e o balde com o barril.
  fogueira: ['fogo', 'lareira', 'fornalha', 'bigorna'],
  barril: ['balde'],
}
const COM_PARENTE: readonly PecaNova[] = Object.values(DEPOIS_DE).flat()

/**
 * O catálogo do painel de Objetos: os 11 de antes, na ordem de sempre, com as
 * peças novas prontas que têm parente logo depois dele, e as outras peças
 * novas prontas no fim.
 */
export const TIPOS_NO_CATALOGO: readonly TipoMobilia[] = [
  ...TIPOS_MOBILIA.filter((tipo) => !ehPecaNova(tipo)).flatMap((tipo) => [tipo, ...(DEPOIS_DE[tipo] ?? []).filter((p) => PECAS_NOVAS_PRONTAS.includes(p))]),
  ...PECAS_NOVAS_PRONTAS.filter((tipo) => !COM_PARENTE.includes(tipo)),
]

/** O catálogo e, se não estiver nele, o tipo do móvel selecionado (o seletor sempre mostra o que o móvel é). */
export function catalogoComOTipo(tipo: TipoMobilia): readonly TipoMobilia[] {
  return TIPOS_NO_CATALOGO.includes(tipo) ? TIPOS_NO_CATALOGO : [...TIPOS_NO_CATALOGO, tipo]
}

// ---------- variação da lápide ----------

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619
export const VARIANTES_DA_LAPIDE = 3

/**
 * A lápide tem 3 desenhos (arco, reta com quina partida e cruz). O desenho
 * sai do id do objeto: o mesmo objeto sempre igual, no editor e no jogador
 * (o recorte leva o id), e lápides vizinhas diferentes sem o mestre escolher.
 */
export function varianteDaLapide(id: string | undefined): number {
  if (id === undefined || id === '') return 0
  let h = FNV_BASE
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), FNV_PRIMO)
  return (h >>> 0) % VARIANTES_DA_LAPIDE
}

// ---------- desenho de linhas (o provisório) ----------

/** Um traço reto, em px de mundo, centro do objeto na origem (o `TracoDoGlifo` de `lib/mobilia.ts`). */
interface Traco {
  x1: number
  y1: number
  x2: number
  y2: number
}

const LADOS_DO_ARO = 24

function aro(largura: number, altura: number, cx = 0, cy = 0): Traco[] {
  const tracos: Traco[] = []
  for (let i = 0; i < LADOS_DO_ARO; i += 1) {
    const a0 = (2 * Math.PI * i) / LADOS_DO_ARO
    const a1 = (2 * Math.PI * (i + 1)) / LADOS_DO_ARO
    tracos.push({ x1: cx + (largura / 2) * Math.cos(a0), y1: cy + (altura / 2) * Math.sin(a0), x2: cx + (largura / 2) * Math.cos(a1), y2: cy + (altura / 2) * Math.sin(a1) })
  }
  return tracos
}

function quadro(x0: number, y0: number, x1: number, y1: number): Traco[] {
  return [
    { x1: x0, y1: y0, x2: x1, y2: y0 },
    { x1: x1, y1: y0, x2: x1, y2: y1 },
    { x1: x1, y1: y1, x2: x0, y2: y1 },
    { x1: x0, y1: y1, x2: x0, y2: y0 },
  ]
}

function linha(x0: number, y: number, x1: number): Traco {
  return { x1: x0, y1: y, x2: x1, y2: y }
}

/**
 * Glifo de frente (de cima) da peça nova: poucos traços que dizem o que ela é.
 * `variante` só vale nos troncos e no feno: a forma (0 a de partida, 1 a outra).
 */
function tracosDeFrente(tipo: PecaNova, largura: number, altura: number, variante: number): Traco[] {
  const hw = largura / 2
  const hh = altura / 2
  switch (tipo) {
    case 'mesaQuadrada': {
      const recuo = Math.min(largura, altura) * 0.12
      return quadro(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo)
    }
    case 'mesaRedonda':
      return aro(largura * 0.78, altura * 0.78)
    case 'lapide':
      return [linha(-hw, -hh + altura * 0.45, hw)]
    case 'vaso':
      return aro(largura * 0.66, altura * 0.66)
    case 'lampiao':
      return quadro(-hw * 0.55, -hh * 0.55, hw * 0.55, hh * 0.55)
    case 'quadroDeAvisos':
      // Os três papéis pregados: duas divisas de pé.
      return [
        { x1: -hw / 3, y1: -hh * 0.6, x2: -hw / 3, y2: hh * 0.6 },
        { x1: hw / 3, y1: -hh * 0.6, x2: hw / 3, y2: hh * 0.6 },
      ]
    case 'poco':
      return [...aro(largura * 0.62, altura * 0.62), linha(-hw, 0, hw)]
    case 'barraca':
      return [linha(-hw, -hh * 0.15, hw), linha(-hw, hh * 0.62, hw)]
    case 'carroca':
      return quadro(-hw * 0.4, -hh * 0.75, hw * 0.98, hh * 0.75)
    // Lote 2 (MT5). A sebe sai pela faixa da cerca em `lib/mobilia.ts` (segue o arco); aqui fica a reta.
    case 'sebe':
      return quadro(-hw, -hh, hw, hh)
    case 'jardineira':
      return quadro(-hw * 0.8, -hh * 0.55, hw * 0.8, hh * 0.55)
    case 'arcoDoPortao':
      // A trave de ponta a ponta e os dois postes.
      return [linha(-hw, 0, hw), ...quadro(-hw, -hh * 0.6, -hw * 0.8, hh * 0.6), ...quadro(hw * 0.8, -hh * 0.6, hw, hh * 0.6)]
    case 'placaDeSeta':
      // A seta aponta para a direita do objeto: o giro dá a direção.
      return [linha(-hw * 0.6, 0, hw * 0.8), { x1: hw * 0.8, y1: 0, x2: hw * 0.4, y2: -hh * 0.45 }, { x1: hw * 0.8, y1: 0, x2: hw * 0.4, y2: hh * 0.45 }]
    case 'tapeteLongo': {
      const recuo = Math.min(largura, altura) * 0.14
      return quadro(-hw + recuo, -hh + recuo, hw - recuo, hh - recuo)
    }
    case 'fogo':
      // O chão queimado: um aro por dentro da pegada (as línguas são a camada animada, `pixi/fogosDoMapa.ts`).
      return aro(largura * 0.8, altura * 0.8)
    // Móveis de casa (28/10/2026): a frente do móvel é o lado de baixo, como no armário.
    case 'fogao':
      // As duas bocas no fundo da chapa e a portinha da lenha na frente.
      return [...aro(largura * 0.3, altura * 0.3, -hw * 0.42, -hh * 0.22), ...aro(largura * 0.3, altura * 0.3, hw * 0.42, -hh * 0.22), linha(-hw * 0.4, hh * 0.62, hw * 0.4)]
    case 'geladeira':
      // A tampa de zinco da caixa de gelo e o fecho da frente.
      return [...quadro(-hw * 0.62, -hh * 0.62, hw * 0.62, hh * 0.3), { x1: 0, y1: hh * 0.3, x2: 0, y2: hh }]
    case 'pia':
      // A cuba de pedra à esquerda e o balde à direita.
      return [...quadro(-hw * 0.86, -hh * 0.66, hw * 0.08, hh * 0.66), ...aro(altura * 0.62, altura * 0.62, hw * 0.52, 0)]
    case 'balcao':
      // A moldura da frente do tampo e a barra de pé, de ponta a ponta.
      return [linha(-hw, hh * 0.4, hw), linha(-hw * 0.96, hh * 0.86, hw * 0.96)]
    case 'pratos':
      // O prato e a caneca no canto.
      return [...aro(largura * 0.62, altura * 0.62, -hw * 0.15, hh * 0.08), ...aro(largura * 0.24, altura * 0.24, hw * 0.6, -hh * 0.6)]
    case 'privada':
      // A caixa de descarga no fundo e o assento oval na frente.
      return [linha(-hw, -hh * 0.4, hw), ...aro(largura * 0.86, altura * 0.62, 0, hh * 0.3)]
    case 'sofa':
    case 'poltrona': {
      // O encosto no fundo e os dois braços: o "U" em volta do assento (a poltrona tem os braços mais largos).
      const braco = largura * (tipo === 'sofa' ? 0.11 : 0.2)
      const encosto = -hh + altura * 0.3
      return [linha(-hw + braco, encosto, hw - braco), { x1: -hw + braco, y1: encosto, x2: -hw + braco, y2: hh }, { x1: hw - braco, y1: encosto, x2: hw - braco, y2: hh }]
    }
    // Lareira e oficina (29/10/2026): a frente é o lado de baixo, como no fogão.
    case 'lareira':
      // O consolo de ponta a ponta e a boca entre as ombreiras, aberta para a soleira.
      return [linha(-hw * 0.94, -hh * 0.36, hw * 0.94), ...quadro(-hw * 0.54, -hh * 0.28, hw * 0.54, hh * 0.6)]
    case 'fornalha':
      // A cova das brasas na bancada e o fole à esquerda, soprando nela.
      return [...aro(Math.min(largura, altura) * 0.3, Math.min(largura, altura) * 0.3, hw * 0.2, hh * 0.2), linha(-hw * 0.96, hh * 0.2, -hw * 0.46)]
    case 'bigorna':
      // A mesa da bigorna e o chifre afinando para a esquerda.
      return [...quadro(-hw * 0.36, -hh * 0.4, hw * 0.86, hh * 0.4), { x1: -hw * 0.36, y1: -hh * 0.4, x2: -hw * 0.96, y2: 0 }, { x1: -hw * 0.36, y1: hh * 0.4, x2: -hw * 0.96, y2: 0 }]
    case 'balde':
      // A boca do balde e a alça atravessada.
      return [...aro(largura * 0.72, altura * 0.72), linha(-hw * 0.86, 0, hw * 0.86)]
    // Troncos e feno (29/10/2026), cada um nas duas formas.
    case 'troncos': {
      if (variante === 1) {
        // A lenha empilhada: as divisas entre as achas, de pé, da parede à frente.
        return [1, 2, 3, 4, 5].map((k) => {
          const x = -hw + (largura * k) / 6
          return { x1: x, y1: -hh * 0.7, x2: x, y2: hh * 0.7 }
        })
      }
      // A pilha de toras: a tora de cima de ponta a ponta, com o corte (o anel) nas duas pontas.
      return [
        linha(-hw * 0.84, -hh / 3, hw * 0.84),
        linha(-hw * 0.84, hh / 3, hw * 0.84),
        ...aro(altura * 0.2, altura * 0.6, -hw * 0.84, 0),
        ...aro(altura * 0.2, altura * 0.6, hw * 0.84, 0),
      ]
    }
    case 'feno':
      if (variante === 1) {
        // O monte de feno: a roda do monte e o alto dele, um pouco para trás.
        return [...aro(largura * 0.8, altura * 0.8), ...aro(largura * 0.3, altura * 0.3, -hw * 0.08, -hh * 0.1)]
      }
      // Os fardos: o fardo de cima, atravessado no fundo, e as divisas dos três de baixo na frente.
      return [
        ...quadro(-hw * 0.94, -hh * 0.9, hw * 0.3, hh * 0.02),
        { x1: -hw / 3, y1: hh * 0.02, x2: -hw / 3, y2: hh * 0.92 },
        { x1: hw / 3, y1: -hh * 0.92, x2: hw / 3, y2: hh * 0.92 },
      ]
  }
}

/** Glifo de lado da barraca (a beira do toldo e o tampo do balcão) e da carroça (a roda). */
function tracosDaVistaDeLado(tipo: PecaNovaComVista, largura: number, altura: number): Traco[] {
  const hw = largura / 2
  const hh = altura / 2
  if (tipo === 'barraca') return [linha(-hw, -hh + altura * 0.4, hw), linha(-hw * 0.9, hh - altura * 0.3, hw * 0.9)]
  // A roda cabe na caixa em qualquer proporção: o diâmetro é o menor entre 62% da altura e 60% da largura.
  const roda = Math.min(altura * 0.62, largura * 0.6)
  return aro(roda, roda, hw * 0.12, hh - roda / 2)
}

export function tracosDaPecaNova(tipo: PecaNova, largura: number, altura: number, deLado: boolean, variante = 0): Traco[] {
  if (deLado && (tipo === 'barraca' || tipo === 'carroca')) return tracosDaVistaDeLado(tipo, largura, altura)
  return tracosDeFrente(tipo, largura, altura, variante)
}

/** Contorno de lado (barraca e carroça): o retângulo do objeto, no sentido horário a partir do canto de cima à esquerda. */
export function contornoDaPecaNovaDeLado(largura: number, altura: number): { x: number; y: number }[] {
  const hw = largura / 2
  const hh = altura / 2
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ]
}
