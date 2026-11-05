import { describe, expect, it } from 'vitest'
import { fichaDBTVazia, lerFichaDBT, type FichaDBT } from '../dbt/modelo'
import type { CartaoDaFicha, Personagem, RegistroDaFicha } from '../personagem'
import { aplicar } from './aplicar'
import { quemEscreveAMudanca } from './caminho'
import { lerJsonSeguro, paraJson } from './json'
import { diferencas } from './diferencas'

/**
 * DIFERENÇAS (plano do Lobby §5.1, aceite da N1): a ida e volta
 * `aplicar(antes, diferencas(antes, depois)) == depois` em fichas inventadas
 * One Piece e Dragon Ball, com cartões, subcartões, mochila e reordenação; o
 * histórico não vira op; campo do mestre nunca vira op de jogador.
 */

const RETRATO = `midia:${'a'.repeat(64)}.webp`
const RETRATO_NOVO = `midia:${'d'.repeat(64)}.png`
const IMAGEM_DO_CARTAO = `midia:${'b'.repeat(64)}.png`
const IMAGEM_DA_CARNE = `midia:${'c'.repeat(64)}.webp`

function cartao(id: string, nome: string, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], ...extra }
}

function luffyAntes(): Personagem {
  return {
    id: 'pers_luffy',
    tipo: 'jogador',
    nome: 'Monkey D. Luffy',
    descricao: 'Capitão dos Piratas do Chapéu de Palha.',
    retrato: RETRATO,
    escolhas: { raca: 'humano', oficio: 'capitao' },
    etiquetas: ['Capitão', 'Usuário de Akuma no Mi'],
    recursos: { hp: 600, sp: 40 },
    maximos: { hp: 600 },
    modificadoresDosRecursos: { hp: 100 },
    atributos: { forca: 60, agilidade: 45, vigor: 50 },
    modificadoresDosAtributos: { forca: 5 },
    cartoesAtivos: [],
    historico: [{ quem: 'Mestre', parte: 'recurso', chave: 'hp', rotulo: 'HP', de: 700, para: 600, quando: 1_700_000_000_000 }],
    abas: {
      tecnicas: [
        cartao('cart_pistol', 'Gomu Gomu no Pistol', { campos: { dano: '2d6', alcance: '6 m' }, atributos: ['forca'], imagem: IMAGEM_DO_CARTAO }),
        cartao('cart_gatling', 'Gomu Gomu no Gatling', { campos: { dano: '4d6' }, extras: [{ nome: 'Custo', valor: '5 SP' }] }),
        cartao('cart_bazooka', 'Gomu Gomu no Bazooka', { campos: { dano: '3d8' }, aMao: true }),
      ],
      transformacoes: [
        cartao('cart_gear2', 'Gear Second', {
          modificadores: [{ atributo: 'agilidade', delta: 10 }],
          subcartoes: [cartao('cart_jet', 'Jet Pistol', { campos: { dano: '3d6' } }), cartao('cart_jetgat', 'Jet Gatling', { campos: { dano: '5d6' } })],
        }),
      ],
      habilidades: [],
    },
    mochila: [
      { id: 'vaga_carne', nome: 'Carne', itemId: 'item_carne', empilhavel: true, quantidade: 3, imagem: IMAGEM_DA_CARNE, categoria: 'Consumível' },
      { id: 'vaga_chapeu', nome: 'Chapéu de palha', descricao: 'Presente do Shanks.' },
      { id: 'vaga_mapa', nome: 'Mapa da Grand Line' },
    ],
    moedas: 1500,
    dono: 'conta_luffy',
    notaDoMestre: 'Vai virar Rei dos Piratas.',
  }
}

