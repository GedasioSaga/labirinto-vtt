// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S5 (P8): a batalha em andamento vai para a
 * pasta da mesa enquanto anda e, na abertura seguinte do app, vira a pergunta
 * "Retomar a batalha" / "Encerrar". Disco em memória (com o formato de
 * verdade, `batalhaSalva.ts`), mesa e lugar fixos, relógio falso.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { batalhaSalvaDoTexto, textoDaBatalhaSalva } from '../lib/batalha/batalhaSalva'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combatentesIniciais } from '../lib/batalha/turnos'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type LojaDaBatalha } from './batalhaFabrica'
import { BATALHA_SALVA_INTERVALO_MS, iniciarBatalhaSalva, type BatalhaSalvaNaMesa, type DiscoDaBatalhaSalva, type LugarDaMesa, type OfertaDaBatalhaSalva } from './batalhaSalvaNaMesa'

const CENA = 'cena_do_porto'
const PASTA = 'maps/adv_porto'
const LUGAR: LugarDaMesa = { pasta: PASTA, mesaId: 'adv_porto', cenas: new Map([[CENA, 'Porto']]) }
const DEPS = { rolarD20: () => 10, outraBatalhaLigada: () => false }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

const LUTADORES = lutadoresDe([
  { ficha: ficha({ id: 'pers_a', tipo: 'jogador', nome: 'Saga', recursos: { hp: 300, sp: 60 }, maximos: { hp: 300, sp: 60 }, atributos: { agilidade: 70 } }), lado: 'a' },
  { ficha: ficha({ id: 'pers_b', tipo: 'jogador', nome: 'Harvey', recursos: { hp: 300, sp: 60 }, maximos: { hp: 300, sp: 60 }, atributos: { agilidade: 40 } }), lado: 'b' },
])

/** O disco da pasta, em memória: guarda o TEXTO, como o arquivo de verdade. */
function discoEmMemoria(): DiscoDaBatalhaSalva & { arquivos: Map<string, string> } {
  const arquivos = new Map<string, string>()
  return {
    arquivos,
    ler: async (pasta) => {
      const texto = arquivos.get(pasta)
      return texto === undefined ? null : batalhaSalvaDoTexto(texto)
    },
    gravar: async (pasta, salva) => {
      arquivos.set(pasta, textoDaBatalhaSalva(salva))
    },
    apagar: async (pasta) => {
      arquivos.delete(pasta)
    },
  }
}

/** Uma abertura do app: store nova (vazia) sobre as mesmas fichas, e a batalha salva ligada nela. */
function abrirOApp(mesa: MesaDaBatalha, disco: DiscoDaBatalhaSalva): { loja: LojaDaBatalha; salva: BatalhaSalvaNaMesa; ofertas: (OfertaDaBatalhaSalva | null)[] } {
  const loja = criarBatalhaStore(mesa, DEPS)
  const ofertas: (OfertaDaBatalhaSalva | null)[] = []
  const salva = iniciarBatalhaSalva({
    loja,
    mesa,
    disco,
    lugar: () => LUGAR,
    assinarLugar: () => () => undefined,
    aoOfertar: (oferta) => ofertas.push(oferta),
    aoAvisar: () => undefined,
    aoFalhar: (acao, erro) => {
      throw new Error(`${acao}: ${String(erro)}`)
    },
  })
  return { loja, salva, ofertas }
}

/** Liga a batalha e passa a vez uma vez (rodada, vez e linha no registro mudam). */
function batalharUmPouco(mesa: ReturnType<typeof criarMesaEmMemoria>, loja: LojaDaBatalha): void {
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  expect(loja.getState().passarVez(CENA)).toBe(true)
}

/** O relógio anda até a gravação e a fila do disco esvazia. */
async function esperarODisco(salva: BatalhaSalvaNaMesa): Promise<void> {
  await vi.advanceTimersByTimeAsync(BATALHA_SALVA_INTERVALO_MS)
  await salva.ocioso()
}

describe('S5 (P8): a batalha guardada na pasta da mesa', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('grava enquanto anda; a abertura seguinte pergunta (cena e rodada) e o Retomar devolve a batalha à store', async () => {
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, LUTADORES)
    const disco = discoEmMemoria()
    const primeira = abrirOApp(mesa, disco)
    await primeira.salva.ocioso()
    batalharUmPouco(mesa, primeira.loja)
    await esperarODisco(primeira.salva)
    expect(disco.arquivos.has(PASTA)).toBe(true)
    const antes = primeira.loja.getState().cenas[CENA]
    // O app fecha no meio (a store some com ele).
    primeira.salva.parar()

    const segunda = abrirOApp(mesa, disco)
    await segunda.salva.ocioso()
    expect(segunda.ofertas).toEqual([{ cenas: [{ nome: 'Porto', rodada: antes?.turnos.rodada }], salvaEm: expect.any(Number) }])
    // Até a resposta, nada grava por cima da batalha guardada.
    const guardado = disco.arquivos.get(PASTA)
    await esperarODisco(segunda.salva)
    expect(disco.arquivos.get(PASTA)).toBe(guardado)

    segunda.salva.retomar()
    expect(segunda.ofertas.at(-1)).toBeNull()
    expect(segunda.loja.getState().cenas[CENA]?.turnos).toEqual(antes?.turnos)
    expect(segunda.loja.getState().cenas[CENA]?.registro).toEqual(antes?.registro)
    // Retomada, ela volta a ser guardada a cada mudança.
    segunda.loja.getState().passarVez(CENA)
    await esperarODisco(segunda.salva)
    expect(disco.arquivos.get(PASTA)).not.toBe(guardado)
  })

  it('Encerrar acaba a batalha guardada: o arquivo sai e a abertura seguinte não pergunta; o Encerrar de sempre também apaga', async () => {
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, LUTADORES)
    const disco = discoEmMemoria()
    const primeira = abrirOApp(mesa, disco)
    await primeira.salva.ocioso()
    batalharUmPouco(mesa, primeira.loja)
    await esperarODisco(primeira.salva)
    primeira.salva.parar()

    const segunda = abrirOApp(mesa, disco)
    await segunda.salva.ocioso()
    expect(segunda.salva.encerrar()).toEqual([])
    await segunda.salva.ocioso()
    expect(segunda.loja.getState().cenas).toEqual({})
    expect(disco.arquivos.has(PASTA)).toBe(false)
    segunda.salva.parar()

    const terceira = abrirOApp(mesa, disco)
    await terceira.salva.ocioso()
    expect(terceira.ofertas).toEqual([])
    // Nova batalha, encerrada pelo livro (o `desligar`): o arquivo some junto.
    batalharUmPouco(mesa, terceira.loja)
    await esperarODisco(terceira.salva)
    expect(disco.arquivos.has(PASTA)).toBe(true)
    terceira.loja.getState().desligar(CENA)
    await esperarODisco(terceira.salva)
    expect(disco.arquivos.has(PASTA)).toBe(false)
  })
})
