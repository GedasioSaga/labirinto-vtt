import { describe, expect, it } from 'vitest'
import {
  cabineAposViagem,
  cabineDaParada,
  cabineNaParada,
  cabinesDoArquivo,
  comCabineEm,
  comParada,
  novaCabine,
  type CabineDeTransporte,
} from './cabine'

/**
 * CABINE DE TRANSPORTE — as regras puras: a cabine tem uma posição só, e a
 * parada diz "aqui" ou "longe". Plano: `docs/planos/cabine-de-transporte-p.md`.
 */

const TERREO = { sceneId: 'cena-terreo', pinId: 'espinha-terreo' }
const TOPO = { sceneId: 'cena-topo', pinId: 'espinha-topo' }
const PORAO = { sceneId: 'cena-porao', pinId: 'espinha-porao' }

function espinha(atual: CabineDeTransporte['atual'] = TERREO): CabineDeTransporte {
  return { id: 'cab-espinha', nome: 'Espinha', paradas: [TERREO, TOPO, PORAO], atual }
}

describe('cabinesDoArquivo (leitura do adventure.json)', () => {
  it('aventura antiga, sem a chave: fica sem a chave', () => {
    expect(cabinesDoArquivo(undefined)).toBeUndefined()
  })

  it('cabine boa volta igual', () => {
    expect(cabinesDoArquivo([espinha()])).toEqual([espinha()])
  })

  it('arquivo torto é limpo: parada fora da forma sai, repetida sai, atual que não é parada vira null', () => {
    const lido = cabinesDoArquivo([
      { id: 'cab-1', nome: '  ', paradas: [TERREO, { sceneId: 'x' }, TERREO, TOPO], atual: PORAO },
      { id: '', nome: 'sem id', paradas: [TERREO], atual: TERREO },
      'lixo',
      { id: 'cab-1', nome: 'repetida', paradas: [TOPO], atual: TOPO },
    ])
    expect(lido).toEqual([{ id: 'cab-1', nome: 'cab-1', paradas: [TERREO, TOPO], atual: null }])
  })
})

describe('cabineNaParada: o que a parada diz', () => {
  it('a parada onde a cabine está diz "aqui"; as outras dizem "longe"', () => {
    const cabines = [espinha(TOPO)]
    expect(cabineNaParada(cabines, TOPO.sceneId, TOPO.pinId)).toBe('aqui')
    expect(cabineNaParada(cabines, TERREO.sceneId, TERREO.pinId)).toBe('longe')
    expect(cabineNaParada(cabines, PORAO.sceneId, PORAO.pinId)).toBe('longe')
  })

  it('pino que não é parada, mapa solto (sem cena) ou aventura sem cabine: null', () => {
    expect(cabineNaParada([espinha()], TERREO.sceneId, 'outro-pino')).toBeNull()
    expect(cabineNaParada([espinha()], null, TERREO.pinId)).toBeNull()
    expect(cabineNaParada(undefined, TERREO.sceneId, TERREO.pinId)).toBeNull()
  })

  it('cabine em lugar nenhum: toda parada diz "longe"', () => {
    expect(cabineNaParada([espinha(null)], TERREO.sceneId, TERREO.pinId)).toBe('longe')
    expect(cabineDaParada([espinha(null)], TERREO.sceneId, TERREO.pinId)?.id).toBe('cab-espinha')
  })
})

describe('cabineAposViagem: quem passa leva a cabine', () => {
  it('de uma parada com a cabine para outra parada da mesma cabine: a cabine vai para a chegada', () => {
    expect(cabineAposViagem([espinha(TERREO)], TERREO, TOPO)).toEqual({ cabineId: 'cab-espinha', parada: TOPO })
  })

  it('chegada que não é parada da cabine, ou partida que não é parada: a cabine não anda', () => {
    expect(cabineAposViagem([espinha(TERREO)], TERREO, { sceneId: 'cena-x', pinId: 'p' })).toBeNull()
    expect(cabineAposViagem([espinha(TERREO)], { sceneId: 'cena-x', pinId: 'p' }, TOPO)).toBeNull()
  })

  it('a cabine não estava na partida: não anda', () => {
    expect(cabineAposViagem([espinha(PORAO)], TERREO, TOPO)).toBeNull()
  })
})

describe('mudanças do mestre', () => {
  it('novaCabine nasce com a parada e a cabine nela; nome vazio não cria', () => {
    const nova = novaCabine('  Cesto do poço ', TERREO)
    expect(nova).toMatchObject({ nome: 'Cesto do poço', paradas: [TERREO], atual: TERREO })
    expect(nova?.id.length).toBeGreaterThan(0)
    expect(novaCabine('   ', TERREO)).toBeNull()
  })

  it('comParada põe a parada numa cabine e a tira de qualquer outra', () => {
    const cesto: CabineDeTransporte = { id: 'cab-cesto', nome: 'Cesto', paradas: [PORAO], atual: PORAO }
    const depois = comParada([{ ...espinha(TERREO), paradas: [TERREO, TOPO] }, cesto], PORAO, 'cab-espinha')
    expect(depois?.find((c) => c.id === 'cab-cesto')).toEqual({ id: 'cab-cesto', nome: 'Cesto', paradas: [], atual: null })
    expect(depois?.find((c) => c.id === 'cab-espinha')?.paradas).toEqual([TERREO, TOPO, PORAO])
  })

  it('comParada(null) tira a parada; se a cabine estava nela, vai para a primeira que sobrou', () => {
    const depois = comParada([espinha(TERREO)], TERREO, null)
    expect(depois).toEqual([{ id: 'cab-espinha', nome: 'Espinha', paradas: [TOPO, PORAO], atual: TOPO }])
  })

  it('comParada que não muda nada devolve null', () => {
    expect(comParada([espinha()], TOPO, 'cab-espinha')).toBeNull()
    expect(comParada([espinha()], { sceneId: 'cena-x', pinId: 'p' }, null)).toBeNull()
  })

  it('primeira parada de uma cabine que estava em lugar nenhum recebe a cabine', () => {
    const vazia: CabineDeTransporte = { id: 'cab-v', nome: 'Monta-livros', paradas: [], atual: null }
    expect(comParada([vazia], TOPO, 'cab-v')).toEqual([{ ...vazia, paradas: [TOPO], atual: TOPO }])
  })

  it('comCabineEm só move para uma parada da própria cabine', () => {
    expect(comCabineEm([espinha(TERREO)], 'cab-espinha', PORAO)).toEqual([espinha(PORAO)])
    expect(comCabineEm([espinha(TERREO)], 'cab-espinha', { sceneId: 'cena-x', pinId: 'p' })).toBeNull()
    expect(comCabineEm([espinha(TERREO)], 'cab-espinha', TERREO)).toBeNull()
    expect(comCabineEm([espinha(TERREO)], 'nao-existe', TOPO)).toBeNull()
  })
})
