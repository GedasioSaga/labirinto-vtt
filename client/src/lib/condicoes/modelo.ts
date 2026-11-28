import type { CorteDoAnula, ExcecaoDoAnula } from '../batalha/anulaODano'
import type { GatilhoDaCondicao } from '../itens/modelo'

/**
 * O MODELO DA CONDIÇÃO MONTADA COM PEÇAS (rework das condições, docs/design/condicoes-rework/PLANO.md §2,
 * etapa E1). Uma condição, um lugar: a regra mora só na condição (o tipo, as peças, o prazo e as
 * saídas); quem a põe (técnica, item, forma, mestre) escolhe só qual e por quantos turnos.
 *
 * Tudo aqui é ADITIVO: a `CondicaoPropria` de antes (`types/map.ts`) continua válida. Sem `pecas`, a
 * leitura monta as peças da `regra`, do `n` e do `gatilho` de antes (`montadaDaAntiga.ts`), sem gravar.
 * As chaves são as do `pecaNova` e do `saidaNova` do protótipo (prototipo.html:575-600), guardando só o
 * que difere do padrão: a marca opcional `true` (`direto`, `rouba`, `espalha`) e o campo do Dano e cura
 * só quando ligado; ausente = desligado.
 *
 * Folha pura: só tipos de fora (sem store, sem Tauri, sem `lib/batalha/condicoes.ts`). O Worker do Lobby
 * a embute pelo motor da batalha.
 *
 * API pública (estável para E2 a E7): `TipoDeDano`, `TipoDoGolpe`, `TIPOS_DE_DANO`, `NOMES_DOS_TIPOS_DE_DANO`,
 * `TipoDaCondicao`, `TIPO_PADRAO_DA_CONDICAO`, `FamiliaDaPecaDaCondicao`, `FAMILIAS_DA_CONDICAO`,
 * `BloqueioDaCondicao`, `BLOQUEIOS_DA_CONDICAO`, `PecaDaCondicao`, `PecaDaCondicaoDa`, `EfeitoNaVez`,
 * `ModoDoPrazo`, `DeNovoDaCondicao`, `PrazoDaCondicao`, `PRAZO_PADRAO`, `TETO_DE_PILHAS_PADRAO`,
 * `SaidaDaCondicao`, `TipoDaSaida`, `TIPOS_DE_SAIDA`, `CondicaoMontada`, os tetos (`*_MAX`, `*_MIN`),
 * `chaveDaCondicao`, `ehIdDeCondicao`, `turnosDoPrazo`, `tetoDePilhasDo`.
 */

// ─── Tipos de dano ─────────────────────────────────────────────────────────

/** De que tipo é um dano: o do golpe (arma, Pergunta, Imbuir) e o que a condição agrava ou a tira. `qualquer` = todo dano. */
export type TipoDeDano = 'qualquer' | 'impacto' | 'cortante' | 'perfurante' | 'fogo' | 'gelo' | 'eletricidade' | 'veneno' | 'luz' | 'trevas' | 'vento'

/** O tipo que um golpe carrega (`GolpeDaBatalha.tipos`): todo tipo menos o "qualquer". Golpe sem tipo conta como qualquer. */
export type TipoDoGolpe = Exclude<TipoDeDano, 'qualquer'>

/** Os tipos na ordem da tela (`TIPOS_DE_DANO` do protótipo). */
export const TIPOS_DE_DANO: readonly TipoDeDano[] = ['qualquer', 'impacto', 'cortante', 'perfurante', 'fogo', 'gelo', 'eletricidade', 'veneno', 'luz', 'trevas', 'vento']

/** O nome de cada tipo na frase ("de Fogo"); o "qualquer" some da frase (`deTipo` em `frasesDaCondicao.ts`). */
export const NOMES_DOS_TIPOS_DE_DANO: Readonly<Record<TipoDeDano, string>> = {
  qualquer: 'qualquer tipo',
  impacto: 'Impacto',
  cortante: 'Cortante',
  perfurante: 'Perfurante',
  fogo: 'Fogo',
  gelo: 'Gelo',
  eletricidade: 'Eletricidade',
  veneno: 'Veneno',
  luz: 'Luz',
  trevas: 'Trevas',
  vento: 'Vento',
}

