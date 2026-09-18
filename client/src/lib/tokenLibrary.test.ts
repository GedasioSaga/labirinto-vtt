/**
 * ACERVO DE TOKENS no disco (`lib/tokenLibrary.ts`).
 *
 * O módulo tinha 351 linhas, 6 exports e ZERO teste: a única prova dele era a
 * jornada e2e, que cobre o caminho feliz e um `acervo.json` totalmente
 * ilegível. Tudo que mora entre os dois — leitura que falha por I/O, item
 * gravado pela metade, foto embutida, pasta do acervo movida de máquina —
 * chegava ao usuário sem testemunha.
 *
 * O caso que dá nome a este arquivo foi MEDIDO em 18/09/2026 com um disco de
 * mentira: `listarAcervo` engolia o erro de leitura e devolvia lista vazia, e o
 * "Salvar"/"Apagar" seguinte regravava o índice por cima — 20 NPCs viravam 0,
 * calados, com as imagens órfãs na pasta.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'

/** Disco de mentira: caminho → conteúdo. Texto e binário separados, como no Tauri. */
const textos = new Map<string, string>()
const binarios = new Map<string, Uint8Array>()
const pastas = new Set<string>()
/** Caminhos cuja LEITURA falha — é assim que o antivírus/sincronizador aparece aqui. */
const leituraFalhaEm = new Set<string>()

