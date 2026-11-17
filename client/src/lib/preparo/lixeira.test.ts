/**
 * A LIXEIRA DOS VERBETES (17/11): excluir guarda, restaurar devolve, e o lugar
 * de dentro sobe um nível e volta. Tudo inventado (repositório público).
 */
import { describe, expect, it } from 'vitest'
import { verbeteNovo } from './enciclopedia'
import { estaNaLixeira, naLixeira, planoDeApagarDeVez, planoDeMandarParaALixeira, planoDeRestaurar, soOsVivos, vivos } from './lixeira'
import { VERBETE, type TipoDeVerbete, type Verbete } from './tipos'

const QUANDO = '2026-11-17T18:00:00.000Z'

function verbete(tipo: TipoDeVerbete, id: string, paiId?: string): Verbete {
  return verbeteNovo(tipo, `Nome de ${id}`, { campanhas: ['camp-inventada'], ...(paiId === undefined ? {} : { paiId }) }, () => id)
}

function mapa(...lista: Verbete[]): Map<string, Verbete> {
  return new Map(lista.map((um) => [um.id, um]))
}

/** O mapa depois de um plano, como a loja o deixaria. */
function depoisDe(antes: ReadonlyMap<string, Verbete>, mudancas: ReadonlyMap<string, Verbete>): Map<string, Verbete> {
  return new Map([...antes, ...mudancas])
}

/** Reino > Castelo > Torre > Sino, e uma Vila solta. */
function reino(): Map<string, Verbete> {
  return mapa(verbete('lugar', 'reino'), verbete('lugar', 'castelo', 'reino'), verbete('lugar', 'torre', 'castelo'), verbete('lugar', 'sino', 'torre'), verbete('lugar', 'vila'))
}

