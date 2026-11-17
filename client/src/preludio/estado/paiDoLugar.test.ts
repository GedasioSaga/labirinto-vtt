/**
 * LUGARES EM REGIÕES (16/11): pôr um lugar dentro de outro muda só o `paiId`
 * do arquivo dele, pela gravação de sempre, e nunca cria laço; o arquivo de
 * antes lê igual e se organiza como a árvore de antes. O disco é de mentira e
 * os lugares, inventados (repositório público).
 */
import { afterEach, expect, it, vi } from 'vitest'
import { arvoreDe, verbeteNovo, type NoDaArvore } from '../../lib/preparo/enciclopedia'
import { comPai, organizarLugares, planoDeMudarDePai } from '../../lib/preparo/lugaresEmRegioes'
import { VERBETE, type Verbete } from '../../lib/preparo/tipos'

const disco = new Map<string, Verbete>()

vi.mock('../../lib/preparo/disco', () => ({
  lerIndiceDoPreparo: vi.fn(async () => ({ estado: 'novo' })),
  listarNoPreparo: vi.fn(async () => [...disco.keys()].sort()),
  lerVerbete: vi.fn(async (id: string) => {
    const verbete = disco.get(id)
    return verbete === undefined ? { estado: 'novo' } : { estado: 'ok', valor: structuredClone(verbete), aviso: null }
  }),
  gravarVerbete: vi.fn(async (verbete: Verbete) => {
    disco.set(verbete.id, structuredClone(verbete))
  }),
  lerTempo: vi.fn(async () => ({ estado: 'novo' })),
  gravarTempo: vi.fn(async () => undefined),
}))

vi.mock('../midia', () => ({ prepararMidia: vi.fn(async () => null) }))

const { usePreludio } = await import('./preludio')

function lugar(id: string, titulo: string, paiId?: string): Verbete {
  return verbeteNovo('lugar', titulo, { campanhas: ['camp-inventada'], ...(paiId === undefined ? {} : { paiId }) }, () => id)
}

/** O que a tela faz ao soltar: o plano decide, a loja muda e agenda a gravação. */
function porDentro(ids: readonly string[], destino: string | null) {
  const { verbetes, soLeitura, mudarVerbete } = usePreludio.getState()
  const plano = planoDeMudarDePai(ids, destino, verbetes, soLeitura)
  for (const umLugar of plano.mudam) mudarVerbete(umLugar.id, (agora) => comPai(agora, destino))
  return plano
}

function idsEmOrdem(nos: readonly NoDaArvore[]): string[] {
  return nos.flatMap((no) => [no.verbete.id, ...idsEmOrdem(no.filhos)])
}

afterEach(async () => {
  await usePreludio.getState().fechar()
  disco.clear()
})

it('pôr um lugar dentro de outro grava só o paiId; o laço e o "dentro dele mesmo" são recusados sem tocar no disco', async () => {
  const ilhaAntes = lugar('vb-ilha', 'Ilha Inventada')
  for (const umLugar of [lugar('vb-reino', 'Reino Inventado'), lugar('vb-castelo', 'Castelo', 'vb-reino'), lugar('vb-salao', 'Salão', 'vb-castelo'), ilhaAntes]) disco.set(umLugar.id, umLugar)
  await usePreludio.getState().carregar()

  expect(porDentro(['vb-ilha'], 'vb-castelo').mudam.map((umLugar) => umLugar.id)).toEqual(['vb-ilha'])
  const laco = porDentro(['vb-reino'], 'vb-salao')
  expect([laco.mudam, laco.recusados.map(([umLugar, motivo]) => [umLugar.id, motivo])]).toEqual([[], [['vb-reino', 'dentro-dele']]])
  expect(porDentro(['vb-castelo'], 'vb-castelo').recusados.map(([, motivo]) => motivo)).toEqual(['ele-mesmo'])
  expect(porDentro(['vb-castelo'], null).mudam.map((umLugar) => umLugar.id)).toEqual(['vb-castelo'])

  expect(await usePreludio.getState().salvarPendentes()).toBe(true)
  const { paiId, ...ilhaSemPai } = disco.get('vb-ilha') ?? ilhaAntes
  expect([paiId, ilhaSemPai]).toEqual(['vb-castelo', ilhaAntes])
  expect(Object.hasOwn(disco.get('vb-castelo') ?? {}, 'paiId')).toBe(false)
  expect(disco.get('vb-reino')?.paiId).toBeUndefined()
  expect(disco.get('vb-salao')?.paiId).toBe('vb-castelo')
  // O Reino ficou sem nada dentro (vai para "Sem região"); o Castelo virou região com o Salão e a Ilha.
  const depois = organizarLugares([...disco.values()])
  expect(depois.regioes.map((regiao) => [regiao.id, regiao.nivel])).toEqual([['vb-castelo', 0]])
  expect(depois.dentroDe.get('vb-castelo')).toBe(2)
})

it('o arquivo de lugar de antes lê igual, organiza como a árvore de antes e o Desfazer devolve o mesmo arquivo', () => {
  const doDisco = (titulo: string, id: string, paiId?: string) => ({
    formato: 1,
    id,
    tipo: 'lugar',
    titulo,
    apelidos: [],
    campanhas: ['camp-inventada'],
    ...(paiId === undefined ? {} : { paiId }),
    organizacao: ['Cenários'],
    formas: [{ id: `${id}-f1`, nome: 'Dia', resumo: '', secoes: [], imagens: [{ midia: 'midia/abcdef0123456789.png', legenda: 'Portão' }] }],
    formaAtivaId: `${id}-f1`,
    campoDeOutraVersao: { fica: true },
  })
  const brutos = [doDisco('Reino Inventado', 'vb-reino'), doDisco('Castelo', 'vb-castelo', 'vb-reino'), doDisco('Cais', 'vb-cais', 'vb-reino'), doDisco('Farol Solto', 'vb-farol')]
  const lidos = brutos.map((bruto) => {
    const leitura = VERBETE.ler(bruto, '')
    if (!leitura.ok) throw new Error(leitura.motivo)
    return leitura.valor
  })
  expect(lidos.map((lido) => VERBETE.gravar(lido))).toEqual(brutos)

  const organizados = organizarLugares(lidos)
  expect(organizados.emOrdem.map((lido) => lido.id)).toEqual(idsEmOrdem(arvoreDe(lidos)))
  expect([organizados.caminhoDe.get('vb-castelo'), organizados.regioes.map((regiao) => regiao.id)]).toEqual([['Reino Inventado'], ['vb-reino']])

  const castelo = lidos[1]
  if (castelo === undefined) throw new Error('sem castelo')
  expect(VERBETE.gravar(comPai(comPai(castelo, null), 'vb-reino'))).toEqual(brutos[1])
})
