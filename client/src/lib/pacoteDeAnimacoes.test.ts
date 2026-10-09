import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listarEstilosDeCenario } from '../cenario/estilosDeCenario'
import { animacaoDePorta, listarAnimacoesDePorta } from '../portas/animacoesDePorta'
import { listarTransicoes, transicaoInfo } from '../transicoes/catalogo'
import {
  TEXTO_ANIMACOES_EM_DIA,
  TEXTO_ANIMACOES_SEM_PROCURA,
  carregarPacoteDeAnimacoes,
  criarOrigemDoJogador,
  criarOrigemDoMestre,
  esquecerPacoteCarregado,
  lerEntradaDoPacote,
  lerIndiceDoPacote,
  lerRespostaDoAtualizador,
  nomesNovos,
  procurarAnimacoesNovas,
  textoDaProcura,
  type OrigemDoPacote,
  type PortaDoPacote,
} from './pacoteDeAnimacoes'

/** PACOTE DE ANIMAÇÕES: índice, origens (mestre e jogador), registro e procura. */

const ARQUIVOS = new Set(['transicao-tunel.js', 'porta-cair.js', 'cenario-chuva.js'])

const TUNEL = { id: 'tunel', tipo: 'transicao', nome: 'Túnel', arquivo: 'transicao-tunel.js', duracaoNaturalS: 6, quadroDaMiniaturaS: 2 }
const CAIR = { id: 'cair', tipo: 'porta', nome: 'Cair para dentro', arquivo: 'porta-cair.js', duracaoMs: 300 }
const CHUVA = { id: 'chuva', tipo: 'cenario', nome: 'Chuva', arquivo: 'cenario-chuva.js', duracaoNaturalS: 8 }

function indice(animacoes: unknown[], versao = 1, arquivos: Iterable<string> = ARQUIVOS): string {
  return JSON.stringify({ formato: 1, versao, motorMinimo: '0.4.21', arquivos: [...arquivos].map((nome) => ({ nome, sha256: 'a'.repeat(64), tamanho: 10 })), animacoes })
}

/** Origem em memória: `modulos` por arquivo; `quebrados` lançam no import. */
function origemFalsa(texto: string | null, modulos: Record<string, unknown>, quebrados: string[] = []): OrigemDoPacote & { importar: ReturnType<typeof vi.fn> } {
  return {
    lerIndice: async () => texto,
    importar: vi.fn(async (arquivo: string) => {
      if (quebrados.includes(arquivo)) throw new SyntaxError(`módulo quebrado: ${arquivo}`)
      return modulos[arquivo]
    }),
  }
}

const MODULOS = {
  'transicao-tunel.js': { default: () => ({}) },
  'porta-cair.js': { default: () => undefined },
  'cenario-chuva.js': { default: () => ({ atualizar: () => undefined, descartar: () => undefined }) },
}

const idsDeFora = () => ({
  transicoes: listarTransicoes()
    .map((t) => t.id)
    .filter((id) => !['porta', 'escada-pedra', 'escada-pedra-descendo'].includes(id)),
  portas: listarAnimacoesDePorta()
    .map((a) => a.id)
    .filter((id) => id !== 'girar' && id !== 'deslizar'),
  cenarios: listarEstilosDeCenario().map((e) => e.id),
})

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  esquecerPacoteCarregado()
  vi.restoreAllMocks()
})

