import { describe, expect, it } from 'vitest'
import { personagemDoArquivo, type CartaoDaFicha, type Personagem } from '../../personagem'
import { ficha, sistema } from '../fichasDaFatiaB.testkit'
import { armasNaBatalha, golpesDeHabilidade } from '../../../components/batalha/dadosDoMenu'
import type { PedidoDeAcao } from '../combate'
import { lancarGolpe, podeAgir, type ContextoDoGolpe } from '../golpe'
import { danoDaTecnica, leituraDaTecnica } from '../leituraDaTecnica'
import { danoQueChega } from '../reacao'
import { novaCarta, type AutorDaAcao, type TurnosDaCena } from '../turnos'
import { lerMecanica } from './modelo'

/**
 * Construtor de mecânicas, fatia C1: um NPC de teste (dados inventados) com a
 * técnica escrita em texto e a mesma técnica montada por peças. O portão das
 * 11 fichas reais (lidas iguais antes e depois) roda à parte, na cópia do rpg.json.
 */

function cartao(id: string, nome: string, campos: Record<string, string>, mecanica?: CartaoDaFicha['mecanica']): CartaoDaFicha {
  const base: CartaoDaFicha = { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
  return mecanica === undefined ? base : { ...base, mecanica }
}

const PECAS_DA_ESPADADA = {
  versao: 1,
  acao: 'simples',
  custos: [{ recurso: 'sp', quanto: { fixo: 30 }, quando: 'aoUsar' }],
  limite: { recarga: 3 },
  alvo: { quem: 'inimigos', forma: { tipo: 'um' } },
  teste: { tipo: 'reacao' },
  dano: { base: { formula: 'Força + 20' }, multiplicadores: { concentracao: true, surpresa: true } },
  efeitos: [{ tipo: 'selo', nome: 'Atordoado', duracao: 1 }],
}

const ESPADADA_EM_TEXTO = cartao('cart_espadada_texto', 'Espadada do Marinheiro', { acao: 'Ação Simples', custo: '30', tempo: '3', dano: 'Força + 20', efeito: 'Atordoa por 1 turno.' })
/** O texto velho do cartão montado diz outra coisa: com peças, ele é só descrição. */
const ESPADADA_MONTADA = cartao('cart_espadada_pecas', 'Espadada do Marinheiro', { acao: 'Completa', custo: '999', tempo: '9', dano: '5000', efeito: 'Texto antigo.' }, PECAS_DA_ESPADADA)
const DE_APP_NOVO = cartao('cart_futura', 'Golpe do Futuro', { custo: '10', dano: '40' }, { versao: 2, acao: 'simples', coisaNova: true })

const marinheiro = ficha('Marinheiro de Teste', { forca: 60 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [ESPADADA_EM_TEXTO, ESPADADA_MONTADA, DE_APP_NOVO] })
const boneco = ficha('Boneco de Treino', { forca: 10 }, { hp: 400, sp: 50, escudo: 0 }, {})

function contexto(autor: AutorDaAcao, quem: Personagem = marinheiro): ContextoDoGolpe {
  const carta = novaCarta('tok_marinheiro', quem.id, quem.nome)
  const outra = novaCarta('tok_boneco', boneco.id, boneco.nome)
  const turnos: TurnosDaCena = { cartas: [carta, outra], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
  const personagens: Personagem[] = [quem, boneco]
  return { turnos, carta, personagem: quem, sistema, regras: null, autor, personagens, personagemDoToken: (tokenId) => (tokenId === 'tok_marinheiro' ? quem.id : tokenId === 'tok_boneco' ? boneco.id : undefined) }
}

function lancar(autor: AutorDaAcao, cartaoId: string, dano: number, selo?: { nome: string; turnos: number }) {
  return lancarGolpe(contexto(autor), { tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: 'tok_boneco', dano }], surpresa: false, perfurante: false, custo: null, acao: null, ...(selo === undefined ? {} : { selo }) }, { golpe: 'g1', linha: 'l1' })
}

