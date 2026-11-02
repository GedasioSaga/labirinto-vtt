/**
 * INDEPENDÊNCIA DOS SISTEMAS (pedido do usuário: "se eu apagar um sistema,
 * nada no aplicativo que usa outro sistema muda"). Pela biblioteca de verdade
 * (rpgStore + bibliotecaDeSistemas + disco mockado): duplicar o Dragon Ball
 * embutido e apagar a cópia não mexe no One Piece, no DBT embutido nem em
 * outro sistema do disco; a aventura de One Piece continua no seu sistema e
 * no motor padrão; o DBT embutido não sai, e a grade só oferece Apagar ao que
 * não é embutido. E o que acontece com a aventura que usava a cópia apagada.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const arquivos = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async (path: string) => {
    arquivos.set(path, '<pasta>')
  }),
  exists: vi.fn(async (path: string) => arquivos.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
  }),
  readFile: vi.fn(async () => new Uint8Array()),
  readDir: vi.fn(async (pasta: string) =>
    [...arquivos.keys()]
      .filter((caminho) => caminho.startsWith(`${pasta}/`))
      .map((caminho) => ({ name: caminho.slice(pasta.length + 1), isFile: true, isDirectory: false, isSymlink: false })),
  ),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async (path: string) => {
    arquivos.delete(path)
  }),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => true }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const fs = await import('@tauri-apps/plugin-fs')
const { apagarSistema, ehEmbutido, gravarSistema, importarSistema, listarSistemas } = await import('./bibliotecaDeSistemas')
const { serializarSistema } = await import('./sistemaDeRpg')
const { SISTEMA_ONE_PIECE, SISTEMAS_EMBUTIDOS } = await import('./sistemaOnePiece')
const { SISTEMA_DRAGON_BALL } = await import('./dbt/sistemaDragonBall')
const { MOTOR_DRAGON_BALL, MOTOR_PADRAO, motorDoSistema } = await import('./motores')
const { parseAdventure, serializeAdventure } = await import('./adventure')
const { fichaDBTVazia } = await import('./dbt/modelo')
const { sistemaPorId, useRpgStore } = await import('../stores/rpgStore')
const { SistemasDialog } = await import('../components/SistemasDialog')

const PASTA = 'C:/appdata/sistemas'

/** O estado dos dois embutidos em texto, para provar que nenhum campo mudou no lugar (nem o livro de ~650 mil caracteres). */
const ONE_PIECE_ANTES = JSON.stringify(SISTEMA_ONE_PIECE)
const DRAGON_BALL_ANTES = JSON.stringify(SISTEMA_DRAGON_BALL)

/** Uma aventura gravada no disco, no formato do adventure.json, com um personagem de cada tipo de ficha. */
function aventuraNoDisco(sistemaId: string, comFichaDBT: boolean): string {
  const ficha = { ...fichaDBTVazia(), raca: 'saiyajin', epInicial: 3 }
  return JSON.stringify({
    version: 1,
    id: `adv_${sistemaId}`,
    name: `Campanha ${sistemaId}`,
    startSceneId: 'cena-1',
    scenes: [{ id: 'cena-1', name: 'Vila', file: 'cena-1.json' }],
    sistemaDeRpg: sistemaId,
    personagens: [{ id: 'p1', tipo: 'jogador', nome: 'Kuririn', atributos: { for: 12 }, recursos: {}, ...(comFichaDBT ? { dbt: ficha } : {}) }],
  })
}

/** O que o app faz com a aventura aberta: acha o sistema pelo id na biblioteca de agora e escolhe o motor. */
function resolver(textoDaAventura: string) {
  const aventura = parseAdventure(textoDaAventura)
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, aventura.sistemaDeRpg)
  return { aventura, sistema, motor: motorDoSistema(sistema) }
}

function arquivosDaPasta(): string[] {
  return [...arquivos.keys()].filter((caminho) => caminho.startsWith(`${PASTA}/`)).sort()
}

beforeEach(() => {
  arquivos.clear()
  vi.mocked(fs.remove).mockClear()
  useRpgStore.setState({ biblioteca: [...SISTEMAS_EMBUTIDOS], avisosDaBiblioteca: [], bibliotecaLida: false })
})

