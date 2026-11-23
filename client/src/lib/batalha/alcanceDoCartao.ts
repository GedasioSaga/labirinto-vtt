import type { FormaDoAlcance } from './alcance/forma'
import { pecasDoCartao } from './mecanica/leitura'
import { CASAS_MAX, type MecanicaV1 } from './mecanica/modelo'
import { mecanicaDoCartao, type MecanicaAMao } from './mecanicasAMao'
import type { CartaoDaFicha } from '../personagem'

/**
 * ALCANCE: O ÚNICO LEITOR (fase B, docs/design/habilidades/ALCANCE.md §3.2). De
 * onde sai a forma do alcance de um cartão, numa ordem fixa:
 *
 *  1. a mecânica montada (`alvo.forma`, `alvo.alcance`, `alvo.alcanceMinimo`);
 *     a área que sai de quem usa já tem o tamanho como alcance;
 *  2. a tabela à mão (`mecanicasAMao.ts`, `area` e `alcance`), quando ela diz
 *     alguma coisa do alcance;
 *  3. o campo `alcance` do cartão (o cartão só de texto, a arma não montada);
 *  4. nada: sem casas, e o host não confere distância (como antes).
 *
 * A mecânica montada que existe manda sempre: torta ou de app mais novo = nada
 * (o cartão vira à mão e não volta para o texto, como em `mecanicaDoCartao`).
 * A forma torta do campo `alcance` também é nada (o disco a guarda como veio).
 *
 * A entrada do catálogo do livro tem o mesmo `mecanica` e `alcance` e passa
 * aqui igual (a tabela à mão não acha nada pelo id dela).
 *
 * Puro: sem store, sem rede.
 */

/** De onde veio a forma (o editor diz "vem da regra à mão" quando é da tabela). */
export type OrigemDoAlcance = 'mecanica' | 'tabela' | 'cartao'

export interface AlcanceDoCartao {
  forma: FormaDoAlcance
  origem: OrigemDoAlcance
}

/** Atacar desarmado: o alvo colado (fixo no motor, §3.2). */
export const ALCANCE_DESARMADO: FormaDoAlcance = { tipo: 'alvo', ate: 1 }

/** O que o leitor precisa do cartão; a entrada do catálogo (`ItemDoCatalogo`) também serve. */
export type CartaoComAlcance = Pick<CartaoDaFicha, 'id' | 'mecanica' | 'alcance'>

/** A forma do alcance do cartão; `null` = sem alcance definido (a mira diz isso e o host não confere distância). */
export function alcanceDoCartao(cartao: CartaoComAlcance): AlcanceDoCartao | null {
  if (cartao.mecanica !== undefined) {
    const pecas = pecasDoCartao(cartao)
    const forma = pecas === null ? null : alcanceDaMecanica(pecas)
    return forma === null ? null : { forma, origem: 'mecanica' }
  }
  const linha = mecanicaDoCartao(cartao.id)
  const daTabela = linha === null ? null : alcanceDaTabela(linha)
  if (daTabela !== null) return { forma: daTabela, origem: 'tabela' }
  const doCampo = cartao.alcance === undefined ? null : formaDoAlcanceGuardada(cartao.alcance)
  return doCampo === null ? null : { forma: doCampo, origem: 'cartao' }
}

/** A forma que a mecânica montada desenha; `null` = o alvo escolhido (ou a área longe) sem alcance. */
export function alcanceDaMecanica(mecanica: Pick<MecanicaV1, 'alvo'>): FormaDoAlcance | null {
  const { quem, forma, alcance, alcanceMinimo } = mecanica.alvo
  if (quem === 'si') return { tipo: 'si' }
  switch (forma.tipo) {
    case 'um':
    case 'varios':
      if (alcance === undefined) return null
      return alcanceMinimo === undefined ? { tipo: 'alvo', ate: alcance } : { tipo: 'alvo', ate: alcance, de: alcanceMinimo }
    case 'linha':
      return { tipo: 'linha', ate: forma.casas }
    case 'cruz':
      return { tipo: 'cruz', ate: forma.casas }
    case 'leque':
      return { tipo: 'leque', ate: forma.casas }
    case 'raio':
      if (forma.centro === undefined) return { tipo: 'volta', ate: forma.casas }
      if (alcance === undefined) return null
      return { tipo: forma.centro === 'ponto' ? 'ponto' : 'ficha', ate: alcance, raio: forma.casas }
    case 'quadrado':
      if (forma.centro === 'frente') return { tipo: 'frente', lado: forma.lado }
      if (forma.centro === 'si') return voltaDoQuadrado(forma.lado)
      return alcance === undefined ? null : { tipo: 'ponto', ate: alcance, lado: forma.lado }
  }
}

