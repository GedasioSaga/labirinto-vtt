/**
 * VISTA 3/4 DOS MÓVEIS (fatia MT11): a cena "de cima com volume" de qualquer
 * móvel do catálogo vira a 3/4 do protótipo aprovado (`docs/design/objetos/
 * prototipo/objetos.js`, vista '34'): o TAMPO sobe pela altura do móvel e a
 * FRENTE aparece embaixo dele, mais escura (0,74, a `FRENTE` do protótipo),
 * com a base apoiada na pegada e a sombra de baixo no pé.
 *
 * As alturas não são inventadas aqui: saem das SOMBRAS que cada móvel já
 * declara na vista de cima. Sombra presa ao chão com altura (`z > 0`, sem
 * `solta`) é uma COLUNA (o corpo do barril, a perna da mesa, o mourão); sombra
 * `solta` é um TAMPO no ar (o da mesa, o assento, a trave do arco). Cada peça
 * sobe a altura da estrutura em que está (a mais alta que contém o meio
 * dela); cada coluna ganha a frente varrida do chão até a altura dela, e cada
 * tampo, a beirada. As estruturas saem do norte para o sul (a base mais ao sul
 * por cima), cada uma com a frente por baixo das peças dela.
 *
 * Os móveis que JÁ são desenhados em pé (a lápide, o quadro de avisos, a
 * barraca e a vista Lado dos tipos com vista) ficam como estão e ganham só a
 * sombra de baixo, como no protótipo (as colunas "Lado, de cima" e "Lado,
 * 3/4" da folha aprovada quase não diferem).
 *
 * GIRO: na 3/4 a frente fica sempre embaixo NA TELA. O quarto de volta do
 * objeto é pintado na cena (`girarCena`, com a luz e a sombra fixas, como a
 * placa de seta da MT5) antes de subir o tampo; o que sobra do giro gira a
 * imagem inteira, como sempre.
 */
import type { TipoMobilia } from '../../../lib/mobilia/tipos'
import { ALTURA_DA_LENHA_EM_TRES_QUARTOS } from '../../../lib/mobilia/vistaTresQuartos'
import { G, PREGO, QUARTO, type LadoDoMovel } from './contexto'
import { elipse, type Caixa, type Forma } from './formas'
import { SOMBRA_DO_TAPETE } from './tapete'
import { ESPESSURA_DO_CAPITEL } from './pilar'
import { ESPESSURA_DO_TAMPO_DO_ALTAR } from './altar'
import { ESPESSURA_DO_ARCO_DO_FORNO } from './fornoDePao'
import { ESPESSURA_DA_CORNIJA } from './estatua'
import { ESPESSURA_DA_FIADA } from './mausoleu'
import { ESPESSURA_DA_BANCA } from './bancaDeFrutas'
import { ESPESSURA_DO_TAMPO_DA_BANCADA } from './bancadaDeFerramentas'
import { ESPESSURA_DO_COCHO } from './cocho'
import { ESPESSURA_DAS_TRAVESSAS_DO_BIOMBO } from './biombo'
import { ALTURA_DA_VELA_DO_CANDELABRO } from './candelabroDeChao'
import { ESPESSURA_DA_BORDA_DA_BANHEIRA } from './banheira'
import { ESPESSURA_DO_LAVATORIO } from './lavatorioComJarro'
import { ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES } from './prateleiraDePotes'
import { ESPESSURA_DO_TAMPO_DA_MESA_DE_CORTE } from './mesaDeCorte'
import { ESPESSURA_DA_TRAVE_DO_GANCHO } from './ganchoComCarne'
import { ESPESSURA_DA_FIADA_DO_MURO } from './muroBaixoDePedra'
import { ESPESSURA_DA_ESPIRA } from './colmeia'
import { contato, type Cena, type CriarPeca, type CurvaY, type MaterialDaPeca, type Peca, type Sombra } from './motor'

/** A frente recebe menos luz que o tampo: o `FRENTE` do protótipo (`objetos.js:654`). */
export const TOM_DA_FRENTE = 0.74
/** Espessura padrão da beirada de um tampo solto (px do protótipo): a tábua grossa do tampo da mesa. */
export const ESPESSURA_DO_TAMPO = 0.06 * G
/** Força do contato da base com o chão na 3/4 (a sombra de baixo, firme, no pé). */
const FORCA_DA_SOMBRA_DE_BAIXO = 0.34
/** A sombra de baixo das pilhas de troncos e de feno, mais forte: quase toda ela fica debaixo da pilha. */
const FORCA_DA_SOMBRA_DAS_PILHAS = 0.38

export type ModoDoTresQuartos = 'derivado' | 'em-pe'

export interface PerfilDoTresQuartos {
  readonly modo: ModoDoTresQuartos
  /** Quanto sobe a peça que não está em cima de nenhuma estrutura (px do protótipo): a lenha da fogueira. */
  readonly alturaSolta?: number
  /** Espessura da beirada de cada tampo solto (px do protótipo). */
  readonly espessura?: number
  /** Poste de ferro no meio (o lampião), com este raio (px do protótipo), do chão ao tampo mais alto. */
  readonly poste?: number
  /**
   * A sombra sobe junto com as peças soltas (`alturaSolta`): a mesa posta,
   * cuja sombra cai no tampo da mesa, e não no chão debaixo dela.
   */
  readonly sombrasSobem?: boolean
  /** Força da sombra de baixo do móvel em pé, no lugar de `FORCA_DA_SOMBRA_DE_BAIXO` (as pilhas baixas e largas). */
  readonly forcaDaSombraDeBaixo?: number
}

