import type { Personagem } from '../personagem'
import type { AcaoDaTecnica, NaturezaDoSelo, SaidaDaReacao, SaidaDaTecnica, SeloDaBatalha, SeloDoGolpe } from './combate'
import { normalizar } from './formula'
import type { ContraDaDisputa, QuemRola } from './disputa'
import type { FormaDaArea, QuemEntraNaArea } from './area'
import { motivoDasRespostas, type OpcaoDaPergunta, type PerguntaNaHora, type RespostasDoPedido } from './perguntaNaHora'

/**
 * AS MECÂNICAS DAS FICHAS DE HOJE, PROGRAMADAS À MÃO (conserto das fichas F2;
 * decisão do mestre de 08/11; seção 6 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md). Uma tabela por
 * `cartaoId` que só passa parâmetros às funções gerais (`disputa.ts`,
 * `area.ts`, `perguntaNaHora.ts`, a tabela de selos de `condicoes.ts`): nada de
 * `if (nome === ...)` espalhado, campo novo no pedido, regex nova ou extra com
 * nome mágico. Quando o construtor chegar, cada linha vira a peça do cartão.
 *
 * Os números saem de docs/auditoria-fichas/respostas-do-grilling.md (lei) e
 * os ids das fichas reais da pasta da mesa. O que ainda falta decidir fica
 * fora da linha (ver as pendências da fatia A no relatório).
 *
 * Puro: sem store, sem rede.
 */

/** O que muda com o resultado da disputa. */
export interface EfeitoDaDisputa {
  /** O selo que pega no alvo. */
  selo?: SeloDoGolpe
  /** A técnica não gasta: devolve o custo e o uso (Explosão quando o alvo passa). */
  devolveOCusto?: true
  /** F2 (fatia D, Explosão): os turnos que faltam de cada selo negativo do alvo dobram (Atordoado 2 vira 4). */
  dobraOsDebuffs?: true
}

/**
 * F2 (fatia D, Armadura Humana): uma saída da reação com técnica dada pela
 * tabela. `saida`: a que vai no pedido (o fio de sempre); `noAlvo`: como o
 * alvo fica resolvido; `fator`: quanto do dano que chega fica (0,9 = toma
 * 90%); `devolveDividido`: o dano que ficou, dividido por ele (para baixo),
 * volta em quem atacou, sem reação.
 */
export interface SaidaDaReacaoAMao {
  saida: SaidaDaTecnica
  rotulo: string
  noAlvo: SaidaDaReacao
  fator: number
  devolveDividido?: number
  /**
   * F2 (fatia E, Recuperação de forças da Ryoko): esta porcentagem do dano que
   * CHEGAVA (antes das reduções de quem reage, como o −30% do Ogro) volta em
   * vida, para baixo, até o máximo.
   */
  curaDoQueChega?: number
}

/**
 * F2 (fatia D, Giro da Lança): a reação rola 1d20 + o MAIOR modificador
 * entre os `atributos` (o app soma sozinho); total `anulaCom` ou mais anula
 * todo o dano, abaixo toma cheio (o 1 natural segue crítico).
 */
export interface RolagemDaReacaoAMao {
  atributos: readonly string[]
  anulaCom: number
}

/** F2 (fatia D): a reação com técnica pela tabela: só as `saidas` dela (a 1ª vem marcada), ou a `rolagem` própria. */
export interface ReacaoAMao {
  saidas?: readonly SaidaDaReacaoAMao[]
  rolagem?: RolagemDaReacaoAMao
  /** F2 (fatia E, Recuperação de forças): vale também contra golpe Overload (como se fosse outra Overload). */
  contraOverload?: true
  /**
   * F2 (revisão da fatia E, Recuperação de forças): vale também contra golpe
   * Surpresa: o golpe espera a reação de quem tem a técnica disponível (só
   * ela defende; o d20 não), como no Overload.
   */
  contraSurpresa?: true
  /**
   * F2 (revisão da fatia E, Recuperação de forças: "o MESTRE CONFIRMA"): só o
   * mestre usa a técnica na reação (ele confirma na mesa o que o texto pede);
   * o jogador vê o botão apagado com este motivo e pede a ele.
   */
  soOMestre?: string
}

/**
 * F2 (fatia E, a raça Ogro): o que a raça dá a toda ficha dela. `reducao`: o
 * dano recebido que cai (Superioridade do Ogro, −30%); `somaCorpoACorpo`: o
 * dano a mais no Atacar e nas técnicas corpo a corpo que não o escrevem
 * (Força Aumentada, +20); `soDefende`: a reação não esquiva nem contra-ataca
 * (Orgulho dos Ogros), menos na ficha com `esquivaNormal`.
 */
export interface RacaAMao {
  reducao?: { nome: string; porcento: number }
  somaCorpoACorpo?: number
  soDefende?: true
}

/** F2 (fatia E): a técnica corpo a corpo. `somaDaRaca`: soma o dano corpo a corpo da raça (o Chute já escreve o +20 de Ogro: `false`). */
export interface CorpoACorpoAMao {
  somaDaRaca: boolean
}

/** F2 (fatia D, Imbuir Fogo do Vagn): a resposta `valor` da pergunta `chave` não vale com a forma `formaId` ligada. */
export interface RespostaVetadaAMao {
  chave: string
  valor: string
  formaId: string
  motivo: string
}

/**
 * F2 (fatia D, Revigorar): tira os selos negativos do alvo (o cansaço do
 * Overload junto) e cura a fórmula `cura`, lida na ficha de quem usa.
 * `porCarga`: a fórmula no lugar da `cura` quando o golpe sai com aquela carga
 * de Concentrar (extra "Concentração" da ficha: "com concentração X3, recupera
 * Espírito * 3"); carga sem fórmula = a `cura`.
 */
export interface LimpezaAMao {
  cura: string
  porCarga?: Readonly<Partial<Record<1 | 2 | 3, string>>>
  /** F2 (fatia F, Medicina do Harvey): só cura; os debuffs do alvo ficam. */
  soCura?: true
}

/**
 * F2 (fatia F, Chamas Celestes do Siegfried): no fim de cada vez de quem tem o
 * selo desta técnica, ele perde `alvoSp` de SP e o dono da técnica ganha
 * `donoSp` de SP e perde `donoHpPorcento`% do HP MÁXIMO dele (para baixo).
 */
export interface DrenoNoFimDaVezAMao {
  alvoSp: number
  donoSp: number
  donoHpPorcento: number
}

/**
 * F2 (revisão da fatia D): a técnica MANTIDA (Giro da Lança, Campo de
 * Contenção). Usar liga (sem recarga); no começo de cada vez do dono, o
 * lembrete "Aplicar / pular" cobra o custo de manter, na mesma faixa do custo
 * da forma (`custoPorTurno.ts`). Pular, ou não ter o recurso, para: só então
 * a recarga do Tempo começa, e os selos que a técnica pôs saem.
 * `custoPorVez`: o custo de cada vez mantida; ausente = o "por turno" do
 * campo Custo da ficha ("-15 (Por turno)"). `cargaPorVez`: cada vez mantida
 * dá +1 de Concentração (até 3), e usar a técnica não gasta a guardada.
 */
export interface MantidaAMao {
  custoPorVez?: { recurso: 'sp' | 'hp'; valor: number }
  cargaPorVez?: true
}

/**
 * A disputa que o app rola. `quando`: logo ao usar (antes do dano) ou só
 * depois do acerto. `testa`: quem rola o d20 principal. `seQuemUsaVence` /
 * `seQuemUsaPerde`: o efeito pelo lado de quem usa a técnica (quando o alvo
 * testa, "quem usa vence" = o alvo NÃO passou).
 */
export interface DisputaAMao {
  quando: 'uso' | 'acerto'
  testa: 'quemUsa' | 'alvo'
  rola: QuemRola
  contra: ContraDaDisputa
  seQuemUsaVence?: EfeitoDaDisputa
  seQuemUsaPerde?: EfeitoDaDisputa
}

/** A área do golpe e quem entra nela. */
export interface AreaAMao {
  forma: FormaDaArea
  quem: QuemEntraNaArea
}

/**
 * F2 (fatia B): o que uma resposta muda no golpe. `dano`: a fórmula no lugar
 * da da tabela (lida pela mesma `lerDano`); `selo`: o selo que pega no acerto.
 * Vale quando a resposta da `chave` é `valor`.
 */
export interface MudancaDaResposta {
  chave: string
  valor: string | number
  dano?: string
  selo?: SeloDoGolpe
  /** F2 (fatia D, Projeção Letal): o perfurante do golpe pela resposta (perfurante = direto no HP). */
  perfurante?: boolean
}

/** F2 (fatia B): a parte do golpe que vem depois (Rapid Dash): uma fração do dano base do primeiro, com o próprio perfurante e a própria reação. */
export interface SegundoGolpeAMao {
  fracao: number
  perfurante: boolean
}

/**
 * F2 (fatia B): a técnica de reação que REBATE (Aplauso): o dano que chegou +
 * a fórmula `soma` (de quem rebate) volta em quem atacou. `perto`: a área em
 * volta de quem rebate onde o golpe Overload em QUALQUER alvo também dispara a
 * pergunta (o "perto" do Aplauso = o 6x6 à frente dela); o "sim" anula o golpe
 * naquele alvo.
 */
export interface RebateAMao {
  soma: string
  perto?: FormaDaArea
}

