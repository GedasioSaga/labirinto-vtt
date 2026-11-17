import { ancestraisDe, arvoreDe, semAcento, type NoDaArvore } from './enciclopedia'
import { estaNaLixeira } from './lixeira'
import type { Verbete } from './tipos'

/**
 * OS LUGARES EM REGIÕES (pedido de 16/11, 21h25): a lista de Lugares com a cara
 * aprovada de Personagens, mas organizada pela hierarquia que os lugares já têm
 * (`paiId`: região > lugar > cômodo) em vez de pastas.
 *
 * - Região = lugar de cima que tem lugares dentro. Lugar de cima sem nada
 *   dentro fica em "Sem região".
 * - A ordem é a da árvore (`arvoreDe`): o pai antes dos de dentro, irmãs em
 *   A–Z. Assim "Castelo" e os cômodos dele ficam juntos na grade.
 * - Mudar o pai nunca cria laço: um lugar não vai para dentro dele mesmo nem
 *   de algo que já está dentro dele.
 * - O lugar na Lixeira (`lixeira.ts`) não entra: quem chama passa só os vivos,
 *   e nada vai para dentro de um lugar excluído.
 *
 * Nada aqui grava: a tela muda o verbete pela loja do Prelúdio (`mudarVerbete`),
 * que grava sozinha. O arquivo continua o mesmo de antes (o `paiId` já existia).
 */

/** Um lugar com lugares dentro, na barra das regiões (ordem de árvore). */
export interface RegiaoNaBarra {
  readonly id: string
  readonly nome: string
  /** O lugar de cima dela na barra; ausente = região de cima. */
  readonly paiId?: string
  readonly nivel: number
}

export interface LugaresOrganizados {
  /** Todos, na ordem da árvore. */
  readonly emOrdem: readonly Verbete[]
  /** A região (lugar de cima) de cada lugar; o de cima aponta para ele mesmo. */
  readonly raizDe: ReadonlyMap<string, string>
  /** Os ids logo dentro de cada lugar, na ordem da árvore. */
  readonly filhosDe: ReadonlyMap<string, readonly string[]>
  /** Os nomes acima de cada lugar, da região ao pai direto ("Reino de Goa", "Castelo"). */
  readonly caminhoDe: ReadonlyMap<string, readonly string[]>
  /** Quantos lugares há dentro, em todos os níveis. */
  readonly dentroDe: ReadonlyMap<string, number>
  /** Os lugares que têm lugares dentro, para a barra lateral. */
  readonly regioes: readonly RegiaoNaBarra[]
}

const SEM_NOME = 'Sem nome'

/**
 * Organiza os lugares dados (os da campanha escolhida). Quem aponta para um pai
 * fora da lista (de outra campanha, apagado) ou está num laço feito à mão vira
 * lugar de cima, como na árvore de antes.
 */
export function organizarLugares(lugares: readonly Verbete[]): LugaresOrganizados {
  const emOrdem: Verbete[] = []
  const raizDe = new Map<string, string>()
  const filhosDe = new Map<string, string[]>()
  const caminhoDe = new Map<string, readonly string[]>()
  const dentroDe = new Map<string, number>()
  const regioes: RegiaoNaBarra[] = []

  const andar = (no: NoDaArvore, raiz: string, caminho: readonly string[], nivel: number, paiId: string | undefined): number => {
    const { verbete } = no
    emOrdem.push(verbete)
    raizDe.set(verbete.id, raiz)
    caminhoDe.set(verbete.id, caminho)
    filhosDe.set(
      verbete.id,
      no.filhos.map((filho) => filho.verbete.id),
    )
    if (no.filhos.length > 0) regioes.push(paiId === undefined ? { id: verbete.id, nome: verbete.titulo || SEM_NOME, nivel } : { id: verbete.id, nome: verbete.titulo || SEM_NOME, paiId, nivel })
    const abaixo = [...caminho, verbete.titulo || SEM_NOME]
    let total = 0
    for (const filho of no.filhos) total += 1 + andar(filho, raiz, abaixo, nivel + 1, verbete.id)
    dentroDe.set(verbete.id, total)
    return total
  }
  for (const raiz of arvoreDe(lugares)) andar(raiz, raiz.verbete.id, [], 0, undefined)
  return { emOrdem, raizDe, filhosDe, caminhoDe, dentroDe, regioes }
}

/** O lugar e todos os de dentro dele, na ordem da árvore. */
export function lugarEDeDentro(organizados: LugaresOrganizados, id: string): string[] {
  const saida: string[] = []
  const pilha = [id]
  const vistos = new Set<string>()
  while (pilha.length > 0) {
    const atual = pilha.shift()
    if (atual === undefined || vistos.has(atual)) continue
    vistos.add(atual)
    saida.push(atual)
    pilha.unshift(...(organizados.filhosDe.get(atual) ?? []))
  }
  return saida
}

export type MotivoDaRecusa = 'ele-mesmo' | 'dentro-dele' | 'nao-e-lugar'

/**
 * Por que `lugar` não pode ir para dentro de `novoPaiId` (`null` = para fora de
 * tudo, que sempre pode). Confere com TODOS os lugares, não só os da campanha
 * na tela: um laço por um lugar escondido continua laço.
 */
export function motivoParaNaoMudarDePai(lugar: Verbete, novoPaiId: string | null, porId: ReadonlyMap<string, Verbete>): MotivoDaRecusa | null {
  if (novoPaiId === null) return null
  if (novoPaiId === lugar.id) return 'ele-mesmo'
  const pai = porId.get(novoPaiId)
  if (pai === undefined || pai.tipo !== 'lugar' || estaNaLixeira(pai)) return 'nao-e-lugar'
  return ancestraisDe(pai, porId).some((acima) => acima.id === lugar.id) ? 'dentro-dele' : null
}

