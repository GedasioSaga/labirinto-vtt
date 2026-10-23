/**
 * A BIBLIOTECA NO DISCO (`lib/sons/bibliotecaNoDisco.ts`): `sons.json` ao lado
 * do `adventure.json`, e os áudios na `midia/` da aventura. Aventura antiga
 * (sem `sons.json`) abre vazia, sem aviso e sem gravar nada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', async () => (await import('./discoFalso.fixture')).fsFalso)
vi.mock('@tauri-apps/api/path', async () => (await import('./discoFalso.fixture')).pathFalso)

const { arquivos, bytesDe, criarPastasAte, fsFalso, limparDisco, MIDIA_DO_APP, textoDe, wav } = await import('./discoFalso.fixture')
const { useToastStore } = await import('../../stores/toastStore')
const { idDoAudio, refDoId } = await import('../midia')
const { ARQUIVO_DE_SONS, ARQUIVO_DE_SONS_ILEGIVEL, gravarBibliotecaNaAventura, lerBibliotecaDaAventura } = await import('./bibliotecaNoDisco')
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

beforeEach(() => {
  limparDisco()
  criarPastasAte(AVENTURA)
  useToastStore.setState({ toasts: [] })
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
    expect(lida.aviso).toContain(ARQUIVO_DE_SONS_ILEGIVEL)
    expect(textoDe(`${AVENTURA}/${ARQUIVO_DE_SONS_ILEGIVEL}`)).toBe('{ quebrado')

    fsFalso.writeTextFile.mockRejectedValueOnce(new Error('os error 5'))
    const semCopia = await lerBibliotecaDaAventura(AVENTURA)
    expect(semCopia.podeGravar).toBe(false)
    expect(semCopia.aviso).not.toBeNull()
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
})