/**
 * F2 (fatia C): o selo montado na hora com as respostas e a ficha de quem usa
 * (Bênção de uma Raposa: o físico escolhido ganha 20% do Espírito dela, pelos
 * turnos que ela disser). `turnosDe`: a pergunta de número que dá os turnos.
 * `mod`: o atributo é a resposta de `atributoDe`; o quanto, a `formula` lida
 * na ficha de quem usa, para baixo.
 */
export interface SeloDasRespostasAMao {
  nome: string
  natureza: NaturezaDoSelo
  turnosDe: string
  mod?: { atributoDe: string; formula: string }
}

/**
 * F2 (fatia C, a melhoria da Aira com a Bênção): enquanto o selo `enquanto`
 * posto por um cartão do dono está num aliado, o Atacar dele vira `golpes`
 * golpes (cada um com a própria reação), cada um com a fórmula `soma` (lida
 * na ficha dele) a mais no dano e o `selo` no acerto.
 */
export interface AtaqueBasicoAMao {
  enquanto: string
  golpes: number
  soma: string
  selo: SeloDoGolpe
}

/** F2 (fatia C): a pergunta de todo golpe do dono; a resposta `valor` soma `dano` em cada alvo e cobra `custoEmSp` (Electro: +20, -10 SP). */
export interface EmTodoGolpeAMao {
  pergunta: PerguntaNaHora
  valor: string
  dano: number
  custoEmSp: number
  /** O que vai no registro quando a resposta é `valor` ("eletricidade"). */
  rotulo: string
  /** F2 (fatia E, vantagem de Ogro): a pergunta só vem no golpe corpo a corpo (o Atacar e as técnicas com `corpoACorpo`). */
  soCorpoACorpo?: true
  /** F2 (fatia E, vantagem de Ogro): com a resposta `valor`, o alvo reage com desvantagem (2 d20, fica o menor). */
  desvantagemNoAlvo?: true
}

export interface MecanicaAMao {
  /** Para quem lê a tabela: "Corta Cenoura (Jimboy)". */
  nome: string
  perguntas?: readonly PerguntaNaHora[]
  /** F2 (fatia C): o alvo não reage; a defesa é o teste da disputa (dança da Aira: Espírito contra a CD). */
  semReacao?: true
  /** F2 (fatia C): a técnica sai sem alvo (Armadilhar posiciona a armadilha); a mira abre sem ninguém marcado e aceita lançar assim. */
  semAlvo?: true
  /** F2 (fatia C): o selo montado com as respostas (vale quando nenhuma resposta nem o `selo` fixo dão um). */
  seloDasRespostas?: SeloDasRespostasAMao
  /** F2 (fatia C): o selo só pega nos ALIADOS marcados de quem usa, e o dano só nos outros (A Luz do Sol: dano no inimigo, Bênção nos aliados). */
  seloSoNosAliados?: true
  /** F2 (fatia C): quantos alvos, no máximo, tomam dano; com `seloSoNosAliados` os aliados não contam (A Luz do Sol: "em um inimigo" = 1). */
  tetoDeAlvosComDano?: number
  /** F2 (fatia C): o Atacar do dono muda enquanto um selo com este nome, posto por um cartão dele, está em algum aliado (`ataqueComOSelo`). */
  ataqueBasico?: AtaqueBasicoAMao
  /** F2 (fatia C): a pergunta que vale em TODO golpe do dono, Atacar e técnicas, enquanto o cartão está na ficha (o Electro da Aira). */
  emTodoGolpe?: EmTodoGolpeAMao
  disputa?: DisputaAMao
  area?: AreaAMao
  /** O dano dividido entre os marcados, com o teto de alvos (`dividirDano`). */
  divide?: { teto: number }
  /** F2 (fatia B): a fórmula do dano no lugar do campo Dano da ficha (o campo está vazio ou diz outra conta). */
  dano?: string
  /** F2 (fatia B): o que cada resposta muda (a última que casa vence, no dano e no selo). */
  respostasMudam?: readonly MudancaDaResposta[]
  /** F2 (fatia B): o selo que o golpe põe no acerto, no lugar do que a mira lê do texto. */
  selo?: SeloDoGolpe
  /** F2 (fatia B): o perfurante do (primeiro) golpe, no lugar do que o texto diz. */
  perfurante?: boolean
  segundoGolpe?: SegundoGolpeAMao
  /** F2 (fatia B): o HP que quem usa perde sempre ao usar (Sai Dai Rin: "Técnica Incompleta", 200). */
  custoEmHp?: number
  rebate?: RebateAMao
  /** F2 (fatia B): cartão que avisa o mestre quando o dono cai a 0, uma vez por batalha (Recuperação Espantosa). O texto do aviso. */
  avisoAoCair?: string
  /** F2 (fatia D): a reação com técnica pela tabela (Armadura Humana, Giro da Lança). */
  reacao?: ReacaoAMao
  /** F2 (fatia D): a resposta que a forma ligada não deixa (Imbuir Fogo com a Ignição). */
  respostaVetada?: RespostaVetadaAMao
  /** F2 (fatia D, Ignição): os Usos da forma contam os ATAQUES ADICIONAIS da batalha inteira, não as vezes que ela liga. */
  usosContamOAdicional?: true
  /** F2 (fatia D, Revigorar): tira os debuffs e cura; a mira começa em quem usa e só aceita ele ou os aliados. */
  limpa?: LimpezaAMao
  /** F2 (revisão da fatia D): a técnica fica ligada e cobra a cada vez (Giro, Campo). */
  mantida?: MantidaAMao
  /** F2 (fatia E): a técnica é corpo a corpo (a vantagem de Ogro pergunta; `somaDaRaca` soma o +20). */
  corpoACorpo?: CorpoACorpoAMao
  /** F2 (fatia E): a linha da RAÇA (chave `raca:<nome>`, ver `chavesDoDono`). */
  raca?: RacaAMao
  /** F2 (fatia E): a linha da FICHA (chave `ficha:<id>`): o `soDefende` da raça não vale nela (a Ryoko esquiva e contra-ataca). */
  esquivaNormal?: true
  /** F2 (fatia E, Fúria do Dragão): usar a técnica liga a Parte SEGUINTE do grupo da forma de onde ela vem. */
  sobeDeParte?: true
  /** F2 (fatia E, Forma Híbrida): as Partes deste grupo ligam em ordem, uma por vez (1 → 2 → 3). */
  partesEmOrdem?: true
  /** F2 (fatia F, Medicina): os usos por batalha, no lugar do Tempo da ficha (o "0" dela é livre para o app). */
  usosPorBatalha?: number
  /** F2 (fatia F, Medicina): cada uso gasta 1 deste item da mochila da ficha (pelo nome); sem nenhum sobrando, a técnica fica apagada. */
  gastaItem?: string
  /** F2 (fatia F, Golpe Baixo): o selo que quem usa ganha ao usar (o "Para você: +8 em reação" por 2 turnos). */
  seloEmQuemUsa?: SeloDoGolpe
  /** F2 (fatia F, Golpe Baixo): o que a mira lembra (o mestre confere; o app não trava). */
  lembreteNaMira?: string
  /** F2 (fatia F, Medicina): as outras opções da técnica são só fora da batalha (a Cirurgia sai do menu). */
  soAPrincipal?: true
  /** F2 (fatia F, a linha da FICHA do Siegfried): nas técnicas com "Dano da Arma", a mira pergunta qual arma (já marcada a padrão). */
  perguntaAArma?: true
  /** F2 (fatia F, Florescer): a ação no lugar da da ficha (a Florescer não precisa da Bônus dada pelo mestre). */
  acao?: AcaoDaTecnica
  /** F2 (fatia F, Florescer): só vale em alvo com este selo (o da Orquídea); o motivo da recusa. */
  soContraOSelo?: { nome: string; motivo: string }
  /** F2 (fatia F, Florescer): não aceita Concentração (a carga guardada não multiplica nem é gasta). */
  semConcentracao?: true
  /**
   * F2 (fatia F, Melodia): a passiva cujo selo, posto pelo dono na opção
   * principal, soma `dano` em todo golpe do dono naquele alvo (o "+20 de
   * precisão" = +20 de dano contra o analisado).
   */
  contraOSeloDaPassiva?: { dano: number }
  /** F2 (fatia F, CAÇA AS BRUXAS!): evoluir pede o selo da passiva `cartaoId`, posto pelo dono na opção principal, em alguém. */
  evoluirPede?: { cartaoId: string; motivo: string }
  /** F2 (fatia F, CAÇA AS BRUXAS!): depois da evoluída (Overload) usada, a base volta (sem evoluir de novo). */
  voltaDepoisDoOverload?: true
  /** F2 (fatia F, Chamas Celestes): o custo é esta porcentagem do MÁXIMO do recurso (10% do HP máximo = 90), no lugar do texto da ficha. */
  custoDoMaximo?: { recurso: 'sp' | 'hp'; porcento: number }
  /** F2 (fatia F, Chamas Celestes): o que o selo desta técnica tira e dá no fim de cada vez de quem o tem. */
  drenoNoFimDaVez?: DrenoNoFimDaVezAMao
  /** F2 (fatia F, Doença das Trevas): o dono perde esta porcentagem do HP máximo no fim da vez em que andou ou agiu. */
  perdeNoFimDaVez?: { hpPorcento: number }
}

