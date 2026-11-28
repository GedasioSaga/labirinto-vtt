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
  caixaQuebrada: [1.2, 1.2],
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
  // O muro de fogo (15/11/2026) nasce do traço; este é o tamanho da troca de tipo no painel.
  muroDeFogo: [3, 1],
  // O banheiro moderno (15/11/2026): o lote A e o lote B.
  vasoSanitarioModerno: [0.5, 0.7],
  bide: [0.42, 0.6],
  boxDeChuveiro: [1, 1],
  banheiraModerna: [2, 1],
  gabineteDeBanheiro: [1, 0.55],
  armarioDeBanheiro: [0.6, 0.4],
  toalheiro: [1, 0.5],
  cestoDeRoupa: [0.5, 0.5],
  prateleiraDeFrascos: [1, 0.3],
  lixeiraDePedal: [0.5, 0.5],
  tapeteDeBanheiro: [1, 0.6],
  portaPapel: [0.5, 0.5],
  // As referências (16/11/2026): o lote L1 e o lote L2.
  mesaDeAutopsia: [2, 0.9],
  macaComLencol: [2, 0.8],
  camaraFrigorifica: [2, 1],
  esterilizador: [0.7, 0.7],
  luminariaArticulada: [1, 1],
  bandejaDeInstrumentos: [0.8, 0.6],
  mesaDeLaboratorio: [2, 1],
  panelasEBacias: [1, 0.8],
  cadeiraGiratoria: [0.6, 0.6],
  maquinaDeEscrever: [0.5, 0.4],
  elevadorAntigo: [1, 1],
  alcapao: [1, 1],
  deckDeMadeira: [3, 2],
  colunaQuebrada: [2, 1],
  altarRedondo: [1.5, 1.5],
  lajeDeSacrificio: [2, 1],
  tumuloDePedra: [1, 2],
  carroAntigo: [3, 1.5],
  prateleiraDeToalhas: [1, 0.4],
  cadeiraDeEspaldarAlto: [0.5, 0.5],
  centroDeMesa: [1, 0.5],
  lapideTorta: [0.6, 0.4],
  torreDoDragao: [3, 3],
  montanhaPequena: [4, 4],
  montanhaMedia: [6, 6],
  montanhaGrande: [10, 8],
  estatuaDeCavalo: [1, 1],
  estatuaDeCavaloSemPedestal: [1, 1],
  // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md).
  cadeiraDeFerro: [0.6, 0.6],
  mesaDeFerro: [2, 1],
  catreDeFerro: [2, 1],
  esteiraDePalha: [1, 2],
  baldeDeDejetos: [0.5, 0.5],
  grilhoesDeParede: [1, 0.5],
  bolaDeFerroComCorrente: [1, 1],
  latrinaDeCela: [1, 1],
  bancoDePedra: [2, 0.7],
  mesaDoCarcereiro: [1.5, 0.8],
  quadroDeChaves: [1, 0.6],
  jaulaDeChao: [1, 1],
  raloDeMasmorra: [1, 1],
  bauDeFerro: [1, 0.6],
  tabuaDePregos: [2, 0.75],
  cepoDoCarrasco: [1, 1],
  posteDeAcoite: [1, 1],
  gradeDeCorredor: [2, 0.25],
  corpoAmortalhado: [1.7, 0.55],
  pranchaDeTortura: [1, 2],
  braseiroComFerros: [1, 1],
  fossoDeBrasas: [2, 2],
  rodaDeTortura: [2, 2],
  guilhotina: [1, 2],
  pertencesConfiscados: [1, 1],
  guinchoDeCorrente: [1.5, 1.5],
  fossoDoSalao: [6, 6],
  pilarComBraseiro: [1, 1],
  lanternaGradeada: [0.4, 0.5],
  globoDeLuzRubra: [0.8, 0.8],
  seloDeOrbitas: [3, 3],
  plataformaDeRitual: [5, 5],
  gargula: [1, 1],
  estatuaDeBesta: [2, 2],
  estatuaEncapuzada: [1, 1],
  ponteDeCorrente: [4, 1],
  sarcofagoEntreaberto: [1, 2],
  sarcofagoDeBronze: [1, 2],
  caixaoDeFerro: [1, 2],
  lajeTumular: [1, 2],
  nichoFunerario: [2, 1],
  colunaLisa: [1, 1],
  pilastraQuadrada: [1, 1],
  urnaFuneraria: [0.5, 0.5],
  columbario: [2, 1],
  estradoEmMeiaLua: [3, 1.5],
  sarcofagoDeCristais: [1.5, 2.5],
  relicarioDeCristal: [1, 0.75],
  lajeTumularAcesa: [1, 2],
  pedestalComCristal: [1, 1],
  arandelaDeCristal: [0.5, 0.5],
  braseiroDeChamaFria: [0.8, 0.8],
  ossario: [2, 1],
  arcossolio: [2, 1],
  seloDeCristal: [2, 2],
  ponteDePedraQuebrada: [4, 1],
  ponteDeTabuasQuebrada: [4, 1],
  calcadaSobreAgua: [1.5, 3],
  muroEmRuina: [2, 2],
  pedestalEntalhado: [1, 1],
  colunaComGlifos: [1, 1],
  estelaMaia: [1, 0.5],
  cabanaDeLajes: [2, 2],
  tanqueComBorda: [3, 2],
  piramideEmDegraus: [6, 6],
  topoDoTemplo: [2, 2],
  cabecaColossal: [2, 2],
  idoloDourado: [1, 1],
  cascataEmDegraus: [2, 3],
  ponteSobrePilares: [5, 2],
  catreDesarrumado: [1, 2],
  camaDeCaixotes: [1, 2],
  mesaDeCaixote: [1, 1],
  cadeiraRemendada: [0.5, 0.5],
  bancoCorrido: [2, 0.45],
  cortinaDePassagem: [1, 0.25],
  trouxaDeRoupa: [1, 0.8],
  passarelaDeTabuas: [3, 1],
  vasoComPiaDeAco: [0.6, 0.7],
  mesinhaDeCela: [0.7, 0.7],
  mesaDePatio: [1.4, 1],
  chuveiroColetivo: [0.6, 0.7],
  armarioDeVestiario: [1, 0.4],
  cadeiraDePlastico: [0.55, 0.55],
  maquinaDeLavar: [0.85, 0.85],
  leitoHospitalar: [0.7, 1.4],
  mesaComComputador: [1, 0.5],
  cercaDeAlambrado: [2, 0.3],
  arquibancadaDePedra: [4, 4],
  fossoDeArena: [4, 4],
  balaustradaDeCamarote: [3, 1.5],
  pocoDeSangue: [1.5, 1.5],
  velaNoPires: [0.5, 0.5],
  salamandra: [1, 1],
  monteDeEntulho: [1.5, 1.25],
  camaDeTrapos: [1, 2],
  placaDePressao: [1, 1],
  escadaDeMao: [0.5, 1.5],
  correntePendurada: [1, 1],
  portaoDeJaula: [1, 1],
  laminaPendular: [2, 1.5],
  pecaDeXadrez: [1, 1],
  carrinhoDeMina: [1, 0.8],
  trilhoDeMina: [1, 1],
  escoraDeMina: [2, 0.6],
  pilhaDeMinerio: [1, 1],
  cano: [1, 1],
  saidaDeEsgoto: [1, 1],
  comporta: [2, 1],
  fonteDeParede: [1, 0.75],
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
  caixaQuebrada: ['Caixa quebrada', 'uma caixa quebrada'],
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
  muroDeFogo: ['Muro de fogo', 'um muro de fogo'],
  vasoSanitarioModerno: ['Vaso sanitário moderno', 'um vaso sanitário moderno'],
  bide: ['Bidê', 'um bidê'],
  boxDeChuveiro: ['Box de chuveiro', 'um box de chuveiro'],
  banheiraModerna: ['Banheira moderna', 'uma banheira moderna'],
  gabineteDeBanheiro: ['Gabinete de banheiro', 'um gabinete de banheiro'],
  armarioDeBanheiro: ['Armário de banheiro', 'um armário de banheiro'],
  toalheiro: ['Toalheiro', 'um toalheiro'],
  cestoDeRoupa: ['Cesto de roupa', 'um cesto de roupa'],
  prateleiraDeFrascos: ['Prateleira de frascos', 'uma prateleira de frascos'],
  lixeiraDePedal: ['Lixeira de pedal', 'uma lixeira de pedal'],
  tapeteDeBanheiro: ['Tapete de banheiro', 'um tapete de banheiro'],
  portaPapel: ['Suporte de papel', 'um suporte de papel'],
  mesaDeAutopsia: ['Mesa de autópsia', 'uma mesa de autópsia'],
  macaComLencol: ['Maca com lençol', 'uma maca com lençol'],
  camaraFrigorifica: ['Câmara frigorífica', 'uma câmara frigorífica'],
  esterilizador: ['Esterilizador', 'um esterilizador'],
  luminariaArticulada: ['Luminária articulada', 'uma luminária articulada'],
  bandejaDeInstrumentos: ['Bandeja de instrumentos', 'uma bandeja de instrumentos'],
  mesaDeLaboratorio: ['Mesa de laboratório', 'uma mesa de laboratório'],
  panelasEBacias: ['Panelas e bacias', 'umas panelas e bacias'],
  cadeiraGiratoria: ['Cadeira giratória', 'uma cadeira giratória'],
  maquinaDeEscrever: ['Máquina de escrever', 'uma máquina de escrever'],
  elevadorAntigo: ['Elevador antigo', 'um elevador antigo'],
  alcapao: ['Alçapão', 'um alçapão'],
  deckDeMadeira: ['Deck de madeira', 'um deck de madeira'],
  colunaQuebrada: ['Coluna quebrada', 'uma coluna quebrada'],
  altarRedondo: ['Altar redondo', 'um altar redondo'],
  lajeDeSacrificio: ['Laje de sacrifício', 'uma laje de sacrifício'],
  tumuloDePedra: ['Túmulo de pedra', 'um túmulo de pedra'],
  carroAntigo: ['Carro antigo', 'um carro antigo'],
  prateleiraDeToalhas: ['Prateleira de toalhas', 'uma prateleira de toalhas'],
  cadeiraDeEspaldarAlto: ['Cadeira de espaldar alto', 'uma cadeira de espaldar alto'],
  centroDeMesa: ['Centro de mesa', 'um centro de mesa'],
  lapideTorta: ['Lápide torta', 'uma lápide torta'],
  torreDoDragao: ['Torre do dragão', 'uma torre do dragão'],
  montanhaPequena: ['Montanha pequena', 'uma montanha pequena'],
  montanhaMedia: ['Montanha média', 'uma montanha média'],
  montanhaGrande: ['Montanha grande', 'uma montanha grande'],
  estatuaDeCavalo: ['Estátua de cavalo', 'uma estátua de cavalo'],
  estatuaDeCavaloSemPedestal: ['Estátua de cavalo sem pedestal', 'uma estátua de cavalo sem pedestal'],
  // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md).
  cadeiraDeFerro: ['Cadeira de ferro', 'uma cadeira de ferro'],
  mesaDeFerro: ['Mesa de ferro', 'uma mesa de ferro'],
  catreDeFerro: ['Catre de ferro', 'um catre de ferro'],
  esteiraDePalha: ['Esteira de palha', 'uma esteira de palha'],
  baldeDeDejetos: ['Balde de dejetos', 'um balde de dejetos'],
  grilhoesDeParede: ['Grilhões de parede', 'uns grilhões de parede'],
  bolaDeFerroComCorrente: ['Bola de ferro com corrente', 'uma bola de ferro com corrente'],
  latrinaDeCela: ['Latrina de cela', 'uma latrina de cela'],
  bancoDePedra: ['Banco de pedra', 'um banco de pedra'],
  mesaDoCarcereiro: ['Mesa do carcereiro', 'uma mesa do carcereiro'],
  quadroDeChaves: ['Quadro de chaves', 'um quadro de chaves'],
  jaulaDeChao: ['Jaula de chão', 'uma jaula de chão'],
  raloDeMasmorra: ['Ralo de masmorra', 'um ralo de masmorra'],
  bauDeFerro: ['Baú de ferro', 'um baú de ferro'],
  tabuaDePregos: ['Tábua de pregos', 'uma tábua de pregos'],
  cepoDoCarrasco: ['Cepo do carrasco', 'um cepo do carrasco'],
  posteDeAcoite: ['Poste de açoite', 'um poste de açoite'],
  gradeDeCorredor: ['Grade de corredor', 'uma grade de corredor'],
  corpoAmortalhado: ['Corpo amortalhado', 'um corpo amortalhado'],
  pranchaDeTortura: ['Prancha de tortura', 'uma prancha de tortura'],
  braseiroComFerros: ['Braseiro com ferros de marcar', 'um braseiro com ferros de marcar'],
  fossoDeBrasas: ['Fosso de brasas', 'um fosso de brasas'],
  rodaDeTortura: ['Roda de tortura', 'uma roda de tortura'],
  guilhotina: ['Guilhotina', 'uma guilhotina'],
  pertencesConfiscados: ['Pertences confiscados', 'uns pertences confiscados'],
  guinchoDeCorrente: ['Guincho de corrente', 'um guincho de corrente'],
  fossoDoSalao: ['Fosso do salão', 'um fosso do salão'],
  pilarComBraseiro: ['Pilar com braseiro', 'um pilar com braseiro'],
  lanternaGradeada: ['Lanterna gradeada de parede', 'uma lanterna gradeada de parede'],
  globoDeLuzRubra: ['Globo de luz rubra', 'um globo de luz rubra'],
  seloDeOrbitas: ['Selo de órbitas', 'um selo de órbitas'],
  plataformaDeRitual: ['Plataforma de ritual', 'uma plataforma de ritual'],
  gargula: ['Gárgula', 'uma gárgula'],
  estatuaDeBesta: ['Estátua de besta', 'uma estátua de besta'],
  estatuaEncapuzada: ['Estátua encapuzada', 'uma estátua encapuzada'],
  ponteDeCorrente: ['Ponte de corrente', 'uma ponte de corrente'],
  sarcofagoEntreaberto: ['Sarcófago entreaberto', 'um sarcófago entreaberto'],
  sarcofagoDeBronze: ['Sarcófago de bronze', 'um sarcófago de bronze'],
  caixaoDeFerro: ['Caixão de ferro', 'um caixão de ferro'],
  lajeTumular: ['Laje tumular', 'uma laje tumular'],
  nichoFunerario: ['Nicho funerário', 'um nicho funerário'],
  colunaLisa: ['Coluna lisa', 'uma coluna lisa'],
  pilastraQuadrada: ['Pilastra quadrada', 'uma pilastra quadrada'],
  urnaFuneraria: ['Urna funerária', 'uma urna funerária'],
  columbario: ['Columbário', 'um columbário'],
  estradoEmMeiaLua: ['Estrado em meia-lua', 'um estrado em meia-lua'],
  sarcofagoDeCristais: ['Sarcófago de cristais', 'um sarcófago de cristais'],
  relicarioDeCristal: ['Relicário de cristal', 'um relicário de cristal'],
  lajeTumularAcesa: ['Laje tumular acesa', 'uma laje tumular acesa'],
  pedestalComCristal: ['Pedestal com cristal', 'um pedestal com cristal'],
  arandelaDeCristal: ['Arandela de cristal', 'uma arandela de cristal'],
  braseiroDeChamaFria: ['Braseiro de chama fria', 'um braseiro de chama fria'],
  ossario: ['Ossário', 'um ossário'],
  arcossolio: ['Arcossólio', 'um arcossólio'],
  seloDeCristal: ['Selo de cristal', 'um selo de cristal'],
  ponteDePedraQuebrada: ['Ponte de pedra quebrada', 'uma ponte de pedra quebrada'],
  ponteDeTabuasQuebrada: ['Ponte de tábuas quebrada', 'uma ponte de tábuas quebrada'],
  calcadaSobreAgua: ['Calçada sobre a água', 'uma calçada sobre a água'],
  muroEmRuina: ['Muro em ruína', 'um muro em ruína'],
  pedestalEntalhado: ['Pedestal entalhado', 'um pedestal entalhado'],
  colunaComGlifos: ['Coluna com glifos', 'uma coluna com glifos'],
  estelaMaia: ['Estela entalhada', 'uma estela entalhada'],
  cabanaDeLajes: ['Cabana de lajes', 'uma cabana de lajes'],
  tanqueComBorda: ['Tanque com borda de pedra', 'um tanque com borda de pedra'],
  piramideEmDegraus: ['Pirâmide em degraus', 'uma pirâmide em degraus'],
  topoDoTemplo: ['Topo do templo', 'um topo de templo'],
  cabecaColossal: ['Cabeça colossal', 'uma cabeça colossal'],
  idoloDourado: ['Ídolo dourado', 'um ídolo dourado'],
  cascataEmDegraus: ['Cascata em degraus', 'uma cascata em degraus'],
  ponteSobrePilares: ['Ponte sobre pilares', 'uma ponte sobre pilares'],
  catreDesarrumado: ['Catre desarrumado', 'um catre desarrumado'],
  camaDeCaixotes: ['Cama de caixotes', 'uma cama de caixotes'],
  mesaDeCaixote: ['Mesa de caixote', 'uma mesa de caixote'],
  cadeiraRemendada: ['Cadeira remendada', 'uma cadeira remendada'],
  bancoCorrido: ['Banco corrido', 'um banco corrido'],
  cortinaDePassagem: ['Cortina de passagem', 'uma cortina de passagem'],
  trouxaDeRoupa: ['Trouxa de roupa', 'uma trouxa de roupa'],
  passarelaDeTabuas: ['Passarela de tábuas', 'uma passarela de tábuas'],
  vasoComPiaDeAco: ['Vaso com pia de aço', 'um vaso com pia de aço'],
  mesinhaDeCela: ['Mesinha de cela', 'uma mesinha de cela'],
  mesaDePatio: ['Mesa de pátio', 'uma mesa de pátio'],
  chuveiroColetivo: ['Chuveiro coletivo', 'um chuveiro coletivo'],
  armarioDeVestiario: ['Armário de vestiário', 'um armário de vestiário'],
  cadeiraDePlastico: ['Cadeira de plástico', 'uma cadeira de plástico'],
  maquinaDeLavar: ['Máquina de lavar', 'uma máquina de lavar'],
  leitoHospitalar: ['Leito hospitalar', 'um leito hospitalar'],
  mesaComComputador: ['Mesa com computador', 'uma mesa com computador'],
  cercaDeAlambrado: ['Cerca de alambrado', 'uma cerca de alambrado'],
  arquibancadaDePedra: ['Arquibancada de pedra curva', 'uma arquibancada de pedra curva'],
  fossoDeArena: ['Fosso de arena', 'um fosso de arena'],
  balaustradaDeCamarote: ['Balaustrada de camarote', 'uma balaustrada de camarote'],
  pocoDeSangue: ['Poço de sangue', 'um poço de sangue'],
  velaNoPires: ['Vela no pires', 'uma vela no pires'],
  salamandra: ['Fogareiro de ferro', 'um fogareiro de ferro'],
  monteDeEntulho: ['Monte de entulho', 'um monte de entulho'],
  camaDeTrapos: ['Cama de trapos', 'uma cama de trapos'],
  placaDePressao: ['Placa de pressão', 'uma placa de pressão'],
  escadaDeMao: ['Escada de mão', 'uma escada de mão'],
  correntePendurada: ['Corrente pendurada', 'uma corrente pendurada'],
  portaoDeJaula: ['Portão de jaula', 'um portão de jaula'],
  laminaPendular: ['Lâmina pendular', 'uma lâmina pendular'],
  pecaDeXadrez: ['Peça de xadrez gigante', 'uma peça de xadrez gigante'],
  carrinhoDeMina: ['Carrinho de mina', 'um carrinho de mina'],
  trilhoDeMina: ['Trilho de mina', 'um trilho de mina'],
  escoraDeMina: ['Escora de mina', 'uma escora de mina'],
  pilhaDeMinerio: ['Pilha de minério', 'uma pilha de minério'],
  cano: ['Cano', 'um cano'],
  saidaDeEsgoto: ['Saída de esgoto', 'uma saída de esgoto'],
  comporta: ['Comporta', 'uma comporta'],
  fonteDeParede: ['Fonte de parede', 'uma fonte de parede'],
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

  it('silhueta redonda: a mesa redonda, o poço, o vaso, o balde de água, o moinho, o caldeirão, a banqueta, o candelabro de chão, o cesto de vime, o canteiro de flores, o toco de árvore, a árvore seca, a tenda de adivinha, a colmeia, o braseiro, o círculo mágico, a bola de cristal, a moeda de ouro, o diamante, a tocha de pé, a torre de pedra, o lustre de velas, o ouriço antitanque, a fruta de espirais, o prato de carne no osso, a lanterna de pedra japonesa, o mastro de fitas, o globo terrestre, o relógio de sol, o farol, o coreto, o quiosque, o silo, o carrossel, o cesto de roupa, o esterilizador, a cadeira giratória e o altar redondo; o resto é retângulo', () => {
    const redondos = PECAS_NOVAS.filter((tipo) => ehMovelRedondo(tipo))
    expect(redondos).toEqual(['mesaRedonda', 'vaso', 'poco', 'balde', 'moinho', 'caldeirao', 'banqueta', 'candelabroDeChao', 'cestoDeVime', 'canteiroDeFlores', 'tocoDeArvore', 'arvoreSeca', 'tendaDeAdivinha', 'colmeia', 'braseiro', 'circuloMagico', 'bolaDeCristal', 'moedaDeOuro', 'diamante', 'tochaDePe', 'torreDePedra', 'lustreDeVelas', 'ouricoAntitanque', 'frutaDeEspirais', 'pratoDeCarne', 'lanternaDePedra', 'mastroDeFitas', 'globoTerrestre', 'relogioDeSol', 'farol', 'coreto', 'quiosque', 'siloDeGraos', 'carrossel', 'cestoDeRoupa', 'esterilizador', 'cadeiraGiratoria', 'altarRedondo', 'torreDoDragao', 'montanhaPequena', 'montanhaMedia', 'montanhaGrande', 'baldeDeDejetos', 'braseiroComFerros', 'rodaDeTortura', 'fossoDoSalao', 'globoDeLuzRubra', 'seloDeOrbitas', 'plataformaDeRitual', 'colunaLisa', 'braseiroDeChamaFria', 'pedestalEntalhado', 'pocoDeSangue', 'velaNoPires'])
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
    // O banheiro moderno (15/11/2026) entra antes das construções: cada fatia abaixo andou 12 para trás; as 22
    // referências (16/11/2026), mais 22; a caixa quebrada (16/11/2026), junto do barril quebrado, mais 1 até a
    // fatia dela.
    expect(TIPOS_NO_CATALOGO.slice(-398, -391)).toEqual(['arcoDoPortao', 'placaDeSeta', 'troncos', 'feno', 'cataVento', 'moinho', 'cataVentoBrinquedo'])
    expect(TIPOS_NO_CATALOGO.slice(-391, -386)).toEqual(['destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho'])
    expect(TIPOS_NO_CATALOGO.slice(-386, -378)).toEqual(['bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao'])
    expect(TIPOS_NO_CATALOGO.slice(-378, -370)).toEqual(['guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha'])
    expect(TIPOS_NO_CATALOGO.slice(-370, -361)).toEqual(['bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica'])
    expect(TIPOS_NO_CATALOGO.slice(-361, -353)).toEqual(['escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao'])
    expect(TIPOS_NO_CATALOGO.slice(-353, -347)).toEqual(['banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne'])
    expect(TIPOS_NO_CATALOGO.slice(-347, -341)).toEqual(['pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre'])
    expect(TIPOS_NO_CATALOGO.slice(-341, -334)).toEqual(['varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja'])
    expect(TIPOS_NO_CATALOGO.slice(-334, -328)).toEqual(['cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca'])
    expect(TIPOS_NO_CATALOGO.slice(-328, -322)).toEqual(['balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe'])
    expect(TIPOS_NO_CATALOGO.slice(-322, -313)).toEqual(['fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras'])
    expect(TIPOS_NO_CATALOGO.slice(-313, -304)).toEqual(['carrocaQuebrada', 'barrilQuebrado', 'caixaQuebrada', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca'])
    expect(TIPOS_NO_CATALOGO.slice(-304, -295)).toEqual(['ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura'])
    expect(TIPOS_NO_CATALOGO.slice(-295, -287)).toEqual(['braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado'])
    expect(TIPOS_NO_CATALOGO.slice(-287, -277)).toEqual([
      'potroDeTortura', 'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'mesaDeInstrumentos', 'sangueNoChao',
      'estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro',
    ])
    expect(TIPOS_NO_CATALOGO.slice(-277, -262)).toEqual([
      'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
      'teiaDeAranha', 'tochaDeParede', 'tochaDePe', 'cranio', 'tenda', 'torreDePedra', 'torreDeVigia',
    ])
    // Os objetos de 14/11/2026, na ordem da lista do dia: o lote L01 (o castelo), o L02 (o resto do castelo), o L03 (o
    // cerco e a defesa), o L04 (o fim do cerco e o começo da base militar), o L05 (o meio da base militar), o L06 (o
    // resto da base militar), o L07 e o L08 (o mar e os piratas), o L09 e o L10 (a taverna e a festa), o L11 e o L12 (o
    // descanso e a brincadeira), o L13 (o torneio e a cidade), o L14 (o resto da cidade e vila) e a ponte levadiça do
    // L02 (o item 81 da lista).
    expect(TIPOS_NO_CATALOGO.slice(-262, -179)).toEqual([
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
    // O banheiro moderno de 15/11/2026, o lote A (as peças grandes) e o lote B (as pequenas). As referências de
    // 16/11/2026 entram depois dele: cada fatia acima andou mais 22 para trás.
    expect(TIPOS_NO_CATALOGO.slice(-179, -167)).toEqual([
      'vasoSanitarioModerno', 'bide', 'boxDeChuveiro', 'banheiraModerna', 'gabineteDeBanheiro', 'armarioDeBanheiro',
      'toalheiro', 'cestoDeRoupa', 'prateleiraDeFrascos', 'lixeiraDePedal', 'tapeteDeBanheiro', 'portaPapel',
    ])
    // As referências (16/11/2026), o lote L1 (o necrotério e o laboratório) e o lote L2, o último bloco do Objeto.
    expect(TIPOS_NO_CATALOGO.slice(-167, -145)).toEqual([
      'mesaDeAutopsia', 'macaComLencol', 'camaraFrigorifica', 'esterilizador', 'luminariaArticulada',
      'bandejaDeInstrumentos', 'mesaDeLaboratorio', 'panelasEBacias', 'cadeiraGiratoria', 'maquinaDeEscrever',
      'elevadorAntigo', 'alcapao', 'deckDeMadeira', 'colunaQuebrada', 'altarRedondo', 'lajeDeSacrificio', 'tumuloDePedra',
      'carroAntigo', 'prateleiraDeToalhas', 'cadeiraDeEspaldarAlto', 'centroDeMesa', 'lapideTorta',
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
    // A leva E2 (16/11/2026): a torre do dragão e as três montanhas, entre o lote L2 e as construções de 14/11/2026
    // (as fatias de antes delas andaram 4 para trás).
    expect(TIPOS_NO_CATALOGO.slice(-145, -141)).toEqual(['torreDoDragao', 'montanhaPequena', 'montanhaMedia', 'montanhaGrande'])
    // A estátua de cavalo (21/11/2026), com e sem o pedestal, entre a leva E2 e as construções (as fatias de antes
    // dela andaram 2 para trás).
    expect(TIPOS_NO_CATALOGO.slice(-141, -139)).toEqual(['estatuaDeCavalo', 'estatuaDeCavaloSemPedestal'])
    // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md): os 96 logo depois da estátua (as fatias de antes andaram 96 para trás), os objetos e depois as construções.
    expect(TIPOS_NO_CATALOGO.slice(-139, -29)).toEqual([
      'cadeiraDeFerro', 'mesaDeFerro', 'catreDeFerro', 'esteiraDePalha', 'baldeDeDejetos', 'grilhoesDeParede',
      'bolaDeFerroComCorrente', 'latrinaDeCela', 'bancoDePedra', 'mesaDoCarcereiro', 'quadroDeChaves', 'jaulaDeChao',
      'raloDeMasmorra', 'bauDeFerro', 'tabuaDePregos', 'cepoDoCarrasco', 'posteDeAcoite', 'gradeDeCorredor',
      'corpoAmortalhado', 'pranchaDeTortura', 'braseiroComFerros', 'rodaDeTortura', 'guilhotina', 'pertencesConfiscados',
      'guinchoDeCorrente', 'pilarComBraseiro', 'lanternaGradeada', 'globoDeLuzRubra', 'seloDeOrbitas', 'sarcofagoEntreaberto',
      'sarcofagoDeBronze', 'caixaoDeFerro', 'lajeTumular', 'nichoFunerario', 'colunaLisa', 'pilastraQuadrada',
      'urnaFuneraria', 'sarcofagoDeCristais', 'relicarioDeCristal', 'lajeTumularAcesa', 'pedestalComCristal', 'arandelaDeCristal',
      'braseiroDeChamaFria', 'ossario', 'seloDeCristal', 'muroEmRuina', 'pedestalEntalhado', 'colunaComGlifos',
      'estelaMaia', 'cabecaColossal', 'idoloDourado', 'catreDesarrumado', 'camaDeCaixotes', 'mesaDeCaixote',
      'cadeiraRemendada', 'bancoCorrido', 'cortinaDePassagem', 'trouxaDeRoupa', 'vasoComPiaDeAco', 'mesinhaDeCela',
      'mesaDePatio', 'chuveiroColetivo', 'armarioDeVestiario', 'cadeiraDePlastico', 'maquinaDeLavar', 'leitoHospitalar',
      'mesaComComputador', 'cercaDeAlambrado', 'balaustradaDeCamarote', 'pocoDeSangue', 'velaNoPires', 'salamandra',
      'monteDeEntulho', 'camaDeTrapos', 'placaDePressao', 'escadaDeMao', 'correntePendurada', 'portaoDeJaula', 'laminaPendular', 'pecaDeXadrez',
      'carrinhoDeMina', 'trilhoDeMina', 'escoraDeMina', 'pilhaDeMinerio', 'cano', 'saidaDeEsgoto', 'comporta', 'fonteDeParede', 'fossoDeBrasas', 'fossoDoSalao', 'plataformaDeRitual', 'gargula',
      'estatuaDeBesta', 'estatuaEncapuzada', 'ponteDeCorrente', 'columbario', 'estradoEmMeiaLua', 'arcossolio',
      'ponteDePedraQuebrada', 'ponteDeTabuasQuebrada', 'calcadaSobreAgua', 'cabanaDeLajes', 'tanqueComBorda', 'piramideEmDegraus',
      'topoDoTemplo', 'cascataEmDegraus', 'ponteSobrePilares', 'passarelaDeTabuas', 'arquibancadaDePedra', 'fossoDeArena',
    ])
    // 26 de antes, os 8 móveis de casa de 28/10/2026 (fogão, geladeira, pia, balcão, pratos, privada, sofá, poltrona)
    // e os 6 de 29/10/2026 (lareira, fornalha, bigorna, balde, troncos, feno).
    // E o chafariz de 02/11/2026, logo depois do poço, e os 3 objetos de vento no fim; a ponte de 03/11/2026
    // logo depois do chafariz. A cova e os dois caixões de 07/11/2026 logo depois da lápide.
    const lapide = TIPOS_NO_CATALOGO.indexOf('lapide')
    expect(TIPOS_NO_CATALOGO.slice(lapide, lapide + 4)).toEqual(['lapide', 'cova', 'caixao', 'caixaoAberto'])
    // E o muro de fogo de 15/11/2026, logo depois do fogo, as 12 peças do banheiro moderno e as 22 das referências;
    // a caixa quebrada de 16/11/2026, logo depois do barril quebrado; e as 4 da leva E2 (a torre do dragão e as
    // três montanhas); e as 2 da estátua de cavalo (21/11/2026); e as 6 peças novas do plano de arte por tema (28/11/2026).
    expect(TIPOS_NO_CATALOGO).toHaveLength(440)
    for (const tipo of TIPOS_NO_CATALOGO) expect(TIPOS_COM_TEXTURA.some((t) => t === tipo), tipo).toBe(true)
    expect(new Set(TIPOS_NO_CATALOGO).size).toBe(TIPOS_NO_CATALOGO.length)
  })

  it('a busca da ficha acha as três sucatas por "metal" (o mestre pediu "sucatas de metal") e por "sucata"', () => {
    const itens = TIPOS_NO_CATALOGO.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    expect(acharObjetos(itens, 'metal').map((item) => item.tipo)).toEqual(['sucataChapas', 'sucataEngrenagens', 'sucataTambores'])
    // Por "sucata": as três pelo nome e, depois, os destroços, os escombros de pedra, os ossos, os quatro do
    // lote 11 (11/11/2026: a carroça quebrada, o barril quebrado, a viga caída e a armadura enferrujada) com a
    // caixa quebrada (16/11/2026), a armadura despedaçada do lote 15 (11/11/2026) e o crânio do lote 17
    // (12/11/2026) pelo título do grupo.
    expect(acharObjetos(itens, 'sucata').map((item) => item.tipo)).toEqual([
      'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'destrocosDeMadeira', 'escombrosDePedra', 'ossos',
      'carrocaQuebrada', 'barrilQuebrado', 'caixaQuebrada', 'vigaCaida', 'armaduraEnferrujada', 'armaduraDespedacada',
      'cranio', 'monteDeEntulho',
    ])
  })

  it('a busca da ficha acha os objetos dos quatro grupos novos de 11/11/2026 pelo título do grupo: "navio" traz o canhão e o lote 12, "templo", o altar, a armadura do lote 15 e os dos lotes 13 e 16, "tortura", o lote 14, e "alquimia", os três últimos do lote 13', () => {
    // CONSTRUÇÕES (12/11/2026, `14fef595`): a ficha do Objeto busca no catálogo DELE (`TIPOS_DO_OBJETO`, sem as
    // 19 construções). O pilar e os três blocos de inscrições moram em "Monumentos e colunas", na Construção.
    const itens = TIPOS_DO_OBJETO.map((tipo) => ({ tipo, rotulo: ROTULO_MOBILIA[tipo], grupo: GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo ?? '' }))
    // A prancha do navio e o navio na garrafa (lote L08, 14/11/2026) têm "navio" no nome: vêm primeiro, antes do grupo.
    expect(acharObjetos(itens, 'navio').map((item) => item.tipo)).toEqual(['pranchaDoNavio', 'navioNaGarrafa', 'canhao', 'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe'])
    // E, das referências (16/11/2026), o alçapão, a coluna quebrada, o altar redondo e a laje de sacrifício no fim, na
    // ordem do catálogo.
    expect(acharObjetos(itens, 'templo').map((item) => item.tipo)).toEqual([
      'altar', 'armadura', 'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos',
      'circuloMagico', 'teiaDeAranha', 'tochaDeParede', 'tochaDePe', 'alcapao', 'colunaQuebrada',
      'altarRedondo', 'lajeDeSacrificio', 'cadeiraDeFerro', 'mesaDeFerro', 'catreDeFerro', 'esteiraDePalha',
      'baldeDeDejetos', 'grilhoesDeParede', 'bolaDeFerroComCorrente', 'latrinaDeCela', 'bancoDePedra', 'mesaDoCarcereiro',
      'quadroDeChaves', 'jaulaDeChao', 'bauDeFerro', 'gradeDeCorredor', 'corpoAmortalhado', 'pertencesConfiscados',
      'pilarComBraseiro', 'lanternaGradeada', 'seloDeOrbitas', 'colunaLisa', 'pilastraQuadrada', 'pedestalComCristal',
      'arandelaDeCristal', 'braseiroDeChamaFria', 'seloDeCristal', 'muroEmRuina', 'pedestalEntalhado', 'colunaComGlifos',
      'estelaMaia', 'cabecaColossal', 'idoloDourado', 'mesinhaDeCela', 'placaDePressao', 'escadaDeMao', 'correntePendurada', 'portaoDeJaula', 'laminaPendular',
    ])
    const monumentos: TipoMobilia[] = ['pilar', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado']
    expect(monumentos.map((tipo) => GRUPOS_DE_OBJETO.find((g) => g.id === grupoDoObjeto(tipo))?.titulo)).toEqual([
      'Monumentos e colunas', 'Monumentos e colunas', 'Monumentos e colunas', 'Monumentos e colunas',
    ])
    // Por "tortura": o potro e a mesa de instrumentos pelo nome, os outros cinco pelo título do grupo.
    expect(acharObjetos(itens, 'tortura').map((item) => item.tipo)).toEqual([
      'potroDeTortura', 'mesaDeInstrumentos', 'pranchaDeTortura', 'rodaDeTortura', 'damaDeFerro', 'troncoDePrisioneiro',
      'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'sangueNoChao', 'raloDeMasmorra', 'tabuaDePregos', 'cepoDoCarrasco',
      'posteDeAcoite', 'braseiroComFerros', 'guilhotina', 'guinchoDeCorrente', 'pocoDeSangue',
    ])
    expect(acharObjetos(itens, 'alquimia').map((item) => item.tipo)).toEqual([
      'estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro', 'globoDeLuzRubra',
    ])
    // Os grupos novos entram antes de "Outros", que continua no fim; o Tesouro (12/11/2026) logo depois da Magia.
    // E os 4 grupos da Construção (12/11/2026, `construcoes.ts`) depois do Tesouro, ainda antes de "Outros". Os grupos
    // do Objeto de 14/11/2026 (o castelo, o cerco e a defesa, a base militar, o mar e piratas, a taverna e festa, o
    // descanso e brincadeira e a cidade e vila) entram entre o Tesouro e os da Construção. Os 5 grupos da Construção
    // de 14/11/2026, com os títulos da lista do dia (castelo, base militar, cidade e porto, vila e campo e lazer), depois
    // dos 4 dela, antes de "Outros". O castelo e a base militar têm o mesmo título nas duas ferramentas e ids diferentes.
    // O Necrotério e laboratório (16/11/2026) entra logo depois da Magia e alquimia.
    // A leva E2 (16/11/2026): "Natureza e relevo" (as montanhas) depois do Lazer, antes de "Outros".
    expect(GRUPOS_DE_OBJETO.slice(-24).map((g) => g.titulo)).toEqual([
      'Porto e navio', 'Templo e masmorra', 'Sala de tortura', 'Magia e alquimia', 'Necrotério e laboratório', 'Tesouro', 'Castelo', 'Cerco e defesa', 'Base militar', 'Mar e piratas', 'Taverna e festa',
      'Descanso e brincadeira', 'Cidade e vila',
      'Torres e prédios', 'Praça, rua e campo', 'Monumentos e colunas', 'Abrigos e passagens',
      'Castelo', 'Base militar', 'Cidade e porto', 'Vila e campo', 'Lazer', 'Natureza e relevo', 'Outros',
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
    // As três torres de 14/11/2026 (a de cerco, a do sino e a de rádio) também pelo nome. A caixa d'água elevada, o
    // pombal e o silo moram nos grupos da lista do dia (base militar e vila e campo), não em "Torres e prédios".
    expect(acharObjetos(dasFichas(TIPOS_DA_CONSTRUCAO), 'torre').map((item) => item.tipo)).toEqual([
      'torreDePedra', 'torreDeVigia', 'torreDoDragao', 'torreDeCerco', 'torreDoSino', 'torreDeRadio',
      'barraca', 'moinho', 'mausoleu', 'galinheiro',
    ])
    expect(acharObjetos(itens, 'tocha').map((item) => item.tipo)).toEqual(['tochaDeParede', 'tochaDePe'])
    expect(acharObjetos(itens, 'joia').map((item) => item.tipo)).toEqual(['joia', 'monteDeJoias'])
    expect(acharObjetos(itens, 'diamante').map((item) => item.tipo)).toEqual(['diamante', 'monteDeDiamantes'])
  })
})