/**
 * Quanto a MESA POSTA (os Pratos) sobe na 3/4, em px do protótipo: entre o
 * tampo da mesa (0,5 casa) e o do balcão (0,62), a menos de 4 px de cada um.
 */
export const ALTURA_DA_MESA_POSTA = 0.56 * G

const DERIVADO: PerfilDoTresQuartos = { modo: 'derivado' }
const EM_PE: PerfilDoTresQuartos = { modo: 'em-pe' }

/** O perfil de cada tipo do catálogo. Um tipo novo no catálogo sem perfil não compila. */
export const PERFIS: Readonly<Record<TipoMobilia, PerfilDoTresQuartos>> = {
  barril: DERIVADO,
  caixa: DERIVADO,
  bau: DERIVADO,
  catre: DERIVADO,
  mesa: DERIVADO,
  cadeira: DERIVADO,
  cerca: DERIVADO,
  armario: DERIVADO,
  aparador: DERIVADO,
  fogueira: { modo: 'derivado', alturaSolta: ALTURA_DA_LENHA_EM_TRES_QUARTOS },
  // O tapete sobe a espessura dele inteiro, franja junto (a franja fica fora do corpo).
  tapete: { modo: 'derivado', alturaSolta: SOMBRA_DO_TAPETE.z },
  mesaQuadrada: DERIVADO,
  mesaRedonda: DERIVADO,
  // A lápide, o quadro e a barraca já são desenhados de frente, em pé (folha da MT4).
  lapide: EM_PE,
  vaso: DERIVADO,
  lampiao: { modo: 'derivado', poste: 0.035 * G },
  quadroDeAvisos: EM_PE,
  poco: DERIVADO,
  barraca: EM_PE,
  // O corpo da carroça é um caixote em cima das rodas: a beirada é a lateral dele.
  carroca: { modo: 'derivado', espessura: 0.3 * G },
  // A sombra da sebe é solta (MT5, para não arrastar), mas a sebe é maciça: a beirada vai até o chão.
  sebe: { modo: 'derivado', espessura: Infinity },
  jardineira: DERIVADO,
  arcoDoPortao: DERIVADO,
  placaDeSeta: DERIVADO,
  tapeteLongo: { modo: 'derivado', alturaSolta: SOMBRA_DO_TAPETE.z },
  // O chão queimado do fogo é rente ao chão, como o tapete sem espessura: nada sobe.
  fogo: DERIVADO,
  // Móveis de casa (28/10/2026): as alturas saem das sombras de cada um, como o armário.
  fogao: DERIVADO,
  geladeira: DERIVADO,
  pia: DERIVADO,
  balcao: DERIVADO,
  // A mesa posta sobe a altura do tampo, com a sombra junto: ela está em cima da mesa.
  pratos: { modo: 'derivado', alturaSolta: ALTURA_DA_MESA_POSTA, sombrasSobem: true },
  privada: DERIVADO,
  sofa: DERIVADO,
  poltrona: DERIVADO,
  // Lareira e oficina (29/10/2026). O lar da lareira não está em nenhuma estrutura: fica no chão, entre as
  // ombreiras, e a chama não sobe; a cova da fornalha está na bancada e sobe com ela (`deslocamentoDaChama`).
  lareira: DERIVADO,
  fornalha: DERIVADO,
  // A bigorna fica como de cima: a 3/4 sobe cada peça pela estrutura que contém o meio dela, e o meio do
  // toco está debaixo da mesa da bigorna; derivada, a silhueta inteira varria até o chão e virava uma pílula.
  bigorna: EM_PE,
  balde: DERIVADO,
  // Troncos e feno (29/10/2026) ficam como de cima, como a bigorna: derivados, a pilha inteira subia num
  // bloco e a frente varrida (lisa, sem as toras nem os fardos) virava uma tábua chapada embaixo.
  // A pilha é baixa e larga: a sombra de baixo some quase toda debaixo das toras e dos fardos, então vai
  // mais forte (31/10/2026, aprovado no antes/depois) para a pilha assentar no chão.
  troncos: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  feno: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  // O chafariz (02/11/2026) fica como de cima, como a bigorna: a 3/4 sobe cada peça pela estrutura que
  // contém o meio dela, e o meio da água da bacia é o meio do prato; derivado, a bacia inteira subia com
  // a coluna. Em pé, o jato animado também fica no lugar (sem deslocamento, como a chama da lareira).
  chafariz: EM_PE,
  // Os objetos de vento (02/11/2026) ficam como de cima: a imagem é só a base (os pés, a torre redonda, o
  // palito), e o que é alto (a roda, as velas, o papel) já fica em pé na camada animada.
  cataVento: EM_PE,
  moinho: EM_PE,
  cataVentoBrinquedo: EM_PE,
  // A ponte (03/11/2026): o perfil em pé, como o chafariz e os objetos de vento.
  ponte: EM_PE,
  // O cemitério (07/11/2026): o monte de terra e os caixões são blocos baixos e cheios, como a caixa e o baú.
  cova: DERIVADO,
  caixao: DERIVADO,
  caixaoAberto: DERIVADO,
  // Destroços e sucata (10/11/2026) ficam como de cima, como os troncos e o feno: são pilhas baixas e largas
  // de peças soltas, e derivadas subiam num bloco com a frente varrida lisa.
  destrocosDeMadeira: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  sucataChapas: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  sucataEngrenagens: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  sucataTambores: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  // O campinho (10/11/2026) é chão: o gramado e a rede ficam onde estão, e só as traves sobem (os postes
  // são colunas e o travessão, o tampo no ar, pelas sombras que o desenho de cima declara).
  campinho: DERIVADO,
  // Lote 1 dos 95 objetos novos (11/11/2026). O boneco de treino já é desenhado em pé, de frente, como a lápide.
  bonecoDeTreino: EM_PE,
  // O pilar e o altar sobem pelas sombras, com a beirada do capitel e a do tampo na espessura que cada
  // desenho exporta: com a padrão (0,06 casa) os gomos do fuste apareciam soltos debaixo do capitel, e o
  // pano que cai pela frente do altar encolhia.
  pilar: { modo: 'derivado', espessura: ESPESSURA_DO_CAPITEL },
  altar: { modo: 'derivado', espessura: ESPESSURA_DO_TAMPO_DO_ALTAR },
  // A estante sobe pelas sombras: cada prateleira tem a própria fresta (um tampo fino no ar, sem sombra) e
  // sobe para a altura dela, então a frente mostra os livros, e não a madeira lisa que a 3/4 varreria.
  estanteDeLivros: DERIVADO,
  // Os sacos de grão ficam como de cima, como os troncos e o feno: uma pilha baixa e larga.
  sacosDeGrao: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  bancoDePraca: DERIVADO,
  // Os escombros de pedra ficam como de cima, como os destroços e as sucatas: blocos soltos num monte baixo.
  escombrosDePedra: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  // O canhão fica como de cima, como a bigorna: derivado, o cano inteiro varria até o chão e virava uma
  // pílula, e a corda subia junto com a carreta.
  canhao: EM_PE,
  // Lote 2 dos 95 objetos novos (11/11/2026). O guarda-roupa sobe pelas sombras: a frente é desenhada em
  // faixas, cada uma com a fresta dela (como as prateleiras da estante), então mostra as portas e os
  // puxadores, e não a madeira lisa que a 3/4 varreria.
  guardaRoupa: DERIVADO,
  // O caldeirão sobe pelas sombras: um pino sobe o bojo e outro, a boca; o fogo fica no chão, debaixo dele.
  caldeirao: DERIVADO,
  // O forno de pão sobe pelas sombras, com a beirada das aduelas do arco na espessura que o desenho exporta:
  // com a padrão (0,06 casa) o arco saía fino demais e a boca perdia a volta. O lar não está em nenhuma
  // estrutura: fica no chão, e a chama não sobe (`deslocamentoDaChama`), como na lareira.
  fornoDePao: { modo: 'derivado', espessura: ESPESSURA_DO_ARCO_DO_FORNO },
  // A prateleira de depósito também tem a frente em faixas, mas ela começa rente ao chão (os pés e o vão
  // escuro debaixo da prateleira de baixo): com a beirada padrão dos tampos soltos, a da faixa de baixo caía
  // no chão, na frente da prateleira, como uma tira de madeira lisa. Sem beirada nenhuma.
  prateleiraDeDeposito: { modo: 'derivado', espessura: 0 },
  // A estátua e o mausoléu sobem pelas sombras, com a beirada dos tampos na espessura que cada desenho
  // exporta: com a padrão, o tronco da figura (faixas empilhadas) e as fiadas da fachada, o telhado e a
  // porta do mausoléu ficavam com vãos.
  estatua: { modo: 'derivado', espessura: ESPESSURA_DA_CORNIJA },
  // As pedras e rochas ficam como de cima, como os escombros de pedra: um monte baixo e largo.
  pedrasERochas: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  mausoleu: { modo: 'derivado', espessura: ESPESSURA_DA_FIADA },
  // O alvo já é desenhado em pé, de frente, como o boneco de treino (de cima o disco seria um risco).
  alvoDeArcoEFlecha: EM_PE,
  // Lote 3 dos 95 objetos novos (11/11/2026). A banca de frutas são dois degraus (dois tampos soltos, o de
  // trás 0,28 casa mais alto), e a beirada de cada um é essa diferença, que o desenho exporta: a do degrau de
  // trás desce exatamente até o tampo do da frente. Com a padrão (0,06 casa) o chão aparecia entre os dois.
  bancaDeFrutas: { modo: 'derivado', espessura: ESPESSURA_DA_BANCA },
  // O pano do toldo é um tampo solto na altura das estacas, e cada estaca, uma coluna. A sanefa que cai da
  // beira da frente é desenhada pelo próprio toldo (a faixa listrada e os gomos, numa fresta um pouco mais
  // baixa que o pano): sem beirada nenhuma, ou saía por baixo da sanefa uma tira lisa de uma cor só.
  toldoListrado: { modo: 'derivado', espessura: 0 },
  // O tampo da bancada é uma prancha grossa, na espessura que o desenho exporta: com a padrão ele saía fino
  // como o de uma mesa de jantar, e a tábua da prateleira de baixo também.
  bancadaDeFerramentas: { modo: 'derivado', espessura: ESPESSURA_DO_TAMPO_DA_BANCADA },
  // A roda da pedra de amolar e as armas do suporte são desenhadas de frente e guardadas em fatias, cada uma
  // presa a uma âncora (um tampo solto de um quarto de px, sem sombra): com a beirada padrão cada âncora
  // ganharia um fio de 3 px debaixo dela. Sem beirada nenhuma, como a prateleira de depósito.
  pedraDeAmolar: { modo: 'derivado', espessura: 0 },
  suporteDeArmas: { modo: 'derivado', espessura: 0 },
  // O espantalho já é desenhado em pé, de frente, como o boneco de treino (de cima seria um chapéu numa cruz).
  espantalho: EM_PE,
  // O cocho é um tampo solto na altura da borda, sobre os tocos dos pés, e a beirada dele é a altura do corpo
  // do tronco, que o desenho exporta (como a lateral da carroça): com a padrão a água boiava numa tábua fina.
  cocho: { modo: 'derivado', espessura: ESPESSURA_DO_COCHO },
  // Os ossos são rentes ao chão e espalhados, e não uma pilha: o esqueleto sobe inteiro a espessura de um
  // osso e a sombra fica onde está (nenhuma sombra deles tem altura). Em pé, a sombra de baixo saía como uma
  // faixa escura solta debaixo do esqueleto inteiro.
  ossos: { modo: 'derivado', alturaSolta: 0.03 * G },
  // A antena sobe pelas sombras: o prato é o tampo no ar e o mastro, a coluna da mesma altura. A beirada são
  // as costas do prato: com 0,16 casa ele lia como uma panela de parede reta.
  antenaParabolica: { modo: 'derivado', espessura: 0.09 * G },
  // Lote 4 dos 95 objetos novos (11/11/2026). A escrivaninha, o criado-mudo e a cama de casal têm a frente
  // (as gavetas; na cama, a face da cabeceira, a da peseira e a frente dos postes) desenhada de frente e
  // guardada debaixo do tampo ou das cobertas, com a fresta dela (um tampo solto de um quarto de px, sem
  // sombra), e ela começa rente ao chão: com a beirada padrão dos tampos soltos, a da fresta caía no chão
  // como uma tira de madeira lisa (e, na cabeceira da cama, por cima da quina dela). Sem beirada nenhuma,
  // como a prateleira de depósito.
  escrivaninha: { modo: 'derivado', espessura: 0 },
  criadoMudo: { modo: 'derivado', espessura: 0 },
  camaDeCasal: { modo: 'derivado', espessura: 0 },
  // O berço sobe pelas sombras, com a beirada padrão.
  berco: DERIVADO,
  // Cada pé da banqueta é inclinado e sobe em fatias finas (um tampo solto por fatia): com a beirada padrão
  // cada fatia ganhava uma beirada reta e o pé virava uma escada de anéis. Sem beirada o pé sai liso; a
  // espessura do assento é uma peça do desenho.
  banqueta: { modo: 'derivado', espessura: 0 },
  // As travessas do biombo e cada ponto do bordado são tampos soltos numa raia fina, e a altura de cada um
  // na tela é a beirada mais a raia: com a padrão as travessas e as ondas saíam com o dobro da grossura. A
  // beirada é a que o desenho exporta.
  biombo: { modo: 'derivado', espessura: ESPESSURA_DAS_TRAVESSAS_DO_BIOMBO },
  // O piano sobe pelas sombras: a frente (os painéis, a tampa das teclas, o rodapé) é desenhada de frente e
  // fatiada, cada faixa com a fresta dela, como a do guarda-roupa; o teclado e o banquinho são tampos soltos,
  // e a beirada padrão é a grossura do leito das teclas e a do assento (o `BEIRADA` de `piano.ts` a repete).
  piano: DERIVADO,
  // Cada vela do candelabro é um tampo solto na altura do alto dela, e a beirada do tampo é o corpo de cera,
  // na altura que o desenho exporta: com a padrão as velas saíam tocos de 3 px. Os nós do mastro são tampos
  // sem peça e têm a mesma altura.
  candelabroDeChao: { modo: 'derivado', espessura: ALTURA_DA_VELA_DO_CANDELABRO },
  // Lote 5 dos 95 objetos novos (11/11/2026), a cozinha e o banheiro: nenhum serve com a beirada padrão. A
  // borda roliça da banheira é um tampo solto por cima do bojo (a coluna), e a toalha que cai pela frente é
  // outro, fino, colado nela: os dois descem a grossura da borda, que o desenho exporta.
  banheira: { modo: 'derivado', espessura: ESPESSURA_DA_BORDA_DA_BANHEIRA },
  // Os dois aros de ferro da frente da tina são tampos soltos e finos (a metade da frente de cada anel, na
  // altura dele, sem sombra): com a beirada padrão cada aro engrossaria 3 px para baixo. Sem beirada nenhuma.
  tinaDeMadeira: { modo: 'derivado', espessura: 0 },
  // A beirada do lavatório serve à saia do tampo, ao espaldar (um tampo solto uma beirada acima do tampo) e à
  // queda da toalha na barra da frente: com a padrão a mesinha virava uma tábua fina, o espaldar ficava solto
  // no ar e a toalha encolhia. É a que o desenho exporta.
  lavatorioComJarro: { modo: 'derivado', espessura: ESPESSURA_DO_LAVATORIO },
  // A prateleira de potes, a mesa de corte e o gancho desenham as peças de uma vista só (a de cima some quando
  // a 3/4 a sobe; a da frente só aparece subida) e prendem a ordem em âncoras de um ponto, que nunca pintam:
  // os três contam com a 3/4 subindo cada peça pelo `dy` dela (`cenaEmTresQuartos`). A beirada de cada um é a
  // que o desenho exporta: a grossura da tábua de cima da prateleira (a de baixo é desenhada com a mesma), o
  // bloco de açougueiro da mesa (com a padrão saía fino como o de uma mesa de jantar) e a trave do gancho (com
  // a padrão, fina como uma ripa).
  prateleiraDePotes: { modo: 'derivado', espessura: ESPESSURA_DA_TABUA_DA_PRATELEIRA_DE_POTES },
  mesaDeCorte: { modo: 'derivado', espessura: ESPESSURA_DO_TAMPO_DA_MESA_DE_CORTE },
  ganchoComCarne: { modo: 'derivado', espessura: ESPESSURA_DA_TRAVE_DO_GANCHO },
  // Lote 6 dos 95 objetos novos (11/11/2026), a armazenagem. A pilha de caixas fica como de cima, como os
  // sacos de grão: derivada, cada caixote de cima subiria como coluna desde o chão e taparia o de baixo.
  pilhaDeCaixas: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  // O barril da 3/4 é desenhado à parte e guardado em fatias debaixo do dorso, cada fatia pendurada num pino
  // (um tampo solto do tamanho de um ponto, sem sombra; `pipaDeitada.ts`); no tonel também a torneira, os
  // degraus e a escadinha guardada. Com a beirada padrão cada pino ganharia um fio de madeira de 3 px para
  // baixo: sem beirada nenhuma, e não o derivado puro.
  barrisDeitados: { modo: 'derivado', espessura: 0 },
  tonelDeAdega: { modo: 'derivado', espessura: 0 },
  // As ânforas, o cesto e o cofre sobem pelas sombras e penduram o que fica guardado debaixo do tampo em
  // pinos sem tamanho nem tinta (`forca: 0`): a beirada que a 3/4 dá ao tampo solto não pinta nada, e o
  // derivado puro serve. Três pinos por ânfora em pé (o corpo de baixo, guardado debaixo do bojo, o bojo e a
  // boca); a tombada não tem pino e fica no chão. No cesto a parede que a 3/4 varre sai na palha trançada do
  // motor (o vime é da classe palha), a ponta do pano que cai pela frente fica guardada debaixo da boca, num
  // pino, e as alças têm uma estrutura solta sem sombra, que lhes dá a grossura. No cofre o corpo e a porta
  // saliente são duas colunas (o canudo da dobradiça é da coluna da porta); a porta é desenhada de frente e
  // fica guardada debaixo do tampo, um pino por peça, como a frente do criado-mudo, e a roda e a alavanca
  // vistas de cima têm os pinos delas, na altura dos eixos.
  anforasDeBarro: DERIVADO,
  cestoDeVime: DERIVADO,
  cofre: DERIVADO,
  // Lote 7 dos 95 objetos novos (11/11/2026), a rua e o jardim. No varal, na horta e no canteiro o que sobe
  // (as faixas da roupa, a cabeça dos repolhos, a rama das cenouras, os andares do tomateiro, as moitas, as
  // borboletas) sobe preso a um pino ou a uma fresta, um tampo solto minúsculo e sem sombra escondido debaixo
  // da própria peça: com a beirada padrão dos tampos soltos cada pino ganharia um toco de 3 px debaixo dele.
  // Sem beirada nenhuma, e não o derivado puro.
  varalDeRoupa: { modo: 'derivado', espessura: 0 },
  horta: { modo: 'derivado', espessura: 0 },
  canteiroDeFlores: { modo: 'derivado', espessura: 0 },
  // Cada pedra da face do muro é um tampo solto raso, sem peça (como as fiadas da fachada do mausoléu), e a
  // beirada dele é a face da pedra, da altura de uma fiada, que o desenho exporta: com a padrão sobrava um vão
  // escuro entre as fiadas.
  muroBaixoDePedra: { modo: 'derivado', espessura: ESPESSURA_DA_FIADA_DO_MURO },
  // O toco sobe pelas sombras: o tronco é uma coluna (o contorno da casca) e cada cogumelo, um pé com o chapéu
  // (um tampo solto, com a beirada padrão); as raízes ficam no chão.
  tocoDeArvore: DERIVADO,
  // O carrinho fica como de cima, como o canhão: derivado, a roda (uma tira no chão) viraria um bloco varrido
  // e os cabos ficariam deitados na terra debaixo da caçamba.
  carrinhoDeMao: EM_PE,
  // Na placa o poste é uma coluna de verdade; o braço, as correntes e a face da tabuleta são desenhados de
  // frente e guardados em fatias, cada uma presa a uma âncora, como a pedra de amolar: sem beirada nenhuma.
  placaDeLoja: { modo: 'derivado', espessura: 0 },
  // Lote 8 dos 95 objetos novos (11/11/2026), o cemitério. A cruz, o anjo e a pá já são desenhados em pé, de
  // frente, como a lápide e o espantalho: de cima a cruz seria um risco e o anjo, um borrão de asas.
  cruzDeMadeira: EM_PE,
  anjoDePedra: EM_PE,
  // A cerca de ferro sobe pelas sombras, com a beirada padrão: cada barra e cada pilarete são colunas, e a
  // lança, as travessas e a capa do pilarete são tampos soltos cujo corpo é a beirada.
  cercaDeFerro: DERIVADO,
  paCravada: EM_PE,
  // As velas também: cada vela é uma coluna de cera, a tigela e o pão são colunas baixas e o pano, as flores,
  // as moedas e as poças de cera ficam no chão.
  velasEOferendas: DERIVADO,
  // Na árvore seca o tronco é a coluna e a copa, um tampo solto na altura da árvore com a forma dos próprios
  // galhos: com a beirada padrão cada galho ganhava uma laje grossa por baixo. A beirada é a de um galho,
  // 0,025 casa.
  arvoreSeca: { modo: 'derivado', espessura: 0.025 * G },
  // Lote 9 dos 95 objetos novos (11/11/2026), a feira. Na balança de mercador o caixote é derivado, com a
  // beirada padrão (a 3/4 sobe o tampo e varre a frente); a balança, os pesos e as moedas são desenhados duas
  // vezes, presos às âncoras do gancho com carne (um ponto só, sem sombra), e só os de frente aparecem na 3/4.
  balancaDeMercador: DERIVADO,
  // A tenda e a gaiola são montadas inteiras pelas âncoras, cada peça de uma vista só (a de frente só aparece na
  // 3/4), e não têm caixote derivado: sem beirada nenhuma, como o toldo, o perfil com que a folha do desenhista
  // passou no portão.
  tendaDeAdivinha: { modo: 'derivado', espessura: 0 },
  gaiolaComAves: { modo: 'derivado', espessura: 0 },
  // Nos rolos a mesa é um tampo solto sobre quatro pés, o pano que cai da beira é uma coluna estreita na quina
  // da frente e cada ripa do caixote é uma coluna: a beirada padrão é a espessura do tampo da mesa.
  rolosDeTecido: DERIVADO,
  // O palco mora no chão, como o campinho, mas o tablado sobe de verdade: duas faixas soltas (a de trás com as
  // três primeiras tábuas, para o banquinho sair entre elas) e a cortina do fundo em doze pregas, cada uma uma
  // coluna.
  palcoDeBardo: DERIVADO,
  // O barril de peixe é uma coluna da altura do barril, com o peixe na boca, e a tampa encostada, uma coluna
  // mais baixa na frente dele; o puçá e os respingos ficam no chão.
  barrilDePeixe: DERIVADO,
  // Lote 10 dos 95 objetos novos (11/11/2026), a oficina e a fazenda. O fole fica como de cima, como o canhão e
  // a bigorna: derivado (provado com parede de 0,16 e de 0,08 casa), o corpo subia como um bloco no ar e as
  // pontas do cavalete ficavam soltas embaixo, como pernas.
  fole: EM_PE,
  // O manequim já é desenhado em pé, de frente, como o boneco de treino: visto de cima seria um disco de aço.
  manequimComArmadura: EM_PE,
  // A pilha de lingotes fica como de cima, como as outras pilhas: derivada, as barras da camada do meio cujo
  // meio cai debaixo da camada de cima subiriam junto com ela e sairiam do lugar das vizinhas.
  pilhaDeLingotes: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  // A serra fica como de cima, como o carrinho de mão e o canhão: derivada, a tora viraria um bloco varrido até
  // o chão por cima dos cavaletes.
  serra: EM_PE,
  // No galinheiro cada tábua do telhado é um tampo solto (a beirada padrão é a face da tábua), os pés e os
  // mourões são colunas, a rampa desce em lances e a parede da frente, desenhada de frente, sobe num pino na
  // altura do piso. A colmeia sobe em voltas de palha, um tampo por volta, e a beirada é a grossura do rolo, que
  // o desenho exporta.
  galinheiro: DERIVADO,
  colmeia: { modo: 'derivado', espessura: ESPESSURA_DA_ESPIRA },
  // O arado fica como de cima: derivado, o timão e as rabiças, que sobem no ar, ficariam rentes ao chão e soltos
  // do corpo.
  arado: EM_PE,
  // O toco com machado sobe pelas sombras: o cepo é uma coluna baixa e cada acha, uma colunazinha; os cavacos e
  // as lascas ficam no chão, e as peças do machado vão presas ao meio do cepo, para subirem com o topo.
  tocoComMachado: DERIVADO,
  // A plantação mora no chão e é rente, como o fogo: nenhuma sombra dela tem altura, então nada sobe e a 3/4 sai
  // igual à vista de cima (`tresQuartos.test.ts` a dispensa das regras de subir, na lista dos rentes).
  plantacaoEmFileiras: DERIVADO,
  // Lote 11 dos 95 objetos novos (11/11/2026), os destroços e o esporte. A carroça quebrada, o barril quebrado e
  // a viga caída ficam como de cima, com a sombra de baixo das pilhas, como os destroços de madeira. A carroça
  // inteira sobe derivada, mas a quebrada tem metade no chão (a roda deitada, as tábuas, o grão, o saco caído e
  // o caixote); o barril inteiro é derivado, mas o quebrado é quase todo chão (o leque, a tampa, os aros e a
  // poça); a viga é rente ao chão e espalhada. Derivados, as tábuas, a poça, as aduelas caídas, as telhas, as
  // lascas e o pó subiriam junto como um bloco.
  carrocaQuebrada: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  barrilQuebrado: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  vigaCaida: { modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DAS_PILHAS },
  // A armadura enferrujada é rente ao chão e espalhada, como os ossos: as peças sobem inteiras a espessura de
  // uma placa de aço e a sombra fica onde está.
  armaduraEnferrujada: { modo: 'derivado', alturaSolta: 0.035 * G },
  // Na mesa de jogo, como na banqueta, os pés dos banquinhos são inclinados e sobem em fatias (um tampo solto
  // por fatia): sem beirada eles saem lisos. Nenhum pé de banquinho passa debaixo do tampo da mesa, senão
  // subiria com ela.
  mesaDeJogo: { modo: 'derivado', espessura: 0 },
  // O ringue mora no chão, como o palco de bardo, mas sobe de verdade: as cordas, as almofadas e os aros do
  // balde sobem em pinos (tampos soltos do tamanho de um ponto) e com beirada pintariam um risco de madeira,
  // como na prateleira de depósito. O tablado é coluna, partida em cinco faixas de norte a sul.
  ringueDeLuta: { modo: 'derivado', espessura: 0 },
  // No balanço, como na banqueta e no varal, os troncos dos cavaletes e as cordas sobem em fatias: sem beirada.
  balanco: { modo: 'derivado', espessura: 0 },
  // Na mesa de sinuca a beirada é a saia de madeira, e TEM de ser a `ESPESSURA_DA_SAIA` de `mesaDeSinuca.ts`
  // (0,13 casa): os pés torneados, o friso e as redes das caçapas da frente são desenhados contando com ela. Se
  // mudar uma, muda a outra.
  mesaDeSinuca: { modo: 'derivado', espessura: 0.13 * G },
}

