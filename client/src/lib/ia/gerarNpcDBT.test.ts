/**
 * GERAR NPC DO DRAGON BALL (lib/ia/gerarNpcDBT.ts) de ponta a ponta, sem
 * rede: a resposta GRAVADA da IA entra pela porta do Rust (`invoke`
 * 'ia_gerar', mockado), vira `FichaDBT` que `lerFichaDBT` aceita igual, e PV,
 * PK e técnicas batem com lib/dbt/regras. Depois a borda: resposta truncada,
 * JSON inválido, número fora dos tetos, raça que não existe, técnica que
 * estoura o orçamento do rank e texto com HTML/script, que fica texto (nunca
 * vira elemento na tela de revisão).
 */
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn<(comando: string, argumentos?: Record<string, unknown>) => Promise<unknown>>()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (comando: string, argumentos?: Record<string, unknown>) => invoke(comando, argumentos),
  isTauri: () => true,
}))

const { esquemaDoNpcDBT, gerarNpcDBTNaIa, personagemDaIaDBT } = await import('./gerarNpcDBT')
const { ErroDaIa, MODELO_PADRAO } = await import('./portaDaIa')
const { SISTEMA_DRAGON_BALL } = await import('../dbt/sistemaDragonBall')
// O livro entra no sistema só pelo app do mestre (caça 12/11/2026, O7): o teste faz o que o `src/main.tsx` faz.
await import('../dbt/livroDoApp')
const { LIMITES_DBT, lerFichaDBT } = await import('../dbt/modelo')
const { ROTULOS } = await import('../dbt/dados/rotulos')
const { RACAS } = await import('../dbt/dados/racas')
const { RANKS_DE_TECNICA } = await import('../dbt/dados/ranks')
const { VIDA_POR_GOLPE } = await import('../dbt/dados/tabelas')
const { catalogoDeRotulos, indexarRanks, montarTecnica } = await import('../dbt/regras/tecnicas')
const { derivadosDaFicha, pkMaximo, pvMaximo } = await import('../dbt/regras/ficha')
const { transformacaoDoCatalogo } = await import('../dbt/regras/transformacoes')
const { NUMERO_DA_FICHA_MAX } = await import('../ajusteDaFicha')
const { PERSONAGEM_NOME_MAX, PERSONAGEM_TEXTO_MAX } = await import('../../net/protocoloDoPersonagem')

type NpcDaIa = ReturnType<typeof personagemDaIaDBT>
type NpcOk = Extract<NpcDaIa, { ok: true }>

const RANKS_DO_LIVRO = indexarRanks(RANKS_DE_TECNICA)
const ROTULOS_POR_ID = catalogoDeRotulos(ROTULOS)
const SAIYAJIN = RACAS.find((raca) => raca.id === 'saiyajin')

/**
 * A resposta da IA como o Gemini a devolve com `responseSchema`: o JSON do
 * `esquemaDoNpcDBT`, em texto. Um Raditz elite de rank D com duas técnicas
 * que cabem no orçamento, uma acima do rank do NPC, a forma da raça e uma passiva.
 */
const GRAVADA = {
  nome: 'Raditz',
  descricao: 'Saiyajin de cabelo longo que veio buscar o irmão.',
  personalidade: 'Arrogante e impaciente.',
  raca: 'saiyajin',
  variante: 'saiyajin-puro',
  categoria: 'elite',
  rank: 'D',
  nd: 3,
  ep: 2,
  atributos: { for: 18, des: 14, con: 14, int: 8, sab: 10, pod: 12, pre: 10 },
  pericias: ['atletismo', 'intimidacao'],
  tecnicas: [
    {
      nome: 'Double Sunday',
      rank: 'D',
      tipo: 'ki',
      efeito: 'dano',
      alcance: '',
      descricao: 'Duas esferas roxas, uma de cada mão.',
      rotulos: [{ id: 'alcance-projetil', pontos: 1 }, { id: 'dano-potente' }, { id: 'concentracao' }],
    },
    { nome: 'Saturday Crush', rank: 'C', tipo: 'ki', descricao: 'Uma esfera só, à queima-roupa.', rotulos: [{ id: 'aumentar-dano-por-ki', investimento: 99 }] },
  ],
  transformacoes: [{ id: 'super-saiyajin-estagio-1', nome: 'Super Saiyajin', estagio: 1, efeitos: 'Cabelo dourado.' }],
  passivas: [{ nome: 'Orgulho Saiyajin', efeito: '+1 em Intimidação contra quem é mais fraco.' }],
}

