// @vitest-environment node
/**
 * Fase C, item 4: o prazo da mesa NA BATALHA One Piece (`prazosDaVez`). Com
 * uma mesa que tem mapa (`fichaDaCena`/`mudarFichaDaCena`), o Envenenado 3 x 4
 * tira 4 HP no começo de cada vez da ficha (12 no total, direto, como fora
 * da batalha), desconta no fim da vez e apaga no fim da terceira.
 * Rework das condições (D3, aa1de8d0): o Envenenado ganhou regra de fábrica, então o espelho da pastilha
 * pede o "Aplicar / pular" ao mestre (PLANO.md, "o Aplicar tira"), e o prazo não tira sozinho por cima.
 * Os 4 por vez saem pelo Aplicar do lembrete. Rodada 3 (28/11/2026): também na vez que o Iniciar abre (o
 * espelho já nasce no Iniciar); antes o prazo tirava sozinho nela.
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
    /** O mestre clica Aplicar no lembrete do Envenenado do Brann, que toda vez dele pede (4, o do prazo). */
    const aplicarOVeneno = (): void => {
      const turnos = loja.getState().cenas[CENA].turnos
      const lembrete = (turnos.combate?.[idDoBrann]?.lembretes ?? []).find((candidato) => candidato.porVez?.nome === 'Envenenado')
      expect(lembrete?.porVez?.dano).toBe(4)
      const tokenId = cartaDaVez(turnos)?.tokenId ?? ''
      expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId, cartaoId: lembrete?.cartaoId ?? '', aplicar: true })).toBe(true)
    }
    // O Iniciar já abre a vez do Brann (Agilidade 70): a 1ª vida espera o Aplicar, como nas outras vezes (não sai sozinha).
    expect(vezDoBrann()).toBe(true)
    expect(hp()).toBe(300)
    aplicarOVeneno()
    expect(hp()).toBe(296)
    passar() // fim da 1ª: faltam 2
    expect(prazoDaCondicao(tokenDoBrann(), 'Envenenado')?.turnos).toBe(2)
    passar() // Tomás passa: começo da 2ª do Brann
    aplicarOVeneno()
    expect(hp()).toBe(292)
    passar()
    passar() // começo da 3ª
    aplicarOVeneno()
    expect(hp()).toBe(288)
    passar() // fim da 3ª: acabou
    expect(tokenDoBrann().conditions ?? []).not.toContain('envenenado')
    passar()
    expect(vezDoBrann()).toBe(true)
    expect(hp()).toBe(288)
    // Os 12 saíram só pelos 3 Aplicar (uma linha cada); o prazo não tirou nenhuma vez por cima (nem no Iniciar).
    const textos = loja.getState().cenas[CENA].registro.map((linha) => linha.texto)
    expect([textos.filter((texto) => texto.includes('-4 HP')).length, textos.some((texto) => texto.includes('perde 4 HP (Envenenado)'))]).toEqual([3, false])
  })
})