/** O perfil do móvel nesta vista Frente/Lado: o de Lado já é desenhado em pé. */
export function perfilDoTresQuartos(tipo: TipoMobilia, lado: LadoDoMovel): PerfilDoTresQuartos {
  return lado === 'lado' ? EM_PE : PERFIS[tipo]
}

/**
 * O quarto de volta vai PINTADO na 3/4 (a frente fica embaixo na tela)? Sim
 * nos móveis derivados; a placa de seta já pinta o dela no desenho; o móvel
 * em pé gira a imagem inteira, como sempre.
 */
export function pintaOGiroNaTresQuartos(tipo: TipoMobilia, lado: LadoDoMovel): boolean {
  return tipo !== 'placaDeSeta' && perfilDoTresQuartos(tipo, lado).modo === 'derivado'
}

// ---------- varrer: a forma arrastada do chão até a altura ----------

/** Precisão da distância perto da borda (px do protótipo): o erro some no chanfro. */
const PASSO_MINIMO_DA_VARREDURA = 0.4
/** Longe da forma a distância exata não importa (a cobertura e o chanfro só leem perto da borda). */
const LONGE_DA_VARREDURA = 4
/** Fundo o bastante: nenhum chanfro passa disto. */
const FUNDO_DA_VARREDURA = -4

