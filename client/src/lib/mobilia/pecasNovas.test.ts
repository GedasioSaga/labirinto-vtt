import { describe, expect, it } from 'vitest'
import { aceitaVista, criarMovel, ehMovelRedondo, ehTipoMobilia, movelComOutraVista, NOME_COM_ARTIGO, ROTULO_MOBILIA, TIPOS_MOBILIA, tracosDoGlifo } from '../mobilia'
import { TIPOS_COM_TEXTURA } from '../../texturas/meioTermo/moveis'
import { acharObjetos, GRUPOS_DE_OBJETO, grupoDoObjeto } from './gruposDoObjeto'
import { ehPecaNova, PECAS_NOVAS, TIPOS_DA_CONSTRUCAO, TIPOS_DO_OBJETO, TIPOS_NO_CATALOGO, varianteDaLapide } from './pecasNovas'
import type { TipoMobilia } from './tipos'

/**
 * Registro das PEÇAS NOVAS do lote 1 (MT4): tamanho padrão em casas (o do
 * plano), nome e artigo da setinha, vista de lado só na barraca e na carroça,
 * silhueta redonda na mesa redonda, e o catálogo do painel, que só oferece a
 * peça cujo desenho já existe (nada de botão com rascunho).
 */
const GRADE = 50

const TAMANHOS: Readonly<Record<string, readonly [number, number]>> = {
  mesaQuadrada: [1, 1],
  mesaRedonda: [1.25, 1.25],
  lapide: [0.6, 0.35],
  vaso: [0.5, 0.5],
  lampiao: [0.5, 0.5],
  quadroDeAvisos: [1, 0.4],
  poco: [1.5, 1.5],
  barraca: [2, 2],
  carroca: [2, 1.25],
  sebe: [2, 0.5],
  jardineira: [1, 0.5],
  arcoDoPortao: [2, 0.5],
  placaDeSeta: [0.5, 0.5],
  tapeteLongo: [1, 4],
  // Objeto Fogo (27/10/2026): nasce na Chama; Fogaréu e Incêndio são escolhas do painel.
  fogo: [1, 1],
  // Móveis de casa (28/10/2026).
  fogao: [1, 1],
  geladeira: [1, 0.75],
  pia: [1, 0.6],
  balcao: [2, 0.6],
  pratos: [0.5, 0.5],
  privada: [0.5, 0.6],
  sofa: [2, 1],
  poltrona: [1, 1],
  // Lareira e oficina (29/10/2026).
  lareira: [2, 1],
  fornalha: [1.5, 1.5],
  bigorna: [1, 0.5],
  balde: [0.5, 0.5],
  // Troncos e feno (29/10/2026).
  troncos: [2, 1],
  feno: [1.5, 1],
  // Chafariz (02/11/2026): as duas formas nascem em 2 x 2.
  chafariz: [2, 2],
  // Objetos de vento (02/11/2026): a pegada é a base; as pás em pé passam dela.
  cataVento: [1, 1],
  moinho: [2, 2],
  cataVentoBrinquedo: [0.5, 0.5],
  // Ponte (03/11/2026): 4 casas de comprimento por 1 de largura, nas três formas.
  ponte: [4, 1],
  // Cemitério (07/11/2026): a cova e os dois caixões, 1 casa de largura por 2 de comprimento.
  cova: [1, 2],
  caixao: [1, 2],
  caixaoAberto: [1, 2],
  // Destroços e sucata (10/11/2026): as pilhas grandes em 2 x 2, a de engrenagens em 1 x 1.
  destrocosDeMadeira: [2, 2],
  sucataChapas: [2, 2],
  sucataEngrenagens: [1, 1],
  sucataTambores: [2, 2],
  // Campinho de futebol (10/11/2026): 10 casas de comprimento por 6 de largura.
  campinho: [10, 6],
  // Lote 1 dos 95 objetos novos (11/11/2026).
  bonecoDeTreino: [1, 1],
  pilar: [1, 1],
  altar: [2, 1],
  estanteDeLivros: [2, 0.5],
  sacosDeGrao: [1, 1],
  bancoDePraca: [2, 0.7],
  escombrosDePedra: [2, 2],
  canhao: [2, 1],
  // Lote 2 dos 95 objetos novos (11/11/2026).
  guardaRoupa: [1.5, 0.6],
  caldeirao: [1, 1],
  fornoDePao: [2, 2],
  prateleiraDeDeposito: [2, 0.6],
  estatua: [1, 1],
  pedrasERochas: [2, 1.5],
  mausoleu: [3, 4],
  alvoDeArcoEFlecha: [1, 1],
  // Lote 3 dos 95 objetos novos (11/11/2026).
  bancaDeFrutas: [2, 1],
  toldoListrado: [2, 2],
  bancadaDeFerramentas: [2, 1],
  pedraDeAmolar: [1, 1],
  suporteDeArmas: [2, 0.6],
  espantalho: [1, 1],
  cocho: [2, 0.7],
  ossos: [1.5, 1],
  antenaParabolica: [2, 2],
  // Lote 4 dos 95 objetos novos (11/11/2026).
  escrivaninha: [1.5, 0.8],
  criadoMudo: [0.6, 0.6],
  camaDeCasal: [2, 2],
  berco: [1, 0.7],
  banqueta: [0.5, 0.5],
  biombo: [2, 0.6],
  piano: [1.5, 1],
  candelabroDeChao: [0.6, 0.6],
  // Lote 5 dos 95 objetos novos (11/11/2026).
  banheira: [2, 1],
  tinaDeMadeira: [1.5, 1.5],
  lavatorioComJarro: [1, 0.6],
  prateleiraDePotes: [1.5, 0.4],
  mesaDeCorte: [1.5, 1],
  ganchoComCarne: [1.5, 0.5],
  // Lote 6 dos 95 objetos novos (11/11/2026).
  pilhaDeCaixas: [1.5, 1.5],
  barrisDeitados: [2, 1],
  tonelDeAdega: [2, 3],
  anforasDeBarro: [1, 1],
  cestoDeVime: [0.7, 0.7],
  cofre: [1, 1],
  // Lote 7 dos 95 objetos novos (11/11/2026).
  varalDeRoupa: [2, 0.5],
  horta: [2, 1.5],
  canteiroDeFlores: [1.5, 1],
  muroBaixoDePedra: [2, 0.5],
  tocoDeArvore: [1, 1],
  carrinhoDeMao: [1.5, 0.7],
  placaDeLoja: [1, 0.5],
  // Lote 8 dos 95 objetos novos (11/11/2026).
  cruzDeMadeira: [0.6, 0.6],
  anjoDePedra: [1, 1],
  cercaDeFerro: [2, 0.3],
  paCravada: [0.8, 0.8],
  velasEOferendas: [0.8, 0.8],
  arvoreSeca: [2, 2],
  // Lote 9 dos 95 objetos novos (11/11/2026).
  balancaDeMercador: [1, 0.7],
  tendaDeAdivinha: [2, 2],
  gaiolaComAves: [1, 1],
  rolosDeTecido: [1.5, 1],
  palcoDeBardo: [3, 2],
  barrilDePeixe: [1, 1],
  // Lote 10 dos 95 objetos novos (11/11/2026).
  fole: [1.5, 0.7],
  manequimComArmadura: [1, 1],
  pilhaDeLingotes: [1, 0.7],
  serra: [2, 1],
  galinheiro: [2, 1.5],
  colmeia: [0.8, 0.8],
  arado: [2, 1],
  tocoComMachado: [1, 1],
  plantacaoEmFileiras: [4, 3],
  // Lote 11 dos 95 objetos novos (11/11/2026).
  carrocaQuebrada: [2, 1.5],
  barrilQuebrado: [1, 1],
  vigaCaida: [2, 1],
  armaduraEnferrujada: [1.5, 1],
  mesaDeJogo: [1.5, 1.5],
  ringueDeLuta: [3, 3],
  balanco: [2, 1],
  mesaDeSinuca: [2, 1],
  // Lote 12 dos 95 objetos novos (11/11/2026) e o lote 15, as duas armaduras.
  ancora: [1.5, 1],
  cordasEnroladas: [1, 1],
  timao: [1, 1],
  bote: [3, 1.5],
  redeDePesca: [2, 1],
  pier: [2, 3],
  caixoteDePeixe: [1, 0.7],
  armaduraDespedacada: [1.5, 1],
  armadura: [1, 1],
  // Lotes 13 e 16 dos 95 objetos novos (11/11/2026), o templo e a masmorra.
  braseiro: [0.8, 0.8],
  celaComGrade: [2, 2],
  corrente: [1, 1],
  armadilhaDeEspinhos: [1, 1],
  circuloMagico: [2, 2],
  blocoDeInscricoesAzul: [2, 2],
  blocoDeInscricoesVermelho: [2, 2],
  blocoDeInscricoesDourado: [2, 2],
  // Lote 14 dos objetos novos (11/11/2026), a sala de tortura, e os três últimos do lote 13, a magia e a alquimia.
  potroDeTortura: [2, 1],
  damaDeFerro: [1, 1],
  troncoDePrisioneiro: [1.5, 0.5],
  gaiolaSuspensa: [1, 1],
  cadeiraDeInterrogatorio: [1, 1],
  mesaDeInstrumentos: [1.5, 0.8],
  sangueNoChao: [1.5, 1],
  estanteDePocoes: [1.5, 0.5],
  bolaDeCristal: [1, 1],
  pedestalComLivro: [0.8, 0.8],
  // Lote 17 dos objetos novos (12/11/2026): o tesouro, a teia, as tochas, o crânio, a tenda e as torres.
  barraDeOuro: [0.6, 0.3],
  monteDeOuro: [1.5, 1],
  moedaDeOuro: [0.4, 0.4],
  monteDeMoedasDeOuro: [1.5, 1],
  diamante: [0.5, 0.5],
  monteDeDiamantes: [1.5, 1],
  joia: [0.5, 0.5],
  monteDeJoias: [1.5, 1],
  teiaDeAranha: [1, 1],
  tochaDeParede: [0.4, 0.5],
  tochaDePe: [0.6, 0.6],
  cranio: [0.5, 0.5],
  tenda: [2, 2.5],
  torreDePedra: [3, 3],
  torreDeVigia: [2, 2],
  tronoReal: [1.2, 1.2],
  camaDeDossel: [2.2, 2.6],
  estandarteDePe: [0.8, 1.8],
  tapecariaDeParede: [1, 1.6],
  lustreDeVelas: [1.2, 1.2],
  panoplia: [1, 1],
  mesaDeBanquete: [3, 1],
  bancosDeCapela: [2, 2],
  mesaDeGuerra: [2, 1.5],
  poleiroDeFalcao: [1, 1],
  aljavasEFlechas: [1, 1],
  catapulta: [3, 2],
  balista: [2, 2],
  arieteComTeto: [3, 2],
  escadaDeCerco: [4, 1],
  cavaloDeFrisa: [2, 1],
  pilhaDeBalasDeCanhao: [1, 1],
  tachoDeOleoQuente: [1.5, 1],
  sacosDeAreia: [2, 0.6],
  caixasDeMunicao: [1.5, 1],
  ouricoAntitanque: [1, 1],
  arameFarpado: [2, 0.5],
  barreiraDeConcreto: [2, 0.5],
  cancelaListrada: [3, 0.5],
  beliche: [1, 2],
  armarioDeFerro: [1, 0.5],
  radioDeCampanha: [1.5, 1],
  holofote: [1, 1],
  redeDeCamuflagem: [3, 2],
  metralhadoraNoTripe: [1.5, 1],
  paletesDeMadeira: [1, 1],
  gerador: [1.5, 1],
  mastroComBandeira: [1, 1],
  caracolTelefone: [0.6, 0.45],
  caracolTelefoneCamera: [0.6, 0.45],
  caracolTelefoneDourado: [0.6, 0.45],
  cartazDeProcurado: [0.6, 0.8],
  frutaDeEspirais: [0.45, 0.45],
  bandeiraPirata: [0.9, 0.9],
  mesaDeNavegacao: [1.5, 1],
  laranjeiraEmCanteiro: [1, 1],
  pratoDeCarne: [0.8, 0.6],
  pranchaDoNavio: [2, 0.5],
  esqueletoDePeixe: [3, 1.25],
  navioNaGarrafa: [1, 0.45],
  conchaMagica: [0.5, 0.4],
  lanternaDePedra: [0.9, 0.9],
  balcaoDeTaverna: [3, 1.6],
  alvoDeDardos: [1.3, 0.9],
  mesaDeQuedaDeBraco: [2.2, 1.1],
  varalDeBandeirinhas: [4, 0.6],
  varalDeLanternas: [4, 0.6],
  mastroDeFitas: [2.2, 2.2],
  caixaDeFogosDeArtificio: [1, 0.8],
  barracaDeJogosDaFeira: [2, 1.5],
  barracaDeEspetinho: [1.5, 1],
  churrasqueira: [1.5, 1],
  harpa: [0.8, 1],
  tambores: [1, 1],
  redeDeDormir: [3, 1],
  guardaSolComEspreguicadeira: [2, 2],
  toalhaDePiquenique: [1.6, 1.2],
  xadrezDeJardim: [3, 3],
  bolicheDeGrama: [1, 1],
  gangorra: [2.4, 0.6],
  escorregador: [2.5, 1],
  aquario: [1.2, 0.6],
  ofuro: [1.5, 1.5],
  telescopio: [1, 1],
  globoTerrestre: [0.8, 0.8],
  pebolim: [1.2, 0.9],
  arquibancadaDeTorneio: [3, 2],
  licaDeJusta: [4, 0.5],
  posteDeAmarrarCavalos: [2, 0.5],
  bueiro: [1, 1],
  relogioDeSol: [1, 1],
  sinoNoSuporte: [1.5, 1],
  tearDePedal: [1.4, 1.6],
  rocaDeFiar: [1.4, 1.2],
  lagarDeUva: [1.2, 1.4],
  moDePedra: [1, 1],
  liteira: [1, 2.2],
  ponteLevadica: [3, 2],
  portaoComGradeLevadica: [4, 2],
  torreDeCerco: [2, 2],
  estatuaEquestre: [2, 1],
  obelisco: [2, 2],
  forcaComCadafalso: [2, 2],
  torreDoSino: [2, 2],
  guarita: [2, 2],
  bunkerDeConcreto: [3, 3],
  conteiner: [4, 1.5],
  tendaMilitar: [3, 2],
  caixaDAguaElevada: [2, 2],
  torreDeRadio: [2, 2],
  tanqueDeCombustivel: [3, 2],
  farol: [2, 2],
  coreto: [3, 3],
  guindasteDePorto: [3, 2],
  posteComRelogio: [1, 1],
  quiosque: [2, 2],
  rodaDagua: [3, 2],
  pombal: [2, 2],
  baiaDeCavalo: [3, 2],
  siloDeGraos: [2, 2],
  chiqueiroCercado: [3, 2],
  carrossel: [3, 3],
  tendaDeCirco: [5, 4],
  rodaGigante: [4, 4],
  casaNaArvore: [3, 3],
  pergolaComTrepadeira: [3, 2],
  portalTorii: [3, 1],
}

