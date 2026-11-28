/**
 * Os tipos da store da batalha One Piece (`batalhaFabrica.ts`): o estado, a cena, a abertura e as ações.
 * A fábrica os re-exporta: quem importa de `stores/batalhaFabrica` segue igual.
 */
import type { Casa } from '../../lib/batalha/blocos'
import type {
  DecisaoDaForma,
  NumerosDoInvocado,
  PedidoDeAcao,
  PedidoDeAjusteNaBatalha,
  PedidoDoContador,
  PedidoDeEvolucao,
  PedidoDeInvocacao,
  PedidoDeMarca,
  PedidoDePassiva,
  PedidoDeReacao,
  SeloPedido,
} from '../../lib/batalha/combate'
import type { JudgeNaCena } from '../../lib/batalha/judge'
import type { CancelamentoDaAjuda, RespostaDaAjuda } from '../../lib/batalha/requisitos/modelo'
import type { BatalhaEmTurnos, TelaDoPedido, VezEsperada } from '../../lib/batalha/ponte'
import type { AcaoDaMira, AlcanceDaMira } from '../../lib/batalha/golpe'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import type { AcoesExtras, AutorDaAcao, CartaDaOrdem, Desempate, DuracaoDaExtra } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'

/** O que a fábrica recebe de fora (molde de `DependenciasDaBatalhaDBT`). */
export interface DependenciasDaBatalha {
  /** Um d20 (1 a 20). Na mesa, o seguro (`secureRollDie`); no treino, o da semente. */
  rolarD20: () => number
  /** A cena já está ligada na OUTRA batalha (a DBT, na mesa)? Ligada = o `ligar` não liga por cima. */
  outraBatalhaLigada: (sceneKey: string) => boolean
  /** REQUISITOS E: o treino do Lobby (sem mestre nem relógio do servidor): o pedido ao aliado e o J2 ficam "Só na mesa". */
  treino?: true
  /** REQUISITOS E: o relógio do prazo dos pedidos de ajuda. Ausente = `Date.now`. */
  agora?: () => number
}

/** A abertura escolhida ao ligar: id da animação de transição e o texto dela ("Royals"). Os dois opcionais. */
export interface AberturaDaBatalha {
  transicao?: string
  texto?: string
}

/** O que o Iniciar decide (F1): quem entra (`combatentesIniciais`), a regra do campo e o desempate. */
export interface InicioDaBatalha {
  combatentes: readonly CartaDaOrdem[]
  regras: RegrasDaBatalha | null
  desempate: Desempate
  /** F3: onde o Judge nasce (`judgeInicial`). Ausente = o App põe logo depois, por `moverJudge`. */
  judge?: JudgeNaCena
}

export interface BatalhaDaCena extends BatalhaEmTurnos {
  /** Blocos andados por ficha desde que a batalha ligou (ou desde o último "Zerar caminhos"). */
  caminhos: Readonly<Record<string, number>>
  /** B6: as casas andadas por ficha, para o desenho do caminho (teto em `CASAS_POR_TRILHA`). */
  trilhas: Readonly<Record<string, readonly Casa[]>>
  /** Quantas vezes o mestre zerou os caminhos desta batalha: o jogador avisa quando o número sobe. */
  zerados: number
  /** Sobe a cada caminho somado ou zerado: o host refaz o recorte de quem está na cena. */
  rev: number
  /** F1: sobe a cada mudança da ordem, do registro ou das regras: o host refaz só o `batalha.estado`. */
  turnosRev: number
}

/** O último "ligou a batalha": `seq` novo a cada `ligar`, para o App mandar o aviso uma vez. */
export interface AnuncioDaBatalha extends AberturaDaBatalha {
  seq: number
  sceneKey: string
}

