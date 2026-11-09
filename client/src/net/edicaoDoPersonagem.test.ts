/**
 * FICHA DE PERSONAGEM NA MESA — as duas pontas da edição. No jogador, o
 * "Salvar" vira só o que mudou, em pacotes que cabem no teto, e uma mensagem
 * por imagem; no host, a edição entra na ficha de AGORA sem desfazer o que o
 * mestre mudou em outra parte, e o cartão guarda a imagem que já tinha.
 */
import { describe, expect, it } from 'vitest'
import { novoCartao, novoPersonagem, PERSONAGEM_SEM_NOME, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { PLAYER_MESSAGE_MAX_BYTES } from './protocol'
import { aplicarImagem, aplicarPartes, aplicarPartesPelaBase, ERRO_ABA_GRANDE, ERRO_CAMPO_FORA_DO_TETO, mensagensDoSalvar, partesMudadas, type MensagemDoSalvar } from './edicaoDoPersonagem'
import { parsePartesDoPersonagem, PERSONAGEM_TEXTO_MAX } from './protocoloDoPersonagem'

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const OUTRA_FOTO = 'data:image/png;base64,AAAA'

function luffy(): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }
}

const comCartao = (personagem: Personagem, abaId: string, id: string, imagem: string | null = null): Personagem => ({
  ...personagem,
  abas: { ...personagem.abas, [abaId]: [...(personagem.abas[abaId] ?? []), { ...novoCartao('Gomu Gomu'), id, imagem }] },
})

const bytes = (mensagem: MensagemDoSalvar): number => new TextEncoder().encode(JSON.stringify(mensagem)).length
const cabe = (mensagem: MensagemDoSalvar): boolean => bytes(mensagem) <= PLAYER_MESSAGE_MAX_BYTES

function salvar(base: Personagem, rascunho: Personagem) {
  let n = 0
  return mensagensDoSalvar(base, rascunho, { novoReqId: () => `p${++n}`, cabe })
}

describe('jogador: o Salvar manda só o que mudou', () => {
  it('nada mudou: nenhuma mensagem', () => {
    const base = luffy()
    expect(salvar(base, base)).toEqual({ ok: true, mensagens: [] })
  })

  it('a Força e a descrição, num pacote só; o resto da ficha não vai', () => {
    const base = luffy()
    const rascunho = { ...base, descricao: 'Capitão.', atributos: { ...base.atributos, forca: 45 } }
    expect(salvar(base, rascunho)).toEqual({
      ok: true,
      mensagens: [{ type: 'personagem.editar', reqId: 'p1', personagemId: 'pers_luffy', partes: { descricao: 'Capitão.', atributos: { forca: 45 } } }],
    })
  })

  it('aba com cartão novo vai sem imagem; a imagem dele vai depois, sozinha', () => {
    const base = luffy()
    const rascunho = comCartao(base, 'transformacoes', 'cart_gear', FOTO)
    const resultado = salvar(base, rascunho)
    if (!resultado.ok) throw new Error(resultado.erro)
    expect(resultado.mensagens.map((m) => m.type)).toEqual(['personagem.editar', 'personagem.imagem'])
    const [aba, imagem] = resultado.mensagens
    expect(JSON.stringify(aba)).not.toContain('data:image')
    expect(imagem).toEqual({ type: 'personagem.imagem', reqId: 'p2', personagemId: 'pers_luffy', imagem: FOTO, cartaoId: 'cart_gear' })
  })

  it('só o retrato trocou: só a mensagem do retrato', () => {
    const base = luffy()
    expect(salvar(base, { ...base, retrato: FOTO })).toEqual({ ok: true, mensagens: [{ type: 'personagem.imagem', reqId: 'p1', personagemId: 'pers_luffy', imagem: FOTO }] })
  })

  it('abas grandes que não cabem juntas saem em pacotes, cada uma abaixo do teto', () => {
    const base = luffy()
    const longo = 'x'.repeat(PERSONAGEM_TEXTO_MAX)
    const cheia = (abaId: string) => Array.from({ length: 5 }, (_, i) => ({ ...novoCartao('C'), id: `${abaId}_${i}`, campos: { descricao: longo } }))
    const rascunho = { ...base, nome: 'Monkey D. Luffy', abas: { ...base.abas, habilidades: cheia('h'), pericias: cheia('p'), vantagens: cheia('v') } }
    const resultado = salvar(base, rascunho)
    if (!resultado.ok) throw new Error(resultado.erro)
    expect(resultado.mensagens.length).toBeGreaterThan(1)
    for (const mensagem of resultado.mensagens) expect(bytes(mensagem)).toBeLessThanOrEqual(PLAYER_MESSAGE_MAX_BYTES)
    // Todas as partes chegam, sem repetir nenhuma.
    const abasEnviadas = resultado.mensagens.flatMap((m) => (m.type === 'personagem.editar' ? Object.keys(m.partes.abas ?? {}) : []))
    expect(abasEnviadas.sort()).toEqual(['habilidades', 'pericias', 'vantagens'])
  })

  it('uma aba que sozinha passa do teto é recusada antes de sair, com o motivo', () => {
    const base = luffy()
    const longo = 'x'.repeat(PERSONAGEM_TEXTO_MAX)
    const rascunho = { ...base, abas: { ...base.abas, habilidades: Array.from({ length: 10 }, (_, i) => ({ ...novoCartao('C'), id: `h${i}`, campos: { descricao: longo } })) } }
    expect(salvar(base, rascunho)).toEqual({ ok: false, erro: ERRO_ABA_GRANDE })
  })

  it('texto acima do teto do host é recusado aqui, com o motivo, em vez de sumir no host', () => {
    const base = luffy()
    expect(salvar(base, { ...base, nome: 'L'.repeat(200) })).toEqual({ ok: false, erro: ERRO_CAMPO_FORA_DO_TETO })
  })

  it('partesMudadas não vê como mudança a aba em que só a imagem trocou', () => {
    const base = comCartao(luffy(), 'transformacoes', 'cart_gear')
    const rascunho = { ...base, abas: { ...base.abas, transformacoes: (base.abas.transformacoes ?? []).map((c) => ({ ...c, imagem: FOTO })) } }
    expect(partesMudadas(base, rascunho)).toEqual({})
  })
})

