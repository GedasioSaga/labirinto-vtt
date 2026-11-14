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
import { montarBalancaDeMercador } from './balancaDeMercador'
import { montarTendaDeAdivinha } from './tendaDeAdivinha'
import { montarGaiolaComAves } from './gaiolaComAves'
import { montarRolosDeTecido } from './rolosDeTecido'
import { montarPalcoDeBardo } from './palcoDeBardo'
import { montarBarrilDePeixe } from './barrilDePeixe'
import { montarFole } from './fole'
import { montarManequimComArmadura } from './manequimComArmadura'
import { montarPilhaDeLingotes } from './pilhaDeLingotes'
import { montarSerra } from './serra'
import { montarGalinheiro } from './galinheiro'
import { montarColmeia } from './colmeia'
import { montarArado } from './arado'
import { montarTocoComMachado } from './tocoComMachado'
import { montarPlantacaoEmFileiras } from './plantacaoEmFileiras'
import { montarCarrocaQuebrada } from './carrocaQuebrada'
import { montarBarrilQuebrado } from './barrilQuebrado'
import { montarVigaCaida } from './vigaCaida'
import { montarArmaduraEnferrujada } from './armaduraEnferrujada'
import { montarMesaDeJogo } from './mesaDeJogo'
import { montarRingueDeLuta } from './ringueDeLuta'
import { montarBalanco } from './balanco'
import { montarMesaDeSinuca } from './mesaDeSinuca'
import { montarAncora } from './ancora'
import { montarCordasEnroladas } from './cordasEnroladas'
import { montarTimao } from './timao'
import { montarBote } from './bote'
import { montarRedeDePesca } from './redeDePesca'
import { montarPier } from './pier'
import { montarCaixoteDePeixe } from './caixoteDePeixe'
import { montarArmaduraDespedacada } from './armaduraDespedacada'
import { montarArmadura } from './armadura'
import { montarBraseiro } from './braseiro'
import { montarCelaComGrade } from './celaComGrade'
import { montarCorrente } from './corrente'
import { montarArmadilhaDeEspinhos } from './armadilhaDeEspinhos'
import { montarCirculoMagico } from './circuloMagico'
import { montarBlocoDeInscricoesAzul } from './blocoDeInscricoesAzul'
import { montarBlocoDeInscricoesVermelho } from './blocoDeInscricoesVermelho'
import { montarBlocoDeInscricoesDourado } from './blocoDeInscricoesDourado'
import { montarPotroDeTortura } from './potroDeTortura'
import { montarDamaDeFerro } from './damaDeFerro'
import { montarTroncoDePrisioneiro } from './troncoDePrisioneiro'
import { montarGaiolaSuspensa } from './gaiolaSuspensa'
import { montarCadeiraDeInterrogatorio } from './cadeiraDeInterrogatorio'
import { montarMesaDeInstrumentos } from './mesaDeInstrumentos'
import { montarSangueNoChao } from './sangueNoChao'
import { montarEstanteDePocoes } from './estanteDePocoes'
import { montarBolaDeCristal } from './bolaDeCristal'
import { montarPedestalComLivro } from './pedestalComLivro'
import { montarBarraDeOuro } from './barraDeOuro'
import { montarMonteDeOuro } from './monteDeOuro'
import { montarMoedaDeOuro } from './moedaDeOuro'
import { montarMonteDeMoedasDeOuro } from './monteDeMoedasDeOuro'
import { montarDiamante } from './diamante'
import { montarMonteDeDiamantes } from './monteDeDiamantes'
import { montarJoia } from './joia'
import { montarMonteDeJoias } from './monteDeJoias'
import { montarTeiaDeAranha } from './teiaDeAranha'
import { montarTochaDeParede } from './tochaDeParede'
import { montarTochaDePe } from './tochaDePe'
import { montarCranio } from './cranio'
import { montarTenda } from './tenda'
import { montarTorreDePedra } from './torreDePedra'
import { montarTorreDeVigia } from './torreDeVigia'
import { montarTronoReal } from './tronoReal'
import { montarCamaDeDossel } from './camaDeDossel'
import { montarEstandarteDePe } from './estandarteDePe'
import { montarTapecariaDeParede } from './tapecariaDeParede'
import { montarLustreDeVelas } from './lustreDeVelas'
import { montarPanoplia } from './panoplia'
import { montarMesaDeBanquete } from './mesaDeBanquete'
import { montarBancosDeCapela } from './bancosDeCapela'
import { montarMesaDeGuerra } from './mesaDeGuerra'
import { montarPoleiroDeFalcao } from './poleiroDeFalcao'
import { montarAljavasEFlechas } from './aljavasEFlechas'
import { montarCatapulta } from './catapulta'
import { montarBalista } from './balista'
import { montarArieteComTeto } from './arieteComTeto'
import { montarEscadaDeCerco } from './escadaDeCerco'
import { montarCavaloDeFrisa } from './cavaloDeFrisa'
import { montarPilhaDeBalasDeCanhao } from './pilhaDeBalasDeCanhao'
import { montarTachoDeOleoQuente } from './tachoDeOleoQuente'
import { montarSacosDeAreia } from './sacosDeAreia'
import { montarCaixasDeMunicao } from './caixasDeMunicao'
import { montarOuricoAntitanque } from './ouricoAntitanque'
import { montarArameFarpado } from './arameFarpado'
import { montarBarreiraDeConcreto } from './barreiraDeConcreto'
import { montarCancelaListrada } from './cancelaListrada'
import { montarBeliche } from './beliche'
import { montarArmarioDeFerro } from './armarioDeFerro'
import { montarRadioDeCampanha } from './radioDeCampanha'
import { montarHolofote } from './holofote'
import { montarRedeDeCamuflagem } from './redeDeCamuflagem'
import { montarMetralhadoraNoTripe } from './metralhadoraNoTripe'
import { montarPaletesDeMadeira } from './paletesDeMadeira'
import { montarGerador } from './gerador'
import { montarMastroComBandeira } from './mastroComBandeira'
import { montarCaracolTelefone } from './caracolTelefone'
import { montarCaracolTelefoneCamera } from './caracolTelefoneCamera'
import { montarCaracolTelefoneDourado } from './caracolTelefoneDourado'
import { montarCartazDeProcurado } from './cartazDeProcurado'
import { montarFrutaDeEspirais } from './frutaDeEspirais'
import { montarBandeiraPirata } from './bandeiraPirata'
import { montarMesaDeNavegacao } from './mesaDeNavegacao'
import { montarLaranjeiraEmCanteiro } from './laranjeiraEmCanteiro'
import { montarPonteLevadica } from './ponteLevadica'
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
  // o candelabro de chão leem o `giro` (o quarto de volta que a 3/4 pinta). Desde 12/11/2026 (achado V2) o quarto
  // é pintado também de cima, com o mesmo `giro`: a sombra pintada da banqueta e a do biombo já saem desviradas.
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
  // Lote 9 dos 95 objetos novos (11/11/2026), a feira: um desenho por arquivo. A balança de mercador, a tenda de
  // adivinha e a gaiola com aves leem o `giro` (o quarto de volta que a 3/4 pinta); os rolos de tecido, o palco
  // de bardo e o barril de peixe, não.
  balancaDeMercador: montarBalancaDeMercador,
  tendaDeAdivinha: montarTendaDeAdivinha,
  gaiolaComAves: montarGaiolaComAves,
  rolosDeTecido: montarRolosDeTecido,
  palcoDeBardo: montarPalcoDeBardo,
  barrilDePeixe: montarBarrilDePeixe,
  // Lote 10 dos 95 objetos novos (11/11/2026), a oficina e a fazenda: um desenho por arquivo. O galinheiro, a
  // colmeia e a plantação em fileiras leem o `giro` (o quarto de volta que a 3/4 pinta); o fole, o manequim com
  // armadura, a pilha de lingotes, a serra, o arado e o toco com machado, não.
  fole: montarFole,
  manequimComArmadura: montarManequimComArmadura,
  pilhaDeLingotes: montarPilhaDeLingotes,
  serra: montarSerra,
  galinheiro: montarGalinheiro,
  colmeia: montarColmeia,
  arado: montarArado,
  tocoComMachado: montarTocoComMachado,
  plantacaoEmFileiras: montarPlantacaoEmFileiras,
  // Lote 11 dos 95 objetos novos (11/11/2026), os destroços e o esporte: um desenho por arquivo. A armadura
  // enferrujada, a mesa de jogo, o ringue de luta, o balanço e a mesa de sinuca leem o `giro` (o quarto de volta
  // que a 3/4 pinta); a carroça quebrada, o barril quebrado e a viga caída, não.
  carrocaQuebrada: montarCarrocaQuebrada,
  barrilQuebrado: montarBarrilQuebrado,
  vigaCaida: montarVigaCaida,
  armaduraEnferrujada: montarArmaduraEnferrujada,
  mesaDeJogo: montarMesaDeJogo,
  ringueDeLuta: montarRingueDeLuta,
  balanco: montarBalanco,
  mesaDeSinuca: montarMesaDeSinuca,
  // Lote 12 dos 95 objetos novos (11/11/2026), o porto e o navio, e o lote 15, as duas armaduras: um desenho por
  // arquivo. O bote, a rede de pesca, o píer e a armadura despedaçada leem o `giro` (o quarto de volta que a 3/4
  // pinta); a âncora, as cordas enroladas, o timão, o caixote de peixe e a armadura de pé, não.
  ancora: montarAncora,
  cordasEnroladas: montarCordasEnroladas,
  timao: montarTimao,
  bote: montarBote,
  redeDePesca: montarRedeDePesca,
  pier: montarPier,
  caixoteDePeixe: montarCaixoteDePeixe,
  armaduraDespedacada: montarArmaduraDespedacada,
  armadura: montarArmadura,
  // Lotes 13 e 16 dos 95 objetos novos (11/11/2026), o templo e a masmorra: um desenho por arquivo; os três
  // blocos de inscrições dividem `blocoDeInscricoes.ts`, que não é objeto e não entra aqui. O braseiro, a cela
  // com grade, a armadilha de espinhos e os três blocos leem o `giro` (o quarto de volta que a 3/4 pinta); a
  // corrente e o círculo mágico, não. No braseiro o fogo aceso ou apagado chega na `variante`, como na lareira.
  braseiro: montarBraseiro,
  celaComGrade: montarCelaComGrade,
  corrente: montarCorrente,
  armadilhaDeEspinhos: montarArmadilhaDeEspinhos,
  circuloMagico: montarCirculoMagico,
  blocoDeInscricoesAzul: montarBlocoDeInscricoesAzul,
  blocoDeInscricoesVermelho: montarBlocoDeInscricoesVermelho,
  blocoDeInscricoesDourado: montarBlocoDeInscricoesDourado,
  // Lote 14 dos objetos novos (11/11/2026), a sala de tortura, e os três últimos do lote 13, a magia e a
  // alquimia: um desenho por arquivo. O potro, a dama de ferro, o tronco, a gaiola suspensa, a cadeira de
  // interrogatório, a bola de cristal e o pedestal leem o `giro` (o quarto de volta que a 3/4 pinta); a mesa de
  // instrumentos, o sangue no chão e a estante de poções, não. A estante lê a `variante`, como a estante de
  // livros, que não chega ligada a nada: as duas ficam sempre na arrumação 0.
  potroDeTortura: montarPotroDeTortura,
  damaDeFerro: montarDamaDeFerro,
  troncoDePrisioneiro: montarTroncoDePrisioneiro,
  gaiolaSuspensa: montarGaiolaSuspensa,
  cadeiraDeInterrogatorio: montarCadeiraDeInterrogatorio,
  mesaDeInstrumentos: montarMesaDeInstrumentos,
  sangueNoChao: montarSangueNoChao,
  estanteDePocoes: montarEstanteDePocoes,
  bolaDeCristal: montarBolaDeCristal,
  pedestalComLivro: montarPedestalComLivro,
  // Lote 17 dos objetos novos (12/11/2026): um desenho por arquivo; o ouro divide `tesouroDeOuro.ts` e as
  // pedras e as joias, `pedraLapidada.ts`, que não são objeto e não entram aqui. Leem o `giro` (o quarto de
  // volta que a 3/4 pinta) os oito do tesouro (a barra, em pé, chega com 0), a teia de aranha, a tocha de pé, a
  // tenda e as duas torres; a tocha de parede e o crânio, não. Nas duas tochas o fogo aceso ou apagado chega na
  // `variante`, como no braseiro.
  barraDeOuro: montarBarraDeOuro,
  monteDeOuro: montarMonteDeOuro,
  moedaDeOuro: montarMoedaDeOuro,
  monteDeMoedasDeOuro: montarMonteDeMoedasDeOuro,
  diamante: montarDiamante,
  monteDeDiamantes: montarMonteDeDiamantes,
  joia: montarJoia,
  monteDeJoias: montarMonteDeJoias,
  teiaDeAranha: montarTeiaDeAranha,
  tochaDeParede: montarTochaDeParede,
  tochaDePe: montarTochaDePe,
  cranio: montarCranio,
  tenda: montarTenda,
  torreDePedra: montarTorreDePedra,
  torreDeVigia: montarTorreDeVigia,
  tronoReal: montarTronoReal,
  camaDeDossel: montarCamaDeDossel,
  estandarteDePe: montarEstandarteDePe,
  tapecariaDeParede: montarTapecariaDeParede,
  lustreDeVelas: montarLustreDeVelas,
  panoplia: montarPanoplia,
  mesaDeBanquete: montarMesaDeBanquete,
  bancosDeCapela: montarBancosDeCapela,
  mesaDeGuerra: montarMesaDeGuerra,
  poleiroDeFalcao: montarPoleiroDeFalcao,
  aljavasEFlechas: montarAljavasEFlechas,
  catapulta: montarCatapulta,
  balista: montarBalista,
  arieteComTeto: montarArieteComTeto,
  escadaDeCerco: montarEscadaDeCerco,
  cavaloDeFrisa: montarCavaloDeFrisa,
  pilhaDeBalasDeCanhao: montarPilhaDeBalasDeCanhao,
  tachoDeOleoQuente: montarTachoDeOleoQuente,
  sacosDeAreia: montarSacosDeAreia,
  caixasDeMunicao: montarCaixasDeMunicao,
  ouricoAntitanque: montarOuricoAntitanque,
  arameFarpado: montarArameFarpado,
  barreiraDeConcreto: montarBarreiraDeConcreto,
  cancelaListrada: montarCancelaListrada,
  beliche: montarBeliche,
  armarioDeFerro: montarArmarioDeFerro,
  radioDeCampanha: montarRadioDeCampanha,
  holofote: montarHolofote,
  redeDeCamuflagem: montarRedeDeCamuflagem,
  metralhadoraNoTripe: montarMetralhadoraNoTripe,
  paletesDeMadeira: montarPaletesDeMadeira,
  gerador: montarGerador,
  mastroComBandeira: montarMastroComBandeira,
  caracolTelefone: montarCaracolTelefone,
  caracolTelefoneCamera: montarCaracolTelefoneCamera,
  caracolTelefoneDourado: montarCaracolTelefoneDourado,
  cartazDeProcurado: montarCartazDeProcurado,
  frutaDeEspirais: montarFrutaDeEspirais,
  bandeiraPirata: montarBandeiraPirata,
  mesaDeNavegacao: montarMesaDeNavegacao,
  laranjeiraEmCanteiro: montarLaranjeiraEmCanteiro,
  ponteLevadica: montarPonteLevadica,
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
  'balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe',
  'fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras',
  'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca',
  'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura',
  'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado',
  'potroDeTortura', 'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'mesaDeInstrumentos', 'sangueNoChao',
  'estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro',
  'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
  'teiaDeAranha', 'tochaDeParede', 'tochaDePe', 'cranio', 'tenda', 'torreDePedra', 'torreDeVigia',
  'tronoReal', 'camaDeDossel', 'estandarteDePe', 'tapecariaDeParede', 'lustreDeVelas', 'panoplia',
  'mesaDeBanquete', 'bancosDeCapela', 'mesaDeGuerra', 'poleiroDeFalcao', 'aljavasEFlechas',
  'catapulta', 'balista', 'arieteComTeto', 'escadaDeCerco',
  'cavaloDeFrisa', 'pilhaDeBalasDeCanhao', 'tachoDeOleoQuente', 'sacosDeAreia', 'caixasDeMunicao', 'ouricoAntitanque',
  'arameFarpado', 'barreiraDeConcreto', 'cancelaListrada', 'beliche', 'armarioDeFerro', 'radioDeCampanha',
  'holofote', 'redeDeCamuflagem', 'metralhadoraNoTripe', 'paletesDeMadeira', 'gerador', 'mastroComBandeira',
  'caracolTelefone', 'caracolTelefoneCamera', 'caracolTelefoneDourado', 'cartazDeProcurado', 'frutaDeEspirais', 'bandeiraPirata',
  'mesaDeNavegacao', 'laranjeiraEmCanteiro',
  'ponteLevadica',
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
   * O giro do objeto em quartos de volta (90, 180 ou 270; ausente = 0), na
   * placa de seta e nos móveis derivados da 3/4, nas duas vistas
   * (`giroDaImagem`). A cena sai pintada já girada, com a sombra e a luz no
   * lugar de sempre; a tela gira a imagem só pelo que sobra.
   */
  readonly giro?: number
  /**
   * Vista 3/4 do mapa (MT11, `tresQuartos.ts`): o tampo sobe e a frente
   * aparece embaixo. Ausente = "de cima com volume".
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
  // O quarto de volta é pintado NAS DUAS VISTAS (achado V2 de 12/11/2026): a forma das sombras gira com a cena e o
  // deslocamento delas entra depois, na pintura, então a sombra cai sempre para baixo à direita. Na 3/4 é pintado
  // antes de subir o tampo (a frente fica embaixo na tela). A placa já pinta o dela no desenho.
  const girada = pintaOGiroNaTresQuartos(d.tipo, d.lado) ? girarCena(cena, (d.giro ?? 0) / 90) : cena
  if (d.vista !== 'tres-quartos') return girada
  return cenaEmTresQuartos(girada, perfilDoTresQuartos(d.tipo, d.lado), contexto.peca)
}

/** A imagem inteira de uma vez, em `S` pixels por px do protótipo (teste e folha de contato). */
export function pintarMovel(d: DesenhoDoMovel, S: number): { limites: LimitesDaImagem; pixels: Uint8ClampedArray } {
  return pintarCena(montarCena(d), S)
}
