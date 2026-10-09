import { describe, expect, it } from 'vitest'
import {
  decidirDepoisDaProcura,
  MENSAGEM_SALA_ABERTA,
  MENSAGEM_SEM_CONEXAO,
  percentualBaixado,
  portaDoTauri,
  textoEmDia,
  type ResultadoDaProcura,
} from './atualizacao'

const base: ResultadoDaProcura = {
  origem: 'abertura',
  salaAberta: false,
  adiadaNestaAbertura: false,
  achada: { versao: '0.4.20', notas: '  Mapa mais rápido.\n' },
  versaoAtual: null,
  falhou: false,
}

describe('decidirDepoisDaProcura', () => {
  it('versão nova na abertura vira aviso, com as notas aparadas', () => {
    expect(decidirDepoisDaProcura(base)).toEqual({ tipo: 'disponivel', versao: '0.4.20', notas: 'Mapa mais rápido.' })
  })

  it('"Depois" cala a procura sozinha desta abertura, mas não o botão', () => {
    expect(decidirDepoisDaProcura({ ...base, adiadaNestaAbertura: true })).toEqual({ tipo: 'parado' })
    expect(decidirDepoisDaProcura({ ...base, adiadaNestaAbertura: true, origem: 'botao' }).tipo).toBe('disponivel')
  })

  it('sala aberta nunca mostra aviso; pelo botão explica por quê', () => {
    expect(decidirDepoisDaProcura({ ...base, salaAberta: true })).toEqual({ tipo: 'parado' })
    expect(decidirDepoisDaProcura({ ...base, salaAberta: true, origem: 'botao' })).toEqual({ tipo: 'aviso', mensagem: MENSAGEM_SALA_ABERTA })
  })

  it('erro na abertura é silêncio; pelo botão vira aviso curto', () => {
    const falha = { ...base, achada: null, falhou: true }
    expect(decidirDepoisDaProcura(falha)).toEqual({ tipo: 'parado' })
    expect(decidirDepoisDaProcura({ ...falha, origem: 'botao' })).toEqual({ tipo: 'aviso', mensagem: MENSAGEM_SEM_CONEXAO })
  })

  it('sem versão nova: silêncio na abertura, "em dia" pelo botão', () => {
    const nada = { ...base, achada: null, versaoAtual: '0.4.19' }
    expect(decidirDepoisDaProcura(nada)).toEqual({ tipo: 'parado' })
    expect(decidirDepoisDaProcura({ ...nada, origem: 'botao' })).toEqual({ tipo: 'em-dia', versaoAtual: '0.4.19' })
  })
})

describe('percentualBaixado', () => {
  it('arredonda e prende entre 0 e 100', () => {
    expect(percentualBaixado(0, 200)).toBe(0)
    expect(percentualBaixado(101, 200)).toBe(51)
    expect(percentualBaixado(250, 200)).toBe(100)
  })

  it('sem tamanho conhecido (null, 0, NaN) não inventa porcentagem', () => {
    expect(percentualBaixado(10, null)).toBeNull()
    expect(percentualBaixado(10, 0)).toBeNull()
    expect(percentualBaixado(10, Number.NaN)).toBeNull()
  })
})

describe('textoEmDia', () => {
  it('diz a versão quando a conhece', () => {
    expect(textoEmDia('0.4.19')).toBe('Você está na versão mais nova (0.4.19).')
    expect(textoEmDia(null)).toBe('Você está na versão mais nova.')
  })
})

describe('portaDoTauri fora do app', () => {
  it('não se diz disponível no jsdom (sem a marca do Tauri)', () => {
    expect(portaDoTauri.disponivel()).toBe(false)
  })
})
