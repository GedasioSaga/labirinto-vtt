/**
 * BIBLIOTECA DE SONS (`lib/sons/biblioteca.ts`), regras puras: o `sons.json`
 * vai e volta sem perda; a entrada torta é descartada sem derrubar o resto; o
 * atalho é único; o vídeo do YouTube só entra pelo validador.
 */
import { describe, expect, it } from 'vitest'
import {
  bibliotecaDeSonsVazia,
  bibliotecaDoTexto,
  comEfeitoMudado,
  comEfeitoNovo,
  comPastaNova,
  comPastaRenomeada,
  EFEITOS_DE_SOM_MAX,
  ehVideoDoYoutube,
  fonteDoSomLida,
  idsDeAudioDaBiblioteca,
  nomeDeSomDoArquivo,
  semEfeito,
  semPasta,
  serializarBiblioteca,
  VOLUME_DE_SOM_PADRAO,
  type BibliotecaDeSons,
  type FonteDeArquivo,
  type FonteDoSom,
  type VideoDoYoutube,
} from './biblioteca'

const ID_A = `${'a'.repeat(64)}.mp3`
const ID_B = `${'b'.repeat(64)}.wav`
const ARQUIVO_A: FonteDeArquivo = { tipo: 'arquivo', ref: `midia:${ID_A}`, bytes: 1200 }
const ARQUIVO_B: FonteDeArquivo = { tipo: 'arquivo', ref: `midia:${ID_B}`, bytes: 14 * 1024 * 1024 }

function cheia(): BibliotecaDeSons {
  return {
    versao: 1,
    pastas: [
      { id: 'pasta_taverna', nome: 'Taverna', ordem: 0 },
      { id: 'pasta_masmorra', nome: 'Masmorra', ordem: 1 },
    ],
    efeitos: [
      { id: 'som_porta', nome: 'Porta rangendo', fonte: ARQUIVO_A, volume: 0.8, loop: false, pastaId: 'pasta_masmorra', atalho: 3, ordem: 0 },
      { id: 'som_chuva', nome: 'Chuva', fonte: ARQUIVO_B, volume: 0.35, loop: true, pastaId: null, favorito: true, ordem: 1 },
      { id: 'som_bardo', nome: 'Bardo', fonte: { tipo: 'youtube', video: videoValido('dQw4w9WgXcQ'), inicioS: 42.5 }, volume: 1, loop: true, pastaId: 'pasta_taverna', favorito: true, atalho: 9, ordem: 2 },
      { id: 'som_vento', nome: 'Vento', fonte: { tipo: 'youtube', video: videoValido('a-b_C1234xY') }, volume: 0, loop: false, pastaId: null, ordem: 3 },
    ],
  }
}

function videoValido(texto: string): VideoDoYoutube {
  if (!ehVideoDoYoutube(texto)) throw new Error(`o teste montou um vídeo inválido: ${texto}`)
  return texto
}

/** O texto de um `sons.json` com estes efeitos crus (como se editado à mão). */
function textoCom(efeitos: unknown[], pastas: unknown[] = []): string {
  return JSON.stringify({ versao: 1, pastas, efeitos })
}

function lida(texto: string): BibliotecaDeSons {
  const resultado = bibliotecaDoTexto(texto)
  if (!resultado.ok) throw new Error(`não leu: ${resultado.motivo}`)
  return resultado.biblioteca
}

const EFEITO_BOM = { id: 'som_ok', nome: 'Ok', fonte: ARQUIVO_A, volume: 0.5, loop: false, pastaId: null, ordem: 0 }

describe('ida e volta do sons.json', () => {
  it('serializar e ler devolve a MESMA biblioteca: pastas, arquivo, YouTube com início, favorito, atalho e volume nas pontas', () => {
    const original = cheia()
    expect(lida(serializarBiblioteca(original))).toEqual(original)
  })

  it('o vazio também vai e volta, e os campos opcionais ausentes não viram undefined no arquivo', () => {
    expect(lida(serializarBiblioteca(bibliotecaDeSonsVazia()))).toEqual({ versao: 1, pastas: [], efeitos: [] })
    const texto = serializarBiblioteca(cheia())
    expect(texto).not.toContain('undefined')
    expect(JSON.parse(texto).efeitos[3]).not.toHaveProperty('favorito')
    expect(JSON.parse(texto).efeitos[3]).not.toHaveProperty('atalho')
  })
})

