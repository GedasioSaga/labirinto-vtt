/**
 * SONS AO VIVO, fatia F4 (`docs/planos/sons-ao-vivo-2026-10-23.md`, seção 2):
 * os parsers das mensagens de som. O mestre manda tocar, parar, mudar o volume
 * e pré-carregar; o jogador só pode contar que um som não tocou. Parser
 * tolerante: forma errada recusa a mensagem inteira, sem exceção, e o que passa
 * sai como cópia só com os campos conhecidos (o nome do efeito nunca atravessa).
 */
import { describe, expect, it } from 'vitest'
import {
  parsePlayerMessage,
  parseSomFalhou,
  parseSomHostMessage,
  SOM_DESLOCAMENTO_MAX_S,
  SOM_FADE_MAX_MS,
  SOM_PRECARGA_MAX,
} from './protocol'

const ID = `${'a'.repeat(64)}.mp3`
const OUTRO_ID = `${'b'.repeat(64)}.ogg`
const FONTE = { tipo: 'arquivo', midia: ID }
const TOCAR = { type: 'som.tocar', instancia: 'som-1', fonte: FONTE, volume: 0.5, loop: true }

describe('parseSomHostMessage: o que passa', () => {
  it('som.tocar inteiro, com deslocamento', () => {
    expect(parseSomHostMessage({ ...TOCAR, deslocamentoS: 12.5 })).toEqual({ ...TOCAR, deslocamentoS: 12.5 })
  })

  it('som.tocar sem deslocamento (efeito novo) não ganha o campo', () => {
    const msg = parseSomHostMessage({ ...TOCAR, loop: false })
    expect(msg).toEqual({ ...TOCAR, loop: false })
    expect(msg !== null && 'deslocamentoS' in msg).toBe(false)
  })

  it('volume 0 e 1 e deslocamento 0 são as bordas aceitas', () => {
    expect(parseSomHostMessage({ ...TOCAR, volume: 0, deslocamentoS: 0 })).toMatchObject({ volume: 0, deslocamentoS: 0 })
    expect(parseSomHostMessage({ ...TOCAR, volume: 1, deslocamentoS: SOM_DESLOCAMENTO_MAX_S })).toMatchObject({ volume: 1 })
  })

  it('campo a mais (nome do efeito, ref, pasta) cai fora: a cópia só leva o que o jogador precisa', () => {
    const msg = parseSomHostMessage({ ...TOCAR, nome: 'Grito do Lich', pasta: 'Chefes', fonte: { ...FONTE, ref: `midia:${ID}`, nome: 'grito.mp3', bytes: 9 } })
    expect(msg).toEqual(TOCAR)
    expect(JSON.stringify(msg)).not.toMatch(/Lich|Chefes|grito|midia:/)
  })

  it('som.parar, com e sem fade', () => {
    expect(parseSomHostMessage({ type: 'som.parar', instancia: 'som-1' })).toEqual({ type: 'som.parar', instancia: 'som-1' })
    expect(parseSomHostMessage({ type: 'som.parar', instancia: 'som-1', fadeMs: 150 })).toEqual({ type: 'som.parar', instancia: 'som-1', fadeMs: 150 })
  })

  it('som.pararTudo não leva nada', () => {
    expect(parseSomHostMessage({ type: 'som.pararTudo', extra: 1 })).toEqual({ type: 'som.pararTudo' })
  })

  it('som.volume', () => {
    expect(parseSomHostMessage({ type: 'som.volume', instancia: 'som-1', volume: 0.25 })).toEqual({ type: 'som.volume', instancia: 'som-1', volume: 0.25 })
  })

  it('som.precarregar sem repetidos', () => {
    expect(parseSomHostMessage({ type: 'som.precarregar', midias: [ID, OUTRO_ID, ID] })).toEqual({ type: 'som.precarregar', midias: [ID, OUTRO_ID] })
  })

  it('aceita a string JSON crua do transporte? não: só objeto (quem desserializa é a conexão)', () => {
    expect(parseSomHostMessage(JSON.stringify(TOCAR))).toBeNull()
  })
})