/** Uma sessão inteira de mudanças nos dois lados: textos, números, conjuntos, cartões, subcartões, ordem, mochila, moedas, mestre. */
function luffyDepois(): Personagem {
  const antes = luffyAntes()
  const [pistol, , bazooka] = antes.abas.tecnicas
  const { aMao: _semAMao, ...bazookaAoVivo } = bazooka
  const [gear2] = antes.abas.transformacoes
  const [jet] = gear2.subcartoes
  const [carne, chapeu] = antes.mochila ?? []
  return {
    ...antes,
    descricao: 'Capitão dos Chapéus de Palha. Quer ser o Rei dos Piratas.',
    retrato: RETRATO_NOVO,
    escolhas: { raca: 'humano', oficio: 'capitao', origem: 'east-blue' },
    etiquetas: ['Usuário de Akuma no Mi', 'Pirata'],
    recursos: { hp: 420, sp: 40 },
    maximos: { hp: 600, sp: 40 },
    modificadoresDosAtributos: {},
    cartoesAtivos: ['cart_gear2'],
    historico: [...antes.historico, { quem: 'Mestre', parte: 'recurso', chave: 'hp', rotulo: 'HP', de: 600, para: 420, quando: 1_700_000_100_000 }],
    abas: {
      tecnicas: [bazookaAoVivo, { ...pistol, nome: 'Gomu Gomu no Pistol!', campos: { dano: '2d8', alcance: '6 m' } }],
      transformacoes: [
        {
          ...gear2,
          modificadores: [{ atributo: 'agilidade', delta: 15 }],
          subcartoes: [{ ...jet, campos: { dano: '4d6' } }, cartao('cart_jetbaz', 'Jet Bazooka', { campos: { dano: '6d6' }, extras: [{ nome: 'Custo', valor: '8 SP' }] })],
        },
      ],
      habilidades: [cartao('cart_borracha', 'Corpo de borracha', { campos: { efeito: 'Imune a choque' } })],
    },
    mochila: [
      { ...carne, quantidade: 5 },
      { ...chapeu, descricao: 'Presente do Shanks. Nunca perde.' },
      { id: 'vaga_bolinho', nome: 'Bolinho de arroz', itemId: 'item_bolinho', empilhavel: true, quantidade: 2 },
    ],
    moedas: 1200,
    notaDoMestre: 'Vai virar Rei dos Piratas. Cuidado com o Gear 5.',
  }
}

/** A ficha Dragon Ball passa pelo leitor dela, como toda ficha que o app abre. */
function dbtLido(valor: Partial<FichaDBT>): FichaDBT {
  const lida = lerFichaDBT({ ...fichaDBTVazia(), ...valor })
  if (lida === null) throw new Error('ficha Dragon Ball de teste inválida')
  return lida
}

function gokuAntes(): Personagem {
  return {
    id: 'pers_goku',
    tipo: 'jogador',
    nome: 'Son Goku',
    descricao: 'Saiyajin criado na Terra.',
    retrato: null,
    escolhas: {},
    etiquetas: ['Saiyajin'],
    recursos: { pv: 120, ki: 80 },
    maximos: { pv: 120, ki: 80 },
    modificadoresDosRecursos: {},
    atributos: { forca: 8, destreza: 8, constituicao: 8 },
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: {},
    dbt: dbtLido({
      pdl: 12000,
      historia: 'Criado pelo Vovô Gohan no Monte Paozu.',
      talentos: [{ id: 'tal_vovo', livroId: null, nome: 'Treino do Vovô', efeito: '+1 em Força', custoKi: null }],
      transformacoes: [{ id: 'tra_oozaru', livroId: null, nome: 'Oozaru', estagio: 1, ep: 2, custoKi: 0, kiPorRodada: 0, efeitos: 'Gigante', origem: 'Lua cheia' }],
      inventario: [{ id: 'item_bastao', livroId: null, nome: 'Bastão Mágico', quantidade: 1, carga: 1, equipado: true, descricao: 'Estica.', bonusCA: 0, kiPorTurno: 0 }],
      contadores: [{ id: 'cont_feijao', nome: 'Feijões', atual: 2, maximo: 3 }],
    }),
    mochila: [{ id: 'vaga_nuvem', nome: 'Nuvem Voadora' }],
    dono: 'conta_goku',
  }
}

