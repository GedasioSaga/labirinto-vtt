/**
 * MOCHILA NA FICHA — a hora da cena na migração (fatia A2, correção da
 * revisão): renomear e duplicar, na tela Carregar Mapa, regravam o `map.json`
 * sem ninguém ter jogado. A migração não pode tomar esse mapa pelo "salvo por
 * último" (decisão 12.2).
 *
 * Roda o `renameMap`/`duplicateMap`/`saveMapToAppData` DE VERDADE sobre um
 * disco em memória posto no lugar do plugin de arquivos do Tauri, e a migração
 * lê o mesmo disco. Cada gravação anda o relógio, como o `mtime` do SO; a cópia
 * de arquivo leva a hora junto, como o `std::fs::copy` do plugin no Windows
 * (CopyFileEx). Nada toca o disco real. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeAdventure } from '../adventure'
import { createEmptyMap } from '../mapFactory'
import { deserializeMap, serializeMap } from '../mapFile'
import { duplicateMap, renameMap, saveMapToAppData } from '../mapFileIO'
import { indiceDoArquivo, rpgDoArquivo, serializarIndice, serializarRpg, type IndiceDasPastas } from '../pastasDeMapas'
import { novoPersonagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import type { CarriedItem, MapData, Token } from '../../types/map'
import { migrarMochilaDoMapa, type DiscoDaMigracao } from '../../net/nuvem/migracaoDaMochila'

const fsFalso = vi.hoisted(() => {
  const arquivos = new Map<string, { texto: string; ms: number }>()
  const relogio = { agora: 0 }
  function arquivo(caminho: string): { texto: string; ms: number } {
    const achado = arquivos.get(caminho)
    if (achado === undefined) throw new Error(`o disco falso não tem ${caminho}`)
    return achado
  }
  return {
    appData: 'C:/appdata',
    arquivos,
    relogio,
    existe: (caminho: string): boolean => arquivos.has(caminho) || [...arquivos.keys()].some((chave) => chave.startsWith(`${caminho}/`)),
    ler: (caminho: string): string => arquivo(caminho).texto,
    hora: (caminho: string): number => arquivo(caminho).ms,
    gravar: (caminho: string, texto: string): void => {
      relogio.agora += 1_000
      arquivos.set(caminho, { texto, ms: relogio.agora })
    },
    renomear: (de: string, para: string): void => {
      const movido = arquivo(de)
      arquivos.delete(de)
      arquivos.set(para, movido)
    },
    copiar: (de: string, para: string): void => {
      arquivos.set(para, { ...arquivo(de) })
    },
    apagar: (caminho: string): void => {
      arquivos.delete(caminho)
    },
    listar: (dir: string): { name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }[] => {
      const filhos = new Map<string, boolean>()
      for (const chave of arquivos.keys()) {
        if (!chave.startsWith(`${dir}/`)) continue
        const [nome, ...resto] = chave.slice(dir.length + 1).split('/')
        filhos.set(nome, (filhos.get(nome) ?? false) || resto.length > 0)
      }
      return [...filhos].map(([name, ehPasta]) => ({ name, isDirectory: ehPasta, isFile: !ehPasta, isSymlink: false }))
    },
  }
})

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async (caminho: string) => fsFalso.existe(caminho),
  readTextFile: async (caminho: string) => fsFalso.ler(caminho),
  writeTextFile: async (caminho: string, texto: string) => fsFalso.gravar(caminho, texto),
  rename: async (de: string, para: string) => fsFalso.renomear(de, para),
  copyFile: async (de: string, para: string) => fsFalso.copiar(de, para),
  remove: async (caminho: string) => fsFalso.apagar(caminho),
  mkdir: async () => undefined,
  readDir: async (dir: string) => fsFalso.listar(dir),
  stat: async (caminho: string) => ({ mtime: new Date(fsFalso.hora(caminho)) }),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: async () => null, open: async () => null }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: async () => undefined, isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => fsFalso.appData,
  join: async (...partes: string[]) => partes.join('/'),
  dirname: async (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/')),
}))

const APPDATA = fsFalso.appData
const PASTA_ID = 'pasta_one-piece'
const INDICE = `${APPDATA}/pastas/indice.json`
const RPG = `${APPDATA}/pastas/${PASTA_ID}/rpg.json`
const SKY = `${APPDATA}/maps/map_sky/map.json`
const GOA = `${APPDATA}/maps/map_goa/map.json`
const AVENTURA_VELHA = `${APPDATA}/maps/adv_velha`
/** As horas do disco antes de o mestre mexer em nada: Sky Lagoon antigo, Reino de Goa o mais recente. */
const HORA_DO_SKY = 1_000
const HORA_DO_GOA = 2_000

