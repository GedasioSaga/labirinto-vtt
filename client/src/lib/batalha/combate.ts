import type { Modificador } from '../personagem'
import type { RespostasDoPedido } from './perguntaNaHora'
import type { AutorDaAcao } from './turnos'

/**
 * COMBATE DA BATALHA ONE PIECE, F2 (seção 2.2 de
 * docs/planos/batalha-one-piece-f2-plano.md, com as respostas Q1 a Q8 do
 * usuário no fim do plano): os tipos do golpe, da reação, do contra-ataque e
 * do estado de combate de cada personagem. Estado da SESSÃO do mestre
 * (`stores/batalhaStore.ts`); ao jogador sai só o recorte de
 * `vistaDoJogador.ts`.
 *
 * Puro: só tipos e constantes.
 */

/**
 * O que a reação deu. "naoReagiu" = escolheu Não reagir (antes do dado);
 * "passou" = rolou e preferiu Passar, tomando o golpe inteiro (no 1 natural
 * vira "critico": passar não foge do crítico); "semReacao" = Surpresa,
 * Overload ou golpe que o alvo não pode reagir.
 */
export type SaidaDaReacao = 'critico' | 'cheio' | 'metade' | 'esquiva' | 'contra' | 'naoReagiu' | 'passou' | 'semReacao'

/**
 * Tipos de habilidade, F1 (docs/planos/batalha-tipos-de-habilidade-plano.md,
 * seção 4f): o que a técnica de reação faz no lugar do d20. "rolar" = rola o
 * d20 de sempre COM a técnica (Giro da Lança: gasta custo e recarga e põe o
 * nome na linha); as outras resolvem o alvo na hora, sem dado.
 */
export type SaidaDaTecnica = 'esquiva' | 'metade' | 'contra' | 'cheio' | 'rolar'

/** As saídas que quem reage com técnica pode escolher (a lida vem marcada e é trocável, decisão 2). Enum fechado do fio. */
export const SAIDAS_DA_TECNICA: readonly SaidaDaTecnica[] = ['esquiva', 'metade', 'contra', 'cheio', 'rolar']

/** A técnica com que o alvo reagiu, como o golpe a guarda para o registro. `aMao` = trocou a saída que a ficha diz. */
export interface TecnicaDaReacao {
  cartaoId: string
  nome: string
  aMao?: true
}

/** A ação que a técnica gasta. "livre" não gasta nada. */
export type AcaoDaTecnica = 'simples' | 'completa' | 'bonus' | 'livre'

/** Estado de combate de UM personagem nesta batalha (por personagemId: duas fichas do mesmo personagem dividem). */
export interface CombateDoPersonagem {
  /** cartaoId → turnos que faltam para a técnica voltar (0 sai da lista). */
  recargas: Readonly<Record<string, number>>
  /** cartaoId → vezes usadas nesta batalha ("2 vezes por combate"). */
  usos: Readonly<Record<string, number>>
  /** Já usou um Overload nesta batalha: trava todos os Overload dele. */
  overload: boolean
  /** Concentração guardada para o PRÓXIMO golpe. */
  carga: 0 | 1 | 2 | 3
  /** "rodada:cartaId" da vez em que concentrou (uma vez por vez). */
  concentrouEm?: string
  /**
   * C2 (lote de 01/11): a ação que o Concentrar de `concentrouEm` gastou e a
   * linha dele. Zerar na mesma vez devolve essa ação. Ausente = a 3ª carga
   * (livre, C1) ou ainda não concentrou.
   */
  concentrouCom?: ConcentracaoGasta
  /**
   * R5 (lote de 01/11): gastou a reação (carregar o contador, a polaridade
   * do Vagn) e fica sem reação até o começo da vez dele. Ausente = tem.
   */
  semReacao?: true
  /**
   * R6 (lote de 01/11): os ataques adicionais da forma ligada (Ignição) já
   * feitos e em que rodada ("apenas uma vez por rodada"). Outra rodada = 0.
   * Ausente = nenhum.
   */
  ataquesExtras?: { rodada: number; usados: number }
  /**
   * cartaoIds da aba Armas levados para a batalha; `null` = ainda não
   * escolheu. Troca quando quiser, sempre dentro do limite (Q8).
   */
  armas: readonly string[] | null
  /**
   * Tipos de habilidade F3: as chaves "cartaoId:gatilho" (`chaveDoGatilho`)
   * cujo lembrete já saiu (ou cuja passiva já foi ativada): o gatilho não
   * lembra de novo nesta batalha. Ausente = nenhuma.
   */
  lembradas?: readonly string[]
  /**
   * Tipos de habilidade F3: os lembretes de passiva esperando o dono (ou o
   * mestre, no NPC): "Ativar / Agora não" no gatilho e "Aplicar / pular" no
   * começo da vez. A passiva NUNCA ativa sozinha (decisões 3 e 4). Ausente = nenhum.
   */
  lembretes?: readonly LembreteDaPassiva[]
  /**
   * Tipos de habilidade F4: os cartaoIds BASE que evoluíram nesta batalha
   * (`PedidoDeEvolucao`). Vale só nesta batalha: a evolução permanente é
   * editar a ficha. Ausente = nenhum. Até `EVOLUIDAS_MAX`.
   */
  evoluidas?: readonly string[]
  /**
   * Conserto das fichas F1 (+10 SP por vez, resposta do Vincent): já começou
   * uma vez nesta batalha. A primeira vez não ganha SP. Ausente = ainda não.
   */
  jaJogou?: true
  /** Conserto das fichas F1: gastou SP desde o começo da última vez dele; a próxima vez não ganha os +10. Ausente = não gastou. */
  gastouSp?: true
  /**
   * F2b (Aparência Inofensiva): os tokenIds que já o viram lutar nesta
   * batalha (estavam na ordem num golpe dele, alvos ou não: a Surpresa não
   * vale mais neles). Só de quem tem o cartão (`contaQuemOViuLutar`).
   * Ausente = ninguém.
   */
  viramLutar?: readonly string[]
  /**
   * F2b (revisão, Ignição): uma forma que muda a Velocidade ligou ou
   * desligou nesta rodada; na virada, a carta dele vai para o lugar da
   * Agilidade de agora (`passarVez`), e a marca sai. Ausente = não mudou.
   */
  reordenarNaVirada?: true
  /**
   * F2 (revisão da fatia D): os cartaoIds das técnicas MANTIDAS agora (Giro,
   * Campo; `mantidaDe` em `mecanicasAMao.ts`): sem recarga enquanto ficam
   * ligadas; o lembrete do custo sai no começo de cada vez. Ausente = nenhuma.
   */
  mantidas?: readonly string[]
}