describe('host: a edição entra na ficha de agora', () => {
  it('chave a chave: o que o mestre mudou em outra chave fica', () => {
    const doMestre = { ...luffy(), atributos: { ...luffy().atributos, agilidade: 70 } }
    const depois = aplicarPartes(doMestre, { atributos: { forca: 45 } })
    expect(depois.atributos.forca).toBe(45)
    expect(depois.atributos.agilidade).toBe(70)
  })

  it('o cartão volta com a imagem que o de mesmo id já tinha; o novo, sem', () => {
    const atual = comCartao(luffy(), 'transformacoes', 'cart_gear', FOTO)
    const depois = aplicarPartes(atual, {
      abas: {
        transformacoes: [
          { id: 'cart_gear', nome: 'Gear 2', campos: {}, extras: [], atributos: [], modificadores: [], subcartoes: [] },
          { id: 'cart_novo', nome: 'Gear 3', campos: {}, extras: [], atributos: [], modificadores: [], subcartoes: [] },
        ],
      },
    })
    expect(depois.abas.transformacoes?.map((c) => [c.nome, c.imagem])).toEqual([
      ['Gear 2', FOTO],
      ['Gear 3', null],
    ])
  })

  it('nome em branco vira "Personagem sem nome"; tipo e retrato nunca mudam pela edição', () => {
    const atual = { ...luffy(), retrato: FOTO }
    const depois = aplicarPartes(atual, { nome: '   ' })
    expect(depois.nome).toBe(PERSONAGEM_SEM_NOME)
    expect(depois.tipo).toBe('jogador')
    expect(depois.retrato).toBe(FOTO)
  })

  it('imagem: retrato, cartão (subcartão incluso) e cartão que sumiu', () => {
    const atual = comCartao(luffy(), 'transformacoes', 'cart_gear', FOTO)
    expect(aplicarImagem(atual, undefined, OUTRA_FOTO)?.retrato).toBe(OUTRA_FOTO)
    expect(aplicarImagem(atual, 'cart_gear', null)?.abas.transformacoes?.[0]?.imagem).toBeNull()
    expect(aplicarImagem(atual, 'cart_que_nao_existe', FOTO)).toBeNull()
    const comSub: Personagem = {
      ...atual,
      abas: { ...atual.abas, transformacoes: (atual.abas.transformacoes ?? []).map((c) => ({ ...c, subcartoes: [{ ...novoCartao('Jet'), id: 'cart_jet' }] })) },
    }
    expect(aplicarImagem(comSub, 'cart_jet', FOTO)?.abas.transformacoes?.[0]?.subcartoes[0]?.imagem).toBe(FOTO)
  })
})

