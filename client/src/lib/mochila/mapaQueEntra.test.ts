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
import {
  indiceDoArquivo,
  moverMapa,
  personagensQueAPastaNaoTem,
  rpgComOsPersonagensDoMapa,
  rpgComSistema,
  rpgDoArquivo,
  serializarIndice,
  serializarRpg,
  type IndiceDasPastas,
  type RpgDaPasta,
} from '../pastasDeMapas'
import { novoPersonagem, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import type { CarriedItem, MapData, Token } from '../../types/map'
import type { RecoveryCopy } from '../recoveryCopy'
import { migrarMochilaDoMapa, type DiscoDaMigracao } from '../../net/nuvem/migracaoDaMochila'
import {
  conferirMapaQueEntrou,
  ignorarPendente,
  mapaSaiuDaPasta,
  marcarFichasQueEntram,
  marcarMapaQueEntrou,
  pendentesDaPasta,
  retirarPendentesSemFicha,
  sistemaDaPastaMudou,
  trazerPendente,
  type GravarFichasDaPasta,
} from '../../net/nuvem/mochilaPendente'
import { quantidadeDe } from '../items'
import type { CenaDaJuncao } from './juncao'
import { cenasComAsFichasDoMapa, pendentesDaReconferencia, textoDoIgnoradoSemSaber, textoDoPendente, type ItemPendente } from './pendentes'

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
  /** O `mtime` de cada arquivo (ms); ausente = 1. O editor salva sem `savedAtMs`, então a hora do salvar é esta. */
  horas: Map<string, number>
  texto(caminho: string): string
}

function discoFalso(arquivos = new Map<string, string>()): DiscoFalso {
  const horas = new Map<string, number>()
  return {
    arquivos,
    horas,
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
    gravadoEm: async (caminho) => horas.get(caminho) ?? 1,
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

/** O "Mover…" para fora das pastas: o índice gravado sem o mapa e a saída conferida (com o trabalho do editor, se o mapa estava aberto). */
async function tirarDaPasta(disco: DiscoFalso, chave: string, recuperado: RecoveryCopy | null = null): Promise<void> {
  const indice = indiceDoArquivo(JSON.parse(disco.texto(INDICE)))
  await disco.gravar(INDICE, serializarIndice(moverMapa(indice, chave, null)))
  await mapaSaiuDaPasta(chave, PASTA_ID, disco, { recuperado, agora: () => AGORA })
}

/** "Poção" ou "45 moedas": o que o pendente leva. */
function rotulo(pendente: ItemPendente): string {
  return pendente.tipo === 'item' ? pendente.item.nome : `${pendente.moedas} moedas`
}

async function trazerTodos(disco: DiscoFalso, pendentes: readonly ItemPendente[]): Promise<void> {
  for (const pendente of pendentes) expect(await trazerPendente(PASTA_ID, pendente.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: true })
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

describe('o que só o boneco tem: a vaga é a identidade do item', () => {
  it('a Poção ×1 do boneco numa vaga que a ficha não tem é pendente, mesmo igual à da ficha; a bolsa sem vaga em comum conta inteira', async () => {
    const disco = appDataConvertido()
    // O Mapa de Teste: o Luffy de lá com a Poção do acervo noutra vaga e 30 moedas, como a ficha.
    const pocaoDoMapaDeTeste: CarriedItem = { ...POCAO_X1, id: 'vaga_pocao_teste' }
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('teste', 'Mapa de Teste', [boneco('Luffy', 'p_luffy', { mochila: [pocaoDoMapaDeTeste], moedas: 30 })])))
    const novos = await moverParaAPasta(disco, 'arquipelago')
    expect(novos.map(textoDoPendente)).toEqual([
      'Poção do boneco Luffy (Mapa de Teste) não está na mochila de Luffy.',
      '30 moedas do boneco Luffy (Mapa de Teste) não estão na bolsa de Luffy.',
    ])
    await trazerTodos(disco, novos)
    expect(mochilaDe(disco, 'p_luffy')).toMatchObject({ mochila: [{ ...POCAO_X1, quantidade: 2 }], moedas: 60 })
  })

  it('o boneco que mostra a cópia da ficha (as mesmas vagas e a mesma bolsa) não gera pendente', async () => {
    const disco = appDataConvertido()
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('arq', 'Arquipélago dos Ventos', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X1], moedas: 30 })])))
    expect(await moverParaAPasta(disco, 'arquipelago')).toEqual([])
  })

  it('na vaga da ficha conta só a pilha que cresceu; a bolsa do boneco que veio do espelho, só o que passa da ficha', async () => {
    const disco = appDataConvertido()
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('arq', 'Arquipélago dos Ventos', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X3_VELHA], moedas: 45 })])))
    const novos = await moverParaAPasta(disco, 'arquipelago')
    expect(novos.map(textoDoPendente)).toEqual([
      'Poção ×2 do boneco Luffy (Arquipélago dos Ventos) não estão na mochila de Luffy.',
      '15 moedas do boneco Luffy (Arquipélago dos Ventos) não estão na bolsa de Luffy.',
    ])
    await trazerTodos(disco, novos)
    expect(mochilaDe(disco, 'p_luffy')).toMatchObject({ mochila: [{ ...POCAO_X1, quantidade: 3 }], moedas: 45 })
  })

  it('a vaga da ficha com pilha menor no boneco (ele gastou) não gera pendente: a ficha vence', async () => {
    const disco = appDataConvertido()
    await mudarRpgNoDisco(disco, (rpg) => ({ ...rpg, personagens: rpg.personagens.map((personagem) => (personagem.id === 'p_luffy' ? { ...personagem, mochila: [POCAO_X3_VELHA] } : personagem)) }))
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('arq', 'Arquipélago dos Ventos', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X1], moedas: 30 })])))
    expect(await moverParaAPasta(disco, 'arquipelago')).toEqual([])
  })
})