// ─── A condição ────────────────────────────────────────────────────────────

/** Negativa (prejudica) ou positiva (ajuda). Não muda regra nenhuma: separa a lista e o "Tira condições" (só as negativas). */
export type TipoDaCondicao = 'negativa' | 'positiva'

/** Ausente = negativa, como toda condição de antes deste campo. */
export const TIPO_PADRAO_DA_CONDICAO: TipoDaCondicao = 'negativa'

/** As 8 famílias de peça (`PECAS` do protótipo) e a Intangível (`anula`, pedido de 27/11/2026). */
export type FamiliaDaPecaDaCondicao = 'vez' | 'atributo' | 'bloqueio' | 'danoCura' | 'anula' | 'gatilho' | 'marca' | 'aura' | 'contra'

/** As famílias na ordem da tela (`ORDEM_DAS_PECAS` do protótipo; a Intangível ao lado do Dano e cura). */
export const FAMILIAS_DA_CONDICAO: readonly FamiliaDaPecaDaCondicao[] = ['vez', 'atributo', 'bloqueio', 'danoCura', 'anula', 'gatilho', 'marca', 'aura', 'contra']

/** O que quem está com a condição não pode fazer (`BLOQUEIOS` do protótipo). */
export type BloqueioDaCondicao = 'perdeVez' | 'naoReage' | 'reageDesv' | 'naoDesvia' | 'naoMove' | 'naoTecnica' | 'soSimples' | 'naoAlvo'

/** Os bloqueios na ordem da tela e da frase. */
export const BLOQUEIOS_DA_CONDICAO: readonly BloqueioDaCondicao[] = ['perdeVez', 'naoReage', 'reageDesv', 'naoDesvia', 'naoMove', 'naoTecnica', 'soSimples', 'naoAlvo']

/**
 * Uma peça da condição. Os números são sempre positivos: o verbo (`faz`) diz o sentido. Só o Dano e
 * cura guarda número com sinal (−20 = toma 20% a menos), cada campo ausente = aquele corte desligado.
 *  - `vez`: ao entrar, no começo ou no fim de cada vez de quem tem, tira ou dá `v` de vida, SP ou
 *    Escudo (fixo, ou % da máxima ou da atual); `direto` = a vida tirada passa do Escudo; `rouba` = quem
 *    pôs a condição ganha o mesmo.
 *  - `atributo`: tira, soma, prende (`fica`) ou limita (`maximo`) um atributo (o id do sistema, ou
 *    `velocidade`, `ca`, `dano`, `alcance`); de uma vez, a cada turno (`cada`) ou a partir do turno
 *    `aPartirN`; `tetoN` = o total que a soma não passa (ausente = sem teto).
 *  - `bloqueio`: os bloqueios ligados (só os `true` ficam gravados).
 *  - `danoCura`: dano recebido % (`recV`, só do `recTipo`; ausente = qualquer), dano causado %
 *    (`cauV`), cura recebida % (`curaV`) e cura de % do dano causado (`cddV`).
 *  - `gatilho`: o "Depois de X turnos" da 0.6.4, igual (`GatilhoDaCondicao`, lib/itens/modelo.ts).
 *  - `marca`: o próximo golpe nele dá `mult` vezes o dano (de todos, ou só de quem pôs); `sai` = a
 *    marca sai com esse golpe; `desvDesv` = quem tem desvia com desvantagem.
 *  - `aura`: quem estiver a até `casas` casas (aliados, inimigos ou todos) pega `cond` (o id de uma
 *    condição do catálogo, ou `esta`) enquanto ficar perto; `espalha` = quem pegou passa adiante.
 *  - `contra`: ao entrar, apaga as condições `apaga` (ids do catálogo); `impede` = enquanto durar, elas
 *    não pegam nele.
 *  - `anula` (Intangível, pedido de 27/11/2026): quem tem toma 0 de dano do golpe, a não ser que o golpe
 *    tenha `exceto` (um tipo ou um nome, como Haki); a mesma regra da peça Dispara sozinha
 *    (lib/batalha/anulaODano.ts).
 */
