/**
 * MODO BATALHA (fatia B5): a abertura e o nome que o mestre escolheu da última
 * vez, lembrados POR AVENTURA neste aparelho (mapa solto divide uma chave só).
 * Preferência do mestre, não da mesa: não vai ao arquivo nem aos jogadores.
 */

/**
 * O nome com que o campo abre numa aventura sem escolha guardada (pedido do
 * mestre: "o nome royals aparecendo"). Só o valor inicial: o mestre que apaga
 * fica sem nome na abertura, e o vazio fica lembrado como vazio (pedido de
 * 28/10/2026: "quero a opção de não precisar colocar o nome").
 */
export const NOME_PADRAO_DA_BATALHA = 'Royals'
/** Teto do nome no campo; o fio aceita até `BATALHA_TEXTO_MAX` (net/protocol.ts). */
export const NOME_DA_BATALHA_MAX = 24

const PREFIXO = 'lb-batalha:abertura:'
/** A chave de quem abre um mapa sem aventura. */
const SEM_AVENTURA = '-'

export interface AberturaLembrada {
  /** Id da abertura; `null` = "Nenhuma" (sem animação). */
  transicao: string | null
  texto: string
}

export type ArmazemDaAbertura = Pick<Storage, 'getItem' | 'setItem'>

export function chaveDaAberturaLembrada(aventuraId: string | null): string {
  return PREFIXO + (aventuraId ?? SEM_AVENTURA)
}

/**
 * O nome que vai no aviso: aparado, cortado no teto. Vazio = `undefined`, e o
 * aviso sai sem `texto`, que a cena lê como "sem nome". Não manda `texto: ''`:
 * `lerBatalhaIniciada` recusa texto vazio e derrubaria o aviso inteiro.
 */
export function nomeParaOFio(texto: string): string | undefined {
  const limpo = texto.replace(/[\r\n]+/g, ' ').trim().slice(0, NOME_DA_BATALHA_MAX)
  return limpo.length === 0 ? undefined : limpo
}

/** Lida do aparelho; nada guardado, guardado torto ou armazenamento bloqueado = `null`. */
export function lerAberturaLembrada(armazem: ArmazemDaAbertura | null, aventuraId: string | null): AberturaLembrada | null {
  if (armazem === null) return null
  try {
    const bruto = armazem.getItem(chaveDaAberturaLembrada(aventuraId))
    if (bruto === null) return null
    const lido: unknown = JSON.parse(bruto)
    if (typeof lido !== 'object' || lido === null) return null
    const transicao: unknown = Reflect.get(lido, 'transicao')
    const texto: unknown = Reflect.get(lido, 'texto')
    if (transicao !== null && typeof transicao !== 'string') return null
    if (typeof texto !== 'string') return null
    return { transicao, texto: texto.slice(0, NOME_DA_BATALHA_MAX) }
  } catch {
    return null
  }
}

/** Guarda para a próxima batalha da aventura. Sem armazenamento, vale só nesta vez. */
export function gravarAberturaLembrada(armazem: ArmazemDaAbertura | null, aventuraId: string | null, escolha: AberturaLembrada): void {
  if (armazem === null) return
  try {
    armazem.setItem(chaveDaAberturaLembrada(aventuraId), JSON.stringify(escolha))
  } catch {
    // Armazenamento cheio ou bloqueado: a escolha vale só nesta batalha.
  }
}

/**
 * A escolha com que o diálogo abre: a lembrada, se a abertura ainda existe no
 * app; senão a primeira da lista (a ordem do pacote, por nome de arquivo: a
 * Bandeira da Marinha vem antes das Espadas), senão "Nenhuma". O nome
 * lembrado vale mesmo vazio (`''` = sem nome); só sem nada guardado é "Royals".
 */
export function escolhaInicial(lembrada: AberturaLembrada | null, idsDisponiveis: readonly string[]): AberturaLembrada {
  const texto = lembrada?.texto ?? NOME_PADRAO_DA_BATALHA
  if (lembrada !== null && (lembrada.transicao === null || idsDisponiveis.includes(lembrada.transicao))) return { transicao: lembrada.transicao, texto }
  return { transicao: idsDisponiveis[0] ?? null, texto }
}