describe('a pasta convertida que fica sem Sistema universal e volta', () => {
  const SEM_SISTEMA = AGORA
  const JOGADO = AGORA + 60_000
  const VOLTA = AGORA + 120_000

  /** A One Piece com o Arquipélago também dentro; os dois mapas salvos antes da troca, a Sky Lagoon mostrando a ficha do Luffy. */
  function pastaComDoisMapas(): DiscoFalso {
    const disco = appDataConvertido()
    disco.arquivos.set(INDICE, serializarIndice({ ...INDICE_DE_TESTE, mapas: [...INDICE_DE_TESTE.mapas, { chave: 'arquipelago', pastaId: PASTA_ID }] }))
    disco.arquivos.set(SKY, serializeMap(mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X1], moedas: 30 })])))
    disco.horas.set(SKY, SEM_SISTEMA - 60_000)
    disco.horas.set(ARQUIPELAGO, SEM_SISTEMA - 60_000)
    return disco
  }

  /** O "Sistema universal" da configuração da pasta: grava o `rpg.json` e avisa a mochila. */
  async function trocarSistema(disco: DiscoFalso, sistemaId: string | null, vinhaSemSistema: boolean, agoraMs: number, aberto: string | null = null): Promise<string[]> {
    await mudarRpgNoDisco(disco, (rpg) => rpgComSistema(rpg, sistemaId))
    return sistemaDaPastaMudou(PASTA_ID, vinhaSemSistema, disco, { agora: () => agoraMs, aberto })
  }

  async function conferir(disco: DiscoFalso, chave: string, recuperado: RecoveryCopy | null = null): Promise<ItemPendente[]> {
    const conferido = await conferirMapaQueEntrou(chave, disco, { baixarMarca: false, recuperado, agora: () => VOLTA })
    if (conferido === null) throw new Error(`o mapa ${chave} não foi conferido`)
    return conferido.novos
  }

  it('o que o boneco ganhou sem sistema vira pendente na volta, só nos mapas salvos nesse meio-tempo', async () => {
    const disco = pastaComDoisMapas()
    expect(await trocarSistema(disco, null, false, SEM_SISTEMA)).toEqual([])
    expect(relatorio(disco).semSistemaDesde).toBe(new Date(SEM_SISTEMA).toISOString())
    // Sem sistema a mochila mora no boneco: o mestre dá 2 Poções ao Luffy da Sky Lagoon e salva.
    disco.arquivos.set(SKY, serializeMap(mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X3_VELHA], moedas: 30 })])))
    disco.horas.set(SKY, JOGADO)

    // O Arquipélago não foi salvo sem sistema: fica de fora.
    expect(await trocarSistema(disco, SISTEMA_ONE_PIECE.id, true, VOLTA)).toEqual(['sky-lagoon'])
    expect(relatorio(disco)).not.toHaveProperty('semSistemaDesde')
    expect(relatorio(disco).mapasPorConferir).toEqual(['sky-lagoon'])
    // O marcador ficou: a pasta não é convertida de novo.
    expect(await migrarMochilaDoMapa(SKY, disco)).toEqual({ feita: false, porque: 'ja-migrada' })

    const novos = await conferir(disco, 'sky-lagoon')
    expect(novos.map(textoDoPendente)).toEqual(['Poção ×2 do boneco Luffy (Sky Lagoon) não estão na mochila de Luffy.'])
    await trazerTodos(disco, novos)
    expect(mochilaDe(disco, 'p_luffy')).toMatchObject({ mochila: [{ ...POCAO_X1, quantidade: 3 }], moedas: 30 })
  })

  it('sem a hora anotada (a pasta ficou sem sistema antes desta versão), a volta marca todos os mapas da pasta', async () => {
    const disco = pastaComDoisMapas()
    await mudarRpgNoDisco(disco, (rpg) => rpgComSistema(rpg, null))
    expect(await trocarSistema(disco, SISTEMA_ONE_PIECE.id, true, VOLTA)).toEqual(['sky-lagoon', 'arquipelago'])
  })

  it('trocar de um sistema para outro, sem passar por "Nenhum", não marca nada', async () => {
    const disco = pastaComDoisMapas()
    expect(await trocarSistema(disco, 'outro-sistema', false, VOLTA)).toEqual([])
    expect(relatorio(disco)).not.toHaveProperty('mapasPorConferir')
  })

  it('o mapa aberto da pasta conta mesmo sem salvar: o trabalho do editor é conferido', async () => {
    const disco = pastaComDoisMapas()
    await trocarSistema(disco, null, false, SEM_SISTEMA)
    expect(await trocarSistema(disco, SISTEMA_ONE_PIECE.id, true, VOLTA, 'sky-lagoon')).toEqual(['sky-lagoon'])
    const bussola: CarriedItem = { id: 'pino_bussola', nome: 'Bússola' }
    const noEditor: RecoveryCopy = { savedAtMs: VOLTA, mapPath: SKY, map: mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X1, bussola], moedas: 30 })]), scenes: {} }
    expect((await conferir(disco, 'sky-lagoon', noEditor)).map(rotulo)).toEqual(['Bússola'])
  })

  it('o trabalho que só existia na cópia de recuperação (o app caiu sem salvar) marca o mapa, e o "Recuperar" confere com ela', async () => {
    const disco = pastaComDoisMapas()
    await trocarSistema(disco, null, false, SEM_SISTEMA)
    // Sem sistema, o mestre dá 2 Poções ao Luffy da Sky Lagoon e o app cai antes de salvar: só a cópia de recuperação as tem.
    const copia: RecoveryCopy = { savedAtMs: JOGADO, mapPath: SKY, map: mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X3_VELHA], moedas: 30 })]), scenes: {} }
    await mudarRpgNoDisco(disco, (rpg) => rpgComSistema(rpg, SISTEMA_ONE_PIECE.id))
    expect(await sistemaDaPastaMudou(PASTA_ID, true, disco, { agora: () => VOLTA, recuperacao: copia })).toEqual(['sky-lagoon'])
    expect(relatorio(disco).mapasPorConferir).toEqual(['sky-lagoon'])
    // A abertura pelo "Recuperar" confere com a cópia: o pendente "Poção ×2", e "Trazer" deixa ×3.
    const novos = await conferir(disco, 'sky-lagoon', copia)
    expect(novos.map(textoDoPendente)).toEqual(['Poção ×2 do boneco Luffy (Sky Lagoon) não estão na mochila de Luffy.'])
    await trazerTodos(disco, novos)
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('a cópia de recuperação feita antes do "Nenhum" não marca o mapa (nem sem cópia nenhuma)', async () => {
    const velha: RecoveryCopy = { savedAtMs: SEM_SISTEMA - 1_000, mapPath: SKY, map: mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X3_VELHA] })]), scenes: {} }
    for (const recuperacao of [velha, null]) {
      const disco = pastaComDoisMapas()
      await trocarSistema(disco, null, false, SEM_SISTEMA)
      await mudarRpgNoDisco(disco, (rpg) => rpgComSistema(rpg, SISTEMA_ONE_PIECE.id))
      expect(await sistemaDaPastaMudou(PASTA_ID, true, disco, { agora: () => VOLTA, recuperacao })).toEqual([])
    }
  })
})

