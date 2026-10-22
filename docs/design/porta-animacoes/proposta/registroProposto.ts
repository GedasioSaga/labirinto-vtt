/**
 * PROPOSTA PARA O APP: o que `registrarAnimacaoDePorta` (client/src/portas/animacoesDePorta.ts)
 * passaria a aceitar do pacote, além de id, nome, duracaoMs e desenhar:
 *  - `duracaoFecharMs` (opcional, mesma faixa de duracaoMs): hoje só as embutidas têm;
 *  - `curvaAbrir` e `curvaFechar` (opcionais, cubic-bezier com os 4 números em [0, 1]).
 * Ausente = como hoje (uma duração só, curva easeOutCubic). Fora da faixa = recusa a
 * animação inteira, como o registro de hoje já faz com o resto.
 *
 * No protótipo as embutidas (Girar, Deslizar) vêm do registro REAL; as novas, daqui.
 */
import { ANIMACOES_EMBUTIDAS, DURACAO_DE_ANIMACAO_MAX_MS, NOME_DE_ANIMACAO_MAX, animacaoDePorta, idDeAnimacaoDePortaValido, type AnimacaoDePorta } from '../portas/animacoesDePorta'
import { easeOutCubic } from '../../../../client/src/transicoes/curvas'
import { criarCurvaBezier, curvaBezierValida, type CurvaBezier } from './curvaBezier'

export interface AnimacaoDePortaProposta extends AnimacaoDePorta {
  curvaAbrir?: CurvaBezier
  curvaFechar?: CurvaBezier
}

const deFora = new Map<string, AnimacaoDePortaProposta>()

function duracaoValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= DURACAO_DE_ANIMACAO_MAX_MS
}

/** Confere em tempo de execução, como o registro de hoje; devolve `false` e não registra o que não tem a forma. */
export function registrarAnimacaoDePortaProposta(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || !idDeAnimacaoDePortaValido(info.id)) return false
  const id = info.id
  if (ANIMACOES_EMBUTIDAS.some((embutida) => embutida.id === id)) return false
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_ANIMACAO_MAX) return false
  if (!('duracaoMs' in info) || !duracaoValida(info.duracaoMs)) return false
  const duracaoFecharMs = 'duracaoFecharMs' in info ? info.duracaoFecharMs : undefined
  if (duracaoFecharMs !== undefined && !duracaoValida(duracaoFecharMs)) return false
  const curvaAbrir = 'curvaAbrir' in info ? info.curvaAbrir : undefined
  const curvaFechar = 'curvaFechar' in info ? info.curvaFechar : undefined
  if (curvaAbrir !== undefined && !curvaBezierValida(curvaAbrir)) return false
  if (curvaFechar !== undefined && !curvaBezierValida(curvaFechar)) return false
  if (!('desenhar' in info) || typeof info.desenhar !== 'function') return false
  const desenharDeFora = info.desenhar
  deFora.set(id, {
    id,
    nome,
    duracaoMs: info.duracaoMs,
    ...(duracaoFecharMs === undefined ? {} : { duracaoFecharMs }),
    ...(curvaAbrir === undefined ? {} : { curvaAbrir }),
    ...(curvaFechar === undefined ? {} : { curvaFechar }),
    desenhar: (g, porta, progresso, abrindo) => {
      Reflect.apply(desenharDeFora, undefined, [g, porta, progresso, abrindo])
    },
  })
  return true
}

export function animacaoDePortaProposta(id: string | undefined): AnimacaoDePortaProposta | null {
  if (id === undefined) return null
  return deFora.get(id) ?? animacaoDePorta(id)
}

/** Embutidas primeiro, as novas na ordem em que entraram. */
export function listarAnimacoesPropostas(): readonly AnimacaoDePortaProposta[] {
  return [...ANIMACOES_EMBUTIDAS, ...deFora.values()]
}

const funcoes = new Map<CurvaBezier, (t: number) => number>()

/** Curva do sentido pedido; sem curva declarada, a de hoje (easeOutCubic). */
export function curvaDoSentido(animacao: AnimacaoDePortaProposta, abrindo: boolean): (t: number) => number {
  const curva = abrindo ? animacao.curvaAbrir : animacao.curvaFechar
  if (curva === undefined) return easeOutCubic
  let funcao = funcoes.get(curva)
  if (funcao === undefined) {
    funcao = criarCurvaBezier(curva)
    funcoes.set(curva, funcao)
  }
  return funcao
}
