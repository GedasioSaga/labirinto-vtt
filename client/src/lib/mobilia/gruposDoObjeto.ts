import { GRUPOS_DE_CONSTRUCAO, GRUPO_DA_CONSTRUCAO } from './construcoes'
import type { TipoMobilia } from './tipos'

/**
 * OS GRUPOS DO OBJETO (pedido do mestre de 10/11/2026: "organizar essa parte",
 * a grade comprida da ficha da ferramenta Objeto). Um lugar só para os dois
 * caminhos até a mesma escolha: a ficha (`components/livro/EscolhaDoObjeto.tsx`)
 * e o cantinho da barra (`PARTES_DO_MENU_DE_OBJETO` em `lib/toolVariants.ts`,
 * que sai daqui).
 *
 * PEÇA NOVA NO CATÁLOGO: uma linha em `GRUPO_DO_OBJETO` (`tipo: 'idDoGrupo'`),
 * no bloco do grupo dela. A ordem das linhas é a ordem da peça dentro do grupo.
 * Sem a linha ela não some: cai em "Outros" (`GRUPO_PADRAO`), no fim, na ordem
 * do catálogo. Grupo sem peça não aparece em lugar nenhum.
 *
 * Só a ARRUMAÇÃO muda: o id de cada tipo (`lib/mobilia/tipos.ts`) é o que o
 * mapa salvo guarda e continua igual.
 */
export const GRUPOS_DE_OBJETO = [
  { id: 'salaEQuarto', titulo: 'Sala e quarto' },
  { id: 'cozinhaEBanheiro', titulo: 'Cozinha e banheiro' },
  { id: 'armazenagem', titulo: 'Armazenagem' },
  { id: 'ruaEJardim', titulo: 'Rua e jardim' },
  { id: 'cemiterio', titulo: 'Cemitério' },
  { id: 'feira', titulo: 'Feira' },
  { id: 'oficina', titulo: 'Oficina' },
  { id: 'fazenda', titulo: 'Fazenda' },
  { id: 'destrocosESucata', titulo: 'Destroços e sucata' },
  { id: 'esporteELazer', titulo: 'Esporte e lazer' },
  { id: 'portoENavio', titulo: 'Porto e navio' },
  { id: 'temploEMasmorra', titulo: 'Templo e masmorra' },
  { id: 'salaDeTortura', titulo: 'Sala de tortura' },
  { id: 'magiaEAlquimia', titulo: 'Magia e alquimia' },
  { id: 'tesouro', titulo: 'Tesouro' },
  // Os grupos dos objetos de 14/11/2026 entram aqui, cada um quando chega o primeiro item dele, na ordem da lista
  // do dia (castelo, cerco e defesa, base militar, mar e piratas, taverna e festa, descanso e brincadeira, cidade
  // e vila).
  { id: 'castelo', titulo: 'Castelo' },
  { id: 'cercoEDefesa', titulo: 'Cerco e defesa' },
  { id: 'baseMilitar', titulo: 'Base militar' },
  { id: 'marEPiratas', titulo: 'Mar e piratas' },
  { id: 'tavernaEFesta', titulo: 'Taverna e festa' },
  { id: 'descansoEBrincadeira', titulo: 'Descanso e brincadeira' },
  { id: 'cidadeEVila', titulo: 'Cidade e vila' },
  // Os 4 grupos da ferramenta Construção (12/11/2026) moram em `construcoes.ts`; entram aqui para a ficha e o
  // cantinho da barra arrumarem os dois catálogos com a mesma conta (`partesDoObjeto`). Nenhum tipo do
  // Objeto cai neles, nenhuma construção cai nos de cima.
  ...GRUPOS_DE_CONSTRUCAO,
  { id: 'outros', titulo: 'Outros' },
] as const

export type IdDoGrupoDeObjeto = (typeof GRUPOS_DE_OBJETO)[number]['id']

/** Onde cai o tipo do catálogo que ainda não tem linha em `GRUPO_DO_OBJETO`. */
export const GRUPO_PADRAO: IdDoGrupoDeObjeto = 'outros'

/**
 * O grupo de cada objeto. "Banheiro" sozinho teria só a privada: vai com a
 * cozinha (as peças de água da casa). O balde de água fica na oficina, com a
 * fornalha e a bigorna (a água da têmpera), como já estava no menu.
 */