describe('o mapa que sai da pasta', () => {
  it('movido por engano e tirado: o aviso some, "Trazer" recusa e o boneco segue com a Poção ×2; voltando, é conferido de novo', async () => {
    const disco = appDataConvertido()
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    await tirarDaPasta(disco, 'arquipelago')
    expect(await pendentesDaPasta(PASTA_ID, disco)).toEqual([])
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: false, porque: 'saiu' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([POCAO_X1])
    expect(disco.texto(ARQUIPELAGO)).toContain('vaga_pocao_arq')
    // As linhas ficam no relatório, marcadas; a marca de conferir sai.
    expect(linhasDoRelatorio(disco).map((linha) => linha.decisao)).toEqual(['saiu', 'saiu', 'saiu'])
    expect(relatorio(disco).mapasPorConferir).toEqual([])
    // Voltando: conferido como novo, sem o "saiu" de antes segurar nada.
    expect((await moverParaAPasta(disco, 'arquipelago')).map(rotulo)).toEqual(['Poção', 'Corda', '45 moedas'])
  })

  it('tirado por outro caminho (sem o "Mover…"): o aviso e o "Trazer" conferem o índice, sem gravar', async () => {
    const disco = appDataConvertido()
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    const indice = indiceDoArquivo(JSON.parse(disco.texto(INDICE)))
    await disco.gravar(INDICE, serializarIndice(moverMapa(indice, 'arquipelago', null)))
    const antes = disco.texto(RELATORIO)
    expect(await pendentesDaPasta(PASTA_ID, disco)).toEqual([])
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: false, porque: 'saiu' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([POCAO_X1])
    expect(disco.texto(RELATORIO)).toBe(antes)
  })

  it('aberto e salvo na pasta, depois tirado: o que o espelho tirou do boneco continua esperando, e "Trazer" leva à ficha', async () => {
    const disco = appDataConvertido()
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    // Aberto e salvo na pasta: o Luffy de lá passou a mostrar a ficha.
    disco.arquivos.set(ARQUIPELAGO, serializeMap(mapa('arq', 'Arquipélago dos Ventos', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X1], moedas: 30 })])))
    await tirarDaPasta(disco, 'arquipelago')
    expect((await pendentesDaPasta(PASTA_ID, disco)).map(rotulo)).toEqual(['Poção', 'Corda', '45 moedas'])
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: true })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('o mapa aberto que sai: vale o trabalho do editor, não o disco ainda sem salvar', async () => {
    const disco = appDataConvertido()
    await moverParaAPasta(disco, 'arquipelago')
    // Aberto na pasta e ainda sem salvar: no editor o Luffy mostra a ficha; no disco, a Poção ×2 de antes.
    const espelhado = mapa('arq', 'Arquipélago dos Ventos', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X1], moedas: 30 })])
    await tirarDaPasta(disco, 'arquipelago', { savedAtMs: AGORA, mapPath: ARQUIPELAGO, map: espelhado, scenes: {} })
    expect(linhasDoRelatorio(disco).map((linha) => linha.decisao)).toEqual([undefined, undefined, undefined])
    // Enquanto o disco ainda tem a Poção no boneco, o aviso a esconde...
    expect(await pendentesDaPasta(PASTA_ID, disco)).toEqual([])
    // ...e, salvo o mapa como o editor o tinha, ela volta: só o pendente a guarda.
    disco.arquivos.set(ARQUIPELAGO, serializeMap(espelhado))
    expect((await pendentesDaPasta(PASTA_ID, disco)).map(rotulo)).toEqual(['Poção', 'Corda', '45 moedas'])
  })
})