function gerar(resposta: unknown): NpcDaIa {
  return personagemDaIaDBT(typeof resposta === 'string' ? resposta : JSON.stringify(resposta), SISTEMA_DRAGON_BALL)
}

function gerarOk(resposta: unknown): NpcOk {
  const npc = gerar(resposta)
  if (!npc.ok) throw new Error(`a resposta deveria virar NPC: ${npc.erro}`)
  return npc
}

/** A mesma resposta com uma técnica só, no lugar das gravadas. */
function comTecnicas(tecnicas: unknown[]): Record<string, unknown> {
  return { ...GRAVADA, tecnicas }
}

/** Todo campo que vira id, chave ou referência de catálogo na ficha (onde texto cru viraria estrutura). */
function camposDeId(valor: unknown, achados: string[] = []): string[] {
  if (Array.isArray(valor)) {
    for (const item of valor) camposDeId(item, achados)
  } else if (valor !== null && typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      if (['id', 'rotuloId', 'raca', 'variante', 'livroId', 'prontoId', 'transformacaoAtiva'].includes(chave) && typeof filho === 'string') achados.push(filho)
      camposDeId(filho, achados)
    }
  }
  return achados
}

beforeEach(() => {
  invoke.mockReset()
})

describe('gerarNpcDBTNaIa: a resposta gravada de ponta a ponta, sem rede', () => {
  it('pede pela porta ia_gerar com o esquema e o livro, e devolve a ficha da resposta', async () => {
    invoke.mockResolvedValueOnce({ texto: JSON.stringify(GRAVADA), trocouPara: 1 })

    const { npc, trocouPara } = await gerarNpcDBTNaIa({
      descricao: 'Um saiyajin arrogante que chega de nave.',
      nivel: 'chefe',
      sistema: SISTEMA_DRAGON_BALL,
      personagens: [],
      grupoDoComparar: [],
      modelo: MODELO_PADRAO,
    })

    expect(invoke).toHaveBeenCalledTimes(1)
    const [comando, argumentos] = invoke.mock.calls[0]
    expect(comando).toBe('ia_gerar')
    const pedido = (argumentos as { pedido: { texto: string; systemPrompt: string; esquemaResposta: unknown } }).pedido
    expect(pedido.esquemaResposta).toEqual(esquemaDoNpcDBT())
    expect(pedido.texto).toContain('PEDIDO DO MESTRE: Um saiyajin arrogante que chega de nave.')
    // Os capítulos de NPC e de técnica estão no livro embutido: o pedido não cai no "(o livro não abriu...)".
    expect(pedido.texto).not.toContain('o livro não abriu')
    expect(pedido.systemPrompt).toContain('Dragon Ball Tales')
    expect(trocouPara).toBe(1)
    expect(npc.ok).toBe(true)
    if (npc.ok) expect(npc.personagem.nome).toBe('Raditz')
  })

  it('erro da porta (cota esgotada) chega como ErroDaIa, sem virar NPC', async () => {
    invoke.mockRejectedValueOnce({ codigo: 'cota_esgotada', mensagem: 'A cota acabou em todas as chaves.' })
    const entrada = { descricao: 'x', nivel: 'nivel' as const, sistema: SISTEMA_DRAGON_BALL, personagens: [], grupoDoComparar: [], modelo: MODELO_PADRAO }
    const falha = await gerarNpcDBTNaIa(entrada).catch((erro: unknown) => erro)
    expect(falha).toBeInstanceOf(ErroDaIa)
    expect((falha as InstanceType<typeof ErroDaIa>).codigo).toBe('cota_esgotada')
  })

  it('porta que devolve algo sem texto vira resposta_invalida, nunca NPC vazio', async () => {
    invoke.mockResolvedValueOnce({ outra: 'coisa' })
    const entrada = { descricao: 'x', nivel: 'nivel' as const, sistema: SISTEMA_DRAGON_BALL, personagens: [], grupoDoComparar: [], modelo: MODELO_PADRAO }
    await expect(gerarNpcDBTNaIa(entrada)).rejects.toMatchObject({ codigo: 'resposta_invalida' })
  })
})