/** C2: o que o Concentrar da vez gastou (a Simples ou a Bônus) e a linha que o registrou. */
export interface ConcentracaoGasta {
  acao: 'simples' | 'bonus'
  linhaId: string
}

/**
 * Tipos de habilidade F3: um lembrete de passiva. "ativar" = o gatilho bateu
 * (início, rodada N, vida abaixo de N%): a tela pergunta "Ativar / Agora
 * não". "porTurno" = a passiva ligada tem efeito "a cada turno" (Fortaleza:
 * HP +30, FOR +10): no começo da vez do dono, "Aplicar / pular".
 */
export interface LembreteDaPassiva {
  cartaoId: string
  /** A ficha do dono em que a tela mostra o lembrete (a primeira carta dele na ordem). */
  tokenId: string
  tipo: TipoDoLembrete
  /** A chave do gatilho (`chaveDoGatilho`) ou, no "porTurno", `cartaoId:turno`. */
  chave: string
  /** A rodada em que o lembrete saiu. */
  rodada: number
  /**
   * F2 (fatia A): no lembrete de um selo que tira por vez (Sangrando,
   * Queimando N), o nome e quanto tira, gravados quando o lembrete nasce: o
   * selo pode sair no fim da vez antes de o mestre clicar Aplicar. Ausente =
   * lembrete de outro tipo (ou gravado antes disto). Só do host.
   */
  porVez?: PorVezDoSelo
}

/** F2 (fatia A): o que um selo que tira por vez tira: o nome da tabela ("Queimando") e quanto (direto no HP). */
export interface PorVezDoSelo {
  nome: string
  dano: number
}

export type TipoDoLembrete = 'ativar' | 'porTurno'

/** Os tipos de lembrete, para o enum fechado do fio. */
export const TIPOS_DO_LEMBRETE: readonly TipoDoLembrete[] = ['ativar', 'porTurno']

/**
 * Tipos de habilidade F3 (Passivas, seções 3.3 e 4b do plano, com as decisões
 * 3 e 4 do usuário): o que o dono (ou o mestre) pede sobre uma passiva. Vale
 * FORA da vez e não gasta ação. `tokenId` = a ficha do dono (a passiva é do
 * personagem dela). Mensagem própria no fio (`batalha.passiva`): não é
 * `PedidoDeAcao`.
 *  - "passiva": `ligar` true = Ativar (cobra o custo, conta usos e recarga do
 *    Tempo, põe o selo dourado com os mods no dono ou em `alvoTokenId`);
 *    `ligar` false = Desligar (tira o selo). `custo` = o confirmado na tela
 *    (`null` = o da ficha); `selo` = o sugerido e editado na tela (ausente =
 *    o que o host lê da ficha, `seloDaPassiva`).
 *  - "lembrete": a resposta ao lembrete. `aplicar` true = Aplicar o efeito
 *    "a cada turno" (só com a passiva ligada); false = "Agora não" / pular.
 *    O "Ativar" do lembrete é o pedido "passiva" com `ligar` true.
 *  - Tipos de habilidade F4: `variante` = a opção escolhida no Ativar da
 *    passiva com escolha (Melodia): a `chave` de `variantesDe`, até
 *    `NOME_DO_GOLPE_MAX`. Sem `selo`, o host lê o selo do texto da opção.
 */
export type PedidoDePassiva =
  | { tipo: 'passiva'; tokenId: string; cartaoId: string; ligar: boolean; alvoTokenId?: string; custo: number | null; selo?: SeloPedido; variante?: string }
  /** S4: `atributoId` = o atributo escolhido no Aplicar da Preparação para a Batalha (+20); só nela. */
  | { tipo: 'lembrete'; tokenId: string; cartaoId: string; aplicar: boolean; atributoId?: string }

/**
 * Tipos de habilidade F4 (Evolução, seções 3.3 e 4d do plano, decisão 5 do
 * usuário): Evoluir a técnica `cartaoId` do personagem da ficha `tokenId`
 * NESTA batalha. Ação livre (não gasta ação). O jogador, só na vez de uma
 * carta do personagem; o mestre, sempre. `custo` = o digitado na tela, em SP
 * (`null` = sem custo: o app não confere a condição, só a mostra). Mensagem
 * própria no fio (`batalha.evoluir`): não é `PedidoDeAcao`.
 */
export interface PedidoDeEvolucao {
  tipo: 'evoluir'
  tokenId: string
  cartaoId: string
  custo: number | null
}

/**
 * INVOCAÇÃO (docs/planos/batalha-invocacao-plano.md): os números de um
 * invocado. `blocos` = o movimento fixo dele na vez do bando (decisão 3).
 */
export interface NumerosDoInvocado {
  hp: number
  dano: number
  blocos: number
}

/**
 * Invocação: pedir a técnica de Tipo Invocação da ficha `tokenId` (o dono).
 * Na vez de uma carta do mesmo personagem; gasta a ação da técnica, cobra o
 * custo, marca recarga e usos e, na opção que exige concentração (Ultra),
 * gasta a carga. Nasce uma invocação PENDENTE: o mestre põe no mapa depois
 * (`colocarInvocado`). `opcao` = a `chave` de `opcoesDaInvocacao`; `custo` =
 * o confirmado na tela (`null` = o da ficha); `acao` = só quando a ficha não
 * diz. Mensagem própria no fio (`batalha.invocar`): não é `PedidoDeAcao`.
 */