const ATORDOADO_1: SeloDoGolpe = { nome: 'Atordoado', turnos: 1, natureza: 'debuff' }
const SIM_OU_NAO: readonly OpcaoDaPergunta[] = [
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'sim', rotulo: 'Sim' },
]
/** Aira: quantos turnos o aliado fica com a Bênção (a Bênção e A Luz do Sol perguntam). */
const PERGUNTA_DOS_TURNOS_DA_BENCAO: PerguntaNaHora = { chave: 'turnos', texto: 'Quantos turnos o aliado fica com a Bênção?', para: 'quemUsa', tipo: 'numero', minimo: 1, maximo: 99 }
/** Aira: o Status Físico que ganha os 20% do Espírito dela (os físicos do livro). */
const PERGUNTA_DO_FISICO_DA_BENCAO: PerguntaNaHora = {
  chave: 'fisico',
  texto: 'Qual Status Físico ganha a Bênção?',
  para: 'quemUsa',
  tipo: 'opcoes',
  opcoes: [
    { valor: 'forca', rotulo: 'Força' },
    { valor: 'agilidade', rotulo: 'Agilidade' },
    { valor: 'percepcao', rotulo: 'Percepção' },
    { valor: 'resistencia', rotulo: 'Resistência' },
  ],
}
/** O nome do selo da Bênção de uma Raposa: o comportamento dele (o aliado cura 10% do dano que causa) mora na tabela de selos (`condicoes.ts`). */
export const NOME_DA_BENCAO_DA_RAPOSA = 'Bênção de uma Raposa'
const SELO_DA_BENCAO: SeloDasRespostasAMao = { nome: NOME_DA_BENCAO_DA_RAPOSA, natureza: 'buff', turnosDe: 'turnos', mod: { atributoDe: 'fisico', formula: 'Espírito * 0,2' } }
/** F2 (revisão da fatia D): o selo de quem está no Campo de Contenção do Vagn; o comportamento (reage com desvantagem, o lembrete do teste) mora na tabela de selos (`condicoes.ts`). */
export const NOME_DO_PRESO_NO_CAMPO = 'Preso no Campo de Contenção'
/** F2 (fatia D): o cartão da Ignição do Vagn (a forma que veta o fogo e cujos Usos contam os ataques adicionais). */
const IGNICAO_DO_VAGN = 'cart_8ea9d2d5-f1ac-4d11-9a55-0feb66c75415'
/** Recuperação Espantosa (May; Guilherme segue a regra dela): o mestre decide quando e com quanto HP volta. */
const AVISO_DA_RECUPERACAO = 'Recuperação Espantosa: caiu a 0. Mestre, decida em quantos turnos volta e com quanto HP (1 vez por batalha).'

/** F2 (fatia F): a Melodia do Siegfried (a passiva do "+20 contra o analisado", que a evolução da CAÇA pede). */
const MELODIA_DO_SIEG = 'cart_bb6d363f-449f-4fc1-bbe5-fac6589f2301'
/** F2 (fatia F): o selo da redoma da Orquídea; o comportamento (zera a Percepção, sai no próximo golpe, o lembrete) mora em `condicoes.ts`. */
export const NOME_DA_REDOMA = 'Redoma da Orquídea'

/** F2 (fatia E): o prefixo da chave da linha da raça e da linha da ficha (`chavesDoDono`). */
export const CHAVE_DA_RACA = 'raca:'
export const CHAVE_DA_FICHA = 'ficha:'
/** Ryoko: a Fúria do Dragão (uma em cada Parte) liga a Parte seguinte; sem dano e sem alvo. */
const FURIA_DO_DRAGAO: MecanicaAMao = { nome: 'Fúria do Dragão (Ryoko)', dano: '-', semAlvo: true, sobeDeParte: true }
/** Ryoko: a Grande Fissura (uma em cada Parte) é golpe corpo a corpo (socos e chutes): soma o +20 de Ogro. */
const GRANDE_FISSURA: MecanicaAMao = { nome: 'Grande Fissura (Ryoko)', corpoACorpo: { somaDaRaca: true } }
/** Ryoko: as Partes da Forma Híbrida ligam em ordem, uma por vez. */
const PARTE_DA_FORMA_HIBRIDA: MecanicaAMao = { nome: 'Forma Híbrida (Ryoko)', partesEmOrdem: true }

