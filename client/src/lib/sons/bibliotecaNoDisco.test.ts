/**
 * A BIBLIOTECA NO DISCO (`lib/sons/bibliotecaNoDisco.ts`), GLOBAL desde
 * 29/10/2026: `<appData>/sons/sons.json`, e os áudios em `<appData>/sons/midia`.
 * Sem `sons.json` global, abre vazia, sem aviso e sem gravar nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('./discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('./discoFalso.fixture')).pathFalso)

const { APPDATA, arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, links, MIDIA_DO_APP, textoDe, wav } = await import('./discoFalso.fixture')
const { useToastStore } = await import('../../stores/toastStore')
const { idDoAudio, refDoId } = await import('../midia')
const { ARQUIVO_DE_SONS, gravarBibliotecaGlobal, guardarArquivoDeSom, lerBibliotecaGlobal, nomeDaCopiaDoSonsIlegivel, SONS_JSON_MAX_BYTES } = await import('./bibliotecaNoDisco')
const { bibliotecaDeSonsVazia, ehVideoDoYoutube } = await import('./biblioteca')
type BibliotecaDeSons = import('./biblioteca').BibliotecaDeSons

const SONS = `${APPDATA}/sons`

function bibliotecaCom(idA: string, idB: string): BibliotecaDeSons {
  const video = 'dQw4w9WgXcQ'
  if (!ehVideoDoYoutube(video)) throw new Error('vídeo inválido no teste')
  return {
    versao: 1,
    pastas: [{ id: 'pasta_porto', nome: 'Porto', ordem: 0 }],
    efeitos: [
      { id: 'som_sino', nome: 'Sino', fonte: { tipo: 'arquivo', ref: refDoId(idA), bytes: 64 }, volume: 0.7, loop: false, pastaId: 'pasta_porto', atalho: 1, ordem: 0 },
      { id: 'som_ondas', nome: 'Ondas', fonte: { tipo: 'arquivo', ref: refDoId(idB), bytes: 96 }, volume: 0.4, loop: true, pastaId: null, favorito: true, ordem: 1 },
      { id: 'som_shanty', nome: 'Shanty', fonte: { tipo: 'youtube', video, inicioS: 12 }, volume: 1, loop: true, pastaId: null, ordem: 2 },
    ],
  }
}

/** A hora fixa dos testes: a cópia do ilegível leva data e hora no nome. */
const AGORA = new Date(2026, 9, 23, 14, 5, 9)
const COPIA = `${SONS}/sons.invalido-20261023-140509.json`

beforeEach(() => {
  limparDisco()
  criarPastasAte(SONS)
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lerBibliotecaGlobal', () => {
  it('sem sons.json global: biblioteca vazia, sem aviso, sem gravar nada', async () => {
    expect(await lerBibliotecaGlobal()).toEqual({ biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true })
    expect(fsFalso.writeTextFile).not.toHaveBeenCalled()
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('sons.json ilegível: guarda uma cópia antes de recomeçar vazio; sem conseguir a cópia, não deixa gravar por cima', async () => {
    arquivos.set(`${SONS}/${ARQUIVO_DE_SONS}`, '{ quebrado')
    const lida = await lerBibliotecaGlobal()
    expect(lida.biblioteca).toEqual(bibliotecaDeSonsVazia())
    expect(lida.podeGravar).toBe(true)
    expect(lida.aviso).toContain(nomeDaCopiaDoSonsIlegivel(AGORA))
    expect(textoDe(COPIA)).toBe('{ quebrado')

    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('os error 5'))
    const semCopia = await lerBibliotecaGlobal()
    expect(semCopia.podeGravar).toBe(false)
    expect(semCopia.aviso).not.toBeNull()
  })

  it('a cópia do ilegível tem nome com data e hora, e nasce nova: nunca passa por cima de outra', async () => {
    expect(nomeDaCopiaDoSonsIlegivel(AGORA)).toBe('sons.invalido-20261023-140509.json')
    expect(nomeDaCopiaDoSonsIlegivel(new Date(2027, 0, 2, 3, 4, 5))).toBe('sons.invalido-20270102-030405.json')
    arquivos.set(`${SONS}/${ARQUIVO_DE_SONS}`, '{ do atacante')
    arquivos.set(COPIA, 'cópia de antes')

    const lida = await lerBibliotecaGlobal()
    expect(textoDe(COPIA)).toBe('cópia de antes')
    expect(lida).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), podeGravar: false })
    expect(fsFalso.writeTextFile).toHaveBeenCalledWith(COPIA, '{ do atacante', { createNew: true })
  })

  it('a cópia do ilegível não segue atalho: o alvo que é link não é escrito', async () => {
    const vitima = 'C:/Windows/vitima.ini'
    criarPastasAte(vitima)
    arquivos.set(vitima, 'original')
    links.set(COPIA, vitima)
    arquivos.set(`${SONS}/${ARQUIVO_DE_SONS}`, '{ do atacante')

    const lida = await lerBibliotecaGlobal()
    expect(textoDe(vitima)).toBe('original')
    expect(lida.podeGravar).toBe(false)
  })

  it(`sons.json acima de ${SONS_JSON_MAX_BYTES / (1024 * 1024)} MB não é lido (nem entra na memória) e não pode ser regravado`, async () => {
    expect(SONS_JSON_MAX_BYTES).toBe(1024 * 1024)
    const noTeto = JSON.stringify({ versao: 1, pastas: [], efeitos: [] })
    arquivos.set(`${SONS}/${ARQUIVO_DE_SONS}`, noTeto.padEnd(SONS_JSON_MAX_BYTES, ' '))
    expect(await lerBibliotecaGlobal()).toEqual({ biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true })

    arquivos.set(`${SONS}/${ARQUIVO_DE_SONS}`, noTeto.padEnd(SONS_JSON_MAX_BYTES + 1, ' '))
    fsFalso.readTextFile.mockClear()
    const grande = await lerBibliotecaGlobal()
    expect(fsFalso.readTextFile).not.toHaveBeenCalled()
    expect(grande).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), podeGravar: false })
    expect(grande.aviso).toContain('sons.json grande demais')
  })

  it('o disco nega até o exists: não lê, não deixa gravar, e o aviso diz que o Windows negou', async () => {
    fsFalso.exists.mockRejectedValueOnce(new Error('os error 5'))
    const lida = await lerBibliotecaGlobal()
    expect(lida.podeGravar).toBe(false)
    expect(lida.aviso).toContain('Windows negou')
  })

  it('sons.json de uma versão mais nova do app: não é lido nem pode ser regravado', async () => {
    arquivos.set(`${SONS}/${ARQUIVO_DE_SONS}`, JSON.stringify({ versao: 2, pastas: [], efeitos: [] }))
    const lida = await lerBibliotecaGlobal()
    expect(lida).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), podeGravar: false })
    expect(lida.aviso).toContain('versão mais nova')
  })
})