export interface PedidoDeInvocacao {
  tipo: 'invocar'
  tokenId: string
  cartaoId: string
  opcao: string
  custo: number | null
  acao: AcaoDaTecnica | null
}

/**
 * Invocação: o pedido aceito e ainda não posto no mapa. Só do mestre (o
 * jogador vê a linha do registro). `numeros` = os lidos do texto (ou, no
 * Ultra, os sugeridos: `sugeridos`); `null` = o texto não diz, o mestre
 * digita ao colocar. `imagem` = a do cartão da técnica (`midia:` ou embutida).
 */
export interface InvocacaoPendente {
  /** `invocacao_<uuid>`. */
  id: string
  /** A linha "habilidade" do pedido (o Desfazer dela tira a pendência, ou o invocado). */
  linhaId: string
  rodada: number
  autor: AutorDaAcao
  donoTokenId: string
  donoPersonagemId: string
  cartaoId: string
  opcao: string
  /** O nome da opção ("LOBOS COMUNS"), para o aviso ao mestre. */
  rotulo: string
  ultra: boolean
  /** O nome do invocado no mapa ("Lobo", "Ultra Lobo"). */
  nome: string
  numeros: NumerosDoInvocado | null
  sugeridos: boolean
  imagem: string | null
}

/**
 * Invocação: um invocado no mapa. Tem token e personagem temporário próprios
 * (o HP mora no personagem); não tem carta: age na carta do bando do dono
 * (`CartaDaOrdem.bando`). Não reage (golpe nele vai direto ao dano).
 */
export interface InvocadoNaBatalha {
  tokenId: string
  personagemId: string
  donoTokenId: string
  donoPersonagemId: string
  cartaoId: string
  opcao: string
  ultra: boolean
  nome: string
  /** Movimento fixo por vez do bando. */
  blocos: number
  /** O dano do golpe dele (a técnica "Golpe" da ficha temporária). */
  dano: number
  /** A pendência de onde veio (o Desfazer do pedido tira o invocado). */
  pedidoId: string
  /** A linha "habilidade" do pedido. Desfeita = nada traz este invocado de volta. */
  linhaDoPedido: string
  /** A linha "invocacao" que o pôs no mapa. Desfeita = nada traz este invocado de volta. */
  linhaId: string
}

/**
 * Construtor C6 (tela do mestre ao transformar): a forma com a peça "o mestre
 * decide os números" (`formaDecididaPeloMestre`) não liga no pedido. O pedido
 * gasta a ação, os usos e o Overload como sempre e nasce esta PENDÊNCIA: o
 * mestre escolhe os modificadores e, se quiser, uma habilidade que ela ganha
 * (`decidirForma`), e só aí a forma liga. Só do mestre; o dono vê "o mestre
 * está decidindo" pelo recorte (`FormaEsperandoOMestre`).
 */
export interface FormaPendente {
  /** `decisao_<uuid>`. */
  id: string
  /** A linha "transformacao" do pedido (o Desfazer dela tira a pendência, ou a forma decidida). */
  linhaId: string
  rodada: number
  /** A carta da vez do pedido: a Duração da forma conta a partir desta vez, não da vez em que o mestre decidiu. */
  cartaId: string
  autor: AutorDaAcao
  tokenId: string
  personagemId: string
  cartaoId: string
  /** O nome da forma na ficha ("Sulong"), para a fila do mestre. */
  nome: string
  /** O pedido quis a imagem da forma no token e no retrato. */
  trocarImagem: boolean
}

/** C6: formas esperando o mestre numa cena. */
export const FORMAS_PENDENTES_MAX = 8
/** C6: modificadores que o mestre decide numa forma (atributos e recursos de atual e máximo). */
export const MODS_DA_DECISAO_MAX = 8
/** C6: o nome da habilidade que a forma ganha. */
export const NOME_DA_HABILIDADE_MAX = 40
/** C6: o que a habilidade faz, em texto (o app só lembra; o mestre aplica). */
export const TEXTO_DA_HABILIDADE_MAX = 300

/** C6: o que o mestre decidiu ao transformar. `habilidade` `null` = não ganha nenhuma. */
export interface DecisaoDaForma {
  mods: readonly Modificador[]
  habilidade: { nome: string; texto: string } | null
}

/** Invocação: pendências numa cena. */
export const INVOCACOES_PENDENTES_MAX = 20
/** Invocação: invocados no mapa numa cena. */
export const INVOCADOS_MAX = 60
/** Invocação: membros de um bando no recorte do jogador. */
export const MEMBROS_DO_BANDO_MAX = 16
/** Invocação: teto do nome do invocado (o nome do token). */
export const NOME_DO_INVOCADO_MAX = 40
/** Invocação: teto do movimento fixo de um invocado. */
export const BLOCOS_DO_INVOCADO_MAX = 99

/** Um alvo como chega no pedido, ANTES da reação. `dano` null = golpe sem dano. */
export interface PedidoDeAlvo {
  tokenId: string
  dano: number | null
}

/**
 * O que quem age pede. `contraDe` = é o contra-ataque (Q6) ganho no golpe com
 * esse id: fora da vez, sem gastar ação da vez. `perfurante` (Q4) = o dano vai
 * direto ao HP, sem gastar o Escudo; liga sozinho quando a habilidade diz, e
 * quem ataca pode desligar. `perfuracao` = quanto do dano perfura (inteiro de
 * `PERFURACAO_MIN` a `PERFURACAO_MAX`); ausente com `perfurante` = 100 (tudo).
 */
