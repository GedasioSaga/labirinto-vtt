/**
 * MATERIAIS dos móveis no lugar da cor livre (tabela de
 * `docs/design/objetos/README.md:44-58`, decisão do usuário de 20/10/2026).
 *
 * Cada material tem dois tons:
 * - `hex`: o tom OFICIAL do protótipo de objetos (linha 58 do README). É o
 *   que o painel grava nos campos de cor que já existem (`mobiliaCor`,
 *   `mobiliaCorDaLinha`, os 3 da cama), sem campo novo no arquivo;
 * - `tom`: o mesmo material na paleta do Meio-Termo, mais claro e quente
 *   (tabela TROCA de `docs/design/vila-meio-termo/prototipo/meio.js:153-158`).
 *   É o que o desenho pinta.
 *
 * Mapa antigo guarda cor livre: `materialMaisPerto` troca a cor pelo material
 * de `hex` mais perto em OKLab DENTRO da lista do lugar (madeira, aros,
 * cobertor...). Assim o mapa migra no desenho e o arquivo não é regravado.
 */
import type { TipoMobilia } from '../../lib/mobilia/tipos'
import { PALETA_MEIO_TERMO, type TokenDaPaleta } from './paleta'

export type ClasseDoMaterial = 'madeira' | 'metal' | 'tecido' | 'pedra' | 'palha' | 'corda' | 'casca' | 'folha'

export type IdDoMaterial =
  | 'carvalho' | 'nogueira' | 'pinho' | 'cerejeira' | 'velha'
  | 'ferro' | 'latao' | 'arame'
  | 'linho' | 'vinho' | 'azul' | 'musgo' | 'ocre'
  | 'granito' | 'arenito' | 'ardosia' | 'barro'
  | 'palha' | 'corda'
  | 'lenhaCarvalho' | 'lenhaPinho' | 'lenhaBetula'
  | 'buxo' | 'alfeneiro'

/** Opções que usam a madeira do próprio móvel: o assento "Madeira" da cadeira e as "Varas" da cerca. Não têm cor própria. */
export type ReferenciaAMadeira = 'mesma' | 'varas'

export type OpcaoDeMaterial = IdDoMaterial | ReferenciaAMadeira

export interface Material {
  readonly id: IdDoMaterial
  readonly nome: string
  readonly classe: ClasseDoMaterial
  /** Tom oficial (`#rrggbb`), o que vai para o arquivo. */
  readonly hex: string
  /** Tom do Meio-Termo (`#rrggbb`), o que o desenho pinta. */
  readonly tom: string
}

const COR_HEX = /^#[0-9a-f]{6}$/i

