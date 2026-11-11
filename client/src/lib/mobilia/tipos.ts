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
] as const

/** Móveis do catálogo da mobília desenhada (`lib/mobilia.ts`). */
export type TipoMobilia = (typeof TIPOS_MOBILIA)[number]