const NOMES: Readonly<Record<string, readonly [string, string]>> = {
  mesaQuadrada: ['Mesa quadrada', 'uma mesa quadrada'],
  mesaRedonda: ['Mesa redonda', 'uma mesa redonda'],
  lapide: ['Lápide', 'uma lápide'],
  vaso: ['Vaso de planta', 'um vaso de planta'],
  lampiao: ['Lampião', 'um lampião'],
  quadroDeAvisos: ['Quadro de avisos', 'um quadro de avisos'],
  poco: ['Poço', 'um poço'],
  barraca: ['Barraca de feira', 'uma barraca de feira'],
  carroca: ['Carroça', 'uma carroça'],
  sebe: ['Sebe', 'uma sebe'],
  jardineira: ['Jardineira', 'uma jardineira'],
  arcoDoPortao: ['Arco do portão', 'um arco do portão'],
  placaDeSeta: ['Placa de seta', 'uma placa de seta'],
  tapeteLongo: ['Tapete longo', 'um tapete longo'],
  fogo: ['Fogo', 'um fogo'],
  fogao: ['Fogão', 'um fogão'],
  geladeira: ['Geladeira', 'uma geladeira'],
  pia: ['Pia', 'uma pia'],
  balcao: ['Balcão', 'um balcão'],
  pratos: ['Pratos', 'uns pratos'],
  privada: ['Privada', 'uma privada'],
  sofa: ['Sofá', 'um sofá'],
  poltrona: ['Poltrona', 'uma poltrona'],
  lareira: ['Lareira', 'uma lareira'],
  fornalha: ['Fornalha de ferreiro', 'uma fornalha de ferreiro'],
  bigorna: ['Bigorna', 'uma bigorna'],
  balde: ['Balde de água', 'um balde de água'],
  troncos: ['Troncos', 'uns troncos'],
  feno: ['Feno', 'feno'],
  chafariz: ['Chafariz', 'um chafariz'],
  cataVento: ['Cata-vento de fazenda', 'um cata-vento de fazenda'],
  moinho: ['Moinho de vento', 'um moinho de vento'],
  cataVentoBrinquedo: ['Cata-vento de brinquedo', 'um cata-vento de brinquedo'],
  ponte: ['Ponte', 'uma ponte'],
  cova: ['Cova', 'uma cova'],
  caixao: ['Caixão', 'um caixão'],
  caixaoAberto: ['Caixão aberto', 'um caixão aberto'],
  destrocosDeMadeira: ['Destroços de madeira', 'uns destroços de madeira'],
  sucataChapas: ['Sucata de metal: chapas', 'uma sucata de chapas'],
  sucataEngrenagens: ['Sucata de metal: engrenagens', 'uma sucata de engrenagens'],
  sucataTambores: ['Sucata de metal: tambores', 'uma sucata de tambores'],
  campinho: ['Campinho de futebol', 'um campinho de futebol'],
  bonecoDeTreino: ['Boneco de treino', 'um boneco de treino'],
  pilar: ['Pilar', 'um pilar'],
  altar: ['Altar', 'um altar'],
  estanteDeLivros: ['Estante de livros', 'uma estante de livros'],
  sacosDeGrao: ['Sacos de grão', 'uns sacos de grão'],
  bancoDePraca: ['Banco de praça', 'um banco de praça'],
  escombrosDePedra: ['Escombros de pedra', 'uns escombros de pedra'],
  canhao: ['Canhão', 'um canhão'],
  guardaRoupa: ['Guarda-roupa', 'um guarda-roupa'],
  caldeirao: ['Caldeirão', 'um caldeirão'],
  fornoDePao: ['Forno de pão', 'um forno de pão'],
  prateleiraDeDeposito: ['Prateleira de depósito', 'uma prateleira de depósito'],
  estatua: ['Estátua', 'uma estátua'],
  pedrasERochas: ['Pedras e rochas', 'umas pedras e rochas'],
  mausoleu: ['Mausoléu', 'um mausoléu'],
  alvoDeArcoEFlecha: ['Alvo de arco e flecha', 'um alvo de arco e flecha'],
  bancaDeFrutas: ['Banca de frutas', 'uma banca de frutas'],
  toldoListrado: ['Toldo listrado', 'um toldo listrado'],
  bancadaDeFerramentas: ['Bancada de ferramentas', 'uma bancada de ferramentas'],
  pedraDeAmolar: ['Pedra de amolar', 'uma pedra de amolar'],
  suporteDeArmas: ['Suporte de armas', 'um suporte de armas'],
  espantalho: ['Espantalho', 'um espantalho'],
  cocho: ['Cocho', 'um cocho'],
  ossos: ['Ossos', 'uns ossos'],
  antenaParabolica: ['Antena parabólica', 'uma antena parabólica'],
  escrivaninha: ['Escrivaninha', 'uma escrivaninha'],
  criadoMudo: ['Criado-mudo com vela', 'um criado-mudo com vela'],
  camaDeCasal: ['Cama de casal', 'uma cama de casal'],
  berco: ['Berço', 'um berço'],
  banqueta: ['Banqueta', 'uma banqueta'],
  biombo: ['Biombo', 'um biombo'],
  piano: ['Piano', 'um piano'],
  candelabroDeChao: ['Candelabro de chão', 'um candelabro de chão'],
  banheira: ['Banheira', 'uma banheira'],
  tinaDeMadeira: ['Tina de madeira', 'uma tina de madeira'],
  lavatorioComJarro: ['Lavatório com jarro', 'um lavatório com jarro'],
  prateleiraDePotes: ['Prateleira de potes', 'uma prateleira de potes'],
  mesaDeCorte: ['Mesa de corte', 'uma mesa de corte'],
  ganchoComCarne: ['Gancho com carne pendurada', 'um gancho com carne pendurada'],
  pilhaDeCaixas: ['Pilha de caixas', 'uma pilha de caixas'],
  barrisDeitados: ['Barris deitados', 'uns barris deitados'],
  tonelDeAdega: ['Tonel de adega', 'um tonel de adega'],
  anforasDeBarro: ['Ânforas de barro', 'umas ânforas de barro'],
  cestoDeVime: ['Cesto de vime', 'um cesto de vime'],
  cofre: ['Cofre', 'um cofre'],
  varalDeRoupa: ['Varal de roupa', 'um varal de roupa'],
  horta: ['Horta', 'uma horta'],
  canteiroDeFlores: ['Canteiro de flores', 'um canteiro de flores'],
  muroBaixoDePedra: ['Muro baixo de pedra', 'um muro baixo de pedra'],
  tocoDeArvore: ['Toco de árvore', 'um toco de árvore'],
  carrinhoDeMao: ['Carrinho de mão', 'um carrinho de mão'],
  placaDeLoja: ['Placa de loja pendurada', 'uma placa de loja pendurada'],
  cruzDeMadeira: ['Cruz de madeira', 'uma cruz de madeira'],
  anjoDePedra: ['Anjo de pedra', 'um anjo de pedra'],
  cercaDeFerro: ['Cerca de ferro', 'uma cerca de ferro'],
  paCravada: ['Pá cravada na terra', 'uma pá cravada na terra'],
  velasEOferendas: ['Velas e oferendas', 'umas velas e oferendas'],
  arvoreSeca: ['Árvore seca', 'uma árvore seca'],
  balancaDeMercador: ['Balança de mercador', 'uma balança de mercador'],
  tendaDeAdivinha: ['Tenda de adivinha', 'uma tenda de adivinha'],
  gaiolaComAves: ['Gaiola com aves', 'uma gaiola com aves'],
  rolosDeTecido: ['Rolos de tecido', 'uns rolos de tecido'],
  palcoDeBardo: ['Palco de bardo', 'um palco de bardo'],
  barrilDePeixe: ['Barril de peixe', 'um barril de peixe'],
  fole: ['Fole', 'um fole'],
  manequimComArmadura: ['Manequim com armadura', 'um manequim com armadura'],
  pilhaDeLingotes: ['Pilha de lingotes', 'uma pilha de lingotes'],
  serra: ['Serra', 'uma serra'],
  galinheiro: ['Galinheiro', 'um galinheiro'],
  colmeia: ['Colmeia', 'uma colmeia'],
  arado: ['Arado', 'um arado'],
  tocoComMachado: ['Toco com machado cravado', 'um toco com machado cravado'],
  plantacaoEmFileiras: ['Plantação em fileiras', 'uma plantação em fileiras'],
  carrocaQuebrada: ['Carroça quebrada', 'uma carroça quebrada'],
  barrilQuebrado: ['Barril quebrado', 'um barril quebrado'],
  vigaCaida: ['Viga caída', 'uma viga caída'],
  armaduraEnferrujada: ['Armadura enferrujada', 'uma armadura enferrujada'],
  mesaDeJogo: ['Mesa de jogo', 'uma mesa de jogo'],
  ringueDeLuta: ['Ringue de luta', 'um ringue de luta'],
  balanco: ['Balanço', 'um balanço'],
  mesaDeSinuca: ['Mesa de sinuca', 'uma mesa de sinuca'],
  ancora: ['Âncora', 'uma âncora'],
  cordasEnroladas: ['Cordas enroladas', 'umas cordas enroladas'],
  timao: ['Timão', 'um timão'],
  bote: ['Bote', 'um bote'],
  redeDePesca: ['Rede de pesca', 'uma rede de pesca'],
  pier: ['Píer', 'um píer'],
  caixoteDePeixe: ['Caixote de peixe', 'um caixote de peixe'],
  armaduraDespedacada: ['Armadura despedaçada', 'uma armadura despedaçada'],
  armadura: ['Armadura', 'uma armadura'],
  braseiro: ['Braseiro', 'um braseiro'],
  celaComGrade: ['Cela com grade', 'uma cela com grade'],
  corrente: ['Corrente', 'uma corrente'],
  armadilhaDeEspinhos: ['Armadilha de espinhos', 'uma armadilha de espinhos'],
  circuloMagico: ['Círculo mágico', 'um círculo mágico'],
  blocoDeInscricoesAzul: ['Bloco de inscrições azul', 'um bloco de inscrições azul'],
  blocoDeInscricoesVermelho: ['Bloco de inscrições vermelho', 'um bloco de inscrições vermelho'],
  blocoDeInscricoesDourado: ['Bloco de inscrições dourado', 'um bloco de inscrições dourado'],
  potroDeTortura: ['Potro de tortura', 'um potro de tortura'],
  damaDeFerro: ['Dama de ferro', 'uma dama de ferro'],
  troncoDePrisioneiro: ['Tronco de prisioneiro', 'um tronco de prisioneiro'],
  gaiolaSuspensa: ['Gaiola suspensa', 'uma gaiola suspensa'],
  cadeiraDeInterrogatorio: ['Cadeira de interrogatório', 'uma cadeira de interrogatório'],
  mesaDeInstrumentos: ['Mesa de instrumentos de tortura', 'uma mesa de instrumentos de tortura'],
  sangueNoChao: ['Sangue no chão', 'uma mancha de sangue no chão'],
  estanteDePocoes: ['Estante de poções', 'uma estante de poções'],
  bolaDeCristal: ['Bola de cristal', 'uma bola de cristal'],
  pedestalComLivro: ['Pedestal com livro aberto', 'um pedestal com livro aberto'],
  barraDeOuro: ['Barra de ouro', 'uma barra de ouro'],
  monteDeOuro: ['Monte de ouro', 'um monte de ouro'],
  moedaDeOuro: ['Moeda de ouro', 'uma moeda de ouro'],
  monteDeMoedasDeOuro: ['Monte de moedas de ouro', 'um monte de moedas de ouro'],
  diamante: ['Diamante', 'um diamante'],
  monteDeDiamantes: ['Monte de diamantes', 'um monte de diamantes'],
  joia: ['Joia', 'uma joia'],
  monteDeJoias: ['Monte de joias', 'um monte de joias'],
  teiaDeAranha: ['Teia de aranha', 'uma teia de aranha'],
  tochaDeParede: ['Tocha de parede', 'uma tocha de parede'],
  tochaDePe: ['Tocha de pé', 'uma tocha de pé'],
  cranio: ['Crânio', 'um crânio'],
  tenda: ['Tenda', 'uma tenda'],
  torreDePedra: ['Torre de pedra', 'uma torre de pedra'],
  torreDeVigia: ['Torre de vigia', 'uma torre de vigia'],
  tronoReal: ['Trono', 'um trono'],
  camaDeDossel: ['Cama de dossel', 'uma cama de dossel'],
  estandarteDePe: ['Estandarte de pé', 'um estandarte de pé'],
  tapecariaDeParede: ['Tapeçaria de parede', 'uma tapeçaria de parede'],
  lustreDeVelas: ['Lustre de velas', 'um lustre de velas'],
  panoplia: ['Panóplia', 'uma panóplia'],
  mesaDeBanquete: ['Mesa de banquete posta', 'uma mesa de banquete posta'],
  bancosDeCapela: ['Bancos de capela', 'uns bancos de capela'],
  mesaDeGuerra: ['Mesa de guerra', 'uma mesa de guerra'],
  poleiroDeFalcao: ['Poleiro de falcão', 'um poleiro de falcão'],
  aljavasEFlechas: ['Aljavas e feixes de flechas', 'umas aljavas e feixes de flechas'],
  catapulta: ['Catapulta', 'uma catapulta'],
  balista: ['Balista', 'uma balista'],
  arieteComTeto: ['Aríete com teto', 'um aríete com teto'],
  escadaDeCerco: ['Escada de cerco', 'uma escada de cerco'],
  cavaloDeFrisa: ['Cavalo de frisa', 'um cavalo de frisa'],
  pilhaDeBalasDeCanhao: ['Pilha de balas de canhão', 'uma pilha de balas de canhão'],
  tachoDeOleoQuente: ['Tacho de óleo quente', 'um tacho de óleo quente'],
  sacosDeAreia: ['Sacos de areia', 'uns sacos de areia'],
  caixasDeMunicao: ['Caixas de munição', 'umas caixas de munição'],
  ouricoAntitanque: ['Ouriço antitanque', 'um ouriço antitanque'],
  arameFarpado: ['Arame farpado em rolo', 'um arame farpado em rolo'],
  barreiraDeConcreto: ['Barreira de concreto', 'uma barreira de concreto'],
  cancelaListrada: ['Cancela listrada', 'uma cancela listrada'],
  beliche: ['Beliche', 'um beliche'],
  armarioDeFerro: ['Armário de ferro', 'um armário de ferro'],
  radioDeCampanha: ['Rádio de campanha', 'um rádio de campanha'],
  holofote: ['Holofote', 'um holofote'],
  redeDeCamuflagem: ['Rede de camuflagem', 'uma rede de camuflagem'],
  metralhadoraNoTripe: ['Metralhadora no tripé', 'uma metralhadora no tripé'],
  paletesDeMadeira: ['Paletes de madeira', 'uns paletes de madeira'],
  gerador: ['Gerador', 'um gerador'],
  mastroComBandeira: ['Mastro com bandeira', 'um mastro com bandeira'],
  caracolTelefone: ['Caracol-telefone', 'um caracol-telefone'],
  caracolTelefoneCamera: ['Caracol-câmera', 'um caracol-câmera'],
  caracolTelefoneDourado: ['Caracol-telefone dourado', 'um caracol-telefone dourado'],
  cartazDeProcurado: ['Cartaz de procurado', 'um cartaz de procurado'],
  frutaDeEspirais: ['Fruta de espirais', 'uma fruta de espirais'],
  bandeiraPirata: ['Bandeira pirata', 'uma bandeira pirata'],
  mesaDeNavegacao: ['Mesa de navegação', 'uma mesa de navegação'],
  laranjeiraEmCanteiro: ['Laranjeira em canteiro', 'uma laranjeira em canteiro'],
  pratoDeCarne: ['Prato de carne no osso', 'um prato de carne no osso'],
  pranchaDoNavio: ['Prancha do navio', 'uma prancha do navio'],
  esqueletoDePeixe: ['Esqueleto de peixe gigante', 'um esqueleto de peixe gigante'],
  navioNaGarrafa: ['Navio na garrafa', 'um navio na garrafa'],
  conchaMagica: ['Concha mágica', 'uma concha mágica'],
  lanternaDePedra: ['Lanterna de pedra japonesa', 'uma lanterna de pedra japonesa'],
  balcaoDeTaverna: ['Balcão de taverna', 'um balcão de taverna'],
  alvoDeDardos: ['Alvo de dardos', 'um alvo de dardos'],
  mesaDeQuedaDeBraco: ['Mesa de queda de braço', 'uma mesa de queda de braço'],
  varalDeBandeirinhas: ['Varal de bandeirinhas', 'um varal de bandeirinhas'],
  varalDeLanternas: ['Varal de lanternas', 'um varal de lanternas'],
  mastroDeFitas: ['Mastro de fitas', 'um mastro de fitas'],
  caixaDeFogosDeArtificio: ['Caixa de fogos de artifício', 'uma caixa de fogos de artifício'],
  barracaDeJogosDaFeira: ['Barraca de jogos da feira', 'uma barraca de jogos da feira'],
  barracaDeEspetinho: ['Barraca de comida com fogareiro', 'uma barraca de comida com fogareiro'],
  churrasqueira: ['Churrasqueira', 'uma churrasqueira'],
  harpa: ['Harpa', 'uma harpa'],
  tambores: ['Tambores', 'uns tambores'],
  redeDeDormir: ['Rede de dormir', 'uma rede de dormir'],
  guardaSolComEspreguicadeira: ['Guarda-sol com espreguiçadeira', 'um guarda-sol com espreguiçadeira'],
  toalhaDePiquenique: ['Toalha de piquenique', 'uma toalha de piquenique'],
  xadrezDeJardim: ['Xadrez gigante de jardim', 'um xadrez gigante de jardim'],
  bolicheDeGrama: ['Boliche de grama', 'um boliche de grama'],
  gangorra: ['Gangorra', 'uma gangorra'],
  escorregador: ['Escorregador', 'um escorregador'],
  aquario: ['Aquário', 'um aquário'],
  ofuro: ['Ofurô', 'um ofurô'],
  telescopio: ['Telescópio', 'um telescópio'],
  globoTerrestre: ['Globo terrestre', 'um globo terrestre'],
  pebolim: ['Pebolim', 'um pebolim'],
  arquibancadaDeTorneio: ['Arquibancada de torneio', 'uma arquibancada de torneio'],
  licaDeJusta: ['Liça de justa', 'uma liça de justa'],
  posteDeAmarrarCavalos: ['Poste de amarrar cavalos', 'um poste de amarrar cavalos'],
  bueiro: ['Bueiro', 'um bueiro'],
  relogioDeSol: ['Relógio de sol', 'um relógio de sol'],
  sinoNoSuporte: ['Sino no suporte', 'um sino no suporte'],
  tearDePedal: ['Tear', 'um tear'],
  rocaDeFiar: ['Roca de fiar', 'uma roca de fiar'],
  lagarDeUva: ['Lagar', 'um lagar'],
  moDePedra: ['Mó de pedra', 'uma mó de pedra'],
  liteira: ['Liteira', 'uma liteira'],
  ponteLevadica: ['Ponte levadiça', 'uma ponte levadiça'],
  portaoComGradeLevadica: ['Portão com grade levadiça', 'um portão com grade levadiça'],
  torreDeCerco: ['Torre de cerco', 'uma torre de cerco'],
  estatuaEquestre: ['Estátua equestre', 'uma estátua equestre'],
  obelisco: ['Obelisco', 'um obelisco'],
  forcaComCadafalso: ['Forca', 'uma forca'],
  torreDoSino: ['Torre do sino', 'uma torre do sino'],
  guarita: ['Guarita', 'uma guarita'],
  bunkerDeConcreto: ['Bunker de concreto', 'um bunker de concreto'],
  conteiner: ['Contêiner', 'um contêiner'],
  tendaMilitar: ['Tenda militar', 'uma tenda militar'],
  caixaDAguaElevada: ["Caixa d'água elevada", "uma caixa d'água elevada"],
  torreDeRadio: ['Torre de rádio', 'uma torre de rádio'],
  tanqueDeCombustivel: ['Tanque de combustível', 'um tanque de combustível'],
  farol: ['Farol', 'um farol'],
  coreto: ['Coreto', 'um coreto'],
  guindasteDePorto: ['Guindaste de porto', 'um guindaste de porto'],
  posteComRelogio: ['Poste com relógio', 'um poste com relógio'],
  quiosque: ['Quiosque', 'um quiosque'],
  rodaDagua: ["Roda d'água", "uma roda d'água"],
  pombal: ['Pombal', 'um pombal'],
  baiaDeCavalo: ['Baia de cavalo', 'uma baia de cavalo'],
  siloDeGraos: ['Silo', 'um silo'],
  chiqueiroCercado: ['Chiqueiro', 'um chiqueiro'],
  carrossel: ['Carrossel', 'um carrossel'],
  tendaDeCirco: ['Tenda de circo', 'uma tenda de circo'],
  rodaGigante: ['Roda gigante de madeira', 'uma roda gigante de madeira'],
  casaNaArvore: ['Casa na árvore', 'uma casa na árvore'],
  pergolaComTrepadeira: ['Pérgola com trepadeira', 'uma pérgola com trepadeira'],
  portalTorii: ['Portal torii', 'um portal torii'],
}

