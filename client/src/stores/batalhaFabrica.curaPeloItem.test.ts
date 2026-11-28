// @vitest-environment node
/**
 * A CURA TIRA O VENENO na batalha One Piece (`lib/curaPeloItem.ts`): a
 * Medicina do Harvey gasta 1 Kit Médico para curar, então tira o Envenenado
 * da armadilha (pastilha e prazo) da ficha curada no mapa; o Vulnerável fica, e o
 * Desfazer da linha devolve o veneno como estava. Mesa com mapa
 * (`fichaDaCena`/`mudarFichaDaCena`), como em `batalhaFabrica.prazoDaMesa.test`.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { harveyCom, MEDICINA } from '../lib/batalha/fichasDaFatiaF.testkit'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { fichaTemCondicao } from '../lib/condicaoPorNome'
import { porCondicaoNaFicha, prazoDaCondicao } from '../lib/prazoDaCondicao'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type TokenDaVaga } from '../lib/treino/mesaEmMemoria'
import type { Token } from '../types/map'
import { criarBatalhaStore } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const PIRATA = ficha('Pirata 1', { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }, { hp: 500, sp: 50, escudo: 0 }, {})

function batalhaDoHarveyEnvenenado() {
  const base = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: harveyCom({ hp: 500, sp: 60, escudo: 40 }), lado: 'a' }, { ficha: PIRATA, lado: 'b' }]))
  // A mesa em memória joga com CÓPIAS das fichas (id novo): o Harvey é achado pelo nome.
  const copia = base.personagens().find((personagem) => personagem.nome === 'Harvey Solferino')
  const vaga = base.tokens().find((token) => token.characterId === copia?.id)
  if (vaga === undefined) throw new Error('sem a ficha do Harvey no mapa')
  const fichaDaVaga = (de: TokenDaVaga): Token => ({ id: de.id, characterId: de.characterId, name: de.name, x: de.col * 50 + 25, y: de.row * 50 + 25, size: 1, image: null })
  const cobra = porCondicaoNaFicha(fichaDaVaga(vaga), 'Envenenado', [], { turnos: 3, porVez: 4 })
  // Rodada 3 (28/11/2026): era o Lento; desde que a pastilha vale já na 1ª vez, o Lento barra a Medicina (Completa).
  const picado = porCondicaoNaFicha(cobra, 'Vulnerável', [], { turnos: 2 })
  const mapa = new Map<string, Token>(base.tokens().map((de) => [de.id, de.id === vaga.id ? picado : fichaDaVaga(de)]))
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
  const doHarvey = (): Token => mapa.get(vaga.id) ?? picado
  return { loja, doHarvey, tokenId: vaga.id }
}

describe('a Medicina (Kit Médico) tira o Envenenado na batalha', () => {
  it('o Envenenado sai da ficha curada, o Vulnerável fica; a nota diz; o Desfazer da linha devolve o veneno', () => {
    const { loja, doHarvey, tokenId } = batalhaDoHarveyEnvenenado()
    // Passa a vez até a do Harvey.
    for (let i = 0; i < 4; i += 1) {
      const turnos = loja.getState().cenas[CENA]?.turnos
      if (turnos === undefined || turnos.vez === null) throw new Error('sem vez')
      if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.tokenId === tokenId) break
      expect(loja.getState().passarVez(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada })).toBe(true)
    }
    const turnos = loja.getState().cenas[CENA]?.turnos
    if (turnos === undefined || turnos.vez === null) throw new Error('sem a vez do Harvey')
    const prazoAntes = prazoDaCondicao(doHarvey(), 'Envenenado')
    expect(prazoAntes).not.toBeNull()
    const medicina = { tipo: 'habilidade' as const, cartaoId: MEDICINA.id, armaId: null, alvos: [{ tokenId, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null }
    expect(loja.getState().agir(CENA, MESTRE, { cartaId: turnos.vez, rodada: turnos.rodada }, medicina)).toBe(true)
    expect(fichaTemCondicao(doHarvey(), 'Envenenado')).toBe(false)
    expect(prazoDaCondicao(doHarvey(), 'Envenenado')).toBeNull()
    expect(fichaTemCondicao(doHarvey(), 'Vulnerável')).toBe(true)
    expect(prazoDaCondicao(doHarvey(), 'Vulnerável')).not.toBeNull()
    const cena = loja.getState().cenas[CENA]
    const nota = (cena?.turnos.golpes ?? []).flatMap((golpe) => golpe.alvos.map((alvo) => alvo.nota ?? ''))
    const linha = cena?.registro.at(-1)
    expect([...nota, ...(cena?.registro.map((uma) => uma.texto) ?? [])].join(' | ')).toContain('gastou 1 Kit Médico, tirou Envenenado')
    if (linha === undefined) throw new Error('sem a linha da Medicina')
    expect(loja.getState().desfazer(CENA, linha.id, MESTRE)).toBe(true)
    expect(fichaTemCondicao(doHarvey(), 'Envenenado')).toBe(true)
    expect(prazoDaCondicao(doHarvey(), 'Envenenado')).toEqual(prazoAntes)
  })
})