describe('entradas do índice', () => {
  it('aceita os três tipos com os campos de cada um', () => {
    expect(lerEntradaDoPacote(TUNEL, ARQUIVOS)).toEqual({ entrada: TUNEL })
    expect(lerEntradaDoPacote(CAIR, ARQUIVOS)).toEqual({ entrada: CAIR })
    expect(lerEntradaDoPacote({ ...CHUVA, quadroDaMiniaturaS: 3 }, ARQUIVOS)).toEqual({ entrada: { ...CHUVA, quadroDaMiniaturaS: 3 } })
  })

  it('pula o que não serve, com o motivo', () => {
    const fora = (valor: unknown) => 'motivo' in lerEntradaDoPacote(valor, ARQUIVOS)
    expect(fora(null)).toBe(true)
    expect(fora({ ...TUNEL, id: 'Tunel' })).toBe(true)
    expect(fora({ ...TUNEL, id: 'a'.repeat(41) })).toBe(true)
    expect(fora({ ...TUNEL, tipo: 'som' })).toBe(true)
    expect(fora({ ...TUNEL, nome: ' ' })).toBe(true)
    expect(fora({ ...TUNEL, nome: 'x'.repeat(61) })).toBe(true)
    expect(fora({ ...TUNEL, arquivo: 'outro.js' })).toBe(true)
    expect(fora({ ...TUNEL, duracaoNaturalS: 1 })).toBe(true)
    expect(fora({ ...TUNEL, quadroDaMiniaturaS: undefined })).toBe(true)
    expect(fora({ ...TUNEL, quadroDaMiniaturaS: 7 })).toBe(true)
    expect(fora({ ...CAIR, duracaoMs: 0 })).toBe(true)
    expect(fora({ ...CAIR, duracaoMs: 3001 })).toBe(true)
    expect(fora({ ...CHUVA, duracaoNaturalS: 41 })).toBe(true)
  })

  it('id de embutida fica de fora: a embutida ganha', () => {
    expect(lerEntradaDoPacote({ ...TUNEL, id: 'porta' }, ARQUIVOS)).toEqual({ motivo: 'porta: id de animação embutida' })
    expect('motivo' in lerEntradaDoPacote({ ...CAIR, id: 'girar' }, ARQUIVOS)).toBe(true)
    expect('motivo' in lerEntradaDoPacote({ ...CHUVA, id: 'panoramica' }, ARQUIVOS)).toBe(true)
    // O mesmo id em OUTRO tipo não é de embutida: "porta" só é embutida como transição.
    expect('entrada' in lerEntradaDoPacote({ ...CAIR, id: 'porta' }, ARQUIVOS)).toBe(true)
  })

  it('miniatura do cenário fora da animação cai, e a entrada fica', () => {
    expect(lerEntradaDoPacote({ ...CHUVA, quadroDaMiniaturaS: 99 }, ARQUIVOS)).toEqual({ entrada: CHUVA })
  })
})

describe('índice', () => {
  it('lê versão e animações; entrada ruim e repetida saem, o resto vale', () => {
    const lido = lerIndiceDoPacote(indice([TUNEL, { ...CAIR, duracaoMs: -1 }, CHUVA, { ...TUNEL, nome: 'Outro túnel' }], 4))
    expect(lido).toEqual({ versao: 4, animacoes: [TUNEL, CHUVA] })
  })

  it('pacote vazio (a primeira publicação) é um índice válido', () => {
    expect(lerIndiceDoPacote(indice([], 1, []))).toEqual({ versao: 1, animacoes: [] })
    expect(lerIndiceDoPacote(JSON.stringify({ formato: 1, versao: 1, motorMinimo: '0.4.21', arquivos: [] }))).toEqual({ versao: 1, animacoes: [] })
  })

  it('índice sem serventia vira null', () => {
    expect(lerIndiceDoPacote('<!doctype html>')).toBeNull()
    expect(lerIndiceDoPacote('[]')).toBeNull()
    expect(lerIndiceDoPacote(JSON.stringify({ formato: 2, versao: 1, arquivos: [] }))).toBeNull()
    expect(lerIndiceDoPacote(JSON.stringify({ formato: 1, versao: 0, arquivos: [] }))).toBeNull()
    expect(lerIndiceDoPacote(JSON.stringify({ formato: 1, versao: 1.5, arquivos: [] }))).toBeNull()
    expect(lerIndiceDoPacote(JSON.stringify({ formato: 1, versao: 1 }))).toBeNull()
  })
})

