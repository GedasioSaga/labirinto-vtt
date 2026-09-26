import { describe, expect, it } from 'vitest'
import {
  cabineNaParada,
  cabinesDoArquivo,
  comCabineEm,
  comChamada,
  comParada,
  ocupantesDasCabines,
  semFila,
  type CabineDeTransporte,
  type ChamadaDeCabine,
} from './cabine'

/**
 * CABINE DE TRANSPORTE — a FILA de chamadas e o OCUPANTE. Quem está numa
 * parada sem a cabine a chama; a chamada entra na fila, uma por parada, na
 * ordem em que chegou; a cabine que chega a uma parada atende a chamada dela.
 * O ocupante (quem embarcou e espera o mestre) deixa a parada "ocupada" para
 * os outros. Plano: `docs/planos/cabine-de-transporte-p.md`.
 */

const TERREO = { sceneId: 'cena-terreo', pinId: 'espinha-terreo' }
const TOPO = { sceneId: 'cena-topo', pinId: 'espinha-topo' }
const PORAO = { sceneId: 'cena-porao', pinId: 'espinha-porao' }

function espinha(extra: Partial<CabineDeTransporte> = {}): CabineDeTransporte {
  return { id: 'cab-espinha', nome: 'Espinha', paradas: [TERREO, TOPO, PORAO], atual: TERREO, ...extra }
}

function chamada(parada: typeof TOPO, tokenId: string, nome: string): ChamadaDeCabine {
  return { parada, tokenId, nome }
}

describe('comChamada (quem chama entra na fila)', () => {
  it('chamada de uma parada sem a cabine entra no fim da fila, na ordem de chegada', () => {
    const uma = comChamada([espinha()], 'cab-espinha', chamada(TOPO, 'bia', 'Bia'))
    expect(uma?.[0].fila).toEqual([chamada(TOPO, 'bia', 'Bia')])
    const duas = comChamada(uma ?? [], 'cab-espinha', chamada(PORAO, 'caio', 'Caio'))
    expect(duas?.[0].fila).toEqual([chamada(TOPO, 'bia', 'Bia'), chamada(PORAO, 'caio', 'Caio')])
  })

  it('a mesma parada não entra duas vezes: quem chamou primeiro fica com a vez', () => {
    const uma = comChamada([espinha()], 'cab-espinha', chamada(TOPO, 'bia', 'Bia')) ?? []
    expect(comChamada(uma, 'cab-espinha', chamada(TOPO, 'duda', 'Duda'))).toBeNull()
    expect(uma[0].fila).toEqual([chamada(TOPO, 'bia', 'Bia')])
  })

  it('não entra: parada onde a cabine já está, pino que não é parada dela, cabine que não existe', () => {
    expect(comChamada([espinha()], 'cab-espinha', chamada(TERREO, 'ana', 'Ana'))).toBeNull()
    expect(comChamada([espinha()], 'cab-espinha', chamada({ sceneId: 'cena-x', pinId: 'outro' }, 'ana', 'Ana'))).toBeNull()
    expect(comChamada([espinha()], 'cab-nenhuma', chamada(TOPO, 'ana', 'Ana'))).toBeNull()
  })
})

describe('cabineNaParada com fila e ocupante', () => {
  it('parada chamada, sem a cabine, diz "chamada"; a que ninguém chamou continua "longe"', () => {
    const cabines = comChamada([espinha()], 'cab-espinha', chamada(TOPO, 'bia', 'Bia')) ?? []
    expect(cabineNaParada(cabines, TOPO.sceneId, TOPO.pinId)).toBe('chamada')
    expect(cabineNaParada(cabines, PORAO.sceneId, PORAO.pinId)).toBe('longe')
    expect(cabineNaParada(cabines, TERREO.sceneId, TERREO.pinId)).toBe('aqui')
  })

  it('cabine com ocupante: a parada onde ela está diz "ocupada"; sem ocupante, "aqui"', () => {
    const ocupadas = new Set(['cab-espinha'])
    expect(cabineNaParada([espinha()], TERREO.sceneId, TERREO.pinId, ocupadas)).toBe('ocupada')
    expect(cabineNaParada([espinha()], TOPO.sceneId, TOPO.pinId, ocupadas)).toBe('longe')
    expect(cabineNaParada([espinha()], TERREO.sceneId, TERREO.pinId, new Set())).toBe('aqui')
  })
})