export type PedidoDeAcao =
  /**
   * F3: `selo` = o sugerido pela habilidade, marcado na mira; pega só se o golpe acerta (Q6).
   * `balaId` = o tipo de bala da arma (subcartão "Tipos de bala"); exige `armaId`. Ausente = como antes.
   */
  | {
      tipo: 'atacar'
      armaId: string | null
      alvos: readonly PedidoDeAlvo[]
      surpresa: boolean
      perfurante: boolean
      perfuracao?: number
      contraDe?: string
      selo?: SeloPedido
      balaId?: string
      /** F2 (fatia C): as respostas das perguntas de todo golpe do dono (o Electro da Aira). Ausente = sem pergunta. */
      respostas?: RespostasDoPedido
    }
  | {
      tipo: 'habilidade'
      cartaoId: string
      armaId: string | null
      alvos: readonly PedidoDeAlvo[]
      surpresa: boolean
      perfurante: boolean
      perfuracao?: number
      /** O custo confirmado na tela; `null` = o da ficha. */
      custo: number | null
      /** Só quando a ficha não diz; `null` = a da ficha. */
      acao: AcaoDaTecnica | null
      contraDe?: string
      selo?: SeloPedido
      /**
       * Tipos de habilidade F4: a opção escolhida nos chips da mira (a
       * `chave` de `variantesDe`), até `NOME_DO_GOLPE_MAX`. Ausente = sem
       * escolha. Vai no registro: "Harvey usa Medicina (Cirugia)".
       */
      variante?: string
      /**
       * Conserto das fichas F2 (fatia A): as respostas das perguntas na hora
       * da técnica ("cortante ou perfurante?"), chave → opção ou número. O
       * host confere contra a mecânica do cartão (`mecanicasAMao.ts`).
       * Ausente = sem pergunta.
       */
      respostas?: RespostasDoPedido
      /**
       * F2 (revisão da fatia E): o tipo de bala da arma, na técnica cuja
       * fórmula diz "Dano da Bala" (Desenhar o alvo com a Bala de Prata). O
       * dano dela já vem no de cada alvo; o host lê daqui o selo da bala e o
       * registro. Exige `armaId`. Ausente = sem bala especial.
       */
      balaId?: string
    }
  | { tipo: 'concentrar' }
  /** Q6: o contra-ataque gasto em se mover. Só marca (e tira o atalho); o movimento em si é o arrasto de sempre. */
  | { tipo: 'mover'; contraDe: string }
  /**
   * F3: Ativar a forma pelo menu. `acao` = a escolhida na tela; `trocarImagem`
   * = a caixa "Trocar a imagem". Nunca é contra-ataque: `contraDe` existe só
   * como `undefined`, para quem lê `pedido.contraDe` sem olhar o tipo.
   */
  | { tipo: 'transformar'; cartaoId: string; acao: AcaoDaForma; trocarImagem: boolean; contraDe?: undefined }
  /** F3: "Desfazer a forma" (ação livre). Nunca é contra-ataque. */
  | { tipo: 'destransformar'; cartaoId: string; contraDe?: undefined }

/** Os tipos de pedido de ação, para o enum fechado do fio. */
export type TipoDoPedidoDeAcao = PedidoDeAcao['tipo']

export type PedidoDeReacao =
  /** `golpeId` null = reação livre (o botão Reação sem golpe esperando). */
  | { tipo: 'rolar'; golpeId: string | null; tokenId: string; modificador: number; vantagem?: VantagemDoDado }
  | { tipo: 'rerolar'; golpeId: string; tokenId: string; modificador: number; vantagem?: VantagemDoDado }
  /** Só uma das saídas que o dado liberou (`saidasPossiveis`). */
  | { tipo: 'escolher'; golpeId: string; tokenId: string; saida: SaidaDaReacao }
  | { tipo: 'naoReagir'; golpeId: string; tokenId: string }
  /** Só DEPOIS do dado: toma o golpe inteiro sem usar a reação (`saidaDoPassar`: o 1 natural continua crítico). */
  | { tipo: 'passar'; golpeId: string; tokenId: string }
  /**
   * Tipos de habilidade F1: reagir COM a técnica de reação `cartaoId`, antes do
   * d20 e sem ele. `saida` = a lida da ficha ou a trocada na tela (uma de
   * `SAIDAS_DA_TECNICA`); "rolar" rola o d20 do host com `modificador` (só
   * nela). Cobra o custo (`custo` = o confirmado na tela; `null` = o da
   * ficha), marca recarga, usos e Overload e não gasta ação da vez.
   * `seloNoAtacante` = o selo sugerido ("Marcado"), marcado na caixa.
   */
  | {
      tipo: 'tecnica'
      golpeId: string
      tokenId: string
      cartaoId: string
      saida: SaidaDaTecnica
      custo: number | null
      modificador?: number
      seloNoAtacante?: SeloPedido
      vantagem?: VantagemDoDado
      /** F2 (fatia B): o token de quem reage no lugar do alvo `tokenId` (um dos `porPerto` dele); ausente = o próprio alvo. */
      por?: string
    }
  /**
   * R3 (lote de 01/11): passa SEM tomar dano, antes ou depois do dado (o mestre
   * decidiu na mesa que não pegou). Não é acerto: sem dano, sem selo, sem marca.
   * Linha "reacao" própria, com Desfazer que devolve o alvo à espera.
   */
  | { tipo: 'semDano'; golpeId: string; tokenId: string }

/**
 * R4 (lote de 01/11): o "Ajustar..." da carta. "atual" e "maximo" mexem na
 * ficha (o atual do HP do NPC com força é o HP NORMAL, decisão do usuário:
 * `ajusteDoAtualDigitado`); "atributo" põe um selo sem turnos com o delta no
 * atributo, até a batalha acabar. O mestre ajusta qualquer ficha; o jogador
 * só a dele de verdade (o host confere).
 */
export type MudancaDoAjuste =
  | { tipo: 'atual' | 'maximo'; recursoId: string; valor: number }
  | { tipo: 'atributo'; atributoId: string; delta: number }

export interface PedidoDeAjusteNaBatalha {
  tokenId: string
  mudancas: readonly MudancaDoAjuste[]
}