describe('carregar', () => {
  it('importa todos os módulos e registra cada um no registro do seu tipo', async () => {
    const origem = origemFalsa(indice([TUNEL, CAIR, CHUVA], 3), MODULOS)
    const resultado = await carregarPacoteDeAnimacoes(origem)
    expect(resultado.versao).toBe(3)
    expect(resultado.registradas.map((e) => e.id)).toEqual(['tunel', 'cair', 'chuva'])
    expect(idsDeFora()).toEqual({ transicoes: ['tunel'], portas: ['cair'], cenarios: ['chuva'] })
    expect(transicaoInfo('tunel')?.nome).toBe('Túnel')
    expect(animacaoDePorta('cair')?.duracaoMs).toBe(300)
    expect(origem.importar).toHaveBeenCalledWith('porta-cair.js', 3)
  })

  it('um módulo que quebra ao importar, ou sem export default de função, não derruba os outros', async () => {
    const modulos = { ...MODULOS, 'cenario-chuva.js': { default: 'não é função' } }
    const resultado = await carregarPacoteDeAnimacoes(origemFalsa(indice([TUNEL, CAIR, CHUVA]), modulos, ['transicao-tunel.js']))
    expect(resultado.registradas.map((e) => e.id)).toEqual(['cair'])
    expect(idsDeFora()).toEqual({ transicoes: [], portas: ['cair'], cenarios: [] })
    expect(console.warn).toHaveBeenCalled()
  })

  it('pacote novo substitui o anterior inteiro nos três registros (sai o que não veio, entra o novo)', async () => {
    await carregarPacoteDeAnimacoes(origemFalsa(indice([TUNEL, CAIR], 1), MODULOS))
    const tunelNovo = { ...TUNEL, nome: 'Túnel reformado' }
    const resultado = await carregarPacoteDeAnimacoes(origemFalsa(indice([tunelNovo, CHUVA], 2), MODULOS))
    expect(resultado.versao).toBe(2)
    expect(idsDeFora()).toEqual({ transicoes: ['tunel'], portas: [], cenarios: ['chuva'] })
    expect(transicaoInfo('tunel')?.nome).toBe('Túnel reformado')
  })

  it('sem pacote (null) tira as de fora; falha ao LER deixa tudo como estava', async () => {
    await carregarPacoteDeAnimacoes(origemFalsa(indice([CAIR]), MODULOS))
    const falhou = await carregarPacoteDeAnimacoes({ lerIndice: async () => Promise.reject(new Error('disco')), importar: async () => ({}) })
    expect(falhou.falhouAoLer).toBe(true)
    expect(idsDeFora().portas).toEqual(['cair'])
    await carregarPacoteDeAnimacoes(origemFalsa(null, MODULOS))
    expect(idsDeFora()).toEqual({ transicoes: [], portas: [], cenarios: [] })
  })

  it('dois carregamentos ao mesmo tempo: o mais novo manda', async () => {
    let soltarVelho: () => void = () => undefined
    const velho: OrigemDoPacote = {
      lerIndice: async () => indice([CAIR], 1),
      importar: () =>
        new Promise((resolver) => {
          soltarVelho = () => resolver(MODULOS['porta-cair.js'])
        }),
    }
    const carregandoVelho = carregarPacoteDeAnimacoes(velho)
    await carregarPacoteDeAnimacoes(origemFalsa(indice([CHUVA], 2), MODULOS))
    soltarVelho()
    await carregandoVelho
    expect(idsDeFora()).toEqual({ transicoes: [], portas: [], cenarios: ['chuva'] })
  })
})