describe('a técnica montada dá o mesmo golpe que o texto equivalente', () => {
  it('leitura, dano e lançamento da Espadada: 30 SP, Simples, recarga 3, Força + 20 = 80, Atordoado 1', () => {
    const ctx = { personagem: marinheiro, sistema }
    const texto = leituraDaTecnica(ESPADADA_EM_TEXTO, ctx)
    const pecas = leituraDaTecnica(ESPADADA_MONTADA, ctx)
    expect([pecas.custo, pecas.acaoDaFicha.acao, pecas.tempo, pecas.overload]).toEqual([texto.custo, texto.acaoDaFicha.acao, texto.tempo, texto.overload])
    expect(danoDaTecnica(ESPADADA_MONTADA, { ...ctx, arma: null })).toEqual(danoDaTecnica(ESPADADA_EM_TEXTO, { ...ctx, arma: null }))
    // O texto põe o selo pela mira; a montada, pela peça (a mira não manda nada).
    const deTexto = lancar({ tipo: 'mestre' }, ESPADADA_EM_TEXTO.id, 80, { nome: 'Atordoado', turnos: 1 })
    const deMontada = lancar({ tipo: 'mestre' }, ESPADADA_MONTADA.id, 80)
    expect(deMontada.golpe?.alvos).toEqual(deTexto.golpe?.alvos)
    expect([deMontada.golpe?.selo?.nome, deMontada.golpe?.selo?.turnos, deMontada.golpe?.perfurante]).toEqual(['Atordoado', 1, false])
    expect(deMontada.custo).toEqual(deTexto.custo)
    expect(deMontada.combate?.recargas[ESPADADA_MONTADA.id]).toBe(deTexto.combate?.recargas[ESPADADA_EM_TEXTO.id])
  })

  it('decisão 2: o app do mestre recalcula o dano do jogador pelas peças; o número do mestre vale', () => {
    expect(lancar({ tipo: 'jogador', playerId: 'p1', nome: 'Jogadora' }, ESPADADA_MONTADA.id, 999).golpe?.alvos[0]?.dano).toBe(80)
    expect(lancar({ tipo: 'mestre' }, ESPADADA_MONTADA.id, 120).golpe?.alvos[0]?.dano).toBe(120)
  })
})

describe('tudo ou nada e a versão', () => {
  it('peça torta é recusada com o motivo; versão futura vira à mão e não volta para o texto', () => {
    expect(lerMecanica({ ...PECAS_DA_ESPADADA, ramos: [] })).toMatchObject({ tipo: 'invalida' })
    expect(lerMecanica({ ...PECAS_DA_ESPADADA, custos: [{ recurso: 'sp', quanto: { formula: 'Força' }, quando: 'porTurno' }] })).toMatchObject({ tipo: 'invalida' })
    // Revisão: o "depois" só cobra HP fixo (`custoEmHp`); o resto seria lido e nunca cobrado.
    expect(lerMecanica({ ...PECAS_DA_ESPADADA, custos: [{ recurso: 'sp', quanto: { fixo: 10 }, quando: 'depois' }] })).toMatchObject({ tipo: 'invalida' })
    expect(lerMecanica({ ...PECAS_DA_ESPADADA, custos: [{ recurso: 'hp', quanto: { fixo: 200 }, quando: 'depois' }] })).toMatchObject({ tipo: 'pecas' })
    expect(lerMecanica(DE_APP_NOVO.mecanica)).toEqual({ tipo: 'futura', versao: 2 })
    const lida = leituraDaTecnica(DE_APP_NOVO, { personagem: marinheiro, sistema })
    expect([lida.custo.tipo, lida.acaoDaFicha.acao]).toEqual(['pergunta', null])
    expect(danoDaTecnica(DE_APP_NOVO, { personagem: marinheiro, sistema, arma: null }).tipo).toBe('naoEntende')
  })

  it('o leitor do disco guarda a mecânica como veio (a de app mais novo também) e a ficha sem ela segue igual', () => {
    const lido = personagemDoArquivo(JSON.parse(JSON.stringify(marinheiro)))
    expect(lido?.abas.habilidades?.map((item) => item.mecanica)).toEqual([undefined, PECAS_DA_ESPADADA, DE_APP_NOVO.mecanica])
  })
})