describe('parseSomHostMessage: entrada torta é recusada inteira, sem exceção', () => {
  const tortas: [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['número', 42],
    ['lista', [TOCAR]],
    ['objeto vazio', {}],
    ['tipo desconhecido', { type: 'som.outra', instancia: 'som-1' }],
    ['tipo que não é de som', { type: 'scene.note', id: 'n', text: 'x' }],
    // instância
    ['tocar sem instância', { ...TOCAR, instancia: undefined }],
    ['instância vazia', { ...TOCAR, instancia: '' }],
    ['instância comprida demais', { ...TOCAR, instancia: 'x'.repeat(81) }],
    ['instância com barra', { ...TOCAR, instancia: 'a/b' }],
    ['instância com ..', { ...TOCAR, instancia: '../x' }],
    ['instância com HTML', { ...TOCAR, instancia: '<img>' }],
    ['instância número', { ...TOCAR, instancia: 5 }],
    // fonte
    ['tocar sem fonte', { ...TOCAR, fonte: undefined }],
    ['fonte null', { ...TOCAR, fonte: null }],
    ['fonte em texto', { ...TOCAR, fonte: `midia:${ID}` }],
    ['fonte lista', { ...TOCAR, fonte: [ID] }],
    ['youtube com o link no lugar do id (F6: só o id de 11 caracteres)', { ...TOCAR, fonte: { tipo: 'youtube', video: 'https://youtu.be/dQw4w9WgXcQ' } }],
    ['fonte de tipo desconhecido', { ...TOCAR, fonte: { tipo: 'url', midia: ID } }],
    ['fonte só com ref (forma do disco do mestre)', { ...TOCAR, fonte: { tipo: 'arquivo', ref: `midia:${ID}` } }],
    ['midia com prefixo midia:', { ...TOCAR, fonte: { tipo: 'arquivo', midia: `midia:${ID}` } }],
    ['midia caminho', { ...TOCAR, fonte: { tipo: 'arquivo', midia: '../../etc/passwd' } }],
    ['midia caminho do Windows', { ...TOCAR, fonte: { tipo: 'arquivo', midia: 'C:\\aventura\\midia\\grito.mp3' } }],
    ['midia em maiúsculas', { ...TOCAR, fonte: { tipo: 'arquivo', midia: `${'A'.repeat(64)}.mp3` } }],
    ['midia de imagem', { ...TOCAR, fonte: { tipo: 'arquivo', midia: `${'a'.repeat(64)}.png` } }],
    ['midia número', { ...TOCAR, fonte: { tipo: 'arquivo', midia: 7 } }],
    // volume
    ['tocar sem volume', { ...TOCAR, volume: undefined }],
    ['volume negativo', { ...TOCAR, volume: -0.1 }],
    ['volume acima de 1', { ...TOCAR, volume: 1.01 }],
    ['volume NaN', { ...TOCAR, volume: Number.NaN }],
    ['volume Infinity', { ...TOCAR, volume: Number.POSITIVE_INFINITY }],
    ['volume em texto', { ...TOCAR, volume: '0.5' }],
    ['volume null (NaN depois do JSON)', { ...TOCAR, volume: null }],
    // loop
    ['loop em texto', { ...TOCAR, loop: 'true' }],
    ['loop número', { ...TOCAR, loop: 1 }],
    ['tocar sem loop', { ...TOCAR, loop: undefined }],
    // deslocamento
    ['deslocamento negativo', { ...TOCAR, deslocamentoS: -1 }],
    ['deslocamento NaN', { ...TOCAR, deslocamentoS: Number.NaN }],
    ['deslocamento Infinity', { ...TOCAR, deslocamentoS: Number.POSITIVE_INFINITY }],
    ['deslocamento em texto', { ...TOCAR, deslocamentoS: '3' }],
    ['deslocamento null', { ...TOCAR, deslocamentoS: null }],
    ['deslocamento acima do teto', { ...TOCAR, deslocamentoS: SOM_DESLOCAMENTO_MAX_S + 1 }],
    // parar
    ['parar sem instância', { type: 'som.parar' }],
    ['parar com instância torta', { type: 'som.parar', instancia: 'a b' }],
    ['fade negativo', { type: 'som.parar', instancia: 'som-1', fadeMs: -1 }],
    ['fade NaN', { type: 'som.parar', instancia: 'som-1', fadeMs: Number.NaN }],
    ['fade Infinity', { type: 'som.parar', instancia: 'som-1', fadeMs: Number.POSITIVE_INFINITY }],
    ['fade em texto', { type: 'som.parar', instancia: 'som-1', fadeMs: '150' }],
    ['fade acima do teto', { type: 'som.parar', instancia: 'som-1', fadeMs: SOM_FADE_MAX_MS + 1 }],
    // volume
    ['som.volume sem volume', { type: 'som.volume', instancia: 'som-1' }],
    ['som.volume 2', { type: 'som.volume', instancia: 'som-1', volume: 2 }],
    ['som.volume NaN', { type: 'som.volume', instancia: 'som-1', volume: Number.NaN }],
    ['som.volume sem instância', { type: 'som.volume', volume: 0.5 }],
    // pré-carga
    ['precarregar sem lista', { type: 'som.precarregar' }],
    ['precarregar com texto', { type: 'som.precarregar', midias: ID }],
    ['precarregar vazio', { type: 'som.precarregar', midias: [] }],
    ['precarregar com id torto', { type: 'som.precarregar', midias: [ID, '../x.mp3'] }],
    ['precarregar com número', { type: 'som.precarregar', midias: [ID, 3] }],
    ['precarregar acima do teto', { type: 'som.precarregar', midias: Array.from({ length: SOM_PRECARGA_MAX + 1 }, (_, i) => `${i.toString(16).padStart(64, '0')}.mp3`) }],
  ]

  it.each(tortas)('%s', (_nome, entrada) => {
    expect(() => parseSomHostMessage(entrada)).not.toThrow()
    expect(parseSomHostMessage(entrada)).toBeNull()
  })
})

