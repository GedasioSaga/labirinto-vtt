// @vitest-environment node
/**
 * ITENS REFEITOS, E7 (docs/design/itens-rework/PLANO.md): os três testes do núcleo que o dono pediu,
 * precisos e rápidos. Fichas inventadas, no formato do disco (`personagemDoArquivo`).
 *
 * 1. A ficha de antes (cartões das abas Armas e Itens, "Tipos de bala", vaga só com o nome) vai para a
 *    mochila sem perder nada e sem contar a bala duas vezes (R1: Prata 12, nunca 24); converter de
 *    novo, também depois de gravar e reler, não muda nada.
 * 2. O tiro gasta do pente, não da mochila; o pente zerado recarrega sozinho da mochila (46 -> 40).
 * 3. A ficha de NPC posta em vários tokens: cada token ganha a cópia dele, e o dano numa cópia não
 *    muda as outras nem o modelo.
 */
import { describe, expect, it } from 'vitest'
import type { ItemDoCatalogo } from '../lib/acervoDeItens'
import { itemDoCatalogoLido } from '../lib/acervoDeItens'
import { combateVazio, type PedidoDeAcao } from '../lib/batalha/combate'
import { armasDe } from '../lib/batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { converterItensDoAcervo } from '../lib/itens/conversao/acervo'
import { converterFichas } from '../lib/itens/conversao/ficha'
import { quantidadeDe } from '../lib/items'
import { planejarFichasProprias } from '../lib/ligarFicha'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { CarriedItem, Token } from '../types/map'
import { gastarDoPenteNaMesa, recargaDepoisDoTiro } from './batalha/recargaDoPente'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_teste'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const PRATA = 'item_bala-de-prata'

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** A mesa mínima: as fichas numa lista, o ajuste troca a da vez. */
function mesaDe(inicio: readonly Personagem[]): MesaDaBatalha {
  let personagens = inicio
  return {
    personagens: () => personagens,
    sistema: () => SISTEMA_ONE_PIECE,
    equipes: () => [],
    ajustarPersonagem: (personagemId, ajustar) => {
      const atual = personagens.find((personagem) => personagem.id === personagemId)
      if (atual === undefined) return false
      const novo = ajustar(atual)
      if (novo !== atual) personagens = personagens.map((personagem) => (personagem.id === personagemId ? novo : personagem))
      return true
    },
    trocarEquipe: () => false,
  }
}

type TokenDoTeste = Pick<Token, 'id' | 'characterId' | 'name' | 'hidden'>

