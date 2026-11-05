/**
 * MOCHILA NA FICHA — correção C2: o marcador da pasta que não pode se perder
 * na configuração da pasta (`rpgComSistema`, `rpgComOsPersonagensDoMapa`) e o
 * MAPA QUE ENTRA numa pasta já convertida (`lib/mochila/pendentes.ts`,
 * `net/nuvem/mochilaPendente.ts`), sobre um DISCO FALSO em memória montado
 * como uma cópia do appData. Nunca toca o disco de verdade. Dados inventados.
 */
import { describe, expect, it, vi } from 'vitest'
import { serializeAdventure, type Adventure } from '../adventure'
import type { Equipe } from '../batalha/equipes'
import { createEmptyMap } from '../mapFactory'
import { serializeMap } from '../mapFile'
import { indiceDoArquivo, moverMapa, rpgComOsPersonagensDoMapa, rpgComSistema, rpgDoArquivo, serializarIndice, serializarRpg, type IndiceDasPastas, type RpgDaPasta } from '../pastasDeMapas'
import { novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import type { CarriedItem, MapData, Token } from '../../types/map'
import { migrarMochilaDoMapa, type DiscoDaMigracao } from '../../net/nuvem/migracaoDaMochila'
import { conferirMapaQueEntrou, ignorarPendente, marcarMapaQueEntrou, pendentesDaPasta, trazerPendente, type GravarFichasDaPasta } from '../../net/nuvem/mochilaPendente'
import { textoDoPendente, type ItemPendente } from './pendentes'

const APPDATA = 'C:/appdata'
const MAPS = `${APPDATA}/maps`
const PASTA_ID = 'pasta_one-piece'
const INDICE = `${APPDATA}/pastas/indice.json`
const RPG = `${APPDATA}/pastas/${PASTA_ID}/rpg.json`
const RELATORIO = `${APPDATA}/pastas/${PASTA_ID}/migracao-da-mochila.json`
const SKY = `${MAPS}/sky-lagoon/map.json`
const ARQUIPELAGO = `${MAPS}/arquipelago/map.json`
const AGORA = Date.UTC(2026, 10, 5, 18, 0, 0)

const POCAO_X1: CarriedItem = { id: 'vaga_pocao', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }
const POCAO_X2_DO_ARQUIPELAGO: CarriedItem = { id: 'vaga_pocao_arq', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true, quantidade: 2 }
const POCAO_X3_VELHA: CarriedItem = { ...POCAO_X1, quantidade: 3 }
const CORDA: CarriedItem = { id: 'pino_corda', nome: 'Corda' }
const MAPA_DO_TESOURO: CarriedItem = { id: 'pino_mapa', nome: 'Mapa do Tesouro' }
const EQUIPES: Equipe[] = [{ id: 'equipe_chapeus', nome: 'Chapéus de Palha', cor: '#aa2200', membros: ['p_luffy', 'p_zoro'] }]

function ficha(id: string, nome: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...extra }
}

function boneco(id: string, characterId: string | null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name: id, x: 0, y: 0, size: 1, image: null, ...extra }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 10, 10, 64), tokens }
}

interface DiscoFalso extends DiscoDaMigracao {
  arquivos: Map<string, string>
  texto(caminho: string): string
}

function discoFalso(arquivos = new Map<string, string>()): DiscoFalso {
  return {
    arquivos,
    texto: (caminho) => {
      const texto = arquivos.get(caminho)
      if (texto === undefined) throw new Error(`o disco falso não tem ${caminho}`)
      return texto
    },
    pastaDoApp: async () => APPDATA,
    ler: async (caminho) => arquivos.get(caminho) ?? null,
    gravar: async (caminho, texto) => {
      arquivos.set(caminho, texto)
    },
    gravadoEm: async () => 1,
    juntar: async (...partes) => partes.join('/'),
    pai: async (caminho) => caminho.slice(0, caminho.lastIndexOf('/')),
  }
}

const INDICE_DE_TESTE: IndiceDasPastas = { pastas: [{ id: PASTA_ID, nome: 'One Piece' }], mapas: [{ chave: 'sky-lagoon', pastaId: PASTA_ID }] }