describe('duplicar o Dragon Ball embutido e apagar a cópia', () => {
  it('One Piece e DBT embutido saem iguais: mesmos objetos, nenhum campo mudado, na memória e relidos do disco', async () => {
    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    expect(copia.id).not.toBe(SISTEMA_DRAGON_BALL.id)
    expect(motorDoSistema(copia)).toBe(MOTOR_DRAGON_BALL)
    expect(arquivosDaPasta()).toEqual([`${PASTA}/${copia.id}.json`])

    await useRpgStore.getState().apagarSistema(copia.id)

    const biblioteca = useRpgStore.getState().biblioteca
    expect(biblioteca).toHaveLength(2)
    expect(biblioteca[0]).toBe(SISTEMA_ONE_PIECE)
    expect(biblioteca[1]).toBe(SISTEMA_DRAGON_BALL)
    expect(JSON.stringify(SISTEMA_ONE_PIECE)).toBe(ONE_PIECE_ANTES)
    expect(JSON.stringify(SISTEMA_DRAGON_BALL)).toBe(DRAGON_BALL_ANTES)
    // Próxima abertura do app: a pasta relida dá só os embutidos, sem aviso.
    expect(await listarSistemas()).toEqual({ sistemas: [SISTEMA_ONE_PIECE, SISTEMA_DRAGON_BALL], avisos: [] })
    expect(arquivosDaPasta()).toEqual([])
  })

  it('apagar a cópia do DBT só tira o arquivo dela: a cópia do One Piece e outro sistema do disco ficam byte a byte', async () => {
    const copiaOnePiece = await useRpgStore.getState().duplicarSistema(SISTEMA_ONE_PIECE)
    const copiaDragonBall = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    const outroNoDisco = arquivos.get(`${PASTA}/${copiaOnePiece.id}.json`)

    await useRpgStore.getState().apagarSistema(copiaDragonBall.id)

    expect(vi.mocked(fs.remove).mock.calls).toEqual([[`${PASTA}/${copiaDragonBall.id}.json`]])
    expect(arquivos.get(`${PASTA}/${copiaOnePiece.id}.json`)).toBe(outroNoDisco)
    expect(useRpgStore.getState().biblioteca.map((sistema) => sistema.id)).toEqual([SISTEMA_ONE_PIECE.id, SISTEMA_DRAGON_BALL.id, copiaOnePiece.id])
    expect((await listarSistemas()).sistemas).toEqual([SISTEMA_ONE_PIECE, SISTEMA_DRAGON_BALL, copiaOnePiece])
  })
})

describe('a aventura de outro sistema não muda', () => {
  it('aventura em One Piece resolve o One Piece e o motor padrão antes e depois de apagar a cópia do DBT', async () => {
    const textoOnePiece = aventuraNoDisco(SISTEMA_ONE_PIECE.id, false)
    const antes = resolver(textoOnePiece)
    expect(antes.sistema).toBe(SISTEMA_ONE_PIECE)
    expect(antes.motor).toBe(MOTOR_PADRAO)

    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    await useRpgStore.getState().apagarSistema(copia.id)

    const depois = resolver(textoOnePiece)
    expect(depois.sistema).toBe(SISTEMA_ONE_PIECE)
    expect(depois.motor).toBe(MOTOR_PADRAO)
    expect(depois.aventura).toEqual(antes.aventura)
  })

  it('aventura no DBT embutido continua no DBT embutido e no motor do Dragon Ball', async () => {
    const textoDragonBall = aventuraNoDisco(SISTEMA_DRAGON_BALL.id, true)
    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    await useRpgStore.getState().apagarSistema(copia.id)
    const { sistema, motor, aventura } = resolver(textoDragonBall)
    expect(sistema).toBe(SISTEMA_DRAGON_BALL)
    expect(motor).toBe(MOTOR_DRAGON_BALL)
    expect(aventura.personagens?.[0].dbt).toMatchObject({ raca: 'saiyajin', epInicial: 3 })
  })
})

