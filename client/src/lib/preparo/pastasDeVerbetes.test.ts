/**
 * PASTAS DOS VERBETES (E3): o arquivo de antes (sem `pastaId`, índice sem
 * `pastas`) abre igual e cai na pasta do Grimório; mover para uma pasta nova
 * fica gravado. Dados inventados (o repositório é público).
 */
import { expect, it, vi } from 'vitest'

const APPDATA = 'C:/Users/teste/AppData/Roaming/labirinto'
const textos = new Map<string, string>()

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...partes: string[]) => partes.join('/')),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (caminho: string) => textos.has(caminho)),
  mkdir: vi.fn(async () => undefined),
  readTextFile: vi.fn(async (caminho: string) => {
    const conteudo = textos.get(caminho)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return conteudo
  }),
  writeTextFile: vi.fn(async (caminho: string, conteudo: string) => {
    textos.set(caminho, conteudo)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const conteudo = textos.get(de)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, conteudo)
    textos.delete(de)
  }),
  remove: vi.fn(async (caminho: string) => {
    textos.delete(caminho)
  }),
}))

const { gravarIndiceDoPreparo, gravarVerbete, lerIndiceDoPreparo, lerVerbete } = await import('./disco')
const { FEATURES } = await import('../features')
const { comPasta, indiceComAsPastas, pastaDoVerbete, pastaNova, pastasDoTipo } = await import('./pastasDeVerbetes')

const LIGADO = { ...FEATURES, preparo: true }
const VERBETE = `${APPDATA}/preparo/verbetes/pers-inventada.json`
const INDICE = `${APPDATA}/preparo/preparo.json`

/** Como a importação do Grimório gravou antes do E3: `organizacao` com 3 níveis, sem `pastaId`. */
const ANTIGO = {
  formato: 1,
  id: 'pers-inventada',
  tipo: 'personagem',
  titulo: 'Bandida Inventada',
  apelidos: [],
  campanhas: ['camp-teste'],
  organizacao: ['NPCS', 'Neutros/Aliados', 'Bandidas'],
  formas: [{ id: 'f1', nome: 'Bandida Inventada', resumo: '', secoes: [], imagens: [] }],
  formaAtivaId: 'f1',
}
const INDICE_ANTIGO = { formato: 1, campanhas: [{ id: 'camp-teste', nome: 'Campanha de Teste' }] }

async function lidos() {
  const verbete = await lerVerbete('pers-inventada', LIGADO)
  const indice = await lerIndiceDoPreparo(LIGADO)
  if (verbete.estado !== 'ok' || indice.estado !== 'ok') throw new Error(`devia abrir: ${verbete.estado}, ${indice.estado}`)
  return { verbete: verbete.valor, indice: indice.valor }
}

it('arquivo de antes do E3 abre igual e mora na pasta do Grimório (um nível de subpasta), sem gravar nada', async () => {
  textos.clear()
  textos.set(VERBETE, JSON.stringify(ANTIGO, null, 2))
  textos.set(INDICE, JSON.stringify(INDICE_ANTIGO, null, 2))

  const { verbete, indice } = await lidos()
  expect(indice.pastas).toBeUndefined()
  const pastas = pastasDoTipo(indice.pastas ?? [], [verbete], 'personagem')
  expect(pastas.map((pasta) => [pasta.nome, pasta.paiId === undefined])).toEqual([
    ['NPCS', true],
    ['Neutros/Aliados › Bandidas', false],
  ])
  expect(pastaDoVerbete(verbete, new Set(pastas.map((pasta) => pasta.id)))).toBe(pastas[1]?.id)
  expect(pastasDoTipo([], [verbete], 'item')).toEqual([])

  // Salvar sem mexer na pasta não acrescenta campo: o arquivo volta como era.
  await gravarVerbete(comPasta(verbete, pastas[1]?.id ?? null), LIGADO)
  expect(JSON.parse(textos.get(VERBETE) ?? 'null')).toEqual(ANTIGO)
})

it('mover para uma pasta nova (e para Sem pasta) fica gravado no verbete e no índice', async () => {
  textos.clear()
  textos.set(VERBETE, JSON.stringify(ANTIGO, null, 2))
  textos.set(INDICE, JSON.stringify(INDICE_ANTIGO, null, 2))
  const antes = await lidos()
  const nova = pastaNova('personagem', 'Rascunhos', undefined, () => 'pa-rascunhos')
  const todas = [...pastasDoTipo([], [antes.verbete], 'personagem'), nova]

  await gravarIndiceDoPreparo(indiceComAsPastas(antes.indice, todas), LIGADO)
  await gravarVerbete(comPasta(antes.verbete, nova.id), LIGADO)
  const depois = await lidos()
  expect(depois.verbete.pastaId).toBe('pa-rascunhos')
  expect(depois.indice.campanhas).toEqual(INDICE_ANTIGO.campanhas)
  const ids = new Set(pastasDoTipo(depois.indice.pastas ?? [], [depois.verbete], 'personagem').map((pasta) => pasta.id))
  expect(pastaDoVerbete(depois.verbete, ids)).toBe('pa-rascunhos')
  // As pastas do Grimório ficaram guardadas: a que esvaziou não some.
  expect(ids.size).toBe(3)

  // "Sem pasta" de propósito vence o `organizacao`.
  await gravarVerbete(comPasta(depois.verbete, null), LIGADO)
  const semPasta = await lidos()
  expect(semPasta.verbete.pastaId).toBe('')
  expect(pastaDoVerbete(semPasta.verbete, ids)).toBeNull()
})
