/**
 * MOCHILA NA FICHA — a migração ao abrir (`net/nuvem/migracaoDaMochila.ts`,
 * fatia A2) sobre um DISCO FALSO em memória, montado como uma cópia do
 * appData: `<appData>/pastas/indice.json`, `<appData>/pastas/<id>/rpg.json`,
 * `<appData>/maps/<chave>/...`. Mora aqui (e não ao lado do arquivo) para
 * correr no aceite da fatia, `npx vitest run src/lib/mochila`.
 * Nunca toca o disco de verdade: o disco é injetado. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import { parseAdventure, serializeAdventure, type Adventure } from '../adventure'
import { createEmptyMap } from '../mapFactory'
import { serializeMap } from '../mapFile'
import { rpgDoArquivo, serializarIndice, serializarRpg } from '../pastasDeMapas'
import { novoPersonagem, type Personagem } from '../personagem'
import type { RecoveryCopy } from '../recoveryCopy'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import type { CarriedItem, MapData, Token } from '../../types/map'
import { migrarMochilaDoMapa, type DiscoDaMigracao } from '../../net/nuvem/migracaoDaMochila'

const APPDATA = 'C:/appdata'
const MAPS = `${APPDATA}/maps`
const PASTA_ID = 'pasta_one-piece'
const RPG = `${APPDATA}/pastas/${PASTA_ID}/rpg.json`
const RELATORIO_DA_PASTA = `${APPDATA}/pastas/${PASTA_ID}/migracao-da-mochila.json`
const AGORA = Date.UTC(2026, 10, 5, 15, 0, 0)
/** A hora que o disco falso dá a tudo que a migração grava: depois de todas as cenas. */
const HORA_DA_GRAVACAO = 9_000_000

const SKY_PRAIA = `${MAPS}/sky-lagoon/map.json`
const SKY_TEMPLO = `${MAPS}/sky-lagoon/scenes/templo/map.json`
const GOA = `${MAPS}/reino-de-goa/map.json`
const TESTE = `${MAPS}/mapa-de-teste/map.json`
const SOLTA_CENA = `${MAPS}/aventura-solta/scenes/porto/map.json`
const FORA_DO_APP = 'D:/campanhas/ilha-perdida/map.json'

const POCAO_X3: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true, quantidade: 3 }
const POCAO_X1: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }
const ESPADA: CarriedItem = { id: 'pino_espada', nome: 'Espada Velha' }
const MAPA_DO_TESOURO: CarriedItem = { id: 'pino_mapa', nome: 'Mapa do Tesouro' }
const CORDA: CarriedItem = { id: 'pino_corda', nome: 'Corda' }
const ESTILINGUE: CarriedItem = { id: 'pino_estilingue', nome: 'Estilingue' }
const BUSSOLA: CarriedItem = { id: 'pino_bussola', nome: 'Bússola' }

function ficha(id: string, nome: string): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id }
}

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 10, 10, 64), tokens }
}

function aventura(id: string, nome: string, cenas: { id: string; nome: string; arquivo: string }[], personagens?: Personagem[]): string {
  const adventure: Adventure = {
    version: 1,
    id,
    name: nome,
    startSceneId: cenas[0].id,
    scenes: cenas.map((cena) => ({ id: cena.id, name: cena.nome, file: cena.arquivo })),
    ...(personagens === undefined ? {} : { personagens }),
  }
  return serializeAdventure(adventure)
}

interface DiscoFalso extends DiscoDaMigracao {
  arquivos: Map<string, { texto: string; ms: number }>
  gravados: string[]
  texto(caminho: string): string
}

function discoFalso(): DiscoFalso {
  const arquivos = new Map<string, { texto: string; ms: number }>()
  const gravados: string[] = []
  return {
    arquivos,
    gravados,
    texto: (caminho) => {
      const arquivo = arquivos.get(caminho)
      if (arquivo === undefined) throw new Error(`o disco falso não tem ${caminho}`)
      return arquivo.texto
    },
    pastaDoApp: async () => APPDATA,
    ler: async (caminho) => arquivos.get(caminho)?.texto ?? null,
    gravar: async (caminho, texto) => {
      gravados.push(caminho)
      arquivos.set(caminho, { texto, ms: HORA_DA_GRAVACAO })
    },
    gravadoEm: async (caminho) => arquivos.get(caminho)?.ms ?? 0,
    juntar: async (...partes) => partes.join('/'),
    pai: async (caminho) => caminho.slice(0, caminho.lastIndexOf('/')),
  }
}