/** A tabela. A chave é o `cartaoId` da técnica na ficha real (ou a da raça e a da ficha, F2 fatia E). */
const MECANICAS_A_MAO: Readonly<Record<string, MecanicaAMao>> = {
  // Ogro (raça; respostas da Ryoko): −30% em todo dano recebido (nos outros ogros, menos o dano verdadeiro: o app ainda não
  // marca golpe de dano verdadeiro, então vale em tudo); +20 no Atacar e nas técnicas corpo a corpo que não escrevem o +20;
  // os outros ogros só Defendem. Vantagem corpo a corpo: no golpe corpo a corpo o app pergunta se o alvo reage com
  // desvantagem; defendendo, quem reage escolhe "Vantagem" no dado da caixa (já existe para todos).
  [`${CHAVE_DA_RACA}ogro`]: {
    nome: 'Ogro (raça)',
    raca: { reducao: { nome: 'Superioridade do Ogro', porcento: 30 }, somaCorpoACorpo: 20, soDefende: true },
    emTodoGolpe: {
      pergunta: { chave: 'vantagemDeOgro', texto: 'Vantagem de Ogro: o alvo reage com desvantagem?', para: 'quemUsa', tipo: 'opcoes', opcoes: SIM_OU_NAO },
      valor: 'sim',
      dano: 0,
      custoEmSp: 0,
      rotulo: 'vantagem de Ogro',
      soCorpoACorpo: true,
      desvantagemNoAlvo: true,
    },
  },
  // Ryoko: "Só ela não tem isso, ela pode esquivar normal" (o Orgulho dos Ogros não vale nela).
  [`${CHAVE_DA_FICHA}pers_7479adc1-5276-4b27-8adb-394f39463d58`]: { nome: 'Ryoko D. Violet (esquiva normal)', esquivaNormal: true },
  // Ryoko: o +20 escrito no Chute já é o de Ogro (não soma de novo); os 25 de queimadura entram no mesmo golpe (campo Dano).
  'cart_b0bc47ef-4a3e-4ccc-8650-8c26b823b5c6': { nome: 'Chute do Dragão (Ryoko)', corpoACorpo: { somaDaRaca: false } },
  // Ryoko: Ação Completa, 35 SP (a ficha); "ignorando sua defesa" = pula o Escudo (o alvo ainda reage); corpo a corpo, + 20 de Ogro.
  'cart_bd88bb1b-2c2d-4b48-af1a-b50bd0009f03': { nome: 'Golpe de Chifres (Ryoko)', perfurante: true, corpoACorpo: { somaDaRaca: true } },
  // Ryoko: come o golpe de FOGO ou EXPLOSÃO, "o MESTRE CONFIRMA": só o mestre usa a reação (o jogador vê o botão apagado e pede a ele).
  // Anula e 20% do que chegava (antes do −30%) vira vida. Vale também contra Overload e Surpresa (o golpe espera a reação dela).
  'cart_f9a3ebf3-cc68-4892-9e90-75b3a1bdc947': {
    nome: 'Recuperação de forças (Ryoko)',
    reacao: {
      saidas: [{ saida: 'esquiva', rotulo: 'come o fogo', noAlvo: 'esquiva', fator: 0, curaDoQueChega: 20 }],
      contraOverload: true,
      contraSurpresa: true,
      soOMestre: 'Só o mestre usa: peça a ele, que confirma se o golpe é de fogo ou explosão',
    },
  },
  'cart_5b1f2e01-5ed4-4fb1-aa28-46b533b54521': PARTE_DA_FORMA_HIBRIDA,
  'cart_82959662-3d4b-4715-99e9-675856c1fcfa': PARTE_DA_FORMA_HIBRIDA,
  'cart_8db149cc-a1e0-4c61-a064-8a4b836d7c12': PARTE_DA_FORMA_HIBRIDA,
  'cart_d2b48141-2b42-474b-9003-27b40f38c174': FURIA_DO_DRAGAO,
  'cart_7fa7e21f-8085-4410-95c7-9ca8dd03b8fb': FURIA_DO_DRAGAO,
  'cart_ba677726-fba0-439a-a35f-66fdea245a08': FURIA_DO_DRAGAO,
  'cart_59843628-cd2c-4368-a45b-d353524c7a3b': GRANDE_FISSURA,
  'cart_0fbab5c6-e8c2-4ff7-ace2-4b927e37c763': GRANDE_FISSURA,
  'cart_2ee09460-6332-49b4-9a03-7e18ae5427a0': GRANDE_FISSURA,
  // Vincent: contra QUALQUER ataque, só como Esquiva (a marca no atacante vem só com ela).
  'cart_5ef11e05-c73e-4972-a432-9fc23a6641ef': { nome: 'Passo de Valsa (Vincent)', reacao: { saidas: [{ saida: 'esquiva', rotulo: 'esquiva e marca', noAlvo: 'esquiva', fator: 0 }] } },
  // Vincent: 1 alvo; "Dano Perfurante" vai direto no HP (o perfurante já sai do texto).
  'cart_206aa17a-dc52-472b-adab-8cd4c71638b0': { nome: 'Desenhar o alvo (Vincent)', tetoDeAlvosComDano: 1 },
  // Vincent: a Bala de Prata (tipo de bala da Rosa Fúnebre: + metade da Percepção, 55 + 17 = 72) deixa "Ferido por prata" em quem
  // ela acerta; o selo só lembra o mestre de cortar a cura pela metade.
  'cart_e41ee968-7a05-4591-a003-6900a6482e91': { nome: 'Bala de Prata (Vincent)', selo: { nome: 'Ferido por prata', turnos: null, natureza: 'debuff' } },
  // Jimboy: depois do acerto, d20 + FOR (vantagem da Força Superior) contra d20 + RES do alvo; só atordoa se vencer.
  'cart_8d2a46e7-afa7-4b7a-bbaf-53ef36cb1669': {
    nome: 'Corta Cenoura (Jimboy)',
    disputa: { quando: 'acerto', testa: 'quemUsa', rola: { atributoId: 'forca', vantagem: 'vantagem' }, contra: { tipo: 'rolagem', quem: { atributoId: 'resistencia' } }, seQuemUsaVence: { selo: ATORDOADO_1 } },
  },
  // Guilherme: o alvo testa RES contra CD 11 ao usar (o teste é a defesa: sem reação); se passar, nada acontece e a Explosão não gasta
  // (volta o SP e o uso). Falhou: 10% da vida ATUAL dele (o host calcula; o jogador só vê o dano) direto no HP, e os debuffs dele dobram.
  'cart_14ed4fb4-817c-41ea-a417-517ece9782ed': {
    nome: 'Explosão (Guilherme)',
    semReacao: true,
    perfurante: true,
    disputa: {
      quando: 'uso',
      testa: 'alvo',
      rola: { atributoId: 'resistencia' },
      contra: { tipo: 'cd', cd: { tipo: 'fixa', cd: 11 } },
      seQuemUsaVence: { dobraOsDebuffs: true },
      seQuemUsaPerde: { devolveOCusto: true },
    },
  },
  // Guilherme: na reação, 1d20 + o maior modificador entre FOR e AGI (o app soma); 10 ou mais anula todo o dano.
  // Manter o Giro: fica ligado, cobra 30 SP no começo de cada vez dele (Aplicar / pular); a recarga 3 só começa quando ele para.
  'cart_4a5b6f4f-87d3-49f5-aafa-0bfd5973c2ca': {
    nome: 'Giro da Lança (Guilherme)',
    reacao: { rolagem: { atributos: ['forca', 'agilidade'], anulaCom: 10 } },
    mantida: { custoPorVez: { recurso: 'sp', valor: 30 } },
  },
  // Guilherme: tira todos os debuffs (até o cansaço do Overload) e cura o Espírito, nele ou num aliado; com 3 cargas, Espírito × 3 (extra da ficha).
  'cart_f566bafe-6d3b-4836-aa93-12969ff5788d': { nome: 'Revigorar (Guilherme)', limpa: { cura: 'Espírito', porCarga: { 3: 'Espírito * 3' } } },
  'cart_c1c30321-a4f2-49b1-a9c6-457938103b57': { nome: 'Recuperação Espantosa (Guilherme)', avisoAoCair: AVISO_DA_RECUPERACAO },
  // Vagn: na reação, duas saídas: Defender toma 90%; Atacar toma tudo e devolve o dano ÷ 7 (para baixo) em quem atacou.
  // Com o Resiliente, a redução da forma vem depois (Defender: −10% e −20% = −28%).
  'cart_06d82bee-8643-4b48-b43f-462d58a12dfe': {
    nome: 'Armadura Humana (Vagn)',
    reacao: {
      saidas: [
        { saida: 'cheio', rotulo: 'Defender', noAlvo: 'cheio', fator: 0.9 },
        { saida: 'contra', rotulo: 'Atacar e devolver ÷ 7', noAlvo: 'cheio', fator: 1, devolveDividido: 7 },
      ],
    },
  },
  // Vagn: a Ignição liga quantas vezes quiser; os "Usos 2" da ficha são os ataques adicionais da batalha inteira (trocar de forma não renova).
  [IGNICAO_DO_VAGN]: { nome: 'Ignição (Vagn)', usosContamOAdicional: true },
  // Vagn: o Campo não dá dano nem espera reação (o "0" da ficha não é golpe; a Polaridade não soma nele). Os marcados (quem está no
  // campo) ficam "Presos no Campo de Contenção": reagem com desvantagem (o app rola 2 d20) e a pílula lembra o teste. Fica ligado:
  // 15 SP por vez (o "por turno" da ficha) e +1 de Concentração por vez mantida (até 3); usar não gasta a carga guardada.
  // À mão até o F0c e a peça de área do construtor: a área 2 + polaridade (o jogador marca quem está dentro) e o teste pela CD da
  // fruta de quem chega perto (falta a Proficiência em Fruta na ficha; o mestre rola).
  'cart_9de30283-6314-44ae-bfd3-a7539c0b17de': { nome: 'Campo de Contenção (Vagn)', dano: '-', selo: { nome: NOME_DO_PRESO_NO_CAMPO, turnos: null, natureza: 'debuff' }, mantida: { cargaPorVez: true } },
  // Siegfried: o alvo testa RES contra 12; falhou, Atordoado 1.
  'cart_3868a90d-a138-4fa0-a902-c30a7a53be7b': {
    nome: 'Gilgamesh: Entardecer (Siegfried)',
    disputa: { quando: 'acerto', testa: 'alvo', rola: { atributoId: 'resistencia' }, contra: { tipo: 'cd', cd: { tipo: 'fixa', cd: 12 } }, seQuemUsaVence: { selo: ATORDOADO_1 } },
  },
  // Vagn: o app pergunta "cortante ou perfurante?": cortante põe Sangramento 10 por 3 turnos (passa pelo Escudo); perfurante vai
  // direto no HP. Acerta todos na linha reta: o jogador marca quem está nela (a ficha não diz o alcance da linha, então a mira não marca sozinha).
  // Imbuir Fogo (Controle do Fogo da raça): interruptor na mira, +10 de dano, sem custo; com a Ignição ligada não vale.
  'cart_d50ef507-dd18-4566-8015-94910a12136e': {
    nome: 'Projeção Letal (Vagn)',
    perguntas: [
      {
        chave: 'corte',
        texto: 'Cortante ou perfurante?',
        para: 'quemUsa',
        tipo: 'opcoes',
        opcoes: [
          { valor: 'cortante', rotulo: 'Cortante' },
          { valor: 'perfurante', rotulo: 'Perfurante' },
        ],
      },
      { chave: 'fogo', texto: 'Imbuir fogo? (+10 de dano)', para: 'quemUsa', tipo: 'opcoes', opcoes: SIM_OU_NAO },
    ],
    respostasMudam: [
      { chave: 'corte', valor: 'cortante', perfurante: false, selo: { nome: 'Sangramento', turnos: 3, natureza: 'debuff' } },
      { chave: 'corte', valor: 'perfurante', perfurante: true },
      // O Dano da ficha (Espírito + 20) mais os 10 do fogo.
      { chave: 'fogo', valor: 'sim', dano: 'Espírito + 20 + 10' },
    ],
    respostaVetada: { chave: 'fogo', valor: 'sim', formaId: IGNICAO_DO_VAGN, motivo: 'Com a Ignição ligada não dá para imbuir fogo' },
  },
  // May, modo ataque: todos os INIMIGOS no 6x6 à frente dela, (Força + 100) × 2. Modo reação: rebate (o dano que chegou + Força dela) em quem atacou,
  // também quando o Overload cai em qualquer alvo no 6x6 à frente dela ("perto").
  'cart_39e23a9c-84c7-4270-821d-bdd7701c32d3': {
    nome: 'Aplauso do Deus do Trovão (May)',
    area: { forma: { tipo: 'frente', lado: 6 }, quem: 'inimigos' },
    dano: '(Força + 100) * 2',
    rebate: { soma: 'Força', perto: { tipo: 'frente', lado: 6 } },
  },
  // May: soma por quadrado EMPURRADO (1 = 30 + FOR, 2 = + FOR/2, 3 = + AGI/2: 100/135/151); bater na parede atordoa.
  'cart_84d81561-cdae-48a3-9ef2-8467de918656': {
    nome: 'Grande Chifre (May)',
    dano: '30 + Força',
    perguntas: [
      {
        chave: 'quadrados',
        texto: 'Quantos quadrados empurrou?',
        para: 'quemUsa',
        tipo: 'opcoes',
        opcoes: [
          { valor: '1', rotulo: '1 quadrado' },
          { valor: '2', rotulo: '2 quadrados' },
          { valor: '3', rotulo: '3 quadrados' },
        ],
      },
      { chave: 'parede', texto: 'Bateu na parede?', para: 'quemUsa', tipo: 'opcoes', opcoes: SIM_OU_NAO },
    ],
    respostasMudam: [
      { chave: 'quadrados', valor: '2', dano: '30 + Força + Força/2' },
      { chave: 'quadrados', valor: '3', dano: '30 + Força + Força/2 + Agilidade/2' },
      { chave: 'parede', valor: 'sim', selo: ATORDOADO_1 },
    ],
  },
  // May: o alvo fica Aéreo até o fim da próxima vez dele (sem Esquiva nem Contra-ataque).
  'cart_4944b734-4018-42a0-abcc-17ff04e32da3': { nome: 'Lançamento de Chifre (May)', selo: { nome: 'Aéreo', turnos: 1, natureza: 'debuff' } },
  'cart_5e5eb2ee-f406-4fcc-a895-a87ad44ce3f0': { nome: 'Recuperação Espantosa (May)', avisoAoCair: AVISO_DA_RECUPERACAO },
  // Jimboy: o ×1,5 só no ponto vital (a mira pergunta); sem ele, Força + 40 (60 na forma base).
  'cart_d8b7062c-b98f-41bb-97ac-05b65892f28f': {
    nome: 'Quebra-Queixo (Jimboy)',
    dano: 'Força + 40',
    perguntas: [{ chave: 'vital', texto: 'Acertou ponto vital?', para: 'quemUsa', tipo: 'opcoes', opcoes: SIM_OU_NAO }],
    respostasMudam: [{ chave: 'vital', valor: 'sim', dano: '(Força + 40) * 1,5' }],
  },
  // Jimboy: dois golpes, duas reações; o 1º com o Dano 1 (passa pelo Escudo), o 2º com a metade, perfurante.
  'cart_76fe44e8-629e-4e7c-b524-a1bbc7a85dd8': { nome: 'Rapid Dash (Jimboy)', perfurante: false, segundoGolpe: { fracao: 0.5, perfurante: true } },
  // Jimboy: Overload (fórmula do campo Dano, 257); paralisa 2 turnos; ele perde 200 de HP sempre ("Técnica Incompleta").
  'cart_7062c767-f138-47c3-9676-5695400b23d4': { nome: 'Sai Dai Rin: Rokuogan (Jimboy)', selo: { nome: 'Paralisado', turnos: 2, natureza: 'debuff' }, custoEmHp: 200 },
  // Harvey: os inimigos a 1 casa, marcados sozinhos (ele pode mudar a escolha). A Pá (+ Dano da Arma) já está no campo Dano (F0).
  'cart_9500ae10-0bdc-4f08-b472-edb73cb70685': { nome: 'Giro de Pá (Harvey)', area: { forma: { tipo: 'raio', casas: 1 }, quem: 'inimigos' } },
  // Harvey: "Para você: +8 em reação" por 2 turnos (os do Cego); o Cego do alvo zera a Percepção (tabela de selos). Terreno e alcance: o mestre confere.
  'cart_387e7dce-4d87-42d7-8392-10d0d015243b': {
    nome: 'Golpe Baixo (Harvey)',
    seloEmQuemUsa: { nome: 'Golpe Baixo: +8 em reação', turnos: 2, natureza: 'buff', mods: [{ alvo: 'reacao', delta: 8 }] },
    lembreteNaMira: 'Só em chão de terra ou areia, e o alvo a até 2 casas: o mestre confere.',
  },
  // Harvey: cura 100 sozinha, sem reação, nele ou num aliado; Concentração 150 / 200 / 350; 3 por batalha; cada uso gasta 1 Kit Médico.
  // A Cirurgia (extra "Efeito 2") é só fora da batalha: sai do menu.
  'cart_d281702e-da8c-4e96-9a97-8e4dd8ef07e9': {
    nome: 'Medicina (Harvey)',
    dano: '-',
    limpa: { cura: '100', porCarga: { 1: '150', 2: '200', 3: '350' }, soCura: true },
    usosPorBatalha: 3,
    gastaItem: 'Kit Médico',
    soAPrincipal: true,
  },
  // Siegfried: nas técnicas com "Dano da Arma" a mira pergunta qual das armas levadas ele usa (a 1ª levada vem marcada).
  [`${CHAVE_DA_FICHA}pers_f665c18d-a3fa-46dd-9a58-02a100920d60`]: { nome: 'Siegfried (qual arma)', perguntaAArma: true },
  // Siegfried: a base dividida entre os marcados, para baixo, até 3 alvos.
  'cart_366f98ce-8206-473a-8646-e34ae6907dbe': { nome: 'Balmung: Lua Incandescente (Siegfried)', divide: { teto: 3 } },
  // Siegfried: "Melodia ligada" na opção do +20: +20 de dano em todo golpe dele contra o analisado (o selo dourado).
  [MELODIA_DO_SIEG]: { nome: 'Melodia de todas as coisas (Siegfried)', contraOSeloDaPassiva: { dano: 20 } },
  // Siegfried: evoluir pede a Melodia ligada na opção do +20; depois da SUPER (Overload, 1 por batalha) a CAÇA volta, sem evoluir de novo.
  'cart_89db5c9a-728a-4150-8361-a5638b156ec4': {
    nome: 'CAÇA AS BRUXAS! (Siegfried)',
    evoluirPede: { cartaoId: MELODIA_DO_SIEG, motivo: 'Para evoluir, a Melodia tem de estar ligada na opção do +20 de dano' },
    voltaDepoisDoOverload: true,
  },
  // Siegfried: a Orquídea não dá dano; põe a redoma (Cego + Imobilizado) até o próximo golpe no alvo. Os 30 de fogo e o golpe de
  // oportunidade quando o preso tenta atacar ou sair: a pílula do selo lembra o mestre.
  'cart_cbdb2bab-bf3e-488b-89ca-c71fcae3e77b': { nome: 'Apunhaladora de Sóis: Orquídea (Siegfried)', dano: '-', selo: { nome: NOME_DA_REDOMA, turnos: null, natureza: 'debuff' } },
  // Siegfried: a Florescer sai sem a Bônus do mestre, só em quem está na redoma (e a consome: é o próximo golpe nele); sem Concentração.
  // O 3x do furtivo já está na fórmula; com Surpresa, mais ×1,5 (302 vira 453).
  'cart_aa5281be-6028-47f3-a877-3ef8c40b2424': {
    nome: 'Orquídea: Florescer (Siegfried)',
    acao: 'livre',
    soContraOSelo: { nome: NOME_DA_REDOMA, motivo: 'A Florescer só vale em quem está na redoma da Orquídea' },
    semConcentracao: true,
  },
  // Siegfried: custa 10% do HP MÁXIMO (90) e dura a luta; no fim de cada vez do alvo: alvo −15 SP, Sieg +10 SP e −3% do HP dele.
  'cart_22d65606-022c-4e24-b0f0-d77ba59c486a': {
    nome: 'Chamas Celestes (Siegfried)',
    custoDoMaximo: { recurso: 'hp', porcento: 10 },
    selo: { nome: 'Chamas Celestes', turnos: null, natureza: 'debuff' },
    drenoNoFimDaVez: { alvoSp: 15, donoSp: 10, donoHpPorcento: 3 },
  },
  // Siegfried: a Doença das Trevas tira 3% do HP máximo (27) no fim da vez em que ele andou ou agiu.
  'cart_5e20dfc2-6aad-440c-a2f7-4b5c3b82b67b': { nome: 'Doença das Trevas (Siegfried)', perdeNoFimDaVez: { hpPorcento: 3 } },
  // Siegfried: a Ignição segue a resposta do Vagn: os "2 por batalha" são os ataques adicionais, não as vezes que liga.
  'cart_d6374db1-54d6-4859-9938-1765e2684c38': { nome: 'Ignição (Siegfried)', usosContamOAdicional: true },
  // Aira: o app pergunta quantos turnos e qual físico; o aliado marcado ganha 20% do Espírito dela nele (e cura 10% do dano que causa, pelo selo).
  // Com um aliado abençoado, o Atacar dela vira 3 golpes de +30% do Espírito, com Queimando 10 por 1 turno (renova a cada acerto).
  'cart_369efcd2-19cf-400d-a0f0-c19ceebc0070': {
    nome: 'A Virtude Traz Benção (Aira)',
    perguntas: [PERGUNTA_DOS_TURNOS_DA_BENCAO, PERGUNTA_DO_FISICO_DA_BENCAO],
    seloDasRespostas: SELO_DA_BENCAO,
    ataqueBasico: { enquanto: NOME_DA_BENCAO_DA_RAPOSA, golpes: 3, soma: 'Espírito * 0,3', selo: { nome: 'Queimando', turnos: 1, natureza: 'debuff', porVez: 10 } },
  },
  // Aira: sem reação; o alvo testa ESPÍRITO contra 12 + mod. de CAR dela. Cargas 1 e 2 sobem a CD (+2 cada: número da mesa, o mestre não deu),
  // com 3 atordoa sem teste. Falhou: Atordoado 1.
  'cart_b49c9862-9fa4-48fb-9a6f-c39cffc919c4': {
    nome: 'Em Meio às Alegres Nuvens (Aira)',
    semReacao: true,
    disputa: {
      quando: 'acerto',
      testa: 'alvo',
      rola: { atributoId: 'espirito' },
      contra: { tipo: 'cd', cd: { tipo: 'porCarga', semCarga: { tipo: 'formula', base: 12, atributoId: 'carisma' }, cargas: [{ mais: 2 }, { mais: 4 }, 'acerta'] } },
      seQuemUsaVence: { selo: ATORDOADO_1 },
    },
  },
  // Alexei: Armadilhar POSICIONA a armadilha (20 SP, Simples, sem alvo e sem dano; a escolhida vai ao registro). O que ela faz quando
  // alguém pisa é do mestre: Batata-mina 50 em todos na 3x3, Emaranhalga o selo "Enraizado", Imã-Gumelo o selo "Preso pelo Imã-Gumelo"
  // (a tabela de selos lembra a regra); a Planta Carnívora é companion (construtor). À mão DE PROPÓSITO até a armadilha virar token
  // (construtor): o app não sabe onde ela está nem quando dispara, então não acha "quem está perto" (o 5x5 do Imã-Gumelo, o 3x3 da
  // Batata-mina) nem pergunta "tem metal grande?" a cada um. Registrado em docs/planos/conserto-fichas-2026-11-08.md (F2).
  'cart_51bfdbe0-fac7-450d-9e83-420bb884bb5f': {
    nome: 'Armadilhar (Alexei)',
    dano: '-',
    semAlvo: true,
    perguntas: [
      {
        chave: 'armadilha',
        texto: 'Qual armadilha?',
        para: 'quemUsa',
        tipo: 'opcoes',
        opcoes: [
          { valor: 'emaranhalga', rotulo: 'Emaranhalga' },
          { valor: 'batata', rotulo: 'Batata-mina' },
          { valor: 'ima', rotulo: 'Imã-Gumelo' },
          { valor: 'planta', rotulo: 'Planta Carnívora' },
        ],
      },
    ],
  },
  // Aira: dano igual ao Espírito no inimigo; a Bênção (com as mesmas perguntas) nos aliados que ela marcar.
  // O extra "Imbuir Eletricidade" deste cartão é o Electro da raça: quando ela quiser, em QUALQUER golpe dela, +20 de dano e -10 SP.
  'cart_f95a0284-28f8-4265-96fe-bcd0906148a6': {
    nome: 'A Luz do Sol Brilha Sobre Todos (Aira)',
    dano: 'Espírito',
    perguntas: [PERGUNTA_DOS_TURNOS_DA_BENCAO, PERGUNTA_DO_FISICO_DA_BENCAO],
    seloDasRespostas: SELO_DA_BENCAO,
    seloSoNosAliados: true,
    tetoDeAlvosComDano: 1,
    emTodoGolpe: { pergunta: { chave: 'electro', texto: 'Imbuir eletricidade? (+20 de dano, -10 SP)', para: 'quemUsa', tipo: 'opcoes', opcoes: SIM_OU_NAO }, valor: 'sim', dano: 20, custoEmSp: 10, rotulo: 'eletricidade' },
  },
}