describe('origem do mestre (Tauri)', () => {
  it('lê o índice pelo Rust e importa o módulo de um Blob, revogando a URL depois', async () => {
    // `Uint8Array.from`: o `TextEncoder` do ambiente de teste devolve bytes de outro realm, e o IPC de verdade entrega um `ArrayBuffer` desta página.
    const bytes = Uint8Array.from(new TextEncoder().encode('export default function () {}'))
    const invocar = vi.fn(async (comando: string) => (comando === 'animacoes_ler_indice' ? indice([CAIR]) : bytes.buffer))
    const blobs: Blob[] = []
    const revogarUrl = vi.fn()
    const origem = criarOrigemDoMestre({
      invocar,
      criarUrl: (blob) => {
        blobs.push(blob)
        return 'blob:modulo-1'
      },
      revogarUrl,
      importarUrl: async (url) => ({ default: () => url }),
    })
    const resultado = await carregarPacoteDeAnimacoes(origem)
    expect(invocar).toHaveBeenCalledWith('animacoes_ler_arquivo', { nome: 'porta-cair.js' })
    expect(blobs[0]?.type).toBe('text/javascript')
    expect(await blobs[0]?.text()).toBe('export default function () {}')
    expect(revogarUrl).toHaveBeenCalledWith('blob:modulo-1')
    expect(resultado.registradas.map((e) => e.id)).toEqual(['cair'])
  })

  it('sem pacote instalado (null) não importa nada; resposta que não é bytes fica de fora', async () => {
    const semPacote = criarOrigemDoMestre({ invocar: async () => null })
    expect(await semPacote.lerIndice()).toBeNull()
    const revogarUrl = vi.fn()
    const torta = criarOrigemDoMestre({ invocar: async () => [1, 2, 3], criarUrl: () => 'blob:x', revogarUrl })
    await expect(torta.importar('porta-cair.js', 1)).rejects.toThrow(/bytes/)
  })

  it('import que falha ainda revoga a URL', async () => {
    const revogarUrl = vi.fn()
    const origem = criarOrigemDoMestre({
      invocar: async () => new Uint8Array([1]),
      criarUrl: () => 'blob:quebrado',
      revogarUrl,
      importarUrl: async () => Promise.reject(new SyntaxError('quebrado')),
    })
    await expect(origem.importar('porta-cair.js', 1)).rejects.toThrow('quebrado')
    expect(revogarUrl).toHaveBeenCalledWith('blob:quebrado')
  })
})

describe('origem do jogador (navegador)', () => {
  const json = (corpo: string, status = 200) => new Response(corpo, { status, headers: { 'content-type': 'application/json' } })

  it('pede o índice ao servidor da sala e importa da rota, com a versão no endereço', async () => {
    const buscar = vi.fn(async () => json(indice([TUNEL, CAIR], 7)))
    const importarUrl = vi.fn(async (url: string) => (url.includes('tunel') ? MODULOS['transicao-tunel.js'] : MODULOS['porta-cair.js']))
    const resultado = await carregarPacoteDeAnimacoes(criarOrigemDoJogador({ buscar, importarUrl }))
    expect(buscar).toHaveBeenCalledWith('/animacoes/indice.json', { cache: 'no-store' })
    expect(importarUrl).toHaveBeenCalledWith('/animacoes/transicao-tunel.js?v=7')
    expect(importarUrl).toHaveBeenCalledWith('/animacoes/porta-cair.js?v=7')
    expect(resultado.registradas.map((e) => e.id)).toEqual(['tunel', 'cair'])
  })

  it('404 = mestre sem pacote, em silêncio; HTML de outro servidor = sem pacote; erro do servidor lança', async () => {
    expect(await criarOrigemDoJogador({ buscar: async () => new Response('', { status: 404 }) }).lerIndice()).toBeNull()
    expect(await criarOrigemDoJogador({ buscar: async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }) }).lerIndice()).toBeNull()
    await expect(criarOrigemDoJogador({ buscar: async () => json('', 500) }).lerIndice()).rejects.toThrow('500')
  })

  it('um módulo quebrado no jogador também não derruba os outros', async () => {
    const importarUrl = async (url: string) => {
      if (url.includes('porta-cair')) throw new TypeError('Failed to fetch dynamically imported module')
      return MODULOS['cenario-chuva.js']
    }
    const resultado = await carregarPacoteDeAnimacoes(criarOrigemDoJogador({ buscar: async () => json(indice([CAIR, CHUVA])), importarUrl }))
    expect(resultado.registradas.map((e) => e.id)).toEqual(['chuva'])
  })
})