describe('as peças mínimas (todo campo opcional ausente)', () => {
  it('só ação e alvo: sem custo, sem Tempo, sem dano; a cura num aliado não pede reação', () => {
    const minima = { versao: 1, acao: 'bonus', alvo: { quem: 'aliados', forma: { tipo: 'um' } } }
    expect(lerMecanica(minima)).toMatchObject({ tipo: 'pecas', mecanica: { custos: [], limite: {}, teste: { tipo: 'reacao' }, efeitos: [] } })
    const ajuda = cartao('cart_minima', 'Mão Amiga', { dano: '300' }, { ...minima, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 50 }, emQuem: 'alvo' }] })
    const comAjuda = { ...marinheiro, abas: { ...marinheiro.abas, habilidades: [ajuda] } }
    const lida = leituraDaTecnica(ajuda, { personagem: comAjuda, sistema })
    expect([lida.custo, lida.tempo, lida.acaoDaFicha.acao]).toEqual([{ tipo: 'nada' }, { tipo: 'livre' }, 'bonus'])
    expect(danoDaTecnica(ajuda, { personagem: comAjuda, sistema, arma: null })).toEqual({ tipo: 'semDano' })
    const ctx = { ...contexto({ tipo: 'jogador', playerId: 'p1', nome: 'Jogadora' }), personagem: comAjuda }
    const alvo = lancarGolpe(ctx, { tipo: 'habilidade', cartaoId: ajuda.id, armaId: null, alvos: [{ tokenId: 'tok_boneco', dano: 300 }], surpresa: false, perfurante: false, custo: null, acao: null }, { golpe: 'g', linha: 'l' }).golpe?.alvos[0]
    expect([alvo?.dano, alvo?.podeReagir]).toEqual([null, false])
  })
})

describe('a ordem única do dano (danoQueChega)', () => {
  it('base × concentração × Surpresa × extras ÷ divisão, para baixo uma vez só', () => {
    expect(danoQueChega(55 + 30, 3, false)).toBe(297)
    expect(danoQueChega(100, 0, true, { extras: [3] })).toBe(450)
    expect(danoQueChega(71, 0, false, { dividirPor: 3 })).toBe(23)
    expect(danoQueChega(80, 1, true, { extras: [1.5], dividirPor: 2 })).toBe(135)
  })
})