/** Mudanças num "Ajustar..." só (HP, SP, Escudo, os máximos e um atributo cabem). */
export const MUDANCAS_DO_AJUSTE_MAX = 8

/**
 * R5 (lote de 01/11): subir 1 nível do contador `cartaoId` gastando a reação
 * (o jogador, na ficha dele), ou zerar (só o mestre). A regra é da store
 * (`motivoDoContador`).
 */
export interface PedidoDoContador {
  tipo: 'ganhar' | 'zerar'
  tokenId: string
  cartaoId: string
}

/**
 * Conserto das fichas F1 (fatia S4, regra do sistema): com vantagem o host
 * rola 2 d20 e fica com o MAIOR; com desvantagem, com o MENOR. Na reação (o
 * d20 e a técnica que rola); a disputa de dados usa a mesma regra.
 */
export type VantagemDoDado = 'vantagem' | 'desvantagem'

export const VANTAGENS_DO_DADO: readonly VantagemDoDado[] = ['vantagem', 'desvantagem']

/** A vantagem na rolagem: o modo e o d20 que ficou de fora. */
export interface VantagemNaRolagem {
  modo: VantagemDoDado
  outro: number
}

/** O d20 da reação, rolado pelo HOST. `vezes` conta as rerolagens (1 = a primeira). */
export interface RolagemDaReacao {
  d20: number
  modificador: number
  total: number
  vezes: number
  /** Rolou 2 d20 (S4): `d20` é o que ficou. Ausente = 1 d20. */
  vantagem?: VantagemNaRolagem
  /**
   * F2 (revisão da fatia E, Marcado: "desvantagem em desviar"): o d20 que
   * vale para Esquivar e Contra-atacar, o menor entre o `d20` e mais um.
   * Defender e Receber seguem com o `d20`. Ausente = o `d20` vale para tudo.
   */
  d20DaEsquiva?: number
}

export interface AlvoDoGolpe {
  tokenId: string
  personagemId: string | null
  /** O que chega (já com concentração e Surpresa); `null` = golpe sem dano. */
  dano: number | null
  podeReagir: boolean
  rolagem?: RolagemDaReacao
  saida?: SaidaDaReacao
  /** Presente = resolvido. No contra-ataque (Q6) é 0. */
  danoFinal?: number
  /** Tipos de habilidade F1: reagiu com esta técnica (o registro diz "esquivou com Passo de Valsa"). */
  tecnica?: TecnicaDaReacao
  /** R1 (lote de 01/11): o golpe acertou a marca dele: `danoFinal` já é o dobro, e a marca saiu. */
  marcado?: true
  /** R3 (lote de 01/11): passou sem tomar dano (saída "esquiva", `danoFinal` 0). */
  semDano?: true
  /** R6 (lote de 01/11): a forma ligada do alvo tirou este tanto por cento do dano (Resiliente: 20). S4: com a Determinação, o total das duas. */
  reducao?: number
  /** S4: quem tirou ("Resiliente", "Determinação", "Resiliente e Determinação"); ausente = a forma, como antes. */
  reducaoDe?: string
  /** F2 (fatia B): a disputa que o app rolou no acerto (Corta Cenoura), já em texto para o registro: "disputa d20 15+1 = 16 contra d20 8+2 = 10, o selo pegou". */
  disputa?: string
  /** F2 (fatia D, Revigorar): o que a técnica fez no alvo além do dano, em texto para o registro ("tirou 2 debuffs, curou 100"). */
  nota?: string
  /**
   * F2 (fatia B, o "perto" do Aplauso): os tokens das fichas perto que podem
   * reagir NO LUGAR dele a este golpe Overload (técnica que rebate, com o alvo
   * na área dela), lidos ao lançar. Ausente = ninguém.
   */
  porPerto?: readonly string[]
}

export interface GolpeDaBatalha {
  /** `golpe_<uuid>`. */
  id: string
  /** A linha do registro que este golpe atualiza a cada alvo resolvido. */
  linhaId: string
  cartaId: string
  rodada: number
  atacanteTokenId: string
  atacantePersonagemId: string | null
  autor: AutorDaAcao
  /** Da arma, da habilidade, ou "Ataque". */
  nome: string
  surpresa: boolean
  overload: boolean
  /** Q4: o dano vai direto ao HP, sem gastar o Escudo. O mestre pode trocar enquanto há alvo esperando. */
  perfurante: boolean
  /** Quanto do dano perfura, de 1 a 100; ausente = 100. Só vale com `perfurante`. */
  perfuracao?: number
  /** O golpe é um contra-ataque ganho no golpe com este id. */
  contraDe?: string
  alvos: readonly AlvoDoGolpe[]
  /** F3: o selo que o golpe põe em cada alvo que ele acerta (Q6). Tipos de habilidade F2: com a natureza e a técnica que o pôs. */
  selo?: SeloDoGolpe
  /** A bala do Atacar (o registro diz "atira com Rosa Fúnebre (Bala de Prata)"); `efeito` vazio não vem. */
  bala?: BalaDoGolpe
  /** Tipos de habilidade F4: o rótulo da opção escolhida ("Medicina (Cirugia)" no registro). Ausente = sem escolha. */
  variante?: string
  /** Tipos de habilidade F4: o uso evoluído da técnica sem "Evolui para" ("CAÇA AS BRUXAS! (evoluída)"). */
  evoluida?: true
  /** R1 (lote de 01/11): o cartaoId da técnica que marca quem ela acerta (Desenhar o Alvo), sem custo nem teste. Tirado da ficha pelo host. */
  marca?: string
  /** R1: o golpe usou arma que atira (De fogo, Híbrida): o acerto lembra a passiva de marca de quem atirou. */
  armaQueAtira?: true
  /**
   * F2 (fatia C): a porcentagem do dano causado que volta em vida para quem
   * bateu (Bênção de uma Raposa: 10), dos selos dele quando o golpe saiu.
   * Tirada pelo host, nunca do fio. Ausente = nada volta.
   */
  curaDoDano?: number
  /** F2 (fatia C): a concentração gasta no golpe (a CD da dança da Aira sobe com ela). Ausente = 0. */
  carga?: number
  /** F2 (fatia E, vantagem de Ogro): os alvos reagem com desvantagem (2 d20, fica o menor). Tirado pelo host. Ausente = dado normal. */
  reacaoComDesvantagem?: true
  /**
   * F2 (revisão da fatia E, Bala de Prata): o selo da bala ("Ferido por
   * prata"), à parte do `selo`: pega em quem o tiro acerta junto com o selo
   * da mira, o da técnica e a marca. Tirado pelo host. Ausente = nenhum.
   */
  seloDaBala?: SeloDoGolpe
  /** F2 (fatia F, Golpe Baixo): o selo que quem usa ganha ao lançar (o "+8 em reação" por 2 turnos). Ausente = nenhum. */
  seloEmQuemUsa?: SeloDoGolpe
}