describe('procurar animações novas', () => {
  function portaFalsa(resposta: unknown, origem: OrigemDoPacote, falha = false): PortaDoPacote {
    return {
      disponivel: () => true,
      atualizar: vi.fn(async () => {
        if (falha) throw new Error('disco cheio')
        return resposta
      }),
      origem,
    }
  }

  it('pacote novo: recarrega e lista só os nomes que não existiam', async () => {
    await carregarPacoteDeAnimacoes(origemFalsa(indice([TUNEL, CAIR], 1), MODULOS))
    const novo = indice([{ ...TUNEL, nome: 'Túnel reformado' }, CAIR, CHUVA], 2)
    const resultado = await procurarAnimacoesNovas(portaFalsa({ estado: 'novo', versao: 2, indice: novo }, origemFalsa(novo, MODULOS)))
    expect(resultado).toEqual({ estado: 'novo', novas: ['Chuva'] })
    expect(textoDaProcura(resultado, 'abertura')).toBe('Animações novas: Chuva')
    expect(idsDeFora().cenarios).toEqual(['chuva'])
  })

  it('a primeira chegada lista todas', async () => {
    const novo = indice([TUNEL, CHUVA], 1)
    const resultado = await procurarAnimacoesNovas(portaFalsa({ estado: 'novo', versao: 1, indice: novo }, origemFalsa(novo, MODULOS)))
    expect(textoDaProcura(resultado, 'botao')).toBe('Animações novas: Túnel, Chuva')
  })

  it('em dia: silêncio na abertura, "Animações em dia" no botão; nada é recarregado', async () => {
    const origem = origemFalsa(indice([CAIR]), MODULOS)
    const resultado = await procurarAnimacoesNovas(portaFalsa({ estado: 'igual', versao: 1, indice: indice([CAIR]) }, origem))
    expect(resultado).toEqual({ estado: 'igual', novas: [] })
    expect(textoDaProcura(resultado, 'abertura')).toBeNull()
    expect(textoDaProcura(resultado, 'botao')).toBe(TEXTO_ANIMACOES_EM_DIA)
    expect(origem.importar).not.toHaveBeenCalled()
  })

  it('sem internet, pacote inválido ou falha do Rust: "Não deu para procurar" só no botão', async () => {
    const origem = origemFalsa(null, MODULOS)
    for (const estado of ['sem_internet', 'invalido']) {
      const resultado = await procurarAnimacoesNovas(portaFalsa({ estado, versao: null, indice: null }, origem))
      expect(textoDaProcura(resultado, 'abertura')).toBeNull()
      expect(textoDaProcura(resultado, 'botao')).toBe(TEXTO_ANIMACOES_SEM_PROCURA)
    }
    const quebrou = await procurarAnimacoesNovas(portaFalsa(null, origem, true))
    expect(quebrou).toEqual({ estado: 'falhou', novas: [] })
    expect(textoDaProcura(quebrou, 'botao')).toBe(TEXTO_ANIMACOES_SEM_PROCURA)
  })

  it('pacote novo só com animações que já existiam: "Animações atualizadas" no botão, silêncio na abertura', () => {
    expect(textoDaProcura({ estado: 'novo', novas: [] }, 'abertura')).toBeNull()
    expect(textoDaProcura({ estado: 'novo', novas: [] }, 'botao')).toBe('Animações atualizadas')
  })

  it('duas procuras ao mesmo tempo viram uma só', async () => {
    const porta = portaFalsa({ estado: 'igual', versao: 1, indice: null }, origemFalsa(null, MODULOS))
    await Promise.all([procurarAnimacoesNovas(porta), procurarAnimacoesNovas(porta)])
    expect(porta.atualizar).toHaveBeenCalledTimes(1)
  })

  it('nomesNovos compara por tipo e id', () => {
    const chuva = { id: 'chuva', tipo: 'cenario' as const, nome: 'Chuva', arquivo: 'c.js', duracaoNaturalS: 8 }
    expect(nomesNovos(new Set(['porta:chuva']), [chuva])).toEqual(['Chuva'])
    expect(nomesNovos(new Set(['cenario:chuva']), [chuva])).toEqual([])
  })

  it('lerRespostaDoAtualizador confere o que veio do Rust', () => {
    expect(lerRespostaDoAtualizador({ estado: 'app_velho', versao: 3, indice: '{}' })).toEqual({ estado: 'app_velho', versao: 3, indice: '{}' })
    expect(lerRespostaDoAtualizador({ estado: 'novo' })).toEqual({ estado: 'novo', versao: null, indice: null })
    expect(lerRespostaDoAtualizador({ estado: 'talvez' })).toBeNull()
    expect(lerRespostaDoAtualizador('novo')).toBeNull()
  })
})