/**
 * A pasta One Piece JÁ CONVERTIDA (marcador, equipes, relatório da migração):
 * Luffy com Poção ×1 e 30 moedas na ficha. Sky Lagoon na pasta (o Luffy de lá
 * ainda com a Poção ×3 de antes da conversão, no arquivo). O Arquipélago fora
 * das pastas: Luffy com Poção ×2, a Corda e 45 moedas; Zoro mostrando a ficha
 * dele; um vendedor NPC sem ficha.
 */
function appDataConvertido(): DiscoFalso {
  const disco = discoFalso()
  disco.arquivos.set(INDICE, serializarIndice(INDICE_DE_TESTE))
  const rpg: RpgDaPasta = {
    sistemaDeRpg: SISTEMA_ONE_PIECE.id,
    personagens: [ficha('p_luffy', 'Luffy', { mochila: [POCAO_X1], moedas: 30 }), ficha('p_zoro', 'Zoro', { mochila: [MAPA_DO_TESOURO] })],
    equipes: EQUIPES,
    mochilaMigrada: 1,
  }
  disco.arquivos.set(RPG, serializarRpg(rpg))
  disco.arquivos.set(RELATORIO, JSON.stringify({ versao: 1, onde: 'pasta One Piece', fichas: [{ ficha: 'Luffy' }] }, null, 2))
  disco.arquivos.set(SKY, serializeMap(mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X3_VELHA] })])))
  disco.arquivos.set(
    ARQUIPELAGO,
    serializeMap(
      mapa('arq', 'Arquipélago dos Ventos', [
        boneco('Luffy', 'p_luffy', { mochila: [POCAO_X2_DO_ARQUIPELAGO, CORDA], moedas: 45 }),
        boneco('Zoro', 'p_zoro', { mochila: [MAPA_DO_TESOURO] }),
        boneco('Vendedor', null, { mochila: [CORDA], moedas: 9 }),
      ]),
    ),
  )
  return disco
}

function rpgNoDisco(disco: DiscoFalso): RpgDaPasta {
  return rpgDoArquivo(JSON.parse(disco.texto(RPG)))
}

function mochilaDe(disco: DiscoFalso, id: string): Personagem {
  const achada = rpgNoDisco(disco).personagens.find((personagem) => personagem.id === id)
  if (achada === undefined) throw new Error(`sem a ficha ${id}`)
  return achada
}

/** O "Configurar pasta" grava pelo mesmo caminho que o app (`editarRpgDaPasta`): lê do disco, muda, grava. */
async function mudarRpgNoDisco(disco: DiscoFalso, mudar: (rpg: RpgDaPasta) => RpgDaPasta): Promise<void> {
  await disco.gravar(RPG, serializarRpg(mudar(rpgNoDisco(disco))))
}

function gravarFichasNoDisco(disco: DiscoFalso): GravarFichasDaPasta {
  return (mudar) => mudarRpgNoDisco(disco, mudar)
}

/** O "Mover…" do Carregar Mapa: o índice gravado com o mapa na pasta, e o mapa anotado e conferido. */
async function moverParaAPasta(disco: DiscoFalso, chave: string): Promise<ItemPendente[]> {
  const indice = indiceDoArquivo(JSON.parse(disco.texto(INDICE)))
  await disco.gravar(INDICE, serializarIndice(moverMapa(indice, chave, PASTA_ID)))
  expect(await marcarMapaQueEntrou(chave, disco, { agora: () => AGORA })).toBe(PASTA_ID)
  const conferido = await conferirMapaQueEntrou(chave, disco, { baixarMarca: false, agora: () => AGORA })
  return conferido?.novos ?? []
}

function relatorio(disco: DiscoFalso): Record<string, unknown> {
  return JSON.parse(disco.texto(RELATORIO))
}

function linhasDoRelatorio(disco: DiscoFalso): Record<string, unknown>[] {
  const linhas = relatorio(disco).itensDeMapasQueEntraram
  return Array.isArray(linhas) ? linhas : []
}