describe('revisão da C1: o host confere o que as peças prometem', () => {
  const jogadora: AutorDaAcao = { tipo: 'jogador', playerId: 'p1', nome: 'Jogadora' }
  const mestre: AutorDaAcao = { tipo: 'mestre' }
  const UM_INIMIGO = { quem: 'inimigos', forma: { tipo: 'um' } }
  const MULT = { concentracao: true, surpresa: true }
  const pedido = (cartaoId: string, tokenId = 'tok_boneco', extra: Partial<Extract<PedidoDeAcao, { tipo: 'habilidade' }>> = {}): PedidoDeAcao => ({
    tipo: 'habilidade',
    cartaoId,
    armaId: null,
    alvos: [{ tokenId, dano: 999 }],
    surpresa: false,
    perfurante: false,
    custo: null,
    acao: null,
    ...extra,
  })

  it('decisão 2: sem conta pelas peças (fórmula fora da gramática, arma que falta, mecânica de app novo), o golpe do jogador não sai; o do mestre sai', () => {
    const torta = cartao('cart_torta', 'Golpe Torto', { dano: '50' }, { versao: 1, acao: 'simples', alvo: UM_INIMIGO, dano: { base: { formula: 'Força do Céu' }, multiplicadores: MULT } })
    const armado = cartao('cart_armado', 'Golpe Armado', { dano: '50' }, { versao: 1, acao: 'simples', alvo: UM_INIMIGO, dano: { base: { formula: 'Dano da Arma + Força' }, arma: 'padrao', multiplicadores: MULT } })
    const capitao = ficha('Capitão de Teste', { forca: 60 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [torta, armado] })
    expect(danoDaTecnica(torta, { personagem: capitao, sistema, arma: null }).tipo).toBe('naoEntende')
    expect(podeAgir(contexto(jogadora, capitao), pedido(torta.id))).toBe('O mestre precisa conferir a fórmula do dano desta técnica')
    expect(podeAgir(contexto(jogadora, capitao), pedido(armado.id))).toBe('Escolha a arma da técnica')
    expect(podeAgir(contexto(jogadora), pedido(DE_APP_NOVO.id, 'tok_boneco', { custo: 10, acao: 'simples' }))).toBe('O mestre precisa conferir a mecânica desta técnica')
    expect(podeAgir(contexto(mestre, capitao), pedido(torta.id))).toBeNull()
  })

  it('"em si" e "nos aliados" não pedem reação: num inimigo, recusa; em quem usa, vale', () => {
    const furia = cartao('cart_furia', 'Fúria de Teste', {}, { versao: 1, acao: 'simples', alvo: { quem: 'si', forma: { tipo: 'um' } }, efeitos: [{ tipo: 'selo', nome: 'Fúria', duracao: 2, natureza: 'buff' }] })
    const empurrao = cartao('cart_empurrao', 'Empurrão Amigo', {}, { versao: 1, acao: 'simples', alvo: { quem: 'aliados', forma: { tipo: 'um' } }, dano: { base: { fixo: 40 }, multiplicadores: MULT } })
    const capitao = ficha('Capitão de Teste', { forca: 60 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [furia, empurrao] })
    expect(podeAgir(contexto(jogadora, capitao), pedido(furia.id))).toBe('Fúria de Teste só vale em você')
    // Conserto de 09/11: o mestre lê quem está do outro lado (o jogador segue com a frase curta).
    expect(podeAgir(contexto(mestre, capitao), pedido(empurrao.id))).toBe(`Empurrão Amigo só vale em quem usa ou num aliado. ${boneco.nome} está do outro lado.`)
    expect(podeAgir(contexto(jogadora, capitao), pedido(empurrao.id))).toBe('Empurrão Amigo só vale em você ou num aliado')
    expect(podeAgir(contexto(jogadora, capitao), pedido(furia.id, 'tok_marinheiro'))).toBeNull()
  })

  it('as balas no menu seguem a fórmula da peça, não o campo Dano (a mesma conta que o host confere)', () => {
    const bala = cartao('cart_bala_teste', 'Bala de Teste', { dano: '+15' })
    const pistola: CartaoDaFicha = { ...cartao('cart_pistola_teste', 'Pistola de Teste', { dano: '20', categoria: 'De fogo' }), subcartoes: [bala] }
    const comBala = cartao('cart_com_bala', 'Tiro Montado', { dano: '50' }, { versao: 1, acao: 'simples', alvo: UM_INIMIGO, dano: { base: { formula: 'Dano da Bala + Força' }, arma: 'padrao', multiplicadores: MULT } })
    const textoVelho = cartao('cart_texto_velho', 'Tiro de Texto Velho', { dano: 'Dano da Bala + 10' }, { versao: 1, acao: 'simples', alvo: UM_INIMIGO, dano: { base: { formula: 'Força + 10' }, multiplicadores: MULT } })
    const atirador = ficha('Atirador de Teste', { forca: 60 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [comBala, textoVelho], armas: [pistola] })
    const [arma] = armasNaBatalha(atirador, undefined)
    const golpes = golpesDeHabilidade(atirador, sistema, undefined, null, arma ?? null)
    expect(golpes.map((golpe) => [golpe.nome, golpe.balas?.map((item) => item.dano.valor)])).toEqual([
      ['Tiro Montado', [75]],
      ['Tiro de Texto Velho', undefined],
    ])
  })
})
