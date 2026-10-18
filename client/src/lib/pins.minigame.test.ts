/**
 * O DESAFIO DO PINO por jogo: cópia funda (o pino e o convite não dividem
 * objeto com a constante nem entre si), o padrão de cada jogo, a troca de
 * jogo que o painel do mestre usa e o nome do pino no mapa.
 */
import { describe, expect, it } from 'vitest'
import { MINIGAME_PADRAO, type MinigameDanca } from '../minigames/danca/tipos'
import { MINIGAME_PESCA_PADRAO, type MinigamePesca } from '../minigames/pesca/tipos'
import { buildPin } from './mapFactory'
import { copiarMinigame, minigamePadraoDo, pinKindChangePatch, pinSummary, sameMinigame, trocarJogoDoMinigame } from './pins'

const PESCA: MinigamePesca = { ...MINIGAME_PESCA_PADRAO, npc: 'Dona Cota', entrada: 'pino', lances: 5 }

const DANCA_IMPORTADA: MinigameDanca = {
  ...MINIGAME_PADRAO,
  musica: {
    tipo: 'arquivo',
    midia: `midia:${'b'.repeat(64)}.ogg`,
    nome: 'Xote',
    bpm: 100,
    primeiraBatida: 0.1,
    fase4: 0,
    duracaoS: 60,
    coreografias: { diversao: [{ t: 1, lane: 0, len: 0, sub: 4 }], expert: [{ t: 2, lane: 3, len: 0.5, sub: 8 }] },
  },
}

describe('copiarMinigame', () => {
  it('a pesca: cópia igual por valor, sem dividir prêmio nem consequência', () => {
    const copia = copiarMinigame(PESCA)
    expect(copia).toEqual(PESCA)
    expect(copia).not.toBe(PESCA)
    expect(copia.premio).not.toBe(PESCA.premio)
    expect(copia.consequencia).not.toBe(PESCA.consequencia)
    // Nada da dança aparece na cópia da pesca.
    expect(Object.keys(copia).sort()).toEqual(Object.keys(PESCA).sort())
  })

  it('a dança: continua funda, até as setas da coreografia', () => {
    const copia = copiarMinigame(DANCA_IMPORTADA)
    expect(copia).toEqual(DANCA_IMPORTADA)
    expect(copia.premio).not.toBe(DANCA_IMPORTADA.premio)
    if (copia.musica.tipo !== 'arquivo' || DANCA_IMPORTADA.musica.tipo !== 'arquivo') throw new Error('a música tem de ser importada')
    expect(copia.musica.coreografias.diversao[0]).not.toBe(DANCA_IMPORTADA.musica.coreografias.diversao[0])
  })
})

describe('minigamePadraoDo e trocarJogoDoMinigame', () => {
  it('o padrão de cada jogo é o do protótipo, em cópia', () => {
    const danca = minigamePadraoDo('danca')
    const pesca = minigamePadraoDo('pesca')
    expect(danca).toEqual(MINIGAME_PADRAO)
    expect(danca).not.toBe(MINIGAME_PADRAO)
    expect(pesca).toEqual(MINIGAME_PESCA_PADRAO)
    expect(pesca).not.toBe(MINIGAME_PESCA_PADRAO)
    expect(pesca.premio).not.toBe(MINIGAME_PESCA_PADRAO.premio)
  })

  it('o padrão da pesca é o do protótipo aprovado: Bento, Poço Afogado, Mestre chama, 3 lances', () => {
    expect(MINIGAME_PESCA_PADRAO).toMatchObject({ npc: 'Bento, o barqueiro', lago: 'Poço Afogado', entrada: 'mestre', lances: 3, permitida: 'escolha' })
  })

  it('trocar de jogo põe o padrão do outro jogo', () => {
    expect(trocarJogoDoMinigame(MINIGAME_PADRAO, 'pesca')).toEqual(MINIGAME_PESCA_PADRAO)
    expect(trocarJogoDoMinigame(PESCA, 'danca')).toEqual(MINIGAME_PADRAO)
    // O padrão novo é cópia: mexer nele não alcança a constante.
    expect(trocarJogoDoMinigame(PESCA, 'danca')).not.toBe(MINIGAME_PADRAO)
  })

  it('escolher o jogo que o pino já tem não apaga o desafio montado', () => {
    expect(trocarJogoDoMinigame(PESCA, 'pesca')).toBe(PESCA)
    expect(trocarJogoDoMinigame(DANCA_IMPORTADA, 'danca')).toBe(DANCA_IMPORTADA)
  })

  it('ir e voltar de jogo é diferente por valor (o desfazer guarda o passo)', () => {
    expect(sameMinigame(PESCA, trocarJogoDoMinigame(PESCA, 'danca'))).toBe(false)
    expect(sameMinigame(PESCA, copiarMinigame(PESCA))).toBe(true)
    expect(sameMinigame(PESCA, { ...PESCA, lances: 4 })).toBe(false)
  })
})

describe('o pino de minigame por jogo', () => {
  const pino = buildPin('m', { x: 0, y: 0 }, 'minigame')

  it('o nome no mapa diz o jogo', () => {
    expect(pinSummary(pino)).toBe('Dança')
    expect(pinSummary({ ...pino, minigame: PESCA })).toBe('Pesca')
    expect(pinSummary({ ...pino, minigame: undefined })).toBe('Minigame')
  })

  it('escolher de novo o tipo minigame não troca a pesca pela dança', () => {
    expect(pinKindChangePatch({ ...pino, minigame: PESCA }, 'minigame').minigame).toBe(PESCA)
  })
})