/** O que impede um lugar de mudar: a hierarquia, ou o arquivo dele que abre só para leitura. */
export type Recusa = MotivoDaRecusa | 'so-leitura'

export interface PlanoDoPai {
  /** Os lugares que mudam de pai. */
  readonly mudam: readonly Verbete[]
  /** Os que não podem, com o porquê. */
  readonly recusados: readonly (readonly [Verbete, Recusa])[]
  /** Quantos já estavam em `destino` (nada a fazer). */
  readonly jaEstavam: number
}

/**
 * O que acontece ao pôr `ids` dentro de `destino` (`null` = fora de todos): a
 * única porta para mudar o pai de um lugar (arrastar, "Mover para…", "Tirar
 * de", o "Fica dentro de" da página). O que não é lugar, ou está na Lixeira,
 * é ignorado.
 */
export function planoDeMudarDePai(
  ids: readonly string[],
  destino: string | null,
  verbetes: ReadonlyMap<string, Verbete>,
  soLeitura: ReadonlyMap<string, string> = new Map(),
): PlanoDoPai {
  const mudam: Verbete[] = []
  const recusados: (readonly [Verbete, Recusa])[] = []
  let jaEstavam = 0
  for (const id of ids) {
    const lugar = verbetes.get(id)
    if (lugar?.tipo !== 'lugar' || estaNaLixeira(lugar)) continue
    if ((lugar.paiId ?? null) === destino) {
      jaEstavam += 1
      continue
    }
    const recusa: Recusa | null = soLeitura.has(id) ? 'so-leitura' : motivoParaNaoMudarDePai(lugar, destino, verbetes)
    if (recusa === null) mudam.push(lugar)
    else recusados.push([lugar, recusa])
  }
  return { mudam, recusados, jaEstavam }
}

/**
 * O verbete com o pai novo (`null` tira o campo, como num lugar de cima de
 * sempre). Mudar de lugar à mão esquece o lugar de cima que estava na Lixeira
 * (`paiNaLixeira`): restaurar aquele não puxa este de volta. Sem mudança, o
 * mesmo objeto.
 */
export function comPai(verbete: Verbete, paiId: string | null): Verbete {
  if ((verbete.paiId ?? null) === paiId) return verbete
  const { paiId: _antes, paiNaLixeira: _guardado, ...semPai } = verbete
  return paiId === null ? semPai : { ...semPai, paiId }
}

/** Onde o lugar estava, como o arquivo guarda (`paiId` e `paiNaLixeira`): o que o Desfazer devolve. */
export type PaiDeAntes = Pick<Verbete, 'paiId' | 'paiNaLixeira'>

export function paiDeAntes(verbete: Verbete): PaiDeAntes {
  return { ...(verbete.paiId === undefined ? {} : { paiId: verbete.paiId }), ...(verbete.paiNaLixeira === undefined ? {} : { paiNaLixeira: verbete.paiNaLixeira }) }
}

/** O Desfazer de uma mudança de pai: o lugar volta a apontar para onde apontava, igual. */
export function comPaiDeAntes(verbete: Verbete, antes: PaiDeAntes): Verbete {
  if (verbete.paiId === antes.paiId && verbete.paiNaLixeira === antes.paiNaLixeira) return verbete
  const { paiId: _agora, paiNaLixeira: _guardado, ...semPai } = verbete
  return { ...semPai, ...antes }
}

// ─── Escolher o lugar de cima ("Mover para…", "Fica dentro de") ──────────────

export interface DestinoParaMover {
  readonly id: string
  readonly nome: string
  /** Os lugares acima dele, da região ao pai direto ("Reino de Goa › Castelo"); vazio = lugar de cima. */
  readonly caminho: string
  /** Os lugares pedidos já estão dentro deste: aparece, mas não se escolhe. */
  readonly jaEstaAqui: boolean
}

/**
 * Onde `ids` cabem: TODOS os lugares organizados (não só os que já têm algo
 * dentro), na ordem da árvore, com o caminho de cada um. Fica de fora o que
 * faria laço (ele mesmo e o que está dentro dele). A busca procura cada
 * palavra no nome, nos apelidos e no caminho, sem acento.
 */
export function destinosParaMover(
  ids: readonly string[],
  organizados: LugaresOrganizados,
  verbetes: ReadonlyMap<string, Verbete>,
  soLeitura: ReadonlyMap<string, string> = new Map(),
  busca = '',
): DestinoParaMover[] {
  const palavras = semAcento(busca).split(/\s+/).filter((palavra) => palavra !== '')
  const saida: DestinoParaMover[] = []
  for (const lugar of organizados.emOrdem) {
    const nome = lugar.titulo || SEM_NOME
    const caminho = (organizados.caminhoDe.get(lugar.id) ?? []).join(' › ')
    if (palavras.length > 0) {
      const ondeProcurar = semAcento([caminho, nome, ...lugar.apelidos].join(' · '))
      if (!palavras.every((palavra) => ondeProcurar.includes(palavra))) continue
    }
    const plano = planoDeMudarDePai(ids, lugar.id, verbetes, soLeitura)
    if (plano.mudam.length > 0) saida.push({ id: lugar.id, nome, caminho, jaEstaAqui: false })
    else if (plano.recusados.length === 0 && plano.jaEstavam > 0) saida.push({ id: lugar.id, nome, caminho, jaEstaAqui: true })
  }
  return saida
}