export const GRUPO_DO_OBJETO: Readonly<Partial<Record<TipoMobilia, IdDoGrupoDeObjeto>>> = {
  // Sala e quarto: as mesas, os assentos, a cama, os tapetes e a lareira; a estante e o guarda-roupa (11/11/2026);
  // e o lote 4 dos objetos novos (11/11/2026), da escrivaninha ao candelabro de chão.
  mesa: 'salaEQuarto',
  cadeira: 'salaEQuarto',
  mesaQuadrada: 'salaEQuarto',
  mesaRedonda: 'salaEQuarto',
  sofa: 'salaEQuarto',
  poltrona: 'salaEQuarto',
  catre: 'salaEQuarto',
  aparador: 'salaEQuarto',
  tapete: 'salaEQuarto',
  tapeteLongo: 'salaEQuarto',
  lareira: 'salaEQuarto',
  estanteDeLivros: 'salaEQuarto',
  guardaRoupa: 'salaEQuarto',
  escrivaninha: 'salaEQuarto',
  criadoMudo: 'salaEQuarto',
  camaDeCasal: 'salaEQuarto',
  berco: 'salaEQuarto',
  banqueta: 'salaEQuarto',
  biombo: 'salaEQuarto',
  piano: 'salaEQuarto',
  candelabroDeChao: 'salaEQuarto',
  // Cozinha e banheiro; o caldeirão e o forno de pão (11/11/2026); e o lote 5 dos objetos novos (11/11/2026),
  // da banheira ao gancho com carne pendurada.
  armario: 'cozinhaEBanheiro',
  balcao: 'cozinhaEBanheiro',
  fogao: 'cozinhaEBanheiro',
  geladeira: 'cozinhaEBanheiro',
  pia: 'cozinhaEBanheiro',
  pratos: 'cozinhaEBanheiro',
  privada: 'cozinhaEBanheiro',
  caldeirao: 'cozinhaEBanheiro',
  fornoDePao: 'cozinhaEBanheiro',
  banheira: 'cozinhaEBanheiro',
  tinaDeMadeira: 'cozinhaEBanheiro',
  lavatorioComJarro: 'cozinhaEBanheiro',
  prateleiraDePotes: 'cozinhaEBanheiro',
  mesaDeCorte: 'cozinhaEBanheiro',
  ganchoComCarne: 'cozinhaEBanheiro',
  // Armazenagem; e o lote 6 dos objetos novos (11/11/2026), da pilha de caixas ao cofre.
  barril: 'armazenagem',
  caixa: 'armazenagem',
  bau: 'armazenagem',
  sacosDeGrao: 'armazenagem',
  prateleiraDeDeposito: 'armazenagem',
  pilhaDeCaixas: 'armazenagem',
  barrisDeitados: 'armazenagem',
  tonelDeAdega: 'armazenagem',
  anforasDeBarro: 'armazenagem',
  cestoDeVime: 'armazenagem',
  cofre: 'armazenagem',
  // Rua e jardim (no cantinho da barra, o atalho da árvore fecha esta parte); o lote 7 dos objetos novos
  // (11/11/2026), do varal de roupa à placa de loja pendurada. As construções que moravam aqui (o arco do
  // portão, o poço, o chafariz, a estátua, a antena, a tenda e as duas torres) foram para a ferramenta
  // Construção em 12/11/2026 (`construcoes.ts`, no fim deste mapa).
  cerca: 'ruaEJardim',
  sebe: 'ruaEJardim',
  jardineira: 'ruaEJardim',
  vaso: 'ruaEJardim',
  placaDeSeta: 'ruaEJardim',
  lampiao: 'ruaEJardim',
  fogueira: 'ruaEJardim',
  fogo: 'ruaEJardim',
  ponte: 'ruaEJardim',
  bancoDePraca: 'ruaEJardim',
  pedrasERochas: 'ruaEJardim',
  varalDeRoupa: 'ruaEJardim',
  horta: 'ruaEJardim',
  canteiroDeFlores: 'ruaEJardim',
  muroBaixoDePedra: 'ruaEJardim',
  tocoDeArvore: 'ruaEJardim',
  carrinhoDeMao: 'ruaEJardim',
  placaDeLoja: 'ruaEJardim',
  // Cemitério; e o lote 8 dos objetos novos (11/11/2026), da cruz de madeira à árvore seca. O mausoléu e o anjo
  // de pedra são construções desde 12/11/2026.
  lapide: 'cemiterio',
  cova: 'cemiterio',
  caixao: 'cemiterio',
  caixaoAberto: 'cemiterio',
  cruzDeMadeira: 'cemiterio',
  cercaDeFerro: 'cemiterio',
  paCravada: 'cemiterio',
  velasEOferendas: 'cemiterio',
  arvoreSeca: 'cemiterio',
  // Feira; a banca de frutas e o toldo listrado (11/11/2026); e o lote 9 dos objetos novos (11/11/2026), da
  // balança de mercador ao barril de peixe. A barraca e a tenda de adivinha são construções desde 12/11/2026.
  carroca: 'feira',
  quadroDeAvisos: 'feira',
  cataVentoBrinquedo: 'feira',
  bancaDeFrutas: 'feira',
  toldoListrado: 'feira',
  balancaDeMercador: 'feira',
  gaiolaComAves: 'feira',
  rolosDeTecido: 'feira',
  palcoDeBardo: 'feira',
  barrilDePeixe: 'feira',
  // Oficina; a bancada de ferramentas, a pedra de amolar e o suporte de armas (11/11/2026); e o lote 10 dos
  // objetos novos (11/11/2026), do fole à serra.
  fornalha: 'oficina',
  bigorna: 'oficina',
  balde: 'oficina',
  bancadaDeFerramentas: 'oficina',
  pedraDeAmolar: 'oficina',
  suporteDeArmas: 'oficina',
  fole: 'oficina',
  manequimComArmadura: 'oficina',
  pilhaDeLingotes: 'oficina',
  serra: 'oficina',
  // Fazenda; o espantalho e o cocho (11/11/2026); e o lote 10 dos objetos novos (11/11/2026), do galinheiro à
  // plantação em fileiras. O cata-vento, o moinho e o galinheiro são construções desde 12/11/2026.
  troncos: 'fazenda',
  feno: 'fazenda',
  espantalho: 'fazenda',
  cocho: 'fazenda',
  colmeia: 'fazenda',
  arado: 'fazenda',
  tocoComMachado: 'fazenda',
  plantacaoEmFileiras: 'fazenda',
  // Destroços e sucata (10/11/2026): a madeira quebrada e as três sucatas de metal; os escombros de pedra e os ossos (11/11/2026);
  // o lote 11 dos objetos novos (11/11/2026), da carroça quebrada à armadura enferrujada; a armadura despedaçada
  // do lote 15 (11/11/2026); e o crânio do lote 17 (12/11/2026), junto dos ossos.
  destrocosDeMadeira: 'destrocosESucata',
  sucataChapas: 'destrocosESucata',
  sucataEngrenagens: 'destrocosESucata',
  sucataTambores: 'destrocosESucata',
  escombrosDePedra: 'destrocosESucata',
  ossos: 'destrocosESucata',
  carrocaQuebrada: 'destrocosESucata',
  barrilQuebrado: 'destrocosESucata',
  vigaCaida: 'destrocosESucata',
  armaduraEnferrujada: 'destrocosESucata',
  armaduraDespedacada: 'destrocosESucata',
  cranio: 'destrocosESucata',
  // Esporte e lazer (10/11/2026); o boneco de treino e o alvo de arco e flecha (11/11/2026); e o lote 11 dos
  // objetos novos (11/11/2026), da mesa de jogo à mesa de sinuca.
  campinho: 'esporteELazer',
  bonecoDeTreino: 'esporteELazer',
  alvoDeArcoEFlecha: 'esporteELazer',
  mesaDeJogo: 'esporteELazer',
  ringueDeLuta: 'esporteELazer',
  balanco: 'esporteELazer',
  mesaDeSinuca: 'esporteELazer',
  // Porto e navio (11/11/2026): o canhão e o lote 12 dos objetos novos (11/11/2026), da âncora ao caixote de peixe.
  canhao: 'portoENavio',
  ancora: 'portoENavio',
  cordasEnroladas: 'portoENavio',
  timao: 'portoENavio',
  bote: 'portoENavio',
  redeDePesca: 'portoENavio',
  pier: 'portoENavio',
  caixoteDePeixe: 'portoENavio',
  // Templo e masmorra (11/11/2026): o pilar e o altar; a armadura de pé do lote 15 (11/11/2026); os do lote 13
  // e do lote 16 dos objetos novos (11/11/2026), do braseiro aos três blocos de inscrições; e, do lote 17
  // (12/11/2026), a teia de aranha e as tochas de parede e de pé. O pilar e os três blocos de inscrições são
  // construções desde 12/11/2026.
  altar: 'temploEMasmorra',
  armadura: 'temploEMasmorra',
  braseiro: 'temploEMasmorra',
  celaComGrade: 'temploEMasmorra',
  corrente: 'temploEMasmorra',
  armadilhaDeEspinhos: 'temploEMasmorra',
  circuloMagico: 'temploEMasmorra',
  teiaDeAranha: 'temploEMasmorra',
  tochaDeParede: 'temploEMasmorra',
  tochaDePe: 'temploEMasmorra',
  // Sala de tortura (11/11/2026): o lote 14 dos objetos novos, do potro de tortura ao sangue no chão.
  potroDeTortura: 'salaDeTortura',
  damaDeFerro: 'salaDeTortura',
  troncoDePrisioneiro: 'salaDeTortura',
  gaiolaSuspensa: 'salaDeTortura',
  cadeiraDeInterrogatorio: 'salaDeTortura',
  mesaDeInstrumentos: 'salaDeTortura',
  sangueNoChao: 'salaDeTortura',
  // Magia e alquimia (11/11/2026): os três últimos do lote 13 dos objetos novos, da estante de poções ao pedestal
  // com livro aberto. O círculo mágico ficou em Templo e masmorra, com o altar e o braseiro.
  estanteDePocoes: 'magiaEAlquimia',
  bolaDeCristal: 'magiaEAlquimia',
  pedestalComLivro: 'magiaEAlquimia',
  // Tesouro (12/11/2026): os oito do lote 17 dos objetos novos, cada um sozinho e o monte dele, da barra de ouro
  // ao monte de joias. A busca da ficha acha os oito por "tesouro" (o título do grupo).
  barraDeOuro: 'tesouro',
  monteDeOuro: 'tesouro',
  moedaDeOuro: 'tesouro',
  monteDeMoedasDeOuro: 'tesouro',
  diamante: 'tesouro',
  monteDeDiamantes: 'tesouro',
  joia: 'tesouro',
  monteDeJoias: 'tesouro',
  // Castelo (14/11/2026): o lote L01, do trono à panóplia, e o L02, da mesa de banquete posta às aljavas, com a ponte
  // levadiça no fim. A lista do dia pôs a ponte levadiça (item 81) em "Cidade e vila", mas o desenhista e a ficha a
  // puseram aqui, com o resto do castelo dela.
  tronoReal: 'castelo',
  camaDeDossel: 'castelo',
  estandarteDePe: 'castelo',
  tapecariaDeParede: 'castelo',
  lustreDeVelas: 'castelo',
  panoplia: 'castelo',
  mesaDeBanquete: 'castelo',
  bancosDeCapela: 'castelo',
  mesaDeGuerra: 'castelo',
  poleiroDeFalcao: 'castelo',
  aljavasEFlechas: 'castelo',
  ponteLevadica: 'castelo',
  // Cerco e defesa (14/11/2026): o lote L03, da catapulta à escada de cerco, e a primeira metade do L04, do cavalo
  // de frisa ao tacho de óleo quente. O canhão continua no porto e navio.
  catapulta: 'cercoEDefesa',
  balista: 'cercoEDefesa',
  arieteComTeto: 'cercoEDefesa',
  escadaDeCerco: 'cercoEDefesa',
  cavaloDeFrisa: 'cercoEDefesa',
  pilhaDeBalasDeCanhao: 'cercoEDefesa',
  tachoDeOleoQuente: 'cercoEDefesa',
  // Base militar (14/11/2026): a segunda metade do L04, dos sacos de areia ao ouriço antitanque, o L05, do arame
  // farpado ao rádio de campanha, e o L06, do holofote ao mastro com bandeira. O mastro serve também o castelo e a
  // cidade, mas cada tipo cai num grupo só: fica aqui, onde a lista do dia o pôs.
  sacosDeAreia: 'baseMilitar',
  caixasDeMunicao: 'baseMilitar',
  ouricoAntitanque: 'baseMilitar',
  arameFarpado: 'baseMilitar',
  barreiraDeConcreto: 'baseMilitar',
  cancelaListrada: 'baseMilitar',
  beliche: 'baseMilitar',
  armarioDeFerro: 'baseMilitar',
  radioDeCampanha: 'baseMilitar',
  holofote: 'baseMilitar',
  redeDeCamuflagem: 'baseMilitar',
  metralhadoraNoTripe: 'baseMilitar',
  paletesDeMadeira: 'baseMilitar',
  gerador: 'baseMilitar',
  mastroComBandeira: 'baseMilitar',
  // Mar e piratas (14/11/2026): o lote L07, do caracol-telefone à laranjeira em canteiro, e o L08, do prato de carne no
  // osso à lanterna de pedra japonesa. A âncora, o canhão e o timão continuam no porto e navio.
  caracolTelefone: 'marEPiratas',
  caracolTelefoneCamera: 'marEPiratas',
  caracolTelefoneDourado: 'marEPiratas',
  cartazDeProcurado: 'marEPiratas',
  frutaDeEspirais: 'marEPiratas',
  bandeiraPirata: 'marEPiratas',
  mesaDeNavegacao: 'marEPiratas',
  laranjeiraEmCanteiro: 'marEPiratas',
  pratoDeCarne: 'marEPiratas',
  pranchaDoNavio: 'marEPiratas',
  esqueletoDePeixe: 'marEPiratas',
  navioNaGarrafa: 'marEPiratas',
  conchaMagica: 'marEPiratas',
  lanternaDePedra: 'marEPiratas',
  // Taverna e festa (14/11/2026): o lote L09, do balcão de taverna ao mastro de fitas, e o L10, da caixa de fogos aos
  // tambores. O balcão comum, a mesa de jogo, o varal de roupa, a barraca de feira e o braseiro, os parentes, ficam onde
  // estavam.
  balcaoDeTaverna: 'tavernaEFesta',
  alvoDeDardos: 'tavernaEFesta',
  mesaDeQuedaDeBraco: 'tavernaEFesta',
  varalDeBandeirinhas: 'tavernaEFesta',
  varalDeLanternas: 'tavernaEFesta',
  mastroDeFitas: 'tavernaEFesta',
  caixaDeFogosDeArtificio: 'tavernaEFesta',
  barracaDeJogosDaFeira: 'tavernaEFesta',
  barracaDeEspetinho: 'tavernaEFesta',
  churrasqueira: 'tavernaEFesta',
  harpa: 'tavernaEFesta',
  tambores: 'tavernaEFesta',
  // Descanso e brincadeira (14/11/2026): o lote L11, da rede de dormir à gangorra, o L12, do escorregador ao pebolim, e
  // a arquibancada de torneio e a liça de justa, do L13. O balanço, a mesa de jogo, o ringue, a mesa de sinuca e a tina
  // de madeira, os parentes, continuam onde estavam.
  redeDeDormir: 'descansoEBrincadeira',
  guardaSolComEspreguicadeira: 'descansoEBrincadeira',
  toalhaDePiquenique: 'descansoEBrincadeira',
  xadrezDeJardim: 'descansoEBrincadeira',
  bolicheDeGrama: 'descansoEBrincadeira',
  gangorra: 'descansoEBrincadeira',
  escorregador: 'descansoEBrincadeira',
  aquario: 'descansoEBrincadeira',
  ofuro: 'descansoEBrincadeira',
  telescopio: 'descansoEBrincadeira',
  globoTerrestre: 'descansoEBrincadeira',
  pebolim: 'descansoEBrincadeira',
  arquibancadaDeTorneio: 'descansoEBrincadeira',
  licaDeJusta: 'descansoEBrincadeira',
  // Cidade e vila (14/11/2026): o resto do L13, do poste de amarrar cavalos ao sino no suporte, e o L14, do tear à
  // liteira.
  posteDeAmarrarCavalos: 'cidadeEVila',
  bueiro: 'cidadeEVila',
  relogioDeSol: 'cidadeEVila',
  sinoNoSuporte: 'cidadeEVila',
  tearDePedal: 'cidadeEVila',
  rocaDeFiar: 'cidadeEVila',
  lagarDeUva: 'cidadeEVila',
  moDePedra: 'cidadeEVila',
  liteira: 'cidadeEVila',
  // As 19 construções (12/11/2026), nos 4 grupos da ferramenta Construção, na ordem de `construcoes.ts`.
  ...GRUPO_DA_CONSTRUCAO,
}