describe('som.falhou: a única mensagem de som que o jogador manda', () => {
  it('passa com motivo da lista fechada, e o detalhe a mais cai fora', () => {
    expect(parseSomFalhou({ type: 'som.falhou', instancia: 'som-1', motivo: 'sem-gesto', detalhe: 'x'.repeat(5000) })).toEqual({ type: 'som.falhou', instancia: 'som-1', motivo: 'sem-gesto' })
    expect(parseSomFalhou({ type: 'som.falhou', instancia: 'som-1', motivo: 'nao-carregou' })).toMatchObject({ motivo: 'nao-carregou' })
  })

  it.each([
    ['motivo fora da lista', { type: 'som.falhou', instancia: 'som-1', motivo: 'quebrou' }],
    ['motivo com espaço', { type: 'som.falhou', instancia: 'som-1', motivo: 'sem-gesto ' }],
    ['motivo vazio', { type: 'som.falhou', instancia: 'som-1', motivo: '' }],
    ['motivo número', { type: 'som.falhou', instancia: 'som-1', motivo: 5 }],
    ['sem motivo', { type: 'som.falhou', instancia: 'som-1' }],
    ['instância torta', { type: 'som.falhou', instancia: '../x', motivo: 'sem-gesto' }],
    ['instância comprida', { type: 'som.falhou', instancia: 'x'.repeat(81), motivo: 'sem-gesto' }],
    ['outro tipo', { type: 'som.tocar', instancia: 'som-1', motivo: 'sem-gesto' }],
    ['null', null],
  ])('%s é recusado', (_nome, entrada) => {
    expect(() => parseSomFalhou(entrada)).not.toThrow()
    expect(parseSomFalhou(entrada)).toBeNull()
  })

  it('som.falhou não é mensagem da sessão: parsePlayerMessage não o devolve (a ponte do mestre lê antes)', () => {
    expect(parsePlayerMessage({ type: 'som.falhou', instancia: 'som-1', motivo: 'atrasado' })).toBeNull()
  })

  it('o jogador NÃO tem como mandar tocar, parar, mudar volume nem pré-carregar', () => {
    const doMestre = [
      TOCAR,
      { type: 'som.parar', instancia: 'som-1' },
      { type: 'som.pararTudo' },
      { type: 'som.volume', instancia: 'som-1', volume: 1 },
      { type: 'som.precarregar', midias: [ID] },
    ]
    for (const msg of doMestre) expect(parsePlayerMessage(msg)).toBeNull()
  })
})
