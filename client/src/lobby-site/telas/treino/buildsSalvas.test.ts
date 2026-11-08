import { afterEach, describe, expect, it } from 'vitest'
import { SISTEMA_ONE_PIECE } from '../../../lib/sistemaOnePiece'
import { ze } from '../../../lib/treino/fichasDeTreino.testkit'
import { ajustesPadraoDoJuiz, fichaDoJuiz, ID_DO_JUIZ } from '../../../lib/treino/juiz'
import { baseDoJuiz, BUILDS_MAX, buildDesligada, comBuild, diferencaDoJuiz, guardarBuilds, juizDaBuild, lerBuilds, rascunhoDaBuild, type BuildSalva, type DiferencaDaBuild } from './buildsSalvas'
import { comRascunho } from './rascunhoDeTreino'

/**
 * As builds salvas do treino (F1 da Arena multijogador, 07/11/2026): um
 * rascunho com nome, guardado só neste navegador, por mesa e por conta, como
 * a DIFERENÇA sobre a ficha de base. A build vira o rascunho da minha ficha ou
 * o Judge (o boneco, ou a cópia da ficha de alguém); base fora da mesa desliga.
 */

const CAMPANHA = 'camp_1'
const CONTA = 'conta_pedro'
const FORCA: DiferencaDaBuild = { atributos: { forca: 90 }, maximos: { hp: 500 }, recursos: {}, tecnicas: [] }

afterEach(() => {
  window.localStorage.clear()
})

function salvar(builds: readonly BuildSalva[], nome: string, agora: number): BuildSalva[] {
  const resultado = comBuild(builds, nome, { tipo: 'minha', fichaId: 'pers_ze' }, FORCA, agora)
  if (!resultado.ok) throw new Error(`não salvou: ${resultado.motivo}`)
  return resultado.builds
}

describe('builds salvas', () => {
  it('guarda por mesa e conta, troca a de mesmo nome, recusa a 31ª e deixa de fora só a build torta', () => {
    // Arrange: duas builds; a segunda repete o nome da primeira com outra caixa e espaços.
    const uma = salvar([], 'Força total', 1_000)
    const trocada = comBuild(uma, '  força   TOTAL ', { tipo: 'minha', fichaId: 'pers_ze' }, { ...FORCA, atributos: { forca: 95 } }, 2_000)
    if (!trocada.ok) throw new Error('não trocou')

    // Act: guarda e relê; outra conta, outra mesa e a demo não veem nada.
    expect(guardarBuilds(CAMPANHA, CONTA, false, trocada.builds)).toBe(true)
    const relidas = lerBuilds(CAMPANHA, CONTA, false)

    // Assert
    expect(trocada.trocou).toBe(true)
    expect(relidas).toEqual(trocada.builds)
    expect(relidas).toHaveLength(1)
    expect(relidas[0]).toMatchObject({ id: uma[0].id, nome: 'força TOTAL', atributos: { forca: 95 }, salvoEm: 2_000 })
    expect(lerBuilds(CAMPANHA, 'conta_vagn', false)).toEqual([])
    expect(lerBuilds('camp_2', CONTA, false)).toEqual([])
    expect(lerBuilds(CAMPANHA, CONTA, true)).toEqual([])

    let cheia: BuildSalva[] = []
    for (let n = 1; n <= BUILDS_MAX; n += 1) cheia = salvar(cheia, `Build ${n}`, n)
    expect(comBuild(cheia, 'A trigésima primeira', { tipo: 'juiz', fichaId: ID_DO_JUIZ }, FORCA, 99)).toEqual({ ok: false, motivo: 'cheia' })
    expect(comBuild(cheia, 'Build 7', { tipo: 'minha', fichaId: 'pers_ze' }, FORCA, 99).ok).toBe(true)
    expect(comBuild([], '   ', { tipo: 'minha', fichaId: 'pers_ze' }, FORCA, 99)).toEqual({ ok: false, motivo: 'sem-nome' })

    const boa = relidas[0]
    window.localStorage.setItem(`labirinto.lobby.builds.${CAMPANHA}.${CONTA}`, JSON.stringify({ versao: 1, builds: [{ ...boa, id: 'b9', atributos: { forca: -1 } }, boa, { ...boa, nome: 'x'.repeat(41) }] }))
    expect(lerBuilds(CAMPANHA, CONTA, false)).toEqual([boa])
  })

  it('vira o Judge cópia do Zé com a diferença por cima, vira o rascunho da ficha, e a base fora da mesa desliga', () => {
    // Arrange: o Judge copia o Zé (Força 60, HP 300) com a vida e a Força mudadas.
    const zeNaMesa = ze(60)
    const ajustes = { ...ajustesPadraoDoJuiz(), baseFichaId: zeNaMesa.id, hp: 900, atributos: { forca: 80 } }
    const guardada = comBuild([], 'Zé tanque', baseDoJuiz(ajustes, () => false), diferencaDoJuiz(ajustes, SISTEMA_ONE_PIECE), 1)
    if (!guardada.ok) throw new Error('não salvou')

    // Act
    const noJuiz = juizDaBuild(guardada.build, SISTEMA_ONE_PIECE, { ...ajustesPadraoDoJuiz(), reage: 'parado' }, 2)
    const ficha = fichaDoJuiz(SISTEMA_ONE_PIECE, noJuiz, zeNaMesa)
    const semBase = fichaDoJuiz(SISTEMA_ONE_PIECE, noJuiz, null)
    const daMinha = rascunhoDaBuild({ ...guardada.build, base: { tipo: 'minha', fichaId: zeNaMesa.id } }, 3)

    // Assert: só a diferença foi guardada; o resto vem do Zé como está.
    expect(guardada.build).toMatchObject({ base: { tipo: 'colega', fichaId: 'pers_ze' }, atributos: { forca: 80 }, maximos: { hp: 900 }, recursos: {} })
    expect(noJuiz).toMatchObject({ baseFichaId: 'pers_ze', hp: 900, sp: null, escudo: null, reage: 'parado' })
    expect(ficha).toMatchObject({ id: ID_DO_JUIZ, nome: 'Cópia de Zé', atributos: { forca: 80, agilidade: 40 }, maximos: { hp: 900, sp: 100 }, recursos: { hp: 900 } })
    expect(ficha.abas.habilidades?.map((cartao) => cartao.id)).toContain('tec_corte')
    expect(zeNaMesa).toEqual(ze(60))
    // O Zé saiu da mesa: o Judge volta ao boneco padrão (os números eram do Zé) e a build fica desligada.
    expect(semBase).toMatchObject({ id: ID_DO_JUIZ, maximos: { hp: 100 } })
    expect(semBase.atributos.forca ?? 0).toBe(0)
    expect(buildDesligada(guardada.build, (fichaId) => fichaId === 'pers_lia')).toBe(true)
    expect(buildDesligada(guardada.build, (fichaId) => fichaId === 'pers_ze')).toBe(false)
    expect(buildDesligada({ ...guardada.build, base: { tipo: 'juiz', fichaId: ID_DO_JUIZ } }, () => false)).toBe(false)
    expect(comRascunho(zeNaMesa, daMinha)).toMatchObject({ id: 'pers_ze', atributos: { forca: 80 }, maximos: { hp: 900 } })
  })
})