const POCAO_X3: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true, quantidade: 3 }
const POCAO_X1: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 10, 10, 64), tokens }
}

function poe(caminho: string, texto: string, ms: number): void {
  fsFalso.arquivos.set(caminho, { texto, ms })
}

function indice(chaves: readonly string[]): string {
  const conteudo: IndiceDasPastas = { pastas: [{ id: PASTA_ID, nome: 'One Piece' }], mapas: chaves.map((chave) => ({ chave, pastaId: PASTA_ID })) }
  return serializarIndice(conteudo)
}

/** O que `handleDuplicate` (LoadMapScreen) faz depois de duplicar: a cópia vai para a pasta do original. */
function copiaNaPasta(chave: string): void {
  const atual = indiceDoArquivo(JSON.parse(fsFalso.ler(INDICE)))
  poe(INDICE, indice([...atual.mapas.map((lugar) => lugar.chave), chave]), 1)
}

const discoDaMigracao: DiscoDaMigracao = {
  pastaDoApp: async () => APPDATA,
  // Arquivo que não existe é caso do domínio aqui (`null` = "não existe"; hora 0 = "o disco não diz").
  ler: async (caminho) => fsFalso.arquivos.get(caminho)?.texto ?? null,
  gravar: async (caminho, texto) => fsFalso.gravar(caminho, texto),
  gravadoEm: async (caminho) => fsFalso.arquivos.get(caminho)?.ms ?? 0,
  juntar: async (...partes) => partes.join('/'),
  pai: async (caminho) => caminho.slice(0, caminho.lastIndexOf('/')),
}

function mochilaDoLuffy(): [CarriedItem[] | undefined, number | undefined] {
  const luffy = rpgDoArquivo(JSON.parse(fsFalso.ler(RPG))).personagens.find((personagem) => personagem.id === 'p_luffy')
  if (luffy === undefined) throw new Error('o Luffy sumiu do rpg.json')
  return [luffy.mochila, luffy.moedas]
}

function relatorio(): { fichas: { ficha: string; veioDe: { mapa: string } }[]; diferencas: { tipo: string; mapa: string; gravadaEm: string | null }[] } {
  return JSON.parse(fsFalso.ler(`${APPDATA}/pastas/${PASTA_ID}/migracao-da-mochila.json`))
}

beforeEach(() => {
  fsFalso.arquivos.clear()
  // Tudo que o mestre fizer daqui em diante grava DEPOIS das cenas.
  fsFalso.relogio.agora = 100_000
  poe(INDICE, indice(['map_sky', 'map_goa']), 1)
  poe(RPG, serializarRpg({ sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [{ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'p_luffy' }] }), 1)
  poe(SKY, serializeMap(mapa('map_sky', 'Arquipelago do Ventos', [boneco('t_luffy_sky', 'p_luffy', { mochila: [POCAO_X3], moedas: 80 })])), HORA_DO_SKY)
  poe(GOA, serializeMap(mapa('map_goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy', { mochila: [POCAO_X1], moedas: 50 })])), HORA_DO_GOA)
})