/** A cópia do appData: pasta One Piece (Sky Lagoon, Reino de Goa e o Mapa de Teste em "só neste mapa") e uma aventura fora das pastas. */
function appDataDeTeste(): DiscoFalso {
  const disco = discoFalso()
  const poe = (caminho: string, texto: string, ms: number): void => {
    disco.arquivos.set(caminho, { texto, ms })
  }
  poe(
    `${APPDATA}/pastas/indice.json`,
    serializarIndice({
      pastas: [{ id: PASTA_ID, nome: 'One Piece' }],
      mapas: [
        { chave: 'sky-lagoon', pastaId: PASTA_ID },
        { chave: 'reino-de-goa', pastaId: PASTA_ID },
        { chave: 'mapa-de-teste', pastaId: PASTA_ID, proprio: true },
      ],
    }),
    1,
  )
  poe(RPG, serializarRpg({ sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [ficha('p_luffy', 'Luffy'), ficha('p_zoro', 'Zoro')] }), 1)
  // Sky Lagoon: o mapa ANTIGO. Luffy com Poção x3 e 80 moedas; o Zoro com a Espada; um vendedor NPC sem ficha.
  poe(
    `${MAPS}/sky-lagoon/adventure.json`,
    aventura('adv_sky', 'Sky Lagoon', [
      { id: 'praia', nome: 'Praia', arquivo: 'map.json' },
      { id: 'templo', nome: 'Templo', arquivo: 'scenes/templo/map.json' },
    ]),
    1_000,
  )
  poe(SKY_PRAIA, serializeMap(mapa('praia', 'Praia', [boneco('t_luffy_sky', 'p_luffy', { mochila: [POCAO_X3], moedas: 80 }), boneco('t_vendedor', null, { mochila: [MAPA_DO_TESOURO], moedas: 500 })])), 1_000)
  poe(SKY_TEMPLO, serializeMap(mapa('templo', 'Templo', [boneco('t_zoro_sky', 'p_zoro', { mochila: [ESPADA] })])), 1_500)
  // Reino de Goa: o mapa solto MAIS RECENTE. Luffy com Poção x1 e 50 moedas.
  poe(GOA, serializeMap(mapa('goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy', { mochila: [POCAO_X1], moedas: 50 })])), 2_000)
  // Mapa de Teste ("Configurar só neste mapa"): as fichas moram no adventure.json dele.
  poe(`${MAPS}/mapa-de-teste/adventure.json`, aventura('adv_teste', 'Mapa de Teste', [{ id: 'sala', nome: 'Sala', arquivo: 'map.json' }], [ficha('p_teste', 'Boneco de Treino')]), 500)
  poe(TESTE, serializeMap(mapa('sala', 'Sala', [boneco('t_teste', 'p_teste', { mochila: [CORDA], moedas: 7 })])), 500)
  // Aventura sem pasta, aberta por uma cena em scenes/.
  poe(
    `${MAPS}/aventura-solta/adventure.json`,
    aventura(
      'adv_solta',
      'Aventura Solta',
      [
        { id: 'cais', nome: 'Cais', arquivo: 'map.json' },
        { id: 'porto', nome: 'Porto', arquivo: 'scenes/porto/map.json' },
      ],
      [ficha('p_usopp', 'Usopp')],
    ),
    300,
  )
  poe(`${MAPS}/aventura-solta/map.json`, serializeMap(mapa('cais', 'Cais', [])), 300)
  poe(SOLTA_CENA, serializeMap(mapa('porto', 'Porto', [boneco('t_usopp', 'p_usopp', { mochila: [ESTILINGUE] })])), 300)
  return disco
}

/** O `rg -c '"mochilaMigrada"' <arquivo>` do aceite, sobre o disco falso. */
function contaMarcador(texto: string): number {
  return texto.split('"mochilaMigrada"').length - 1
}