/**
 * A forma `f` arrastada para CIMA na tela de 0 a `altura` px (a parede de uma
 * coluna vista de frente): a menor distância de `f` ao longo da vertical,
 * andando em passos que a distância garante (a distância muda no máximo 1 por
 * px andado), com erro menor que `PASSO_MINIMO_DA_VARREDURA` perto da borda.
 */
export function varrer(f: Forma, altura: number): Forma {
  if (!(altura > 0)) return f
  const b = f.b
  return {
    b: [b[0], b[1] - altura, b[2], b[3]],
    d(x, y) {
      let melhor = Infinity
      let t = 0
      for (;;) {
        const v = f.d(x, y + t)
        if (v < melhor) {
          melhor = v
          if (melhor <= FUNDO_DA_VARREDURA) return melhor
        }
        if (t >= altura) return melhor
        const alvo = melhor < LONGE_DA_VARREDURA ? melhor : LONGE_DA_VARREDURA
        const passo = v - alvo + PASSO_MINIMO_DA_VARREDURA
        t = t + passo > altura ? altura : t + passo
      }
    },
  }
}

// ---------- girar a cena um quarto de volta ----------

type Quartos = 1 | 2 | 3

/** O ponto do móvel girado `q` quartos de volta no sentido da tela (y para baixo: horário). */
function girarPonto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : [y, -x]
}