describe('entrada inválida é descartada', () => {
  it('JSON quebrado é ilegível; versão mais nova não é lida (para não ser regravada por cima)', () => {
    expect(bibliotecaDoTexto('{ quebrado')).toEqual({ ok: false, motivo: 'ilegivel' })
    expect(bibliotecaDoTexto('[]')).toEqual({ ok: false, motivo: 'ilegivel' })
    expect(bibliotecaDoTexto(JSON.stringify({ versao: 2, pastas: [], efeitos: [] }))).toEqual({ ok: false, motivo: 'versao-mais-nova' })
  })

  it('efeito com fonte torta sai; os outros ficam', () => {
    const tortas = [
      { tipo: 'arquivo', ref: 'C:/Windows/system32/x.mp3', bytes: 10 },
      { tipo: 'arquivo', ref: `midia:${'a'.repeat(64)}.png`, bytes: 10 },
      { tipo: 'arquivo', ref: `midia:${ID_A}`, bytes: 0 },
      { tipo: 'arquivo', ref: `midia:${ID_A}`, bytes: 15 * 1024 * 1024 + 1 },
      { tipo: 'arquivo', ref: `midia:${ID_A}` },
      { tipo: 'youtube', video: 'curto' },
      { tipo: 'youtube', video: 'dQw4w9WgXcQ&t=1' },
      { tipo: 'youtube', video: 'dQw4w9WgXcQ', inicioS: -1 },
      { tipo: 'youtube', video: 'dQw4w9WgXcQ', inicioS: 'meio' },
      { tipo: 'spotify', id: 'x' },
      null,
    ]
    const efeitos = [...tortas.map((fonte, i) => ({ ...EFEITO_BOM, id: `som_torto${i}`, fonte })), EFEITO_BOM]
    expect(lida(textoCom(efeitos)).efeitos.map((efeito) => efeito.id)).toEqual(['som_ok'])
  })

  it('volume fora de 0..1, nome vazio ou acima de 40 caracteres: o efeito sai', () => {
    const efeitos = [
      { ...EFEITO_BOM, id: 'som_alto', volume: 1.01 },
      { ...EFEITO_BOM, id: 'som_negativo', volume: -0.1 },
      { ...EFEITO_BOM, id: 'som_semvolume', volume: undefined },
      { ...EFEITO_BOM, id: 'som_nan', volume: 'alto' },
      { ...EFEITO_BOM, id: 'som_vazio', nome: '   ' },
      { ...EFEITO_BOM, id: 'som_longo', nome: 'x'.repeat(41) },
      { ...EFEITO_BOM, id: 'som_40', nome: 'y'.repeat(40) },
      EFEITO_BOM,
    ]
    expect(lida(textoCom(efeitos)).efeitos.map((efeito) => efeito.id)).toEqual(['som_40', 'som_ok'])
  })

  it('atalho repetido: o primeiro fica com ele, o seguinte perde o atalho (e continua na biblioteca)', () => {
    const efeitos = [
      { ...EFEITO_BOM, id: 'som_1', atalho: 3 },
      { ...EFEITO_BOM, id: 'som_2', atalho: 3 },
      { ...EFEITO_BOM, id: 'som_3', atalho: 10 },
      { ...EFEITO_BOM, id: 'som_4', atalho: 0 },
    ]
    const lidos = lida(textoCom(efeitos)).efeitos
    expect(lidos.map((efeito) => [efeito.id, efeito.atalho])).toEqual([
      ['som_1', 3],
      ['som_2', undefined],
      ['som_3', undefined],
      ['som_4', undefined],
    ])
    expect(lidos[1]).not.toHaveProperty('atalho')
  })

  it(`mais de ${EFEITOS_DE_SOM_MAX} efeitos: os ${EFEITOS_DE_SOM_MAX} primeiros válidos ficam`, () => {
    const efeitos = Array.from({ length: EFEITOS_DE_SOM_MAX + 5 }, (_, i) => ({ ...EFEITO_BOM, id: `som_${i}`, ordem: i }))
    const lidos = lida(textoCom(efeitos)).efeitos
    expect(lidos).toHaveLength(EFEITOS_DE_SOM_MAX)
    expect(lidos.at(-1)?.id).toBe(`som_${EFEITOS_DE_SOM_MAX - 1}`)
  })

  it('pasta dentro de pasta sai, e o efeito que estava nela vai para a raiz; id repetido fica só o primeiro', () => {
    const pastas = [
      { id: 'pasta_a', nome: 'A', ordem: 0 },
      { id: 'pasta_b', nome: 'B', ordem: 1, pastaId: 'pasta_a' },
      { id: 'pasta_c', nome: 'C', ordem: 2, pastas: [{ id: 'pasta_d', nome: 'D', ordem: 0 }] },
      { id: 'pasta_a', nome: 'A de novo', ordem: 3 },
      { id: 'pasta_e', nome: '', ordem: 4 },
    ]
    const efeitos = [
      { ...EFEITO_BOM, id: 'som_em_a', pastaId: 'pasta_a' },
      { ...EFEITO_BOM, id: 'som_em_b', pastaId: 'pasta_b' },
      { ...EFEITO_BOM, id: 'som_em_a', pastaId: null },
    ]
    const biblioteca = lida(textoCom(efeitos, pastas))
    expect(biblioteca.pastas).toEqual([{ id: 'pasta_a', nome: 'A', ordem: 0 }])
    expect(biblioteca.efeitos.map((efeito) => [efeito.id, efeito.pastaId])).toEqual([
      ['som_em_a', 'pasta_a'],
      ['som_em_b', null],
    ])
  })
})