describe('personagemDaIaDBT: a resposta gravada vira uma FichaDBT válida', () => {
  it('a ficha é a que lerFichaDBT lê: reler pelo disco/rede dá a mesma ficha', () => {
    const { personagem } = gerarOk(GRAVADA)
    const ficha = personagem.dbt
    expect(ficha).toBeDefined()
    expect(lerFichaDBT(JSON.parse(JSON.stringify(ficha)))).toEqual(ficha)
  })

  it('raça, variante, bloco de NPC, EP, perícias, forma do livro e passiva vêm da resposta', () => {
    const { personagem, raca, notacao, observacoes } = gerarOk(GRAVADA)
    const ficha = personagem.dbt
    if (ficha === undefined || SAIYAJIN === undefined) throw new Error('ficha ou raça do catálogo faltando')
    expect(personagem.tipo).toBe('npc')
    expect(raca).toBe('Saiyajin')
    expect(ficha.raca).toBe('saiyajin')
    expect(ficha.variante).toBe('saiyajin-puro')
    expect(ficha.epInicial).toBe(2)
    expect(ficha.periciasTreinadas).toEqual(['atletismo', 'intimidacao'])
    expect(ficha.npc).toMatchObject({ nd: 3, categoria: 'elite', rank: 'D', prontoId: null })
    expect(ficha.npc?.passivas.map((passiva) => passiva.nome)).toEqual(['Orgulho Saiyajin'])
    expect(notacao).toBe('ND 3 – Rank D (Elite)')
    const forma = SAIYAJIN.transformacoes.find((candidata) => candidata.id === 'super-saiyajin-estagio-1')
    if (forma === undefined) throw new Error('Super Saiyajin Estágio 1 sumiu do catálogo')
    // Forma da raça: os números impressos do livro, nunca os da IA.
    expect(ficha.transformacoes).toEqual([{ ...transformacaoDoCatalogo(forma, 'Saiyajin'), id: ficha.transformacoes[0].id }])
    // Atributos dentro da distribuição de Elite: nenhum aviso de boa prática.
    expect(observacoes.filter((texto) => texto.includes('Elite'))).toEqual([])
  })

  it('PV = ND × vida por golpe (3 × 32 = 96) e PK = POD × 2 (24): o que lib/dbt/regras calcula, e nascem cheios', () => {
    const { personagem } = gerarOk(GRAVADA)
    const ficha = personagem.dbt
    if (ficha === undefined || SAIYAJIN === undefined || RANKS_DO_LIVRO === null) throw new Error('catálogo faltando')
    const atributos = personagem.atributos
    expect(atributos).toMatchObject(GRAVADA.atributos)
    const derivados = derivadosDaFicha(ficha, atributos, { raca: SAIYAJIN, ranks: RANKS_DO_LIVRO, vidaPorGolpe: VIDA_POR_GOLPE })
    expect(personagem.maximos).toEqual({ pv: 96, pk: 24 })
    expect(personagem.maximos).toEqual({ pv: derivados.pvMax.valor, pk: derivados.pkMax.valor })
    expect(pvMaximo(ficha, atributos, SAIYAJIN, VIDA_POR_GOLPE).valor).toBe(96)
    expect(pkMaximo(ficha, atributos).valor).toBe(24)
    expect(personagem.recursos).toMatchObject({ pv: 96, pk: 24 })
  })

  it('toda técnica que fica passa no montador do livro; a acima do rank do NPC desce para o rank dele', () => {
    const { personagem, observacoes } = gerarOk(GRAVADA)
    const ficha = personagem.dbt
    if (ficha === undefined || RANKS_DO_LIVRO === null) throw new Error('catálogo faltando')
    expect(ficha.tecnicas.map((tecnica) => [tecnica.nome, tecnica.rank, tecnica.tipo])).toEqual([
      ['Double Sunday', 'D', 'ki'],
      ['Saturday Crush', 'D', 'ki'],
    ])
    for (const tecnica of ficha.tecnicas) {
      const montada = montarTecnica(tecnica, { rank: RANKS_DO_LIVRO[tecnica.rank], rotulos: ROTULOS_POR_ID })
      expect(montada.valida, `${tecnica.nome}: ${montada.avisos.map((aviso) => aviso.texto).join(' | ')}`).toBe(true)
    }
    expect(observacoes).toContain('«Saturday Crush»: o rank C passava do rank do NPC; ficou D.')
    // Investimento de 99 Ki: preso ao que ainda soma dano no rank D ((46 − 26) / 4 = 5).
    expect(ficha.tecnicas[1].rotulos).toEqual([{ rotuloId: 'aumentar-dano-por-ki', pontosExtras: 0, variavel: null, investimento: 5, nota: '' }])
  })
})