/** O ponto da tela de volta no referencial do móvel. */
function desgirarPonto(x: number, y: number, q: Quartos): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : [-y, x]
}

function girarCaixa(b: Caixa, q: Quartos): Caixa {
  return q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
}

export function girarForma(f: Forma, q: Quartos): Forma {
  return {
    b: girarCaixa(f.b, q),
    d(x, y) {
      const [mx, my] = desgirarPonto(x, y, q)
      return f.d(mx, my)
    },
  }
}

/** A curva da tampa (normal inclinada ao longo de y) depois do giro: em y (meia volta) ou em x (quarto). */
function girarCurva(curva: CurvaY | undefined, q: Quartos): { curvaY: CurvaY | undefined; curvaX?: CurvaY } {
  if (curva === undefined) return { curvaY: undefined }
  if (q === 2) return { curvaY: { ...curva, c: -curva.c } }
  return { curvaY: undefined, curvaX: q === 1 ? { ...curva, c: -curva.c } : curva }
}

/**
 * A peça girada: a forma, o deslocamento, o veio, o centro do anel e do arco
 * e a curva giram; a luz, o recesso e a projeção ficam na tela (luz fixa). A
 * textura própria lê o ponto no referencial do móvel, com a peça de antes.
 */
function girarPeca(p: Peca, q: Quartos): Peca {
  const [dx, dy] = girarPonto(p.dx, p.dy, q)
  const giro = q * QUARTO
  const tex = p.tex
  const polar = p.polar === undefined ? undefined : (() => {
    const [cx, cy] = girarPonto(p.polar.cx, p.polar.cy, q)
    return { ...p.polar, cx, cy }
  })()
  const arco = p.arco === undefined ? undefined : (() => {
    const [cx, cy] = girarPonto(p.arco.cx, p.arco.cy, q)
    return { ...p.arco, cx, cy, a0: p.arco.a0 + giro }
  })()
  return {
    ...p,
    forma: girarForma(p.forma, q),
    dx,
    dy,
    eixo: p.eixo + giro,
    polar,
    arco,
    ...girarCurva(p.curvaY, q),
    tex:
      tex === null
        ? null
        : (u, v, x, y, _girada, s, escala) => {
            const [mx, my] = desgirarPonto(x, y, q)
            tex(u, v, mx, my, p, s, escala)
          },
  }
}

