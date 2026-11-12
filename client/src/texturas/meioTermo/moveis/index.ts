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
import { montarTroncos } from './troncos'
import { montarFeno } from './feno'
import { montarChafariz } from './chafariz'
import { montarCataVento, montarCataVentoBrinquedo, montarMoinho } from './cataVento'
import { montarPonte } from './ponte'
import { montarCova } from './cova'
import { montarCaixao, montarCaixaoAberto } from './caixao'
import { montarDestrocosDeMadeira } from './destrocos'
import { montarSucataDeChapas, montarSucataDeEngrenagens, montarSucataDeTambores } from './sucata'
import { montarCampinho } from './campinho'
import { montarBonecoDeTreino } from './bonecoDeTreino'
import { montarPilar } from './pilar'
import { montarAltar } from './altar'
import { montarEstanteDeLivros } from './estanteDeLivros'
import { montarSacosDeGrao } from './sacosDeGrao'
import { montarBancoDePraca } from './bancoDePraca'
import { montarEscombrosDePedra } from './escombrosDePedra'
import { montarCanhao } from './canhao'
import { montarGuardaRoupa } from './guardaRoupa'
import { montarCaldeirao } from './caldeirao'
import { montarFornoDePao } from './fornoDePao'
import { montarPrateleiraDeDeposito } from './prateleiraDeDeposito'
import { montarEstatua } from './estatua'
import { montarPedrasERochas } from './pedrasERochas'
import { montarMausoleu } from './mausoleu'
import { montarAlvoDeArcoEFlecha } from './alvoDeArcoEFlecha'
import { montarBancaDeFrutas } from './bancaDeFrutas'
import { montarToldoListrado } from './toldoListrado'
import { montarBancadaDeFerramentas } from './bancadaDeFerramentas'
import { montarPedraDeAmolar } from './pedraDeAmolar'
import { montarSuporteDeArmas } from './suporteDeArmas'
import { montarEspantalho } from './espantalho'
import { montarCocho } from './cocho'
import { montarOssos } from './ossos'
import { montarAntenaParabolica } from './antenaParabolica'
import { montarEscrivaninha } from './escrivaninha'
import { montarCriadoMudo } from './criadoMudo'
import { montarCamaDeCasal } from './camaDeCasal'
import { montarBerco } from './berco'
import { montarBanqueta } from './banqueta'
import { montarBiombo } from './biombo'
import { montarPiano } from './piano'
import { montarCandelabroDeChao } from './candelabroDeChao'
import { montarBanheira } from './banheira'
import { montarTinaDeMadeira } from './tinaDeMadeira'
import { montarLavatorioComJarro } from './lavatorioComJarro'
import { montarPrateleiraDePotes } from './prateleiraDePotes'
import { montarMesaDeCorte } from './mesaDeCorte'
import { montarGanchoComCarne } from './ganchoComCarne'
import { montarPilhaDeCaixas } from './pilhaDeCaixas'
import { montarBarrisDeitados } from './barrisDeitados'
import { montarTonelDeAdega } from './tonelDeAdega'
import { montarAnforasDeBarro } from './anforasDeBarro'
import { montarCestoDeVime } from './cestoDeVime'
import { montarCofre } from './cofre'
import { montarVaralDeRoupa } from './varalDeRoupa'
import { montarHorta } from './horta'
import { montarCanteiroDeFlores } from './canteiroDeFlores'
import { montarMuroBaixoDePedra } from './muroBaixoDePedra'
import { montarTocoDeArvore } from './tocoDeArvore'
import { montarCarrinhoDeMao } from './carrinhoDeMao'
import { montarPlacaDeLoja } from './placaDeLoja'
import { montarCruzDeMadeira } from './cruzDeMadeira'
import { montarAnjoDePedra } from './anjoDePedra'
import { montarCercaDeFerro } from './cercaDeFerro'
import { montarPaCravada } from './paCravada'
import { montarVelasEOferendas } from './velasEOferendas'
import { montarArvoreSeca } from './arvoreSeca'
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
  // Troncos e feno (29/10/2026): a forma (toras ou lenha; fardos ou monte) chega na `variante`, como a dos pratos.
  troncos: montarTroncos,
  feno: montarFeno,
  // O chafariz (02/11/2026): a forma (redondo, quadrado) e a água (ligada, desligada) chegam na `variante`.
  chafariz: montarChafariz,
  // Os objetos de vento (02/11/2026): só a base; as pás em pé giram na camada animada (`pixi/pasDoVento.ts`).
  cataVento: montarCataVento,
  moinho: montarMoinho,
  cataVentoBrinquedo: montarCataVentoBrinquedo,
  // A ponte (03/11/2026): madeira, pedra ou corda (a forma é a variante).
  ponte: montarPonte,
  // O cemitério (07/11/2026): no Desenhado sai a arte do estúdio; este é o desenho do Atual.
  // A cova tem três versões (fresca, antiga, com pedras): a versão é a variante.
  cova: montarCova,
  caixao: montarCaixao,
  caixaoAberto: montarCaixaoAberto,
  // Destroços, sucata e o campinho (10/11/2026): cada sucata é um desenho próprio, não uma variante.
  destrocosDeMadeira: montarDestrocosDeMadeira,
  sucataChapas: montarSucataDeChapas,
  sucataEngrenagens: montarSucataDeEngrenagens,
  sucataTambores: montarSucataDeTambores,
  campinho: montarCampinho,
  // Lote 1 dos 95 objetos novos (11/11/2026): um desenho por arquivo. O pilar e o altar leem o `giro` (o
  // quarto de volta que a 3/4 pinta); a estante lê a `variante` (a arrumação dos livros), que hoje é sempre 0.
  bonecoDeTreino: montarBonecoDeTreino,
  pilar: montarPilar,
  altar: montarAltar,
  estanteDeLivros: montarEstanteDeLivros,
  sacosDeGrao: montarSacosDeGrao,
  bancoDePraca: montarBancoDePraca,
  escombrosDePedra: montarEscombrosDePedra,
  canhao: montarCanhao,
  // Lote 2 dos 95 objetos novos (11/11/2026): um desenho por arquivo. O caldeirão, o forno de pão, a estátua
  // e o mausoléu leem o `giro` (o quarto de volta que a 3/4 pinta). No forno de pão o fogo aceso ou apagado
  // chega na `variante`, como na lareira; a prateleira lê a `variante` (os tons da carga), que hoje é sempre 0.
  guardaRoupa: montarGuardaRoupa,
  caldeirao: montarCaldeirao,
  fornoDePao: montarFornoDePao,
  prateleiraDeDeposito: montarPrateleiraDeDeposito,
  estatua: montarEstatua,
  pedrasERochas: montarPedrasERochas,
  mausoleu: montarMausoleu,
  alvoDeArcoEFlecha: montarAlvoDeArcoEFlecha,
  // Lote 3 dos 95 objetos novos (11/11/2026): um desenho por arquivo. O toldo listrado, a pedra de amolar, o
  // suporte de armas, os ossos e a antena parabólica leem o `giro` (o quarto de volta que a 3/4 pinta).
  bancaDeFrutas: montarBancaDeFrutas,
  toldoListrado: montarToldoListrado,
  bancadaDeFerramentas: montarBancadaDeFerramentas,
  pedraDeAmolar: montarPedraDeAmolar,
  suporteDeArmas: montarSuporteDeArmas,
  espantalho: montarEspantalho,
  cocho: montarCocho,
  ossos: montarOssos,
  antenaParabolica: montarAntenaParabolica,
  // Lote 4 dos 95 objetos novos (11/11/2026): um desenho por arquivo. A cama de casal, a banqueta, o biombo e
  // o candelabro de chão leem o `giro` (o quarto de volta que a 3/4 pinta); de cima ele chega 0 a todos, e
  // quem gira é a imagem pronta (com o giro, a sombra pintada da banqueta e a do biombo sairiam viradas).
  escrivaninha: montarEscrivaninha,
  criadoMudo: montarCriadoMudo,
  camaDeCasal: montarCamaDeCasal,
  berco: montarBerco,
  banqueta: montarBanqueta,
  biombo: montarBiombo,
  piano: montarPiano,
  candelabroDeChao: montarCandelabroDeChao,
  // Lote 5 dos 95 objetos novos (11/11/2026), a cozinha e o banheiro: um desenho por arquivo. A tina de
  // madeira, a prateleira de potes, a mesa de corte e o gancho com carne leem o `giro` (o quarto de volta que a
  // 3/4 pinta); a banheira e o lavatório, não (girados, a 3/4 os deriva sozinha).
  banheira: montarBanheira,
  tinaDeMadeira: montarTinaDeMadeira,
  lavatorioComJarro: montarLavatorioComJarro,
  prateleiraDePotes: montarPrateleiraDePotes,
  mesaDeCorte: montarMesaDeCorte,
  ganchoComCarne: montarGanchoComCarne,
  // Lote 6 dos 95 objetos novos (11/11/2026), a armazenagem: um desenho por arquivo. Os barris deitados e o
  // tonel dividem um ajudante (`pipaDeitada.ts`, como o `fogoDeCasa.ts` da lareira, da fornalha, do forno de
  // pão e do caldeirão), que não é objeto e não entra aqui. Os barris deitados, o tonel, as ânforas e o cofre leem o `giro` (o quarto de volta
  // que a 3/4 pinta); a pilha de caixas e o cesto, não.
  pilhaDeCaixas: montarPilhaDeCaixas,
  barrisDeitados: montarBarrisDeitados,
  tonelDeAdega: montarTonelDeAdega,
  anforasDeBarro: montarAnforasDeBarro,
  cestoDeVime: montarCestoDeVime,
  cofre: montarCofre,
  // Lote 7 dos 95 objetos novos (11/11/2026), a rua e o jardim: um desenho por arquivo. O varal de roupa, a
  // horta, o canteiro de flores, o muro baixo de pedra e a placa de loja leem o `giro` (o quarto de volta que a
  // 3/4 pinta); o toco e o carrinho, não. O muro estica pelos controles de sempre e é reto: não lê a `curva`.
  varalDeRoupa: montarVaralDeRoupa,
  horta: montarHorta,
  canteiroDeFlores: montarCanteiroDeFlores,
  muroBaixoDePedra: montarMuroBaixoDePedra,
  tocoDeArvore: montarTocoDeArvore,
  carrinhoDeMao: montarCarrinhoDeMao,
  placaDeLoja: montarPlacaDeLoja,
  // Lote 8 dos 95 objetos novos (11/11/2026), o cemitério: um desenho por arquivo. A cerca de ferro e as velas e
  // oferendas leem o `giro` (o quarto de volta que a 3/4 pinta); a cruz, o anjo, a pá e a árvore seca, não. A
  // cerca de ferro é um trecho reto que reparte as barras pelo comprimento: não lê a `curva`.
  cruzDeMadeira: montarCruzDeMadeira,
  anjoDePedra: montarAnjoDePedra,
  cercaDeFerro: montarCercaDeFerro,
  paCravada: montarPaCravada,
  velasEOferendas: montarVelasEOferendas,
  arvoreSeca: montarArvoreSeca,
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
  'troncos', 'feno',
  'chafariz',
  'cataVento', 'moinho', 'cataVentoBrinquedo',
  'ponte',
  'cova', 'caixao', 'caixaoAberto',
  'destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho',
  'bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao',
  'guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha',
  'bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica',
  'escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao',
  'banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne',
  'pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre',
  'varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja',
  'cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca',
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
  /** Só na lápide: o desenho (0, 1 ou 2), do hash do id do objeto (`varianteDaLapide`). Nos pratos, a forma (`varianteDosPratos`); nos troncos e no feno, a forma (`varianteDaPilha`). */
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