describe('personagemDaIaDBT: resposta truncada ou que não é JSON', () => {
  const ILEGIVEL = 'A IA não devolveu uma ficha legível. Tente gerar de novo.'

  it.each([
    ['truncada no meio', JSON.stringify(GRAVADA).slice(0, 180)],
    ['cortada um caractere antes do fim', JSON.stringify(GRAVADA).slice(0, -1)],
    ['vazia', ''],
    ['só espaço', '   \n'],
    ['em bloco de markdown', `\`\`\`json\n${JSON.stringify(GRAVADA)}\n\`\`\``],
    ['texto solto', 'Claro! Aqui está o seu NPC: Raditz.'],
    ['lista em vez de objeto', JSON.stringify([GRAVADA])],
    ['null', 'null'],
    ['número', '42'],
    ['string JSON', JSON.stringify('Raditz')],
  ])('%s: erro legível, sem lançar', (_caso, texto) => {
    expect(() => gerar(texto)).not.toThrow()
    expect(gerar(texto)).toEqual({ ok: false, erro: ILEGIVEL })
  })

  it('objeto sem atributo e sem técnica é "ficha vazia", não um NPC de 8 em tudo', () => {
    expect(gerar({})).toEqual({ ok: false, erro: 'A IA devolveu uma ficha vazia. Descreva o NPC com mais detalhe e gere de novo.' })
    expect(gerar({ nome: 'Só nome', atributos: { for: 'dezoito' }, tecnicas: 'nenhuma' })).toMatchObject({ ok: false })
  })
})