/** O quadrado ímpar em volta de quem usa é o "em volta" (3x3 = 1 casa); o 1x1 é só ele. */
function voltaDoQuadrado(lado: number): FormaDoAlcance {
  const ate = Math.floor((lado - 1) / 2)
  return ate === 0 ? { tipo: 'si' } : { tipo: 'volta', ate }
}

/** A forma que a linha da tabela à mão diz; `null` = a linha não fala de alcance (vale o campo do cartão). */
export function alcanceDaTabela(linha: Pick<MecanicaAMao, 'area' | 'alcance'>): FormaDoAlcance | null {
  const { area, alcance } = linha
  if (area === undefined) return alcance === undefined ? null : { tipo: 'alvo', ate: alcance }
  const { forma } = area
  if (area.centro !== undefined) {
    // A área longe só existe no `raio` (AreaAMao); sem alcance, o centro não tem limite.
    if (forma.tipo !== 'raio' || alcance === undefined) return null
    return { tipo: area.centro === 'ponto' ? 'ponto' : 'ficha', ate: alcance, raio: forma.casas }
  }
  switch (forma.tipo) {
    case 'raio':
      return { tipo: 'volta', ate: forma.casas }
    case 'frente':
      return { tipo: 'frente', lado: forma.lado }
    case 'linha':
      return { tipo: 'linha', ate: forma.alcance }
    case 'cruz':
      return { tipo: 'cruz', ate: forma.casas }
    case 'leque':
      return { tipo: 'leque', ate: forma.casas }
  }
}

// ─── O campo `alcance` do cartão ────────────────────────────────────────────

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function inteiroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo && valor <= maximo
}

/** Só estas chaves: a de um app mais novo deixa a forma torta (sem alcance aqui), nunca lida pela metade. */
function soChaves(peca: Readonly<Record<string, unknown>>, permitidas: readonly string[]): boolean {
  return Object.keys(peca).every((chave) => permitidas.includes(chave))
}

/** A explosão da área longe guardada: o `raio` (0 = só o centro) ou o `lado` ímpar, um dos dois. */
function explosaoGuardada(peca: Readonly<Record<string, unknown>>): { raio: number } | { lado: number } | null {
  if (peca.raio !== undefined) return peca.lado === undefined && inteiroEntre(peca.raio, 0, CASAS_MAX) ? { raio: peca.raio } : null
  return inteiroEntre(peca.lado, 1, CASAS_MAX) && peca.lado % 2 === 1 ? { lado: peca.lado } : null
}

/**
 * A forma guardada no campo `alcance` (do cartão ou da entrada do catálogo),
 * conferida; `null` = torta (fica no disco como veio, mas aqui não vale).
 * Os números: 1 a `CASAS_MAX`; o anel de 2 até o `ate`.
 */
export function formaDoAlcanceGuardada(peca: unknown): FormaDoAlcance | null {
  if (!ehRegistro(peca)) return null
  switch (peca.tipo) {
    case 'si':
      return soChaves(peca, ['tipo']) ? { tipo: 'si' } : null
    case 'frente':
      return soChaves(peca, ['tipo', 'lado']) && inteiroEntre(peca.lado, 1, CASAS_MAX) ? { tipo: 'frente', lado: peca.lado } : null
    case 'linha':
    case 'volta':
    case 'cruz':
    case 'leque':
      return soChaves(peca, ['tipo', 'ate']) && inteiroEntre(peca.ate, 1, CASAS_MAX) ? { tipo: peca.tipo, ate: peca.ate } : null
    case 'alvo': {
      if (!soChaves(peca, ['tipo', 'ate', 'de']) || !inteiroEntre(peca.ate, 1, CASAS_MAX)) return null
      if (peca.de === undefined) return { tipo: 'alvo', ate: peca.ate }
      return inteiroEntre(peca.de, 2, peca.ate) ? { tipo: 'alvo', ate: peca.ate, de: peca.de } : null
    }
    case 'ponto':
    case 'ficha': {
      if (!soChaves(peca, ['tipo', 'ate', 'raio', 'lado']) || !inteiroEntre(peca.ate, 1, CASAS_MAX)) return null
      const explosao = explosaoGuardada(peca)
      return explosao === null ? null : { tipo: peca.tipo, ate: peca.ate, ...explosao }
    }
    default:
      return null
  }
}