describe('a ficha nova que entra numa pasta convertida ("Importar personagens…", "Copiar de um mapa")', () => {
  const MERRY = `${MAPS}/going-merry/map.json`
  const POCAO_DO_USOPP: CarriedItem = { id: 'vaga_pocao_usopp', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true, quantidade: 2 }
  const AVISO_DO_USOPP = 'Poção ×2 do boneco Usopp (Going Merry) não estão na mochila de Usopp.'
  /** As fichas do próprio Going Merry (o mapa nunca foi convertido: o Usopp de lá não tem mochila na ficha). */
  const DO_MERRY: RpgDaPasta = { sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [ficha('p_usopp', 'Usopp')] }

  /** O Going Merry fora das pastas: o boneco do Usopp ligado à ficha do PRÓPRIO mapa, com Poção ×2, e um vendedor sem ficha. */
  function comOGoingMerry(): DiscoFalso {
    const disco = appDataConvertido()
    disco.arquivos.set(MERRY, serializeMap(mapa('merry', 'Going Merry', [boneco('Usopp', 'p_usopp', { mochila: [POCAO_DO_USOPP] }), boneco('Vendedor', null, { mochila: [CORDA] })])))
    return disco
  }

  /** "Copiar de um mapa" como o app faz: marca ANTES de gravar o `rpg.json` e grava. Devolve os mapas marcados. */
  async function copiarDoMerry(disco: DiscoFalso): Promise<string[]> {
    const novas = personagensQueAPastaNaoTem(rpgNoDisco(disco).personagens, DO_MERRY.personagens)
    const { marcados } = await marcarFichasQueEntram(PASTA_ID, novas, disco, { agora: () => AGORA })
    await mudarRpgNoDisco(disco, (rpg) => rpgComOsPersonagensDoMapa(rpg, DO_MERRY))
    return marcados
  }

  /** O Going Merry aberto no editor: o Usopp com a Poção ×2 do disco e a Corda que ganhou sem salvar. */
  function merryAberto(): RecoveryCopy {
    const trabalho = mapa('merry', 'Going Merry', [boneco('Usopp', 'p_usopp', { mochila: [POCAO_DO_USOPP, CORDA] }), boneco('Vendedor', null, { mochila: [CORDA] })])
    return { savedAtMs: AGORA, mapPath: MERRY, map: trabalho, scenes: {} }
  }

  /** "Copiar de um mapa" com o Going Merry aberto: a marca e os pendentes do mapa aberto, ANTES do `rpg.json`. */
  async function marcarComOMerryAberto(disco: DiscoFalso): Promise<ItemPendente[]> {
    const novas = personagensQueAPastaNaoTem(rpgNoDisco(disco).personagens, DO_MERRY.personagens)
    const { marcados, novos } = await marcarFichasQueEntram(PASTA_ID, novas, disco, { recuperado: merryAberto(), aberto: 'going-merry', agora: () => AGORA })
    expect(marcados).toEqual(['going-merry'])
    return novos
  }

  const AVISOS_DO_MERRY_ABERTO = [AVISO_DO_USOPP, 'Corda do boneco Usopp (Going Merry) não está na mochila de Usopp.']

  /** Abrir o mapa: confere o que estiver marcado e tira a marca. */
  async function abrirOMapa(disco: DiscoFalso, chave: string): Promise<ItemPendente[]> {
    return (await conferirMapaQueEntrou(chave, disco, { baixarMarca: true, agora: () => AGORA }))?.novos ?? []
  }

  it('Mover, Copiar de um mapa e abrir: o pendente "Poção ×2" do Usopp', async () => {
    const disco = comOGoingMerry()
    expect(await moverParaAPasta(disco, 'going-merry')).toEqual([])
    expect(await copiarDoMerry(disco)).toEqual(['going-merry'])
    expect((await abrirOMapa(disco, 'going-merry')).map(textoDoPendente)).toEqual([AVISO_DO_USOPP])
  })

  it('aberto depois do Mover (a marca saiu), Copiar de um mapa e abrir de novo: o pendente "Poção ×2", nada apagado antes da escolha', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    // A primeira abertura na pasta: o Usopp ainda não é da pasta, o espelho não o toca, e a marca do "Mover…" sai.
    expect(await abrirOMapa(disco, 'going-merry')).toEqual([])
    expect(relatorio(disco).mapasPorConferir).toEqual([])
    // "Copiar de um mapa": a marca entra ANTES do rpg.json, só para a ficha nova.
    expect(await copiarDoMerry(disco)).toEqual(['going-merry'])
    expect(relatorio(disco).fichasNovasPorConferir).toEqual({ 'going-merry': ['p_usopp'] })
    expect(mochilaDe(disco, 'p_usopp').mochila).toBeUndefined()
    // Abrir: o que o boneco carrega vira pendente antes do espelho; o mapa no disco segue com a Poção.
    const [pocao] = await abrirOMapa(disco, 'going-merry')
    expect(textoDoPendente(pocao)).toBe(AVISO_DO_USOPP)
    expect(disco.texto(MERRY)).toContain('vaga_pocao_usopp')
    expect(relatorio(disco)).not.toHaveProperty('fichasNovasPorConferir')
    // Sobrevive a fechar o app, e "Trazer" leva à ficha nova.
    expect((await pendentesDaPasta(PASTA_ID, discoFalso(new Map(disco.arquivos)))).map(textoDoPendente)).toEqual([AVISO_DO_USOPP])
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco), { novoId: () => 'vaga_nova' })).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(mochilaDe(disco, 'p_usopp').mochila).toEqual([{ ...POCAO_DO_USOPP, id: 'vaga_nova' }])
  })

  it('o app confere já depois de gravar (o aviso aparece sem abrir), e a abertura não repete', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    await abrirOMapa(disco, 'going-merry')
    const [chave] = await copiarDoMerry(disco)
    const conferido = await conferirMapaQueEntrou(chave, disco, { baixarMarca: false, agora: () => AGORA })
    expect(conferido?.novos.map(textoDoPendente)).toEqual([AVISO_DO_USOPP])
    expect(await abrirOMapa(disco, 'going-merry')).toEqual([])
    expect(await pendentesDaPasta(PASTA_ID, disco)).toHaveLength(1)
  })

  it('confere SÓ as fichas novas: o boneco velho do Luffy na Sky Lagoon (salvo antes da conversão) não vira pendente', async () => {
    const disco = comOGoingMerry()
    // A Sky Lagoon já é da pasta: o Luffy de lá ainda com a Poção ×3 de antes da conversão, e agora um Usopp com a Corda.
    disco.arquivos.set(SKY, serializeMap(mapa('sky', 'Sky Lagoon', [boneco('Luffy', 'p_luffy', { mochila: [POCAO_X3_VELHA] }), boneco('Usopp', 'p_usopp', { mochila: [CORDA] })])))
    expect(await copiarDoMerry(disco)).toEqual(['sky-lagoon'])
    expect((await abrirOMapa(disco, 'sky-lagoon')).map(textoDoPendente)).toEqual(['Corda do boneco Usopp (Sky Lagoon) não está na mochila de Usopp.'])
  })

  it('nada a marcar: ficha que a pasta já tem, ficha sem boneco nos mapas dela (a importação, de id novo) e pasta ainda não convertida', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    const antes = disco.texto(RELATORIO)
    const nada = { marcados: [], novos: [] }
    expect(await marcarFichasQueEntram(PASTA_ID, [ficha('p_luffy', 'Luffy')], disco)).toEqual(nada)
    expect(await marcarFichasQueEntram(PASTA_ID, [ficha('p_nami_importada', 'Nami')], disco)).toEqual(nada)
    expect(disco.texto(RELATORIO)).toBe(antes)
    const { mochilaMigrada: _marcador, ...naoConvertida } = rpgNoDisco(disco)
    disco.arquivos.set(RPG, serializarRpg(naoConvertida))
    expect(await marcarFichasQueEntram(PASTA_ID, DO_MERRY.personagens, disco, { recuperado: merryAberto(), aberto: 'going-merry' })).toEqual(nada)
    expect(disco.texto(RELATORIO)).toBe(antes)
  })

  it('índice ilegível: lança (quem chama não grava o rpg.json)', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    disco.arquivos.set(INDICE, '{ quebrado')
    await expect(marcarFichasQueEntram(PASTA_ID, DO_MERRY.personagens, disco)).rejects.toThrow('o índice das pastas não abriu')
  })

  it('com o mapa aberto: o pendente dele entra ANTES do rpg.json; a conferência cai, o mestre salva o boneco vazio, e o pendente segue', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    await abrirOMapa(disco, 'going-merry')
    // Do trabalho do editor (a Corda ainda não foi salva), na mesma gravação da marca, com o rpg.json ainda sem o Usopp.
    expect((await marcarComOMerryAberto(disco)).map(textoDoPendente)).toEqual(AVISOS_DO_MERRY_ABERTO)
    expect(rpgNoDisco(disco).personagens.map((personagem) => personagem.id)).not.toContain('p_usopp')
    expect(linhasDoRelatorio(disco)).toHaveLength(2)
    await mudarRpgNoDisco(disco, (rpg) => rpgComOsPersonagensDoMapa(rpg, DO_MERRY))
    // O espelho esvaziou o Usopp na memória, a conferência de depois caiu (não roda), e o mestre salvou: o disco perdeu a Poção.
    disco.arquivos.set(MERRY, serializeMap(mapa('merry', 'Going Merry', [boneco('Usopp', 'p_usopp'), boneco('Vendedor', null, { mochila: [CORDA] })])))
    expect(await abrirOMapa(disco, 'going-merry')).toEqual([])
    const pendentes = await pendentesDaPasta(PASTA_ID, discoFalso(new Map(disco.arquivos)))
    expect(pendentes.map(textoDoPendente)).toEqual(AVISOS_DO_MERRY_ABERTO)
    // A conferência de depois (quando roda) não repete o que já entrou.
    expect((await conferirMapaQueEntrou('going-merry', disco, { baixarMarca: false, recuperado: merryAberto(), agora: () => AGORA }))?.novos).toEqual([])
    await trazerTodos(disco, pendentes)
    expect(mochilaDe(disco, 'p_usopp').mochila?.map((item) => item.nome)).toEqual(['Poção', 'Corda'])
  })

  it('com o mapa aberto em "Configurar só neste mapa": marca, mas não anota pendente (o espelho da pasta não toca os bonecos dele)', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    const indice = indiceDoArquivo(JSON.parse(disco.texto(INDICE)))
    disco.arquivos.set(INDICE, serializarIndice({ ...indice, mapas: indice.mapas.map((entrada) => (entrada.chave === 'going-merry' ? { ...entrada, proprio: true } : entrada)) }))
    expect(await marcarComOMerryAberto(disco)).toEqual([])
  })

  it('o rpg.json não gravou: os pendentes do mapa aberto saem (a ficha não entrou, o boneco segue com tudo); gravado mesmo assim, ficam', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    await abrirOMapa(disco, 'going-merry')
    const ids = (await marcarComOMerryAberto(disco)).map((pendente) => pendente.id)
    await retirarPendentesSemFicha(PASTA_ID, ids, disco)
    expect(await pendentesDaPasta(PASTA_ID, disco)).toEqual([])
    expect(linhasDoRelatorio(disco)).toEqual([])
    // A gravação caiu DEPOIS do disco: a ficha entrou, o espelho valeu, e os pendentes seguram o que o boneco tinha.
    const denovo = (await marcarComOMerryAberto(disco)).map((pendente) => pendente.id)
    await mudarRpgNoDisco(disco, (rpg) => rpgComOsPersonagensDoMapa(rpg, DO_MERRY))
    await retirarPendentesSemFicha(PASTA_ID, denovo, disco)
    expect((await pendentesDaPasta(PASTA_ID, disco)).map(textoDoPendente)).toEqual(AVISOS_DO_MERRY_ABERTO)
  })

  it('o mapa marcado que sai da pasta leva a marca junto', async () => {
    const disco = comOGoingMerry()
    await moverParaAPasta(disco, 'going-merry')
    await abrirOMapa(disco, 'going-merry')
    await copiarDoMerry(disco)
    await tirarDaPasta(disco, 'going-merry')
    expect(relatorio(disco)).not.toHaveProperty('fichasNovasPorConferir')
  })
})