const APPDATA = 'C:/Users/test/AppData/Roaming/labirinto'
const PASTA = `${APPDATA}/tokens`
const INDICE = `${PASTA}/acervo.json`

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => APPDATA),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => textos.has(path) || binarios.has(path) || pastas.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    if (leituraFalhaEm.has(path)) throw new Error('Access is denied. (os error 5)')
    const conteudo = textos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  writeTextFile: vi.fn(async (path: string, data: string) => {
    textos.set(path, data)
  }),
  writeFile: vi.fn(async (path: string, data: Uint8Array) => {
    binarios.set(path, data)
  }),
  rename: vi.fn(async (de: string, para: string) => {
    const conteudo = textos.get(de)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${de}`)
    textos.set(para, conteudo)
    textos.delete(de)
  }),
  mkdir: vi.fn(async (path: string) => {
    pastas.add(path)
  }),
  readDir: vi.fn(async (dir: string) => {
    const prefixo = `${dir}/`
    const nomes = [...textos.keys(), ...binarios.keys()]
      .filter((caminho) => caminho.startsWith(prefixo))
      .map((caminho) => caminho.slice(prefixo.length))
      .filter((nome) => nome.length > 0 && !nome.includes('/'))
    return nomes.map((name) => ({ name, isDirectory: false, isFile: true, isSymlink: false }))
  }),
  remove: vi.fn(async (path: string) => {
    textos.delete(path)
    binarios.delete(path)
  }),
}))

/** O importador de imagem roda de verdade na jornada e2e; aqui ele só precisa
 *  gravar um arquivo com o nome que o de verdade grava. */
vi.mock('./imageImport', () => ({
  importTokenImage: vi.fn(async (sourcePath: string, destDir: string, tokenId: string) => {
    const destPath = `${destDir}/token_${tokenId}.webp`
    binarios.set(destPath, new Uint8Array([1, 2, 3]))
    return { destPath, sourcePath }
  }),
  buildTokenSharedPhoto: vi.fn(async () => 'data:image/webp;base64,AAAA'),
}))

const {
  listarAcervo,
  salvarNoAcervo,
  apagarDoAcervo,
  renomearNoAcervo,
  trazerDoAcervo,
  itensDoIndice,
  ACERVO_NAO_LIDO,
  SEM_FOTO_PARA_SALVAR,
} = await import('./tokenLibrary')

/** Índice já gravado, no formato novo (nome do arquivo, não caminho). */
function semearAcervo(quantos: number): void {
  const itens = Array.from({ length: quantos }, (_, i) => ({
    id: `id-${i}`,
    nome: `NPC ${i}`,
    tamanho: 1,
    arquivo: `token_id-${i}.webp`,
  }))
  textos.set(INDICE, JSON.stringify({ versao: 1, itens }, null, 2))
  for (const item of itens) binarios.set(`${PASTA}/${item.arquivo}`, new Uint8Array([9]))
  pastas.add(PASTA)
}

function itensGravados(): { id: string; nome: string; arquivo: string }[] {
  const bruto = textos.get(INDICE)
  if (bruto === undefined) return []
  return (JSON.parse(bruto) as { itens: { id: string; nome: string; arquivo: string }[] }).itens
}

const tokenComFoto = { name: 'Goblin', size: 1, image: 'C:/fotos/goblin.png', imageData: null }

beforeEach(() => {
  textos.clear()
  binarios.clear()
  pastas.clear()
  leituraFalhaEm.clear()
})

describe('leitura que falha nunca é confundida com acervo vazio', () => {
  it('listarAcervo marca `lido: false` quando o índice existe mas não pode ser lido', async () => {
    semearAcervo(3)
    leituraFalhaEm.add(INDICE)

    const acervo = await listarAcervo()

    expect(acervo.lido).toBe(false)
    expect(acervo.itens).toEqual([])
    expect(acervo.aviso).toContain('Não foi possível ler o acervo de tokens')
  })

  it('pasta sem índice é acervo vazio DE VERDADE: `lido: true`, e salvar funciona', async () => {
    const acervo = await listarAcervo()
    expect(acervo.lido).toBe(true)
    expect(acervo.aviso).toBeNull()

    await expect(salvarNoAcervo(tokenComFoto)).resolves.toMatchObject({ nome: 'Goblin' })
  })

  it('apagar com a leitura falhando NÃO regrava o índice: os 20 NPCs continuam no disco', async () => {
    semearAcervo(20)
    const antes = textos.get(INDICE)
    leituraFalhaEm.add(INDICE)

    await expect(apagarDoAcervo('id-3')).rejects.toThrow(ACERVO_NAO_LIDO)
    expect(textos.get(INDICE)).toBe(antes)
    expect(itensGravados()).toHaveLength(20)
  })

  it('salvar com a leitura falhando NÃO troca o acervo por um item só', async () => {
    semearAcervo(20)
    leituraFalhaEm.add(INDICE)

    await expect(salvarNoAcervo(tokenComFoto)).rejects.toThrow(ACERVO_NAO_LIDO)
    expect(itensGravados()).toHaveLength(20)
  })

  it('renomear com a leitura falhando também para antes de escrever', async () => {
    semearAcervo(5)
    leituraFalhaEm.add(INDICE)

    await expect(renomearNoAcervo('id-1', 'Chefe')).rejects.toThrow(ACERVO_NAO_LIDO)
    expect(itensGravados()).toHaveLength(5)
  })
})

describe('índice com item que este código não entende', () => {
  it('itensDoIndice separa o que entende do que preserva', () => {
    const lido = itensDoIndice(
      JSON.stringify({
        versao: 1,
        itens: [
          { id: 'bom', nome: 'Orc', tamanho: 2, arquivo: 'token_bom.webp' },
          { id: 'futuro', nome: 'Dragão', arquivo: 'token_futuro.webp', formato: 'sprite' },
          { naoTemNada: true },
        ],
      }),
    )

    expect(lido?.itens.map((item) => item.id)).toEqual(['bom', 'futuro'])
    expect(lido?.ignorados).toEqual([{ naoTemNada: true }])
  })

  it('item irreconhecível volta INTACTO na próxima gravação, em vez de sumir', async () => {
    textos.set(
      INDICE,
      JSON.stringify({ versao: 1, itens: [{ id: 'bom', nome: 'Orc', tamanho: 1, arquivo: 'token_bom.webp' }, { sobra: 42 }] }),
    )

    await salvarNoAcervo(tokenComFoto)

    const gravados = itensGravados() as unknown as { sobra?: number }[]
    expect(gravados).toHaveLength(3)
    expect(gravados.some((item) => item.sobra === 42)).toBe(true)
  })

  it('JSON totalmente ilegível guarda o arquivo antigo antes de recomeçar vazio', async () => {
    textos.set(INDICE, '{ isto não é json')

    const acervo = await listarAcervo()

    expect(acervo.itens).toEqual([])
    expect(acervo.lido).toBe(true)
    expect(textos.get(`${PASTA}/acervo.json.invalido`)).toBe('{ isto não é json')
  })
})

describe('gravação guarda a cópia anterior', () => {
  it('cada gravação deixa `acervo.json.anterior` com o conteúdo de antes', async () => {
    semearAcervo(2)
    const antes = textos.get(INDICE)

    await salvarNoAcervo(tokenComFoto)

    expect(textos.get(`${PASTA}/acervo.json.anterior`)).toBe(antes)
    expect(itensGravados()).toHaveLength(3)
  })
})

describe('o que fica gravado no item', () => {
  it('o índice guarda o NOME do arquivo, não o caminho da máquina', async () => {
    const item = await salvarNoAcervo(tokenComFoto)

    expect(item.arquivo).toBe(`token_${item.id}.webp`)
    expect(item.arquivo).not.toContain('/')
  })

  it('índice antigo com caminho absoluto continua achando a imagem', async () => {
    const absoluto = `${PASTA}/token_antigo.webp`
    binarios.set(absoluto, new Uint8Array([7]))
    textos.set(INDICE, JSON.stringify({ versao: 1, itens: [{ id: 'antigo', nome: 'Velho', tamanho: 1, arquivo: absoluto }] }))

    const acervo = await listarAcervo()

    expect(acervo.itens[0].imagemNoDisco).toBe(true)
    expect(acervo.itens[0].caminho).toBe(absoluto)
  })

  it('a pasta do acervo movida de máquina continua com as fotos: o nome resolve contra a pasta de agora', async () => {
    semearAcervo(1)

    const acervo = await listarAcervo()

    expect(acervo.itens[0].caminho).toBe(`${PASTA}/token_id-0.webp`)
    expect(acervo.itens[0].imagemNoDisco).toBe(true)
  })

  it('nome repetido ganha sufixo em vez de virar duas linhas idênticas', async () => {
    await salvarNoAcervo(tokenComFoto)
    const segundo = await salvarNoAcervo(tokenComFoto)

    expect(segundo.nome).not.toBe('Goblin')
    expect(segundo.nome).toContain('Goblin')
  })

  it('token sem nome (mapa antigo) entra com nome padrão e NÃO deixa imagem órfã', async () => {
    const semNome = { size: 1, image: 'C:/fotos/x.png', imageData: null } as unknown as Parameters<typeof salvarNoAcervo>[0]

    const item = await salvarNoAcervo(semNome)

    expect(item.nome).toBe('Token sem nome')
    expect(itensGravados()).toHaveLength(1)
  })

  it('token sem foto nenhuma é recusado antes de escrever qualquer coisa', async () => {
    await expect(salvarNoAcervo({ name: 'Vazio', size: 1, image: null, imageData: null })).rejects.toThrow(SEM_FOTO_PARA_SALVAR)
    expect(textos.has(INDICE)).toBe(false)
    expect(binarios.size).toBe(0)
  })
})

describe('foto EMBUTIDA (a que o jogador escolheu)', () => {
  it('entra no acervo como arquivo próprio, com a extensão do tipo da data URL', async () => {
    const doJogador = { name: 'Elfo', size: 1, image: null, imageData: 'data:image/webp;base64,AAECAw==' }

    const item = await salvarNoAcervo(doJogador)

    expect(item.arquivo).toBe(`token_${item.id}.webp`)
    expect(binarios.get(`${PASTA}/${item.arquivo}`)).toEqual(new Uint8Array([0, 1, 2, 3]))
  })

  it('png embutido entra como `.png`, e não como o `.webp` do outro ramo', async () => {
    const png = { name: 'Anão', size: 1, image: null, imageData: 'data:image/png;base64,QUJD' }

    const item = await salvarNoAcervo(png)

    expect(item.arquivo).toBe(`token_${item.id}.png`)
  })

  it('jpeg vira `.jpg`, o nome que o Windows espera', async () => {
    const jpeg = { name: 'Humano', size: 1, image: null, imageData: 'data:image/jpeg;base64,AAA=' }

    const item = await salvarNoAcervo(jpeg)

    expect(item.arquivo.endsWith('.jpg')).toBe(true)
  })
})

describe('apagar leva os arquivos junto', () => {
  it('apaga TODOS os arquivos do item, inclusive o original que não está no índice', async () => {
    const item = await salvarNoAcervo(tokenComFoto)
    // `importTokenImage` de verdade pode deixar dois arquivos; só um vai ao índice.
    binarios.set(`${PASTA}/token_${item.id}_original.png`, new Uint8Array([5]))

    await apagarDoAcervo(item.id)

    expect(itensGravados()).toHaveLength(0)
    expect(binarios.has(`${PASTA}/token_${item.id}.webp`)).toBe(false)
    expect(binarios.has(`${PASTA}/token_${item.id}_original.png`)).toBe(false)
  })

  it('não encosta no arquivo de OUTRO item', async () => {
    const goblin = await salvarNoAcervo(tokenComFoto)
    const orc = await salvarNoAcervo({ ...tokenComFoto, name: 'Orc' })

    await apagarDoAcervo(goblin.id)

    expect(itensGravados().map((item) => item.id)).toEqual([orc.id])
    expect(binarios.has(`${PASTA}/token_${orc.id}.webp`)).toBe(true)
  })
})

describe('trazer do acervo para o mapa', () => {
  it('copia a imagem do item PEDIDO, não a do primeiro da lista', async () => {
    await salvarNoAcervo(tokenComFoto)
    await salvarNoAcervo({ ...tokenComFoto, name: 'Orc' })
    const acervo = await listarAcervo()
    const orc = acervo.itens.find((item) => item.nome === 'Orc')
    if (!orc) throw new Error('o Orc deveria estar no acervo')

    const { image } = await trazerDoAcervo(orc, 'C:/mapas/m1', 'token-novo')

    const { importTokenImage } = await import('./imageImport')
    expect(vi.mocked(importTokenImage)).toHaveBeenLastCalledWith(orc.caminho, 'C:/mapas/m1', 'token-novo')
    expect(image).toBe('C:/mapas/m1/token_token-novo.webp')
  })

  it('imagem sumida do disco devolve os dois campos nulos, sem estourar', async () => {
    semearAcervo(1)
    binarios.clear()
    const acervo = await listarAcervo()

    await expect(trazerDoAcervo(acervo.itens[0], 'C:/mapas/m1', 'tk')).resolves.toEqual({ image: null, imageData: null })
  })
})