function fichasDoRpg(disco: DiscoFalso): Personagem[] {
  return rpgDoArquivo(JSON.parse(disco.texto(RPG))).personagens
}

describe('migração ao abrir: pasta (o que o usuário pediu: os itens atravessam os mapas)', () => {
  it('abrir um mapa antigo da pasta leva a mochila para as fichas, com relatório, cópia de antes e marcador', async () => {
    const disco = appDataDeTeste()
    const rpgAntes = disco.texto(RPG)
    const mapasAntes = [SKY_PRAIA, SKY_TEMPLO, GOA, TESTE].map((caminho) => disco.texto(caminho))

    const resultado = await migrarMochilaDoMapa(SKY_PRAIA, disco, { agora: () => AGORA })

    expect(resultado).toEqual({ feita: true, arquivo: RPG, relatorio: RELATORIO_DA_PASTA, copiaDeAntes: `${RPG}.antes-da-mochila`, fichas: 2, diferencas: 2, variosBonecos: 0 })
    expect(contaMarcador(disco.texto(RPG))).toBeGreaterThan(0)
    expect(rpgDoArquivo(JSON.parse(disco.texto(RPG))).mochilaMigrada).toBe(1)
    // Vale a cena gravada por último (Reino de Goa): Poção x1 e 50 moedas, não x3 nem 80.
    expect(fichasDoRpg(disco).map((personagem) => [personagem.nome, personagem.mochila, personagem.moedas])).toEqual([
      ['Luffy', [POCAO_X1], 50],
      ['Zoro', [ESPADA], undefined],
    ])
    expect(disco.texto(`${RPG}.antes-da-mochila`)).toBe(rpgAntes)
    // Os mapas não mudam: o vendedor sem ficha continua com o Mapa do Tesouro no boneco.
    expect([SKY_PRAIA, SKY_TEMPLO, GOA, TESTE].map((caminho) => disco.texto(caminho))).toEqual(mapasAntes)
    expect(disco.texto(SKY_PRAIA)).toContain('Mapa do Tesouro')
    // O Mapa de Teste ("só neste mapa") não entra na campanha da pasta.
    expect(contaMarcador(disco.texto(`${MAPS}/mapa-de-teste/adventure.json`))).toBe(0)
    expect(disco.gravados).toEqual([`${RPG}.antes-da-mochila`, RELATORIO_DA_PASTA, RPG])
  })

  it('o relatório diz de onde veio cada mochila e lista a Poção x3 e as 80 moedas do mapa antigo', async () => {
    const disco = appDataDeTeste()
    await migrarMochilaDoMapa(GOA, disco, { agora: () => AGORA })
    const relatorio = JSON.parse(disco.texto(RELATORIO_DA_PASTA))
    expect(relatorio.onde).toBe('pasta One Piece')
    expect(relatorio.feitaEm).toBe('2026-11-05T15:00:00.000Z')
    expect(relatorio.fichas.map((linha: { ficha: string; veioDe: { mapa: string } }) => [linha.ficha, linha.veioDe.mapa])).toEqual([
      ['Luffy', 'Reino de Goa'],
      ['Zoro', 'Sky Lagoon'],
    ])
    expect(relatorio.diferencas).toEqual([
      expect.objectContaining({ tipo: 'item-diferente', ficha: 'Luffy', item: 'Poção', vale: POCAO_X1, naOutraCena: POCAO_X3, mapa: 'Sky Lagoon', cena: 'Praia' }),
      expect.objectContaining({ tipo: 'moedas-diferentes', ficha: 'Luffy', vale: 50, naOutraCena: 80, mapa: 'Sky Lagoon', cena: 'Praia' }),
    ])
  })

  it('abrir de novo não migra de novo; a ficha criada depois não ganha mochila de migração (nasce pela ficha nova)', async () => {
    const disco = appDataDeTeste()
    await migrarMochilaDoMapa(GOA, disco)
    // O mestre cria a Nami depois da migração (o app regrava o rpg.json com o marcador).
    const rpg = rpgDoArquivo(JSON.parse(disco.texto(RPG)))
    disco.arquivos.set(RPG, { texto: serializarRpg({ ...rpg, personagens: [...rpg.personagens, ficha('p_nami', 'Nami')] }), ms: HORA_DA_GRAVACAO })
    const gravadosAntes = disco.gravados.length

    expect(await migrarMochilaDoMapa(SKY_PRAIA, disco)).toEqual({ feita: false, porque: 'ja-migrada' })
    expect(disco.gravados.length).toBe(gravadosAntes)
    expect(fichasDoRpg(disco).find((personagem) => personagem.id === 'p_nami')?.mochila).toBeUndefined()
  })

  it('o trabalho recuperado entra com a hora da cópia e vence o disco', async () => {
    const disco = appDataDeTeste()
    const praiaNaMemoria = mapa('praia', 'Praia', [boneco('t_luffy_sky', 'p_luffy', { mochila: [{ ...POCAO_X1, quantidade: 2 }, BUSSOLA], moedas: 60 })])
    const temploNaMemoria = mapa('templo', 'Templo', [boneco('t_zoro_sky', 'p_zoro')])
    const recuperado: RecoveryCopy = { savedAtMs: 3_000, mapPath: SKY_PRAIA, map: praiaNaMemoria, scenes: { templo: temploNaMemoria } }

    await migrarMochilaDoMapa(SKY_PRAIA, disco, { recuperado })

    expect(fichasDoRpg(disco).map((personagem) => [personagem.nome, personagem.mochila, personagem.moedas])).toEqual([
      ['Luffy', [{ ...POCAO_X1, quantidade: 2 }, BUSSOLA], 60],
      // O Zoro largou a Espada na memória (cópia mais nova que o disco): fica sem.
      ['Zoro', undefined, undefined],
    ])
  })

  it('ficha NPC ligada a três bonecos no mesmo mapa: o loot fica em cada boneco e o relatório lista os três', async () => {
    const disco = appDataDeTeste()
    const rpg = rpgDoArquivo(JSON.parse(disco.texto(RPG)))
    disco.arquivos.set(RPG, { texto: serializarRpg({ ...rpg, personagens: [...rpg.personagens, ficha('p_bandido', 'Bandido')] }), ms: 1 })
    const bandidos = [
      boneco('t_bandido_1', 'p_bandido', { name: 'Bandido 1', mochila: [ESPADA], moedas: 10 }),
      boneco('t_bandido_2', 'p_bandido', { name: 'Bandido 2', mochila: [MAPA_DO_TESOURO], moedas: 30 }),
      boneco('t_bandido_3', 'p_bandido', { name: 'Bandido 3', mochila: [CORDA], moedas: 5 }),
    ]
    disco.arquivos.set(GOA, { texto: serializeMap(mapa('goa', 'Reino de Goa', [boneco('t_luffy_goa', 'p_luffy', { mochila: [POCAO_X1], moedas: 50 }), ...bandidos])), ms: 2_000 })

    const resultado = await migrarMochilaDoMapa(GOA, disco, { agora: () => AGORA })

    expect(resultado).toMatchObject({ feita: true, fichas: 2, diferencas: 2, variosBonecos: 1 })
    const bandido = fichasDoRpg(disco).find((personagem) => personagem.id === 'p_bandido')
    expect([bandido?.mochila, bandido?.moedas]).toEqual([undefined, undefined])
    expect(rpgDoArquivo(JSON.parse(disco.texto(RPG))).mochilaMigrada).toBe(1)
    const relatorio = JSON.parse(disco.texto(RELATORIO_DA_PASTA))
    expect(relatorio.fichasComVariosBonecos).toEqual([
      {
        ficha: 'Bandido',
        fichaId: 'p_bandido',
        cenas: [
          {
            mapa: 'Reino de Goa',
            cena: '',
            gravadaEm: new Date(2_000).toISOString(),
            bonecos: [
              { boneco: 'Bandido 1', mochila: [ESPADA], moedas: 10 },
              { boneco: 'Bandido 2', mochila: [MAPA_DO_TESOURO], moedas: 30 },
              { boneco: 'Bandido 3', mochila: [CORDA], moedas: 5 },
            ],
          },
        ],
      },
    ])
    expect(relatorio.diferencas.map((linha: { ficha: string }) => linha.ficha)).toEqual(['Luffy', 'Luffy'])
  })

  it('rpg.json danificado não é regravado: o app abre pela cópia anterior e a migração espera', async () => {
    const disco = appDataDeTeste()
    disco.arquivos.set(RPG, { texto: '{"personagens": [', ms: 1 })
    expect(await migrarMochilaDoMapa(GOA, disco)).toEqual({ feita: false, porque: 'arquivo-ilegivel' })
    expect(disco.gravados).toEqual([])
  })
})

