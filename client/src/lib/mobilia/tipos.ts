/**
 * TIPOS DE MÓVEL da mobília desenhada, numa lista só e SEM import nenhum.
 *
 * `types/map.ts` re-exporta `TipoMobilia` daqui e `lib/mobilia.ts` lê a lista
 * daqui: tipo novo entra numa linha deste arquivo, sem disputar
 * `types/map.ts` com quem mais estiver mexendo nele (plano do Meio-Termo,
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, retoque R0).
 * Sem import para não criar ciclo com `types/map.ts`.
 */

/**
 * Todos os tipos que o arquivo do mapa aceita: os 11 de antes e as peças novas
 * dos lotes 1 e 2 do Meio-Termo (fatias MT4 e MT5) e os móveis de casa de 28/10/2026
 * (cozinha, mesa posta, banheiro e sala) e de 29/10/2026 (lareira, oficina, troncos e feno) e de 02/11/2026 (chafariz), registrados em `pecasNovas.ts`. A ordem
 * e a lista que a setinha da ferramenta Objetos oferece moram em
 * `pecasNovas.ts` (`TIPOS_NO_CATALOGO`): peça nova só entra lá com o desenho pronto.
 */
export const TIPOS_MOBILIA = [
  'barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete',
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
  'sebe', 'jardineira', 'arcoDoPortao', 'placaDeSeta', 'tapeteLongo', 'fogo',
  'fogao', 'geladeira', 'pia', 'balcao', 'pratos', 'privada', 'sofa', 'poltrona',
  'lareira', 'fornalha', 'bigorna', 'balde',
  'troncos', 'feno',
  'chafariz',
  // Os objetos de vento (02/11/2026): o cata-vento de fazenda, o moinho e o cata-vento de brinquedo.
  'cataVento', 'moinho', 'cataVentoBrinquedo',
  // A ponte (03/11/2026): madeira, pedra ou corda.
  'ponte',
  // O cemitério (07/11/2026): a cova (o monte de terra) e o caixão fechado e aberto, 1 x 2 casas.
  'cova', 'caixao', 'caixaoAberto',
  // Destroços, sucata e o campinho (10/11/2026): os destroços de madeira, as três sucatas de metal (chapas e
  // vigas, peças e engrenagens, tambores amassados) e o campinho de futebol, que mora no chão.
  'destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho',
  // Lote 1 dos 95 objetos novos (11/11/2026): o boneco de treino, o pilar e o altar de pedra, a estante de
  // livros, os sacos de grão, o banco de praça, os escombros de pedra e o canhão de navio.
  'bonecoDeTreino', 'pilar', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao',
  // Lote 2 dos 95 objetos novos (11/11/2026): o guarda-roupa, o caldeirão no fogo, o forno de pão (com o fogo
  // de casa, aceso ou apagado), a prateleira de depósito, a estátua, as pedras e rochas, o mausoléu e o alvo
  // de arco e flecha.
  'guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'estatua', 'pedrasERochas', 'mausoleu', 'alvoDeArcoEFlecha',
  // Lote 3 dos 95 objetos novos (11/11/2026): a banca de frutas e o toldo listrado da feira, a bancada de
  // ferramentas, a pedra de amolar e o suporte de armas da oficina, o espantalho e o cocho da fazenda, os
  // ossos e a antena parabólica.
  'bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos', 'antenaParabolica',
  // Lote 4 dos 95 objetos novos (11/11/2026), a sala e o quarto: a escrivaninha, o criado-mudo com vela, a
  // cama de casal, o berço, a banqueta, o biombo, o piano e o candelabro de chão.
  'escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao',
  // Lote 5 dos 95 objetos novos (11/11/2026), a cozinha e o banheiro: a banheira, a tina de madeira, o
  // lavatório com jarro, a prateleira de potes, a mesa de corte e o gancho com carne pendurada.
  'banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne',
  // Lote 6 dos 95 objetos novos (11/11/2026), a armazenagem: a pilha de caixas, os barris deitados num
  // suporte, o tonel de adega, as ânforas de barro, o cesto de vime e o cofre.
  'pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre',
  // Lote 7 dos 95 objetos novos (11/11/2026), a rua e o jardim: o varal de roupa, a horta e o canteiro de
  // flores (os dois no chão), o muro baixo de pedra, o toco de árvore, o carrinho de mão e a placa de loja
  // pendurada.
  'varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja',
  // Lote 8 dos 95 objetos novos (11/11/2026), o cemitério: a cruz de madeira, o anjo de pedra, a cerca de
  // ferro, a pá cravada na terra, as velas e oferendas (que iluminam em volta) e a árvore seca.
  'cruzDeMadeira', 'anjoDePedra', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca',
  // Lote 9 dos 95 objetos novos (11/11/2026), a feira: a balança de mercador, a tenda de adivinha, a gaiola
  // com aves, os rolos de tecido, o palco de bardo (que mora no chão) e o barril de peixe.
  'balancaDeMercador', 'tendaDeAdivinha', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe',
  // Lote 10 dos 95 objetos novos (11/11/2026), a oficina e a fazenda: o fole, o manequim com armadura, a pilha
  // de lingotes e a serra da oficina; o galinheiro, a colmeia, o arado, o toco com machado e a plantação em
  // fileiras (que mora no chão, rente como o campinho) da fazenda.
  'fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'galinheiro', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras',
  // Lote 11 dos 95 objetos novos (11/11/2026), os destroços e o esporte: a carroça quebrada, o barril
  // quebrado, a viga caída e a armadura enferrujada dos destroços; a mesa de jogo, o ringue de luta (que mora
  // no chão, como o palco de bardo), o balanço e a mesa de sinuca do esporte e lazer.
  'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca',
  // Lote 12 dos 95 objetos novos (11/11/2026), o porto e o navio: a âncora, as cordas enroladas, o timão, o
  // bote, a rede de pesca, o píer (que mora no chão, como a ponte) e o caixote de peixe. E o lote 15, as duas
  // armaduras que o mestre pediu: a despedaçada, espalhada como os ossos, nos destroços, e a de pé no pedestal,
  // no templo.
  'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura',
  // Lotes 13 e 16 dos 95 objetos novos (11/11/2026), o templo e a masmorra: o braseiro (com o fogo de casa
  // da lareira, aceso ou apagado), a cela com grade e a armadilha de espinhos (as duas moram no chão, com
  // altura), a corrente, o círculo mágico (no chão, rente como o campinho) e os três blocos de inscrições, o
  // azul, o vermelho e o dourado.
  'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico', 'blocoDeInscricoesAzul', 'blocoDeInscricoesVermelho', 'blocoDeInscricoesDourado',
  // Lote 14 dos objetos novos (11/11/2026), a sala de tortura, toda vazia e parada: o potro de tortura, a dama
  // de ferro, o tronco de prisioneiro, a gaiola suspensa, a cadeira de interrogatório, a mesa de instrumentos
  // de tortura e o sangue no chão (que mora no chão, rente como o círculo mágico). E os três últimos do lote
  // 13, a magia e a alquimia: a estante de poções, a bola de cristal e o pedestal com livro aberto.
  'potroDeTortura', 'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'mesaDeInstrumentos', 'sangueNoChao',
  'estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro',
] as const

/** Móveis do catálogo da mobília desenhada (`lib/mobilia.ts`). */
export type TipoMobilia = (typeof TIPOS_MOBILIA)[number]