/**
 * R1 (lote de 01/11): o lembrete "Marcar o alvo?" que o acerto com arma que
 * atira deixa para o dono da passiva de marca (`marca.ts`). Mora em
 * `TurnosDaCena.lembretesDaMarca`, por cena. Nunca marca sozinho.
 */
export interface LembreteDaMarca {
  /** `marca_<uuid>`. */
  id: string
  /** A linha do golpe que acertou: desfeita, o lembrete não volta. */
  linhaId: string
  golpeId: string
  /** A passiva de marca (Olhar Artístico). */
  cartaoId: string
  /** A ficha de quem atirou (a tela mostra o lembrete nela). */
  tokenId: string
  personagemId: string
  /** Quem foi acertado e pode ser marcado. */
  alvoTokenId: string
  rodada: number
}

/**
 * R1: a resposta ao lembrete da marca. "sp" = paga o SP da passiva; "teste" =
 * o host rola d20 + modificador do atributo contra a CD; "passou"/"falhou" =
 * rolou fora ("rolei fora"); "agoraNao" = tira o lembrete, sem linha.
 */
export interface PedidoDeMarca {
  tipo: 'marcar'
  lembreteId: string
  como: 'sp' | 'teste' | 'passou' | 'falhou' | 'agoraNao'
  /** Só com "teste": o modificador digitado na tela, que vence o do rank. Ausente = o do rank. */
  modificador?: number
}

/** A bala que o golpe usou, como o registro a mostra. */
export interface BalaDoGolpe {
  id: string
  nome: string
  efeito?: string
}

/**
 * Q6: quem tirou 20 (total) e escolheu Contra-atacar não recebe o dano e
 * ganha, na hora, uma ação a mais fora da vez: Atacar, Habilidade ou Mover.
 * Fica guardado até ser usado (`PedidoDeAcao` com `contraDe`), o golpe de
 * origem ser desfeito, ou a batalha acabar.
 */
export interface ContraAtaque {
  /** O golpe em que o contra-ataque nasceu. */
  golpeId: string
  /** A ficha que tirou 20 e ganhou a ação. */
  tokenId: string
  personagemId: string | null
  /** Quem a atacou (o atalho "Contra-atacar" sugere ele, mas o alvo é livre). */
  atacanteTokenId: string
  rodada: number
}

export type EfeitoDaBatalha =
  | { seq: number; tipo: 'golpe'; golpeId: string; atacanteTokenId: string; nome: string; alvos: readonly string[]; surpresa: boolean; overload: boolean }
  | { seq: number; tipo: 'reacao'; golpeId: string | null; tokenId: string; d20: number; modificador: number; total: number }
  | { seq: number; tipo: 'dano'; tokenId: string; valor: number; saida: SaidaDaReacao | 'direto' }
  /** F3 (fatia J): o MESTRE desfez uma linha e o Judge ergue a carta. Sem token: vai a todos na cena. */
  | { seq: number; tipo: 'judge'; gesto: 'carta' }
  /**
   * F3 (fatia T): a forma ligou. `imagem` = a da forma, se o dono quis trocar.
   * `numeros` (a prévia: "FOR 160 → 220") só sai a quem é dono ou aliado do
   * token (`efeitosParaJogador`); ausente = só o nome.
   */
  | { seq: number; tipo: 'transformacao'; tokenId: string; forma: string; imagem: string | null; numeros?: readonly NumeroDaForma[] }
  /** F3 (fatia T): desfez a forma (ação livre). Texto curto sobre o token. */
  | { seq: number; tipo: 'forma'; tokenId: string; forma: string; ligou: false }
  /** F3 (fatia T): um selo acabou ("ATORDOADO ACABOU"). */
  | { seq: number; tipo: 'selo'; tokenId: string; nome: string; acabou: true }

/** Um número que a forma muda: "FOR 160 → 220", "HP máx 1.200 → 1.800", "HP 900 → 1.500". */
export interface NumeroDaForma {
  rotulo: string
  de: number
  para: number
  nota?: string
}

/**
 * F3: a forma ativada PELO MENU nesta batalha, por personagemId
 * (`TurnosDaCena.formas`). `imagem` = `CartaoDaFicha.imagem` se o dono quis
 * trocar a do token e do retrato; vale só enquanto o cartão segue ligado
 * (`aparenciaDaForma`).
 */
export interface FormaNaBatalha {
  cartaoId: string
  imagem: string | null
  /**
   * F2b (A Caçada Começa, `duracaoDaForma`): as vezes do dono que faltam e a
   * vez em que ligou ("rodada:cartaId", que não conta). No fim da última, a
   * forma desliga sozinha. Ausente = dura até alguém desfazer.
   */
  duracao?: { faltam: number; ligouNa: string }
}

/**
 * F3: um selo com duração na carta ("Atordoado 2"). Por TOKEN: a carta extra
 * mostra o mesmo. Conta na vez do alvo (Q4): desconta no fim da vez dele, no
 * máximo 1 vez por rodada.
 */
