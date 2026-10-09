/**
 * RETRATO COMO MÍDIA (`stores/midiaDosPersonagens.ts`, `lib/imagensDaFicha.ts`):
 * a imagem embutida da ficha (retrato, cartão, subcartão) é gravada como mídia
 * e trocada pela referência na aventura — da ficha de antes aberta do disco e
 * de toda imagem nova. O disco é de mentira.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { imagensEmbutidas, personagemComMidia } from '../lib/imagensDaFicha'
import { personagemDoArquivo, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { useAdventureStore } from './adventureStore'
import { iniciarMidiaDosPersonagens, type GuardarImagem } from './midiaDosPersonagens'

const RETRATO = 'data:image/png;base64,UkVUUkFUTw=='
const CARTAO = 'data:image/png;base64,Q0FSVEFP'
const SUB = 'data:image/webp;base64,U1VC'
const ref = (letra: string) => `midia:${letra.repeat(64)}.png`

function cartao(id: string, imagem: string | null, subcartoes: CartaoDaFicha[] = []): CartaoDaFicha {
  return { id, nome: id, campos: {}, extras: [], atributos: [], imagem, modificadores: [], subcartoes }
}

function personagem(id: string, retrato: string | null, abas: Record<string, CartaoDaFicha[]> = {}): Personagem {
  return {
    id,
    tipo: 'jogador',
    nome: id,
    descricao: '',
    retrato,
    escolhas: {},
    etiquetas: [],
    recursos: {},
    maximos: {},
    modificadoresDosRecursos: {},
    atributos: {},
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas,
  }
}

function abrirAventura(personagens: Personagem[]): void {
  useAdventureStore.setState({
    adventure: { version: 1, id: 'av', name: 'Aventura', startSceneId: 'c1', scenes: [], personagens },
    structureDirty: false,
  })
}

const personagensAgora = (): readonly Personagem[] => useAdventureStore.getState().adventure?.personagens ?? []

/** Espera as gravações em fila (promessas) terminarem. */
const esperar = () => new Promise((resolve) => setTimeout(resolve, 0))

let parar: (() => void) | null = null

beforeEach(() => {
  useAdventureStore.setState({ adventure: null, structureDirty: false })
})

afterEach(() => {
  parar?.()
  parar = null
})

describe('regras puras', () => {
  it('acha o retrato e as imagens de cartão e subcartão, sem repetir; referência e nulo não contam', () => {
    const lista = [
      personagem('a', RETRATO, { hab: [cartao('c1', CARTAO, [cartao('s1', SUB)]), cartao('c2', null)] }),
      personagem('b', RETRATO, { hab: [cartao('c3', ref('e'))] }),
    ]
    expect(imagensEmbutidas(lista).sort()).toEqual([CARTAO, RETRATO, SUB].sort())
  })

  it('troca no lugar; sem troca, o MESMO objeto (a sessão não reenvia a ficha)', () => {
    const p = personagem('a', RETRATO, { hab: [cartao('c1', CARTAO, [cartao('s1', SUB)])] })
    const trocado = personagemComMidia(p, new Map([[RETRATO, ref('1')], [SUB, ref('2')]]))
    expect(trocado.retrato).toBe(ref('1'))
    expect(trocado.abas.hab?.[0]?.imagem).toBe(CARTAO)
    expect(trocado.abas.hab?.[0]?.subcartoes[0]?.imagem).toBe(ref('2'))
    expect(personagemComMidia(p, new Map([['data:image/png;base64,T1VUUk8=', ref('3')]]))).toBe(p)
  })

  it('a ficha aceita a referência no arquivo e na mensagem; caminho de disco sai', () => {
    expect(personagemDoArquivo({ id: 'x', retrato: ref('f') })?.retrato).toBe(ref('f'))
    expect(personagemDoArquivo({ id: 'x', retrato: RETRATO })?.retrato).toBe(RETRATO)
    expect(personagemDoArquivo({ id: 'x', retrato: 'C:/Users/mestre/luffy.png' })?.retrato).toBeNull()
    expect(personagemDoArquivo({ id: 'x', abas: { hab: [{ id: 'c', imagem: `midia:../${'f'.repeat(64)}.png` }] } })?.abas.hab?.[0]?.imagem).toBeNull()
  })
})

describe('observador da aventura', () => {
  it('a ficha de antes aberta do disco tem cada embutida gravada e trocada, e pede Salvar', async () => {
    const gravadas: string[] = []
    const guardar: GuardarImagem = async (dataUrl) => {
      gravadas.push(dataUrl)
      return dataUrl === RETRATO ? ref('1') : ref('2')
    }
    abrirAventura([personagem('a', RETRATO, { hab: [cartao('c1', CARTAO)] }), personagem('b', RETRATO)])
    parar = iniciarMidiaDosPersonagens(guardar)
    await esperar()
    expect(gravadas.sort()).toEqual([CARTAO, RETRATO].sort())
    const [a, b] = personagensAgora()
    expect(a?.retrato).toBe(ref('1'))
    expect(a?.abas.hab?.[0]?.imagem).toBe(ref('2'))
    expect(b?.retrato).toBe(ref('1'))
    expect(useAdventureStore.getState().structureDirty).toBe(true)
    expect(JSON.stringify(personagensAgora())).not.toContain('data:image')
  })

  it('a imagem nova (o mestre escolheu, o jogador mandou) também vira mídia', async () => {
    abrirAventura([personagem('a', null)])
    parar = iniciarMidiaDosPersonagens(async () => ref('9'))
    useAdventureStore.getState().salvarPersonagem(personagem('a', RETRATO))
    await esperar()
    expect(personagensAgora()[0]?.retrato).toBe(ref('9'))
  })

  it('disco recusou: a embutida fica e não é tentada de novo a cada mudança', async () => {
    let tentativas = 0
    abrirAventura([personagem('a', RETRATO)])
    parar = iniciarMidiaDosPersonagens(async () => {
      tentativas += 1
      throw new Error('disco cheio')
    })
    await esperar()
    useAdventureStore.getState().ajustarPersonagem('a', (atual) => ({ ...atual, descricao: 'mudou' }))
    await esperar()
    expect(personagensAgora()[0]?.retrato).toBe(RETRATO)
    expect(tentativas).toBe(1)
  })

  it('o que mudou enquanto gravava não é desfeito', async () => {
    let soltar: (ref: string) => void = () => undefined
    abrirAventura([personagem('a', RETRATO)])
    parar = iniciarMidiaDosPersonagens(
      () =>
        new Promise<string>((resolve) => {
          soltar = resolve
        }),
    )
    // O mestre tirou o retrato antes de a gravação terminar.
    useAdventureStore.getState().salvarPersonagem(personagem('a', null))
    soltar(ref('1'))
    await esperar()
    expect(personagensAgora()[0]?.retrato).toBeNull()
  })

  it('mapa solto (sem aventura) não faz nada', async () => {
    parar = iniciarMidiaDosPersonagens(async () => ref('1'))
    useAdventureStore.setState({ adventure: null })
    await esperar()
    expect(useAdventureStore.getState().adventure).toBeNull()
  })
})