/** A mecânica à mão do cartão; `null` = a técnica segue só pelo texto da ficha. */
export function mecanicaDoCartao(cartaoId: string): MecanicaAMao | null {
  return Object.hasOwn(MECANICAS_A_MAO, cartaoId) ? MECANICAS_A_MAO[cartaoId] : null
}

/** As perguntas na hora da técnica (vazio = nenhuma). */
export function perguntasDoCartao(cartaoId: string): readonly PerguntaNaHora[] {
  return mecanicaDoCartao(cartaoId)?.perguntas ?? []
}

/** Por que as respostas do pedido não valem para a técnica, ou `null`. Técnica sem pergunta não aceita resposta. */
export function motivoDasRespostasDoCartao(cartaoId: string, respostas: RespostasDoPedido | undefined): string | null {
  return motivoDasRespostas(perguntasDoCartao(cartaoId), respostas)
}

/**
 * F2 (fatia B): as respostas que a mira manda sem a pessoa tocar: a 1ª opção
 * de cada pergunta e o mínimo de cada número. Sem pergunta: `undefined`.
 */
export function respostasPadrao(cartaoId: string): RespostasDoPedido | undefined {
  const perguntas = perguntasDoCartao(cartaoId)
  if (perguntas.length === 0) return undefined
  const respostas: Record<string, string | number> = {}
  for (const pergunta of perguntas) {
    const padrao = pergunta.tipo === 'opcoes' ? pergunta.opcoes[0]?.valor : pergunta.minimo
    if (padrao !== undefined) respostas[pergunta.chave] = padrao
  }
  return respostas
}