describe('personagemDaIaDBT: números e textos fora dos tetos', () => {
  it('ND, EP e atributos presos às faixas; número que não é finito (1e400) cai no padrão', () => {
    const texto = JSON.stringify({ ...GRAVADA, nd: 0, ep: 500, atributos: { ...GRAVADA.atributos, for: 1e12, des: -5, con: 13.6, int: '18' } }).replace('"nd":0', '"nd":1e400')
    const { personagem } = gerarOk(texto)
    expect(personagem.dbt?.npc?.nd).toBe(3)
    expect(personagem.dbt?.epInicial).toBe(100)
    expect(personagem.atributos).toMatchObject({ for: NUMERO_DA_FICHA_MAX, des: 1, con: 14, int: 8 })
    expect(gerarOk({ ...GRAVADA, nd: 99_999, ep: -3 }).personagem.dbt).toMatchObject({ epInicial: 0, npc: { nd: 1000 } })
    expect(gerarOk({ ...GRAVADA, nd: -7 }).personagem.dbt?.npc?.nd).toBe(1)
  })

  it('nome, descrição, personalidade e textos da técnica cortados nos tetos, sem deixar meio emoji', () => {
    const nome = `${'a'.repeat(PERSONAGEM_NOME_MAX - 1)}😀`
    const { personagem } = gerarOk({
      ...GRAVADA,
      nome,
      descricao: 'd'.repeat(PERSONAGEM_TEXTO_MAX + 500),
      personalidade: 'p'.repeat(LIMITES_DBT.textoCurto + 50),
      tecnicas: [{ ...GRAVADA.tecnicas[0], nome: 't'.repeat(LIMITES_DBT.nome + 30), alcance: 'x'.repeat(LIMITES_DBT.textoCurto + 1) }],
    })
    expect(personagem.nome).toBe('a'.repeat(PERSONAGEM_NOME_MAX - 1))
    expect(personagem.nome).not.toMatch(/[\uD800-\uDBFF]$/)
    expect(personagem.descricao).toHaveLength(PERSONAGEM_TEXTO_MAX)
    expect(personagem.dbt?.personalidade).toHaveLength(LIMITES_DBT.textoCurto)
    expect(personagem.dbt?.tecnicas[0].nome).toHaveLength(LIMITES_DBT.nome)
    expect(personagem.dbt?.tecnicas[0].alcance).toHaveLength(LIMITES_DBT.textoCurto)
  })

  it('listas longas: 6 técnicas, 10 rótulos por técnica, 4 formas, 4 passivas; o excesso sai com observação', () => {
    const tecnica = { nome: 'Kiai', rank: 'E', tipo: 'fisica', rotulos: Array.from({ length: 30 }, () => ({ id: 'diminuir-precisao' })) }
    const npc = gerarOk({
      ...GRAVADA,
      tecnicas: Array.from({ length: 10 }, (_, i) => ({ ...tecnica, nome: `Kiai ${i + 1}` })),
      transformacoes: Array.from({ length: 9 }, (_, i) => ({ nome: `Forma ${i + 1}`, estagio: 1 })),
      passivas: Array.from({ length: 9 }, (_, i) => ({ nome: `Passiva ${i + 1}`, efeito: 'x' })),
    })
    const ficha = npc.personagem.dbt
    expect(ficha?.tecnicas).toHaveLength(6)
    expect(npc.observacoes).toContain('Vieram 10 técnicas; ficaram as 6 primeiras.')
    // Diminuir Precisão acumula; os negativos passam do teto do rank E (1) e saem até caber.
    for (const lida of ficha?.tecnicas ?? []) expect(lida.rotulos.length).toBeLessThanOrEqual(10)
    expect(ficha?.transformacoes).toHaveLength(4)
    expect(ficha?.npc?.passivas).toHaveLength(4)
  })

  it('forma nova com estágio 500 fica no teto (99) e EP/Ki saem da regra do estágio, não do número da IA', () => {
    const { personagem } = gerarOk({ ...GRAVADA, transformacoes: [{ nome: 'Fúria Sem Fim', estagio: 500, ep: 9000, custoKi: 0 }] })
    const forma = personagem.dbt?.transformacoes[0]
    expect(forma).toMatchObject({ nome: 'Fúria Sem Fim', estagio: 99, livroId: null })
    expect(forma?.ep).not.toBe(9000)
  })
})

describe('personagemDaIaDBT: raça, rótulo e condição que não existem', () => {
  it('raça inventada sai, com observação; o resto do NPC fica', () => {
    const npc = gerarOk({ ...GRAVADA, raca: 'kryptoniano' })
    expect(npc.raca).toBe('')
    expect(npc.personagem.dbt?.raca).toBe('')
    expect(npc.personagem.dbt?.variante).toBe('')
    expect(npc.observacoes).toContain('A raça "kryptoniano" não está no livro: o NPC ficou sem raça.')
    expect(npc.personagem.dbt?.tecnicas).toHaveLength(2)
  })

  it('pacote de técnicas não é raça escolhível; raça pelo nome do livro é aceita', () => {
    expect(gerarOk({ ...GRAVADA, raca: 'androide-do-furto-de-ki' }).personagem.dbt?.raca).toBe('')
    expect(gerarOk({ ...GRAVADA, raca: 'Saiyajin', variante: '' }).personagem.dbt?.raca).toBe('saiyajin')
  })

  it('variante de outra raça sai e a raça fica', () => {
    const npc = gerarOk({ ...GRAVADA, variante: 'cla-dragao' })
    expect(npc.personagem.dbt).toMatchObject({ raca: 'saiyajin', variante: '' })
    expect(npc.observacoes).toContain('A variante "cla-dragao" não é de Saiyajin: ficou sem variante.')
  })

  it('rótulo fora do catálogo e Efeito Negativo sem condição do livro saem, cada um com observação', () => {
    const npc = gerarOk(comTecnicas([{ nome: 'Raio', rank: 'D', tipo: 'ki', rotulos: [{ id: 'raio-da-morte-supremo' }, { id: 'efeito-negativo', condicao: 'Petrificado' }, { id: 'dano-potente' }] }]))
    expect(npc.personagem.dbt?.tecnicas[0].rotulos.map((rotulo) => rotulo.rotuloId)).toEqual(['dano-potente'])
    expect(npc.observacoes).toContain('«Raio»: o rótulo "raio-da-morte-supremo" não está no livro e saiu.')
    expect(npc.observacoes).toContain('«Raio»: Efeito Negativo saiu, sem uma condição do livro.')
  })

  it('chaves com nome de protótipo (__proto__, constructor) não quebram nem viram rótulo', () => {
    const texto = '{"nome":"X","atributos":{"for":10,"__proto__":{"for":99}},"raca":"__proto__","tecnicas":[{"nome":"T","rank":"E","tipo":"ki","rotulos":[{"id":"__proto__"},{"id":"constructor"},{"id":"toString"}]}]}'
    const npc = gerarOk(texto)
    expect(npc.personagem.atributos.for).toBe(10)
    expect(npc.personagem.dbt?.raca).toBe('')
    expect(npc.personagem.dbt?.tecnicas[0].rotulos).toEqual([])
  })
})

