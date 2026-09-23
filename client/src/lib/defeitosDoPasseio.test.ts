import { describe, expect, it } from 'vitest'
import { corridorDraftOnShapeChange } from './floorTool'
import { pinKindAfterShortcut } from './pins'
import { ErroQueEnsina } from './erroQueEnsina'
import { ARQUIVO_SO_NO_APP_MESSAGE, motivoDaFalhaDeArquivo, temPonteDoApp } from './foraDoApp'

// Regras puras de três defeitos do passeio de 20/09/2026 (achados 1, 7 e 11).

describe('corridorDraftOnShapeChange — trocar de forma com o Corredor aberto', () => {
  it('sem traço aberto não há nada a fazer', () => {
    expect(corridorDraftOnShapeChange([])).toBe('nada')
  })

  it('um ponto só é descartado (e quem chama avisa)', () => {
    expect(corridorDraftOnShapeChange([{ x: 64, y: 64 }])).toBe('descartar')
  })

  it('o mesmo ponto repetido (duplo clique) ainda é um ponto só', () => {
    expect(corridorDraftOnShapeChange([{ x: 64, y: 64 }, { x: 64, y: 64 }])).toBe('descartar')
  })

  it('dois pontos distintos já são corredor: finaliza', () => {
    expect(corridorDraftOnShapeChange([{ x: 0, y: 0 }, { x: 128, y: 0 }])).toBe('finalizar')
  })

  it('três pontos em L finalizam', () => {
    expect(
      corridorDraftOnShapeChange([
        { x: 448, y: 320 },
        { x: 832, y: 320 },
        { x: 832, y: 640 },
      ]),
    ).toBe('finalizar')
  })
})

describe('pinKindAfterShortcut — o ? alterna "!" e "?"', () => {
  it('"!" vira "?" e "?" vira "!"', () => {
    expect(pinKindAfterShortcut('exclamacao')).toBe('interrogacao')
    expect(pinKindAfterShortcut('interrogacao')).toBe('exclamacao')
  })

  it('o pino de viagem não muda: perderia o destino por uma tecla', () => {
    expect(pinKindAfterShortcut('viagem')).toBeNull()
  })
})

describe('motivoDaFalhaDeArquivo — salvar fora do app', () => {
  const semPonte = new TypeError("Cannot read properties of undefined (reading 'invoke')")

  it('sem a ponte do app, explica em português e esconde o texto técnico', () => {
    const texto = motivoDaFalhaDeArquivo(semPonte, false)
    expect(texto).toBe(ARQUIVO_SO_NO_APP_MESSAGE)
    expect(texto).toMatch(/aplicativo/)
    expect(texto).not.toMatch(/Cannot read properties|invoke|undefined/i)
  })

  it('dentro do app, o erro real continua indo para a tela', () => {
    expect(motivoDaFalhaDeArquivo(new Error('EACCES: permission denied'), true)).toBe('EACCES: permission denied')
    expect(motivoDaFalhaDeArquivo('falhou', true)).toBe('falhou')
  })

  it('erro que ensina fala primeiro, com ou sem a ponte', () => {
    const ensina = new ErroQueEnsina('escolha uma imagem para ele antes de guardar no acervo')
    expect(motivoDaFalhaDeArquivo(ensina, false)).toBe(ensina.message)
    expect(motivoDaFalhaDeArquivo(ensina, true)).toBe(ensina.message)
  })

  it('temPonteDoApp olha a ponte (__TAURI_INTERNALS__), não a marca isTauri', () => {
    expect(temPonteDoApp({})).toBe(false)
    expect(temPonteDoApp({ isTauri: true })).toBe(false)
    expect(temPonteDoApp({ __TAURI_INTERNALS__: {} })).toBe(true)
  })
})