describe('o DBT embutido não sai', () => {
  it('apagar e gravar por cima do Dragon Ball embutido são recusados; a biblioteca fica como estava', async () => {
    expect(ehEmbutido(SISTEMA_DRAGON_BALL.id)).toBe(true)
    expect(ehEmbutido(SISTEMA_ONE_PIECE.id)).toBe(true)
    await expect(apagarSistema(SISTEMA_DRAGON_BALL.id)).rejects.toThrow('não pode ser apagado')
    await expect(useRpgStore.getState().apagarSistema(SISTEMA_DRAGON_BALL.id)).rejects.toThrow('não pode ser apagado')
    await expect(gravarSistema({ ...SISTEMA_DRAGON_BALL, nome: 'Outro' })).rejects.toThrow('não muda')
    expect(useRpgStore.getState().biblioteca).toEqual([SISTEMA_ONE_PIECE, SISTEMA_DRAGON_BALL])
    expect(vi.mocked(fs.remove)).not.toHaveBeenCalled()
  })

  it('arquivo posto à mão com o id do DBT não toma o lugar do embutido', async () => {
    arquivos.set(PASTA, '<pasta>')
    arquivos.set(`${PASTA}/falso.json`, serializarSistema({ ...SISTEMA_DRAGON_BALL, nome: 'Dragon Ball Falso', livro: [] }))
    const { sistemas } = await listarSistemas()
    expect(sistemas.filter((sistema) => sistema.id === SISTEMA_DRAGON_BALL.id)).toEqual([SISTEMA_DRAGON_BALL])
  })
})

describe('SistemasDialog: Apagar só no que não é embutido', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  })

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('com os dois embutidos e uma cópia do DBT, só a cópia tem Apagar (pelo ehEmbutido de verdade)', async () => {
    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    act(() =>
      root.render(
        <SistemasDialog
          sistemas={useRpgStore.getState().biblioteca}
          escolhidoId={undefined}
          avisos={[]}
          onEscolher={vi.fn()}
          onImportar={vi.fn(async () => null)}
          onEditar={vi.fn()}
          onDuplicar={vi.fn(async (sistema) => sistema)}
          onExportar={vi.fn(async () => true)}
          onApagar={vi.fn(async () => undefined)}
          ehEmbutido={ehEmbutido}
          onClose={vi.fn()}
        />,
      ),
    )
    // A grade abre como diálogo no body (portal), não dentro do container.
    expect(document.body.querySelectorAll('.lb-sistema-cartao')).toHaveLength(3)
    const apagar = Array.from(document.body.querySelectorAll('button'))
      .map((botao) => botao.getAttribute('aria-label') ?? '')
      .filter((rotulo) => rotulo.startsWith('Apagar '))
    expect(apagar).toEqual([`Apagar ${copia.nome}`])
  })
})

describe('a aventura que usava a cópia apagada', () => {
  it('fica SEM sistema (não cai no DBT embutido, não lança) e o motor volta ao padrão; o arquivo guarda o id e as fichas DBT', async () => {
    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    const texto = aventuraNoDisco(copia.id, true)
    expect(resolver(texto)).toMatchObject({ sistema: copia, motor: MOTOR_DRAGON_BALL })

    await useRpgStore.getState().apagarSistema(copia.id)

    let resolvida: ReturnType<typeof resolver> | undefined
    expect(() => {
      resolvida = resolver(texto)
    }).not.toThrow()
    expect(resolvida?.sistema).toBeUndefined()
    expect(resolvida?.motor).toBe(MOTOR_PADRAO)
    // Nada do arquivo se perde: regravar e reler dá a mesma aventura, com o id da cópia e a ficha Dragon Ball.
    const aventura = resolvida?.aventura
    if (aventura === undefined) throw new Error('a aventura deveria abrir')
    expect(aventura.sistemaDeRpg).toBe(copia.id)
    expect(aventura.personagens?.[0].dbt).toMatchObject({ raca: 'saiyajin', epInicial: 3 })
    expect(parseAdventure(serializeAdventure(aventura))).toEqual(aventura)
  })

  it('importar de novo o arquivo exportado da cópia devolve a aventura ao sistema e ao motor do Dragon Ball', async () => {
    const copia = await useRpgStore.getState().duplicarSistema(SISTEMA_DRAGON_BALL)
    const exportado = serializarSistema(copia)
    const texto = aventuraNoDisco(copia.id, true)
    await useRpgStore.getState().apagarSistema(copia.id)
    expect(resolver(texto).sistema).toBeUndefined()

    const reimportado = await useRpgStore.getState().importarSistema(exportado)

    expect(reimportado).toEqual(copia)
    expect(resolver(texto)).toMatchObject({ sistema: copia, motor: MOTOR_DRAGON_BALL })
    expect(await importarSistema(exportado)).toEqual(copia)
  })
})
