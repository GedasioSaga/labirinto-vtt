/**
 * PASTAS DE MAPAS (`lib/pastasDeMapas.ts`): as regras do índice (criar,
 * renomear, apagar sem apagar mapa, mover, recolher, "só neste mapa"), a
 * chave do mapa pelo caminho, e o disco — índice e RPG com a cópia anterior,
 * leitura tolerante, e a mídia das fichas que vai para a pasta e volta.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Personagem } from './personagem'

const APPDATA = 'C:/appdata'
const textos = new Map<string, string>()
const binarios = new Map<string, Uint8Array>()
const pastas = new Set<string>()

function pai(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf('/'))
}

function criarPastasAte(caminho: string): void {
  for (let pasta = caminho; pasta.includes('/'); pasta = pai(pasta)) pastas.add(pasta)
}

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => pai(caminho)),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (caminho: string) => textos.has(caminho) || binarios.has(caminho) || pastas.has(caminho)),
  mkdir: vi.fn(async (caminho: string) => criarPastasAte(caminho)),
  readTextFile: vi.fn(async (caminho: string) => {
    const texto = textos.get(caminho)
    if (texto === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return texto
  }),
  writeTextFile: vi.fn(async (caminho: string, texto: string) => {
    criarPastasAte(pai(caminho))
    textos.set(caminho, texto)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const texto = textos.get(de)
    if (texto === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, texto)
    textos.delete(de)
  }),
  remove: vi.fn(async (caminho: string) => {
    textos.delete(caminho)
    binarios.delete(caminho)
  }),
  readDir: vi.fn(async (caminho: string) => {
    if (!pastas.has(caminho)) throw new Error(`não deu para listar ${caminho}`)
    const nomes = [...textos.keys(), ...binarios.keys()].filter((c) => pai(c) === caminho)
    return nomes.map((c) => ({ name: c.slice(caminho.length + 1), isFile: true, isDirectory: false, isSymlink: false }))
  }),
  readFile: vi.fn(async (caminho: string) => {
    const bytes = binarios.get(caminho)
    if (bytes === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return bytes.slice()
  }),
  writeFile: vi.fn(async (caminho: string, bytes: Uint8Array) => {
    binarios.set(caminho, bytes.slice())
  }),
  copyFile: vi.fn(async (de: string, para: string) => {
    const bytes = binarios.get(de)
    if (bytes === undefined) throw new Error(`arquivo não existe: ${de}`)
    binarios.set(para, bytes.slice())
  }),
  stat: vi.fn(async (caminho: string) => {
    const bytes = binarios.get(caminho)
    if (bytes !== undefined) return { size: bytes.length, isFile: true, isDirectory: false, isSymlink: false, mtime: null }
    if (pastas.has(caminho)) return { size: 0, isFile: false, isDirectory: true, isSymlink: false, mtime: null }
    throw new Error(`não existe: ${caminho}`)
  }),
}))

const {
  alternarRecolhida,
  apagarPasta,
  chaveDoMapa,
  criarPasta,
  definirProprio,
  gravarRpgDaPasta,
  INDICE_VAZIO,
  indiceDoArquivo,
  lerIndiceDasPastas,
  lerRpgDaPasta,
  limparNomeDaPasta,
  lugarDoMapa,
  moverMapa,
  mudarIndiceDasPastas,
  pastaAbertaDoArquivo,
  PASTA_SEM_NOME,
  renomearPasta,
  rpgDoMapaSalvo,
} = await import('./pastasDeMapas')
const { novoPersonagem } = await import('./personagem')
const { SISTEMA_ONE_PIECE } = await import('./sistemaOnePiece')
const { idDosBytes, refDoId } = await import('./midia')
const { serializeAdventure } = await import('./adventure')
const { useToastStore } = await import('../stores/toastStore')

const MAPS = `${APPDATA}/maps`
const INDICE = `${APPDATA}/pastas/indice.json`

function luffy(): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'p_luffy' }
}

/** Um PNG pequeno; `marca` muda o conteúdo (e com ele o hash). */
function png(marca: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, marca])
}