describe('o marcador da pasta na configuração da pasta', () => {
  it('trocar o Sistema universal para nenhum e voltar não roda a conversão de novo', async () => {
    const disco = appDataConvertido()
    await mudarRpgNoDisco(disco, (rpg) => rpgComSistema(rpg, null))
    const semSistema = rpgNoDisco(disco)
    expect(semSistema.sistemaDeRpg).toBeUndefined()
    expect(semSistema.mochilaMigrada).toBe(1)
    expect(semSistema.equipes).toEqual(EQUIPES)

    await mudarRpgNoDisco(disco, (rpg) => rpgComSistema(rpg, SISTEMA_ONE_PIECE.id))
    expect(rpgNoDisco(disco).mochilaMigrada).toBe(1)
    // A Sky Lagoon ainda tem a Poção ×3 de antes no arquivo: converter de novo a traria de volta à ficha.
    expect(await migrarMochilaDoMapa(SKY, disco)).toEqual({ feita: false, porque: 'ja-migrada' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([POCAO_X1])
  })

  it('Copiar de um mapa preserva o marcador e as equipes', async () => {
    const disco = appDataConvertido()
    const doMapa: RpgDaPasta = { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [ficha('p_luffy', 'Luffy do mapa'), ficha('p_nami', 'Nami')] }
    await mudarRpgNoDisco(disco, (rpg) => rpgComOsPersonagensDoMapa(rpg, doMapa))
    const depois = rpgNoDisco(disco)
    expect(depois.mochilaMigrada).toBe(1)
    expect(depois.equipes).toEqual(EQUIPES)
    expect(depois.personagens.map((personagem) => personagem.nome)).toEqual(['Luffy', 'Zoro', 'Nami'])
    expect(await migrarMochilaDoMapa(SKY, disco)).toEqual({ feita: false, porque: 'ja-migrada' })
  })

  it('Copiar de um mapa para a pasta sem sistema adota o do mapa e mantém o marcador', () => {
    const semSistema = rpgComSistema({ sistemaDeRpg: 'outro', personagens: [], mochilaMigrada: 1, equipes: EQUIPES }, null)
    const depois = rpgComOsPersonagensDoMapa(semSistema, { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [ficha('p_nami', 'Nami')] })
    expect(depois).toMatchObject({ sistemaDeRpg: SISTEMA_ONE_PIECE.id, mochilaMigrada: 1, equipes: EQUIPES })
  })
})

describe('o mapa que entra numa pasta convertida', () => {
  it('mover um mapa com Poção ×2 num boneco para a pasta onde a ficha tem ×1 gera o pendente "Poção ×2"', async () => {
    const disco = appDataConvertido()
    const novos = await moverParaAPasta(disco, 'arquipelago')
    const pocoes = novos.filter((pendente) => pendente.tipo === 'item' && pendente.item.nome === 'Poção')
    expect(pocoes).toHaveLength(1)
    expect(textoDoPendente(pocoes[0])).toBe('Poção ×2 do boneco Luffy (Arquipélago dos Ventos) não estão na mochila de Luffy.')
    // A Corda e as 45 moedas também só o boneco tem; o Zoro mostra a ficha; o NPC sem ficha fica de fora.
    expect(novos.map((pendente) => (pendente.tipo === 'item' ? pendente.item.nome : `${pendente.moedas} moedas`))).toEqual(['Poção', 'Corda', '45 moedas'])
    expect(novos.every((pendente) => pendente.personagemId === 'p_luffy')).toBe(true)
    // Nada é apagado antes da escolha: a ficha e o mapa como estavam.
    expect(mochilaDe(disco, 'p_luffy')).toMatchObject({ mochila: [POCAO_X1], moedas: 30 })
    expect(disco.texto(ARQUIPELAGO)).toContain('vaga_pocao_arq')
    // O relatório da migração continua inteiro, com as linhas novas ao lado.
    expect(relatorio(disco)).toMatchObject({ onde: 'pasta One Piece', fichas: [{ ficha: 'Luffy' }], mapasPorConferir: ['arquipelago'] })
    expect(linhasDoRelatorio(disco)).toHaveLength(3)
  })

  it('"Trazer para a ficha" deixa a ficha com ×3 e tira o pendente do aviso', async () => {
    const disco = appDataConvertido()
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    const feito = await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco), { agora: () => AGORA })
    expect(feito).toMatchObject({ ok: true, moedasDeFora: 0 })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
    expect((await pendentesDaPasta(PASTA_ID, disco)).map((pendente) => pendente.id)).not.toContain(pocao.id)
    expect(linhasDoRelatorio(disco).find((linha) => linha.id === pocao.id)).toMatchObject({ decisao: 'trazido', ficha: 'Luffy', boneco: 'Luffy' })
    // O segundo clique não soma de novo.
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toEqual({ ok: false, porque: 'ja-decidido' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('"Ignorar" deixa a ficha com ×1 e o relatório guarda a linha', async () => {
    const disco = appDataConvertido()
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    expect(await ignorarPendente(PASTA_ID, pocao.id, disco, { agora: () => AGORA })).toMatchObject({ ok: true })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([POCAO_X1])
    expect((await pendentesDaPasta(PASTA_ID, disco)).map((pendente) => pendente.id)).not.toContain(pocao.id)
    expect(linhasDoRelatorio(disco).find((linha) => linha.id === pocao.id)).toMatchObject({
      tipo: 'item',
      item: POCAO_X2_DO_ARQUIPELAGO,
      fichaId: 'p_luffy',
      mapa: 'Arquipélago dos Ventos',
      decisao: 'ignorado',
    })
  })

  it('as moedas trazidas somam na bolsa da ficha', async () => {
    const disco = appDataConvertido()
    const novos = await moverParaAPasta(disco, 'arquipelago')
    const bolsa = novos.find((pendente) => pendente.tipo === 'moedas')
    if (bolsa === undefined) throw new Error('sem o pendente das moedas')
    await trazerPendente(PASTA_ID, bolsa.id, disco, gravarFichasNoDisco(disco))
    expect(mochilaDe(disco, 'p_luffy').moedas).toBe(75)
  })

  it('o pendente sobrevive a recriar o estado a partir do disco', async () => {
    const disco = appDataConvertido()
    const antes = await moverParaAPasta(disco, 'arquipelago')
    // "Fechar o app": módulos novos e um disco novo com os mesmos arquivos.
    vi.resetModules()
    const reaberto = await import('../../net/nuvem/mochilaPendente')
    const outroDisco = discoFalso(new Map(disco.arquivos))
    const depois = await reaberto.pendentesDaPasta(PASTA_ID, outroDisco)
    expect(depois).toEqual(antes)
    expect(depois.map(textoDoPendente)).toContain('Poção ×2 do boneco Luffy (Arquipélago dos Ventos) não estão na mochila de Luffy.')
    // E a decisão continua valendo depois de reabrir.
    const [pocao] = depois
    await reaberto.trazerPendente(PASTA_ID, pocao.id, outroDisco, gravarFichasNoDisco(outroDisco))
    expect(mochilaDe(outroDisco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('a abertura confere de novo sem repetir o que já foi anotado e tira a marca', async () => {
    const disco = appDataConvertido()
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))
    // O mapa ainda no disco com a Poção ×2: a abertura não a anota de novo (já trazida).
    const aberto = await conferirMapaQueEntrou('arquipelago', disco, { baixarMarca: true })
    expect(aberto).toEqual({ pastaId: PASTA_ID, novos: [] })
    expect(relatorio(disco).mapasPorConferir).toEqual([])
    expect(linhasDoRelatorio(disco)).toHaveLength(3)
    // Sem marca, a abertura seguinte nem lê as cenas.
    expect(await conferirMapaQueEntrou('arquipelago', disco, { baixarMarca: true })).toEqual({ pastaId: PASTA_ID, novos: [] })
  })

  it('a abertura anota o item que o mapa ganhou depois do "Mover…"', async () => {
    const disco = appDataConvertido()
    await moverParaAPasta(disco, 'arquipelago')
    const bussola: CarriedItem = { id: 'pino_bussola', nome: 'Bússola' }
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('arq', 'Arquipélago dos Ventos', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X2_DO_ARQUIPELAGO, CORDA, bussola], moedas: 45 })])))
    const aberto = await conferirMapaQueEntrou('arquipelago', disco, { baixarMarca: true })
    expect(aberto?.novos.map((pendente) => (pendente.tipo === 'item' ? pendente.item.nome : 'moedas'))).toEqual(['Bússola'])
  })

  it('confere as cenas de fundo do mapa que entra; a mesma Poção em duas cenas é um pendente só', async () => {
    const disco = appDataConvertido()
    const adventure: Adventure = {
      version: 1,
      id: 'adv_arq',
      name: 'Arquipélago dos Ventos',
      startSceneId: 'praia',
      scenes: [
        { id: 'praia', name: 'Praia', file: 'map.json' },
        { id: 'caverna', name: 'Caverna', file: 'scenes/caverna/map.json' },
      ],
    }
    disco.arquivos.set(`${MAPS}/arquipelago/adventure.json`, serializeAdventure(adventure))
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('arq', 'Praia', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X2_DO_ARQUIPELAGO] })])))
    disco.arquivos.set(
      `${MAPS}/arquipelago/scenes/caverna/map.json`,
      serializeMap(mapa('caverna', 'Caverna', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X2_DO_ARQUIPELAGO, CORDA] })])),
    )
    const novos = await moverParaAPasta(disco, 'arquipelago')
    expect(novos.map((pendente) => `${pendente.cena}: ${pendente.tipo === 'item' ? pendente.item.nome : 'moedas'}`)).toEqual(['Praia: Poção', 'Caverna: Corda'])
  })

  it('ficha com vários bonecos no mesmo mapa: cada um fica com a sua mochila, sem pendente', async () => {
    const disco = appDataConvertido()
    disco.arquivos.set(
      ARQUIPELAGO,
      serializeMap(
        mapa('arq', 'Arquipélago dos Ventos', [
          boneco('Marinheiro 1', 'p_zoro', { mochila: [CORDA] }),
          boneco('Marinheiro 2', 'p_zoro', { moedas: 5 }),
        ]),
      ),
    )
    expect(await moverParaAPasta(disco, 'arquipelago')).toEqual([])
  })

  it('pasta ainda não convertida: nada a anotar (a migração da abertura junta o mapa)', async () => {
    const disco = appDataConvertido()
    const { mochilaMigrada: _marcador, ...naoConvertida } = rpgNoDisco(disco)
    disco.arquivos.set(RPG, serializarRpg(naoConvertida))
    disco.arquivos.delete(RELATORIO)
    const indice = indiceDoArquivo(JSON.parse(disco.texto(INDICE)))
    await disco.gravar(INDICE, serializarIndice(moverMapa(indice, 'arquipelago', PASTA_ID)))
    expect(await marcarMapaQueEntrou('arquipelago', disco)).toBeNull()
    expect(disco.arquivos.has(RELATORIO)).toBe(false)
  })

  it('mapa em "Configurar só neste mapa" fica marcado, sem conferir: o espelho da pasta não toca os bonecos dele', async () => {
    const disco = appDataConvertido()
    const indice: IndiceDasPastas = { ...INDICE_DE_TESTE, mapas: [...INDICE_DE_TESTE.mapas, { chave: 'arquipelago', pastaId: PASTA_ID, proprio: true }] }
    await disco.gravar(INDICE, serializarIndice(indice))
    expect(await marcarMapaQueEntrou('arquipelago', disco)).toBe(PASTA_ID)
    expect(await conferirMapaQueEntrou('arquipelago', disco, { baixarMarca: true })).toBeNull()
    expect(relatorio(disco).mapasPorConferir).toEqual(['arquipelago'])
  })

  it('relatório danificado: a cópia fica ao lado e os pendentes começam num relatório novo', async () => {
    const disco = appDataConvertido()
    disco.arquivos.set(RELATORIO, '{ quebrado')
    const novos = await moverParaAPasta(disco, 'arquipelago')
    expect(novos).toHaveLength(3)
    expect(disco.texto(`${RELATORIO}.danificado-${AGORA}`)).toBe('{ quebrado')
    expect(await pendentesDaPasta(PASTA_ID, disco)).toHaveLength(3)
  })
})