function batalhaCom(mesa: MesaDaBatalha, tokens: readonly TokenDoTeste[]): LojaDaBatalha {
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return loja
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function fichaNaMesa(mesa: MesaDaBatalha, personagemId: string): Personagem {
  const achada = mesa.personagens().find((personagem) => personagem.id === personagemId)
  if (achada === undefined) throw new Error(`sem ${personagemId} na mesa`)
  return achada
}

/** Quantas de cada item a ficha tem: as vagas mais as balas dos pentes (a conservação da conversão). */
function totaisPorItem(mochila: readonly CarriedItem[] | undefined): Map<string, number> {
  const totais = new Map<string, number>()
  const somar = (itemId: string, n: number) => totais.set(itemId, (totais.get(itemId) ?? 0) + n)
  for (const vaga of mochila ?? []) {
    if (vaga.itemId !== undefined) somar(vaga.itemId, quantidadeDe(vaga))
    if (vaga.pente !== undefined) somar(vaga.pente.balaId, vaga.pente.n)
  }
  return totais
}

describe('1. conversão da ficha de antes', () => {
  it('cartões e "Tipos de bala" vão para a mochila sem perder nada nem contar a bala duas vezes; converter de novo (também relida do disco) não muda nada', () => {
    const lido = itemDoCatalogoLido({ id: PRATA, nome: 'Bala de Prata', imagem: null, descricao: '', categoria: 'Munição', preco: 10, empilhavel: true, tiro: { dano: '+Percepção / 2', efeito: '' } })
    if (lido === null) throw new Error('item de teste inválido')
    const acervo = converterItensDoAcervo([lido])
    const antes = ficha({
      id: 'pers_vincent',
      tipo: 'jogador',
      nome: 'Vincent G.',
      recursos: { hp: 600, sp: 60 },
      maximos: { hp: 600, sp: 60 },
      atributos: { percepcao: 35 },
      abas: {
        armas: [
          {
            id: 'cart_rosa',
            nome: 'Rosa Fúnebre',
            campos: { dano: '20', acao: 'Ação Simples', categoria: 'De fogo', capacidade: '6' },
            subcartoes: [{ id: 'cart_prata', nome: 'Bala de Prata', campos: { dano: '+Percepção / 2', quantidade: '12' } }],
          },
        ],
        itens: [{ id: 'cart_luneta', nome: 'Luneta Velha', campos: { descricao: 'Vê longe', quantidade: '1' } }],
      },
      mochila: [
        // A vaga da bala já ligada: ela é a verdade (o cartão nunca descontou), e as 12 do cartão não somam.
        { id: 'vaga_prata', nome: 'Bala de Prata', itemId: PRATA, quantidade: 12, empilhavel: true, categoria: 'Munição' },
        // O pino "!" de antes, só com o nome.
        { id: 'vaga_tocha', nome: 'Tocha', quantidade: 2, empilhavel: true },
      ],
    })

    const um = converterFichas(acervo, [antes])
    const depois = um.personagens[0]
    const mochila = depois.mochila ?? []

    // R1: Prata 12, nunca 24; e o pente da arma nasce vazio.
    expect(totaisPorItem(mochila).get(PRATA)).toBe(12)
    const rosa = mochila.find((vaga) => vaga.nome === 'Rosa Fúnebre')
    expect(rosa).toMatchObject({ tipo: 'fogo', equipado: true })
    expect(rosa?.pente).toBeUndefined()
    expect(mochila.some((vaga) => vaga.nome === 'Luneta Velha' && vaga.itemId !== undefined)).toBe(true)
    // Nada se perde: toda vaga de antes continua, com a mesma quantidade, e a Tocha ganhou o item dela.
    for (const vaga of antes.mochila ?? []) expect(quantidadeDe(mochila.find((nova) => nova.id === vaga.id) ?? { id: '', nome: '', quantidade: 0 })).toBe(quantidadeDe(vaga))
    expect(mochila.find((vaga) => vaga.id === 'vaga_tocha')?.itemId).toMatch(/^item_conv_/)
    // Os cartões continuam no arquivo (marcados), para o conversor os ler de novo sem somar.
    expect(depois.abas.armas?.map((cartao) => cartao.naMochila)).toEqual([true])
    expect(depois.abas.armas?.[0]?.subcartoes.map((bala) => bala.naMochila)).toEqual([true])

    // Idempotente: com o Acervo já gravado (o que a conversão criou), converter de novo devolve a MESMA lista.
    const porId = new Map<string, ItemDoCatalogo>([...acervo, ...um.novos].map((item) => [item.id, item]))
    const acervoGravado = [...porId.values()]
    const dois = converterFichas(acervoGravado, um.personagens)
    expect(dois.personagens).toBe(um.personagens)
    expect(dois.novos).toEqual([])
    // E pelo disco: a ficha gravada e relida volta igual e converte igual.
    const relida = ficha(JSON.parse(JSON.stringify(depois)))
    expect(converterFichas(acervoGravado, [relida]).personagens[0]).toEqual(depois)
  })
})

describe('2. o pente na batalha', () => {
  it('cada tiro tira 1 do pente e nada da mochila; o pente zerado recarrega sozinho da mochila (46 -> 40) e gasta a ação da recarga', () => {
    const vincent = ficha({
      id: 'pers_vincent',
      tipo: 'jogador',
      nome: 'Vincent G.',
      recursos: { hp: 600, sp: 60 },
      maximos: { hp: 600, sp: 60 },
      atributos: { percepcao: 35, agilidade: 35 },
      mochila: [
        {
          id: 'vaga_rosa',
          nome: 'Rosa Fúnebre',
          itemId: 'item_rosa',
          tipo: 'fogo',
          equipado: true,
          pente: { balaId: PRATA, n: 6 },
          regra: { ataque: { dano: 20, soma: 'percepcao', acao: 'Ação Simples', alvos: 1 }, pente: { capacidade: 6, aceita: [PRATA], recarga: { acao: 'Ação Simples', rodadas: 0 } } },
        },
        { id: 'vaga_prata', nome: 'Bala de Prata', itemId: PRATA, tipo: 'municao', quantidade: 46, empilhavel: true },
      ],
    })
    const zumbi = ficha({ id: 'pers_zumbi', tipo: 'npc', nome: 'Zumbi', recursos: { hp: 100 }, maximos: { hp: 100 }, atributos: { agilidade: 5 } })
    const mesa = mesaDe([vincent, zumbi])
    const loja = batalhaCom(mesa, [
      { id: 'tok_vincent', characterId: vincent.id, name: 'Vincent G.', hidden: false },
      { id: 'tok_zumbi', characterId: zumbi.id, name: 'Zumbi', hidden: false },
    ])
    const turnos = cena(loja).turnos
    const carta = turnos.cartas.find((candidata) => candidata.personagemId === vincent.id)
    if (carta === undefined) throw new Error('sem a carta do Vincent')
    const arma = armasDe(vincent)[0]
    expect(arma?.pente).toMatchObject({ n: 6, capacidade: 6, naMochila: 46 })
    if (arma === undefined) throw new Error('a Rosa não está no Atacar')

    for (let tiro = 1; tiro <= 6; tiro += 1) expect(gastarDoPenteNaMesa(mesa, CENA, carta.tokenId, vincent.id, arma.id)).toMatchObject({ tipo: 'pente', balaId: PRATA, n: 1 })
    expect(armasDe(fichaNaMesa(mesa, vincent.id))[0]?.pente).toMatchObject({ n: 0, naMochila: 46 })
    // Pente vazio: o 7º tiro não sai do pente.
    expect(gastarDoPenteNaMesa(mesa, CENA, carta.tokenId, vincent.id, arma.id)).toBeNull()

    const naVez = { ...turnos, vez: carta.id }
    const recarga = recargaDepoisDoTiro(mesa, CENA, { carta, chaveDoGasto: carta.id, regras: null }, naVez, arma.id)
    if (recarga === 'recusada') throw new Error('a mesa recusou a recarga')
    expect(recarga.texto).toContain('recarregou')
    expect(armasDe(fichaNaMesa(mesa, vincent.id))[0]?.pente).toMatchObject({ n: 6, naMochila: 40 })
    expect(recarga.turnos.gastos[carta.id]?.simples).toBe(1)
    // E o pente cheio volta a atirar.
    expect(gastarDoPenteNaMesa(mesa, CENA, carta.tokenId, vincent.id, arma.id)).not.toBeNull()
  })
})

describe('3. cópias de NPC', () => {
  it('três tokens da mesma ficha de NPC ganham cópias próprias, e o dano numa cópia não muda as outras nem o modelo', () => {
    const atirador = ficha({
      id: 'pers_atirador',
      tipo: 'jogador',
      nome: 'Atirador',
      recursos: { hp: 300, sp: 60 },
      maximos: { hp: 300, sp: 100 },
      atributos: { forca: 30, agilidade: 70 },
      abas: { habilidades: [{ id: 'tec_desenhar', nome: 'Desenhar o alvo', campos: { acao: 'Simples', custo: '10 SP', dano: '40' } }] },
    })
    const modelo = ficha({ id: 'pers_zumbi', tipo: 'npc', nome: 'Zumbi', recursos: { hp: 100 }, maximos: { hp: 100 }, atributos: { agilidade: 5 }, mochila: [{ id: 'vaga_dente', nome: 'Dente', quantidade: 3, empilhavel: true }] })
    // A aventura de antes: os três zumbis apontam para a MESMA ficha.
    const antes: TokenDoTeste[] = [
      { id: 'tok_atirador', characterId: atirador.id, name: 'Atirador', hidden: false },
      { id: 'tok_z1', characterId: modelo.id, name: 'Zumbi', hidden: false },
      { id: 'tok_z2', characterId: modelo.id, name: 'Zumbi', hidden: false },
      { id: 'tok_z3', characterId: modelo.id, name: 'Zumbi', hidden: false },
    ]
    const plano = planejarFichasProprias(antes, [atirador, modelo], { herdarEstado: true })
    const tokens = antes.map((token) => {
      const mudanca = plano.mudancas.find((candidata) => candidata.tokenId === token.id)
      return mudanca === undefined ? token : { ...token, characterId: mudanca.characterId, name: mudanca.name ?? token.name }
    })
    const idDe = (tokenId: string): string => tokens.find((token) => token.id === tokenId)?.characterId ?? ''
    expect(new Set([idDe('tok_z1'), idDe('tok_z2'), idDe('tok_z3')]).size).toBe(3)
    // Cada cópia tem a própria mochila (vagas novas), não a do modelo.
    for (const copia of plano.copias) expect(copia.mochila?.map((vaga) => vaga.id)).not.toEqual(modelo.mochila?.map((vaga) => vaga.id))

    const mesa = mesaDe([atirador, modelo, ...plano.copias])
    const loja = batalhaCom(mesa, tokens)
    // O Zumbi 2 já gastou a reação: o golpe nele resolve na hora (o dano vai direto à ficha).
    const inicio = cena(loja)
    const alvoId = idDe('tok_z2')
    loja.setState({ cenas: { ...loja.getState().cenas, [CENA]: { ...inicio, turnos: { ...inicio.turnos, combate: { ...(inicio.turnos.combate ?? {}), [alvoId]: { ...combateVazio(), semReacao: true } } } } } })
    const { turnos } = cena(loja)
    expect(turnos.cartas.find((carta) => carta.id === turnos.vez)?.personagemId).toBe(atirador.id)
    if (turnos.vez === null) throw new Error('sem vez')
    const desenhar: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_desenhar', armaId: null, alvos: [{ tokenId: 'tok_z2', dano: 40 }], surpresa: false, perfurante: false, custo: null, acao: null }
    expect(loja.getState().agir(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada }, desenhar)).toBe(true)

    const hp = (personagemId: string) => fichaNaMesa(mesa, personagemId).recursos.hp
    expect(hp(alvoId)).toBeLessThan(100)
    expect([hp(idDe('tok_z1')), hp(idDe('tok_z3')), hp(modelo.id)]).toEqual([100, 100, 100])
  })
})