describe('peças novas: registro', () => {
  it('os 14 tipos dos lotes 1 e 2, o Fogo e as 14 peças de 28 e 29/10 estão no catálogo de tipos, depois dos 11 de antes', () => {
    expect(PECAS_NOVAS).toEqual(Object.keys(TAMANHOS))
    expect(TIPOS_MOBILIA.slice(0, 11)).toEqual(['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete'])
    for (const tipo of PECAS_NOVAS) {
      expect(ehTipoMobilia(tipo), tipo).toBe(true)
      expect(ehPecaNova(tipo), tipo).toBe(true)
    }
    expect(ehPecaNova('mesa')).toBe(false)
    expect(ehPecaNova(undefined)).toBe(false)
  })

  it('cada peça nasce no tamanho do plano, centrada no clique', () => {
    for (const tipo of PECAS_NOVAS) {
      const [w, h] = TAMANHOS[tipo]
      const movel = criarMovel(tipo, { x: 100, y: 80 }, GRADE, `id-${tipo}`)
      expect([movel.width / GRADE, movel.height / GRADE], tipo).toEqual([w, h])
      expect(movel.x).toBe(100)
      expect(movel.mobilia).toBe(tipo)
    }
  })

  it('nome e artigo de cada peça (a setinha e a dica do clique)', () => {
    for (const tipo of PECAS_NOVAS) {
      expect(ROTULO_MOBILIA[tipo], tipo).toBe(NOMES[tipo][0])
      expect(NOME_COM_ARTIGO[tipo], tipo).toBe(NOMES[tipo][1])
    }
  })

  it('vista de lado só na barraca e na carroça; a de lado tem pegada própria', () => {
    for (const tipo of PECAS_NOVAS) expect(aceitaVista(tipo), tipo).toBe(tipo === 'barraca' || tipo === 'carroca')
    const barraca = movelComOutraVista(criarMovel('barraca', { x: 0, y: 0 }, GRADE, 'b'), 'lado', GRADE)
    expect([barraca.width / GRADE, barraca.height / GRADE]).toEqual([2, 2])
    expect(barraca.mobiliaVista).toBe('lado')
    const carroca = movelComOutraVista(criarMovel('carroca', { x: 0, y: 0 }, GRADE, 'c'), 'lado', GRADE)
    expect([carroca.width / GRADE, carroca.height / GRADE]).toEqual([2, 1.25])
  })

  it('silhueta redonda: a mesa redonda, o poço, o vaso, o balde de água, o moinho, o caldeirão, a banqueta, o candelabro de chão, o cesto de vime, o canteiro de flores, o toco de árvore, a árvore seca, a tenda de adivinha, a colmeia, o braseiro, o círculo mágico, a bola de cristal, a moeda de ouro, o diamante, a tocha de pé, a torre de pedra, o lustre de velas, o ouriço antitanque, a fruta de espirais, o prato de carne no osso, a lanterna de pedra japonesa, o mastro de fitas, o globo terrestre, o relógio de sol, o farol, o coreto, o quiosque, o silo e o carrossel; o resto é retângulo', () => {
    const redondos = PECAS_NOVAS.filter((tipo) => ehMovelRedondo(tipo))
    expect(redondos).toEqual(['mesaRedonda', 'vaso', 'poco', 'balde', 'moinho', 'caldeirao', 'banqueta', 'candelabroDeChao', 'cestoDeVime', 'canteiroDeFlores', 'tocoDeArvore', 'arvoreSeca', 'tendaDeAdivinha', 'colmeia', 'braseiro', 'circuloMagico', 'bolaDeCristal', 'moedaDeOuro', 'diamante', 'tochaDePe', 'torreDePedra', 'lustreDeVelas', 'ouricoAntitanque', 'frutaDeEspirais', 'pratoDeCarne', 'lanternaDePedra', 'mastroDeFitas', 'globoTerrestre', 'relogioDeSol', 'farol', 'coreto', 'quiosque', 'siloDeGraos', 'carrossel'])
  })

  it('cada peça tem desenho de linhas (o provisório antes da imagem), nas duas vistas quando tem vista', () => {
    for (const tipo of PECAS_NOVAS) {
      const [w, h] = TAMANHOS[tipo]
      expect(tracosDoGlifo(tipo, w * GRADE, h * GRADE).length, tipo).toBeGreaterThan(0)
      if (aceitaVista(tipo)) expect(tracosDoGlifo(tipo, w * GRADE, h * GRADE, 'lado').length, `${tipo} de lado`).toBeGreaterThan(0)
      // Tamanho torto não tem traço nem derruba o desenho.
      expect(tracosDoGlifo(tipo, 0, h * GRADE)).toEqual([])
    }
  })

  it('lápide: a variação sai do id, com valor fixo (as lápides salvas não mudam), e ids diferentes dão as 3 variações', () => {
    // Valores FIXOS de 3 ids: trocar o hash ou VARIANTES_DA_LAPIDE mudaria as lápides já salvas.
    expect([varianteDaLapide('lapide-0'), varianteDaLapide('lapide-1'), varianteDaLapide('lapide-3'), varianteDaLapide('a3f9c2e1-0b44-4c1d-9e2a-5d6f7a8b9c0d')]).toEqual([0, 1, 2, 0])
    const vistas = new Set(Array.from({ length: 30 }, (_, i) => varianteDaLapide(`p${i}`)))
    expect([...vistas].sort()).toEqual([0, 1, 2])
    expect(varianteDaLapide(undefined)).toBe(0)
  })
})

