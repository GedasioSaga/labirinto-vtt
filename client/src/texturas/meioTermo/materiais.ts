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
  // Lote 6 dos 95 objetos novos (11/11/2026), a armazenagem. O primeiro lugar vai na "Cor"; o segundo, na "Cor
  // da linha". Os barris deitados e o tonel têm os lugares do barril: a madeira das aduelas, do cavalete e da
  // caneca dos barris, e a das aduelas, dos berços e da escadinha (mais clara) do tonel; os aros e a cinta da
  // caneca. As listras do pano do cesto saem do pano escolhido. As ferragens do cofre levam junto o espelho da
  // fechadura, a plaqueta, a seta do segredo e a cabeça do pino da dobradiça; os rebites, as cantoneiras e as
  // dobradiças são do metal do cofre, num tom mais claro. Fixos: a corda, a tinta do estêncil e os ilhoses da
  // pilha de caixas; o latão das torneiras e a espuma dos barris (um objeto só guarda duas cores); o latão da
  // torneira, a cortiça do batoque e o giz do tonel; o barro, o engobe da faixa, o óxido do zigue-zague, a
  // cortiça, o pano cru e a corda das ânforas (como nos sacos de grão, nenhum lugar); o vime e as maçãs do
  // cesto; a ferrugem das chapas do cofre.
  pilhaDeCaixas: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho'), lugar('lona', 'Lona', TECIDOS, 'linho')],
  barrisDeitados: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  tonelDeAdega: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  anforasDeBarro: [],
  cestoDeVime: [lugar('pano', 'Pano', TECIDOS, 'linho')],
  cofre: [lugar('metal', 'Cofre', METAIS, 'ferro'), lugar('ferragens', 'Roda e alavanca', METAIS, 'latao')],
  // Lote 7 dos 95 objetos novos (11/11/2026), a rua e o jardim. O primeiro lugar vai na "Cor"; o segundo, na
  // "Cor da linha". O pano do varal é só o pano listrado de franja (as listras são de linho cru; no pano de
  // linho, de vinho, como no toldo listrado). A madeira da horta vale para as tábuas, as estacas de canto, a
  // estaca do tomateiro e o cabo da pá. O toco tem o lugar dos troncos e do cocho: o cerne do corte sai da casca
  // escolhida. Fixos: a corda, os pregadores, a camisa, o lençol e a calça do varal; a terra, as verduras, o
  // tomateiro, o zinco e a água do regador e o ferro da pá da horta; a terra, as folhas, as flores e as
  // borboletas do canteiro; o musgo e o líquen do muro; o musgo e os cogumelos do toco; o ferro e as abóboras
  // do carrinho; o ferro forjado, as pedras do calço e a pintura da tabuleta da placa.
  varalDeRoupa: [lugar('madeira', 'Postes', MADEIRAS, 'carvalho'), lugar('pano', 'Pano listrado', TECIDOS, 'vinho')],
  horta: [lugar('madeira', 'Tábuas', MADEIRAS, 'carvalho')],
  canteiroDeFlores: [lugar('pedras', 'Pedras', PEDRAS, 'granito')],
  muroBaixoDePedra: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  tocoDeArvore: [lugar('lenha', 'Madeira', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  carrinhoDeMao: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  placaDeLoja: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  // Lote 8 dos 95 objetos novos (11/11/2026), o cemitério. O primeiro lugar vai na "Cor"; o segundo, na "Cor da
  // linha". A madeira da cruz pinta o poste e a travessa; a da árvore seca é pintada como casca fendida em toda a
  // copa e nas raízes (a lasca do galho quebrado mostra o miolo no veio dela). A pedra do anjo pinta a figura e o
  // pedestal, com as manchas de chuva. O metal da pá vale para a lâmina e para o lampião apagado no pé dela. O
  // escuro das velas sai do pano escolhido. Fixos: a amarra de corda, a coroa de flores, a terra, as pedras e o
  // capim da cruz; o musgo e o líquen do anjo; a ferrugem, o líquen dos pilaretes e o capim da cerca; a terra, os
  // torrões, o vidro e o toco de vela da pá; a cera, as chamas, a tigela com água, o pão, as moedas, as flores e
  // a renda das velas; o corvo e o miolo podre do oco da árvore.
  cruzDeMadeira: [lugar('madeira', 'Madeira', MADEIRAS, 'velha')],
  anjoDePedra: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  cercaDeFerro: [lugar('grade', 'Grade', METAIS, 'ferro'), lugar('pedra', 'Pilaretes', PEDRAS, 'granito')],
  paCravada: [lugar('madeira', 'Cabo', MADEIRAS, 'velha'), lugar('metal', 'Lâmina e lampião', METAIS, 'ferro')],
  velasEOferendas: [lugar('pano', 'Pano', TECIDOS, 'vinho')],
  arvoreSeca: [lugar('madeira', 'Madeira', MADEIRAS, 'velha')],
  // Lote 9 dos 95 objetos novos (11/11/2026), a feira. O primeiro lugar vai na "Cor"; o segundo, na "Cor da
  // linha". A madeira da balança vale para o caixote e o pé torneado da coluna, e o pano dela é a faixa que
  // corre de trás para a frente e cai pela beira; a da tenda, para as quatro estacas e o mastro; a da gaiola,
  // para as ripas, a moldura, o teto, o cocho e a bandeja da gaiolinha; a dos rolos, para a mesa, e o pano
  // deles é o pano desenrolado (o rolo dele, o que corre na mesa, o que cai da beira e o monte no chão); a do
  // palco, para o tablado, o degrau, os postes, a trave e o banquinho. O barril de peixe tem os lugares do
  // barril. Fixos: o latão da balança e das correntes, os pesos de bronze, o saco de estopa com o tempero, as
  // moedas e o galão; o pano roxo e anil com as estrelas e luas de ocre, o forro das abas, o escuro de dentro,
  // o tapete, a toalha da mesinha, as cartas, a flâmula, a corda e o latão do mastro da tenda; a palha, o
  // arame, o milho, as aves e as penas da gaiola; os outros panos, o caixote de pinho, a fita de medir e a
  // tesoura dos rolos; o alaúde, as bandeirolas, o chapéu, a pena e as moedas do palco; a salmoura, os peixes,
  // o sal, o puçá e os respingos do barril de peixe.
  balancaDeMercador: [lugar('madeira', 'Caixote', MADEIRAS, 'nogueira'), lugar('pano', 'Pano', TECIDOS, 'vinho')],
  tendaDeAdivinha: [lugar('madeira', 'Estacas', MADEIRAS, 'pinho')],
  gaiolaComAves: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  rolosDeTecido: [lugar('madeira', 'Mesa', MADEIRAS, 'nogueira'), lugar('pano', 'Pano', TECIDOS, 'azul')],
  palcoDeBardo: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho'), lugar('cortina', 'Cortina', TECIDOS, 'vinho')],
  barrilDePeixe: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  // Lote 10 dos 95 objetos novos (11/11/2026), a oficina e a fazenda. O primeiro lugar vai na "Cor"; o segundo,
  // na "Cor da linha". A madeira do fole vale para as tábuas, a cabeça, a alavanca e o cavalete; a do manequim,
  // para o poste, a travessa e a base; o metal da pilha de lingotes pinta as barras de ferro (o latão daria uma
  // pilha de bronze) e a madeira dela, o estrado; a madeira da serra vale para os cavaletes, as duas tábuas e os
  // cabos do traçador, e a lenha dela é a casca da tora (os cortes saem dela, com os cernes de `troncos.ts`); a
  // do galinheiro, para a casinha, o telhado e a rampa; a da colmeia, só para o banco; a do arado, para o timão,
  // o balancim, as rabiças e a travessa. O toco com machado tem o lugar dos troncos, do cocho e do toco de
  // árvore: o cepo, as achas e os cavacos saem da lenha escolhida. Fixos: o couro, o ferro do bico, das cintas e
  // da corrente e o latão das tachas do fole; o aço da armadura, o couro das correias e do cinto, o latão das
  // fivelas e o escudo do manequim; o cobre da fileira da frente e o estanho das duas barras claras da pilha (a
  // tabela não tem nenhum dos dois); o aço da lâmina, o ferro das virolas e a serragem da serra; as varas da
  // cerca, a terra, as galinhas, o ninho e o prato do galinheiro; a palha, a cana, o favo, o mel e as abelhas da
  // colmeia; o ferro, o aço da aiveca e a terra (a da horta) do arado; a cabeça e o cabo do machado. A plantação
  // não tem lugar: a terra arada e o milho são fixos.
  fole: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  manequimComArmadura: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  pilhaDeLingotes: [lugar('metal', 'Lingotes', METAIS, 'ferro'), lugar('madeira', 'Estrado', MADEIRAS, 'pinho')],
  serra: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho'), lugar('lenha', 'Tora', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  galinheiro: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  colmeia: [lugar('madeira', 'Banco', MADEIRAS, 'carvalho')],
  arado: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  tocoComMachado: [lugar('lenha', 'Madeira', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  plantacaoEmFileiras: [],
  // Lote 11 dos 95 objetos novos (11/11/2026), os destroços e o esporte. A carroça quebrada e o barril quebrado
  // têm os lugares dos pais (`carroca` e `barril`): a madeira da carroça vale para a caçamba, os varais, a
  // travessa, as tábuas soltas, as rodas e o caixote, e os aros, para o aro das duas rodas e o ferro do eixo; a
  // madeira do barril, para as aduelas, o fundo e as metades da tampa, e os aros, para o aro torto e os dois
  // soltos. A madeira da viga vale para a viga e a trave (a nogueira é a madeira de telhado). A da mesa de jogo,
  // para a mesa e os dois banquinhos. No balanço, a madeira são os assentos e a lenha (a da fogueira e dos
  // troncos), a casca dos troncos dos cavaletes e da trave. No ringue, a madeira vale para o tablado, a
  // passarela, o friso, os postes, o banquinho e o balde, e a lona, para o pano do meio (o círculo pintado troca
  // de tinta sozinho: vermelho-terra na lona clara, creme na escura). Na mesa de sinuca, a madeira vale para a
  // moldura, a saia, o friso e os pés. Fixos: o linho dos sacos, o grão, as couves e os pregos da carroça; o
  // vinho derramado do barril; as telhas, o pó e o ferro das cavilhas da viga; o tabuleiro, as pedras, as
  // cartas, os dados, as moedas e as canecas da mesa de jogo; as cordas e a terra batida do balanço; a corda de
  // cânhamo, as almofadas, a toalha, a água, a esponja e o ferro do ringue; o pano verde, as tabelas, o couro
  // das caçapas, as bolas, os tacos e o giz da sinuca. A armadura enferrujada não tem lugar: o aço, a ferrugem,
  // o couro das correias e o capim são fixos.
  carrocaQuebrada: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('aros', 'Aros', METAIS, 'ferro')],
  barrilQuebrado: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('aros', 'Aros', METAIS, 'ferro')],
  vigaCaida: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  armaduraEnferrujada: [],
  mesaDeJogo: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  ringueDeLuta: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('lona', 'Lona', TECIDOS, 'linho')],
  balanco: [lugar('madeira', 'Assentos', MADEIRAS, 'carvalho'), lugar('lenha', 'Troncos', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
  mesaDeSinuca: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  // Lote 12 dos 95 objetos novos (11/11/2026), o porto e o navio. Na âncora a madeira é só o cepo; no timão, a
  // roda e o pedestal, e as ferragens, a cinta do aro com os parafusos, a tampa do cubo e o botão do eixo; no
  // bote, o casco; na rede de pesca, as estacas e a vara; no píer, o tabuado; no caixote de peixe, o caixote.
  // Fixos: o ferro, a ferrugem, as cracas e a corrente da âncora (de latão, uma âncora comida de ferrugem não
  // faria sentido); o cânhamo, o cabo alcatroado, a falcaça e o ferro do cabeço das cordas enroladas, que não têm
  // lugar; o cabo da pinha do timão; o ferro, os remos, o couro, a água e a corda do bote; o fio, a cortiça, o
  // chumbo, a boia de vidro e os peixes da rede; a água, os pregos, o cunho e as amarras do píer; os peixes, o
  // caranguejo, o sal, as algas e a faca do caixote.
  ancora: [lugar('madeira', 'Cepo', MADEIRAS, 'carvalho')],
  cordasEnroladas: [],
  timao: [lugar('madeira', 'Madeira', MADEIRAS, 'cerejeira'), lugar('ferragens', 'Ferragens', METAIS, 'latao')],
  bote: [lugar('madeira', 'Casco', MADEIRAS, 'carvalho')],
  redeDePesca: [lugar('madeira', 'Estacas e vara', MADEIRAS, 'pinho')],
  pier: [lugar('madeira', 'Tabuado', MADEIRAS, 'velha')],
  caixoteDePeixe: [lugar('madeira', 'Caixote', MADEIRAS, 'pinho')],
  // Lote 15 (11/11/2026). A armadura despedaçada não tem lugar: o aço, o couro, o latão, o escudo e o pó são
  // fixos. Na armadura de pé, a pedra é a do pedestal (o desenho lê `c.m.pedra`); o aço, o latão e a pluma são
  // fixos.
  armaduraDespedacada: [],
  armadura: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  // Lotes 13 e 16 dos 95 objetos novos (11/11/2026), o templo e a masmorra. No braseiro o metal é a bacia e o
  // tripé (de latão fica um braseiro de templo); na cela, o ferro da grade, da porta e da argola do chão, e o
  // piso, as lajes de dentro (de ardósia fica um chão escuro de masmorra); na corrente, a placa, os elos, os
  // grilhões e o cadeado; na armadilha, a pedra da moldura e da soleira, e o metal dos espinhos. Fixos: o
  // carvão, a brasa, a cinza e o fogo do braseiro; a palha, a madeira da tigela, o mingau e o rejunte da cela; o
  // chumbo e a chave de latão da corrente; a ferrugem, o escuro dos furos e o reflexo dos espinhos. O círculo
  // mágico (o giz azul pálido) e os três blocos de inscrições (a pedra, o ouro e os sulcos de cada cor) não têm
  // lugar.
  braseiro: [lugar('metal', 'Braseiro', METAIS, 'ferro')],
  celaComGrade: [lugar('grade', 'Grade', METAIS, 'ferro'), lugar('piso', 'Piso', PEDRAS, 'granito')],
  corrente: [lugar('metal', 'Corrente', METAIS, 'ferro')],
  armadilhaDeEspinhos: [lugar('pedra', 'Pedra', PEDRAS, 'granito'), lugar('metal', 'Espinhos', METAIS, 'ferro')],
  circuloMagico: [],
  blocoDeInscricoesAzul: [],
  blocoDeInscricoesVermelho: [],
  blocoDeInscricoesDourado: [],
  // Lote 14 dos objetos novos (11/11/2026), a sala de tortura. No potro e no tronco, a madeira do quadro e das
  // pranchas e as ferragens (cintas, cantoneiras, dobradiça, ferrolho); na dama de ferro, o ferro do corpo e a
  // pedra do plinto; na gaiola suspensa, a madeira do poste, do braço e da cruz; na cadeira de interrogatório, a
  // dos postes, dos braços e do assento; na mesa de instrumentos, a do tampo e das pernas. Fixos: a corda e o
  // couro do potro; o ferro, a corrente e o cadeado da gaiola; a chapa, as cintas e as algemas da cadeira; o
  // couro, o ferro dos instrumentos, a corda e a ampulheta da mesa. O sangue no chão não tem lugar.
  potroDeTortura: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('ferragens', 'Ferragens', METAIS, 'ferro')],
  damaDeFerro: [lugar('metal', 'Ferro', METAIS, 'ferro'), lugar('pedra', 'Plinto', PEDRAS, 'granito')],
  troncoDePrisioneiro: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('ferragens', 'Ferragens', METAIS, 'ferro')],
  gaiolaSuspensa: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  cadeiraDeInterrogatorio: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  mesaDeInstrumentos: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  sangueNoChao: [],
  // Os três últimos do lote 13 (11/11/2026), a magia e a alquimia: a madeira da estante de poções (como a
  // estante de livros) e a pedra do pedestal (como o pilar). Fixos: os vidros, os líquidos, o barro e o latão da
  // estante; o couro, as folhas, a fita, o latão e a corrente do livro. A bola de cristal não tem lugar: o veludo
  // (o pano da tenda de adivinha), o latão do suporte, o quartzo do pêndulo e o vidro são fixos.
  estanteDePocoes: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  bolaDeCristal: [],
  pedestalComLivro: [lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  // Lote 17 dos objetos novos (12/11/2026). O tesouro não tem lugar: o ouro, as pedras, as pérolas e o brilho
  // são cor fixa (a tabela não tem ouro nem pedra preciosa). A teia de aranha (o fio, o pó e os casulos) e o
  // crânio (o osso dos ossos) também não. Na tocha de parede, o metal da chapa, do braço e da argola e a madeira
  // do cabo; na tocha de pé, o metal do tripé, da haste e do cesto; fixos: o pano com óleo, a brasa e a fuligem.
  // Na tenda, a lona (as águas, as empenas, a fita da cumeeira e as abas) e a madeira dos mastros e das estacas;
  // fixos: a corda, a esteira, a manta e o escuro de dentro. Na torre de pedra, a pedra das fiadas, do parapeito
  // e do rodapé e a madeira da porta, do alçapão e do mastro; fixos: as cintas e a argola de ferro do alçapão e
  // a bandeira vinho. Na
  // torre de vigia, a madeira dos esteios, do assoalho e da escada e o telhado, de palha (o desenho) ou de tábua
  // de uma das madeiras; fixos: a pedra das sapatas, a água e a corneta.
  barraDeOuro: [],
  monteDeOuro: [],
  moedaDeOuro: [],
  monteDeMoedasDeOuro: [],
  diamante: [],
  monteDeDiamantes: [],
  joia: [],
  monteDeJoias: [],
  teiaDeAranha: [],
  tochaDeParede: [lugar('metal', 'Metal', METAIS, 'ferro'), lugar('madeira', 'Cabo', MADEIRAS, 'carvalho')],
  tochaDePe: [lugar('metal', 'Metal', METAIS, 'ferro')],
  cranio: [],
  tenda: [lugar('lona', 'Lona', TECIDOS, 'linho'), lugar('madeira', 'Mastros e estacas', MADEIRAS, 'nogueira')],
  torreDePedra: [lugar('pedra', 'Pedra', PEDRAS, 'granito'), lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  torreDeVigia: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('telhado', 'Telhado', ['palha', ...MADEIRAS], 'palha')],
  // Lote L01 de 14/11/2026, o castelo, na ordem das fichas (o primeiro lugar vai na "Cor", o segundo na "Cor da
  // linha"). O pano do estandarte é a cor trocável do pedido, por isso vem primeiro. O escudo da panóplia é um
  // tecido da tabela pintado como madeira em tábuas. Fixos: o rubi do trono; o lençol e os travesseiros da cama;
  // o aço das lâminas e o couro dos cabos da panóplia; a cera, o pavio e as chamas do lustre.
  tronoReal: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('almofada', 'Almofada', TECIDOS, 'vinho'), lugar('metal', 'Metal', METAIS, 'latao')],
  camaDeDossel: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('cortina', 'Cortina', TECIDOS, 'vinho'), lugar('cobertor', 'Colcha', TECIDOS, 'ocre')],
  estandarteDePe: [lugar('pano', 'Pano', TECIDOS, 'azul'), lugar('metal', 'Metal', METAIS, 'latao'), lugar('madeira', 'Mastro', MADEIRAS, 'nogueira')],
  tapecariaDeParede: [lugar('pano', 'Pano', TECIDOS, 'vinho'), lugar('metal', 'Fio e metal', METAIS, 'latao'), lugar('madeira', 'Vara', MADEIRAS, 'nogueira')],
  lustreDeVelas: [lugar('metal', 'Metal', METAIS, 'ferro')],
  panoplia: [lugar('escudo', 'Escudo', TECIDOS, 'azul'), lugar('metal', 'Metal', METAIS, 'latao')],
  // Lote L02 de 14/11/2026, o resto do castelo, na ordem das fichas (a ponte levadiça fica no fim, na ordem da lista
  // do dia). O caminho de mesa do banquete é a chave `toalha`, como a da banheira; as almofadas dos genuflexórios da
  // capela, a chave `estofado`. Fixos: o bordado, os pratos, as taças e a comida do banquete; o livro de orações da
  // capela; o mapa, as peças, o compasso e a adaga da mesa de guerra; o falcão e a corda do poleiro; o couro, o latão,
  // as hastes e as penas das aljavas, que não trocam nada.
  mesaDeBanquete: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('toalha', 'Caminho de mesa', TECIDOS, 'vinho')],
  bancosDeCapela: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira'), lugar('estofado', 'Almofadas', TECIDOS, 'vinho')],
  mesaDeGuerra: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  poleiroDeFalcao: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  aljavasEFlechas: [],
  // Lote L03 de 14/11/2026, o cerco e a defesa: os quatro só deixam trocar a madeira. Fixos: o ferro, a corda, o
  // couro, o pano, a pedra da concha e o virote. A escada de cerco sai de pinho (o claro destaca a escada fina no
  // chão de terra a 1x); as outras três, de carvalho.
  catapulta: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  balista: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  arieteComTeto: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  escadaDeCerco: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  // Lote L04 de 14/11/2026. Fixos: a casca das estacas, as pontas cruas e as cintas do cavalo de frisa; as balas e as
  // cantoneiras da pilha; o óleo, as bolhas e a fumaça do tacho; a amarra, a poeira e a costura dos sacos. Os sacos
  // de areia só vêm nos tecidos de saco (vinho e azul não fazem sentido). As caixas de munição (o verde-oliva que o
  // mestre pediu, como os sacos de grão) e o ouriço (o aço) não trocam nada.
  cavaloDeFrisa: [lugar('madeira', 'Viga', MADEIRAS, 'carvalho')],
  pilhaDeBalasDeCanhao: [lugar('madeira', 'Quadro', MADEIRAS, 'carvalho')],
  tachoDeOleoQuente: [lugar('metal', 'Tacho', METAIS, 'ferro'), lugar('madeira', 'Postes', MADEIRAS, 'carvalho')],
  sacosDeAreia: [lugar('pano', 'Sacos', ['ocre', 'musgo', 'linho'], 'ocre')],
  caixasDeMunicao: [],
  ouricoAntitanque: [],
  // Lote L05 de 14/11/2026. O arame, a barreira, a cancela e o armário têm as cores fixas do aço, do concreto, da
  // vara vermelha e branca e da tinta oliva. O beliche troca a estrutura (metal ou madeira: com metal, tubos; com
  // madeira, postes), o cobertor e o travesseiro, como a cama; o lençol é fixo. O rádio de campanha só troca o tampo da
  // mesa; o rádio, os fones, o papel e a caneca são fixos.
  arameFarpado: [],
  barreiraDeConcreto: [],
  cancelaListrada: [],
  beliche: [lugar('estrutura', 'Estrutura', [...METAIS, ...MADEIRAS], 'ferro'), lugar('cobertor', 'Cobertor', TECIDOS, 'musgo'), lugar('travesseiro', 'Travesseiro', TECIDOS, 'linho')],
  armarioDeFerro: [],
  radioDeCampanha: [lugar('madeira', 'Tampo', MADEIRAS, 'pinho')],
  // Lote L06 de 14/11/2026. O holofote, a metralhadora e o gerador têm as cores fixas da tinta oliva, do aço e da
  // borracha. A rede de camuflagem e os paletes só trocam a madeira (as varas e as estacas; as tábuas); a rede tem
  // as manchas fixas. O mastro com bandeira troca o pano, o mastro (madeira ou metal: o desenho pinta qualquer
  // material, e o desenhista conferiu o de ferro) e a pedra dos degraus; o botão do topo é dourado fixo.
  holofote: [],
  redeDeCamuflagem: [lugar('madeira', 'Varas e estacas', MADEIRAS, 'pinho')],
  metralhadoraNoTripe: [],
  paletesDeMadeira: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  gerador: [],
  mastroComBandeira: [lugar('bandeira', 'Bandeira', TECIDOS, 'vinho'), lugar('mastro', 'Mastro', [...MADEIRAS, ...METAIS], 'carvalho'), lugar('pedra', 'Pedra', PEDRAS, 'granito')],
  // Lote L07 de 14/11/2026, o mar e os piratas. Os três caracóis não trocam nada: a casca, a pele e o fone são as
  // cores que dizem qual versão é. A fruta de espirais troca a cor da casca (qualquer tecido; o cabo e a folha são
  // fixos). O cartaz, a bandeira, a mesa de navegação e a laranjeira só trocam a madeira (o poste, o mastro, a mesa,
  // o canteiro); o papel, o pano preto, a carta, o latão, a folhagem e as laranjas são fixos.
  caracolTelefone: [],
  caracolTelefoneCamera: [],
  caracolTelefoneDourado: [],
  cartazDeProcurado: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  frutaDeEspirais: [lugar('fruta', 'Fruta', TECIDOS, 'vinho')],
  bandeiraPirata: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho')],
  mesaDeNavegacao: [lugar('madeira', 'Madeira', MADEIRAS, 'nogueira')],
  laranjeiraEmCanteiro: [lugar('madeira', 'Madeira', MADEIRAS, 'pinho')],
  // A ponte levadiça (lote L02, item 81 da lista do dia): as ferragens valem para as cintas, os rebites, as chapas, as
  // dobradiças, as pontas do eixo e as correntes.
  ponteLevadica: [lugar('madeira', 'Madeira', MADEIRAS, 'carvalho'), lugar('ferragens', 'Ferragens', METAIS, 'ferro')],
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
