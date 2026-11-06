import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { Json } from './json'

/**
 * FORMATO DO LOBBY — a única fonte da operação e das mensagens
 * (docs/planos/lobby-jogadores-2026-11-05.md §4.6 e §5.4). Puro: o app, o
 * site e o Worker importam daqui. Só tipos e a versão do formato.
 *
 * Toda mudança de ficha é PEQUENA, por campo (`caminho`, tabela 4.7 em
 * `caminho.ts`), nunca a ficha inteira: campos diferentes nunca brigam, e o
 * mesmo campo mudado quase junto por outra pessoa ou outro aparelho vira
 * conflito com as duas escolhas.
 */

/** Sobe quando o formato da op ou das mensagens muda; o Worker aceita a atual e a anterior (§5.6). */
export const VERSAO_DO_FORMATO = 1

/**
 * `definir` põe o valor no campo; sem `valor`, TIRA a chave (é o que o
 * desfazer de um campo que não existia precisa; em `quantidade` e `moedas`,
 * volta ao ausente, que vale 1 e 0). `somar` soma `delta`
 * (quantidade de item e moedas). `criar`/`apagar` põem e tiram cartão, item,
 * etiqueta e a ficha inteira. `ordenar` troca a ordem dos cartões.
 */
export type Acao = 'definir' | 'somar' | 'criar' | 'apagar' | 'ordenar'

export type Papel = 'mestre' | 'jogador'

/** De onde a mudança veio: o app do mestre, o site ou a mesa LAN (atestada pelo app). */
export type Origem = 'app' | 'site' | 'mesa'

/** Quem pode ver a ficha publicada (§3.2, §6.4). */
export type Visibilidade = 'mesa' | 'treino' | 'mestre'

/** O `contaId` do mestre em `membros` (§4.5). O Service Token do app também vira ele (§6.2). */
export const CONTA_DO_MESTRE = 'mestre'

/**
 * A mudança em si: que ficha, que campo, o quê. É o que `diferencas`
 * devolve e o que `aplicar` recebe; a `Op` acrescenta o envelope.
 */
export interface Mudanca {
  fichaId: string
  caminho: string[]
  acao: Acao
  valor?: Json
  delta?: number
  /**
   * Tudo ou nada com as outras `atomico` seguidas do mesmo lote: se uma não
   * entra, nenhuma entra. Só em troca e pagamento de itens e na ficha trocada
   * inteira (apagar + criar de `[]`), que nunca pode ficar só apagada.
   */
  atomico?: true
}

export interface Op extends Mudanca {
  /** Uuid do cliente: reenviar com o mesmo `opId` nunca grava duas vezes. */
  opId: string
  /** As ops geradas no mesmo instante. */
  loteId: string
  /** A rev de onde saiu a BASE que o autor viu (não a rev de agora). */
  baseRev: number
  /** Uma por instalação do app, ou por navegador + conta. */
  clienteId: string
  /** Hora do aparelho: só para mostrar. */
  quandoCliente: number
  /** O `opId` que esta op desfaz. */
  desfaz?: string
  /** O `opId` recusado que esta op resolve ("Usar a minha"). */
  resolve?: string
  /** Só aceito com a identidade do app (mesa LAN): o contaId de quem mexeu na sala. */
  autorDeclarado?: string
}

export interface OpGravada extends Op {
  /** Numeração da campanha, crescente e sem buraco. */
  rev: number
  /** O valor no caminho antes da op; ausente = o campo não existia. */
  antes?: Json
  autorContaId: string
  autorNome: string
  origem: Origem
  atestadoPeloApp: boolean
  /** Hora do servidor. */
  quando: number
}

/**
 * Por que o servidor recusou a op para sempre (repetir não adianta, §5.4).
 * O cliente guarda a op negada até alguém decidir: ela nunca some em silêncio.
 */
export type MotivoNegado =
  | 'fora-do-esquema'
  | 'sem-permissao'
  | 'acima-do-teto'
  | 'midia'
  | 'doc-grande'
  | 'base-invalida'
  | 'versao'
  /** O cartão, a vaga ou a ficha que a op muda não existe mais, e ninguém de outra autoria mexeu nela depois da base. */
  | 'alvo-inexistente'
  /** Desfazer que não tem o que fazer: já desfeita, a op não mudou nada, ou o campo já está como ela deixaria ("já foi tirado"). */
  | 'nada-a-desfazer'

/** Recusa local de `aplicar`: o esquema, ou o alvo que não existe mais (cartão, vaga ou ficha apagados). Vai ao autor como `negado`. */
export type MotivoDaRecusa = MotivoNegado