function gokuDepois(): Personagem {
  const antes = gokuAntes()
  const dbt = antes.dbt ?? fichaDBTVazia()
  return {
    ...antes,
    recursos: { pv: 90, ki: 40 },
    dbt: dbtLido({
      ...dbt,
      pdl: 15000,
      historia: 'Criado pelo Vovô Gohan no Monte Paozu. Treinou com o Mestre Kame.',
      transformacaoAtiva: 'tra_oozaru',
      talentos: [...dbt.talentos, { id: 'tal_kame', livroId: null, nome: 'Kamehameha aprendido', efeito: 'Técnica de Ki', custoKi: 4 }],
      inventario: [{ ...dbt.inventario[0], equipado: false }, { id: 'item_feijao', livroId: null, nome: 'Feijão dos Deuses', quantidade: 2, carga: 0, equipado: false, descricao: 'Cura tudo.', bonusCA: 0, kiPorTurno: 0 }],
      contadores: [{ ...dbt.contadores[0], atual: 1 }],
      kiBloqueado: 2,
    }),
    mochila: [{ id: 'vaga_nuvem', nome: 'Nuvem Voadora', descricao: 'Só quem tem coração puro sobe.' }],
  }
}

/** O histórico não viaja (§4.1): a volta compara com o de antes. */
function comHistoricoDe(ficha: Personagem, base: Personagem): Personagem {
  return { ...ficha, historico: base.historico }
}

