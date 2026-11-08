/**
 * PRELÚDIO F0 (docs/planos/preludio-2026-11-08.md §2): chave que o app não
 * conhece volta igual depois de salvar, em qualquer nível do verbete. Dados
 * inventados (o repositório é público).
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

const { gravarVerbete, lerVerbete } = await import('./disco')
const { FEATURES } = await import('../features')

const LIGADO = { ...FEATURES, preparo: true }
const ARQUIVO = `${APPDATA}/preparo/verbetes/verbete-de-teste.json`

/** Um verbete inventado com chaves de uma "versão futura" no topo, na forma e na seção. */
const NO_DISCO = {
  formato: 1,
  id: 'verbete-de-teste',
  tipo: 'personagem',
  titulo: 'Capitã Inventada',
  apelidos: ['A Navegadora de Teste'],
  campanhas: ['campanha-de-teste'],
  formas: [
    {
      id: 'forma-dia',
      nome: 'De dia',
      resumo: 'Existe só neste teste.',
      secoes: [
        {
          id: 'secao-historia',
          titulo: 'História',
          texto: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nasceu num teste.' }] }] },
          segredo: false,
          corDaMolduraFutura: 'azul',
        },
      ],
      imagens: [],
      humorFuturo: { nivel: 3, notas: ['inventado'] },
    },
  ],
  formaAtivaId: 'forma-dia',
  campoDeUmaVersaoFutura: { lista: [1, 2, 3], ligado: true, vazio: null },
  extras: 'uma chave chamada extras também volta',
}

it('verbete com chaves desconhecidas (no topo, na forma e na seção) volta igual depois de editar e salvar', async () => {
  textos.set(ARQUIVO, JSON.stringify(NO_DISCO, null, 2))

  const lido = await lerVerbete('verbete-de-teste', LIGADO)
  if (lido.estado !== 'ok') throw new Error(`devia abrir para editar, veio ${lido.estado}`)
  await gravarVerbete({ ...lido.valor, titulo: 'Capitã Renomeada' }, LIGADO)

  expect(JSON.parse(textos.get(ARQUIVO) ?? 'null')).toEqual({ ...NO_DISCO, titulo: 'Capitã Renomeada' })
  expect(JSON.parse(textos.get(`${ARQUIVO}.anterior`) ?? 'null')).toEqual(NO_DISCO)
})