export function grupoDoObjeto(tipo: TipoMobilia): IdDoGrupoDeObjeto {
  return GRUPO_DO_OBJETO[tipo] ?? GRUPO_PADRAO
}

export interface ParteDoObjeto {
  readonly id: IdDoGrupoDeObjeto
  readonly titulo: string
  readonly tipos: readonly TipoMobilia[]
}

/** A ordem das linhas de `GRUPO_DO_OBJETO`, que é a ordem dentro de cada grupo. */
const ORDEM_NO_GRUPO: ReadonlyMap<string, number> = new Map(Object.keys(GRUPO_DO_OBJETO).map((tipo, indice) => [tipo, indice]))

/**
 * O catálogo em grupos, na ordem de `GRUPOS_DE_OBJETO`, só os que têm peça.
 * Cada tipo do catálogo cai em exatamente um grupo; quem não tem linha vai
 * para "Outros", no fim, na ordem do catálogo.
 */
export function partesDoObjeto(catalogo: readonly TipoMobilia[]): ParteDoObjeto[] {
  const porGrupo = new Map<IdDoGrupoDeObjeto, TipoMobilia[]>()
  for (const tipo of catalogo) {
    const grupo = grupoDoObjeto(tipo)
    const lista = porGrupo.get(grupo) ?? []
    lista.push(tipo)
    porGrupo.set(grupo, lista)
  }
  const fimDaLista = ORDEM_NO_GRUPO.size
  const ordem = (tipo: TipoMobilia) => ORDEM_NO_GRUPO.get(tipo) ?? fimDaLista
  return GRUPOS_DE_OBJETO.flatMap((grupo) => {
    const tipos = porGrupo.get(grupo.id)
    if (tipos === undefined) return []
    // `sort` é estável: os sem linha ficam na ordem do catálogo, depois dos com linha.
    return [{ id: grupo.id, titulo: grupo.titulo, tipos: [...tipos].sort((a, b) => ordem(a) - ordem(b)) }]
  })
}

