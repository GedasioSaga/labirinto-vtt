import { describe, expect, it } from 'vitest'
import { criarLaco, ESPERA_COM_A_CAMPANHA_ABERTA_MS, ESPERA_COM_A_CAMPANHA_FECHADA_MS, proximaEspera, type ContextoDoLaco } from './laco'
import type { ResultadoDoCiclo } from './sincronizador'

/** O ritmo da §5.5: 5 s com a campanha aberta e a janela visível; 10 min fora disso; sem rede, 2-5-10-30-60 s. */

const VISIVEL_E_ABERTA: ContextoDoLaco = { janelaVisivel: () => true, campanhaAberta: () => true }
const MINIMIZADA: ContextoDoLaco = { janelaVisivel: () => false, campanhaAberta: () => true }
const OK: ResultadoDoCiclo = { t: 'ok', recebidas: 0, enviadas: 0, faltaEnviar: false }
const SEM_REDE: ResultadoDoCiclo = { t: 'sem-rede', detalhe: 'Sem internet' }

describe('ritmo do sincronizador (A5)', () => {
  it('5 s aberta e visível, 10 min minimizada; sem rede cresce 2, 5, 10, 30, 60, 60 s; versão e token param', () => {
    expect(proximaEspera(OK, 0, VISIVEL_E_ABERTA)).toBe(ESPERA_COM_A_CAMPANHA_ABERTA_MS)
    expect(proximaEspera(OK, 0, MINIMIZADA)).toBe(ESPERA_COM_A_CAMPANHA_FECHADA_MS)
    expect([1, 2, 3, 4, 5, 6].map((falhas) => proximaEspera(SEM_REDE, falhas, VISIVEL_E_ABERTA))).toEqual([2_000, 5_000, 10_000, 30_000, 60_000, 60_000])
    expect(proximaEspera({ t: 'versao', detalhe: '' }, 0, VISIVEL_E_ABERTA)).toBeNull()
    expect(proximaEspera({ t: 'sem-credencial', detalhe: '' }, 0, VISIVEL_E_ABERTA)).toBeNull()
  })

  it('o laço agenda pela resposta: sem rede espera crescente (cutucar não fura), versão para, retomar volta', async () => {
    const agendados: { fazer: () => void; ms: number }[] = []
    const respostas: ResultadoDoCiclo[] = [SEM_REDE, SEM_REDE, { t: 'versao', detalhe: 'atualize' }, OK]
    let ciclos = 0
    const laco = criarLaco(
      async () => respostas[ciclos++] ?? OK,
      VISIVEL_E_ABERTA,
      (fazer, ms) => {
        const agendado = { fazer, ms }
        agendados.push(agendado)
        return () => {
          agendado.fazer = () => undefined
        }
      },
      () => 0,
    )
    const rodarOProximo = async (): Promise<void> => {
      const proximo = agendados.at(-1)
      proximo?.fazer()
      // O ciclo é assíncrono: deixa a promessa assentar.
      await new Promise((resolver) => setTimeout(resolver, 0))
    }
    laco.iniciar()
    await rodarOProximo()
    expect(agendados.at(-1)?.ms).toBe(2_000)
    laco.cutucar(1_000)
    expect(agendados.at(-1)?.ms).toBe(2_000)
    await rodarOProximo()
    expect(agendados.at(-1)?.ms).toBe(5_000)
    await rodarOProximo()
    expect(laco.parado()).toBe(true)
    const antes = agendados.length
    laco.cutucar(0)
    expect(agendados.length).toBe(antes)
    laco.retomar()
    await rodarOProximo()
    expect(ciclos).toBe(4)
    expect(agendados.at(-1)?.ms).toBe(ESPERA_COM_A_CAMPANHA_ABERTA_MS)
  })
})