function hexDoRgb(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

function canalDoHex(hex: string, posicao: 0 | 1 | 2): number {
  return parseInt(hex.slice(1 + posicao * 2, 3 + posicao * 2), 16)
}

/** A cor da paleta do Meio-Termo com a luz multiplicada por `fator`, como `corDe` em `meio.js:164`. */
export function tomDoMeio(token: TokenDaPaleta, fator: number): string {
  const base = PALETA_MEIO_TERMO[token].base
  const canal = (posicao: 0 | 1 | 2): number => Math.min(255, Math.max(0, Math.round(canalDoHex(base, posicao) * fator)))
  return hexDoRgb(canal(0), canal(1), canal(2))
}

function material(id: IdDoMaterial, nome: string, classe: ClasseDoMaterial, hex: string, token: TokenDaPaleta, fator: number): Material {
  return { id, nome, classe, hex, tom: tomDoMeio(token, fator) }
}

/**
 * Tom PRÓPRIO do material no móvel, fora da regra "token x fator": a cerejeira
 * como nogueira x 1,12 saía igual à nogueira (diferença OKLab 0,025 a 0,035) e
 * a lã azul como a telha azul saturava demais. Revisão de design da MT2.
 */
const TOM_DA_CEREJEIRA = '#926149'
const TOM_DA_LA_AZUL = '#4b648e'
/** Barro do vaso: a terracota (#b56e50) saturava 0,56 antes da textura; este fica em 0,46. */
const TOM_DO_BARRO = '#a8735a'
/** Folhas da sebe (MT5): o buxo é o verde escuro da vila mais calmo; o alfeneiro, o claro. */
const TOM_DO_BUXO = '#557f57'
const TOM_DO_ALFENEIRO = '#74955c'

/**
 * Carvalho e madeira velha no MÓVEL ficam mais escuros que o token da vila
 * (que segue como está): com o tom do token, a mesa de carvalho (L 0,603) e a
 * velha (0,592) sumiam no chão do app (L 0,615).
 */
const LUZ_DO_CARVALHO_NO_MOVEL = 0.91
const LUZ_DA_VELHA_NO_MOVEL = 0.78

function materialDeTomProprio(id: IdDoMaterial, nome: string, classe: ClasseDoMaterial, hex: string, tom: string): Material {
  return { id, nome, classe, hex, tom }
}

export const MATERIAIS: Readonly<Record<IdDoMaterial, Material>> = {
  carvalho: material('carvalho', 'Carvalho', 'madeira', '#8b6b47', 'carvalho', LUZ_DO_CARVALHO_NO_MOVEL),
  nogueira: material('nogueira', 'Nogueira', 'madeira', '#5f4532', 'nogueira', 1),
  pinho: material('pinho', 'Pinho', 'madeira', '#a3875f', 'pinho', 1),
  cerejeira: materialDeTomProprio('cerejeira', 'Cerejeira', 'madeira', '#7c4b37', TOM_DA_CEREJEIRA),
  velha: material('velha', 'Madeira velha', 'madeira', '#7b776e', 'granito', LUZ_DA_VELHA_NO_MOVEL),
  ferro: material('ferro', 'Ferro', 'metal', '#4c4e51', 'ferro', 1),
  latao: material('latao', 'Latão', 'metal', '#9c8044', 'latao', 1),
  arame: material('arame', 'Arame', 'metal', '#56585b', 'ferro', 1.05),
  linho: material('linho', 'Linho cru', 'tecido', '#c1b59c', 'linho', 1),
  vinho: material('vinho', 'Lã vinho', 'tecido', '#6d3337', 'vinho', 1),
  azul: materialDeTomProprio('azul', 'Lã azul', 'tecido', '#41526a', TOM_DA_LA_AZUL),
  musgo: material('musgo', 'Lã musgo', 'tecido', '#5a6344', 'musgo', 1),
  ocre: material('ocre', 'Lã ocre', 'tecido', '#977842', 'ocre', 1),
  granito: material('granito', 'Granito', 'pedra', '#7e7b76', 'granito', 1),
  arenito: material('arenito', 'Arenito', 'pedra', '#9a8669', 'pinho', 0.95),
  ardosia: material('ardosia', 'Ardósia', 'pedra', '#585d61', 'ardosia', 1),
  // O vaso de planta (MT4): o barro do protótipo da vila (#8a5a46) é o oficial; o tom
  // pintado é a telha de terracota do Meio-Termo mais clara e menos viva.
  barro: materialDeTomProprio('barro', 'Barro', 'pedra', '#8a5a46', TOM_DO_BARRO),
  palha: material('palha', 'Palha', 'palha', '#b0995f', 'palha', 1),
  corda: material('corda', 'Corda', 'corda', '#a08a62', 'corda', 1),
  lenhaCarvalho: material('lenhaCarvalho', 'Carvalho', 'casca', '#55453a', 'lenha', 1),
  lenhaPinho: material('lenhaPinho', 'Pinho', 'casca', '#6c4c3a', 'lenha', 1.1),
  lenhaBetula: material('lenhaBetula', 'Bétula', 'casca', '#cbc4b4', 'linho', 1),
  // As folhas da sebe (MT5). O verde da vila (#55ae74, #469a63) dá saturação HSV 0,51 a 0,55
  // antes da sombra; estes tons ficam em 0,35 e 0,40, contidos como o resto do mapa.
  buxo: materialDeTomProprio('buxo', 'Buxo', 'folha', '#3d5e40', TOM_DO_BUXO),
  alfeneiro: materialDeTomProprio('alfeneiro', 'Alfeneiro', 'folha', '#5a7a48', TOM_DO_ALFENEIRO),
}

/** A opção é um material com cor própria (e não a madeira do móvel)? */
export function ehMaterial(opcao: OpcaoDeMaterial): opcao is IdDoMaterial {
  return opcao !== 'mesma' && opcao !== 'varas'
}

/** Um lugar de material num móvel (a madeira, os aros, o cobertor...), com as opções e o padrão. */
export interface LugarDeMaterial {
  readonly id: string
  readonly nome: string
  readonly opcoes: readonly OpcaoDeMaterial[]
  readonly padrao: OpcaoDeMaterial
}

const MADEIRAS: readonly OpcaoDeMaterial[] = ['carvalho', 'nogueira', 'pinho', 'cerejeira', 'velha']
const METAIS: readonly OpcaoDeMaterial[] = ['ferro', 'latao']
const TECIDOS: readonly OpcaoDeMaterial[] = ['linho', 'vinho', 'azul', 'musgo', 'ocre']
const PEDRAS: readonly OpcaoDeMaterial[] = ['granito', 'arenito', 'ardosia']

function lugar(id: string, nome: string, opcoes: readonly OpcaoDeMaterial[], padrao: OpcaoDeMaterial): LugarDeMaterial {
  return { id, nome, opcoes, padrao }
}

/** Os lugares de material de cada móvel (a cama tem as 3 cores de hoje: madeira, cobertor e travesseiro). */
export const LUGARES_DE_MATERIAL: Readonly<Record<TipoMobilia, readonly LugarDeMaterial[]>> = {
  barril: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  caixa: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  bau: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('ferragens', 'Ferragens', METAIS, 'latao')],
  catre: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('cobertor', 'Cobertor', TECIDOS, 'vinho'), lugar('travesseiro', 'Travesseiro', TECIDOS, 'linho')],
  mesa: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  cadeira: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('assento', 'Assento', ['mesma', 'palha'], 'palha')],
  cerca: [lugar('madeira', 'Mourões', MADEIRAS, 'carvalho'), lugar('ligacao', 'Entre os mourões', ['varas', 'corda', 'arame'], 'varas')],
  armario: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho'), lugar('puxadores', 'Puxadores', METAIS, 'ferro')],
  aparador: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('puxadores', 'Puxadores', METAIS, 'latao')],
  fogueira: [lugar('pedras', 'Pedras', ['granito', 'arenito', 'ardosia'], 'granito'), lugar('lenha', 'Lenha', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  tapete: [lugar('tecido', 'Tecido', TECIDOS, 'azul')],
  // Peças novas do lote 1 (MT4). O primeiro lugar vai na "Cor" do arquivo; o segundo, na "Cor da linha".
  mesaQuadrada: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  mesaRedonda: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  lapide: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  vaso: [lugar('vaso', 'Vaso', ['barro', 'arenito', 'granito'], 'barro')],
  lampiao: [lugar('metal', 'Metal', METAIS, 'ferro')],
  quadroDeAvisos: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  poco: [lugar('pedras', 'Pedras', PEDRAS, 'granito'), lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  barraca: [lugar('toldo', 'Toldo', TECIDOS, 'vinho'), lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  carroca: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('aros', 'Aros', METAIS, 'ferro')],
  // Lote 2 (MT5). As flores da sebe e da jardineira são fixas (tons contidos da vila).
  sebe: [lugar('folhas', 'Folhas', ['buxo', 'alfeneiro'], 'buxo')],
  jardineira: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  arcoDoPortao: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('placa', 'Placa', MADEIRAS, 'pinho')],
  placaDeSeta: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  tapeteLongo: [lugar('tecido', 'Tecido', TECIDOS, 'vinho')],
  // Objeto Fogo: sem material (o chão queimado e as brasas têm cor própria, como a chama da fogueira).
  fogo: [],
  // Móveis de casa (28/10/2026). O primeiro lugar vai na "Cor"; o segundo, na "Cor da linha".
  fogao: [lugar('metal', 'Corpo', METAIS, 'ferro'), lugar('puxadores', 'Puxadores', METAIS, 'latao')],
  geladeira: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('ferragens', 'Ferragens', METAIS, 'latao')],
  pia: [lugar('pedra', 'Pedra', PEDRAS, 'granito'), lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  balcao: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('barra', 'Barra de pé', METAIS, 'latao')],
  // A mesa posta: a louça, a comida e a caneca têm cor própria (como as flores da jardineira); o que muda é a forma.
  pratos: [],
  privada: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('ferragens', 'Puxador', METAIS, 'latao')],
  sofa: [lugar('tecido', 'Estofado', TECIDOS, 'vinho'), lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  poltrona: [lugar('tecido', 'Estofado', TECIDOS, 'vinho'), lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  // Lareira e oficina (29/10/2026). A brasa, a cinza, a lenha da lareira e o couro do fole são fixos.
  lareira: [lugar('pedra', 'Pedra', PEDRAS, 'arenito'), lugar('madeira', 'Consolo', MADEIRAS, 'nogueira')],
  fornalha: [lugar('pedra', 'Pedra', PEDRAS, 'granito'), lugar('madeira', 'Fole', MADEIRAS, 'carvalho')],
  bigorna: [lugar('metal', 'Bigorna', METAIS, 'ferro'), lugar('madeira', 'Toco', MADEIRAS, 'carvalho')],
  balde: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  // Troncos e feno (29/10/2026). Os troncos têm a madeira da lenha da fogueira (a casca; o corte com os
  // anéis sai dela). O feno é a palha e a corda, fixas: um tom só, contido, sem escolha que não muda nada.
  troncos: [lugar('lenha', 'Madeira', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  feno: [],
  // O chafariz (02/11/2026): a pedra da bacia, da coluna e do prato, no arenito claro da praça (a água
  // azul-petróleo lê melhor sobre a pedra clara). A água é fixa, a mesma do poço e do balde.
  chafariz: [lugar('pedra', 'Pedra', PEDRAS, 'arenito')],
  // Os objetos de vento (02/11/2026): a madeira da torre (fazenda), a pedra e o telhado (moinho). As pás
  // em pé (a roda, as velas, o papel) têm cor própria, contida, como a água do chafariz.
  cataVento: [lugar('madeira', 'Torre', MADEIRAS, 'velha')],
  moinho: [lugar('pedra', 'Paredes', PEDRAS, 'arenito'), lugar('madeira', 'Telhado', MADEIRAS, 'nogueira')],
  cataVentoBrinquedo: [],
  // A ponte (03/11/2026): a madeira das tábuas, do corrimão e dos postes (Madeira e Corda) e a pedra do arco e
  // da mureta (Pedra). O painel mostra só o lugar da forma escolhida (`lib/mobilia/ponte.ts`); a corda é fixa.
  ponte: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  // O cemitério (07/11/2026), nos lugares da arte do estúdio (`godot/desenhado/exportado/movel-*`, que o
  // raster confere): a cova é terra de cor própria; o caixão fechado tem a madeira e as alças; no aberto as
  // alças e o forro são fixos.
  cova: [],
  caixao: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('ferragens', 'Alças', METAIS, 'ferro')],
  caixaoAberto: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  // Destroços e sucata (10/11/2026). Os destroços têm a madeira das tábuas (o carvalho, de partida: a velha,
  // cinza, ao lado da sucata lia como ferro); a quebra lascada sai dela, puxada para o cerne claro. O metal
  // das sucatas, a ferrugem e a tinta gasta dos tambores são fixos: escolher "latão" numa pilha de
  // ferro-velho não mudaria nada que se leia.
  destrocosDeMadeira: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  sucataChapas: [],
  sucataEngrenagens: [],
  sucataTambores: [],
  // O campinho (10/11/2026): o gramado, a terra batida, a cal das linhas e as traves têm cor própria.
  campinho: [],
  // Lote 1 dos 95 objetos novos (11/11/2026). O primeiro lugar vai na "Cor"; o segundo, na "Cor da linha".
  // Fixos: a palha, a corda e o saco do boneco; no altar, o latão dos castiçais e da tigela, a cera, a água e
  // a barra ocre do pano; as capas, os filetes e as folhas dos livros da estante; o pano cru, a corda e o
  // grão dos sacos (como no feno); a argamassa e o pó dos escombros (saem da pedra escolhida); as ferragens,
  // a corda e as balas do canhão (o cano de latão lê como canhão de bronze).
  bonecoDeTreino: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  pilar: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  altar: [lugar('pedra', 'Pedra', PEDRAS, 'granito'), lugar('pano', 'Pano', TECIDOS, 'vinho')],
  estanteDeLivros: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  sacosDeGrao: [],
  bancoDePraca: [lugar('madeira', 'Ripas', MADEIRAS, 'carvalho'), lugar('ferragens', 'Pés e braços', METAIS, 'ferro')],
  escombrosDePedra: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  canhao: [lugar('metal', 'Cano', METAIS, 'ferro'), lugar('madeira', 'Carreta', MADEIRAS, 'carvalho')],
  // Lote 2 dos 95 objetos novos (11/11/2026). O primeiro lugar vai na "Cor"; o segundo, na "Cor da linha".
  // Os puxadores do guarda-roupa levam junto as dobradiças e o espelho da fechadura. Fixos: no caldeirão, a
  // lenha, a cinza, a brasa, o caldo, os legumes e a concha (o latão dá um caldeirão de cobre); no forno, o
  // barro da cúpula, o tijolo, a fuligem, a lenha e os pães; a carga da prateleira (o pinho dos caixotes, o
  // barro, a estopa, a corda); o musgo e o líquen das pedras; a palha, a tinta dos anéis, a corda e as
  // flechas do alvo. A porta do mausoléu é de metal: de latão, lê como porta de bronze.
  guardaRoupa: [lugar('madeira', 'Madeira', MADEIRAS, 'cerejeira'), lugar('puxadores', 'Puxadores', METAIS, 'latao')],
  caldeirao: [lugar('metal', 'Caldeirão', METAIS, 'ferro'), lugar('pedras', 'Pedras', PEDRAS, 'granito')],
  fornoDePao: [lugar('pedra', 'Soleira', PEDRAS, 'granito'), lugar('madeira', 'Pá e tábua', MADEIRAS, 'pinho')],
  prateleiraDeDeposito: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  estatua: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  pedrasERochas: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  mausoleu: [lugar('pedra', 'Pedra', PEDRAS, 'granito'), lugar('porta', 'Porta', METAIS, 'ferro')],
  alvoDeArcoEFlecha: [lugar('madeira', 'Cavalete', MADEIRAS, 'carvalho')],
  // Lote 3 dos 95 objetos novos (11/11/2026). O primeiro lugar vai na "Cor"; o segundo, na "Cor da linha".
  // Fixos: na banca, o pinho dos caixotes, as frutas e verduras e a balança; as listras do toldo (de linho
  // cru, ou de vinho no toldo de linho, a regra da barraca), a corda e o latão dos ilhoses; o ferro das
  // ferramentas e da morsa da bancada e os cabos (trocam de madeira sozinhos, para não sumir no tampo); o
  // ferro e a água da pedra de amolar; o aço, o latão, o couro, as hastes e a pintura do escudo do suporte; a
  // palha, os panos, a corda e o corvo do espantalho; a água, a palha e o molhado do cocho (a casca é a dos
  // troncos, e o cerne lavrado sai dela). Os ossos e a antena não têm lugar: não existe osso na tabela, e o
  // alumínio da tela, o aço do mastro, o concreto e o cabo são fixos.
  bancaDeFrutas: [lugar('madeira', 'Mesa', MADEIRAS, 'carvalho')],
  toldoListrado: [lugar('toldo', 'Toldo', TECIDOS, 'vinho'), lugar('madeira', 'Estacas', MADEIRAS, 'pinho')],
  bancadaDeFerramentas: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  pedraDeAmolar: [lugar('pedra', 'Roda', PEDRAS, 'granito'), lugar('madeira', 'Cavalete', MADEIRAS, 'carvalho')],
  suporteDeArmas: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  espantalho: [lugar('madeira', 'Poste', MADEIRAS, 'nogueira')],
  cocho: [lugar('lenha', 'Madeira', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  ossos: [],
  antenaParabolica: [],
  // Lote 4 dos 95 objetos novos (11/11/2026). O primeiro lugar vai na "Cor"; o segundo, na "Cor da linha". A
  // cama de casal tem os três lugares da cama de solteiro, com os mesmos ids e na mesma ordem, e guarda o
  // cobertor (a colcha) e o travesseiro nos campos próprios dela (`ehCama` em `lib/mobilia.ts`). Fixos: na
  // escrivaninha, o couro verde do forro e o filete dourado, o papel, a tinta, a pena, o lacre e o castiçal;
  // no criado-mudo, o pires de latão, a cera, a chama e o halo e os livros; o lençol da cama e o do berço (o
  // `LENCOL` de `contexto.ts`), as listras cruas da manta e o coelho de pano; no biombo, o latão das
  // dobradiças e a linha do bordado (sai do próprio pano); no piano, o marfim e o ébano das teclas, o feltro,
  // o latão, a cera e a partitura; a cera, o pavio, as chamas e os halos do candelabro.
  escrivaninha: [lugar('madeira', 'Madeira', MADEIRAS, 'cerejeira'), lugar('puxadores', 'Puxadores', METAIS, 'latao')],
  criadoMudo: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('puxadores', 'Puxador', METAIS, 'latao')],
  camaDeCasal: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('cobertor', 'Cobertor', TECIDOS, 'azul'), lugar('travesseiro', 'Travesseiro', TECIDOS, 'linho')],
  berco: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('manta', 'Manta', TECIDOS, 'azul')],
  banqueta: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  biombo: [lugar('madeira', 'Moldura', MADEIRAS, 'nogueira'), lugar('pano', 'Pano', TECIDOS, 'linho')],
  piano: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('assento', 'Assento', TECIDOS, 'vinho')],
  candelabroDeChao: [lugar('metal', 'Metal', METAIS, 'ferro')],
  // Lote 5 dos 95 objetos novos (11/11/2026), a cozinha e o banheiro. O primeiro lugar vai na "Cor"; o
  // segundo, na "Cor da linha". Os metais da banheira são a torneira, as cruzetas, a correntinha e os pés; a
  // madeira da tina é a das aduelas e a do banquinho (os mesmos lugares do barril e do balde). Fixos: a louça,
  // a água, a espuma, o sabão e o tampão da banheira; o pano de linho, a água, o vapor e a escova da tina (um
  // objeto só guarda duas cores, e o pano não virou lugar); a louça com o filete azul, a água, o sabão e o
  // latão da barra do lavatório; o vidro, o barro, os panos, as conservas, o barbante, o ferro do varão, as
  // ervas e o alho da prateleira de potes; o aço, o ferro, o latão dos rebites, o peixe, os legumes e o pano
  // da mesa de corte (os cabos trocam de madeira sozinhos, para não sumir no tampo); o ferro dos ganchos, a
  // corda e as carnes do gancho.
  banheira: [lugar('metais', 'Metais', METAIS, 'latao'), lugar('toalha', 'Toalha', TECIDOS, 'vinho')],
  tinaDeMadeira: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  lavatorioComJarro: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('toalha', 'Toalha', TECIDOS, 'azul')],
  prateleiraDePotes: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  mesaDeCorte: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  ganchoComCarne: [lugar('madeira', 'Armação', MADEIRAS, 'carvalho')],
}