/**
 * PALAVRAS DO DIA A DIA de cada objeto, para a busca da ficha (E11 da caça de 12/11/2026, decisão 24 do mestre):
 * quem digita "cripta" acha o mausoléu, "esqueleto" os ossos e o crânio, "poça" os montes do tesouro e o sangue.
 * Primeiro rascunho, montado pelo Claude em 12/11/2026: o mestre corrige depois.
 * Regra da lista: nenhuma palavra leva a objeto errado (na dúvida, fica de fora). Sem acento e sem maiúscula
 * não importa (`nomeParaBusca`). Cuidado com o começo: "poção" ficou de fora porque, sem acento, "poça" acharia
 * a estante de poções; e nada aqui começa com "metal", "ouro", "tesouro", "navio", "templo", "tortura" etc.,
 * que já acham pelo nome ou pelo título do grupo (os testes de `acharObjetos` em `pecasNovas.test.ts`).
 */
export const PALAVRAS_DO_OBJETO: Readonly<Partial<Record<TipoMobilia, readonly string[]>>> = {
  // Sala e quarto
  mesa: ['mesa comprida', 'mesa de jantar', 'mesa de taverna'],
  cadeira: ['assento'],
  mesaRedonda: ['távola redonda', 'mesa de reunião'],
  sofa: ['divã', 'canapé', 'assento'],
  poltrona: ['cadeirão', 'assento'],
  catre: ['leito', 'catre', 'cama de solteiro', 'colchão'],
  aparador: ['bufê', 'buffet', 'cômoda'],
  tapete: ['carpete', 'alfombra'],
  tapeteLongo: ['passadeira', 'carpete', 'alfombra'],
  lareira: ['chaminé', 'fogo'],
  estanteDeLivros: ['biblioteca', 'prateleira de livros', 'livraria'],
  guardaRoupa: ['armário de roupa', 'roupeiro', 'closet', 'guarda roupa'],
  escrivaninha: ['escritório', 'mesa de escrever', 'mesa de estudo'],
  criadoMudo: ['mesa de cabeceira', 'cabeceira', 'criado mudo'],
  camaDeCasal: ['leito', 'cama grande', 'colchão'],
  berco: ['bebê', 'neném', 'cama de bebê'],
  banqueta: ['banquinho', 'banco alto', 'assento'],
  biombo: ['divisória', 'paravento', 'anteparo'],
  piano: ['música', 'instrumento musical'],
  candelabroDeChao: ['castiçal', 'velas', 'luz'],
  // Cozinha e banheiro
  armario: ['guarda-louça', 'louceiro'],
  // "balcão de taverna" saiu em 14/11/2026: é o nome do balcão de taverna (lote L09), que a busca acha pelo nome.
  balcao: ['balcão de bar'],
  fogao: ['fogão a lenha', 'fogão de ferro'],
  geladeira: ['refrigerador', 'freezer'],
  pia: ['torneira'],
  pratos: ['louça', 'comida', 'refeição', 'banquete', 'talheres'],
  privada: ['vaso sanitário', 'sanitário', 'latrina', 'toalete'],
  caldeirao: ['panela', 'tacho', 'sopa', 'bruxa'],
  fornoDePao: ['padaria', 'padeiro'],
  // "ofurô" saiu das duas em 14/11/2026: é o nome do ofurô (lote L12), que a busca acha pelo nome.
  banheira: ['banho'],
  tinaDeMadeira: ['banho', 'banheira de madeira'],
  lavatorioComJarro: ['lavabo', 'bacia', 'pia antiga', 'jarra'],
  prateleiraDePotes: ['despensa', 'conservas', 'temperos', 'estante de potes'],
  mesaDeCorte: ['açougue', 'açougueiro', 'tábua de corte', 'cutelo'],
  ganchoComCarne: ['açougue', 'açougueiro'],
  // Armazenagem ("barril" acha todos os barris: os três pelo nome e estes três pela palavra)
  barril: ['barrica', 'barril de cerveja', 'barril de vinho'],
  caixa: ['caixote', 'engradado', 'caixa de madeira'],
  bau: ['arca'],
  sacosDeGrao: ['farinha', 'trigo', 'milho', 'mantimentos', 'provisões', 'saca'],
  prateleiraDeDeposito: ['estante', 'armazém', 'estoque', 'despensa'],
  pilhaDeCaixas: ['caixotes', 'engradados', 'carga'],
  barrisDeitados: ['barril', 'barris de vinho', 'adega'],
  tonelDeAdega: ['barril', 'barril grande', 'vinho'],
  anforasDeBarro: ['cântaro', 'moringa', 'vaso de barro', 'jarro de barro', 'cerâmica'],
  cestoDeVime: ['cesta', 'balaio'],
  cofre: ['caixa-forte', 'caixa forte'],
  // Rua e jardim
  cerca: ['cerca de madeira', 'cercado', 'mourão'],
  sebe: ['cerca viva', 'arbusto', 'moita'],
  jardineira: ['floreira'],
  vaso: ['vaso de flor', 'planta em vaso'],
  arcoDoPortao: ['pórtico', 'arcada'],
  placaDeSeta: ['sinalização', 'placa de estrada', 'placa de direção'],
  poco: ['poço de água', 'cacimba', 'cisterna'],
  chafariz: ['fonte', 'repuxo'],
  lampiao: ['lanterna', 'poste', 'poste de luz', 'luz'],
  fogueira: ['fogo de acampamento', 'acampamento'],
  fogo: ['chamas', 'incêndio', 'labareda'],
  ponte: ['passarela', 'pinguela'],
  bancoDePraca: ['banco de jardim', 'banco de parque', 'assento'],
  estatua: ['escultura', 'monumento'],
  pedrasERochas: ['pedregulho', 'seixos', 'rochedo'],
  antenaParabolica: ['satélite'],
  varalDeRoupa: ['lavanderia', 'roupa estendida'],
  horta: ['verduras', 'legumes', 'hortaliças'],
  canteiroDeFlores: ['jardim de flores'],
  muroBaixoDePedra: ['mureta', 'cerca de pedra', 'parede baixa'],
  tocoDeArvore: ['cepo', 'tronco cortado'],
  carrinhoDeMao: ['carriola'],
  placaDeLoja: ['letreiro', 'tabuleta'],
  tenda: ['barraca de acampamento', 'acampamento'],
  torreDePedra: ['torreão'],
  torreDeVigia: ['atalaia', 'mirante'],
  // Cemitério
  lapide: ['túmulo', 'sepultura', 'pedra tumular', 'campa'],
  cova: ['sepultura', 'túmulo', 'enterro', 'monte de terra'],
  caixao: ['esquife', 'ataúde', 'féretro'],
  caixaoAberto: ['esquife', 'ataúde', 'velório'],
  mausoleu: ['cripta', 'jazigo', 'tumba', 'túmulo', 'sepulcro'],
  cruzDeMadeira: ['crucifixo'],
  anjoDePedra: ['estátua de anjo', 'querubim'],
  cercaDeFerro: ['grade de ferro', 'gradil', 'cerca de cemitério'],
  paCravada: ['coveiro'],
  velasEOferendas: ['luz', 'vigília'],
  arvoreSeca: ['árvore morta', 'galhos secos'],
  // Feira
  barraca: ['banca', 'tenda de feira', 'mercado', 'quiosque', 'feirante'],
  carroca: ['charrete', 'carroção', 'carro de boi'],
  quadroDeAvisos: ['mural', 'cartaz', 'quadro de missões', 'missão', 'recompensa', 'procurado'],
  cataVentoBrinquedo: ['catavento', 'cata vento'],
  bancaDeFrutas: ['quitanda', 'mercado', 'frutaria'],
  toldoListrado: ['cobertura', 'lona'],
  balancaDeMercador: ['pesos', 'pesagem'],
  tendaDeAdivinha: ['cartomante', 'vidente', 'adivinho', 'oráculo'],
  gaiolaComAves: ['passarinho', 'pássaros', 'viveiro'],
  rolosDeTecido: ['pano', 'panos', 'alfaiate', 'tecelagem'],
  palcoDeBardo: ['teatro', 'menestrel', 'música', 'tablado'],
  barrilDePeixe: ['peixaria', 'pescado'],
  // Oficina
  fornalha: ['forja', 'ferraria'],
  bigorna: ['forja', 'ferreiro', 'ferraria'],
  bancadaDeFerramentas: ['marcenaria', 'carpintaria', 'mesa de trabalho'],
  pedraDeAmolar: ['afiador', 'amolador', 'esmeril', 'mó', 'rebolo'],
  suporteDeArmas: ['arsenal', 'armeiro'],
  fole: ['forja', 'ferreiro', 'ferraria', 'soprador'],
  manequimComArmadura: ['armeiro'],
  pilhaDeLingotes: ['barras empilhadas', 'fundição'],
  serra: ['cavalete', 'serrar lenha', 'tora'],
  // Fazenda
  troncos: ['lenha', 'toras', 'pilha de lenha'],
  feno: ['palha', 'fardo'],
  cataVento: ['catavento', 'cata vento'],
  moinho: ['moenda'],
  espantalho: ['boneco de palha'],
  cocho: ['bebedouro', 'comedouro', 'manjedoura'],
  galinheiro: ['galinhas', 'galo', 'ovos', 'poleiro'],
  colmeia: ['abelhas', 'mel', 'apiário'],
  arado: ['charrua', 'lavoura'],
  tocoComMachado: ['lenhador', 'cepo', 'rachar lenha'],
  plantacaoEmFileiras: ['lavoura', 'roça', 'plantio', 'cultivo'],
  // Destroços e sucata
  destrocosDeMadeira: ['entulho', 'tábuas', 'madeira quebrada', 'ruína', 'ruínas'],
  sucataChapas: ['ferro-velho', 'lixo', 'chapas de ferro', 'ferrugem'],
  sucataEngrenagens: ['ferro-velho', 'lixo', 'mecanismo', 'peças de máquina'],
  sucataTambores: ['ferro-velho', 'lixo', 'barril de metal', 'barris amassados'],
  escombrosDePedra: ['entulho', 'ruína', 'ruínas', 'desabamento', 'desmoronamento'],
  ossos: ['esqueleto', 'ossada', 'restos mortais'],
  carrocaQuebrada: ['charrete quebrada', 'roda quebrada'],
  barrilQuebrado: ['barrica quebrada'],
  vigaCaida: ['madeira caída', 'desabamento'],
  armaduraEnferrujada: ['ferrugem', 'armadura velha'],
  armaduraDespedacada: ['armadura quebrada', 'restos de armadura'],
  cranio: ['caveira', 'esqueleto', 'osso'],
  // Esporte e lazer
  campinho: ['campo', 'gol', 'trave'],
  bonecoDeTreino: ['manequim de treino', 'treinamento'],
  alvoDeArcoEFlecha: ['arqueiro', 'arquearia', 'tiro ao alvo'],
  mesaDeJogo: ['cartas', 'baralho', 'damas', 'tabuleiro', 'jogatina'],
  ringueDeLuta: ['arena', 'boxe', 'pugilismo'],
  balanco: ['parquinho', 'parque infantil'],
  mesaDeSinuca: ['bilhar', 'snooker', 'taco'],
  // Porto e navio
  canhao: ['artilharia', 'bombarda'],
  cordasEnroladas: ['cabo', 'amarras', 'rolo de corda'],
  timao: ['leme', 'roda do leme'],
  bote: ['barco', 'barquinho', 'canoa', 'escaler'],
  redeDePesca: ['pescaria', 'pescador', 'tarrafa'],
  pier: ['cais', 'trapiche', 'atracadouro', 'deque', 'doca'],
  caixoteDePeixe: ['peixaria', 'pescado'],
  // Templo e masmorra
  pilar: ['coluna', 'pilastra'],
  altar: ['santuário', 'sacrifício', 'ritual'],
  armadura: ['cavaleiro'],
  braseiro: ['fogo', 'pira', 'fogareiro'],
  celaComGrade: ['prisão', 'cadeia', 'calabouço'],
  corrente: ['correntes', 'acorrentado'],
  armadilhaDeEspinhos: ['estacas', 'espetos'],
  circuloMagico: ['runas', 'ritual', 'invocação', 'magia'],
  blocoDeInscricoesAzul: ['monólito', 'monumento', 'glifos', 'runas'],
  blocoDeInscricoesVermelho: ['monólito', 'monumento', 'glifos', 'runas'],
  blocoDeInscricoesDourado: ['monólito', 'monumento', 'glifos', 'runas'],
  teiaDeAranha: ['teias'],
  tochaDeParede: ['archote', 'facho', 'luz'],
  tochaDePe: ['archote', 'facho', 'tocheiro', 'luz'],
  // Sala de tortura
  potroDeTortura: ['estiramento', 'esticador'],
  damaDeFerro: ['virgem de ferro', 'donzela de ferro'],
  gaiolaSuspensa: ['jaula', 'gaiola pendurada'],
  mesaDeInstrumentos: ['alicate', 'tenaz', 'ferro de marcar', 'carrasco'],
  sangueNoChao: ['poça de sangue', 'mancha de sangue'],
  // Magia e alquimia
  estanteDePocoes: ['frascos', 'elixir', 'boticário', 'alquimista'],
  bolaDeCristal: ['vidente', 'cartomante', 'adivinhação', 'oráculo'],
  pedestalComLivro: ['grimório', 'tomo', 'atril', 'púlpito', 'livro de feitiços'],
  // Tesouro ("poça" acha os quatro montes)
  barraDeOuro: ['lingote de ouro', 'riqueza'],
  monteDeOuro: ['poça de ouro', 'pilha de ouro', 'riqueza', 'fortuna'],
  moedaDeOuro: ['dinheiro', 'dobrão', 'riqueza'],
  monteDeMoedasDeOuro: ['poça de moedas', 'pilha de moedas', 'dinheiro', 'riqueza', 'fortuna'],
  diamante: ['pedra preciosa', 'gema', 'brilhante', 'riqueza'],
  monteDeDiamantes: ['poça de diamantes', 'pilha de diamantes', 'pedras preciosas', 'gemas', 'riqueza', 'fortuna'],
  joia: ['pingente', 'colar', 'medalhão', 'riqueza'],
  monteDeJoias: ['poça de joias', 'pilha de joias', 'riqueza', 'fortuna'],
}