/** A cena girada `quartos` quartos de volta (0 = a mesma cena). */
export function girarCena(cena: Cena, quartos: number): Cena {
  const q = ((Math.round(quartos) % 4) + 4) % 4
  if (q === 0) return cena
  const qq = q as Quartos
  return {
    ...cena,
    partes: cena.partes.map((p) => girarPeca(p, qq)),
    sombras: cena.sombras.map((s) => ({ ...s, forma: girarForma(s.forma, qq) })),
  }
}

// ---------- a 3/4 ----------

interface Estrutura {
  readonly forma: Forma
  readonly z: number
  readonly coluna: boolean
  readonly partes: Peca[]
}

function areaDaCaixa(b: Caixa): number {
  return (b[2] - b[0]) * (b[3] - b[1])
}

/** A estrutura em que a peça está: a mais alta que contém o meio dela (empate: a menor, a mais justa). */
function estruturaDaPeca(p: Peca, estruturas: readonly Estrutura[]): Estrutura | null {
  const b = p.forma.b
  const cx = (b[0] + b[2]) / 2 + p.dx
  const cy = (b[1] + b[3]) / 2 + p.dy
  let achada: Estrutura | null = null
  for (const e of estruturas) {
    if (e.forma.d(cx, cy) > 0) continue
    if (achada === null || e.z > achada.z || (e.z === achada.z && areaDaCaixa(e.forma.b) < areaDaCaixa(achada.forma.b))) achada = e
  }
  return achada
}