export interface BatalhaState {
  cenas: Readonly<Record<string, BatalhaDaCena>>
  anuncio: AnuncioDaBatalha | null
  /**
   * Liga a batalha na cena (caminhos zerados) e anuncia a abertura. Já ligada:
   * só anuncia de novo. `inicio` (F1): a ordem pela Agilidade com o desempate
   * escolhido, a vez na primeira carta e as regras do campo.
   */
  ligar: (sceneKey: string, abertura?: AberturaDaBatalha, inicio?: InicioDaBatalha) => void
  /** Desliga a batalha na cena; o caminho andado, a ordem e o registro somem com ela. */
  desligar: (sceneKey: string) => void
  /** "Zerar caminhos": a batalha continua, o caminho andado de toda ficha da cena volta a 0. */
  zerarCaminhos: (sceneKey: string) => void
  /** A sessão do host aceitou `blocos` para a ficha nesta cena, andando `casas`. Cena fora de batalha: nada. */
  somarCaminho: (sceneKey: string, tokenId: string, blocos: number, casas?: readonly Casa[]) => void
  /** A cena está em batalha? */
  ligada: (sceneKey: string) => boolean
  /** Sala fechada: nenhuma cena em batalha. */
  reset: () => void
  /**
   * Conserto das fichas F1, fatia S5 (P8): a batalha salva VOLTA como estava
   * (ordem, recargas, usos, Overload, selos, golpes pendentes, registro), sem
   * a abertura e sem limpar invocados. Cena já em batalha (aqui ou na DBT):
   * nada, e `false`.
   */
  retomar: (sceneKey: string, cena: BatalhaDaCena) => boolean
  /**
   * S5: "Encerrar" a batalha salva que não voltou: o mesmo fim do `desligar`
   * (formas desligam, cansaço do Overload sai, invocados saem), sem ela passar
   * pela memória. Cena já em batalha aqui: nada.
   */
  encerrarSalva: (sceneKey: string, cena: BatalhaDaCena) => void
  /**
   * A mesa saiu da tela (18/11/2026, análise, seção 2.3): as cenas dela saem da MEMÓRIA sem fim de batalha
   * nenhum (nada nas fichas, nos invocados nem no arquivo). O arquivo guarda o ponto salvo e volta pelo
   * "Retomar a batalha" quando a mesa abrir de novo (`batalhaSalvaNaMesa`).
   */
  esquecerCenas: (sceneKeys: readonly string[]) => void