describe('ida e volta', () => {
  it('One Piece: aplicar(antes, diferencas(antes, depois)) dá depois', () => {
    const antes = luffyAntes()
    const depois = luffyDepois()
    const mudancas = diferencas(antes, depois)
    // A ficha inventada passa pelas cinco ações e pelos subcartões; sem isso a ida e volta não provaria nada.
    expect(new Set(mudancas.map((mudanca) => mudanca.acao))).toEqual(new Set(['definir', 'somar', 'criar', 'apagar', 'ordenar']))
    expect(mudancas.filter((mudanca) => mudanca.caminho.includes('subcartoes')).map((mudanca) => mudanca.acao)).toEqual(['apagar', 'definir', 'criar'])
    const { doc, recusadas } = aplicar(antes, mudancas)
    expect(recusadas).toEqual([])
    expect(doc).toEqual(comHistoricoDe(depois, antes))
    expect(antes).toEqual(luffyAntes())
  })

  it('One Piece: cada mudança é pequena, por campo (Vida 600 → 420 é uma op só)', () => {
    const antes = luffyAntes()
    const mudancas = diferencas(antes, { ...antes, recursos: { ...antes.recursos, hp: 420 } })
    expect(mudancas).toEqual([{ fichaId: 'pers_luffy', caminho: ['recursos', 'hp'], acao: 'definir', valor: 420 }])
    const maisUma = diferencas(antes, { ...antes, mochila: [{ ...(antes.mochila ?? [])[0], quantidade: 4 }, ...(antes.mochila ?? []).slice(1)] })
    expect(maisUma).toEqual([{ fichaId: 'pers_luffy', caminho: ['mochila', 'vaga_carne', 'quantidade'], acao: 'somar', delta: 1 }])
  })

  it('One Piece: as mudanças sobrevivem ao fio (JSON) sem perder nada', () => {
    const mudancas = diferencas(luffyAntes(), luffyDepois())
    expect(lerJsonSeguro(JSON.stringify(mudancas))).toEqual(mudancas)
  })

  it('Dragon Ball: aplicar(antes, diferencas(antes, depois)) dá depois', () => {
    const antes = gokuAntes()
    const depois = gokuDepois()
    expect(depois.dbt?.pdl).toBe(15000)
    expect(depois.dbt?.transformacaoAtiva).toBe('tra_oozaru')
    const mudancas = diferencas(antes, depois)
    expect(mudancas.filter((mudanca) => mudanca.caminho[0] === 'dbt').map((mudanca) => mudanca.caminho[1])).toEqual([
      'pdl',
      'talentos',
      'transformacaoAtiva',
      'inventario',
      'contadores',
      'historia',
      'kiBloqueado',
    ])
    const { doc, recusadas } = aplicar(antes, mudancas)
    expect(recusadas).toEqual([])
    expect(doc).toEqual(comHistoricoDe(depois, antes))
  })

  it('Dragon Ball: raça, variante e raça livre vão juntas (mesma regra do app)', () => {
    const antes = gokuAntes()
    const dbt = antes.dbt ?? fichaDBTVazia()
    const caminhos = diferencas(antes, { ...antes, dbt: { ...dbt, variante: 'outra' } }).map((mudanca) => mudanca.caminho)
    expect(caminhos).toEqual([
      ['dbt', 'raca'],
      ['dbt', 'variante'],
      ['dbt', 'racaLivre'],
    ])
  })

  it('ficha mínima, sem nenhum campo opcional: ganha mochila, moedas, dono e cartão, e perde tudo de novo', () => {
    const minima: Personagem = {
      id: 'pers_coby',
      tipo: 'jogador',
      nome: 'Coby',
      descricao: '',
      retrato: null,
      escolhas: {},
      etiquetas: [],
      recursos: {},
      maximos: {},
      modificadoresDosRecursos: {},
      atributos: {},
      modificadoresDosAtributos: {},
      cartoesAtivos: [],
      historico: [],
      abas: {},
    }
    const cheia: Personagem = {
      ...minima,
      etiquetas: ['Marinha'],
      abas: { tecnicas: [cartao('cart_soru', 'Soru', { subcartoes: [cartao('cart_geppo', 'Geppo')] })] },
      mochila: [{ id: 'vaga_espada', nome: 'Espada de treino' }],
      moedas: 3,
      dono: 'conta_coby',
    }
    expect(aplicar(minima, diferencas(minima, cheia))).toEqual({ doc: cheia, recusadas: [] })
    const volta = aplicar(cheia, diferencas(cheia, minima))
    expect(volta.recusadas).toEqual([])
    // A aba fica vazia em vez de sumir: aba vazia = aba ausente (`cartoesDaAba`).
    expect(volta.doc).toEqual({ ...minima, abas: { tecnicas: [] } })
    expect(Object.keys(volta.doc ?? {})).not.toEqual(expect.arrayContaining(['mochila']))
    expect(Object.keys(volta.doc ?? {}).filter((chave) => ['mochila', 'moedas', 'dono'].includes(chave))).toEqual([])
  })

  it('troca de tipo vai como a ficha inteira (só o mestre), e volta igual', () => {
    const antes = luffyAntes()
    const depois: Personagem = { ...antes, tipo: 'npc' }
    const mudancas = diferencas(antes, depois)
    expect(mudancas.map((mudanca) => [mudanca.acao, mudanca.caminho])).toEqual([
      ['apagar', []],
      ['criar', []],
    ])
    expect(aplicar(antes, mudancas)).toEqual({ doc: depois, recusadas: [] })
    expect(aplicar(null, diferencas(null, antes))).toEqual({ doc: antes, recusadas: [] })
  })

  it('a ficha inteira vai tudo ou nada: se o criar não entra, a ficha não some', () => {
    const antes = luffyAntes()
    const grande: Personagem = { ...antes, tipo: 'npc', descricao: 'x'.repeat(300 * 1024) }
    const mudancas = diferencas(antes, grande)
    expect(mudancas.map((mudanca) => [mudanca.acao, mudanca.caminho, mudanca.atomico])).toEqual([
      ['apagar', [], true],
      ['criar', [], true],
    ])
    const { doc, recusadas } = aplicar(antes, mudancas)
    expect(doc).toBe(antes)
    expect(recusadas.map((recusada) => recusada.motivo)).toEqual(['doc-grande', 'doc-grande'])
  })

  it('Dragon Ball: a ficha que ganha o bloco vai inteira, tudo ou nada, e volta igual', () => {
    const goku = gokuAntes()
    const { dbt: _dbt, ...semBloco } = goku
    const mudancas = diferencas(semBloco, goku)
    expect(mudancas.map((mudanca) => [mudanca.acao, mudanca.atomico])).toEqual([
      ['apagar', true],
      ['criar', true],
    ])
    expect(aplicar(semBloco, mudancas)).toEqual({ doc: goku, recusadas: [] })
  })
})