/** O material da frente: o da maior peça da estrutura; sem peça, o da maior peça do móvel. */
function materialDaFrente(partes: readonly Peca[], todas: readonly Peca[]): MaterialDaPeca {
  const fonte = partes.length > 0 ? partes : todas
  let maior = fonte[0]
  for (const p of fonte) if (areaDaCaixa(p.forma.b) > areaDaCaixa(maior.forma.b)) maior = p
  return maior.mat
}

/** A forma `f` subida `d` px na tela (a sombra da mesa posta, no tampo). */
function subida(f: Forma, d: number): Forma {
  return { b: [f.b[0], f.b[1] - d, f.b[2], f.b[3] - d], d: (x, y) => f.d(x, y + d) }
}

/** Forma redonda (o canto da caixa fica fora dela): o veio da frente corre de pé, como as aduelas do barril. */
function ehRedonda(f: Forma): boolean {
  const b = f.b
  const lado = Math.min(b[2] - b[0], b[3] - b[1])
  return f.d(b[0] + lado * 0.08, b[1] + lado * 0.08) > 0
}

/** A sombra de baixo do móvel em pé: um borrão achatado logo debaixo da base. */
function sombraDeBaixoDoEmPe(cena: Cena, forca: number): Sombra | null {
  let x0 = Infinity
  let x1 = -Infinity
  let base = -Infinity
  for (const p of cena.partes) {
    if (p.alfa < 0.5) continue
    x0 = Math.min(x0, p.forma.b[0] + p.dx)
    x1 = Math.max(x1, p.forma.b[2] + p.dx)
    base = Math.max(base, p.forma.b[3] + p.dy)
  }
  if (!Number.isFinite(base)) return null
  const rx = ((x1 - x0) / 2) * 0.92
  return { forma: elipse((x0 + x1) / 2, base - 0.6, rx, Math.max(1.6, 0.05 * G)), z: 0, suave: 1.6, forca }
}

