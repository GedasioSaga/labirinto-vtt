/**
 * PRELÚDIO F3b, correções da revisão: o quadro da aba Quadro da sessão não muda
 * com o nome; o "Citar o quadro" acha os quadros da sessão mesmo com o filtro em
 * outra campanha dela; e quem relê o quadro vê o que o mestre deixou (a gravação
 * pendente termina antes, e a recusada vale). Dados inventados (o repositório é
 * público).
 */
import { describe, expect, it, vi } from 'vitest'
import { quadroNovo } from '../../lib/preparo/quadros'
import type { Quadro } from '../../lib/preparo/tipos'
import { agendarGravacaoDeFora, gravacaoPendente, usePreludio } from '../estado/preludio'
import { chaveDaGravacaoDoQuadro, gravarQuadroAtual, lerQuadroAtual, quadroDaSessao, quadrosParaCitar, useQuadros, type ResumoDoQuadro } from './estadoDosQuadros'

const discoFalso = vi.hoisted(() => ({ arquivos: new Map<string, string>(), recusar: false }))

vi.mock('../../lib/preparo/quadros', async (original) => ({
  ...(await original<typeof import('../../lib/preparo/quadros')>()),
  lerQuadro: vi.fn(async (id: string) => {
    const texto = discoFalso.arquivos.get(id)
    return texto === undefined ? { estado: 'novo' } : { estado: 'ok', valor: JSON.parse(texto) as Quadro, aviso: null }
  }),
  gravarQuadro: vi.fn(async (id: string, quadro: Quadro) => {
    if (discoFalso.recusar) throw new Error('disco cheio (inventado)')
    discoFalso.arquivos.set(id, JSON.stringify(quadro))
  }),
}))

const SESSAO = 'vb-sessao-inventada'
const VAZIO = { formas: 0, cartoes: 0, imagens: 0, setas: 0, molduras: 0, salas: 0, textos: 0 }

function resumo(id: string, nome: string, extra: Partial<ResumoDoQuadro> = {}): ResumoDoQuadro {
  return { id, nome, campanhaId: 'cp-ambar', sessaoId: null, contagem: VAZIO, planta: false, aviso: null, ...extra }
}

describe('o quadro da sessão e a lista do "Citar o quadro"', () => {
  it('a aba Quadro fica no quadro de menor id mesmo quando o nome muda; citar acha os da sessão com o filtro em outra campanha dela', () => {
    // Em ordem de nome, como a lista guarda. A sessão tem dois quadros, os dois nascidos na campanha Âmbar.
    useQuadros.setState({
      lista: {
        t: 'pronta',
        quadros: [
          resumo('quadro-zzzz', 'Alfa do farol', { sessaoId: SESSAO }),
          resumo('quadro-bruma', 'Mapa da Bruma', { campanhaId: 'cp-bruma' }),
          resumo('quadro-planta', 'Planta da torre', { campanhaId: null, planta: true }),
          resumo('quadro-ambar', 'Rotas do Âmbar'),
          resumo('quadro-solto', 'Sem campanha', { campanhaId: null }),
          resumo('quadro-ruim', 'quadro-ruim', { campanhaId: null, contagem: null, aviso: 'não abriu' }),
          resumo('quadro-aaaa', 'Zeta do farol', { sessaoId: SESSAO }),
        ],
      },
    })
    expect(quadroDaSessao(useQuadros.getState().lista, SESSAO)?.id).toBe('quadro-aaaa')

    // Renomear para um nome que passa o outro reordena a lista; a aba continua no mesmo quadro.
    useQuadros.getState().renomear('quadro-aaaa', 'Aaa farol')
    const lista = useQuadros.getState().lista
    expect(lista.t === 'pronta' ? lista.quadros[0]?.id : null).toBe('quadro-aaaa')
    expect(quadroDaSessao(lista, SESSAO)?.id).toBe('quadro-aaaa')

    // Filtro na Bruma: o da aba primeiro, o outro da sessão, depois o resto do filtro por nome. Planta e arquivo ruim, nunca.
    expect(quadrosParaCitar(lista, 'cp-bruma', SESSAO).map((quadro) => quadro.id)).toEqual(['quadro-aaaa', 'quadro-zzzz', 'quadro-bruma', 'quadro-solto'])
    // Texto fora de sessão: só o filtro.
    expect(quadrosParaCitar(lista, 'cp-bruma', null).map((quadro) => quadro.id)).toEqual(['quadro-bruma', 'quadro-solto'])
  })
})

describe('reler o quadro', () => {
  it('a gravação que espera o relógio vai ao disco antes da leitura, e a que o disco recusou vale até gravar', async () => {
    const id = 'quadro-inventado'
    const chave = chaveDaGravacaoDoQuadro(id)
    const antes = quadroNovo('Quadro inventado')
    discoFalso.arquivos.set(id, JSON.stringify(antes))

    // A moldura nova espera os 800 ms: o disco ainda tem o de antes, mas quem relê vê a nova.
    const comMoldura: Quadro = { ...antes, nome: 'Com a Cena 3' }
    agendarGravacaoDeFora(chave, () => gravarQuadroAtual(id, comMoldura))
    expect((JSON.parse(discoFalso.arquivos.get(id) ?? '{}') as Quadro).nome).toBe('Quadro inventado')
    expect(await lerQuadroAtual(id)).toMatchObject({ t: 'disco', lido: { estado: 'ok', valor: { nome: 'Com a Cena 3' } } })

    // O disco recusa: quem relê vê o que não gravou, e não o de antes.
    discoFalso.recusar = true
    const recusado: Quadro = { ...antes, nome: 'Com a Cena 4' }
    agendarGravacaoDeFora(chave, () => gravarQuadroAtual(id, recusado))
    expect(await lerQuadroAtual(id)).toEqual({ t: 'naoGravado', quadro: recusado })
    expect(gravacaoPendente(chave)).toBe(true)

    // O disco volta ("Tentar de novo"): grava, e a leitura volta a ser a do disco.
    discoFalso.recusar = false
    expect(await usePreludio.getState().salvarPendentes()).toBe(true)
    expect(await lerQuadroAtual(id)).toMatchObject({ t: 'disco', lido: { valor: { nome: 'Com a Cena 4' } } })
  })
})