describe('imagem é só do mestre na v1 (12.4)', () => {
  it('jogador: cartão novo entra sem imagem, nele e nos subcartões, como a troca de imagem de cartão que já existe não sai', () => {
    const antes = luffyAntes()
    const novo = cartao('cart_redhawk', 'Red Hawk', { imagem: IMAGEM_DO_CARTAO, subcartoes: [cartao('cart_redroc', 'Red Roc', { imagem: IMAGEM_DA_CARNE })] })
    const [pistol, ...outras] = antes.abas.tecnicas
    const depois: Personagem = { ...antes, abas: { ...antes.abas, tecnicas: [{ ...pistol, imagem: RETRATO_NOVO }, ...outras], habilidades: [novo] } }
    const semImagem: CartaoDaFicha = { ...novo, imagem: null, subcartoes: [{ ...novo.subcartoes[0], imagem: null }] }
    const doJogador = diferencas(antes, depois, { papel: 'jogador' })
    expect(doJogador).toEqual([{ fichaId: 'pers_luffy', caminho: ['abas', 'habilidades', 'cart_redhawk'], acao: 'criar', valor: paraJson(semImagem) }])
    expect(doJogador.map((mudanca) => quemEscreveAMudanca(mudanca))).toEqual(['donoOuMestre'])
    expect(aplicar(antes, doJogador)).toEqual({ doc: { ...antes, abas: { ...antes.abas, habilidades: [semImagem] } }, recusadas: [] })
    // O mestre troca a imagem do cartão que existe e cria o novo com as imagens.
    const doMestre = diferencas(antes, depois)
    expect(doMestre.map((mudanca) => quemEscreveAMudanca(mudanca))).toEqual(['mestre', 'mestre'])
    expect(aplicar(antes, doMestre)).toEqual({ doc: depois, recusadas: [] })
  })
})

describe('o que nunca vira op', () => {
  it('o histórico não gera op', () => {
    const antes = luffyAntes()
    const linha: RegistroDaFicha = { quem: 'Nami', parte: 'recurso', chave: 'hp', rotulo: 'HP', de: 600, para: 590, quando: 1 }
    expect(diferencas(antes, { ...antes, historico: [...antes.historico, linha] })).toEqual([])
  })

  it('dono e notaDoMestre (e os outros campos do mestre) nunca geram op de jogador', () => {
    const antes = luffyAntes()
    const depois: Personagem = {
      ...antes,
      nome: 'Luffy',
      dono: 'conta_zoro',
      notaDoMestre: 'trocada pelo jogador',
      combate: { forca: 2 },
      soCenario: true,
      nomeDoJogador: 'Zoro',
      retrato: null,
    }
    expect(diferencas(antes, depois, { papel: 'jogador' }).map((mudanca) => mudanca.caminho)).toEqual([['nome']])
    expect(diferencas(antes, depois).map((mudanca) => mudanca.caminho[0])).toEqual(['nome', 'retrato', 'dono', 'combate', 'soCenario', 'nomeDoJogador', 'notaDoMestre'])
  })

  it('a ficha projetada do jogador (sem os campos do mestre) não apaga nada do mestre', () => {
    const completa = luffyAntes()
    const { dono: _dono, notaDoMestre: _nota, ...projetada } = completa
    const editada: Personagem = { ...projetada, recursos: { ...projetada.recursos, hp: 500 } }
    expect(diferencas(completa, editada, { papel: 'jogador' })).toEqual([{ fichaId: 'pers_luffy', caminho: ['recursos', 'hp'], acao: 'definir', valor: 500 }])
    // O mesmo rascunho tratado como do mestre apagaria dono e nota: é por isso que o papel existe.
    expect(diferencas(completa, editada).map((mudanca) => mudanca.caminho[0])).toEqual(['recursos', 'dono', 'notaDoMestre'])
  })

  it('jogador não cria nem apaga ficha, nem muda o NPC do Dragon Ball', () => {
    const goku = gokuAntes()
    const dbt = goku.dbt ?? fichaDBTVazia()
    expect(diferencas(null, goku, { papel: 'jogador' })).toEqual([])
    expect(diferencas(goku, null, { papel: 'jogador' })).toEqual([])
    expect(diferencas(goku, { ...goku, tipo: 'npc' }, { papel: 'jogador' })).toEqual([])
    const comNpc: Personagem = { ...goku, dbt: { ...dbt, npc: { nd: 2, categoria: 'elite', rank: 'C', passivas: [], prontoId: null } } }
    expect(diferencas(goku, comNpc, { papel: 'jogador' })).toEqual([])
  })
})