/** Recusa temporária: a op fica na fila e vai de novo sozinha, com o mesmo `opId`. Não é violação. */
export type MotivoAdiado = 'cota' | 'ritmo'

/** Quem está entrando ou mexendo (o portão monta, §6.2). */
export interface Identidade {
  email: string
  contaId: string
  nome: string
  papel: Papel
  origem: Origem
  clienteId: string
}

/** Membro como o jogador o vê: sem e-mail (§6.4). */
export interface MembroProjetado {
  contaId: string
  nome: string
  papel: Papel
}

/** Linha de `membros` no DO (§4.5). Removido = negado já na mensagem seguinte (§6.4). */
export interface Membro extends MembroProjetado {
  email: string
  estado: 'ativo' | 'removido'
}

/**
 * Linha de `fichas` no DO (§4.5): o doc COMPLETO, com os campos do mestre (a
 * projeção tira na saída, §6.4). Apagada guarda o último doc: o dono continua
 * conhecido para a permissão e o "recriar" do conflito.
 */
export interface FichaGuardada {
  doc: Personagem
  apagada: boolean
  visivel: Visibilidade
  /** A rev da última op gravada nesta ficha. */
  rev: number
}

/**
 * Linha de `recusadas` (§4.5): só conflito. Guarda a resposta dada, para o
 * reenvio com o mesmo `opId` receber a mesma, e o autor efetivo, para o
 * `resolve` só citar recusada do mesmo autor (§5.3).
 */
export interface Recusada {
  opId: string
  op: Op
  autorContaId: string
  resposta: Conflito
  quando: number
}

/** Uma ficha no `estado`: para o jogador, já projetada (sem os campos do mestre, §6.4). */
export interface FichaNoEstado {
  doc: Personagem
  visivel: Visibilidade
  rev: number
  /** Fora do doc: a ficha é de uma conta de quem recebe (o site sabe o que pode editar). */
  ehMinha: boolean
  /** Nome da conta dona; `null` = ficha sem dono (só o mestre edita). */
  nomeDoDono: string | null
}

/**
 * "Na mesa agora" (protótipo aprovado, docs/design/lobby/prototipo.html): quem
 * está com a campanha aberta neste momento. O servidor é da fatia W1.
 */
export interface PresencaNaMesa {
  contaId: string
  nome: string
  papel: Papel
  onde: 'site' | 'app'
}

/** "O mestre acabou de mudar Vida para 25. Você pôs 28." (§5.2) */
export interface Conflito {
  opId: string
  /** O valor que está gravado agora; ausente = o campo não existe mais. */
  valorAtual?: Json
  /** Nome de quem mudou por último. */
  quem: string
  quando: number
  revAtual: number
  /** A ficha foi apagada: a escolha é "recriar". */
  fichaApagada?: true
  /** Tudo ou nada (`atomico`): esta op não bateu, mas vai junto com a `opId` que bateu. */
  porCausaDe?: string
}

export type MensagemDoCliente =
  | { t: 'ola'; desdeRev: number | null; v: number; clienteId: string }
  | { t: 'ops'; lote: Op[] }
  | { t: 'desfazer'; opId: string; novoOpId: string; confirmar?: true }
  | { t: 'historico'; fichaId: string; antesDeRev?: number; limite: number }

/**
 * A base inteira (§5.4). `sistema` (F1) é o sistema que o publicar gravou,
 * como o jogador o vê (`sistemaParaOJogador`: sem o livro e os catálogos): o
 * site lê dele os nomes, as abas, os recursos e os atributos. Ausente = DO de
 * antes da F1, ou sistema guardado que este código não lê; o site cai no One
 * Piece. O campo é opcional: o site de antes o ignora, e o formato não muda.
 */
export interface EstadoDaBase {
  t: 'estado'
  rev: number
  fichas: FichaNoEstado[]
  membros: MembroProjetado[]
  eu: MembroProjetado
  sistema?: SistemaDeRpg
}

export type MensagemDoServidor =
  | EstadoDaBase
  | { t: 'ops'; desde: number; ate: number; lista: OpGravada[] }
  | { t: 'ack'; opId: string; rev: number }
  | ({ t: 'conflito' } & Conflito)
  | { t: 'negado'; opId: string; motivo: MotivoNegado; detalhe?: string }
  | { t: 'adiado'; opId: string; motivo: MotivoAdiado; tentarDepoisDe: number }
  | { t: 'aplicada'; op: OpGravada }
  | { t: 'historico'; fichaId: string; lista: OpGravada[]; temMaisAntigas: boolean }
  | { t: 'versao'; versaoDoFormato: number }
  | { t: 'presenca'; naMesa: PresencaNaMesa[] }