  // ---- F1: ordem e vez (o mestre chama direto; o jogador só `passarVez` e `desfazer`, pela ponte) ----
  /** "Passar a vez" (pula carta caída, Q3). Com `esperado`, só passa se a vez ainda é aquela: clique duplo não passa duas. */
  passarVez: (sceneKey: string, autor?: AutorDaAcao, esperado?: VezEsperada) => boolean
  /**
   * Nº 3 do levantamento das mecânicas duplicadas: põe em dia os selos espelho das pastilhas das fichas da
   * ordem (`espelhosDasPastilhas`), sem linha no registro. A vez já chama sozinha (antes de andar e depois do
   * prazo); quem vê a pastilha mudar no mapa pode chamar na hora. Cena sem batalha ou sem mapa: nada.
   */
  espelharPastilhas: (sceneKey: string) => void
  /**
   * Conserto das fichas F1 (bug 1): por que o `agir` deste pedido seria
   * recusado agora (o texto curto da regra, `podeAgir`), ou `null`. Só lê.
   */
  motivoDoAgir: (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao, tela?: TelaDoPedido) => string | null
  /** Fase D do alcance: a mira aberta de `tokenId` (a carta da vez ou a do contra-ataque) como a mesa a vê; `null` = nada acende. Só lê. */
  alcanceDaMira: (sceneKey: string, autor: AutorDaAcao, tokenId: string, acao: AcaoDaMira) => AlcanceDaMira | null
  /** O mestre dá a vez a uma carta (até a de quem caiu). */
  darVez: (sceneKey: string, cartaId: string) => boolean
  /** Arrastar ou Alt + seta. Movimentos seguidos da mesma carta viram uma linha só. */
  moverCarta: (sceneKey: string, cartaId: string, indice: number) => boolean
  /** "Ordenar pela Agilidade" com o desempate da cena. */
  ordenarPelaAgilidade: (sceneKey: string) => boolean
  /** "1d20" ou "Eu decido". Vale no próximo Ordenar; não entra no registro. */
  trocarDesempate: (sceneKey: string, desempate: Desempate) => boolean
  /** "Incluir combatente": a ficha entra no fim da ordem (ou em `indice`). */
  incluirCombatente: (sceneKey: string, token: { id: string; characterId: string | null; name: string }, indice?: number) => boolean
  /** "Tirar combatente": todas as cartas da ficha (a original e as extras). */
  tirarCombatente: (sceneKey: string, tokenId: string) => boolean
  /** "+ Carta extra" da ficha em `indice`, só nesta rodada ou em todas. Devolve o id da carta nova. */
  adicionarCartaExtra: (sceneKey: string, tokenId: string, indice: number, duracao: DuracaoDaExtra) => string | null
  /** Tira uma carta só (a extra, normalmente). */
  removerCarta: (sceneKey: string, cartaId: string) => boolean
  /** A cópia das regras do campo desta batalha; `null` = nenhuma. */
  definirRegras: (sceneKey: string, regras: RegrasDaBatalha | null) => boolean
  /** Fichas que sumiram da cena saem da ordem (sem linha: não foi uma decisão do mestre). */
  normalizarCena: (sceneKey: string, tokenIdsDaCena: ReadonlySet<string>) => void
  /**
   * Põe o personagem em outra equipe (ou em nenhuma) pela aventura (ou pasta)
   * e, com a batalha ligada, escreve a linha nas cenas em que ele está na ordem.
   */
  trocarEquipe: (personagemId: string, equipeId: string | null) => boolean
  /**
   * Fatia C7 (revisão): o mestre revela o cartão oculto com um clique no
   * perfil da carta, sem sair da batalha. Grava pela mesa (a aventura, a
   * pasta ou a cópia da arena); sem linha no registro: é a ficha que muda, não
   * uma ação da batalha. `false` = a mesa recusou.
   */
  revelar: (personagemId: string, cartaoId: string) => boolean
  /** Um ajuste rápido aceito vira linha "ficha" em toda cena em batalha com o personagem na ordem. */
  registrarAjuste: (personagemId: string, antes: Personagem, depois: Personagem, autor: AutorDaAcao) => void
  /**
   * O ÚNICO caminho que reverte uma linha (também a pedido do jogador, pelo
   * host). O jogador só a dele, de tipo permitido — a conferência de "é a vez
   * dele" é do host, que sabe de quem é cada ficha. A linha fica riscada.
   */
  desfazer: (sceneKey: string, linhaId: string, autor: AutorDaAcao) => boolean