/**
 * A cena na vista 3/4. `peca` = a fábrica de peças com a semente do móvel
 * (a frente ganha veio próprio, sempre o mesmo para o mesmo desenho).
 */
export function cenaEmTresQuartos(cena: Cena, perfil: PerfilDoTresQuartos, peca: CriarPeca): Cena {
  if (perfil.modo === 'em-pe') {
    const sombra = sombraDeBaixoDoEmPe(cena, perfil.forcaDaSombraDeBaixo ?? FORCA_DA_SOMBRA_DE_BAIXO)
    return sombra === null ? cena : { ...cena, sombras: [...cena.sombras, sombra] }
  }
  const estruturas: Estrutura[] = []
  for (const s of cena.sombras) {
    if (!(s.z > 0)) continue
    estruturas.push({ forma: s.forma, z: s.z, coluna: s.solta !== true, partes: [] })
  }
  if (perfil.poste !== undefined && estruturas.length > 0) {
    const topo = Math.max(...estruturas.map((e) => e.z))
    estruturas.push({ forma: elipse(0, 0, perfil.poste, perfil.poste), z: topo, coluna: true, partes: [] })
  }
  const soltas: Peca[] = []
  const alturaSolta = perfil.alturaSolta ?? 0
  for (const p of cena.partes) {
    const e = estruturaDaPeca(p, estruturas)
    if (e === null) soltas.push({ ...p, dy: p.dy - alturaSolta })
    else e.partes.push({ ...p, dy: p.dy - e.z })
  }
  // Do norte para o sul pela base da estrutura; na mesma base, a mais baixa antes (a cabeceira alta por cima do colchão).
  const ordem = estruturas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.forma.b[3] - b.e.forma.b[3] || a.e.z - b.e.z || a.i - b.i)
    .map(({ e }) => e)
  const partes: Peca[] = [...soltas]
  const sombras: Sombra[] = perfil.sombrasSobem === true ? cena.sombras.map((s) => ({ ...s, forma: subida(s.forma, alturaSolta) })) : [...cena.sombras]
  ordem.forEach((e, i) => {
    const mat = materialDaFrente(e.partes, cena.partes)
    const veio = { eixo: ehRedonda(e.forma) ? QUARTO : 0, tom: TOM_DA_FRENTE, bisel: 0.8, contorno: 0.2, semente: 900 + i }
    if (e.coluna) {
      partes.push(peca(varrer(e.forma, e.z), e.partes.length > 0 ? mat : perfil.poste !== undefined ? PREGO : mat, veio))
      sombras.push(contato(e.forma, FORCA_DA_SOMBRA_DE_BAIXO))
    } else {
      const espessura = Math.min(perfil.espessura ?? ESPESSURA_DO_TAMPO, e.z)
      partes.push(peca(varrer(e.forma, espessura), mat, { ...veio, dy: -(e.z - espessura) }))
      // Beirada que desce até o chão (a sebe) apoia como coluna.
      if (espessura >= e.z) sombras.push(contato(e.forma, FORCA_DA_SOMBRA_DE_BAIXO))
    }
    partes.push(...e.partes)
  })
  return { ...cena, partes, sombras }
}