describe('personagemDaIaDBT: técnica que estoura o orçamento do rank', () => {
  it('positivo acima dos pontos do rank sai do fim para o começo até caber, com observação', () => {
    // Rank E: 1 ponto. Golpe Crítico (5) + Dano Temporal (6) não cabem; sem nenhum dos dois, cabe.
    const npc = gerarOk(comTecnicas([{ nome: 'Soco Cósmico', rank: 'E', tipo: 'fisica', rotulos: [{ id: 'golpe-critico' }, { id: 'dano-temporal' }] }]))
    const tecnica = npc.personagem.dbt?.tecnicas[0]
    expect(tecnica?.rotulos).toEqual([])
    expect(npc.observacoes).toEqual(
      expect.arrayContaining(['«Soco Cósmico»: Dano Temporal saiu para caber nos 1 pontos de rótulo do rank E.', '«Soco Cósmico»: Golpe Crítico saiu para caber nos 1 pontos de rótulo do rank E.']),
    )
  })

  it('negativos acima do teto do rank saem primeiro', () => {
    // Rank E aceita até 1 ponto de negativos: Foco Total (−4) passa.
    const npc = gerarOk(comTecnicas([{ nome: 'Grito', rank: 'E', tipo: 'ki', rotulos: [{ id: 'dano-potente' }, { id: 'foco-total' }] }]))
    expect(npc.observacoes).toContain('«Grito»: Foco Total saiu; o rank E aceita até 1 pontos de negativos.')
    // Depois, Dano Potente (2) também não cabe em 1 ponto: a técnica fica sem rótulo, mas fica.
    expect(npc.personagem.dbt?.tecnicas[0]).toMatchObject({ nome: 'Grito', rotulos: [] })
  })

  it('o custo do tipo sozinho estoura (Híbrida custa 2 no rank E de 1 ponto): a técnica inteira sai', () => {
    const npc = gerarOk(comTecnicas([{ nome: 'Mão Mística', rank: 'E', tipo: 'hibrida', atributo: 'int', rotulos: [] }]))
    expect(npc.personagem.dbt?.tecnicas).toEqual([])
    expect(npc.observacoes).toContain('«Mão Mística» saiu: não coube nas regras de técnica do rank E (p. 60).')
  })

  it('saiu o rótulo que decidia a faixa (Adicionar Cura): a faixa volta a medir dano', () => {
    const npc = gerarOk(comTecnicas([{ nome: 'Toque Vital', rank: 'E', tipo: 'ki', efeito: 'cura', rotulos: [{ id: 'adicionar-cura' }] }]))
    expect(npc.personagem.dbt?.tecnicas[0]).toMatchObject({ rotulos: [], efeitoDaFaixa: 'dano' })
    expect(npc.observacoes).toContain('«Toque Vital»: sem Adicionar Cura, a faixa passou a medir dano.')
  })
})

