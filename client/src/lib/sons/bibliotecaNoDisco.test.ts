/**
 * A BIBLIOTECA NO DISCO (`lib/sons/bibliotecaNoDisco.ts`): `sons.json` ao lado
 * do `adventure.json`, e os áudios na `midia/` da aventura. Aventura antiga
 * (sem `sons.json`) abre vazia, sem aviso e sem gravar nada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('./discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('./discoFalso.fixture')).pathFalso)

const { arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, links, MIDIA_DO_APP, textoDe, wav } = await import('./discoFalso.fixture')
const { useToastStore } = await import('../../stores/toastStore')
const { idDoAudio, refDoId } = await import('../midia')
const { ARQUIVO_DE_SONS, gravarBibliotecaNaAventura, lerBibliotecaDaAventura, nomeDaCopiaDoSonsIlegivel, SONS_JSON_MAX_BYTES } = await import('./bibliotecaNoDisco')
const { bibliotecaDeSonsVazia, ehVideoDoYoutube } = await import('./biblioteca')
type BibliotecaDeSons = import('./biblioteca').BibliotecaDeSons

const AVENTURA = 'C:/aventuras/navio'

async function audioNoApp(bytes: Uint8Array): Promise<string> {
  const id = await idDoAudio(bytes)
  if (id === null) throw new Error('o teste montou bytes que não são áudio')
  criarPastasAte(MIDIA_DO_APP)
  arquivos.set(`${MIDIA_DO_APP}/${id}`, bytes)
  return id
}

async function bibliotecaCom(idA: string, idB: string): Promise<BibliotecaDeSons> {
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
const COPIA = `${AVENTURA}/sons.invalido-20261023-140509.json`

beforeEach(() => {
  limparDisco()
  criarPastasAte(AVENTURA)
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('lerBibliotecaDaAventura', () => {
  it('aventura antiga (sem sons.json): biblioteca vazia, sem aviso, sem migrar nem gravar nada', async () => {
    expect(await lerBibliotecaDaAventura(AVENTURA)).toEqual({ biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true })
    expect(fsFalso.writeTextFile).not.toHaveBeenCalled()
    expect(fsFalso.writeFile).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('sons.json ilegível: guarda uma cópia antes de recomeçar vazio; sem conseguir a cópia, não deixa gravar por cima', async () => {
    arquivos.set(`${AVENTURA}/${ARQUIVO_DE_SONS}`, '{ quebrado')
    const lida = await lerBibliotecaDaAventura(AVENTURA)
    expect(lida.biblioteca).toEqual(bibliotecaDeSonsVazia())
    expect(lida.podeGravar).toBe(true)
    expect(lida.aviso).toContain(nomeDaCopiaDoSonsIlegivel(AGORA))
    expect(textoDe(COPIA)).toBe('{ quebrado')

    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('os error 5'))
    const semCopia = await lerBibliotecaDaAventura(AVENTURA)
    expect(semCopia.podeGravar).toBe(false)
    expect(semCopia.aviso).not.toBeNull()
  })

  it('a cópia do ilegível tem nome com data e hora, e nasce nova: nunca passa por cima de outra', async () => {
    expect(nomeDaCopiaDoSonsIlegivel(AGORA)).toBe('sons.invalido-20261023-140509.json')
    expect(nomeDaCopiaDoSonsIlegivel(new Date(2027, 0, 2, 3, 4, 5))).toBe('sons.invalido-20270102-030405.json')
    arquivos.set(`${AVENTURA}/${ARQUIVO_DE_SONS}`, '{ do atacante')
    arquivos.set(COPIA, 'cópia de antes')

    const lida = await lerBibliotecaDaAventura(AVENTURA)
    expect(textoDe(COPIA)).toBe('cópia de antes')
    expect(lida).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), podeGravar: false })
    expect(fsFalso.writeTextFile).toHaveBeenCalledWith(COPIA, '{ do atacante', { createNew: true })
  })

  it('a cópia do ilegível não segue atalho: o alvo que é link não é escrito', async () => {
    const vitima = 'C:/Windows/vitima.ini'
    criarPastasAte(vitima)
    arquivos.set(vitima, 'original')
    links.set(COPIA, vitima)
    arquivos.set(`${AVENTURA}/${ARQUIVO_DE_SONS}`, '{ do atacante')

    const lida = await lerBibliotecaDaAventura(AVENTURA)
    expect(textoDe(vitima)).toBe('original')
    expect(lida.podeGravar).toBe(false)
  })

  it(`sons.json acima de ${SONS_JSON_MAX_BYTES / (1024 * 1024)} MB não é lido (nem entra na memória) e não pode ser regravado`, async () => {
    expect(SONS_JSON_MAX_BYTES).toBe(1024 * 1024)
    const noTeto = JSON.stringify({ versao: 1, pastas: [], efeitos: [] })
    arquivos.set(`${AVENTURA}/${ARQUIVO_DE_SONS}`, noTeto.padEnd(SONS_JSON_MAX_BYTES, ' '))
    expect(await lerBibliotecaDaAventura(AVENTURA)).toEqual({ biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true })

    arquivos.set(`${AVENTURA}/${ARQUIVO_DE_SONS}`, noTeto.padEnd(SONS_JSON_MAX_BYTES + 1, ' '))
    fsFalso.readTextFile.mockClear()
    const grande = await lerBibliotecaDaAventura(AVENTURA)
    expect(fsFalso.readTextFile).not.toHaveBeenCalled()
    expect(grande).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), podeGravar: false })
    expect(grande.aviso).toContain('sons.json grande demais')
  })

  it('o disco nega até o exists: não lê, não deixa gravar, e o aviso diz que o Windows negou', async () => {
    fsFalso.exists.mockRejectedValueOnce(new Error('os error 5'))
    const lida = await lerBibliotecaDaAventura(AVENTURA)
    expect(lida.podeGravar).toBe(false)
    expect(lida.aviso).toContain('Windows negou')
  })

  it('sons.json de uma versão mais nova do app: não é lido nem pode ser regravado', async () => {
    arquivos.set(`${AVENTURA}/${ARQUIVO_DE_SONS}`, JSON.stringify({ versao: 2, pastas: [], efeitos: [] }))
    const lida = await lerBibliotecaDaAventura(AVENTURA)
    expect(lida).toMatchObject({ biblioteca: bibliotecaDeSonsVazia(), podeGravar: false })
    expect(lida.aviso).toContain('versão mais nova')
  })
})

describe('gravarBibliotecaNaAventura', () => {
  it('ida e volta pelo disco sem perda; os áudios vão para <aventura>/midia, o YouTube não leva arquivo', async () => {
    const idA = await audioNoApp(wav(64, 1))
    const idB = await audioNoApp(wav(96, 2))
    const biblioteca = await bibliotecaCom(idA, idB)

    const levada = await gravarBibliotecaNaAventura(AVENTURA, biblioteca)
    expect(levada).toEqual({ copiados: [idA, idB].sort(), faltaram: [] })
    expect(bytesDe(`${AVENTURA}/midia/${idA}`)).toEqual(wav(64, 1))
    expect(bytesDe(`${AVENTURA}/midia/${idB}`)).toEqual(wav(96, 2))
    expect([...arquivos.keys()].filter((caminho) => caminho.startsWith(`${AVENTURA}/midia/`))).toHaveLength(2)

    expect(await lerBibliotecaDaAventura(AVENTURA)).toEqual({ biblioteca, aviso: null, podeGravar: true })
    // Nada no adventure.json: o sons.json é arquivo próprio.
    expect(arquivos.has(`${AVENTURA}/adventure.json`)).toBe(false)
  })

  it('áudio que não está neste computador: o sons.json grava assim mesmo, e o aviso fala de som', async () => {
    const idA = await audioNoApp(wav(64, 1))
    const sumido = await idDoAudio(wav(96, 2))
    if (sumido === null) throw new Error('bytes de teste')
    const levada = await gravarBibliotecaNaAventura(AVENTURA, await bibliotecaCom(idA, sumido))
    expect(levada.faltaram).toEqual([sumido])
    expect(arquivos.has(`${AVENTURA}/${ARQUIVO_DE_SONS}`)).toBe(true)
    expect(useToastStore.getState().toasts[0]?.text).toContain('1 som não foi junto')
  })

  it('o disco recusa o sons.json: lança com a frase pronta', async () => {
    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('os error 5'))
    await expect(gravarBibliotecaNaAventura(AVENTURA, bibliotecaDeSonsVazia())).rejects.toThrow('Não foi possível gravar os sons da aventura')
  })

  it('a mensagem crua do disco não leva o caminho (nem o nome de usuário) para a tela', async () => {
    fsFalso.writeTextFile.mockRejectedValueOnce(
      new Error('failed to open file at path: C:\\Users\\Fulano de Tal\\Aventuras\\navio\\sons.json.tmp with error: O sistema não pode encontrar o caminho especificado. (os error 3)'),
    )
    const erro: unknown = await gravarBibliotecaNaAventura(AVENTURA, bibliotecaDeSonsVazia()).catch((causa: unknown) => causa)
    if (!(erro instanceof Error)) throw new Error('não lançou')
    expect(erro.message).toContain('Não foi possível gravar os sons da aventura')
    expect(erro.message).toContain('os error 3')
    expect(erro.message).not.toMatch(/Fulano|Users|[A-Za-z]:\\/)

    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('forbidden path: C:\\Users\\Fulano de Tal\\Aventuras\\navio\\sons.json.tmp, maybe it is not allowed on the scope'))
    const proibido: unknown = await gravarBibliotecaNaAventura(AVENTURA, bibliotecaDeSonsVazia()).catch((causa: unknown) => causa)
    if (!(proibido instanceof Error)) throw new Error('não lançou')
    expect(proibido.message).toContain('permissão')
    expect(proibido.message).not.toMatch(/Fulano|Users|[A-Za-z]:\\/)
  })

  it('o som que faltou avisa uma vez só por conjunto: o mesmo faltando de novo não repete; um faltando novo avisa', async () => {
    const porto = 'C:/aventuras/porto'
    criarPastasAte(porto)
    const idA = await audioNoApp(wav(64, 1))
    const sumido = await idDoAudio(wav(96, 2))
    const outroSumido = await idDoAudio(wav(128, 3))
    if (sumido === null || outroSumido === null) throw new Error('bytes de teste')
    const comUmSumido = await bibliotecaCom(idA, sumido)

    await gravarBibliotecaNaAventura(porto, comUmSumido)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    // O aviso saiu da tela (os 7 s passaram, ou o mestre fechou); o salvamento sozinho grava de novo.
    useToastStore.setState({ toasts: [] })
    await gravarBibliotecaNaAventura(porto, comUmSumido)
    await gravarBibliotecaNaAventura(porto, comUmSumido)
    expect(useToastStore.getState().toasts).toEqual([])

    await gravarBibliotecaNaAventura(porto, await bibliotecaCom(outroSumido, sumido))
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]?.text).toContain('2 sons não foram junto')
  })
})