describe('a hora da cena: renomear e duplicar não contam como "salvo por último"', () => {
  it('renomear o mapa antigo antes de abrir: ele continua antigo, e vale o Reino de Goa', async () => {
    const nome = await renameMap('map_sky', 'Arquipelago do Ventos (velho)')
    // O SO acha que o mapa renomeado é o mais novo: era isso que enganava a migração.
    expect(fsFalso.hora(SKY)).toBeGreaterThan(HORA_DO_GOA)
    expect(deserializeMap(fsFalso.ler(SKY)).name).toBe(nome)

    await migrarMochilaDoMapa(GOA, discoDaMigracao)

    expect(mochilaDoLuffy()).toEqual([[POCAO_X1], 50])
    expect(relatorio().fichas.map((linha) => [linha.ficha, linha.veioDe.mapa])).toEqual([['Luffy', 'Reino de Goa']])
    expect(relatorio().diferencas.map((linha) => [linha.tipo, linha.mapa, linha.gravadaEm])).toEqual([
      ['item-diferente', nome, new Date(HORA_DO_SKY).toISOString()],
      ['moedas-diferentes', nome, new Date(HORA_DO_SKY).toISOString()],
    ])
  })

  it('renomear duas vezes guarda a hora da primeira', async () => {
    await renameMap('map_sky', 'Primeiro nome')
    await renameMap('map_sky', 'Segundo nome')
    await migrarMochilaDoMapa(GOA, discoDaMigracao)
    expect(mochilaDoLuffy()).toEqual([[POCAO_X1], 50])
  })

  it('duplicar o mapa antigo e pôr a cópia na pasta: a cópia leva a hora do original e não vira a base', async () => {
    const copia = await duplicateMap('map_sky')
    copiaNaPasta(copia.id)
    expect(fsFalso.hora(copia.path)).toBeGreaterThan(HORA_DO_GOA)

    await migrarMochilaDoMapa(GOA, discoDaMigracao)

    expect(mochilaDoLuffy()).toEqual([[POCAO_X1], 50])
    expect(relatorio().diferencas.map((linha) => linha.gravadaEm)).toEqual(Array<string>(4).fill(new Date(HORA_DO_SKY).toISOString()))
  })

  it('duplicar uma aventura sem map.json na raiz: a cena regravada (imagem reapontada) leva a hora da original', async () => {
    poe(INDICE, indice(['adv_velha', 'map_goa']), 1)
    poe(
      `${AVENTURA_VELHA}/adventure.json`,
      serializeAdventure({ version: 1, id: 'adv_velha', name: 'Sky Lagoon', startSceneId: 'porto', scenes: [{ id: 'porto', name: 'Porto', file: 'scenes/porto/map.json' }] }),
      HORA_DO_SKY,
    )
    // A imagem mora DENTRO da pasta da aventura: duplicar reaponta e regrava a cena.
    const luffyComFoto = boneco('t_luffy_sky', 'p_luffy', { mochila: [POCAO_X3], moedas: 80, image: `${AVENTURA_VELHA}/luffy.png` })
    poe(`${AVENTURA_VELHA}/scenes/porto/map.json`, serializeMap(mapa('porto', 'Porto', [luffyComFoto])), HORA_DO_SKY)
    poe(`${AVENTURA_VELHA}/luffy.png`, 'png', HORA_DO_SKY)

    const copia = await duplicateMap('adv_velha')
    copiaNaPasta(copia.id)
    const cenaDaCopia = `${APPDATA}/maps/${copia.id}/scenes/porto/map.json`
    expect(deserializeMap(fsFalso.ler(cenaDaCopia)).tokens[0].image).toBe(`${APPDATA}/maps/${copia.id}/luffy.png`)
    expect(fsFalso.hora(cenaDaCopia)).toBeGreaterThan(HORA_DO_GOA)

    await migrarMochilaDoMapa(GOA, discoDaMigracao)

    expect(mochilaDoLuffy()).toEqual([[POCAO_X1], 50])
  })

  it('o mapa renomeado que o mestre abre, joga e salva no editor: aí sim ele é o salvo por último', async () => {
    await renameMap('map_sky', 'Arquipelago do Ventos (velho)')
    // O editor abre o mapa, o mestre joga (a Poção vira x2) e salva.
    const aberto = deserializeMap(fsFalso.ler(SKY))
    await saveMapToAppData({ ...aberto, tokens: aberto.tokens.map((token) => ({ ...token, mochila: [{ ...POCAO_X3, quantidade: 2 }] })) })

    await migrarMochilaDoMapa(GOA, discoDaMigracao)

    expect(mochilaDoLuffy()).toEqual([[{ ...POCAO_X3, quantidade: 2 }], 80])
  })

  it('hora torta no map.json (texto, negativa) vale como ausente: fica a do disco', async () => {
    const sky = mapa('map_sky', 'Arquipelago do Ventos', [boneco('t_luffy_sky', 'p_luffy', { mochila: [POCAO_X3], moedas: 80 })])
    poe(SKY, JSON.stringify({ ...sky, savedAtMs: 'ontem' }), 5_000)
    await migrarMochilaDoMapa(GOA, discoDaMigracao)
    expect(mochilaDoLuffy()).toEqual([[POCAO_X3], 80])

    poe(SKY, JSON.stringify({ ...sky, savedAtMs: -1 }), 5_000)
    poe(RPG, serializarRpg({ sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [{ ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'p_luffy' }] }), 1)
    await migrarMochilaDoMapa(GOA, discoDaMigracao)
    expect(mochilaDoLuffy()).toEqual([[POCAO_X3], 80])
  })
})
