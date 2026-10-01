import { create } from 'zustand'

/**
 * SOM DA MESA: volume e mudo dos sons de clima (`lib/sons`). É preferência do
 * APARELHO: mora no localStorage de quem ouve (o mestre no app, cada jogador
 * no navegador dele) e nunca vai pela rede.
 */

export interface PreferenciaDeSom {
  /** 0 a 1, na escala da barra; o ganho aplicado é o quadrado (`lib/sons/sintetizador.ts`). */
  volume: number
  mudo: boolean
}

/** O pedido é "som baixo": o padrão já nasce discreto. */
export const PREFERENCIA_DE_SOM_PADRAO: PreferenciaDeSom = { volume: 0.35, mudo: false }
export const CHAVE_DA_PREFERENCIA_DE_SOM = 'lb-som'

/** O pedaço de `Storage` usado: o `localStorage` real ou um dublê nos testes. */
export type ArmazemDeSom = Pick<Storage, 'getItem' | 'setItem'>

function limitarVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume))
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

/** Storage bloqueado, vazio ou adulterado: cada campo inválido volta ao padrão, e nada lança. */
export function lerPreferenciaDeSom(armazem: ArmazemDeSom | null): PreferenciaDeSom {
  if (armazem === null) return { ...PREFERENCIA_DE_SOM_PADRAO }
  let dado: unknown
  try {
    const texto = armazem.getItem(CHAVE_DA_PREFERENCIA_DE_SOM)
    if (texto === null) return { ...PREFERENCIA_DE_SOM_PADRAO }
    dado = JSON.parse(texto)
  } catch {
    return { ...PREFERENCIA_DE_SOM_PADRAO }
  }
  if (!isRecord(dado)) return { ...PREFERENCIA_DE_SOM_PADRAO }
  const { volume, mudo } = dado
  return {
    // JSON.parse('1e999') dá Infinity: só número finito é volume.
    volume: typeof volume === 'number' && Number.isFinite(volume) ? limitarVolume(volume) : PREFERENCIA_DE_SOM_PADRAO.volume,
    mudo: typeof mudo === 'boolean' ? mudo : PREFERENCIA_DE_SOM_PADRAO.mudo,
  }
}

/** Storage cheio ou bloqueado (aba anônima): a escolha vale só enquanto a página estiver aberta. */
export function gravarPreferenciaDeSom(armazem: ArmazemDeSom | null, preferencia: PreferenciaDeSom): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE_DA_PREFERENCIA_DE_SOM, JSON.stringify({ volume: preferencia.volume, mudo: preferencia.mudo }))
  } catch {
    // Sem persistência: o som segue com a escolha em memória.
  }
}

interface SomState extends PreferenciaDeSom {
  /** Barra de volume: fora de 0..1 é limitado; o que não é número é ignorado. */
  setVolume: (volume: number) => void
  alternarMudo: () => void
}

/** Store com o armazém injetado, para o teste usar um dublê; o app usa `useSomStore`. */
export function criarSomStore(armazem: ArmazemDeSom | null) {
  return create<SomState>()((set, get) => {
    function gravar(): void {
      const { volume, mudo } = get()
      gravarPreferenciaDeSom(armazem, { volume, mudo })
    }
    return {
      ...lerPreferenciaDeSom(armazem),
      setVolume: (volume) => {
        if (!Number.isFinite(volume)) return
        set({ volume: limitarVolume(volume) })
        gravar()
      },
      alternarMudo: () => {
        set({ mudo: !get().mudo })
        gravar()
      },
    }
  })
}

function armazemDoNavegador(): ArmazemDeSom | null {
  try {
    // Só ler `localStorage` já lança em iframe sem permissão ou com o dado do site bloqueado.
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const useSomStore = criarSomStore(armazemDoNavegador())