export type PecaDaCondicao =
  | { tipo: 'vez'; quando: 'entrar' | 'comeco' | 'fim'; faz: 'tira' | 'da'; v: number; conta: 'fixo' | 'pctMax' | 'pctAtual'; recurso: 'vida' | 'sp' | 'escudo'; direto?: true; rouba?: true }
  | { tipo: 'atributo'; atr: string; faz: 'tira' | 'soma' | 'fica' | 'maximo'; v: number; conta: 'fixo' | 'pct'; ritmo: 'umaVez' | 'cada' | 'aPartir'; aPartirN?: number; tetoN?: number }
  | { tipo: 'bloqueio'; itens: Readonly<Partial<Record<BloqueioDaCondicao, true>>> }
  | { tipo: 'danoCura'; recV?: number; recTipo?: TipoDeDano; cauV?: number; curaV?: number; cddV?: number }
  | { tipo: 'gatilho'; gatilho: GatilhoDaCondicao }
  | { tipo: 'marca'; mult: number; quem: 'todos' | 'quemPos'; sai: boolean; desvDesv: boolean }
  | { tipo: 'aura'; casas: number; quem: 'aliados' | 'inimigos' | 'todos'; cond: string; espalha?: true }
  | { tipo: 'contra'; apaga: readonly string[]; impede: boolean }
  | { tipo: 'anula'; exceto?: ExcecaoDoAnula; corte?: CorteDoAnula }

/** A peça de uma família ("a peça `vez`"). */
export type PecaDaCondicaoDa<F extends FamiliaDaPecaDaCondicao> = Extract<PecaDaCondicao, { tipo: F }>

/** O Efeito na vez sem o `tipo`: o que a tradução congela no selo (`RegrasDoSelo.vez`) quando o motor de hoje não o faz. */
export type EfeitoNaVez = Omit<PecaDaCondicaoDa<'vez'>, 'tipo'>

/** O valor de `aura.cond` que quer dizer "esta mesma condição". */
export const AURA_DESTA_MESMA = 'esta'

/** Quanto a condição dura. */
export type ModoDoPrazo = 'turnos' | 'proximoGolpe' | 'ateTirar' | 'batalha'

/** Se quem tem ganha a mesma condição de novo: o prazo recomeça, soma uma pilha, ou nada muda (não valem juntos). */
export type DeNovoDaCondicao = 'renova' | 'pilha' | 'nada'

/**
 * Prazo, pilhas e saída (a seção fixa, não peça). `n` = os turnos no modo `turnos` (ausente = 3);
 * `teto` = o teto de pilhas no `pilha` (ausente = 3). Os dois ficam gravados mesmo fora do modo deles,
 * para o número voltar quando o mestre volta ao modo.
 */
export interface PrazoDaCondicao {
  modo: ModoDoPrazo
  n?: number
  deNovo: DeNovoDaCondicao
  teto?: number
}

/** Os turnos de partida de uma condição sem prazo próprio. */
export const TURNOS_PADRAO_DA_CONDICAO = 3
/** O teto de pilhas de partida. */
export const TETO_DE_PILHAS_PADRAO = 3

/** Sem `prazo`: 3 turnos e "o prazo recomeça", o `porCondicao` de hoje (lib/condicoes/naFicha.ts). */
export const PRAZO_PADRAO: PrazoDaCondicao = { modo: 'turnos', n: TURNOS_PADRAO_DA_CONDICAO, deNovo: 'renova' }

