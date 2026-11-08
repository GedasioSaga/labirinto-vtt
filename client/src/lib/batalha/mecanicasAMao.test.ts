import { describe, expect, it } from 'vitest'
import { textoLongoDoSelo } from '../../components/batalha/dadosDaFaixa'
import { quemPodeEntrar } from '../livros/combate'
import { novoPersonagem, type CartaoDaFicha, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { criarDuelo } from '../treino/duelo'
import { MARINHEIRO, ze } from '../treino/fichasDeTreino.testkit'
import { criarLuta, type InscricaoNaLuta } from '../treino/luta'
import { alvosNaArea, dividirDano, type CandidatoDaArea } from './area'
import { partesDoBonus, valorComAsPartes } from './combate'
import { comportamentoDoSelo, danoPorVezDoSelo, lembreteDoSangramento, porVezDoLembrete, saidasComOsSelos } from './condicoes'
import { custoPorTurno } from './custoPorTurno'
import { cdDaDisputa, modificadorDaDisputa, rolarDisputa } from './disputa'
import { lerDano } from './formula'
import { lancarGolpe, type ContextoDoGolpe } from './golpe'
import { leituraDaTecnica } from './leituraDaTecnica'
import { mecanicaDoCartao, motivoDasRespostasDoCartao } from './mecanicasAMao'
import { lerRespostas } from './perguntaNaHora'
import { saidasPossiveis } from './reacao'
import { bonusDaBatalha } from './selos'
import { combatentesIniciais, novaCarta, type TurnosDaCena } from './turnos'

/**
 * Conserto das fichas F2, fatia A: a base comum provada com o caso de cada
 * ficha real (números e ids da pasta da mesa; respostas do grilling).
 */

const sistema = SISTEMA_ONE_PIECE

function cartao(id: string, nome: string, campos: Record<string, string>): CartaoDaFicha {
  return { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

function ficha(nome: string, atributos: Record<string, number>, hp: number, tecnicas: CartaoDaFicha[] = []): Personagem {
  const base = novoPersonagem(sistema, 'jogador', nome)
  return { ...base, atributos: { ...base.atributos, ...atributos }, recursos: { ...base.recursos, hp, sp: 60 }, maximos: { hp, sp: 60 }, abas: { ...base.abas, habilidades: tecnicas } }
}

const CORTA_CENOURA = cartao('cart_8d2a46e7-afa7-4b7a-bbaf-53ef36cb1669', 'Corta Cenoura', { acao: 'Ação Simples', custo: '-25', tempo: '2', dano: 'Força + 25 de dano base.' })
const jimboy = ficha('Jimboy Segundo', { forca: 20, resistencia: 40 }, 1000, [CORTA_CENOURA])
const aira = ficha('Aira', { resistencia: 50, espirito: 40, carisma: 55 }, 900)
const vagn = ficha('Vagn Kane', { espirito: 35 }, 1000)

/** O d20 da vez, na ordem. */
function dados(...lista: number[]): () => number {
  let i = 0
  return () => lista[i++] ?? 10
}

describe('leitura única da técnica', () => {
  it('Corta Cenoura do Jimboy: custo, ação e Tempo da ficha; o custo da tela vale no lugar', () => {
    const lida = leituraDaTecnica(CORTA_CENOURA, { personagem: jimboy, sistema })
    expect(lida.custo).toEqual({ tipo: 'valor', recurso: 'sp', valor: 25, porTurno: false })
    expect(lida.acaoDaFicha.acao).toBe('simples')
    expect(lida.tempo).toEqual({ tipo: 'recarga', turnos: 2 })
    expect(leituraDaTecnica(CORTA_CENOURA, { personagem: jimboy, sistema, custoDaTela: 30 }).custo).toEqual({ tipo: 'valor', recurso: 'sp', valor: 30, porTurno: false })
  })
})

describe('custo por turno lido do Requisito', () => {
  it('as formas do Jimboy e da Ryoko: "Gasta N SP por turno" vira o lembrete; "Não gasta SP" não', () => {
    const hibrido = cartao('cart_36afecdf-5832-4904-a0a3-e2beeb2c72bd', 'NEKO NEKO NO MI Hibrido', { requisito: 'Gasta 5 SP por turno' })
    const full = cartao('cart_d194229d-76b4-4ecd-aeab-75206c2da1ac', 'NEKO NEKO NO MI Full', { requisito: 'Gasta 10 SP por turno para manter a forma' })
    const parte1 = cartao('cart_5b1f2e01-5ed4-4fb1-aa28-46b533b54521', 'Forma Hibrida(Parte 1)', { requisito: 'Não gasta SP' })
    expect(custoPorTurno(hibrido, jimboy)).toEqual({ tipo: 'valor', recurso: 'sp', valor: 5, porTurno: true })
    expect(custoPorTurno(full, jimboy)?.valor).toBe(10)
    expect(custoPorTurno(parte1, jimboy)).toBeNull()
  })
})

describe('golpe com 0 de dano', () => {
  it('a Saga ataca com Força 0 e sem arma: golpe sem dano, sem reação; com dano o alvo reage', () => {
    const saga = ficha('Saga', {}, 700)
    const cartaSaga = novaCarta('tk-saga', saga.id, 'Saga')
    const cartaAira = novaCarta('tk-aira', aira.id, 'Aira')
    const turnos: TurnosDaCena = { cartas: [cartaSaga, cartaAira], vez: cartaSaga.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
    const ctx: ContextoDoGolpe = {
      turnos,
      carta: cartaSaga,
      personagem: saga,
      sistema,
      regras: null,
      autor: { tipo: 'mestre' },
      personagens: [saga, aira],
      personagemDoToken: (tokenId) => (tokenId === 'tk-aira' ? aira.id : tokenId === 'tk-saga' ? saga.id : undefined),
    }
    const atacar = (dano: number) => lancarGolpe(ctx, { tipo: 'atacar', armaId: null, alvos: [{ tokenId: 'tk-aira', dano }], surpresa: false, perfurante: false }, { golpe: 'g1', linha: 'l1' })
    const semDano = atacar(0)
    expect(semDano.resolvidos[0]).toMatchObject({ tokenId: 'tk-aira', podeReagir: false, saida: 'semReacao', danoFinal: 0 })
    expect(atacar(10).golpe?.alvos[0]?.podeReagir).toBe(true)
  })
})

describe('ficha sem HP fica de fora', () => {
  it('a Saga com HP máximo 0 não entra na ordem nem marcada, e a caixa diz "sem HP"', () => {
    const saga = ficha('Saga', {}, 0)
    const tokens = [
      { id: 'tk-saga', characterId: saga.id, name: 'Saga', hidden: false },
      { id: 'tk-jimboy', characterId: jimboy.id, name: 'Jimboy', hidden: false },
    ]
    const ordem = combatentesIniciais(tokens, [saga, jimboy], sistema, new Set(['tk-saga', 'tk-jimboy']))
    expect(ordem.map((carta) => carta.tokenId)).toEqual(['tk-jimboy'])
    expect(quemPodeEntrar(tokens, [saga, jimboy], sistema).map((candidato) => candidato.situacao)).toEqual(['semHp', 'combate'])
  })
})

describe('disputa rolada pelo app', () => {
  it('Corta Cenoura: d20 + FOR do Jimboy com vantagem contra d20 + RES do alvo; empate não vence', () => {
    const disputa = mecanicaDoCartao(CORTA_CENOURA.id)?.disputa
    if (disputa === undefined) throw new Error('Corta Cenoura sem disputa na tabela')
    const fichas = { testa: { personagem: jimboy }, usa: { personagem: jimboy }, resiste: { personagem: aira } }
    const modJimboy = modificadorDaDisputa(fichas.testa, sistema, 'forca')
    const modAira = modificadorDaDisputa(fichas.resiste, sistema, 'resistencia')
    // Vantagem: 4 e 17, fica o 17. A Aira tira o que empata e depois o que perde.
    const venceu = rolarDisputa(disputa, fichas, sistema, 0, dados(4, 17, 17 + modJimboy - modAira - 1))
    expect(venceu).toMatchObject({ tipo: 'rolagem', passou: true, rolagem: { d20: 17, vantagem: { modo: 'vantagem', outro: 4 } } })
    const empatou = rolarDisputa(disputa, fichas, sistema, 0, dados(4, 17, 17 + modJimboy - modAira))
    expect(empatou.passou).toBe(false)
    expect(disputa.seQuemUsaVence?.selo).toMatchObject({ nome: 'Atordoado', turnos: 1 })
  })

  it('CD por fórmula e pela concentração (Campo do Vagn: 10 + Proficiência + ESP; 1 = 11, 2 = 14, 3 = acerta) e a Explosão passa no 11', () => {
    // as const: só fixa os literais da CD (não é cast); a Proficiência em Fruta do Vagn (2) é de exemplo, a ficha ainda não diz.
    const campo = { tipo: 'porCarga', semCarga: { tipo: 'formula', base: 10, mais: 2, atributoId: 'espirito' }, cargas: [11, 14, 'acerta'] } as const
    const usa = { personagem: vagn }
    expect(cdDaDisputa(campo, usa, sistema, 0)).toBe(12 + modificadorDaDisputa(usa, sistema, 'espirito'))
    expect([1, 2, 3].map((carga) => cdDaDisputa(campo, usa, sistema, carga))).toEqual([11, 14, 'acerta'])
    const explosao = mecanicaDoCartao('cart_14ed4fb4-817c-41ea-a417-517ece9782ed')?.disputa
    if (explosao === undefined) throw new Error('Explosão sem disputa na tabela')
    const fichas = { testa: { personagem: aira }, usa: { personagem: jimboy }, resiste: { personagem: aira } }
    const modAira = modificadorDaDisputa(fichas.testa, sistema, 'resistencia')
    expect(rolarDisputa(explosao, fichas, sistema, 0, dados(11 - modAira))).toMatchObject({ tipo: 'cd', cd: 11, passou: true })
    expect(explosao.seQuemUsaPerde?.devolveOCusto).toBe(true)
  })
})

describe('área', () => {
  const em = (tokenId: string, col: number, row: number, inimigo = true): CandidatoDaArea => ({ tokenId, col, row, inimigo })

  it('Aplauso 6x6 à frente da May (só inimigos) e Giro de Pá a 1 casa do Harvey', () => {
    const aplauso = mecanicaDoCartao('cart_39e23a9c-84c7-4270-821d-bdd7701c32d3')?.area
    if (aplauso === undefined) throw new Error('Aplauso sem área na tabela')
    // May em (10, 10) olhando para o norte: o quadrado vai das linhas 9 a 4 e das colunas 8 a 13.
    const campo = [em('perto', 10, 9), em('canto', 13, 4), em('longe', 10, 3), em('atras', 10, 11), em('aliado', 11, 9, false), em('fora-do-lado', 7, 8)]
    expect(alvosNaArea(aplauso.forma, { col: 10, row: 10 }, 'norte', campo, aplauso.quem)).toEqual(['perto', 'canto'])
    const giro = mecanicaDoCartao('cart_9500ae10-0bdc-4f08-b472-edb73cb70685')?.area
    if (giro === undefined) throw new Error('Giro de Pá sem área na tabela')
    expect(alvosNaArea(giro.forma, { col: 5, row: 5 }, 'norte', [em('diag', 6, 6), em('dois', 7, 5), em('amigo', 4, 5, false)], giro.quem)).toEqual(['diag'])
  })

  it('Projeção Letal em linha reta e Lua Incandescente dividida (71 em 3 = 23; 4 alvos passa do teto)', () => {
    const campo = [em('na-linha', 8, 5), em('fora', 8, 6), em('atras', 2, 5)]
    expect(alvosNaArea({ tipo: 'linha', alcance: 6 }, { col: 5, row: 5 }, 'leste', campo, 'todos')).toEqual(['na-linha'])
    const lua = mecanicaDoCartao('cart_366f98ce-8206-473a-8646-e34ae6907dbe')?.divide
    expect(lua).toEqual({ teto: 3 })
    expect(dividirDano(71, 3, 3)).toBe(23)
    expect(dividirDano(71, 4, 3)).toBeNull()
  })
})

describe('selos novos', () => {
  it('Aéreo tira Esquiva e Contra-ataque (fica Defender e Receber); Cego zera a Percepção', () => {
    expect(saidasComOsSelos(saidasPossiveis(20, 20), [{ nome: 'Aéreo' }])).toEqual(['metade'])
    expect(saidasComOsSelos(saidasPossiveis(5, 5), [{ nome: 'Aereo 1' }])).toEqual(['cheio'])
    // O alvo do Golpe Baixo do Harvey com Percepção 10: lida na hora, fica em 0.
    expect(valorComAsPartes(10, partesDoBonus(bonusDaBatalha([{ tokenId: 't', nome: 'Cego' }], 't'), 'percepcao'))).toBe(0)
  })

  it('Cego zera a Percepção na leitura: buff antes ou depois dele, buff que sai, e volta quando o Cego sai', () => {
    const foco = { tokenId: 't', nome: 'Foco', mods: [{ alvo: 'percepcao', delta: 10 }] }
    const cego = { tokenId: 't', nome: 'Cego 2' }
    const percepcao = (selos: readonly (typeof foco | typeof cego)[]): number => valorComAsPartes(40, partesDoBonus(bonusDaBatalha(selos, 't'), 'percepcao'))
    expect([percepcao([foco, cego]), percepcao([cego, foco]), percepcao([cego]), percepcao([foco])]).toEqual([0, 0, 0, 50])
    // A fórmula (a Bala de Prata lê a Percepção) diz por quê na conta.
    const harvey = ficha('Harvey', { percepcao: 40 }, 800)
    const lido = lerDano('Percepção + 5 de dano', { personagem: harvey, sistema, arma: null, vidaDoAlvo: null, bonusDaBatalha: bonusDaBatalha([foco, cego], 't') })
    expect(lido).toMatchObject({ tipo: 'valor', valor: 5 })
    expect(lido.tipo === 'valor' ? lido.conta : '').toContain('+10 (Foco) → 0 (Cego 2)')
  })

  it('Queimando tira 10 por vez (ou o N da técnica) e renova; Ferido por prata só lembra', () => {
    expect(danoPorVezDoSelo({ nome: 'Queimando' })).toBe(10)
    expect(danoPorVezDoSelo({ nome: 'Queimando', porVez: 15 })).toBe(15)
    expect(comportamentoDoSelo('Queimando')?.renova).toBe(true)
    const prata = comportamentoDoSelo('Ferido por prata')
    expect(prata?.lembrete).toContain('metade')
    expect(danoPorVezDoSelo({ nome: 'Ferido por prata' })).toBeNull()
    // O título da pílula (mestre e leitor de tela) diz o que o selo lembra.
    expect(textoLongoDoSelo({ id: 'selo_1', nome: 'Ferido por prata', turnos: null, texto: 'Ferido por prata', mods: '' })).toBe('Ferido por prata: até o mestre tirar · a cura que recebe cai pela metade (o mestre corta à mão)')
  })

  it('o lembrete do Queimando N guarda o nome e o dano: vale com o selo fora da ficha', () => {
    const queimando = { id: 'selo_q', tokenId: 't', nome: 'Queimando', turnos: 1, total: 1, porVez: 15 }
    const lembrete = lembreteDoSangramento(queimando, 3)
    expect(lembrete.porVez).toEqual({ nome: 'Queimando', dano: 15 })
    expect(porVezDoLembrete(lembrete, [])).toEqual({ nome: 'Queimando', dano: 15 })
    // Lembrete gravado antes disto, sem o selo: o Sangrando da regra.
    expect(porVezDoLembrete({ cartaoId: 'selo_velho' }, [])).toEqual({ nome: 'Sangrando', dano: 10 })
  })
})

describe('ficha sem HP no treino e no duelo (resposta da Saga)', () => {
  it('o duelo recusa dizendo qual ficha; a luta do Lobby recusa como ficha que não serve', () => {
    const motor = { sistema, rolarD20: () => 10 }
    const ana = { ...ze(60), dono: 'conta_a' }
    const semHp: Personagem = { ...MARINHEIRO, dono: 'conta_b', maximos: { ...MARINHEIRO.maximos, hp: 0 } }
    const duelo = criarDuelo({ id: 'duelo_1', a: { contaId: 'conta_a', nome: 'Ana', fichas: [ana] }, b: { contaId: 'conta_b', nome: 'Bia', fichas: [semHp] } }, motor)
    expect(duelo).toEqual({ ok: false, motivo: 'semHp', lado: 'b', nome: 'Marinheiro' })
    const inscricoes: InscricaoNaLuta[] = [
      { contaId: 'conta_a', nome: 'Ana', papel: 'jogador', lado: 'a', fichas: [ana] },
      { contaId: 'conta_b', nome: 'Bia', papel: 'jogador', lado: 'b', fichas: [semHp] },
    ]
    expect(criarLuta({ id: 'luta_1', modo: 'todos', inscricoes }, motor)).toEqual({ ok: false, motivo: 'semFicha' })
  })
})

describe('pergunta na hora', () => {
  it('Projeção Letal: "cortante ou perfurante?" respondida, fora das opções ou sem resposta', () => {
    const id = 'cart_d50ef507-dd18-4566-8015-94910a12136e'
    expect(motivoDasRespostasDoCartao(id, { corte: 'perfurante', fogo: 'nao' })).toBeNull()
    expect(motivoDasRespostasDoCartao(id, { corte: 'contundente' })).toContain('fora das opções')
    expect(motivoDasRespostasDoCartao(id, {})).toContain('Cortante ou perfurante?')
    expect(motivoDasRespostasDoCartao(CORTA_CENOURA.id, { corte: 'perfurante' })).toBe('Resposta que a técnica não pergunta')
  })

  it('o fio aceita só respostas curtas: texto até 40 e número inteiro até 99', () => {
    expect(lerRespostas({ corte: 'cortante', turnos: 3 })).toEqual({ corte: 'cortante', turnos: 3 })
    expect(lerRespostas({ turnos: 100 })).toBeNull()
    expect(lerRespostas({ corte: 'x'.repeat(41) })).toBeNull()
    expect(lerRespostas(['cortante'])).toBeNull()
  })
})