/** O que as respostas mudam no golpe: a fórmula do dano e o selo (`null` = nenhuma resposta muda aquilo). */
export interface MudancaNoGolpe {
  dano: string | null
  selo: SeloDoGolpe | null
}

/** F2 (fatia B): o que as respostas mudam (a última mudança que casa vence). Sem resposta: nada muda. */
export function mudancaDasRespostas(cartaoId: string, respostas: RespostasDoPedido | undefined): MudancaNoGolpe {
  const mudanca: MudancaNoGolpe = { dano: null, selo: null }
  if (respostas === undefined) return mudanca
  for (const regra of mecanicaDoCartao(cartaoId)?.respostasMudam ?? []) {
    if (respostas[regra.chave] !== regra.valor) continue
    if (regra.dano !== undefined) mudanca.dano = regra.dano
    if (regra.selo !== undefined) mudanca.selo = regra.selo
  }
  return mudanca
}

/** F2 (fatia B): a fórmula do dano da tabela, com o que as respostas mudam; `null` = vale o campo Dano da ficha. */
export function formulaDaMecanica(cartaoId: string, respostas?: RespostasDoPedido): string | null {
  return mudancaDasRespostas(cartaoId, respostas).dano ?? mecanicaDoCartao(cartaoId)?.dano ?? null
}

/**
 * F2 (fatia B): o selo que a tabela põe no acerto (vence o da mira, que é
 * leitura de texto): o da resposta, o fixo da técnica, ou o da disputa (que
 * só pega se quem usa vencer). `null` = vale o da mira.
 */
export function seloDaMecanica(cartaoId: string, respostas?: RespostasDoPedido, valorNaFicha?: (formula: string) => number | null): SeloDoGolpe | null {
  const mecanica = mecanicaDoCartao(cartaoId)
  if (mecanica === null) return null
  const montado = mecanica.seloDasRespostas === undefined ? null : seloMontado(mecanica.seloDasRespostas, respostas, valorNaFicha)
  return mudancaDasRespostas(cartaoId, respostas).selo ?? mecanica.selo ?? montado ?? mecanica.disputa?.seQuemUsaVence?.selo ?? null
}

/**
 * F2 (fatia C): o selo das respostas. Sem a resposta de turnos: até o mestre
 * tirar. Sem `valorNaFicha` (a prévia que não tem a ficha) ou sem a resposta
 * do atributo, o selo sai sem o mod.
 */
function seloMontado(molde: SeloDasRespostasAMao, respostas: RespostasDoPedido | undefined, valorNaFicha: ((formula: string) => number | null) | undefined): SeloDoGolpe {
  const turnos = respostas?.[molde.turnosDe]
  const selo: SeloDoGolpe = { nome: molde.nome, turnos: typeof turnos === 'number' ? turnos : null, natureza: molde.natureza }
  const atributo = molde.mod === undefined ? undefined : respostas?.[molde.mod.atributoDe]
  const valor = molde.mod === undefined || valorNaFicha === undefined ? null : valorNaFicha(molde.mod.formula)
  if (typeof atributo === 'string' && valor !== null) selo.mods = [{ alvo: atributo, delta: Math.floor(valor) }]
  return selo
}

/**
 * F2 (fatia C): o selo do golpe pega neste alvo? Com `seloSoNosAliados` (A
 * Luz do Sol), só nos aliados de quem usa (`aliados`: ids de personagem); o
 * resto das técnicas, em todo alvo acertado.
 */
export function seloPegaNoAlvo(cartaoId: string, alvoPersonagemId: string | null, aliados: ReadonlySet<string>): boolean {
  if (mecanicaDoCartao(cartaoId)?.seloSoNosAliados !== true) return true
  return alvoPersonagemId !== null && aliados.has(alvoPersonagemId)
}

/**
 * F2 (fatia C): por que os alvos passam do teto de quem toma dano (A Luz do
 * Sol: "em um inimigo"), ou `null`. `alvosPersonagemIds`: o personagem de
 * cada alvo marcado; com `seloSoNosAliados`, os aliados de quem usa não
 * contam (eles só levam o selo). `nomeDaTecnica` vai no motivo.
 */
export function motivoDoTetoDeDano(cartaoId: string, nomeDaTecnica: string, alvosPersonagemIds: readonly (string | null | undefined)[], aliados: ReadonlySet<string>): string | null {
  const mecanica = mecanicaDoCartao(cartaoId)
  const teto = mecanica?.tetoDeAlvosComDano
  if (mecanica === null || teto === undefined) return null
  const comDano = mecanica.seloSoNosAliados === true ? alvosPersonagemIds.filter((id) => typeof id !== 'string' || !aliados.has(id)) : alvosPersonagemIds
  if (comDano.length <= teto) return null
  return teto === 1 ? `${nomeDaTecnica} dá dano em um inimigo só` : `${nomeDaTecnica} dá dano em no máximo ${teto} inimigos`
}

/** F2 (fatia B): a técnica pede selo pela resposta e a resposta não pediu (Grande Chifre sem parede): o golpe sai sem selo. */
export function semSeloPelaResposta(cartaoId: string, respostas: RespostasDoPedido | undefined): boolean {
  const mecanica = mecanicaDoCartao(cartaoId)
  if (mecanica === null || mecanica.selo !== undefined || mecanica.disputa !== undefined) return false
  return (mecanica.respostasMudam ?? []).some((regra) => regra.selo !== undefined) && mudancaDasRespostas(cartaoId, respostas).selo === null
}

/** F2 (fatia B): os rótulos das respostas de opção, para o registro ("Grande Chifre (3 quadrados, parede: Sim)"). */
export function rotulosDasRespostas(cartaoId: string, respostas: RespostasDoPedido | undefined): string[] {
  if (respostas === undefined) return []
  return perguntasDoCartao(cartaoId).flatMap((pergunta): string[] => {
    const resposta = respostas[pergunta.chave]
    if (resposta === undefined) return []
    if (pergunta.tipo === 'numero') return [`${pergunta.chave}: ${resposta}`]
    const opcao = pergunta.opcoes.find((candidata) => candidata.valor === resposta)
    if (opcao === undefined) return []
    // "Sim"/"Não" sozinho não diz nada: leva a pergunta junto ("Bateu na parede?: Sim").
    return [opcao.rotulo.length <= 3 ? `${pergunta.texto} ${opcao.rotulo}` : opcao.rotulo]
  })
}