/**
 * Um jeito de sair antes do prazo (basta um):
 *  - `teste`: no fim de cada vez dele, d20 + mod do atributo `atr` contra a CD;
 *  - `pagar`: na vez dele, "Tentar sair": só pagar, só o teste, pagar E o teste, ou pagar OU o teste
 *    (quem tem como pagar paga; quem não tem, rola); paga SP, vida (os dois com `v`) ou a ação simples;
 *  - `cura`: ao receber qualquer cura; `dano`: ao tomar dano do tipo; `agir`: ao atacar ou usar técnica.
 */
export type SaidaDaCondicao =
  | { tipo: 'teste'; atr: string; cd: number }
  | { tipo: 'pagar'; como: 'pagar' | 'teste' | 'e' | 'ou'; paga: 'sp' | 'vida' | 'acao'; v?: number; atr?: string; cd?: number }
  | { tipo: 'cura' }
  | { tipo: 'dano'; dano: TipoDeDano }
  | { tipo: 'agir' }

export type TipoDaSaida = SaidaDaCondicao['tipo']

/** As saídas na ordem da tela (`SAIDAS` do protótipo). */
export const TIPOS_DE_SAIDA: readonly TipoDaSaida[] = ['teste', 'pagar', 'cura', 'dano', 'agir']

// ─── As escolhas de cada campo (a ordem da tela; o leitor aceita só estas) ───

type PecaDaVez = PecaDaCondicaoDa<'vez'>
type PecaDoAtributo = PecaDaCondicaoDa<'atributo'>
type SaidaPagando = Extract<SaidaDaCondicao, { tipo: 'pagar' }>

export const TIPOS_DA_CONDICAO: readonly TipoDaCondicao[] = ['negativa', 'positiva']
export const QUANDO_DA_VEZ: readonly PecaDaVez['quando'][] = ['entrar', 'comeco', 'fim']
export const FAZ_DA_VEZ: readonly PecaDaVez['faz'][] = ['tira', 'da']
export const CONTA_DA_VEZ: readonly PecaDaVez['conta'][] = ['fixo', 'pctMax', 'pctAtual']
export const RECURSOS_DA_VEZ: readonly PecaDaVez['recurso'][] = ['vida', 'sp', 'escudo']
export const FAZ_DO_ATRIBUTO: readonly PecaDoAtributo['faz'][] = ['tira', 'soma', 'fica', 'maximo']
export const CONTA_DO_ATRIBUTO: readonly PecaDoAtributo['conta'][] = ['fixo', 'pct']
export const RITMOS_DO_ATRIBUTO: readonly PecaDoAtributo['ritmo'][] = ['umaVez', 'cada', 'aPartir']
export const QUEM_DA_MARCA: readonly PecaDaCondicaoDa<'marca'>['quem'][] = ['todos', 'quemPos']
export const QUEM_DA_AURA: readonly PecaDaCondicaoDa<'aura'>['quem'][] = ['aliados', 'inimigos', 'todos']
export const MODOS_DO_PRAZO: readonly ModoDoPrazo[] = ['turnos', 'proximoGolpe', 'ateTirar', 'batalha']
export const DE_NOVO_DA_CONDICAO: readonly DeNovoDaCondicao[] = ['renova', 'pilha', 'nada']
export const COMO_SE_PAGA: readonly SaidaPagando['como'][] = ['pagar', 'teste', 'e', 'ou']
export const O_QUE_SE_PAGA: readonly SaidaPagando['paga'][] = ['sp', 'vida', 'acao']

/**
 * A condição já com os padrões: o que as frases, a tradução e o boneco leem. A de fábrica é assim de
 * nascença (`fabrica.ts`); a criada passa por `montarCondicao` (`montadaDaAntiga.ts`). Só leitura: nunca
 * é o que se grava (quem grava guarda a `CondicaoPropria` como o mestre a deixou).
 */
export interface CondicaoMontada {
  id: string
  nome: string
  tipo: TipoDaCondicao
  pecas: readonly PecaDaCondicao[]
  prazo: PrazoDaCondicao
  saidas: readonly SaidaDaCondicao[]
}