describe('a cabine anda e atende', () => {
  it('a cabine que chega a uma parada tira a chamada dela da fila e mantém as outras na ordem', () => {
    const fila = [chamada(TOPO, 'bia', 'Bia'), chamada(PORAO, 'caio', 'Caio')]
    const movida = comCabineEm([espinha({ fila })], 'cab-espinha', TOPO)
    expect(movida?.[0].atual).toEqual(TOPO)
    expect(movida?.[0].fila).toEqual([chamada(PORAO, 'caio', 'Caio')])
  })

  it('a última chamada atendida leva a chave junto: a cabine sem fila volta ao formato de antes', () => {
    const movida = comCabineEm([espinha({ fila: [chamada(TOPO, 'bia', 'Bia')] })], 'cab-espinha', TOPO)
    expect(movida?.[0]).toEqual({ id: 'cab-espinha', nome: 'Espinha', paradas: [TERREO, TOPO, PORAO], atual: TOPO })
  })

  it('a parada que sai da cabine leva a chamada dela junto', () => {
    const fila = [chamada(TOPO, 'bia', 'Bia'), chamada(PORAO, 'caio', 'Caio')]
    const sem = comParada([espinha({ fila })], TOPO, null)
    expect(sem?.[0].paradas).toEqual([TERREO, PORAO])
    expect(sem?.[0].fila).toEqual([chamada(PORAO, 'caio', 'Caio')])
  })

  it('"Limpar a fila": a cabine fica sem chamadas; sem fila, nada muda', () => {
    const limpa = semFila([espinha({ fila: [chamada(TOPO, 'bia', 'Bia')] })], 'cab-espinha')
    expect(limpa?.[0]).toEqual(espinha())
    expect(semFila([espinha()], 'cab-espinha')).toBeNull()
  })
})

describe('ocupantesDasCabines (painel do mestre)', () => {
  it('cada cabine com alguém dentro dá o nome de quem embarcou; quem não embarcou não aparece', () => {
    expect(ocupantesDasCabines([{ name: 'Ana', naCabine: 'cab-espinha' }, { name: 'Bia' }, { name: 'Caio', naCabine: 'cab-cesto' }])).toEqual({
      'cab-espinha': 'Ana',
      'cab-cesto': 'Caio',
    })
    expect(ocupantesDasCabines([])).toEqual({})
  })
})

describe('cabinesDoArquivo com fila', () => {
  it('fila boa volta igual', () => {
    const fila = [chamada(TOPO, 'bia', 'Bia'), chamada(PORAO, 'caio', 'Caio')]
    expect(cabinesDoArquivo([espinha({ fila })])).toEqual([espinha({ fila })])
  })

  it('fila torta é limpa: chamada fora da forma, de parada que não é dela, onde a cabine está ou repetida sai', () => {
    const lido = cabinesDoArquivo([
      espinha({
        fila: [
          chamada(TOPO, 'bia', '  Bia  '),
          chamada(TOPO, 'duda', 'Duda'),
          chamada(TERREO, 'ana', 'Ana'),
          chamada({ sceneId: 'cena-x', pinId: 'outro' }, 'eva', 'Eva'),
          { parada: PORAO, tokenId: 7, nome: 'sem token' } as unknown as ChamadaDeCabine, // arquivo torto de propósito: é o caso que a leitura limpa
          'lixo' as unknown as ChamadaDeCabine, // idem
        ],
      }),
    ])
    expect(lido?.[0].fila).toEqual([chamada(TOPO, 'bia', 'Bia')])
  })

  it('fila vazia ou ausente: a cabine volta sem a chave', () => {
    expect(cabinesDoArquivo([espinha({ fila: [] })])).toEqual([espinha()])
  })
})