/**
 * F2 (fatia C): o Atacar melhorado do dono agora (Aira com um aliado
 * abençoado), ou `null`. `cartoesIds` = os cartões da ficha dele; vale o selo
 * `enquanto` (sem acento nem caixa) que um desses cartões pôs em OUTRO token.
 */
export function ataqueComOSelo(cartoesIds: readonly string[], selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'nome' | 'cartaoId'>[] | undefined, tokenIdDoDono: string): AtaqueBasicoAMao | null {
  const dele = new Set(cartoesIds)
  for (const cartaoId of cartoesIds) {
    const ataque = mecanicaDoCartao(cartaoId)?.ataqueBasico
    if (ataque === undefined) continue
    const nome = normalizar(ataque.enquanto)
    const ativo = (selos ?? []).some((selo) => selo.tokenId !== tokenIdDoDono && selo.cartaoId !== undefined && dele.has(selo.cartaoId) && normalizar(selo.nome).trim() === nome)
    if (ativo) return ataque
  }
  return null
}

/**
 * F2 (fatia C): o que vale em todo golpe do dono, pelos cartões da ficha dele
 * (o Electro da Aira). F2 (fatia E): com `cartaoId` (`null` = Atacar), o que é
 * só de golpe corpo a corpo (vantagem de Ogro) fica de fora da técnica que não é.
 */
function emTodoGolpeDo(cartoesDoDono: readonly string[], cartaoId?: string | null): EmTodoGolpeAMao[] {
  return cartoesDoDono.flatMap((chave) => {
    const emTodo = mecanicaDoCartao(chave)?.emTodoGolpe
    if (emTodo === undefined) return []
    return emTodo.soCorpoACorpo === true && cartaoId !== undefined && cartaoId !== null && corpoACorpoDe(cartaoId) === null ? [] : [emTodo]
  })
}

/** F2 (fatia C): as perguntas do golpe: as da técnica (`cartaoId`; `null` = Atacar) e as de todo golpe do dono, sem chave repetida. */
export function perguntasDoGolpe(cartaoId: string | null, cartoesDoDono: readonly string[]): PerguntaNaHora[] {
  const daTecnica = cartaoId === null ? [] : perguntasDoCartao(cartaoId)
  const chaves = new Set(daTecnica.map((pergunta) => pergunta.chave))
  return [...daTecnica, ...emTodoGolpeDo(cartoesDoDono, cartaoId).map((emTodo) => emTodo.pergunta).filter((pergunta) => !chaves.has(pergunta.chave))]
}

/**
 * F2 (fatia C): por que as respostas não valem para o golpe (técnica ou
 * Atacar, com as do dono), ou `null`. As da técnica são todas obrigatórias;
 * as de todo golpe do dono, só quando vêm (sem resposta = "Não": o pedido
 * de antes, ou de quem não tocou, segue valendo).
 */
export function motivoDasRespostasDoGolpe(cartaoId: string | null, cartoesDoDono: readonly string[], respostas: RespostasDoPedido | undefined): string | null {
  const daTecnica = new Set((cartaoId === null ? [] : perguntasDoCartao(cartaoId)).map((pergunta) => pergunta.chave))
  const conferidas = perguntasDoGolpe(cartaoId, cartoesDoDono).filter((pergunta) => daTecnica.has(pergunta.chave) || respostas?.[pergunta.chave] !== undefined)
  return motivoDasRespostas(conferidas, respostas)
}

/** F2 (fatia C): o que as respostas de todo golpe somam no dano e cobram em SP, e os rótulos para o registro ("eletricidade"). */
export function extraDeTodoGolpe(cartoesDoDono: readonly string[], respostas: RespostasDoPedido | undefined): { dano: number; custoEmSp: number; rotulos: string[]; desvantagemNoAlvo: boolean } {
  const rotulos: string[] = []
  const extra = { dano: 0, custoEmSp: 0, rotulos, desvantagemNoAlvo: false }
  if (respostas === undefined) return extra
  for (const emTodo of emTodoGolpeDo(cartoesDoDono)) {
    if (respostas[emTodo.pergunta.chave] !== emTodo.valor) continue
    extra.dano += emTodo.dano
    extra.custoEmSp += emTodo.custoEmSp
    extra.rotulos.push(emTodo.rotulo)
    if (emTodo.desvantagemNoAlvo === true) extra.desvantagemNoAlvo = true
  }
  return extra
}

/** F2 (fatia B): a disputa que o app rola depois do acerto (Corta Cenoura); `null` = nenhuma. */
export function disputaNoAcerto(cartaoId: string): DisputaAMao | null {
  const disputa = mecanicaDoCartao(cartaoId)?.disputa
  return disputa !== undefined && disputa.quando === 'acerto' ? disputa : null
}

/** F2 (fatia B): a área em volta de quem usa onde a técnica rebate o golpe Overload em outro alvo (Aplauso); `null` = só quando o alvo é quem usa. */
export function rebatePertoDe(cartaoId: string): FormaDaArea | null {
  return mecanicaDoCartao(cartaoId)?.rebate?.perto ?? null
}

/** F2 (fatia B): o aviso ao cair a 0 de um dos cartões (o primeiro que tem), com o id dele; `null` = nenhum. */
export function avisoAoCairDe(cartoesIds: readonly string[]): { cartaoId: string; texto: string } | null {
  for (const cartaoId of cartoesIds) {
    const texto = mecanicaDoCartao(cartaoId)?.avisoAoCair
    if (texto !== undefined) return { cartaoId, texto }
  }
  return null
}

/** F2 (fatia D, Projeção Letal): o perfurante pela resposta (a última que casa vence) ou o fixo da tabela; `null` = vale o da mira. */
export function perfuranteDaMecanica(cartaoId: string, respostas: RespostasDoPedido | undefined): boolean | null {
  const mecanica = mecanicaDoCartao(cartaoId)
  if (mecanica === null) return null
  let pelaResposta: boolean | null = null
  for (const regra of mecanica.respostasMudam ?? []) {
    if (regra.perfurante !== undefined && respostas?.[regra.chave] === regra.valor) pelaResposta = regra.perfurante
  }
  return pelaResposta ?? mecanica.perfurante ?? null
}

/** F2 (fatia D, Explosão): a disputa que o app rola LOGO AO USAR, antes do dano; `null` = nenhuma. */
export function disputaNoUso(cartaoId: string): DisputaAMao | null {
  const disputa = mecanicaDoCartao(cartaoId)?.disputa
  return disputa !== undefined && disputa.quando === 'uso' ? disputa : null
}

/** F2 (fatia D): a reação da tabela (Armadura Humana, Giro da Lança); `null` = a de sempre, lida do texto. */
export function reacaoAMaoDe(cartaoId: string): ReacaoAMao | null {
  return mecanicaDoCartao(cartaoId)?.reacao ?? null
}

/** F2 (fatia D, Imbuir Fogo com a Ignição): por que a resposta não vale com as formas ligadas (`ativos` = os `cartoesAtivos` da ficha), ou `null`. */
export function motivoDaRespostaVetada(cartaoId: string, respostas: RespostasDoPedido | undefined, ativos: readonly string[]): string | null {
  const veto = mecanicaDoCartao(cartaoId)?.respostaVetada
  if (veto === undefined || respostas?.[veto.chave] !== veto.valor || !ativos.includes(veto.formaId)) return null
  return veto.motivo
}

/** F2 (fatia D): as perguntas como a mira mostra com as formas ligadas: a opção vetada some (a Ignição ligada deixa só "Não" no fogo). */
export function perguntasComAsFormas(perguntas: readonly PerguntaNaHora[], cartaoId: string, ativos: readonly string[]): PerguntaNaHora[] {
  const veto = mecanicaDoCartao(cartaoId)?.respostaVetada
  if (veto === undefined || !ativos.includes(veto.formaId)) return [...perguntas]
  return perguntas.map((pergunta) => (pergunta.chave === veto.chave && pergunta.tipo === 'opcoes' ? { ...pergunta, opcoes: pergunta.opcoes.filter((opcao) => opcao.valor !== veto.valor) } : pergunta))
}

/** F2 (fatia D, Ignição): os Usos desta forma contam os ataques adicionais da batalha, não as vezes que ela liga. */
export function usosContamOAdicional(cartaoId: string): boolean {
  return mecanicaDoCartao(cartaoId)?.usosContamOAdicional === true
}

/** F2 (fatia D, Revigorar): a limpeza da técnica; `null` = a técnica não limpa. */
export function limpezaDe(cartaoId: string): LimpezaAMao | null {
  return mecanicaDoCartao(cartaoId)?.limpa ?? null
}

/** F2 (revisão da fatia D, Revigorar): a fórmula da cura com a carga que o golpe gastou (3 = "Espírito * 3"); sem fórmula para a carga, a `cura`. */
export function formulaDaCura(limpeza: LimpezaAMao, carga: number): string {
  const porCarga = carga === 1 || carga === 2 || carga === 3 ? limpeza.porCarga?.[carga] : undefined
  return porCarga ?? limpeza.cura
}

/** F2 (revisão da fatia D): a técnica mantida (Giro, Campo); `null` = usar marca a recarga na hora, como sempre. */
export function mantidaDe(cartaoId: string): MantidaAMao | null {
  return mecanicaDoCartao(cartaoId)?.mantida ?? null
}