/** [L, a, b] do OKLab: L de 0 (preto) a 1 (branco). */
export type Oklab = readonly [number, number, number]

function linearDoCanal(c8: number): number {
  const u = c8 / 255
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
}

/** OKLab (Björn Ottosson, 2020) de um `#rrggbb` válido. */
export function oklabDoHex(hex: string): Oklab {
  return oklabDoRgb(canalDoHex(hex, 0), canalDoHex(hex, 1), canalDoHex(hex, 2))
}

/** OKLab de uma cor sRGB de 8 bits por canal. */
export function oklabDoRgb(r8: number, g8: number, b8: number): Oklab {
  const r = linearDoCanal(r8)
  const g = linearDoCanal(g8)
  const b = linearDoCanal(b8)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const oklabDosMateriais = new Map<IdDoMaterial, Oklab>()

function oklabDoMaterial(id: IdDoMaterial): Oklab {
  const pronto = oklabDosMateriais.get(id)
  if (pronto !== undefined) return pronto
  const calculado = oklabDoHex(MATERIAIS[id].hex)
  oklabDosMateriais.set(id, calculado)
  return calculado
}

/**
 * O material do lugar mais perto da cor, em OKLab (distância euclidiana),
 * comparando com o tom OFICIAL de cada opção. Cor ausente ou que não é
 * `#rrggbb` vira o padrão do lugar. As opções sem cor própria (`mesma`,
 * `varas`) não entram na conta. Empate: vale a primeira da lista.
 */
export function materialMaisPerto(cor: string | undefined, lugarDoMaterial: LugarDeMaterial): OpcaoDeMaterial {
  if (cor === undefined || !COR_HEX.test(cor)) return lugarDoMaterial.padrao
  const [L, a, b] = oklabDoHex(cor.toLowerCase())
  let melhor: OpcaoDeMaterial = lugarDoMaterial.padrao
  let menorDistancia = Infinity
  for (const opcao of lugarDoMaterial.opcoes) {
    if (!ehMaterial(opcao)) continue
    const [Lm, am, bm] = oklabDoMaterial(opcao)
    const distancia = (L - Lm) ** 2 + (a - am) ** 2 + (b - bm) ** 2
    if (distancia < menorDistancia) {
      menorDistancia = distancia
      melhor = opcao
    }
  }
  return melhor
}