describe('a lixeira dos verbetes', () => {
  it('excluir marca a data, tira das listas e não muda mais nada no verbete', () => {
    const antes = mapa(verbete('personagem', 'capita'), verbete('item', 'bussola'))
    const plano = planoDeMandarParaALixeira(['capita'], antes, QUANDO)
    const depois = depoisDe(antes, plano.mudancas)

    expect([...plano.mudancas.keys()]).toEqual(['capita'])
    expect(depois.get('capita')).toEqual({ ...antes.get('capita'), lixeira: QUANDO })
    expect(estaNaLixeira(depois.get('capita'))).toBe(true)
    expect(vivos(depois.values()).map((um) => um.id)).toEqual(['bussola'])
    expect([...soOsVivos(depois).keys()]).toEqual(['bussola'])
    expect(naLixeira(depois.values()).map((um) => um.id)).toEqual(['capita'])
    // O arquivo com o campo novo grava e lê igual (o formato fica).
    const excluido = depois.get('capita')
    if (excluido === undefined) throw new Error('faltou o verbete excluído')
    expect(VERBETE.ler(JSON.parse(JSON.stringify(VERBETE.gravar(excluido))), '')).toEqual({ ok: true, valor: excluido })
  })

  it('restaurar (o Desfazer) devolve o verbete igualzinho ao de antes', () => {
    const antes = mapa(verbete('personagem', 'capita'), verbete('item', 'bussola'))
    const naLixeiraAgora = depoisDe(antes, planoDeMandarParaALixeira(['capita', 'bussola'], antes, QUANDO).mudancas)
    const plano = planoDeRestaurar(['capita', 'bussola'], naLixeiraAgora)

    expect(plano.alvos.map((um) => um.id).sort()).toEqual(['bussola', 'capita'])
    expect(depoisDe(naLixeiraAgora, plano.mudancas)).toEqual(antes)
    // Sem ninguém na Lixeira, o mapa dos vivos é o próprio mapa (nada é copiado).
    expect(soOsVivos(antes)).toBe(antes)
  })

  it('o que estava dentro do lugar excluído sobe um nível e volta ao restaurar', () => {
    const antes = reino()
    const plano = planoDeMandarParaALixeira(['castelo'], antes, QUANDO)
    const depois = depoisDe(antes, plano.mudancas)

    // Só o Castelo e a Torre (a de dentro dele) mudam; o Sino continua dentro da Torre.
    expect([...plano.mudancas.keys()].sort()).toEqual(['castelo', 'torre'])
    expect(depois.get('torre')).toMatchObject({ paiId: 'reino', paiNaLixeira: 'castelo' })
    expect(depois.get('sino')).toBe(antes.get('sino'))
    expect(depois.get('castelo')).toMatchObject({ paiId: 'reino', lixeira: QUANDO })

    expect(depoisDe(depois, planoDeRestaurar(['castelo'], depois).mudancas)).toEqual(antes)
  })

  it('lixeira dentro de lixeira: cada lugar volta ao seu, em qualquer ordem de restaurar', () => {
    const antes = reino()
    const semTorre = depoisDe(antes, planoDeMandarParaALixeira(['torre'], antes, QUANDO).mudancas)
    const semCastelo = depoisDe(semTorre, planoDeMandarParaALixeira(['castelo'], semTorre, QUANDO).mudancas)
    // O Sino saiu da Torre e, depois, do Castelo: está no Reino, lembrando da Torre.
    expect(semCastelo.get('sino')).toMatchObject({ paiId: 'reino', paiNaLixeira: 'torre' })
    // A Torre, na Lixeira, guarda o lugar de cima de verdade no `paiId`.
    expect(semCastelo.get('torre')).toMatchObject({ paiId: 'castelo' })
    expect(semCastelo.get('torre')?.paiNaLixeira).toBeUndefined()

    // Primeiro o de fora: o Sino desce para o Castelo (o vivo mais perto da Torre).
    const comCastelo = depoisDe(semCastelo, planoDeRestaurar(['castelo'], semCastelo).mudancas)
    expect(comCastelo.get('sino')).toMatchObject({ paiId: 'castelo', paiNaLixeira: 'torre' })
    expect(depoisDe(comCastelo, planoDeRestaurar(['torre'], comCastelo).mudancas)).toEqual(antes)

    // Primeiro o de dentro: a Torre volta esperando o Castelo, com o Sino dentro.
    const comTorre = depoisDe(semCastelo, planoDeRestaurar(['torre'], semCastelo).mudancas)
    expect(comTorre.get('torre')).toMatchObject({ paiId: 'reino', paiNaLixeira: 'castelo' })
    expect(comTorre.get('sino')?.paiId).toBe('torre')
    expect(depoisDe(comTorre, planoDeRestaurar(['castelo'], comTorre).mudancas)).toEqual(antes)
  })

  it('só leitura, página e sessão não vão para a Lixeira; quem já está lá é ignorado', () => {
    const antes = mapa(verbete('lugar', 'reino'), verbete('pagina', 'caderno'), verbete('sessao', 'sessao-1'), verbete('item', 'bussola'))
    const plano = planoDeMandarParaALixeira(['reino', 'caderno', 'sessao-1', 'bussola', 'nao-existe'], antes, QUANDO, new Map([['reino', 'formato mais novo']]))

    expect([...plano.mudancas.keys()]).toEqual(['bussola'])
    expect(plano.recusados.map(([um, motivo]) => [um.id, motivo])).toEqual([
      ['reino', 'so-leitura'],
      ['caderno', 'tipo'],
      ['sessao-1', 'tipo'],
    ])
    const depois = depoisDe(antes, plano.mudancas)
    expect(planoDeMandarParaALixeira(['bussola'], depois, '2027-01-01T00:00:00.000Z').mudancas.size).toBe(0)
  })

  it('apagar de vez: quem saiu de dentro fica onde está, sem apontar para o que sumiu', () => {
    const antes = reino()
    const semCastelo = depoisDe(antes, planoDeMandarParaALixeira(['castelo'], antes, QUANDO).mudancas)
    const mudancas = planoDeApagarDeVez('castelo', semCastelo)

    expect(mudancas?.get('torre')).toEqual({ ...antes.get('torre'), paiId: 'reino' })
    expect(mudancas?.has('castelo')).toBe(false)
    // Só se apaga de vez o que está na Lixeira.
    expect(planoDeApagarDeVez('reino', semCastelo)).toBeNull()
  })

  it('apagar de vez no meio de duas lixeiras: o de dentro passa a esperar o de cima', () => {
    const antes = reino()
    const semTorre = depoisDe(antes, planoDeMandarParaALixeira(['torre'], antes, QUANDO).mudancas)
    const semCastelo = depoisDe(semTorre, planoDeMandarParaALixeira(['castelo'], semTorre, QUANDO).mudancas)
    const semATorreDeVez = depoisDe(semCastelo, planoDeApagarDeVez('torre', semCastelo) ?? new Map())
    semATorreDeVez.delete('torre')

    expect(semATorreDeVez.get('sino')).toMatchObject({ paiId: 'reino', paiNaLixeira: 'castelo' })
    const comCastelo = depoisDe(semATorreDeVez, planoDeRestaurar(['castelo'], semATorreDeVez).mudancas)
    expect(comCastelo.get('sino')).toEqual({ ...antes.get('sino'), paiId: 'castelo' })
  })
})