export interface SeloDaBatalha {
  /** `selo_<uuid>`. */
  id: string
  tokenId: string
  /** Até `NOME_DO_SELO_MAX`. */
  nome: string
  /** Os turnos que faltam; `null` = até o mestre tirar. */
  turnos: number | null
  total: number | null
  /** A rodada em que já descontou. Com `contadoNaCarta`, 1 vez por VEZ; sem ele (selo de antes), 1 vez por rodada. */
  contadoNaRodada?: number
  /**
   * Conserto das fichas F1 (P2 do grilling): a carta da vez em que já
   * descontou (ou em que nasceu). Com carta extra o selo desce por vez: a
   * outra carta do mesmo token desconta de novo na mesma rodada.
   */
  contadoNaCarta?: string
  /** O nome da técnica que o pôs. */
  origem?: string
  /** Tipos de habilidade F2: o que o selo soma enquanto existe ("FOR +20"); ausente = nada. */
  mods?: readonly ModDoSelo[]
  /** Tipos de habilidade F2: o cartaoId da habilidade que o pôs; ausente = posto à mão. */
  cartaoId?: string
  /** Tipos de habilidade F2: a cor da pílula; ausente = "condicao" (como antes). */
  natureza?: NaturezaDoSelo
  /**
   * Tipos de habilidade F3: o personagem dono da passiva que pôs o selo
   * (Desligar e o estado "Ativa" acham o selo por aqui, também no oponente
   * escolhido). Só do host: nunca sai ao jogador. Ausente = não é de passiva.
   */
  donoId?: string
  /**
   * F2 (fatia F, Melodia): a opção da passiva escolhida ao ativar, quando NÃO
   * é a principal ("Opção Dado de reação"). Ausente = a principal (o "+20
   * contra o analisado" só vale nela). Só do host.
   */
  opcao?: string
  /** R1 (lote de 01/11): é a MARCA (`marca.ts`): o próximo golpe que acerta dá o dobro e a tira. Ausente = selo comum. */
  marca?: true
  /** R1: a linha que pôs a marca. Desfeita, o Desfazer de quem usou a marca não a devolve. Só do host. */
  linhaDaMarca?: string
  /** R5 (lote de 01/11): o nível do contador do cartão `cartaoId` (`contador.ts`). Ausente = selo comum. */
  contador?: number
  /** R4 (lote de 01/11): o modificador de atributo do "Ajustar...". Na carta de NPC, nunca sai ao jogador. */
  ajuste?: true
  /** F2 (fatia A): quanto o selo que tira por vez (Queimando N) tira; ausente = o da tabela (`danoPorVezDoSelo`). Só do host. */
  porVez?: number
  /** Construtor C5: o selo sai quando o próximo golpe chega em quem o tem (`selosQueSaemNoGolpe`; a técnica de ajuda não conta), além do da tabela (a redoma). Só do host. */
  saiNoProximoGolpe?: true
}

/** O selo como chega no pedido (o sugerido na mira, ou o do mestre). `turnos` null = até tirar. */
export interface SeloPedido {
  nome: string
  turnos: number | null
  /** Tipos de habilidade F2: as linhas "atributo / delta" da mira ou do "Pôr selo...". O host filtra pelo sistema (`seloPedidoValido`). */
  mods?: readonly ModDoSelo[]
}

/**
 * O selo que o golpe guarda para pôr em quem acerta: o do pedido mais o que
 * o HOST tira da técnica (nunca do fio): a natureza pelo Tipo (Buff, Debuff)
 * e o cartaoId.
 */
export interface SeloDoGolpe extends SeloPedido {
  natureza?: NaturezaDoSelo
  cartaoId?: string
  /** F2 (fatia A): o "Queimando N" da mecânica à mão (`mecanicasAMao.ts`), nunca do fio. Construtor C5: também o "tira X por vez" da peça. */
  porVez?: number
  /** Construtor C5: a duração "até o próximo golpe" da peça, nunca do fio. */
  saiNoProximoGolpe?: true
}

/**
 * Tipos de habilidade F2 (Buff/Debuff, seções 3.3 e 4c do plano): o que um
 * selo soma enquanto existe. `alvo` = id de atributo do sistema,
 * `ALVO_DO_DANO` (soma no fim da sugestão do golpe) ou `ALVO_DA_REACAO`
 * (modificador inicial da caixa de reação). `delta` com sinal: "perde 15 de
 * Agilidade" = -15.
 */
export interface ModDoSelo {
  alvo: string
  delta: number
}

/** A cor da pílula do selo: buff verde, debuff roxo, passiva dourada, condicao como sempre. */
export type NaturezaDoSelo = 'buff' | 'debuff' | 'passiva' | 'condicao'

/** As naturezas, para o enum fechado do fio. */
export const NATUREZAS_DO_SELO: readonly NaturezaDoSelo[] = ['buff', 'debuff', 'passiva', 'condicao']

/** Um pedaço do bônus como a conta o mostra: "+20 (Fúria)". `nome` = o nome do selo. */
export interface ParteDoBonus {
  nome: string
  delta: number
  /**
   * F2 (fatia A): o selo deixa o alvo em 0 enquanto existe (Cego: Percepção),
   * por cima de qualquer soma, na hora em que o valor é lido
   * (`valorComAsPartes`); `delta` é 0. A conta mostra "→ 0 (Cego)".
   */
  zera?: true
}

/**
 * O que os selos de UMA ficha somam agora (`bonusDaBatalha`): alvo do mod →
 * as partes, na ordem em que os selos foram postos. Sem selo com mod = `{}`.
 * O mesmo objeto para o menu, a mira, o painel do NPC e a caixa de reação.
 */
export type BonusDaBatalha = Readonly<Record<string, readonly ParteDoBonus[]>>

/** O alvo do mod que soma no dano sugerido do golpe ("+30 de dano"). */
export const ALVO_DO_DANO = 'dano'
/** O alvo do mod que soma no modificador da reação ("+3 na reação"). */
export const ALVO_DA_REACAO = 'reacao'