describe('migração ao abrir: fichas no adventure.json', () => {
  it('mapa em "Configurar só neste mapa": marcador no adventure.json dele e a mochila na ficha do mapa', async () => {
    const disco = appDataDeTeste()
    const rpgAntes = disco.texto(RPG)
    const adventurePath = `${MAPS}/mapa-de-teste/adventure.json`

    const resultado = await migrarMochilaDoMapa(TESTE, disco)

    expect(resultado).toMatchObject({ feita: true, arquivo: adventurePath, relatorio: `${MAPS}/mapa-de-teste/migracao-da-mochila.json` })
    expect(contaMarcador(disco.texto(adventurePath))).toBeGreaterThan(0)
    const lida = parseAdventure(disco.texto(adventurePath))
    expect(lida.mochilaMigrada).toBe(1)
    expect(lida.personagens?.map((personagem) => [personagem.nome, personagem.mochila, personagem.moedas])).toEqual([['Boneco de Treino', [CORDA], 7]])
    expect(disco.texto(`${adventurePath}.antes-da-mochila`)).not.toContain('mochilaMigrada')
    // As fichas da pasta não são deste mapa.
    expect(disco.texto(RPG)).toBe(rpgAntes)
    expect(await migrarMochilaDoMapa(TESTE, disco)).toEqual({ feita: false, porque: 'ja-migrada' })
  })

  it('aventura sem pasta, aberta por uma cena em scenes/: marcador no adventure.json e a mochila preenchida', async () => {
    const disco = appDataDeTeste()
    const adventurePath = `${MAPS}/aventura-solta/adventure.json`

    expect(await migrarMochilaDoMapa(SOLTA_CENA, disco)).toMatchObject({ feita: true, arquivo: adventurePath })

    expect(contaMarcador(disco.texto(adventurePath))).toBeGreaterThan(0)
    expect(parseAdventure(disco.texto(adventurePath)).personagens?.map((personagem) => personagem.mochila)).toEqual([[ESTILINGUE]])
  })

  it('aventura de fora do appData (Procurar no disco…) também migra', async () => {
    const disco = discoFalso()
    disco.arquivos.set('D:/campanhas/ilha-perdida/adventure.json', { texto: aventura('adv_ilha', 'Ilha Perdida', [{ id: 'ilha', nome: 'Ilha', arquivo: 'map.json' }], [ficha('p_robin', 'Robin')]), ms: 1 })
    disco.arquivos.set(FORA_DO_APP, { texto: serializeMap(mapa('ilha', 'Ilha', [boneco('t_robin', 'p_robin', { moedas: 3 })])), ms: 1 })

    await migrarMochilaDoMapa(FORA_DO_APP, disco)

    expect(parseAdventure(disco.texto('D:/campanhas/ilha-perdida/adventure.json')).personagens?.[0].moedas).toBe(3)
  })

  it('o marcador sobrevive a abrir e salvar a aventura (parseAdventure → serializeAdventure)', async () => {
    const disco = appDataDeTeste()
    await migrarMochilaDoMapa(TESTE, disco)
    const regravada = serializeAdventure(parseAdventure(disco.texto(`${MAPS}/mapa-de-teste/adventure.json`)))
    expect(parseAdventure(regravada).mochilaMigrada).toBe(1)
  })

  it('mapa solto fora de pasta não tem onde guardar ficha: nada é gravado', async () => {
    const disco = discoFalso()
    disco.arquivos.set(FORA_DO_APP, { texto: serializeMap(mapa('ilha', 'Ilha', [boneco('t_npc', null, { mochila: [CORDA] })])), ms: 1 })
    expect(await migrarMochilaDoMapa(FORA_DO_APP, disco)).toEqual({ feita: false, porque: 'sem-fichas' })
    expect(disco.gravados).toEqual([])
  })
})
