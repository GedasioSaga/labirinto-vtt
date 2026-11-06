/**
 * O SORTEIO DO TREINO (LOBBY v2, fatia T2 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2; resposta 12.17: dado com
 * semente, "repetir esta luta" e "nova semente"): o d20 da luta de treino sai
 * de um gerador com semente, então a mesma semente dá a mesma luta. É o
 * `rolarD20` que o treino passa à fábrica da batalha
 * (`stores/batalhaFabrica.ts`, `DependenciasDaBatalha`).
 *
 * O gerador é o mulberry32, com o estado (`ponto`) à mostra: a luta pausada
 * vai a JSON com `estado()` e volta por `retomarSorteio`, continuando os
 * mesmos d20. O de `cenario/revelacao/tempo.ts` esconde o estado num fecho e
 * mora no código da animação, por isso este é próprio.
 *
 * O d20 descarta a ponta que não divide por 20 (como `secureRollDie` em
 * `lib/dice.ts`): as 20 faces saem com a mesma chance.
 *
 * Puro: sem store, sem DOM. Só a `sementeNova` lê o `crypto` do ambiente.
 */

const FAIXA_UINT32 = 2 ** 32
const LADOS_DO_D20 = 20
/** O que sobra acima disto não divide por 20 e é descartado (16 valores em 2³²). */
const LIMITE_DO_D20 = FAIXA_UINT32 - (FAIXA_UINT32 % LADOS_DO_D20)
/** O passo do mulberry32 (constante do algoritmo). */
const PASSO_DO_GERADOR = 0x6d2b79f5

/** A maior semente: as sementes são inteiros de 32 bits sem sinal (0 a 4294967295), curtos para a tela. */
export const SEMENTE_MAX = FAIXA_UINT32 - 1

/** O sorteio num instante, só números: vai a JSON e volta igual. */
export interface EstadoDoSorteio {
  /** A semente com que a luta começou: a que a tela mostra e o "repetir esta luta" reusa. */
  semente: number
  /** O ponto do gerador agora (inteiro de 32 bits sem sinal). */
  ponto: number
  /** Quantos d20 já saíram. */
  jogadas: number
}

export interface Sorteio {
  /** O próximo d20: inteiro de 1 a 20. */
  d20(): number
  /** Uma cópia do estado de agora, para gravar e retomar com `retomarSorteio`. */
  estado(): EstadoDoSorteio
}

function ehUint32(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= SEMENTE_MAX
}

/** A semente serve: inteiro de 0 a `SEMENTE_MAX`. A tela confere o que o jogador digita com isto antes de criar o sorteio. */
export function sementeValida(valor: unknown): valor is number {
  return ehUint32(valor)
}

/** A saída do mulberry32 no ponto (inteiro de 32 bits sem sinal). */
function saidaDoPonto(ponto: number): number {
  let t = Math.imul(ponto ^ (ponto >>> 15), 1 | ponto)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return (t ^ (t >>> 14)) >>> 0
}

function sorteioDoEstado(inicial: EstadoDoSorteio): Sorteio {
  const { semente } = inicial
  let { ponto, jogadas } = inicial
  return {
    d20: () => {
      for (;;) {
        ponto = (ponto + PASSO_DO_GERADOR) >>> 0
        const saida = saidaDoPonto(ponto)
        if (saida < LIMITE_DO_D20) {
          jogadas += 1
          return (saida % LADOS_DO_D20) + 1
        }
      }
    },
    estado: () => ({ semente, ponto, jogadas }),
  }
}

/** Um sorteio novo da semente. Semente fora de 0..`SEMENTE_MAX` (ou que não é inteiro) = `RangeError`: nunca vira outra semente calada. */
export function criarSorteio(semente: number): Sorteio {
  if (!sementeValida(semente)) throw new RangeError(`semente do treino inválida: ${String(semente)}`)
  return sorteioDoEstado({ semente, ponto: semente, jogadas: 0 })
}

/** O sorteio de volta de um `estado()` gravado: os próximos d20 são os que viriam. Estado torto = `RangeError`. */
export function retomarSorteio(estado: EstadoDoSorteio): Sorteio {
  const { semente, ponto, jogadas } = estado
  if (!sementeValida(semente) || !ehUint32(ponto) || !Number.isSafeInteger(jogadas) || jogadas < 0) {
    throw new RangeError('estado do sorteio do treino inválido')
  }
  return sorteioDoEstado({ semente, ponto, jogadas })
}

/** "Nova semente": uma semente aleatória do `crypto` do ambiente (navegador, worker ou Node). */
export function sementeNova(): number {
  const palavra = new Uint32Array(1)
  crypto.getRandomValues(palavra)
  return palavra[0]
}
