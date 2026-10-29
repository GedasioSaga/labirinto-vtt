/**
 * MÓVEIS COM TEXTURA do Meio-Termo, vista "de cima com volume": os 11 tipos do
 * catálogo (6 da fatia MT2 e 5 da MT3: cerca reta e curva, armário, aparador,
 * fogueira e tapete) e a montagem da cena de um móvel a partir do DESENHO
 * (tipo, Frente/Lado, materiais, pegada em casas, forma do tapete, volta da
 * cerca, semente).
 */
import type { TipoMobilia } from '../../../lib/mobilia/tipos'
import type { FormaDoTapete } from '../../../types/map'
import { LUGARES_DE_MATERIAL, ehMaterial, type OpcaoDeMaterial } from '../materiais'
import { G, materialDaPeca, type LadoDoMovel, type MateriaisDoMovel, type MontarMovel } from './contexto'
import { criarPecas, pintarCena, type Cena, type LimitesDaImagem, type MaterialDaPeca } from './motor'
import { montarBarril } from './barril'
import { montarCaixa } from './caixa'
import { montarBau } from './bau'
import { montarCatre } from './catre'
import { montarMesa } from './mesa'
import { montarCadeira } from './cadeira'
import { montarCerca } from './cerca'
import { montarArmario } from './armario'
import { montarAparador } from './aparador'
import { montarFogueira } from './fogueira'
import { montarTapete } from './tapete'
import { montarMesaQuadrada } from './mesaQuadrada'
import { montarMesaRedonda } from './mesaRedonda'
import { montarLapide } from './lapide'
import { montarVaso } from './vaso'
import { montarLampiao } from './lampiao'
import { montarQuadroDeAvisos } from './quadroDeAvisos'
import { montarPoco } from './poco'
import { montarBarraca } from './barraca'
import { montarCarroca } from './carroca'
import { montarSebe } from './sebe'
import { montarJardineira } from './jardineira'
import { montarArcoDoPortao } from './arcoDoPortao'
import { montarPlacaDeSeta } from './placaDeSeta'
import { montarTapeteLongo } from './tapeteLongo'
import { montarFogo } from './fogo'
import { montarFogao } from './fogao'
import { montarGeladeira } from './geladeira'
import { montarPia } from './pia'
import { montarBalcao } from './balcao'
import { montarPratos } from './pratos'
import { montarPrivada } from './privada'
import { montarSofa } from './sofa'
import { montarPoltrona } from './poltrona'
import { montarLareira } from './lareira'
import { montarFornalha } from './fornalha'
import { montarBigorna } from './bigorna'
import { montarBalde } from './balde'
import { cenaEmTresQuartos, girarCena, perfilDoTresQuartos, pintaOGiroNaTresQuartos } from './tresQuartos'

const MONTADORES = {
  barril: montarBarril,
  caixa: montarCaixa,
  bau: montarBau,
  catre: montarCatre,
  mesa: montarMesa,
  cadeira: montarCadeira,
  cerca: montarCerca,
  armario: montarArmario,
  aparador: montarAparador,
  fogueira: montarFogueira,
  tapete: montarTapete,
  // As peças novas do lote 1 (MT4). Com o desenho aqui elas saem em imagem; o painel só as
  // oferece depois de medidas (`PECAS_NOVAS_PRONTAS` em `lib/mobilia/pecasNovas.ts`).
  mesaQuadrada: montarMesaQuadrada,
  mesaRedonda: montarMesaRedonda,
  lapide: montarLapide,
  vaso: montarVaso,
  lampiao: montarLampiao,
  quadroDeAvisos: montarQuadroDeAvisos,
  poco: montarPoco,
  barraca: montarBarraca,
  carroca: montarCarroca,
  // Lote 2 (MT5): a sebe tem a geometria da cerca (com a curva); o tapete longo mora no chão.
  sebe: montarSebe,
  jardineira: montarJardineira,
  arcoDoPortao: montarArcoDoPortao,
  placaDeSeta: montarPlacaDeSeta,
  tapeteLongo: montarTapeteLongo,
  // Objeto Fogo (27/10/2026): só o chão queimado; as chamas são a camada animada `pixi/fogosDoMapa.ts`.
  fogo: montarFogo,
  // Móveis de casa (28/10/2026): a cozinha.
  fogao: montarFogao,
  geladeira: montarGeladeira,
  pia: montarPia,
  balcao: montarBalcao,
  // A mesa posta: a forma (cheio, vazio, pilha) chega na `variante`, como o desenho da lápide.
  pratos: montarPratos,
  // O banheiro e a sala: o sofá e a poltrona são o mesmo estofado (`montarEstofado`).
  privada: montarPrivada,
  sofa: montarSofa,
  poltrona: montarPoltrona,
  // Lareira e oficina (29/10/2026): o fogo aceso ou apagado chega na `variante`; a chama é a camada animada.
  lareira: montarLareira,
  fornalha: montarFornalha,
  bigorna: montarBigorna,
  balde: montarBalde,
} as const satisfies Record<TipoMobilia, MontarMovel>

export type TipoComTextura = keyof typeof MONTADORES

/**
 * Px de MUNDO por casa que a imagem supõe. `drawPropSilhouettes` não recebe a
 * grade do mapa (a assinatura é fixa, e quem a chama no jogador é
 * `PlayerView.tsx`, arquivo quente), então a pegada em casas sai do tamanho do
 * objeto sobre a grade padrão do app (50 px, `player/meuCaderno.ts:210`).
 * Em mapa de outra grade a imagem NÃO é só esticada: o desenho é feito para a
 * pegada em casas de 50 px, e o que se repete por casa sai mais denso ou mais
 * ralo. Medido: na grade 70 o tapete 3 x 2 (210 x 140 px) é desenhado como
 * 4,2 x 2,8 casas, com 2,8 losangos da borda por casa do mapa em vez de 2 (o
 * tapete longo da MT5 herda isso). A cerca não: os mourões tomam a espessura
 * dela como régua (`geometriaDaCerca`).
 */