describe('mudanças (puras)', () => {
  it('efeito novo: volume padrão 0.8, sem loop, na raiz, ordem depois do último', () => {
    const resultado = comEfeitoNovo(cheia(), { nome: '  Trovão  ', fonte: ARQUIVO_A }, 'som_trovao')
    expect(resultado?.efeito).toEqual({ id: 'som_trovao', nome: 'Trovão', fonte: ARQUIVO_A, volume: VOLUME_DE_SOM_PADRAO, loop: false, pastaId: null, ordem: 4 })
    expect(resultado?.biblioteca.efeitos).toHaveLength(5)
  })

  it('efeito novo recusado: nome inválido, volume fora, pasta que não existe, fonte torta, e o 201º', () => {
    const base = cheia()
    expect(comEfeitoNovo(base, { nome: '', fonte: ARQUIVO_A })).toBeNull()
    expect(comEfeitoNovo(base, { nome: 'x'.repeat(41), fonte: ARQUIVO_A })).toBeNull()
    expect(comEfeitoNovo(base, { nome: 'Ok', fonte: ARQUIVO_A, volume: 2 })).toBeNull()
    expect(comEfeitoNovo(base, { nome: 'Ok', fonte: ARQUIVO_A, pastaId: 'pasta_fantasma' })).toBeNull()
    expect(comEfeitoNovo(base, { nome: 'Ok', fonte: { tipo: 'arquivo', ref: 'midia:nada.mp3', bytes: 5 } })).toBeNull()
    let cheiaDemais = bibliotecaDeSonsVazia()
    for (let i = 0; i < EFEITOS_DE_SOM_MAX; i++) {
      const passo = comEfeitoNovo(cheiaDemais, { nome: `Som ${i}`, fonte: ARQUIVO_A }, `som_${i}`)
      if (passo === null) throw new Error(`recusou o ${i}`)
      cheiaDemais = passo.biblioteca
    }
    expect(comEfeitoNovo(cheiaDemais, { nome: 'Mais um', fonte: ARQUIVO_A })).toBeNull()
  })

  it('atalho é único: dar o 3 a outro efeito tira o 3 de quem tinha; null tira o atalho', () => {
    const mudada = comEfeitoMudado(cheia(), 'som_chuva', { atalho: 3 })
    expect(mudada?.efeitos.find((efeito) => efeito.id === 'som_chuva')?.atalho).toBe(3)
    expect(mudada?.efeitos.find((efeito) => efeito.id === 'som_porta')).not.toHaveProperty('atalho')
    expect(mudada?.efeitos.filter((efeito) => efeito.atalho === 3)).toHaveLength(1)
    const sem = comEfeitoMudado(cheia(), 'som_porta', { atalho: null })
    expect(sem?.efeitos.find((efeito) => efeito.id === 'som_porta')).not.toHaveProperty('atalho')
  })

  it('editar nome, volume, loop, pasta e favorito; recusa o inválido e o efeito que não existe', () => {
    const mudada = comEfeitoMudado(cheia(), 'som_vento', { nome: 'Ventania', volume: 0.6, loop: true, pastaId: 'pasta_taverna', favorito: true })
    expect(mudada?.efeitos[3]).toEqual({ id: 'som_vento', nome: 'Ventania', fonte: cheia().efeitos[3]?.fonte, volume: 0.6, loop: true, pastaId: 'pasta_taverna', favorito: true, ordem: 3 })
    expect(comEfeitoMudado(cheia(), 'som_chuva', { favorito: false })?.efeitos[1]).not.toHaveProperty('favorito')
    expect(comEfeitoMudado(cheia(), 'som_vento', { volume: -1 })).toBeNull()
    expect(comEfeitoMudado(cheia(), 'som_vento', { nome: ' ' })).toBeNull()
    expect(comEfeitoMudado(cheia(), 'som_vento', { pastaId: 'pasta_fantasma' })).toBeNull()
    expect(comEfeitoMudado(cheia(), 'som_fantasma', { loop: true })).toBeNull()
  })

  it('pastas: criar, renomear e apagar (o efeito de dentro vai para a raiz, não some)', () => {
    const criada = comPastaNova(cheia(), 'Floresta', 'pasta_floresta')
    expect(criada?.pasta).toEqual({ id: 'pasta_floresta', nome: 'Floresta', ordem: 2 })
    expect(comPastaNova(cheia(), '')).toBeNull()
    expect(comPastaRenomeada(cheia(), 'pasta_taverna', 'Estalagem')?.pastas[0]?.nome).toBe('Estalagem')
    expect(comPastaRenomeada(cheia(), 'pasta_taverna', 'z'.repeat(41))).toBeNull()
    const semMasmorra = semPasta(cheia(), 'pasta_masmorra')
    expect(semMasmorra?.pastas.map((pasta) => pasta.id)).toEqual(['pasta_taverna'])
    expect(semMasmorra?.efeitos.find((efeito) => efeito.id === 'som_porta')?.pastaId).toBeNull()
    expect(semPasta(cheia(), 'pasta_fantasma')).toBeNull()
    expect(semEfeito(cheia(), 'som_porta')?.efeitos.map((efeito) => efeito.id)).toEqual(['som_chuva', 'som_bardo', 'som_vento'])
    expect(semEfeito(cheia(), 'som_fantasma')).toBeNull()
  })

  it('os ids de áudio que viajam com a pasta: só os arquivos, sem repetir', () => {
    const repetida = comEfeitoNovo(cheia(), { nome: 'Porta 2', fonte: ARQUIVO_A }, 'som_porta2')?.biblioteca ?? cheia()
    expect(idsDeAudioDaBiblioteca(repetida)).toEqual([ID_A, ID_B])
  })

  it('nome do arquivo importado: sem pasta e sem extensão, aparado, no teto; vazio vira o padrão', () => {
    expect(nomeDeSomDoArquivo('C:\\sons\\Porta rangendo.mp3')).toBe('Porta rangendo')
    expect(nomeDeSomDoArquivo('/home/x/chuva forte.WAV')).toBe('chuva forte')
    expect(nomeDeSomDoArquivo(`${'n'.repeat(60)}.ogg`)).toBe('n'.repeat(40))
    expect(nomeDeSomDoArquivo('.mp3')).toBe('Som sem nome')
  })
})

describe('vídeo do YouTube', () => {
  it('só 11 caracteres de [A-Za-z0-9_-]', () => {
    expect(ehVideoDoYoutube('dQw4w9WgXcQ')).toBe(true)
    expect(ehVideoDoYoutube('a-b_C1234xY')).toBe(true)
    for (const torto of ['dQw4w9WgXc', 'dQw4w9WgXcQQ', 'dQw4w9WgXc!', 'https://youtu.be/dQw4w9WgXcQ', '', 12345678901]) expect(ehVideoDoYoutube(torto)).toBe(false)
    expect(fonteDoSomLida({ tipo: 'youtube', video: 'dQw4w9WgXcQ', extra: 'x' })).toEqual({ tipo: 'youtube', video: 'dQw4w9WgXcQ' })
  })

  it('o TIPO da fonte exige o vídeo validado: string solta não compila', () => {
    // @ts-expect-error: prova de tipo deste teste, string solta não é VideoDoYoutube sem passar por ehVideoDoYoutube
    const solta: FonteDoSom = { tipo: 'youtube', video: 'dQw4w9WgXcQ' }
    expect(solta.tipo).toBe('youtube')
  })
})