// ─── Tetos ─────────────────────────────────────────────────────────────────

/** Peças numa condição. */
export const PECAS_DA_CONDICAO_MAX = 10
/** Peças Muda atributo numa condição: cada uma vira um mod do selo (`MODS_POR_SELO_MAX`, lib/batalha/combate.ts). */
export const ATRIBUTOS_DA_CONDICAO_MAX = 4
/** Saídas numa condição. */
export const SAIDAS_DA_CONDICAO_MAX = 4
/** Turnos do prazo (o campo do protótipo vai de 1 a 20). */
export const TURNOS_DO_PRAZO_MAX = 20
/** Pilhas: de 2 a 10. */
export const PILHAS_MIN = 2
export const PILHAS_MAX = 10
/** Número fixo do Efeito na vez (vida, SP ou Escudo): o mesmo teto da regra `vida` de antes (`N_DA_VIDA_MAX`). */
export const VALOR_DA_VEZ_MAX = 999
/** Número de atributo (o valor, o "fica em", o "no máximo" e o teto). */
export const VALOR_DO_ATRIBUTO_MAX = 999
/** Porcentagem de uma vez (Efeito na vez e Muda atributo em %). */
export const PORCENTO_MAX = 100
/** O "a partir do turno N". */
export const A_PARTIR_DO_TURNO_MAX = TURNOS_DO_PRAZO_MAX
/** O N do "a partir do turno N" sem número gravado (o `aPartirN` de partida do protótipo). */
export const A_PARTIR_DO_TURNO_PADRAO = 2
/** Dano recebido, dano causado e cura recebida, em %: de −100 (nada) a +300. */
export const PORCENTO_DO_DANO_MIN = -100
export const PORCENTO_DO_DANO_MAX = 300
/** Multiplicador da Marca: de 2 a 5 (`SeloDaBatalha.marcaVezes`). */
export const MULT_DA_MARCA_MIN = 2
export const MULT_DA_MARCA_MAX = 5
/** Casas da Aura (o campo do protótipo vai de 1 a 6). */
export const CASAS_DA_AURA_MAX = 6
/** Condições que uma Contra-condição apaga. */
export const APAGA_MAX = 10
/** CD dos testes de saída. */
export const CD_MIN = 5
export const CD_MAX = 30
/** O que se paga para sair (SP ou vida). */
export const PAGA_MAX = 9999
/** O texto do "Confira" de uma condição lida torta. */
export const CONFIRA_DA_CONDICAO_MAX = 300

// ─── Chaves e ids ──────────────────────────────────────────────────────────

/**
 * A chave de um nome: sem acento, sem caixa, espaços enxugados. "Caído", " caido " e "CAIDO" são a
 * mesma condição. Chave de chave é ela mesma. Mora aqui (e `lib/condicaoPorNome.ts` a reexporta) para a
 * fábrica achar pelo nome sem ciclo de import.
 */
export function chaveDaCondicao(nome: string): string {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
}

const ID_DE_CONDICAO = /^[\w-]{1,64}$/

/** Um id de condição do catálogo (`cond_<uuid>` da criada, `queimando` da de fábrica). */
export function ehIdDeCondicao(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_DE_CONDICAO.test(valor)
}

// ─── Leitura dos padrões ───────────────────────────────────────────────────

/** Os turnos do prazo no modo `turnos` (ausente = 3); `null` nos outros modos (até o golpe, até tirarem, a batalha toda). */
export function turnosDoPrazo(prazo: PrazoDaCondicao): number | null {
  return prazo.modo === 'turnos' ? (prazo.n ?? TURNOS_PADRAO_DA_CONDICAO) : null
}

/** Quantas pilhas a condição junta: o teto no `pilha` (ausente = 3), 1 nos outros (não soma). */
export function tetoDePilhasDo(prazo: PrazoDaCondicao): number {
  return prazo.deNovo === 'pilha' ? (prazo.teto ?? TETO_DE_PILHAS_PADRAO) : 1
}
