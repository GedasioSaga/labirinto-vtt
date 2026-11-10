import { lerMecanica } from './batalha/mecanica/modelo'
import { guardarMecanica } from './batalha/mecanica/modelos'
import { normalizarParaBusca } from './buscaNoLivro'
import { cartoesDaAba, novoIdDeCartao, type CartaoDaFicha, type Personagem } from './personagem'
import type { AbaDoSistema, SistemaDeRpg } from './sistemaDeRpg'

/**
 * "TRAZER DE OUTRA FICHA" (pedido do mestre, 09/11/2026): o Frog é parente do
 * Tree e os dois têm a Bolha; em vez de montar a mesma habilidade duas vezes,
 * a ficha em edição traz a que outra ficha da pasta já tem.
 *
 * O que vem é uma CÓPIA: cartão novo, com id novo, sem ligação com o original.
 * Mudar um depois não muda o outro.
 */

/**
 * A cópia do cartão para outra ficha: tudo o que ele guarda (campos, extras,
 * imagem, modificadores, os cartões de dentro), com ids novos de cima a baixo.
 *
 * A mecânica por peças passa pela mesma regra do "copie de outra técnica" do
 * editor de mecânica (`lerMecanica` e `guardarMecanica`): a que o app lê é
 * regravada inteira, peça por peça; a que ele não lê (torta, ou de um app mais
 * novo) vem como estava, para não se perder no caminho.
 *
 * Ficam para trás a proposta do dono (é um pedido da OUTRA ficha ao mestre) e
 * a marca de arma padrão (só uma arma da ficha é a padrão).
 */
export function copiaDoCartao(cartao: CartaoDaFicha): CartaoDaFicha {
  const { mecanicaProposta: _proposta, armaPadrao: _padrao, ...resto } = structuredClone(cartao)
  const lida = lerMecanica(cartao.mecanica)
  return {
    ...resto,
    id: novoIdDeCartao(),
    subcartoes: cartao.subcartoes.map(copiaDoCartao),
    ...(lida.tipo === 'pecas' ? { mecanica: guardarMecanica(lida.mecanica) } : {}),
  }
}

/** Um cartão que a outra ficha oferece. */
export interface CartaoParaTrazer {
  cartao: CartaoDaFicha
  /** O cartão de onde ele sai quando mora dentro de outro (a técnica de uma transformação); `null` = solto na aba. */
  dentroDe: string | null
}

/** Uma ficha da pasta com o que ela tem para trazer. */
export interface FichaParaTrazer {
  personagem: Personagem
  cartoes: CartaoParaTrazer[]
}

/** Os cartões da aba na ficha: os soltos e os que moram dentro de cartões de outra aba (as técnicas das transformações). */
function cartoesDaFichaNaAba(personagem: Personagem, aba: AbaDoSistema, sistema: SistemaDeRpg): CartaoParaTrazer[] {
  const cartoes: CartaoParaTrazer[] = cartoesDaAba(personagem, aba.id).map((cartao) => ({ cartao, dentroDe: null }))
  for (const outra of sistema.abas) {
    if (outra.subcartoes?.aba !== aba.id) continue
    for (const dono of cartoesDaAba(personagem, outra.id)) for (const cartao of dono.subcartoes) cartoes.push({ cartao, dentroDe: dono.nome })
  }
  return cartoes
}

const COLACAO = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

/**
 * As fichas da pasta que têm algo nesta aba, menos a que está em edição.
 * Primeiro as do mesmo tipo da ficha em edição (quem edita um NPC quase sempre
 * quer o golpe de outro NPC), depois as outras; cada parte em ordem de nome.
 */
export function fichasParaTrazer(fichas: readonly Personagem[], emEdicao: Pick<Personagem, 'id' | 'tipo'>, aba: AbaDoSistema, sistema: SistemaDeRpg): FichaParaTrazer[] {
  return fichas
    .filter((personagem) => personagem.id !== emEdicao.id)
    .map((personagem) => ({ personagem, cartoes: cartoesDaFichaNaAba(personagem, aba, sistema) }))
    .filter((ficha) => ficha.cartoes.length > 0)
    .sort(
      (a, b) =>
        (a.personagem.tipo === emEdicao.tipo ? 0 : 1) - (b.personagem.tipo === emEdicao.tipo ? 0 : 1) || COLACAO.compare(a.personagem.nome, b.personagem.nome),
    )
}

/** A busca acha a ficha pelo nome dela ou pelo nome de um cartão que ela tem ("bolha" acha o Tree). Sem acento nem maiúscula. */
export function fichaCasaComBusca(ficha: FichaParaTrazer, busca: string): boolean {
  const procurada = normalizarParaBusca(busca)
  if (procurada.length === 0) return true
  if (normalizarParaBusca(ficha.personagem.nome).includes(procurada)) return true
  return ficha.cartoes.some((item) => normalizarParaBusca(item.cartao.nome).includes(procurada))
}

/** O cartão casa com a busca pelo próprio nome. */
export function cartaoCasaComBusca(item: CartaoParaTrazer, busca: string): boolean {
  const procurada = normalizarParaBusca(busca)
  return procurada.length > 0 && normalizarParaBusca(item.cartao.nome).includes(procurada)
}