  // ---- F2: ações e golpe (o mestre chama direto; o jogador pela ponte). Fase 0: só o contrato, tudo devolve `false`. ----
  /**
   * Atacar, Habilidade, Concentrar ou o contra-ataque gasto em Mover: confere
   * a regra (`podeAgir`), cobra o custo pela aventura, gasta a ação, marca
   * recarga, usos e Overload, cria o golpe (alvo sem reação resolve na hora),
   * escreve UMA linha e os efeitos. `vez` null só com `contraDe` (Q6).
   */
  agir: (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: PedidoDeAcao, tela?: TelaDoPedido) => boolean
  /** Rola (d20 do host) ou resolve a reação; o dano final cai na ficha e a linha do golpe é atualizada. Contra-atacar (Q6) zera o dano e dá a ação extra. */
  reagir: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeReacao) => boolean
  /** Dano livre numa ficha: linha "dano" e efeito "dano" (a animação toca sempre). */
  darDano: (sceneKey: string, autor: AutorDaAcao, tokenId: string, valor: number) => boolean
  /** Ações extras do mestre para a carta (`null` tira): linha "acoesExtras". */
  darAcoesExtras: (sceneKey: string, cartaId: string, extras: AcoesExtras | null) => boolean
  /** As armas levadas, dentro do limite; troca quando quiser (Q8): linha "acao". */
  escolherArmas: (sceneKey: string, autor: AutorDaAcao, personagemId: string, armas: readonly string[]) => boolean
  /**
   * "Zerar" a concentração do personagem (carga → 0), a qualquer hora: linha
   * "acao" com Desfazer, que volta só a carga. C2 (lote de 01/11): na MESMA
   * vez do Concentrar, devolve a ação que ele gastou e libera concentrar de
   * novo ("é como se não tivesse feito nada"). Sem carga, ou personagem fora
   * da ordem: `false`.
   */
  zerarCarga: (sceneKey: string, autor: AutorDaAcao, personagemId: string) => boolean
  /**
   * ITENS REFEITOS, E6b (decisão 9): por que `deId`, numa batalha ligada, não pode dar item a `paraId`
   * (item só vai para aliado na luta). `null` = pode (ou `deId` não está em batalha nenhuma).
   */
  motivoDoDarNaLuta: (deId: string, paraId: string) => string | null
  /**
   * ITENS REFEITOS, E6b (decisão 9): a mochila de quem tem carta numa batalha ligada recebeu item (dar não
   * gasta ação). A arma equipada com o pente vazio recarrega da munição recebida (agora, se a ação cabe;
   * senão no começo da próxima vez dele). `texto` = a frase do dar ("Kaya deu 10 Bala de Prata a
   * Vincent"), que vira a linha do registro; `null` = só a recarga feita entra (a mudança pela LAN).
   */
  recebeuNaLuta: (quem: { personagemIds?: readonly string[]; tokenIds?: readonly string[] }, autor: AutorDaAcao, texto: string | null) => void
  /**
   * Q4: o mestre liga ou desliga o Perfurante de um golpe que ainda tem alvo
   * esperando (o mestre decide no fim). `perfuracao` (1 a 100) troca também a
   * porcentagem; ausente = fica a do golpe. Porcentagem torta: `false`.
   */
  trocarPerfurante: (sceneKey: string, golpeId: string, perfurante: boolean, perfuracao?: number) => boolean

  // ---- F3 (fatia J): o Judge ----
  /**
   * Põe o Judge em `(x, y)` (px do mundo, o centro da casa: quem chama já
   * encaixou). Só o mestre (chamada direta). Não escreve linha nem se desfaz;
   * sobe `turnosRev` para os jogadores o verem lá. Cena fora de batalha,
   * número torto ou a mesma posição: `false`. A lembrança no aparelho
   * (`gravarJudgeLembrado`) é de quem chama.
   */
  moverJudge: (sceneKey: string, x: number, y: number) => boolean

  // ---- F3 (fatia T): selos à mão. Só o mestre (chamada direta). Ativar e Desfazer a forma vão pelo `agir`. ----
  /**
   * "Pôr selo..." na ficha (com carta na ordem): linha "selo" com reversão `selo` (antes `null`). Teto `SELOS_POR_TOKEN_MAX` por ficha e `SELOS_MAX` na cena.
   * Tipos de habilidade F2: com `mods` (filtrados pelo sistema); a cor vem do sinal deles (`naturezaDosMods`).
   */
  porSelo: (sceneKey: string, tokenId: string, selo: SeloPedido) => boolean
  /** Troca nome, turnos e mods de um selo (o `total` passa a ser os turnos novos): linha "selo" com o de antes (`seloEditado`). */
  editarSelo: (sceneKey: string, seloId: string, selo: SeloPedido) => boolean
  /** Tira o selo: linha "selo" com o de antes. */
  tirarSelo: (sceneKey: string, seloId: string) => boolean
  /**
   * Nº 3 do levantamento (a limpeza tira os dois): o "Usar" de fora da batalha tirou da ficha `tokenId` as
   * pastilhas `nomes`; os selos de verdade de mesmo nome saem junto, numa linha "selo" com Desfazer. O espelho
   * da pastilha não conta (sai sozinho). Devolve o id da linha, para o Desfazer do uso; `null` = nada a tirar.
   */
  tirarSelosPeloUso: (sceneKey: string, tokenId: string, nomes: readonly string[], quem: string) => string | null
  /**
   * Rework das condições (PENDENCIAS nº 13): a condição criada `de` foi renomeada para `para`; os selos dela (pela
   * chave do nome) em toda batalha ligada passam a ter o nome novo, sem linha (o nome não é jogada; o Desfazer do
   * editor chama de volta com os dois trocados). Devolve quantos selos trocaram.
   */
  renomearSelos: (de: string, para: string) => number

  // ---- Tipos de habilidade F3: passivas (o mestre chama direto, por qualquer ficha; o jogador pela ponte, só as dele) ----
  /**
   * Ativar/Desligar a passiva da ficha `pedido.tokenId`, Aplicar o efeito "a
   * cada turno" ou "Agora não" no lembrete (`PedidoDePassiva`). Fora da vez,
   * sem gastar ação; regra em `motivoDaPassiva` (o jogador só aplica com o
   * lembrete esperando; o mestre, quando quiser). Ativar: custo pela
   * aventura, usos e recarga do Tempo, selo dourado com mods no dono ou no
   * alvo, linha "habilidade" com Desfazer que volta tudo (o lembrete volta
   * junto). Selo que não cabe no teto: `false`, nada muda.
   */
  passiva: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDePassiva) => boolean

  // ---- Tipos de habilidade F4: evolução (o mestre chama direto, por qualquer ficha, a qualquer hora; o jogador pela ponte, na vez dele) ----
  /**
   * Evoluir a técnica da ficha `pedido.tokenId` NESTA batalha (ação livre).
   * Regra em `motivoDoEvoluir`. Cobra o custo digitado (SP) pela aventura,
   * grava em `evoluidas` e escreve a linha "habilidade" ("Siegfried evoluiu
   * CAÇA AS BRUXAS! → SUPER CAÇA AS BRUXAS!") com Desfazer que tira a
   * evolução e devolve o SP.
   */
  evoluir: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao) => boolean
  /** F2 (revisão da fatia F): por que o `evoluir` deste pedido seria recusado agora (`motivoDoEvoluir`, com a Melodia da CAÇA), ou `null`. Só lê. */
  motivoDoEvoluir: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeEvolucao) => string | null

  // ---- Invocação (docs/planos/batalha-invocacao-plano.md). O jogador só `invocar`, pela ponte; o resto é do mestre. ----
  /**
   * Pedir a técnica de Tipo Invocação da ficha `pedido.tokenId` (o dono), na
   * vez de uma carta do mesmo personagem. Regra em `motivoDaInvocacao`
   * (máximo = colocados + pendentes, carga do Ultra, recarga, SP, ação).
   * Gasta a ação, cobra o custo pela aventura, marca recarga e usos, gasta a
   * carga (Ultra) e cria a PENDÊNCIA em `turnos.invocacoes` (sem token
   * ainda). Linha "habilidade" ("Ryoko invocou 1 Lobo com Chamado do Lobo")
   * com Desfazer que tira a pendência (ou o invocado, se já posto) e devolve
   * SP, recarga, carga e a ação. Mesa sem mapa (a arena): `false`.
   */
  invocar: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeInvocacao) => boolean
  /**
   * O MESTRE põe a pendência no mapa em `onde` (px do mundo; quem chama já
   * encaixou na casa): cria o personagem temporário (`fichaDoInvocado`) e o
   * token (imagem do cartão se ela for embutida, ou `ajuste.imageData`; sem
   * nenhuma = disco de iniciais) e o põe no bando do dono (a carta do bando
   * nasce logo depois da do dono, se ainda não há). Ultra: os comuns do mesmo
   * dono saem. `ajuste` = os números e o nome editados (sem eles, os da
   * pendência; pendência sem números exige `ajuste.numeros`). Linha
   * "invocacao" com Desfazer (o invocado sai, a pendência volta, os comuns
   * voltam). Devolve o tokenId novo, ou `null` (nada mudou).
   */
  colocarInvocado: (sceneKey: string, invocacaoId: string, onde: OndeNasceOInvocado, ajuste?: AjusteDaColocacao) => string | null
  /** O mestre cancela a pendência: é o Desfazer da linha do pedido (o SP, a recarga e a carga voltam). */
  cancelarInvocacao: (sceneKey: string, invocacaoId: string) => boolean
  /**
   * Construtor C6: o mestre decide os números da forma pedida (modificadores
   * e, se quiser, uma habilidade nova) e ela liga. Linha "transformacao" com
   * Desfazer (a forma desliga, o cartão volta como era, a pendência volta).
   * Decisão torta, pendência que saiu ou forma já ligada = `false` (nada muda).
   */
  decidirForma: (sceneKey: string, pendenteId: string, decisao: DecisaoDaForma) => boolean
  /** C6: o mestre recusa a forma pedida: é o Desfazer da linha do pedido (a ação, os usos e o Overload voltam). */
  cancelarForma: (sceneKey: string, pendenteId: string) => boolean
  /**
   * Na vez da carta do BANDO, o mestre age com o invocado `tokenId` (Atacar
   * ou Habilidade, com a ficha temporária dele; o dano vem no pedido, como
   * sempre). Cada invocado tem a Simples e o movimento dele
   * (`acoesDoInvocado`). Mesmo caminho do `agir`: linha, efeitos, alvo
   * invocado sem reação, HP 0 tira o invocado do mapa.
   */
  agirComInvocado: (sceneKey: string, vez: VezEsperada, tokenId: string, pedido: PedidoDeAcao) => boolean
  /**
   * COMPANION (PLANO-COMPANION.md): o dono `donoPersonagemId` (pelo jogador,
   * ou o mestre no "Escolher por ela") diz quem vai, até o limite de cada
   * grupo, ninguém desmaiado. Os tokens nascem colados no dono, cada um com
   * carta própria pela Agilidade; o dono sai de `escolhendoCompanions`; a
   * escolha vira o padrão da próxima vez. `[]` = "Entrar sozinha". Linha
   * "combatente" com Desfazer das cartas. Devolve `null` (feito) ou o motivo.
   */
  escolherCompanions: (sceneKey: string, autor: AutorDaAcao, donoPersonagemId: string, escolhidos: readonly string[]) => string | null

  // ---- Lote de 01/11 (docs/planos/batalha-lote-01-11-plano.md). O mestre chama direto; o jogador pela ponte, só na ficha dele. ----
  /**
   * R1: a resposta ao lembrete "Marcar o alvo?" (`turnos.lembretesDaMarca`).
   * "sp" cobra o SP da passiva; "teste" rola d20 + modificador (o rank do
   * atributo) contra a CD, com o d20 para todos; "passou"/"falhou" = rolou
   * fora; "agoraNao" tira o lembrete sem linha. Passou: selo "Marcado" (sem
   * turnos) no alvo. Linha "habilidade" com Desfazer (o SP, a marca e o
   * lembrete voltam). Alvo já marcado ou fora da ordem: `false`.
   */
  marcar: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeMarca) => boolean
  /**
   * R4 (lote de 01/11): o "Ajustar..." da carta: atual e máximo de HP, SP e
   * Escudo na ficha, e um modificador de atributo (selo sem turnos) até a
   * batalha acabar. Linha "ficha" com Desfazer por diff. Quem pode qual ficha
   * é do host (o jogador, só a dele de verdade).
   */
  ajustar: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDeAjusteNaBatalha) => boolean
  /**
   * R5 (lote de 01/11): "ganhar" sobe 1 nível do contador (a polaridade do
   * Vagn) gastando a reação até a vez dele; "zerar" é só do mestre. Linha
   * "habilidade" com Desfazer por diff do nível.
   */
  contador: (sceneKey: string, autor: AutorDaAcao, pedido: PedidoDoContador) => boolean
  /**
   * REQUISITOS E (§7): responder ao pedido de ajuda (o aliado, ou o mestre pelo NPC) ou cancelá-lo
   * (quem pediu, ou o mestre). Quem pode, pela rede, o host confere; a store confere o estado, o
   * prazo e, no aceite, o portão inteiro de novo.
   */
  ajuda: (sceneKey: string, autor: AutorDaAcao, pedido: RespostaDaAjuda | CancelamentoDaAjuda) => boolean
  /** REQUISITOS E: o prazo dos pedidos de ajuda (o host chama a cada segundo enquanto algum espera). */
  vencerAjudas: (sceneKey: string, agora: number) => boolean
}

/** Invocação: onde o invocado nasce (px do mundo, o centro da casa) e em que piso; `piso` ausente = o térreo. */
export interface OndeNasceOInvocado {
  x: number
  y: number
  piso?: number
}

/** Invocação: o que o mestre ajusta ao colocar (decisão 10: os números do Ultra são sugestão). Tudo opcional. */
export interface AjusteDaColocacao {
  nome?: string
  numeros?: NumerosDoInvocado
  /** A foto pronta do token (`data:image/...`), quando a do cartão é `midia:` (quem chama resolve). `null` = disco de iniciais. */
  imageData?: string | null
}