describe('personagemDaIaDBT: texto com HTML ou script', () => {
  const XSS_NOME = '<img src=x onerror="globalThis.__xssDbt=1">'
  const XSS_SCRIPT = '<script>globalThis.__xssDbt=1</script>'
  const PERIGOSA = {
    ...GRAVADA,
    nome: XSS_NOME,
    descricao: XSS_SCRIPT,
    personalidade: '<b onmouseover="globalThis.__xssDbt=1">má</b>',
    raca: XSS_SCRIPT,
    variante: XSS_SCRIPT,
    pericias: [XSS_SCRIPT, 'atletismo'],
    tecnicas: [
      { ...GRAVADA.tecnicas[0], nome: '<svg onload="globalThis.__xssDbt=1">', alcance: XSS_SCRIPT, descricao: XSS_SCRIPT, rotulos: [{ id: XSS_SCRIPT }, { id: 'dano-potente' }] },
    ],
    transformacoes: [{ id: XSS_SCRIPT, nome: '<iframe src="javascript:alert(1)">', estagio: 1, efeitos: XSS_SCRIPT }],
    passivas: [{ nome: XSS_NOME, efeito: XSS_SCRIPT }],
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, '__xssDbt')
  })

  it('não quebra, e nenhum texto da IA vira id, raça, variante, perícia ou rótulo', () => {
    const npc = gerarOk(PERIGOSA)
    const ficha = npc.personagem.dbt
    expect(ficha?.raca).toBe('')
    expect(ficha?.variante).toBe('')
    expect(ficha?.periciasTreinadas).toEqual(['atletismo'])
    expect(ficha?.tecnicas[0].rotulos.map((rotulo) => rotulo.rotuloId)).toEqual(['dano-potente'])
    expect(ficha?.transformacoes[0].livroId).toBeNull()
    const ids = camposDeId(ficha)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(id).not.toMatch(/[<>"'=]/)
    expect(npc.personagem.id).not.toMatch(/[<>"'=]/)
  })

  it('o que é texto continua texto: guardado literal (nada é executado nem interpretado) e dentro dos tetos', () => {
    const npc = gerarOk(PERIGOSA)
    expect(npc.personagem.nome).toBe(XSS_NOME)
    expect(npc.personagem.descricao).toBe(XSS_SCRIPT)
    expect(npc.personagem.dbt?.tecnicas[0].descricao).toBe(XSS_SCRIPT)
    expect(Reflect.get(globalThis, '__xssDbt')).toBeUndefined()
  })

  it('na tela de revisão (NpcGeradoDBT) o HTML aparece como texto: nenhum script, img, svg, iframe ou handler é criado', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    const { NpcGeradoDBT } = await import('../../components/ia/GerarNpc')
    const npc = gerarOk(PERIGOSA)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(createElement(NpcGeradoDBT, { npc: npc.personagem, personagens: [], raca: npc.raca, notacao: npc.notacao, observacoes: npc.observacoes, onGerarOutro: () => undefined }))
      })
      expect(container.querySelectorAll('script, img, svg, iframe, b').length).toBe(0)
      expect(container.querySelectorAll('[onerror], [onload], [onmouseover]').length).toBe(0)
      expect(container.textContent).toContain(XSS_SCRIPT)
      expect(container.querySelector('h3')?.textContent).toBe(XSS_NOME)
      // A observação cita o rótulo inventado (o texto da IA), também como texto.
      expect(npc.observacoes.some((texto) => texto.includes('<script>'))).toBe(true)
      expect(Array.from(container.querySelectorAll('li')).some((item) => item.textContent?.includes(XSS_SCRIPT))).toBe(true)
      expect(Reflect.get(globalThis, '__xssDbt')).toBeUndefined()
    } finally {
      act(() => root.unmount())
      container.remove()
    }
    // Teto próprio (12/11/2026): rodando este arquivo sozinho, a primeira importação da tela do NPC leva ~5 s
    // (transformação a frio) e estourava os 5 s padrão; na suíte inteira passa em menos. É carga, não espera presa.
  }, 30_000)
})

beforeAll(() => {
  // A tabela de ranks do livro abre: sem ela todo NPC sai com o erro do catálogo, e os testes acima não provariam nada.
  expect(RANKS_DO_LIVRO).not.toBeNull()
})