describe('construtor de mecânicas: a edição do jogador nunca mexe na mecânica montada', () => {
  const PECAS = { versao: 1, acao: 'simples', alvo: { quem: 'inimigos', forma: { tipo: 'um' } } }

  it('o jogador muda OUTRO cartão da aba e troca a mecânica: pelo fio ela viaja, e o host guarda a do mestre', () => {
    const montado = { ...novoCartao('Golpe Montado'), id: 'cart_montado', mecanica: PECAS }
    const deTexto = { ...novoCartao('Golpe de Texto'), id: 'cart_texto' }
    const base: Personagem = { ...luffy(), abas: { ...luffy().abas, habilidades: [montado, deTexto] } }
    const rascunho: Personagem = {
      ...base,
      abas: { ...base.abas, habilidades: [{ ...montado, mecanica: { ...PECAS, acao: 'completa' } }, { ...deTexto, campos: { ...deTexto.campos, descricao: 'Texto novo' } }] },
    }
    // O caminho inteiro: as partes do Salvar, pelo fio (JSON e o parse do host), aplicadas na ficha de agora.
    const doFio = parsePartesDoPersonagem(JSON.parse(JSON.stringify(partesMudadas(base, rascunho))))
    expect(doFio?.abas?.habilidades?.[0]?.mecanica).toEqual({ ...PECAS, acao: 'completa' })
    const depois = aplicarPartes(base, doFio ?? {})
    expect(depois.abas.habilidades?.map((cartao) => [cartao.campos.descricao, cartao.mecanica])).toEqual([
      [montado.campos.descricao, PECAS],
      ['Texto novo', undefined],
    ])
  })

  it('fatia C2: a mecânica do dono fica como proposta; recusada pelo mestre, o Salvar do jogador em outro cartão não a traz de volta', () => {
    const PROPOSTA = { ...PECAS, acao: 'bonus' }
    const montado = { ...novoCartao('Golpe Montado'), id: 'cart_montado', mecanica: PECAS }
    const deTexto = { ...novoCartao('Golpe de Texto'), id: 'cart_texto' }
    const base: Personagem = { ...luffy(), abas: { ...luffy().abas, habilidades: [montado, deTexto] } }
    const propoe: Personagem = { ...base, abas: { ...base.abas, habilidades: [{ ...montado, mecanicaProposta: PROPOSTA }, deTexto] } }
    const doFio = parsePartesDoPersonagem(JSON.parse(JSON.stringify(partesMudadas(base, propoe))))
    const comProposta = aplicarPartesPelaBase(base, base, doFio ?? {})
    expect(comProposta.abas.habilidades?.[0]).toMatchObject({ mecanica: PECAS, mecanicaProposta: PROPOSTA })
    // O mestre recusa e salva: o host manda ao jogador a ficha sem a proposta, e ela vira a base da conexão.
    const { mecanicaProposta: _recusada, ...semProposta } = comProposta.abas.habilidades?.[0] ?? montado
    const recusada: Personagem = { ...comProposta, abas: { ...comProposta.abas, habilidades: [semProposta, deTexto] } }
    // O jogador, com a edição aberta desde ANTES da recusa (base = a ficha com a proposta), salva o OUTRO cartão da aba.
    const outroCartao: Personagem = { ...comProposta, abas: { ...comProposta.abas, habilidades: [comProposta.abas.habilidades?.[0] ?? montado, { ...deTexto, campos: { ...deTexto.campos, descricao: 'Outro' } }] } }
    const velho = parsePartesDoPersonagem(JSON.parse(JSON.stringify(partesMudadas(comProposta, outroCartao, recusada))))
    const depois = aplicarPartesPelaBase(recusada, recusada, velho ?? {})
    expect(depois.abas.habilidades?.map((cartao) => [cartao.campos.descricao, cartao.mecanica, cartao.mecanicaProposta])).toEqual([
      [montado.campos.descricao, PECAS, undefined],
      ['Outro', undefined, undefined],
    ])
  })
})

describe('construtor C8: a arma padrão na sala LAN (mestre e dono editam)', () => {
  it('a marca do mestre fica quando o jogador salva outra coisa na aba Armas, e a marca do jogador chega ao host', () => {
    const espada = { ...novoCartao('Espada de Teste'), id: 'arma_espada' }
    const lanca = { ...novoCartao('Lança de Teste'), id: 'arma_lanca' }
    const pelaRede = (base: Personagem, rascunho: Personagem) => aplicarPartes(base, parsePartesDoPersonagem(JSON.parse(JSON.stringify(partesMudadas(base, rascunho)))) ?? {})
    const padroes = (personagem: Personagem) => personagem.abas.armas?.map((arma) => [arma.id, arma.armaPadrao])
    // O mestre marcou a Lança; o jogador muda só o nome da Espada e salva.
    const doMestre: Personagem = { ...luffy(), abas: { ...luffy().abas, armas: [espada, { ...lanca, armaPadrao: true }] } }
    const renomeada: Personagem = { ...doMestre, abas: { ...doMestre.abas, armas: [{ ...espada, nome: 'Espada Nova' }, { ...lanca, armaPadrao: true }] } }
    expect(padroes(pelaRede(doMestre, renomeada))).toEqual([
      ['arma_espada', undefined],
      ['arma_lanca', true],
    ])
    // O jogador marca a Espada no app dele: a marca chega ao host.
    const semMarca: Personagem = { ...luffy(), abas: { ...luffy().abas, armas: [espada, lanca] } }
    const marcada: Personagem = { ...semMarca, abas: { ...semMarca.abas, armas: [{ ...espada, armaPadrao: true }, lanca] } }
    expect(padroes(pelaRede(semMarca, marcada))).toEqual([
      ['arma_espada', true],
      ['arma_lanca', undefined],
    ])
  })
})