export const GRADE_DE_REFERENCIA = 50

/** Pixels da imagem por px do protótipo no nível 1, 2 ou 3: o nível é pixels da imagem por px de mundo. */
export function escalaDoNivel(nivel: number): number {
  return (nivel * GRADE_DE_REFERENCIA) / G
}

/** Os tipos que têm desenho com textura, na ordem do catálogo: os 11. */
export const TIPOS_COM_TEXTURA: readonly TipoComTextura[] = [
  'barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete',
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
  'sebe', 'jardineira', 'arcoDoPortao', 'placaDeSeta', 'tapeteLongo', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao', 'pratos', 'privada', 'sofa', 'poltrona',
  'lareira', 'fornalha', 'bigorna', 'balde',
]

export function temTextura(tipo: TipoMobilia | undefined): tipo is TipoComTextura {
  return TIPOS_COM_TEXTURA.some((t) => t === tipo)
}

/** O que define a imagem de um móvel. Móveis com o mesmo desenho dividem a mesma imagem. */
export interface DesenhoDoMovel {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  /** Uma opção por lugar, na ordem de `LUGARES_DE_MATERIAL[tipo]`. */
  readonly materiais: readonly OpcaoDeMaterial[]
  /** Pegada em casas (largura e altura do objeto, sem giro). */
  readonly casasW: number
  readonly casasH: number
  /** Semente do veio: inteira, a mesma para o mesmo desenho. */
  readonly semente: number
  /** Só no tapete: retangular (o padrão) ou redondo. */
  readonly forma?: FormaDoTapete
  /** Só na cerca: a volta em graus (0 ou ausente = reta). */
  readonly curva?: number
  /** Só na lápide: o desenho (0, 1 ou 2), do hash do id do objeto (`varianteDaLapide`). Nos pratos, a forma (`varianteDosPratos`). */
  readonly variante?: number
  /**
   * Só na placa de seta: o giro do objeto em quartos de volta (90, 180 ou 270;
   * ausente = 0). A seta sai pintada já girada, com a sombra e a luz no lugar de
   * sempre; a tela gira a imagem só pelo que sobra (`giroDaImagem`).
   */
  readonly giro?: number
  /**
   * Vista 3/4 do mapa (MT11, `tresQuartos.ts`): o tampo sobe e a frente
   * aparece embaixo. Ausente = "de cima com volume", a cena de antes byte a
   * byte. Na 3/4 o `giro` (quarto de volta) vale para todo móvel derivado.
   */
  readonly vista?: 'tres-quartos'
}

/**
 * O material de cada lugar. Opção fora da lista do lugar vira o padrão; as
 * que usam a madeira do móvel (`mesma` da cadeira, `varas` da cerca) viram a
 * madeira escolhida. A fogueira e o tapete não têm madeira, mas também não têm
 * essas opções.
 */
function materiaisDoDesenho(d: DesenhoDoMovel): MateriaisDoMovel {
  const lugares = LUGARES_DE_MATERIAL[d.tipo]
  const ids = lugares.map((lugar, i) => {
    const escolhida = d.materiais[i]
    return escolhida !== undefined && lugar.opcoes.includes(escolhida) ? escolhida : lugar.padrao
  })
  // Quem tem `mesma` ou `varas` tem o lugar `madeira`, e as opções dele são todas madeiras de verdade.
  const daMadeira = ids.find((_id, i) => lugares[i].id === 'madeira')
  const madeira = daMadeira !== undefined && ehMaterial(daMadeira) ? daMadeira : 'carvalho'
  const m: Record<string, MaterialDaPeca> = {}
  lugares.forEach((lugar, i) => {
    const id = ids[i]
    m[lugar.id] = materialDaPeca(ehMaterial(id) ? id : madeira)
  })
  return m
}

/** As peças e as sombras do móvel, em px do protótipo, centradas na origem. */
export function montarCena(d: DesenhoDoMovel): Cena {
  const w = d.casasW * G
  const h = d.casasH * G
  const cena: Cena = { partes: [], sombras: [] }
  const contexto = { w, h, hw: w / 2, hh: h / 2, g: G, lado: d.lado, m: materiaisDoDesenho(d), peca: criarPecas(d.semente), forma: d.forma ?? 'retangular', curva: d.curva ?? 0, variante: d.variante ?? 0, giro: d.giro ?? 0 }
  MONTADORES[d.tipo](contexto, cena)
  if (d.vista !== 'tres-quartos') return cena
  // 3/4: o quarto de volta é pintado antes de subir o tampo (a frente fica embaixo na tela); a placa já pinta o dela.
  const girada = pintaOGiroNaTresQuartos(d.tipo, d.lado) ? girarCena(cena, (d.giro ?? 0) / 90) : cena
  return cenaEmTresQuartos(girada, perfilDoTresQuartos(d.tipo, d.lado), contexto.peca)
}

/** A imagem inteira de uma vez, em `S` pixels por px do protótipo (teste e folha de contato). */
export function pintarMovel(d: DesenhoDoMovel, S: number): { limites: LimitesDaImagem; pixels: Uint8ClampedArray } {
  return pintarCena(montarCena(d), S)
}