const MARCA_DE_ACENTO = /\p{M}/gu

/** Sem acento, minúsculo e com os espaços juntados: "armario" acha "Armário de cozinha". */
export function nomeParaBusca(texto: string): string {
  return texto.normalize('NFD').replace(MARCA_DE_ACENTO, '').toLowerCase().replace(/\s+/gu, ' ').trim()
}

/** O texto (já em `nomeParaBusca`) começa com o alvo ou tem uma palavra que começa com ele. */
function temComeco(texto: string, alvo: string): boolean {
  return texto.startsWith(alvo) || texto.includes(` ${alvo}`)
}

const SEM_PALAVRAS: readonly string[] = []

/** As palavras do dia a dia do tipo (`PALAVRAS_DO_OBJETO`); item sem tipo não tem nenhuma. */
function palavrasDoObjeto(tipo: TipoMobilia | undefined): readonly string[] {
  return tipo === undefined ? SEM_PALAVRAS : (PALAVRAS_DO_OBJETO[tipo] ?? SEM_PALAVRAS)
}

/**
 * O que a busca da ficha acha, na ordem em que o Enter escolhe: primeiro os
 * nomes que COMEÇAM com o que foi digitado (ou têm uma palavra que começa),
 * depois os que só o contêm, depois os que têm uma palavra do dia a dia que
 * começa com ele (`PALAVRAS_DO_OBJETO`, só quando o item traz o `tipo`:
 * "cripta" traz o mausoléu) e por fim os do grupo cujo título casa ("cozinha"
 * traz o fogão). Dentro de cada leva, a ordem de quem chamou.
 */
export function acharObjetos<T extends { readonly rotulo: string; readonly grupo: string; readonly tipo?: TipoMobilia }>(
  itens: readonly T[],
  consulta: string,
): T[] {
  const alvo = nomeParaBusca(consulta)
  if (alvo === '') return [...itens]
  const comeco: T[] = []
  const meio: T[] = []
  const porPalavra: T[] = []
  const doGrupo: T[] = []
  for (const item of itens) {
    const nome = nomeParaBusca(item.rotulo)
    if (temComeco(nome, alvo)) comeco.push(item)
    else if (nome.includes(alvo)) meio.push(item)
    else if (palavrasDoObjeto(item.tipo).some((palavra) => temComeco(nomeParaBusca(palavra), alvo))) porPalavra.push(item)
    else if (nomeParaBusca(item.grupo).includes(alvo)) doGrupo.push(item)
  }
  return [...comeco, ...meio, ...porPalavra, ...doGrupo]
}