describe('"Trazer para a ficha" interrompido no meio não soma duas vezes', () => {
  const SEM_ESPACO = 'No space left on device'

  /** A ficha gravada e, logo depois, o relatório falhando UMA vez (o disco cheio). */
  function relatorioFalhaDepoisDasFichas(disco: DiscoFalso): GravarFichasDaPasta {
    const passo = { fichasGravadas: false, falhou: false }
    const gravar = disco.gravar
    disco.gravar = async (caminho, texto) => {
      if (caminho === RELATORIO && passo.fichasGravadas && !passo.falhou) {
        passo.falhou = true
        throw new Error(SEM_ESPACO)
      }
      await gravar(caminho, texto)
    }
    return async (mudar) => {
      await mudarRpgNoDisco(disco, mudar)
      passo.fichasGravadas = true
    }
  }

  async function pocaoDoArquipelago(disco: DiscoFalso): Promise<ItemPendente> {
    const [pocao] = await moverParaAPasta(disco, 'arquipelago')
    expect(textoDoPendente(pocao)).toBe('Poção ×2 do boneco Luffy (Arquipélago dos Ventos) não estão na mochila de Luffy.')
    return pocao
  }

  it('o relatório cai depois da ficha: o aviso diz que a ficha recebeu, e o segundo "Trazer" deixa ×3, não ×5', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    const primeiro = await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco), { agora: () => AGORA })
    expect(primeiro).toMatchObject({ ok: true, decisao: 'trazido', naoAnotado: SEM_ESPACO })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
    // Sem a decisão gravada, o aviso continua.
    expect((await pendentesDaPasta(PASTA_ID, disco)).map((pendente) => pendente.id)).toContain(pocao.id)
    const segundo = await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco), { agora: () => AGORA })
    expect(segundo).toEqual({ ok: true, decisao: 'trazido', pendente: pocao, moedasDeFora: 0 })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
    expect(linhasDoRelatorio(disco).find((linha) => linha.id === pocao.id)).toMatchObject({ decisao: 'trazido' })
    expect(relatorio(disco)).not.toHaveProperty('trazendo')
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toEqual({ ok: false, porque: 'ja-decidido' })
  })

  it('o app fecha entre a falha e o segundo "Trazer": continua ×3', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco), { agora: () => AGORA })
    vi.resetModules()
    const reaberto = await import('../../net/nuvem/mochilaPendente')
    const outroDisco = discoFalso(new Map(disco.arquivos))
    expect(await reaberto.trazerPendente(PASTA_ID, pocao.id, outroDisco, gravarFichasNoDisco(outroDisco))).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(mochilaDe(outroDisco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('a gravação da ficha cai: nada somado, e o segundo "Trazer" soma uma vez (×3)', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    const quebrado: GravarFichasDaPasta = async () => {
      throw new Error(SEM_ESPACO)
    }
    await expect(trazerPendente(PASTA_ID, pocao.id, disco, quebrado)).rejects.toThrow(SEM_ESPACO)
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([POCAO_X1])
    expect(relatorio(disco)).toHaveProperty('trazendo')
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('a ficha mudou depois da falha: não soma ("incerto"), e "Ignorar" anota "incerto" sem dizer que ficou fora', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco))
    // O mestre gasta uma Poção da ficha antes do segundo clique.
    const gastou = (personagem: Personagem): Personagem => (personagem.id === 'p_luffy' ? { ...personagem, mochila: [{ ...POCAO_X1, quantidade: 2 }] } : personagem)
    await mudarRpgNoDisco(disco, (rpg) => ({ ...rpg, personagens: rpg.personagens.map(gastou) }))
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toEqual({ ok: false, porque: 'incerto', pendente: pocao })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 2 }])
    // As 2 Poções entraram e só 1 foi gasta: o "Ignorar" não pode dizer que ficaram fora da ficha.
    expect(await ignorarPendente(PASTA_ID, pocao.id, disco)).toEqual({ ok: true, decisao: 'incerto', pendente: pocao, moedasDeFora: 0 })
    expect(textoDoIgnoradoSemSaber(pocao)).toBe(
      'O aviso de Poção ×2 do boneco Luffy saiu da lista, e a ficha de Luffy ficou como estava. Um "Trazer" de antes caiu no meio, e não dá para saber se a soma entrou: confira a mochila de Luffy. A linha continua no relatório da pasta.',
    )
    expect(textoDoIgnoradoSemSaber(pocao)).not.toContain('fora da ficha')
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 2 }])
    expect(linhasDoRelatorio(disco).find((linha) => linha.id === pocao.id)).toMatchObject({ decisao: 'incerto' })
    expect(relatorio(disco)).not.toHaveProperty('trazendo')
    // Lida de novo (o app reaberto), a linha continua decidida: o aviso não volta.
    expect(await pendentesDaPasta(PASTA_ID, discoFalso(new Map(disco.arquivos)))).not.toContainEqual(expect.objectContaining({ id: pocao.id }))
  })

  it('a ficha sem a soma (a ficha não gravou) e "Ignorar": anota "ignorado", porque ficou mesmo fora', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    await expect(trazerPendente(PASTA_ID, pocao.id, disco, () => Promise.reject(new Error(SEM_ESPACO)))).rejects.toThrow(SEM_ESPACO)
    expect(await ignorarPendente(PASTA_ID, pocao.id, disco)).toMatchObject({ ok: true, decisao: 'ignorado' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([POCAO_X1])
  })

  /** Os pendentes do Luffy do Arquipélago, pelo rótulo: Poção, Corda e 45 moedas. */
  async function doArquipelago(disco: DiscoFalso): Promise<Record<string, ItemPendente>> {
    return Object.fromEntries((await moverParaAPasta(disco, 'arquipelago')).map((pendente) => [rotulo(pendente), pendente]))
  }

  it('o "Trazer" das moedas do mesmo boneco não deixa a Poção interrompida "incerta": o segundo "Trazer" só anota (×3, não ×5)', async () => {
    const disco = appDataConvertido()
    const { Poção: pocao, '45 moedas': moedas } = await doArquipelago(disco)
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco))).toMatchObject({ ok: true, naoAnotado: SEM_ESPACO })
    expect(await trazerPendente(PASTA_ID, moedas.id, disco, gravarFichasNoDisco(disco))).toEqual({ ok: true, decisao: 'trazido', pendente: moedas, moedasDeFora: 0 })
    expect(mochilaDe(disco, 'p_luffy').moedas).toBe(75)
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toEqual({ ok: true, decisao: 'trazido', pendente: pocao, moedasDeFora: 0 })
    expect(mochilaDe(disco, 'p_luffy')).toMatchObject({ mochila: [{ ...POCAO_X1, quantidade: 3 }], moedas: 75 })
    expect(relatorio(disco)).not.toHaveProperty('trazendo')
  })

  it('o mesmo, decidido pelo "Ignorar" da Poção: anota "trazido", não "ficou fora"', async () => {
    const disco = appDataConvertido()
    const { Poção: pocao, Corda: corda, '45 moedas': moedas } = await doArquipelago(disco)
    await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco))
    await trazerTodos(disco, [moedas, corda])
    expect(await ignorarPendente(PASTA_ID, pocao.id, disco)).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(mochilaDe(disco, 'p_luffy').mochila?.map((item) => [item.nome, item.quantidade])).toEqual([
      ['Poção', 3],
      ['Corda', undefined],
    ])
  })

  it('a ficha da Poção não gravou e as moedas entraram depois: o segundo "Trazer" da Poção soma uma vez (×3)', async () => {
    const disco = appDataConvertido()
    const { Poção: pocao, '45 moedas': moedas } = await doArquipelago(disco)
    await expect(trazerPendente(PASTA_ID, pocao.id, disco, () => Promise.reject(new Error(SEM_ESPACO)))).rejects.toThrow(SEM_ESPACO)
    await trazerTodos(disco, [moedas])
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(mochilaDe(disco, 'p_luffy')).toMatchObject({ mochila: [{ ...POCAO_X1, quantidade: 3 }], moedas: 75 })
  })

  it('a marca da versão anterior (uma impressão só, sem lista) ainda vale', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco))
    expect(relatorio(disco).trazendo).toBeDefined()
    // Cada lista da marca vira o texto só que a versão anterior gravava.
    const antigo: unknown = JSON.parse(disco.texto(RELATORIO), (chave: string, valor: unknown) => ((chave === 'antes' || chave === 'depois') && Array.isArray(valor) ? valor[0] : valor))
    disco.arquivos.set(RELATORIO, JSON.stringify(antigo))
    expect(disco.texto(RELATORIO)).toMatch(/"antes":"[^"]+"/)
    expect(await trazerPendente(PASTA_ID, pocao.id, disco, gravarFichasNoDisco(disco))).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })

  it('"Ignorar" depois da falha, com a soma já na ficha: anota "trazido" (é o que a ficha tem)', async () => {
    const disco = appDataConvertido()
    const pocao = await pocaoDoArquipelago(disco)
    await trazerPendente(PASTA_ID, pocao.id, disco, relatorioFalhaDepoisDasFichas(disco))
    expect(await ignorarPendente(PASTA_ID, pocao.id, disco)).toMatchObject({ ok: true, decisao: 'trazido' })
    expect(linhasDoRelatorio(disco).find((linha) => linha.id === pocao.id)).toMatchObject({ decisao: 'trazido' })
    expect(mochilaDe(disco, 'p_luffy').mochila).toEqual([{ ...POCAO_X1, quantidade: 3 }])
  })
})