beforeEach(() => {
  textos.clear()
  binarios.clear()
  pastas.clear()
  useToastStore.setState({ toasts: [] })
})

describe('regras do índice', () => {
  it('criar, renomear e recolher: o nome é limpo e vazio vira "Pasta sem nome"', () => {
    const { indice, pasta } = criarPasta(INDICE_VAZIO, '  Campanha de Goa  ')
    expect(pasta.nome).toBe('Campanha de Goa')
    expect(pasta.id).toMatch(/^pasta_/)
    const renomeado = renomearPasta(indice, pasta.id, '   ')
    expect(renomeado.pastas[0].nome).toBe(PASTA_SEM_NOME)
    const recolhido = alternarRecolhida(renomeado, pasta.id)
    expect(recolhido.pastas[0].recolhida).toBe(true)
    expect(alternarRecolhida(recolhido, pasta.id).pastas[0]).toEqual({ id: pasta.id, nome: PASTA_SEM_NOME })
    expect(limparNomeDaPasta('a'.repeat(200))).toHaveLength(60)
  })

  it('mover entra, troca de pasta (o "só neste mapa" fica para trás) e sai', () => {
    const a = criarPasta(INDICE_VAZIO, 'A')
    const b = criarPasta(a.indice, 'B')
    let indice = moverMapa(b.indice, 'adv_goa', a.pasta.id)
    expect(lugarDoMapa(indice, 'adv_goa')).toEqual({ pasta: a.pasta, proprio: false })
    indice = definirProprio(indice, 'adv_goa', true)
    expect(lugarDoMapa(indice, 'adv_goa')?.proprio).toBe(true)
    expect(moverMapa(indice, 'adv_goa', a.pasta.id)).toBe(indice)
    indice = moverMapa(indice, 'adv_goa', b.pasta.id)
    expect(lugarDoMapa(indice, 'adv_goa')).toEqual({ pasta: b.pasta, proprio: false })
    indice = moverMapa(indice, 'adv_goa', null)
    expect(lugarDoMapa(indice, 'adv_goa')).toBeNull()
    // Pasta que não existe: nada muda.
    expect(moverMapa(indice, 'adv_goa', 'pasta_nao-existe')).toBe(indice)
  })

  it('apagar a pasta tira só a pasta: os mapas dela saem para fora, os das outras ficam', () => {
    const a = criarPasta(INDICE_VAZIO, 'A')
    const b = criarPasta(a.indice, 'B')
    let indice = moverMapa(b.indice, 'adv_goa', a.pasta.id)
    indice = moverMapa(indice, 'adv_sky', a.pasta.id)
    indice = moverMapa(indice, 'map_cripta', b.pasta.id)
    const depois = apagarPasta(indice, a.pasta.id)
    expect(depois.pastas.map((pasta) => pasta.nome)).toEqual(['B'])
    expect(lugarDoMapa(depois, 'adv_goa')).toBeNull()
    expect(lugarDoMapa(depois, 'adv_sky')).toBeNull()
    expect(lugarDoMapa(depois, 'map_cripta')?.pasta.nome).toBe('B')
  })

  it('a chave é a pasta do mapa em maps, para a raiz e para as cenas de dentro', () => {
    expect(chaveDoMapa(`${MAPS}/adv_goa/map.json`, MAPS)).toBe('adv_goa')
    expect(chaveDoMapa(`${MAPS}/adv_goa/scenes/s1/map.json`, MAPS)).toBe('adv_goa')
    expect(chaveDoMapa('C:\\appdata\\maps\\adv_goa\\map.json', MAPS)).toBe('adv_goa')
    expect(chaveDoMapa('C:/APPDATA/MAPS/adv_goa/map.json', MAPS)).toBe('adv_goa')
    expect(chaveDoMapa('C:/outros/goa/map.json', MAPS)).toBeNull()
    expect(chaveDoMapa(`${MAPS}/map.json`, MAPS)).toBeNull()
    expect(chaveDoMapa(`${MAPS}/../segredo/map.json`, MAPS)).toBeNull()
  })

  it('leitor tolerante: pasta sem id do app sai, lugar que aponta para pasta sumida sai, repetido vale o primeiro', () => {
    const indice = indiceDoArquivo({
      versao: 1,
      pastas: [{ id: 'pasta_a', nome: 'A' }, { id: '../fora', nome: 'X' }, { id: 'pasta_a', nome: 'Repetida' }, 'lixo'],
      mapas: [
        { chave: 'adv_goa', pastaId: 'pasta_a', proprio: true },
        { chave: 'adv_goa', pastaId: 'pasta_a' },
        { chave: 'adv_sky', pastaId: 'pasta_sumida' },
        { chave: '../x', pastaId: 'pasta_a' },
      ],
    })
    expect(indice).toEqual({ pastas: [{ id: 'pasta_a', nome: 'A' }], mapas: [{ chave: 'adv_goa', pastaId: 'pasta_a', proprio: true }] })
    expect(indiceDoArquivo('não é objeto')).toEqual(INDICE_VAZIO)
  })
})