/**
 * F3: a ação que Ativar a forma gasta. Conserto das fichas F1 (fatia S4,
 * resposta do Jimboy): quem se transforma ESCOLHE na hora entre Simples,
 * Bônus, Completa ou Livre (não gasta), toda vez; a ficha não fixa.
 */
export type AcaoDaForma = 'simples' | 'completa' | 'bonus' | 'livre'

/** As ações que a pergunta do Ativar oferece, na ordem da tela. */
export const ACOES_DA_FORMA: readonly AcaoDaForma[] = ['simples', 'bonus', 'completa', 'livre']

/** Alvos num golpe. */
export const ALVOS_MAX = 12
/** Armas levadas para uma batalha (teto do fio; o limite da ficha vai até 6). */
export const ARMAS_NA_BATALHA_MAX = 20
/** Golpes esperando reação numa cena (passou: o mais velho vira "Não reagiu", nunca trava o ataque) e no recorte do jogador. */
export const GOLPES_PENDENTES_MAX = 20
/** Contra-ataques guardados numa cena. */
export const CONTRAS_MAX = 20
/** Efeitos guardados por cena: os mais novos. */
export const EFEITOS_GUARDADOS = 50
/** Efeitos numa mensagem `batalha.efeitos`. */
export const EFEITOS_POR_MENSAGEM = 20
export const CARGA_MAX = 3
/** Livro: Atenção 1, 2 e 3 = 1,5x, 2,0x e 3,5x. */
export const MULTIPLICADOR_DA_CARGA = [1, 1.5, 2, 3.5] as const
export const MULTIPLICADOR_DA_SURPRESA = 1.5
export const MULTIPLICADOR_DO_CRITICO = 1.5
/** A porcentagem do Perfurante: de 1% a 100% do dano vai direto ao HP. */
export const PERFURACAO_MIN = 1
export const PERFURACAO_MAX = 100
/** = `DICE_MODIFIER_LIMIT` (lib/dice.ts). */
export const MODIFICADOR_DA_REACAO_MAX = 99
/** Teto de um dano (no pedido, no efeito e no dano livre). */
export const DANO_MAX = 1_000_000
/** Teto de um custo confirmado na tela. */
export const CUSTO_MAX = 1_000_000
/** Teto do nome do golpe (o da arma ou da habilidade) no fio. */
export const NOME_DO_GOLPE_MAX = 80
/** F3: teto do nome de um selo. */
export const NOME_DO_SELO_MAX = 24
/** F3: teto dos turnos de um selo. */
export const TURNOS_DO_SELO_MAX = 99
/** F3: selos numa ficha (e numa carta no fio). */
export const SELOS_POR_TOKEN_MAX = 8
/** F3: selos numa cena. */
export const SELOS_MAX = 120
/** Tipos de habilidade F2: linhas "atributo / delta" num selo. O delta fica dentro de ±`DANO_MAX`. */
export const MODS_POR_SELO_MAX = 4
/** Tipos de habilidade F2: teto do alvo de um mod no fio (um id de atributo, "dano" ou "reacao"). */
export const ALVO_DO_MOD_MAX = 40
/** Tipos de habilidade F3: teto do id de cartão no recorte (o mesmo do fio, `CARTAO_ID_MAX` de protocoloDaBatalha.ts). */
export const ID_DO_CARTAO_MAX = 128
/** Tipos de habilidade F3: teto de uma chave de `lembradas` ("cartaoId:rodada3"). */
export const CHAVE_DA_LEMBRADA_MAX = 160
/** Tipos de habilidade F3: chaves em `lembradas` por personagem (passou, as mais velhas saem). */
export const LEMBRADAS_MAX = 100
/** Tipos de habilidade F3: lembretes esperando por personagem. */
export const LEMBRETES_MAX = 16
/** Tipos de habilidade F3: passivas ligadas por personagem no recorte. */
export const PASSIVAS_ATIVAS_MAX = 50
/** Tipos de habilidade F4: técnicas evoluídas por personagem numa batalha (e no recorte). */
export const EVOLUIDAS_MAX = 50
/** F3: linhas na prévia da forma (e no efeito). */
export const NUMEROS_DA_FORMA_MAX = 16
/** F3: teto do rótulo e da nota de um número da forma no fio. */
export const ROTULO_DO_NUMERO_MAX = 40
/** F3: teto do nome da forma (o nome do cartão) no fio. */
export const NOME_DA_FORMA_MAX = 80
/** F3: teto de um número da forma no fio (o mesmo do dano). */
export const NUMERO_DA_FORMA_MAX = DANO_MAX

/** O combate de quem ainda não fez nada nesta batalha. */
export function combateVazio(): CombateDoPersonagem {
  return { recargas: {}, usos: {}, overload: false, carga: 0, armas: null }
}

/** A chave da vez para `concentrouEm`. */
export function chaveDaVez(rodada: number, cartaId: string): string {
  return `${rodada}:${cartaId}`
}

/**
 * Tipos de habilidade F2: as partes de um alvo do bônus ("forca", "dano",
 * "reacao"); nenhuma = lista vazia. Só as do próprio objeto: o alvo pode ter
 * vindo do fio, e "constructor" num objeto já existe.
 */
export function partesDoBonus(bonus: BonusDaBatalha | undefined, alvo: string): readonly ParteDoBonus[] {
  return bonus !== undefined && Object.hasOwn(bonus, alvo) ? (bonus[alvo] ?? []) : []
}

/**
 * F2 (fatia A): o valor de um alvo com as partes do bônus somadas. Uma parte
 * que zera (Cego: Percepção) deixa em 0 enquanto o selo existe, venha o buff
 * antes ou depois dele, e o valor volta sozinho quando o selo sai.
 */
export function valorComAsPartes(base: number, partes: readonly ParteDoBonus[]): number {
  if (partes.some((parte) => parte.zera === true)) return 0
  return partes.reduce((soma, parte) => soma + parte.delta, base)
}
