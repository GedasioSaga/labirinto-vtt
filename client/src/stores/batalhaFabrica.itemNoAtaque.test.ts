// @vitest-environment node
/**
 * BUGS DA BATALHA (testadores de 28/11/2026): o item da mochila no golpe.
 * 1. "Soma no ataque: Nada" no editor do item = só o dano da arma (a frase do editor diz "20"), sem a Força.
 * 2. A técnica que atira com a bala do pente ("Dano da Bala + 30") leva o "Ao acertar" da bala, como o Atacar.
 */
import { describe, expect, it } from 'vitest'
import { cartaoComAMecanica } from '../components/batalha/editor/gravarNoCartao'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { danoDoAtaque } from '../lib/batalha/formula'
import { armasDe, PREFIXO_DA_ARMA_DA_MOCHILA, PREFIXO_DA_MUNICAO } from '../lib/batalha/leituraDaFicha'
import type { MecanicaV1 } from '../lib/batalha/mecanica/modelo'
import { mecanicaDoModelo } from '../lib/batalha/mecanica/modelos'
import { cartaoComTextoGerado } from '../lib/batalha/mecanica/textoGerado'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { converterFichas } from '../lib/itens/conversao/ficha'
import { pecasDoItemGuardadas } from '../lib/itens/editorDoItem'
import { novoCartao, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import type { CarriedItem } from '../types/map'
import { criarBatalhaStore } from './batalhaFabrica'

const CENA = 'cena_do_item'
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ATRIBUTOS = { forca: 30, agilidade: 40, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }

describe('"Soma no ataque: Nada" do item', () => {
  it('a Espada com dano 20 e soma vazia (Nada) bate 20 no Atacar, sem a Força 30', () => {
    const espada: CarriedItem = { id: 'vaga_espada', nome: 'Espada', tipo: 'corpo', equipado: true, regra: { ataque: { dano: 20, soma: '', acao: 'Ação Simples', alvos: 1 } } }
    const heroi: Personagem = { ...ficha('Herói', ATRIBUTOS, { hp: 500, sp: 50, escudo: 0 }, {}), mochila: [espada] }
    const arma = armasDe(heroi).find((candidata) => candidata.nome === 'Espada')
    if (arma === undefined) throw new Error('a Espada não está no Atacar')
    expect(danoDoAtaque({ personagem: heroi, sistema: SISTEMA_DO_TESTE, arma, vidaDoAlvo: null })).toMatchObject({ tipo: 'valor', valor: 20 })
  })

  it('a conversão da arma de texto sem "Soma no ataque" guarda a Força (o padrão de antes), e a de "Nada" fica vazia', () => {
    const arma = (nome: string, campos: Record<string, string>): CartaoDaFicha => ({ ...novoCartao(nome), campos: { dano: '20', acao: 'Ação Simples', categoria: 'Corpo a corpo', ...campos } })
    const antiga: Personagem = { ...ficha('Herói', ATRIBUTOS, { hp: 500, sp: 50, escudo: 0 }, { armas: [arma('Espada', {}), arma('Leque', { atributoDoAtaque: 'Nada' })] }) }
    const convertida = converterFichas([], [antiga]).personagens[0]
    const somas = (convertida?.mochila ?? []).map((vaga) => [vaga.nome, vaga.regra?.ataque?.soma])
    expect(somas).toEqual([
      ['Espada', 'forca'],
      ['Leque', ''],
    ])
  })
})

describe('a técnica com "Dano da Bala" e o "Ao acertar" da bala do pente', () => {
  it('o jogador usa o Tiro Certeiro (Dano da Bala + 30) com a Bala de Brasa: 35 de dano, o pente 6 -> 5 e Sangrando no alvo', () => {
    const bala: CarriedItem = {
      id: 'vaga_brasa',
      nome: 'Bala de Brasa',
      itemId: 'item_brasa',
      tipo: 'municao',
      quantidade: 10,
      empilhavel: true,
      regra: { bala: { modo: 'soma', valor: 5 }, aoAcertar: pecasDoItemGuardadas([{ tipo: 'condicao', nome: 'Sangrando', duracao: 2 }], 'acerto') },
    }
    const pistola: CarriedItem = {
      id: 'vaga_pistola',
      nome: 'Pistola',
      tipo: 'fogo',
      equipado: true,
      pente: { balaId: 'item_brasa', n: 6 },
      regra: { ataque: { dano: 20, soma: 'percepcao', acao: 'Ação Simples', alvos: 1 }, pente: { capacidade: 6, aceita: ['item_brasa'], recarga: { acao: 'Ação Simples', rodadas: 0 } } },
    }
    const semTecnica: Personagem = { ...ficha('Atiradora', ATRIBUTOS, { hp: 500, sp: 200, escudo: 0 }, {}), tipo: 'jogador', mochila: [pistola, bala] }
    const modelo = mecanicaDoModelo('golpe', SISTEMA_DO_TESTE)
    if (modelo.dano === undefined) throw new Error('o modelo golpe veio sem dano')
    const mecanica: MecanicaV1 = { ...modelo, acao: 'simples', dano: { ...modelo.dano, base: { formula: 'Dano da Bala + 30' } } }
    const base = novoCartao('Tiro Certeiro')
    const montado = cartaoComAMecanica(base, mecanica, 'mestre', { personagem: semTecnica, sistema: SISTEMA_DO_TESTE })
    if (montado === null) throw new Error('o editor recusou o Tiro Certeiro')
    const tiro = cartaoComTextoGerado(base, montado, SISTEMA_DO_TESTE, 'tecnica')
    const atiradora: Personagem = { ...semTecnica, abas: { ...semTecnica.abas, habilidades: [tiro] } }
    const alvo = ficha('Alvo', { ...ATRIBUTOS, agilidade: 5 }, { hp: 500, sp: 0, escudo: 0 }, {})
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: atiradora, lado: 'a' }, { ficha: alvo, lado: 'b' }]))
    const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
    const tokens = mesa.tokens()
    loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
    const turnos = loja.getState().cenas[CENA]?.turnos
    const doAlvo = turnos?.cartas.find((carta) => carta.nome === 'Alvo')?.tokenId ?? ''
    if (turnos?.vez == null) throw new Error('sem vez')
    const pedido: PedidoDeAcao = { tipo: 'habilidade', cartaoId: tiro.id, armaId: `${PREFIXO_DA_ARMA_DA_MOCHILA}${pistola.id}`, balaId: `${PREFIXO_DA_MUNICAO}item_brasa`, alvos: [{ tokenId: doAlvo, dano: 35 }], surpresa: false, perfurante: false, custo: null, acao: null }
    expect(loja.getState().agir(CENA, JOGADOR, { cartaId: turnos.vez, rodada: turnos.rodada }, pedido)).toBe(true)
    const golpeId = loja.getState().cenas[CENA]?.turnos.golpes?.[0]?.id ?? ''
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId, tokenId: doAlvo })).toBe(true)
    const naMesa = (nome: string): Personagem | undefined => mesa.personagens().find((personagem) => personagem.nome === nome)
    expect(numeroDaFicha(naMesa('Alvo')?.recursos ?? {}, 'hp')).toBe(500 - 35)
    expect(naMesa('Atiradora')?.mochila?.find((vaga) => vaga.id === pistola.id)?.pente?.n).toBe(5)
    expect((loja.getState().cenas[CENA]?.turnos.selos ?? []).filter((selo) => selo.tokenId === doAlvo).map((selo) => selo.nome)).toContain('Sangrando')
  })
})
