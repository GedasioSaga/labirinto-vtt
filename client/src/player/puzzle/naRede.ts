/**
 * A TELA DO PUZZLE LIGADA NO HOST (plano `docs/design/puzzles/PLANO.md` §4,
 * P8, a ligação depois da P7). Traduz o que a conexão do jogador guardou do
 * host (`PuzzleDoJogador`, em `playerConnection.ts`) nos acontecimentos da
 * tela (`tipos.ts`). Puro: quem chama guarda o estado de antes.
 *
 * A recusa, o castigo e o desfecho chegam como mensagens próprias, cada um com
 * a sua marca (`id` ou um objeto novo). A troca feita e as metades juntas não
 * viajam: saem da diferença entre a vista de antes e a de agora, como o motor
 * as conta (`puzzles/motor.ts`, `trocar` e `pôr`).
 */
import { textoDaRecusaDoPuzzle, type CastigoDoPuzzleNoFio, type DesfechoDoPuzzleNoFio, type PuzzleFechadoMotivo } from '../../net/protocoloDoPuzzle'
import { TEXTO_DA_RECUSA } from '../../puzzles/tipos'
import type { VistaDoPuzzle } from '../../puzzles/tipos'
import type { Token } from '../../types/map'
import type { PuzzleDoJogador } from '../playerConnection'
import type { CastigoNaTela, CorpoDoAcontecimento, DesfechoNaTela } from './tipos'

/** O teto e o nome padrão de quem mexe: os de `quemEhOBoneco` (`net/puzzleNoHost.ts`), que o host põe no `por`. */
const NOME_DE_QUEM_MAX = 40
const NOME_DE_QUEM_PADRAO = 'Alguém'

/** O nome com que o host marca o que esta ficha põe e resolve: a tela o compara com o `por` da vista. */
export function nomeNoPuzzle(token: Pick<Token, 'name'>): string {
  const nome = token.name.trim().slice(0, NOME_DE_QUEM_MAX)
  return nome === '' ? NOME_DE_QUEM_PADRAO : nome
}

/** O aviso no mapa depois que o mestre fechou a tela: mudou a cópia, ou o puzzle saiu do lugar. */
export function textoDoFechado(motivo: PuzzleFechadoMotivo): string {
  return motivo === 'mudou' ? TEXTO_DA_RECUSA.mudou : 'Este puzzle não está mais aqui.'
}

/**
 * O que mudou entre duas leituras do mesmo puzzle, na ordem em que a tela deve
 * reagir. Outro puzzle (ou o primeiro) não tem "antes": nada a contar.
 */
export function acontecimentosDaRede(antes: PuzzleDoJogador, agora: PuzzleDoJogador): CorpoDoAcontecimento[] {
  if (antes.desafioId !== agora.desafioId) return []
  const corpos: CorpoDoAcontecimento[] = []
  if (agora.recusa !== null && agora.recusa.id !== antes.recusa?.id) {
    corpos.push({ tipo: 'recusado', texto: textoDaRecusaDoPuzzle(agora.recusa.motivo) })
  }
  if (agora.castigo !== null && agora.castigo.id !== antes.castigo?.id) {
    corpos.push({ tipo: 'errou', em: agora.castigo.erro.em, castigo: castigoNaTela(agora.castigo.castigo) })
  }
  if (agora.vista !== antes.vista) corpos.push(...daDiferencaDaVista(antes.vista, agora.vista))
  if (agora.resolvido !== null && agora.resolvido !== antes.resolvido) {
    corpos.push({ tipo: 'resolvido', desfecho: desfechoNaTela(agora.resolvido) })
  }
  return corpos
}

/** O `nada` do host é o "Nada acontece" da tela. */
function castigoNaTela(castigo: CastigoDoPuzzleNoFio): CastigoNaTela | null {
  if (castigo.tipo === 'nada') return null
  return { tipo: castigo.tipo, texto: castigo.texto, pv: castigo.pv }
}

/**
 * As metades que acabaram de se juntar (a segunda entrou) e a troca que deu
 * certo PARA ELE: o motor põe a peça guardada só na mochila de quem trocou,
 * então a vaga que chegou junto com a troca feita é a prova de que foi ele.
 */
function daDiferencaDaVista(antes: VistaDoPuzzle, agora: VistaDoPuzzle): CorpoDoAcontecimento[] {
  const corpos: CorpoDoAcontecimento[] = []
  const metadesAntes = new Map(antes.encaixes.map((encaixe) => [encaixe.id, encaixe.metadesPostas ?? 0]))
  for (const encaixe of agora.encaixes) {
    if (encaixe.jeito !== 'metades' || encaixe.metadesPostas !== 2) continue
    const eram = metadesAntes.get(encaixe.id)
    if (eram !== undefined && eram < 2) corpos.push({ tipo: 'juntou', encaixeId: encaixe.id })
  }
  const trocouAgora = antes.troca !== null && !antes.troca.feita && agora.troca !== null && agora.troca.feita
  if (trocouAgora) {
    const quantasAntes = new Map(antes.mochila.map((vaga) => [vaga.vagaId, vaga.quantidade]))
    const chegou = agora.mochila.find((vaga) => (quantasAntes.get(vaga.vagaId) ?? 0) < vaga.quantidade)
    if (chegou !== undefined) corpos.push({ tipo: 'trocou', nome: chegou.nome })
  }
  return corpos
}

/**
 * O desfecho do fio na forma da tela. O prêmio não leva a imagem dos itens (o
 * cartão mostra o ícone da mochila), e cada documento listado entrou agora: a
 * biblioteca Documentos, que diria "você já tinha", chega na leva do Documento.
 */
function desfechoNaTela(desfecho: DesfechoDoPuzzleNoFio): DesfechoNaTela {
  return {
    por: desfecho.por,
    modo: desfecho.modo,
    texto: desfecho.texto,
    itens: desfecho.premio.itens.map((item) => ({ nome: item.nome, quantidade: item.quantidade, imagem: null })),
    moedas: desfecho.premio.moedas,
    documentos: desfecho.premio.documentos.map((titulo) => ({ titulo, novo: true })),
    abriuPorta: desfecho.abriuPorta,
  }
}