describe('catálogo do painel: só peça com desenho pronto', () => {
  it('os 11 de antes na ordem de sempre, as mesas novas logo depois da Mesa, e cada peça nova do catálogo tem desenho com textura', () => {
    expect(TIPOS_NO_CATALOGO.filter((tipo) => TIPOS_MOBILIA.slice(0, 11).includes(tipo))).toEqual(TIPOS_MOBILIA.slice(0, 11))
    const mesa = TIPOS_NO_CATALOGO.indexOf('mesa')
    expect(TIPOS_NO_CATALOGO.slice(mesa, mesa + 3)).toEqual(['mesa', 'mesaQuadrada', 'mesaRedonda'])
    const cerca = TIPOS_NO_CATALOGO.indexOf('cerca')
    expect(TIPOS_NO_CATALOGO.slice(cerca, cerca + 3)).toEqual(['cerca', 'sebe', 'jardineira'])
    const tapete = TIPOS_NO_CATALOGO.indexOf('tapete')
    expect(TIPOS_NO_CATALOGO.slice(tapete, tapete + 2)).toEqual(['tapete', 'tapeteLongo'])
    // O Fogo logo depois da Fogueira (o móvel continua como estava).
    const fogueira = TIPOS_NO_CATALOGO.indexOf('fogueira')
    expect(TIPOS_NO_CATALOGO.slice(fogueira, fogueira + 2)).toEqual(['fogueira', 'fogo'])
    // Os troncos e o feno (29/10/2026), sem parente antigo, fecham o catálogo logo depois do arco e da placa.
    // Os objetos de vento (02/11/2026) depois deles, os destroços, as sucatas e o campinho (10/11/2026) em
    // seguida, os lotes 1 a 16 dos objetos novos (11/11/2026), o lote 17 (12/11/2026) e os de 14/11/2026 no fim.
    expect(TIPOS_NO_CATALOGO.slice(-247, -240)).toEqual(['arcoDoPortao', 'placaDeSeta', 'troncos', 'feno', 'cataVento', 'moinho', 'cataVentoBrinquedo'])
    expect(TIPOS_NO_CATALOGO.slice(-240, -235)).toEqual(['destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho'])
    expect(TIPOS_NO_CATALOGO.slice(-235, -227)).toEqual(['bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao'])
    expect(TIPOS_NO_CATALOGO.slice(-227, -219)).toEqual(['guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha'])
    expect(TIPOS_NO_CATALOGO.slice(-219, -210)).toEqual(['bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica'])
    expect(TIPOS_NO_CATALOGO.slice(-210, -202)).toEqual(['escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao'])
    expect(TIPOS_NO_CATALOGO.slice(-202, -196)).toEqual(['banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne'])
    expect(TIPOS_NO_CATALOGO.slice(-196, -190)).toEqual(['pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre'])
    expect(TIPOS_NO_CATALOGO.slice(-190, -183)).toEqual(['varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja'])
    expect(TIPOS_NO_CATALOGO.slice(-183, -177)).toEqual(['cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca'])
    expect(TIPOS_NO_CATALOGO.slice(-177, -171)).toEqual(['balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe'])
    expect(TIPOS_NO_CATALOGO.slice(-171, -162)).toEqual(['fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras'])
    expect(TIPOS_NO_CATALOGO.slice(-162, -154)).toEqual(['carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca'])
    expect(TIPOS_NO_CATALOGO.slice(-154, -145)).toEqual(['ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura'])
    expect(TIPOS_NO_CATALOGO.slice(-145, -137)).toEqual(['braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado'])
    expect(TIPOS_NO_CATALOGO.slice(-137, -127)).toEqual([
      'potroDeTortura', 'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'mesaDeInstrumentos', 'sangueNoChao',
      'estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro',
    ])
    expect(TIPOS_NO_CATALOGO.slice(-127, -112)).toEqual([
      'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
      'teiaDeAranha', 'tochaDeParede', 'tochaDePe', 'cranio', 'tenda', 'torreDePedra', 'torreDeVigia',
    ])
    // Os objetos de 14/11/2026, na ordem da lista do dia: o lote L01 (o castelo), o L02 (o resto do castelo), o L03 (o
    // cerco e a defesa), o L04 (o fim do cerco e o começo da base militar), o L05 (o meio da base militar), o L06 (o
    // resto da base militar), o L07 e o L08 (o mar e os piratas), o L09 e o L10 (a taverna e a festa), o L11 e o L12 (o
    // descanso e a brincadeira), o L13 (o torneio e a cidade), o L14 (o resto da cidade e vila) e a ponte levadiça do
    // L02 (o item 81 da lista).
    expect(TIPOS_NO_CATALOGO.slice(-112, -29)).toEqual([
      'tronoReal', 'camaDeDossel', 'estandarteDePe', 'tapecariaDeParede', 'lustreDeVelas', 'panoplia',
      'mesaDeBanquete', 'bancosDeCapela', 'mesaDeGuerra', 'poleiroDeFalcao', 'aljavasEFlechas',
      'catapulta', 'balista', 'arieteComTeto', 'escadaDeCerco',
      'cavaloDeFrisa', 'pilhaDeBalasDeCanhao', 'tachoDeOleoQuente', 'sacosDeAreia', 'caixasDeMunicao', 'ouricoAntitanque',
      'arameFarpado', 'barreiraDeConcreto', 'cancelaListrada', 'beliche', 'armarioDeFerro', 'radioDeCampanha',
      'holofote', 'redeDeCamuflagem', 'metralhadoraNoTripe', 'paletesDeMadeira', 'gerador', 'mastroComBandeira',
      'caracolTelefone', 'caracolTelefoneCamera', 'caracolTelefoneDourado', 'cartazDeProcurado', 'frutaDeEspirais', 'bandeiraPirata',
      'mesaDeNavegacao', 'laranjeiraEmCanteiro',
      'pratoDeCarne', 'pranchaDoNavio', 'esqueletoDePeixe', 'navioNaGarrafa', 'conchaMagica', 'lanternaDePedra',
      'balcaoDeTaverna', 'alvoDeDardos', 'mesaDeQuedaDeBraco', 'varalDeBandeirinhas', 'varalDeLanternas', 'mastroDeFitas',
      'caixaDeFogosDeArtificio', 'barracaDeJogosDaFeira', 'barracaDeEspetinho', 'churrasqueira', 'harpa', 'tambores',
      'redeDeDormir', 'guardaSolComEspreguicadeira', 'toalhaDePiquenique', 'xadrezDeJardim', 'bolicheDeGrama', 'gangorra',
      'escorregador', 'aquario', 'ofuro', 'telescopio', 'globoTerrestre', 'pebolim',
      'arquibancadaDeTorneio', 'licaDeJusta', 'posteDeAmarrarCavalos', 'bueiro', 'relogioDeSol', 'sinoNoSuporte',
      'tearDePedal', 'rocaDeFiar', 'lagarDeUva', 'moDePedra', 'liteira',
      'ponteLevadica',
    ])
    // E, no fim, as construções de 14/11/2026, na ordem da lista do dia: o L15 (o castelo, itens 82 a 87), o L16 (a
    // base militar, itens 88 a 94), o L17 (a cidade e porto, itens 95 a 99), o L18 (a vila e campo, itens 100 a 104) e
    // o L19 (o parque, itens 105 a 110).
    expect(TIPOS_NO_CATALOGO.slice(-29)).toEqual([
      'portaoComGradeLevadica', 'torreDeCerco', 'estatuaEquestre', 'obelisco', 'forcaComCadafalso', 'torreDoSino',
      'guarita', 'bunkerDeConcreto', 'conteiner', 'tendaMilitar', 'caixaDAguaElevada', 'torreDeRadio', 'tanqueDeCombustivel',
      'farol', 'coreto', 'guindasteDePorto', 'posteComRelogio', 'quiosque',
      'rodaDagua', 'pombal', 'baiaDeCavalo', 'siloDeGraos', 'chiqueiroCercado',
      'carrossel', 'tendaDeCirco', 'rodaGigante', 'casaNaArvore', 'pergolaComTrepadeira', 'portalTorii',
    ])
    // 26 de antes, os 8 móveis de casa de 28/10/2026 (fogão, geladeira, pia, balcão, pratos, privada, sofá, poltrona)
    // e os 6 de 29/10/2026 (lareira, fornalha, bigorna, balde, troncos, feno).
    // E o chafariz de 02/11/2026, logo depois do poço, e os 3 objetos de vento no fim; a ponte de 03/11/2026
    // logo depois do chafariz. A cova e os dois caixões de 07/11/2026 logo depois da lápide.
    const lapide = TIPOS_NO_CATALOGO.indexOf('lapide')
    expect(TIPOS_NO_CATALOGO.slice(lapide, lapide + 4)).toEqual(['lapide', 'cova', 'caixao', 'caixaoAberto'])
    expect(TIPOS_NO_CATALOGO).toHaveLength(288)
    for (const tipo of TIPOS_NO_CATALOGO) expect(TIPOS_COM_TEXTURA.some((t) => t === tipo), tipo).toBe(true)
    expect(new Set(TIPOS_NO_CATALOGO).size).toBe(TIPOS_NO_CATALOGO.length)
  })

  it('a busca da ficha acha as três sucatas por "metal" (o mestre pediu "sucatas de metal") e por "sucata"', () => {
    const itens = TIPOS_NO_CATALOGO.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    expect(acharObjetos(itens, 'metal').map((item) => item.tipo)).toEqual(['sucataChapas', 'sucataEngrenagens', 'sucataTambores'])
    // Por "sucata": as três pelo nome e, depois, os destroços, os escombros de pedra, os ossos, os quatro do
    // lote 11 (11/11/2026: a carroça quebrada, o barril quebrado, a viga caída e a armadura enferrujada), a
    // armadura despedaçada do lote 15 (11/11/2026) e o crânio do lote 17 (12/11/2026) pelo título do grupo.
    expect(acharObjetos(itens, 'sucata').map((item) => item.tipo)).toEqual([
      'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'destrocosDeMadeira', 'escombrosDePedra', 'ossos',
      'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'armaduraDespedacada', 'cranio',
    ])
  })

  it('a busca da ficha acha os objetos dos quatro grupos novos de 11/11/2026 pelo título do grupo: "navio" traz o canhão e o lote 12, "templo", o altar, a armadura do lote 15 e os dos lotes 13 e 16, "tortura", o lote 14, e "alquimia", os três últimos do lote 13', () => {
    // CONSTRUÇÕES (12/11/2026, `14fef595`): a ficha do Objeto busca no catálogo DELE (`TIPOS_DO_OBJETO`, sem as
    // 19 construções). O pilar e os três blocos de inscrições moram em "Monumentos e colunas", na Construção.
    const itens = TIPOS_DO_OBJETO.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    // A prancha do navio e o navio na garrafa (lote L08, 14/11/2026) têm "navio" no nome: vêm primeiro, antes do grupo.
    expect(acharObjetos(itens, 'navio').map((item) => item.tipo)).toEqual(['pranchaDoNavio', 'navioNaGarrafa', 'canhao', 'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe'])
    expect(acharObjetos(itens, 'templo').map((item) => item.tipo)).toEqual([
      'altar', 'armadura',
      'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico',
      'teiaDeAranha', 'tochaDeParede', 'tochaDePe',
    ])
    const monumentos: TipoMobilia[] = ['pilar', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado']
    expect(monumentos.map((tipo) => GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo)).toEqual([
      'Monumentos e colunas', 'Monumentos e colunas', 'Monumentos e colunas', 'Monumentos e colunas',
    ])
    // Por "tortura": o potro e a mesa de instrumentos pelo nome, os outros cinco pelo título do grupo.
    expect(acharObjetos(itens, 'tortura').map((item) => item.tipo)).toEqual([
      'potroDeTortura', 'mesaDeInstrumentos',
      'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'sangueNoChao',
    ])
    expect(acharObjetos(itens, 'alquimia').map((item) => item.tipo)).toEqual(['estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro'])
    // Os grupos novos entram antes de "Outros", que continua no fim; o Tesouro (12/11/2026) logo depois da Magia.
    // E os 4 grupos da Construção (12/11/2026, `construcoes.ts`) depois do Tesouro, ainda antes de "Outros". Os grupos
    // do Objeto de 14/11/2026 (o castelo, o cerco e a defesa, a base militar, o mar e piratas, a taverna e festa, o
    // descanso e brincadeira e a cidade e vila) entram entre o Tesouro e os da Construção. Os 3 grupos da Construção
    // de 14/11/2026 (os fortes e castelos, a cidade e porto e o parque e diversão) depois dos 4 dela, antes de "Outros".
    expect(GRUPOS_DE_OBJETO.slice(-20).map((g) => g.titulo)).toEqual([
      'Porto e navio', 'Templo e masmorra', 'Sala de tortura', 'Magia e alquimia', 'Tesouro', 'Castelo', 'Cerco e defesa', 'Base militar', 'Mar e piratas', 'Taverna e festa',
      'Descanso e brincadeira', 'Cidade e vila',
      'Torres e prédios', 'Praça, rua e campo', 'Monumentos e colunas', 'Abrigos e passagens',
      'Fortes e castelos', 'Cidade e porto', 'Parque e diversão', 'Outros',
    ])
  })

  it('a busca da ficha acha o lote 17 (12/11/2026): "tesouro" traz as oito peças do grupo novo pelo título, "ouro", as quatro de ouro pelo nome e as pedras pelo grupo, e "torre" e "tocha", as duas de cada', () => {
    const dasFichas = (tipos: readonly TipoMobilia[]) =>
      tipos.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    const itens = dasFichas(TIPOS_NO_CATALOGO)
    expect(acharObjetos(itens, 'tesouro').map((item) => item.tipo)).toEqual([
      'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
    ])
    // "Tesouro" contém "ouro": o diamante e as joias vêm pelo título do grupo, depois das quatro de ouro.
    expect(acharObjetos(itens, 'ouro').map((item) => item.tipo)).toEqual([
      'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
    ])
    // CONSTRUÇÕES (12/11/2026): as duas torres são construções. A ficha do Objeto não as tem; a da Construção acha as
    // duas pelo nome e, depois, o resto de "Torres e prédios" pelo título do grupo (como "templo" acha o grupo dele).
    expect(acharObjetos(dasFichas(TIPOS_DO_OBJETO), 'torre')).toEqual([])
    // As três torres de 14/11/2026 (a de cerco, a do sino e a de rádio) também pelo nome, e a caixa d'água elevada, o
    // pombal e o silo, que moram em "Torres e prédios", pelo título do grupo.
    expect(acharObjetos(dasFichas(TIPOS_DA_CONSTRUCAO), 'torre').map((item) => item.tipo)).toEqual([
      'torreDePedra', 'torreDeVigia', 'torreDeCerco', 'torreDoSino', 'torreDeRadio',
      'barraca', 'moinho', 'mausoleu', 'galinheiro', 'caixaDAguaElevada', 'pombal', 'siloDeGraos',
    ])
    expect(acharObjetos(itens, 'tocha').map((item) => item.tipo)).toEqual(['tochaDeParede', 'tochaDePe'])
    expect(acharObjetos(itens, 'joia').map((item) => item.tipo)).toEqual(['joia', 'monteDeJoias'])
    expect(acharObjetos(itens, 'diamante').map((item) => item.tipo)).toEqual(['diamante', 'monteDeDiamantes'])
  })
})