describe('disco', () => {
  it('sem arquivo é o índice vazio; mudar grava e guarda a cópia anterior', async () => {
    expect(await lerIndiceDasPastas()).toEqual({ indice: INDICE_VAZIO, aviso: null })
    const primeiro = await mudarIndiceDasPastas((indice) => criarPasta(indice, 'Goa').indice)
    expect(textos.has(`${INDICE}.anterior`)).toBe(false)
    await mudarIndiceDasPastas((indice) => criarPasta(indice, 'Sky').indice)
    expect(JSON.parse(textos.get(`${INDICE}.anterior`) ?? '{}').pastas).toEqual(primeiro.pastas)
    expect((await lerIndiceDasPastas()).indice.pastas.map((pasta) => pasta.nome)).toEqual(['Goa', 'Sky'])
  })

  it('índice danificado: volta a cópia anterior, com aviso', async () => {
    await mudarIndiceDasPastas((indice) => criarPasta(indice, 'Goa').indice)
    await mudarIndiceDasPastas((indice) => criarPasta(indice, 'Sky').indice)
    textos.set(INDICE, '{ quebrado')
    const lido = await lerIndiceDasPastas()
    expect(lido.indice.pastas.map((pasta) => pasta.nome)).toEqual(['Goa'])
    expect(lido.aviso).toMatch(/cópia anterior/)
  })

  it('RPG: grava, relê (campo a mais da ficha vai junto no arquivo) e o danificado não vira lista vazia', async () => {
    const { pasta } = criarPasta(INDICE_VAZIO, 'Goa')
    expect(await lerRpgDaPasta(pasta.id)).toEqual({ ok: true, rpg: { personagens: [] } })
    // Campo que outra frente acrescenta à ficha (o `dono` das contas) não é apagado ao gravar.
    const comCampoNovo: Personagem = { ...luffy(), ...{ dono: 'conta_ana' } }
    await gravarRpgDaPasta(pasta.id, { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [comCampoNovo] })
    const arquivo = `${APPDATA}/pastas/${pasta.id}/rpg.json`
    expect(textos.get(arquivo)).toContain('"dono": "conta_ana"')
    const lido = await lerRpgDaPasta(pasta.id)
    expect(lido.ok && lido.rpg.sistemaDeRpg).toBe(SISTEMA_ONE_PIECE.id)
    expect(lido.ok && lido.rpg.personagens.map((p) => p.nome)).toEqual(['Luffy'])

    textos.set(arquivo, '{ quebrado')
    textos.delete(`${arquivo}.anterior`)
    expect((await lerRpgDaPasta(pasta.id)).ok).toBe(false)
  })

  it('mídia: o retrato vai para a pasta ao gravar e volta para o app ao abrir um mapa da pasta', async () => {
    const bytes = png(7)
    const id = await idDosBytes(bytes)
    if (id === null) throw new Error('o teste montou bytes que não são imagem')
    criarPastasAte(`${APPDATA}/midia`)
    binarios.set(`${APPDATA}/midia/${id}`, bytes)

    const indice = await mudarIndiceDasPastas((atual) => {
      const { indice: comPasta, pasta } = criarPasta(atual, 'Goa')
      return moverMapa(comPasta, 'adv_goa', pasta.id)
    })
    const pastaId = indice.pastas[0].id
    await gravarRpgDaPasta(pastaId, { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [{ ...luffy(), retrato: refDoId(id) }] })
    expect(binarios.has(`${APPDATA}/pastas/${pastaId}/midia/${id}`)).toBe(true)

    // Outro computador: a mídia do app não tem o retrato; abrir um mapa da pasta o traz de volta.
    binarios.delete(`${APPDATA}/midia/${id}`)
    const aberta = await pastaAbertaDoArquivo(`${MAPS}/adv_goa/scenes/s1/map.json`)
    expect(aberta).toMatchObject({ chave: 'adv_goa', pastaId, nome: 'Goa', proprio: false, sistemaDeRpg: SISTEMA_ONE_PIECE.id })
    expect(aberta?.personagens.map((p) => p.retrato)).toEqual([refDoId(id)])
    expect(binarios.has(`${APPDATA}/midia/${id}`)).toBe(true)
  })

  it('mapa fora das pastas (ou fora de maps) abre sem pasta; RPG ilegível avisa e abre sem pasta', async () => {
    expect(await pastaAbertaDoArquivo(`${MAPS}/adv_goa/map.json`)).toBeNull()
    expect(await pastaAbertaDoArquivo('C:/outros/goa/map.json')).toBeNull()
    const indice = await mudarIndiceDasPastas((atual) => {
      const { indice: comPasta, pasta } = criarPasta(atual, 'Goa')
      return moverMapa(comPasta, 'adv_goa', pasta.id)
    })
    textos.set(`${APPDATA}/pastas/${indice.pastas[0].id}/rpg.json`, '{ quebrado')
    expect(await pastaAbertaDoArquivo(`${MAPS}/adv_goa/map.json`)).toBeNull()
    expect(useToastStore.getState().toasts.map((t) => t.text).join(' ')).toMatch(/próprio sistema/)
  })

  it('apagar a pasta não apaga nada do disco: os personagens dela continuam lá', async () => {
    const indice = await mudarIndiceDasPastas((atual) => {
      const { indice: comPasta, pasta } = criarPasta(atual, 'Goa')
      return moverMapa(comPasta, 'adv_goa', pasta.id)
    })
    const pastaId = indice.pastas[0].id
    await gravarRpgDaPasta(pastaId, { personagens: [luffy()] })
    const depois = await mudarIndiceDasPastas((atual) => apagarPasta(atual, pastaId))
    expect(depois).toEqual(INDICE_VAZIO)
    const lido = await lerRpgDaPasta(pastaId)
    expect(lido.ok && lido.rpg.personagens.map((p) => p.nome)).toEqual(['Luffy'])
  })

  it('copiar de um mapa: lê o sistema e os personagens da aventura salva; mapa solto não tem o que copiar', async () => {
    criarPastasAte(`${MAPS}/adv_goa`)
    textos.set(
      `${MAPS}/adv_goa/adventure.json`,
      serializeAdventure({
        version: 1,
        id: 'adv_goa',
        name: 'Reino de Goa',
        startSceneId: 's1',
        scenes: [{ id: 's1', name: 'Goa', file: 'map.json' }],
        sistemaDeRpg: SISTEMA_ONE_PIECE.id,
        personagens: [luffy()],
      }),
    )
    const copiado = await rpgDoMapaSalvo('adv_goa')
    expect(copiado?.sistemaDeRpg).toBe(SISTEMA_ONE_PIECE.id)
    expect(copiado?.personagens.map((p) => p.nome)).toEqual(['Luffy'])
    expect(await rpgDoMapaSalvo('map_solto')).toBeNull()
  })
})
