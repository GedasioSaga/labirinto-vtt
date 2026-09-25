import { describe, expect, it } from 'vitest'
import {
  ESPERA_MINUTOS_MAX,
  ESPERA_MINUTOS_OPCOES,
  isWaitMinutes,
  minutosRestantes,
  rotuloDaFicha,
  textoDaEspera,
  textoDaEsperaParaOMestre,
  textoDoFimDaEspera,
} from './encontroMarcado'

/**
 * ENCONTRO MARCADO — as frases que o jogador lê. Tudo o que aparece aqui veio
 * do próprio jogador (quem ele espera, onde) ou do relógio: nada do mapa.
 */
describe('encontro marcado: prazo', () => {
  it('só aceita minuto inteiro entre 1 e o teto; as opções da tela cabem todas', () => {
    expect(isWaitMinutes(15)).toBe(true)
    expect(isWaitMinutes(1)).toBe(true)
    expect(isWaitMinutes(ESPERA_MINUTOS_MAX)).toBe(true)
    expect(isWaitMinutes(0)).toBe(false)
    expect(isWaitMinutes(-5)).toBe(false)
    expect(isWaitMinutes(2.5)).toBe(false)
    expect(isWaitMinutes(ESPERA_MINUTOS_MAX + 1)).toBe(false)
    expect(isWaitMinutes('15')).toBe(false)
    expect(isWaitMinutes(Number.NaN)).toBe(false)
    expect(ESPERA_MINUTOS_OPCOES.every(isWaitMinutes)).toBe(true)
  })

  it('arredonda o que falta para cima: 11 min e 1 s ainda são 12 minutos', () => {
    expect(minutosRestantes(11 * 60_000 + 1000)).toBe(12)
    expect(minutosRestantes(60_000)).toBe(1)
    expect(minutosRestantes(1)).toBe(1)
    expect(minutosRestantes(0)).toBe(0)
    expect(minutosRestantes(-3000)).toBe(0)
  })
})

describe('encontro marcado: frases', () => {
  it('a espera ativa diz quem, onde e quanto falta', () => {
    expect(textoDaEspera({ who: 'Bia', where: 'no portão' }, 12 * 60_000)).toBe('Esperando Bia · no portão · faltam 12 min')
    expect(textoDaEspera({ who: 'Bia' }, 60_000)).toBe('Esperando Bia · falta 1 min')
  })

  it('sem colega nem lugar, ainda é uma frase inteira', () => {
    expect(textoDaEspera({}, 5 * 60_000)).toBe('Esperando alguém · faltam 5 min')
    expect(textoDaEspera({ where: 'na ponte' }, 0)).toBe('Esperando alguém · na ponte · o prazo acabou')
  })

  it('o aviso do fim diz o que aconteceu', () => {
    expect(textoDoFimDaEspera({ reason: 'met', who: 'Bia' })).toBe('Bia chegou. Você parou de esperar.')
    expect(textoDoFimDaEspera({ reason: 'expired', who: 'Bia' })).toBe('O prazo acabou: Bia não apareceu.')
    expect(textoDoFimDaEspera({ reason: 'expired' })).toBe('O prazo acabou: você parou de esperar.')
    expect(textoDoFimDaEspera({ reason: 'left' })).toBe('Você saiu da cena: a espera acabou.')
  })

  it('o mestre lê quem espera quem, onde e até que horas (hora da máquina dele)', () => {
    const ate = new Date(2026, 8, 24, 14, 32).getTime()
    expect(textoDaEsperaParaOMestre({ who: 'Bia', where: 'no portão', until: ate })).toBe('esperando Bia · no portão · até 14:32')
    expect(textoDaEsperaParaOMestre({ until: ate })).toBe('esperando alguém · até 14:32')
  })

  it('a ficha que espera ganha a marca no nome; sem nome, fica só a marca', () => {
    expect(rotuloDaFicha('Duda', true)).toBe('Duda · esperando')
    expect(rotuloDaFicha('Duda', false)).toBe('Duda')
    expect(rotuloDaFicha('', true)).toBe('esperando')
  })
})
