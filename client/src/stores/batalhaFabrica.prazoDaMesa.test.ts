// @vitest-environment node
/**
 * Fase C, item 4: o prazo da mesa NA BATALHA One Piece (`prazosDaVez`). Com
 * uma mesa que tem mapa (`fichaDaCena`/`mudarFichaDaCena`), o Envenenado 3 x 4
 * tira 4 HP no começo de cada vez da ficha (12 no total, direto, como fora
 * da batalha), desconta no fim da vez e apaga no fim da terceira.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { cartaDaVez, combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { porCondicaoNaFicha, prazoDaCondicao } from '../lib/prazoDaCondicao'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type TokenDaVaga } from '../lib/treino/mesaEmMemoria'
import type { Token } from '../types/map'
import { criarBatalhaStore } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro (Agilidade 70). */
const BRANN = ficha({ id: 'pers_brann', tipo: 'jogador', nome: 'Brann', recursos: { hp: 300, sp: 100 }, maximos: { hp: 300, sp: 100 }, atributos: { forca: 30, agilidade: 70 } })
const TOMAS = ficha({ id: 'pers_tomas', tipo: 'jogador', nome: 'Tomás', recursos: { hp: 300, sp: 60 }, maximos: { hp: 300, sp: 60 }, atributos: { forca: 50, agilidade: 40 } })

function batalhaComVeneno() {
  const base = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: BRANN, lado: 'a' }, { ficha: TOMAS, lado: 'b' }]))
  // A mesa em memória joga com CÓPIAS das fichas (id novo): o Brann é achado pelo nome.
  const copiaDoBrann = base.personagens().find((personagem) => personagem.nome === BRANN.nome)
  const doBrann = base.tokens().find((token) => token.characterId === copiaDoBrann?.id)
  if (copiaDoBrann === undefined || doBrann === undefined) throw new Error('sem a ficha do Brann no mapa')
  // O mapa da cena: a ficha cheia de cada vaga (a mesa em memória só guarda id, nome e casa).
  const fichaDaVaga = (vaga: TokenDaVaga): Token => ({ id: vaga.id, characterId: vaga.characterId, name: vaga.name, x: vaga.col * 50 + 25, y: vaga.row * 50 + 25, size: 1, image: null })
  const semPrazo = fichaDaVaga(doBrann)
  const mapa = new Map<string, Token>(base.tokens().map((vaga) => [vaga.id, vaga.id === doBrann.id ? porCondicaoNaFicha(semPrazo, 'Envenenado', [], { turnos: 3, porVez: 4 }) : fichaDaVaga(vaga)]))
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
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  const hp = (): number => Number(mesa.personagens().find((personagem) => personagem.id === copiaDoBrann.id)?.recursos.hp)
  const tokenDoBrann = (): Token => mapa.get(doBrann.id) ?? semPrazo
  return { loja, hp, tokenDoBrann, idDoBrann: copiaDoBrann.id }
}

describe('prazo da mesa na batalha One Piece', () => {
  it('Envenenado 3 x 4: -4 HP no começo de cada vez do Brann (12 no total), desconto no fim, a gota apaga no fim da terceira', () => {
    const { loja, hp, tokenDoBrann, idDoBrann } = batalhaComVeneno()
    const passar = (): void => {
      expect(loja.getState().passarVez(CENA, MESTRE)).toBe(true)
    }
    const vezDoBrann = (): boolean => cartaDaVez(loja.getState().cenas[CENA].turnos)?.personagemId === idDoBrann
    // O Iniciar já abre a vez do Brann (Agilidade 70): a 1ª vida sai aí.
    expect(vezDoBrann()).toBe(true)
    expect(hp()).toBe(296)
    passar() // fim da 1ª: faltam 2
    expect(prazoDaCondicao(tokenDoBrann(), 'Envenenado')?.turnos).toBe(2)
    passar() // Tomás passa: começo da 2ª do Brann
    expect(hp()).toBe(292)
    passar()
    passar() // começo da 3ª
    expect(hp()).toBe(288)
    passar() // fim da 3ª: acabou
    expect(tokenDoBrann().conditions ?? []).not.toContain('envenenado')
    passar()
    expect(vezDoBrann()).toBe(true)
    expect(hp()).toBe(288)
    // A linha do dano diz o motivo.
    expect(loja.getState().cenas[CENA].registro.some((linha) => linha.texto.includes('perde 4 HP (Envenenado)'))).toBe(true)
  })
})
