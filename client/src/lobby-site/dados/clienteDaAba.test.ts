import { describe, expect, it } from 'vitest'
import { clienteIdDaAba } from './clienteDaAba'

/** A chave no `sessionStorage` (a mesma de `clienteDaAba.ts`). */
const CHAVE = 'labirinto-lobby:aba'

/** Um `sessionStorage` de uma aba; a duplicada nasce com uma cópia do da original. */
function guardaDeTeste(copiaDe?: ReadonlyMap<string, string>) {
  const mapa = new Map(copiaDe)
  return {
    mapa,
    getItem: (chave: string): string | null => mapa.get(chave) ?? null,
    setItem: (chave: string, valor: string): void => void mapa.set(chave, valor),
  }
}

/** As Web Locks do navegador: a trava pega por uma aba fica presa até a aba fechar (ou recarregar). */
function navegadorDeTeste() {
  const presas = new Set<string>()
  return {
    aba() {
      const minhas = new Set<string>()
      const travas: Pick<LockManager, 'request'> = {
        async request(nome: string, opcoesOuPegou: LockOptions | LockGrantedCallback, pegouDepois?: LockGrantedCallback) {
          const pegou = typeof opcoesOuPegou === 'function' ? opcoesOuPegou : pegouDepois
          if (pegou === undefined) throw new TypeError('request sem callback')
          if (presas.has(nome)) return pegou(null)
          presas.add(nome)
          minhas.add(nome)
          return pegou({ name: nome, mode: 'exclusive' })
        },
      }
      return {
        travas,
        fechar() {
          for (const nome of minhas) presas.delete(nome)
          minhas.clear()
        },
      }
    },
  }
}

describe('clienteId da aba', () => {
  it('recarregar a aba mantém o id; a aba duplicada (cópia do sessionStorage, trava presa na original) ganha outro', async () => {
    const navegador = navegadorDeTeste()
    let ids = 0
    const novoId = () => `cli_aba_${(ids += 1)}`
    const guardaDaOriginal = guardaDeTeste()

    const original = navegador.aba()
    const primeiro = await clienteIdDaAba({ guarda: guardaDaOriginal, travas: original.travas, novoId })
    // Recarregar: a página velha solta a trava e a nova lê o mesmo sessionStorage.
    original.fechar()
    const recarregada = navegador.aba()
    expect(await clienteIdDaAba({ guarda: guardaDaOriginal, travas: recarregada.travas, novoId })).toBe(primeiro)

    const guardaDaDuplicada = guardaDeTeste(guardaDaOriginal.mapa)
    const daDuplicada = await clienteIdDaAba({ guarda: guardaDaDuplicada, travas: navegador.aba().travas, novoId })
    expect(daDuplicada).not.toBe(primeiro)
    expect(guardaDaDuplicada.getItem(CHAVE)).toBe(daDuplicada)
    expect(guardaDaOriginal.getItem(CHAVE)).toBe(primeiro)
  })

  it('sem sessionStorage, sem Web Locks, com o armazenamento lançando ou com lixo guardado: dá um id novo e válido, sem lançar', async () => {
    expect(await clienteIdDaAba({ guarda: null, travas: null, novoId: () => 'cli_sem_nada' })).toBe('cli_sem_nada')

    const bloqueada = {
      getItem: (): string | null => {
        throw new Error('SecurityError: armazenamento bloqueado')
      },
      setItem: (): void => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(await clienteIdDaAba({ guarda: bloqueada, travas: null, novoId: () => 'cli_bloqueada' })).toBe('cli_bloqueada')

    const comLixo = guardaDeTeste(new Map([[CHAVE, 'nao vale/../x']]))
    expect(await clienteIdDaAba({ guarda: comLixo, travas: null, novoId: () => 'cli_limpa' })).toBe('cli_limpa')
    expect(comLixo.getItem(CHAVE)).toBe('cli_limpa')
  })
})