/**
 * F2 (revisão da fatia D, Campo): usar a técnica gasta a Concentração
 * guardada? A que dá carga por vez não gasta; F2 (fatia F, Florescer): a que
 * não aceita Concentração também não (nem a usa).
 */
export function gastaACarga(cartaoId: string | null): boolean {
  if (cartaoId === null) return true
  return mantidaDe(cartaoId)?.cargaPorVez !== true && mecanicaDoCartao(cartaoId)?.semConcentracao !== true
}

/**
 * F2 (fatia E): as chaves da tabela que valem para o dono: os ids dos cartões
 * da ficha (todas as abas), a da raça (`raca:ogro`, sem acento nem caixa) e a
 * da ficha (`ficha:<id>`). Quem lê "os cartões do dono" (as perguntas de todo
 * golpe, o Atacar melhorado) passa por aqui.
 */
export function chavesDoDono(personagem: Pick<Personagem, 'id' | 'abas' | 'escolhas'>): string[] {
  const cartoes = Object.values(personagem.abas).flatMap((lista) => lista.map((cartao) => cartao.id))
  const raca = normalizar(personagem.escolhas.raca ?? '').trim()
  return [...cartoes, ...(raca.length === 0 ? [] : [`${CHAVE_DA_RACA}${raca}`]), `${CHAVE_DA_FICHA}${personagem.id}`]
}

/** F2 (fatia E): a raça do dono na tabela (a primeira chave com `raca`); `null` = a raça não faz nada no app. */
export function racaDoDono(chaves: readonly string[]): RacaAMao | null {
  for (const chave of chaves) {
    const raca = mecanicaDoCartao(chave)?.raca
    if (raca !== undefined) return raca
  }
  return null
}

/** F2 (fatia E, Superioridade do Ogro): o dano recebido que a raça tira; `null` = nenhum. */
export function reducaoDaRaca(personagem: Pick<Personagem, 'id' | 'abas' | 'escolhas'>): { nome: string; porcento: number } | null {
  return racaDoDono(chavesDoDono(personagem))?.reducao ?? null
}

/**
 * F2 (fatia E, Orgulho dos Ogros): as saídas da reação que a raça tira (só
 * Defender e Receber), menos na ficha com `esquivaNormal` (a Ryoko). Vazio =
 * nenhuma.
 */
export function saidasTiradasDoDono(chaves: readonly string[]): SaidaDaReacao[] {
  if (racaDoDono(chaves)?.soDefende !== true) return []
  return chaves.some((chave) => mecanicaDoCartao(chave)?.esquivaNormal === true) ? [] : ['esquiva', 'contra']
}

/** F2 (fatia E): a técnica corpo a corpo da tabela; `null` = não é (ou não está na tabela). */
export function corpoACorpoDe(cartaoId: string): CorpoACorpoAMao | null {
  return mecanicaDoCartao(cartaoId)?.corpoACorpo ?? null
}

/**
 * F2 (fatia E, Força Aumentada do Ogro): o dano corpo a corpo que a raça soma
 * neste golpe. `cartaoId` `null` = o Atacar, que soma quando `atacarCorpoACorpo`
 * (sem arma, ou arma que não atira nem é de arremesso); a técnica soma só
 * com `corpoACorpo.somaDaRaca`.
 */
export function somaCorpoACorpo(chaves: readonly string[], cartaoId: string | null, atacarCorpoACorpo: boolean): number {
  const soma = racaDoDono(chaves)?.somaCorpoACorpo ?? 0
  if (soma <= 0) return 0
  if (cartaoId === null) return atacarCorpoACorpo ? soma : 0
  return corpoACorpoDe(cartaoId)?.somaDaRaca === true ? soma : 0
}

/** F2 (fatia E, Forma Híbrida): a forma liga em ordem dentro do grupo (uma Parte por vez). */
export function partesEmOrdem(cartaoId: string): boolean {
  return mecanicaDoCartao(cartaoId)?.partesEmOrdem === true
}

/** F2 (fatia E, Fúria do Dragão): usar a técnica liga a Parte seguinte. */
export function sobeDeParte(cartaoId: string): boolean {
  return mecanicaDoCartao(cartaoId)?.sobeDeParte === true
}

/** F2 (fatia E, Recuperação de forças): a técnica de reação vale também contra golpe Overload. */
export function reageContraOverload(cartaoId: string): boolean {
  return mecanicaDoCartao(cartaoId)?.reacao?.contraOverload === true
}

/** F2 (revisão da fatia E, Recuperação de forças): a técnica de reação vale também contra golpe Surpresa. */
export function reageContraSurpresa(cartaoId: string): boolean {
  return mecanicaDoCartao(cartaoId)?.reacao?.contraSurpresa === true
}

/** F2 (revisão da fatia E, Recuperação de forças): o motivo de a reação com a técnica ser só do mestre; `null` = o jogador também usa. */
export function soOMestreReage(cartaoId: string): string | null {
  return mecanicaDoCartao(cartaoId)?.reacao?.soOMestre ?? null
}

/** F2 (fatia F): o dono pede a arma nas técnicas com "Dano da Arma" (a linha da ficha do Siegfried). */
export function perguntaAArma(chaves: readonly string[]): boolean {
  return chaves.some((chave) => mecanicaDoCartao(chave)?.perguntaAArma === true)
}

/**
 * F2 (fatia F, Medicina): quantos do item que a técnica gasta sobram (os da
 * mochila menos os usos nesta batalha); `null` = a técnica não gasta item.
 */
export function itensQueSobram(cartaoId: string, mochila: readonly { nome: string }[] | undefined, usadas: number): { nome: string; sobram: number } | null {
  const nome = mecanicaDoCartao(cartaoId)?.gastaItem
  if (nome === undefined) return null
  const procurado = normalizar(nome).trim()
  const tem = (mochila ?? []).filter((item) => normalizar(item.nome).trim() === procurado).length
  return { nome, sobram: Math.max(0, tem - usadas) }
}

/**
 * F2 (fatia F, Florescer): por que algum alvo não tem o selo que a técnica
 * pede (pelo nome, sem acento nem caixa), ou `null`. `selosDoAlvo` = os nomes
 * dos selos de cada alvo marcado.
 */
export function motivoDoSeloPedido(cartaoId: string, selosDosAlvos: readonly (readonly string[])[]): string | null {
  const pedido = mecanicaDoCartao(cartaoId)?.soContraOSelo
  if (pedido === undefined) return null
  const nome = normalizar(pedido.nome).trim()
  const falta = selosDosAlvos.length === 0 || selosDosAlvos.some((nomes) => !nomes.some((outro) => normalizar(outro).trim() === nome))
  return falta ? pedido.motivo : null
}

/**
 * F2 (fatia F, Melodia): o dano a mais do dono neste alvo, pelos selos de
 * passiva que ELE pôs ali na opção principal (`opcao` ausente) de um cartão
 * com `contraOSeloDaPassiva`. 0 = nenhum.
 */
export function somaContraOSelo(selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'cartaoId' | 'donoId' | 'opcao'>[] | undefined, alvoTokenId: string, donoPersonagemId: string | null): number {
  if (donoPersonagemId === null) return 0
  return (selos ?? []).reduce((soma, selo) => {
    if (selo.tokenId !== alvoTokenId || selo.donoId !== donoPersonagemId || selo.cartaoId === undefined || selo.opcao !== undefined) return soma
    return soma + (mecanicaDoCartao(selo.cartaoId)?.contraOSeloDaPassiva?.dano ?? 0)
  }, 0)
}

/** F2 (fatia F, CAÇA): por que o Evoluir não vale sem o selo da passiva pedida (posto pelo dono, na opção principal), ou `null`. */
export function motivoDoEvoluirPelaMecanica(cartaoId: string, selos: readonly Pick<SeloDaBatalha, 'cartaoId' | 'donoId' | 'opcao'>[] | undefined, donoPersonagemId: string): string | null {
  const pede = mecanicaDoCartao(cartaoId)?.evoluirPede
  if (pede === undefined) return null
  const ligada = (selos ?? []).some((selo) => selo.cartaoId === pede.cartaoId && selo.donoId === donoPersonagemId && selo.opcao === undefined)
  return ligada ? null : pede.motivo
}

/** F2 (fatia F, Chamas Celestes): o custo pela porcentagem do máximo (para baixo); `null` = vale o texto da ficha. */
export function custoPeloMaximo(cartaoId: string, maximos: Readonly<Record<string, number>> | undefined): { recurso: 'sp' | 'hp'; valor: number } | null {
  const regra = mecanicaDoCartao(cartaoId)?.custoDoMaximo
  const maximo = regra === undefined ? undefined : maximos?.[regra.recurso]
  if (regra === undefined || maximo === undefined) return null
  return { recurso: regra.recurso, valor: Math.floor((maximo * regra.porcento) / 100) }
}

/** F2 (fatia F): a porcentagem de um máximo, para baixo (3% de 900 = 27). */
export function porcentoDoMaximo(maximo: number, porcento: number): number {
  return Math.max(0, Math.floor((maximo * porcento) / 100))
}

/** F2 (fatia F, Doença das Trevas): a porcentagem do HP máximo que o dono perde no fim da vez em que agiu; `null` = nenhuma. */
export function perdaNoFimDaVez(chaves: readonly string[]): { cartaoId: string; hpPorcento: number } | null {
  for (const chave of chaves) {
    const perde = mecanicaDoCartao(chave)?.perdeNoFimDaVez
    if (perde !== undefined) return { cartaoId: chave, hpPorcento: perde.hpPorcento }
  }
  return null
}
