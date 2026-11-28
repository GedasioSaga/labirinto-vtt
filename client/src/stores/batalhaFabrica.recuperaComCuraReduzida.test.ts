// @vitest-environment node
/**
 * BUGS DA BATALHA (rodada 2, 28/11/2026): o "Recupera por turno" de quem começa a vez passa pela Cura
 * reduzida, mas a que ACABA nessa mesma virada não corta mais. Ana (Agilidade 60) abre, depois a Bia
 * (20) e o Caio (10). Na vez da Bia o mestre dá a ela a carta extra, logo depois da dela; a Cura reduzida da mesa (pastilha no token, o prazo é o relógio) desconta no fim de cada vez do
 * token. O mestre dá a vez da extra de volta à carta da Bia: o fim da extra apaga a Cura reduzida, e o
 * começo da vez da Bia recupera os 40 inteiros. Com a Cura reduzida ainda valendo, recupera 20 (−50%).
 */
import { describe, expect, it } from 'vitest'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { porCondicaoNaFicha } from '../lib/prazoDaCondicao'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type TokenDaVaga } from '../lib/treino/mesaEmMemoria'
import type { Token } from '../types/map'
import { criarBatalhaStore } from './batalhaFabrica'

const CENA = 'cena_da_recuperacao'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ATRIBUTOS = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const RECUPERA_40 = { tipo: 'recuperacao' as const, id: 'car_recupera', hp: { quanto: '40' } }
const ANA: Personagem = ficha('Ana', { ...ATRIBUTOS, agilidade: 60 }, { hp: 500, sp: 50, escudo: 0 }, {})
/** HP 300 de 500: cabe a recuperação inteira. */
const BIA_CHEIA = ficha('Bia', { ...ATRIBUTOS, agilidade: 20 }, { hp: 500, sp: 50, escudo: 0 }, {})
const BIA: Personagem = { ...BIA_CHEIA, recursos: { ...BIA_CHEIA.recursos, hp: 300 }, caracteristicas: [RECUPERA_40] }
const CAIO: Personagem = ficha('Caio', ATRIBUTOS, { hp: 500, sp: 50, escudo: 0 }, {})

/** A vez da Bia, a extra dela, e o "Dar a vez" de volta à carta da Bia; devolve o HP da Bia no fim. */
function hpDepoisDeVoltarAVez(turnosDaCuraReduzida: number): number {
  const base = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ANA, lado: 'a' }, { ficha: BIA, lado: 'a' }, { ficha: CAIO, lado: 'b' }]))
  // A mesa em memória joga com CÓPIAS das fichas (id novo): a Bia é achada pelo nome.
  const copiaDaBia = base.personagens().find((personagem) => personagem.nome === BIA.nome)
  const daBia = base.tokens().find((token) => token.characterId === copiaDaBia?.id)
  if (copiaDaBia === undefined || daBia === undefined) throw new Error('sem a ficha da Bia no mapa')
  const fichaDaVaga = (vaga: TokenDaVaga): Token => ({ id: vaga.id, characterId: vaga.characterId, name: vaga.name, x: vaga.col * 50 + 25, y: vaga.row * 50 + 25, size: 1, image: null })
  const comCura = porCondicaoNaFicha(fichaDaVaga(daBia), 'Cura reduzida', [], { turnos: turnosDaCuraReduzida })
  const mapa = new Map<string, Token>(base.tokens().map((vaga) => [vaga.id, vaga.id === daBia.id ? comCura : fichaDaVaga(vaga)]))
  const mesa: MesaDaBatalha = {
    personagens: () => base.personagens(),
    sistema: () => base.sistema(),
    equipes: () => base.equipes(),
    ajustarPersonagem: (personagemId, ajustar) => base.ajustarPersonagem(personagemId, ajustar),
    trocarEquipe: (personagemId, equipeId) => base.trocarEquipe(personagemId, equipeId),
    fichaDaCena: (_sceneKey, tokenId) => mapa.get(tokenId) ?? null,
    mudarFichaDaCena: (_sceneKey, tokenId, mudar) => {
      const atual = mapa.get(tokenId)
      if (atual !== undefined) mapa.set(tokenId, mudar(atual))
    },
  }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = base.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const turnos = () => loja.getState().cenas[CENA].turnos
  // A Ana abre; a 1ª vez da Bia vem pelo Passar a vez (a recuperação vale da 2ª em diante).
  expect(loja.getState().passarVez(CENA, MESTRE)).toBe(true)
  const cartaDaBia = turnos().cartas.find((carta) => carta.tokenId === daBia.id)?.id
  if (cartaDaBia === undefined || turnos().vez !== cartaDaBia) throw new Error('a vez não chegou à Bia')
  const extra = loja.getState().adicionarCartaExtra(CENA, daBia.id, turnos().cartas.findIndex((carta) => carta.id === cartaDaBia) + 1, 'sempre')
  if (extra === null) throw new Error('a carta extra não entrou')
  expect(loja.getState().passarVez(CENA, MESTRE)).toBe(true)
  expect(turnos().vez).toBe(extra)
  expect(loja.getState().darVez(CENA, cartaDaBia)).toBe(true)
  expect(turnos().vez).toBe(cartaDaBia)
  return numeroDaFicha(mesa.personagens().find((personagem) => personagem.id === copiaDaBia.id)?.recursos ?? {}, 'hp')
}

describe('o "Recupera por turno" e a Cura reduzida que acaba na mesma virada', () => {
  it('a Cura reduzida que o fim da extra apaga não corta a recuperação da Bia (40); a que segue valendo corta (20)', () => {
    expect(hpDepoisDeVoltarAVez(3)).toBe(300 + 20)
    expect(hpDepoisDeVoltarAVez(2)).toBe(300 + 40)
  })
})