describe('a conferência de novo: a mesma vaga ainda sem decisão é o mesmo pendente', () => {
  const USOPP = ficha('p_usopp', 'Usopp')
  const VAGA: CarriedItem = { id: 'vaga_pocao_usopp', nome: 'Poção', itemId: 'acervo_pocao', empilhavel: true }
  const SEM_FIXOS: ReadonlySet<string> = new Set()
  const ids = (): (() => string) => {
    let n = 0
    return () => `novo_${++n}`
  }
  function cenaCom(cena: string, boneco: CenaDaJuncao['bonecos'][number]): CenaDaJuncao {
    return { origem: { mapa: 'Going Merry', cena, gravadaEm: 1 }, bonecos: [boneco] }
  }
  function doUsopp(quantidade: number): CenaDaJuncao['bonecos'][number] {
    return { characterId: 'p_usopp', name: 'Usopp', mochila: [{ ...VAGA, quantidade }] }
  }
  /** A Poção que o "Usar o da pasta" anotou do trabalho aberto. */
  function anotada(quantidade: number): ItemPendente {
    return { id: 'pend_1', chave: 'going-merry', mapa: 'Going Merry', cena: '', personagemId: 'p_usopp', personagem: 'Usopp', boneco: 'Usopp', entrouEm: 7, tipo: 'item', item: { ...VAGA, quantidade } }
  }

  it('a pilha do disco troca a do pendente ainda sem decisão: o mesmo id, a mesma hora, nenhum pendente novo', () => {
    const conferido = pendentesDaReconferencia([USOPP], 'going-merry', [cenaCom('Convés', doUsopp(2))], [anotada(1)], AGORA, ids(), SEM_FIXOS)
    expect(conferido.novos).toEqual([])
    expect(conferido.trocados.map((pendente) => [pendente.id, pendente.entrouEm, pendente.tipo === 'item' ? quantidadeDe(pendente.item) : 0])).toEqual([['pend_1', 7, 2]])
  })

  it('a bolsa também: 30 moedas anotadas, 45 no disco, um pendente só', () => {
    const moedas: ItemPendente = { ...anotada(1), tipo: 'moedas', moedas: 30 }
    const conferido = pendentesDaReconferencia([USOPP], 'going-merry', [cenaCom('Convés', { characterId: 'p_usopp', name: 'Usopp', moedas: 45 })], [moedas], AGORA, ids(), SEM_FIXOS)
    expect(conferido.novos).toEqual([])
    expect(conferido.trocados).toMatchObject([{ id: 'pend_1', tipo: 'moedas', moedas: 45 }])
  })

  it('o pendente já decidido não muda: a outra pilha vira pendente novo, como antes', () => {
    const trazida: ItemPendente = { ...anotada(1), decisao: 'trazido', decididoEm: 8 }
    const conferido = pendentesDaReconferencia([USOPP], 'going-merry', [cenaCom('Convés', doUsopp(2))], [trazida], AGORA, ids(), SEM_FIXOS)
    expect(conferido.trocados).toEqual([])
    expect(conferido.novos).toMatchObject([{ id: 'novo_1', tipo: 'item', item: { id: VAGA.id, quantidade: 2 } }])
  })

  it('o "Trazer" começado segura a pilha dele, e a leitura da mesma vaga não vira outro pendente', () => {
    const conferido = pendentesDaReconferencia([USOPP], 'going-merry', [cenaCom('Convés', doUsopp(2))], [anotada(1)], AGORA, ids(), new Set(['pend_1']))
    expect(conferido).toEqual({ novos: [], trocados: [] })
  })

  it('cada pendente fica com uma leitura: a mesma pilha numa cena confirma, a outra pilha noutra cena é pendente novo, como numa conferência nova', () => {
    const cenas = [cenaCom('Convés', doUsopp(1)), cenaCom('Porão', doUsopp(2))]
    const conferido = pendentesDaReconferencia([USOPP], 'going-merry', cenas, [anotada(1)], AGORA, ids(), SEM_FIXOS)
    expect(conferido.trocados).toEqual([])
    expect(conferido.novos).toMatchObject([{ id: 'novo_1', cena: 'Porão', item: { quantidade: 2 } }])
  })

  it('as fichas do próprio mapa entram no lugar dos bonecos delas, numa cena à parte; o NPC e o boneco de outra ficha ficam', () => {
    const fichaDoMapa = ficha('p_usopp', 'Usopp', { mochila: [{ ...VAGA, quantidade: 2 }], moedas: 12 })
    const cena: CenaDaJuncao = {
      origem: { mapa: 'Going Merry', cena: 'Porão', gravadaEm: 1 },
      bonecos: [doUsopp(3), { characterId: 'p_luffy', name: 'Luffy' }, { characterId: null, name: 'Vendedor', mochila: [CORDA] }],
    }
    const origem = { mapa: 'Going Merry', cena: 'ficha própria do mapa', gravadaEm: 5 }
    const cenas = cenasComAsFichasDoMapa([cena], [fichaDoMapa], origem)
    expect(cenas).toEqual([
      { origem, bonecos: [{ characterId: 'p_usopp', name: 'Usopp', mochila: [{ ...VAGA, quantidade: 2 }], moedas: 12 }] },
      { ...cena, bonecos: [{ characterId: 'p_luffy', name: 'Luffy' }, { characterId: null, name: 'Vendedor', mochila: [CORDA] }] },
    ])
    expect(cenasComAsFichasDoMapa([cena], [], origem)).toEqual([cena])
  })
})
