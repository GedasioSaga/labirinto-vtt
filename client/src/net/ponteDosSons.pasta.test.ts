// @vitest-environment node
/**
 * SONS AO VIVO, F5: a pasta da aventura que a aba Sons informa chega à rede
 * registrada (a ponte da sala), uma vez por troca; a rede que se registra
 * depois recebe a de agora. O resto da ponte está em `ponteDosSons.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { informarPastaDosSons, registrarRedeDosSons, type RedeDosSons } from './ponteDosSons'

function rede() {
  return {
    tocarSomAoVivo: vi.fn<RedeDosSons['tocarSomAoVivo']>(() => ({ ok: true, enviados: 1 })),
    pararSomAoVivo: vi.fn<RedeDosSons['pararSomAoVivo']>(() => 1),
    pararTodosOsSons: vi.fn<RedeDosSons['pararTodosOsSons']>(() => 1),
    volumeDoSom: vi.fn<RedeDosSons['volumeDoSom']>(() => 1),
    precarregarSonsAoVivo: vi.fn<RedeDosSons['precarregarSonsAoVivo']>(() => 1),
    falhasDoSom: vi.fn<RedeDosSons['falhasDoSom']>(() => 0),
    midiasDeSomLiberadas: vi.fn<RedeDosSons['midiasDeSomLiberadas']>(() => []),
    mudarPastaDosSons: vi.fn<RedeDosSons['mudarPastaDosSons']>(),
  } satisfies RedeDosSons
}

const desfazer: (() => void)[] = []

afterEach(() => {
  for (const tirar of desfazer.splice(0)) tirar()
  informarPastaDosSons(null)
})

describe('ponte dos sons: a pasta da aventura', () => {
  it('rede registrada depois recebe a pasta de agora; sem pasta, não recebe nada', () => {
    const semPasta = rede()
    desfazer.push(registrarRedeDosSons(semPasta))
    expect(semPasta.mudarPastaDosSons).not.toHaveBeenCalled()
    informarPastaDosSons('C:/Aventuras/Cripta')
    const depois = rede()
    desfazer.push(registrarRedeDosSons(depois))
    expect(depois.mudarPastaDosSons).toHaveBeenCalledExactlyOnceWith('C:/Aventuras/Cripta')
  })

  it('cada troca vai uma vez à rede de agora; a mesma pasta de novo não repete', () => {
    const daSala = rede()
    desfazer.push(registrarRedeDosSons(daSala))
    informarPastaDosSons('C:/A')
    informarPastaDosSons('C:/A')
    informarPastaDosSons('C:/B')
    informarPastaDosSons(null)
    expect(daSala.mudarPastaDosSons.mock.calls).toEqual([['C:/A'], ['C:/B'], [null]])
  })

  it('a rede que saiu não ouve mais as trocas', () => {
    const daSala = rede()
    const tirar = registrarRedeDosSons(daSala)
    tirar()
    informarPastaDosSons('C:/A')
    expect(daSala.mudarPastaDosSons).not.toHaveBeenCalled()
  })
})