describe('gravarBibliotecaGlobal', () => {
  it('ida e volta pelo disco sem perda, em <appData>/sons/sons.json; nenhuma pasta de aventura é tocada', async () => {
    const idA = await idDoAudio(wav(64, 1))
    const idB = await idDoAudio(wav(96, 2))
    if (idA === null || idB === null) throw new Error('bytes de teste')
    const biblioteca = bibliotecaCom(idA, idB)

    await gravarBibliotecaGlobal(biblioteca)
    expect(await lerBibliotecaGlobal()).toEqual({ biblioteca, aviso: null, podeGravar: true })
    expect([...arquivos.keys()].every((caminho) => caminho.startsWith(`${SONS}/`))).toBe(true)
  })

  it('o "depois" só roda quando o sons.json gravou', async () => {
    const depois = vi.fn(async () => undefined)
    await gravarBibliotecaGlobal(bibliotecaDeSonsVazia(), depois)
    expect(depois).toHaveBeenCalledTimes(1)

    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('os error 5'))
    await expect(gravarBibliotecaGlobal(bibliotecaDeSonsVazia(), depois)).rejects.toThrow('Não foi possível gravar a biblioteca de sons')
    expect(depois).toHaveBeenCalledTimes(1)
  })

  it('a mensagem crua do disco não leva o caminho (nem o nome de usuário) para a tela', async () => {
    fsFalso.writeTextFile.mockRejectedValueOnce(
      new Error('failed to open file at path: C:\\Users\\Fulano de Tal\\AppData\\sons\\sons.json.tmp with error: O sistema não pode encontrar o caminho especificado. (os error 3)'),
    )
    const erro: unknown = await gravarBibliotecaGlobal(bibliotecaDeSonsVazia()).catch((causa: unknown) => causa)
    if (!(erro instanceof Error)) throw new Error('não lançou')
    expect(erro.message).toContain('Não foi possível gravar a biblioteca de sons')
    expect(erro.message).toContain('os error 3')
    expect(erro.message).not.toMatch(/Fulano|Users|[A-Za-z]:\\/)

    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('forbidden path: C:\\Users\\Fulano de Tal\\AppData\\sons\\sons.json.tmp, maybe it is not allowed on the scope'))
    const proibido: unknown = await gravarBibliotecaGlobal(bibliotecaDeSonsVazia()).catch((causa: unknown) => causa)
    if (!(proibido instanceof Error)) throw new Error('não lançou')
    expect(proibido.message).toContain('permissão')
    expect(proibido.message).not.toMatch(/Fulano|Users|[A-Za-z]:\\/)
  })
})

describe('guardarArquivoDeSom', () => {
  it('o áudio importado vai para <appData>/sons/midia, nunca para <appData>/midia (que /media serve sem chave)', async () => {
    const bytes = wav(64, 4)
    const id = await idDoAudio(bytes)
    if (id === null) throw new Error('bytes de teste')
    expect(await guardarArquivoDeSom(bytes)).toEqual({ tipo: 'arquivo', ref: refDoId(id), bytes: 64 })
    expect(bytesDe(`${SONS}/midia/${id}`)).toEqual(bytes)
    expect(arquivos.has(`${MIDIA_DO_APP}/${id}`)).toBe(false)
  })
})
