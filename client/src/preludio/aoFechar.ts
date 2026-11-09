import { ask } from '@tauri-apps/plugin-dialog'

/**
 * O PRELÚDIO NA HORA DE FECHAR A JANELA (X, Alt+F4). Este arquivo fica no
 * pacote principal e não importa nada do Prelúdio: a loja dele (que só baixa
 * quando o mestre abre o Prelúdio) se registra aqui ao carregar, e o aviso ao
 * fechar do `App.tsx` chama `preludioDeixaFechar` antes da pergunta dele.
 *
 * O texto digitado espera 250 ms no editor e mais 800 ms na loja antes de ir
 * ao disco; fechar nesse meio perdia a frase. Aqui ele é gravado na hora e,
 * se algo não gravou (disco recusou), a janela pergunta antes de fechar.
 *
 * Um segundo `onCloseRequested` só do Prelúdio não serviria: o do App termina
 * sem `preventDefault` e o Tauri destrói a janela antes de a gravação acabar.
 */

/** Grava o que falta; devolve `null` (tudo no disco) ou o motivo do que não gravou. */
export type SalvarAoFechar = () => Promise<string | null>

let salvarAoFechar: SalvarAoFechar | null = null

/** Gravar não pode prender a janela para sempre: passado isto, pergunta como se tivesse falhado. */
const ESPERA_PARA_GRAVAR_MS = 5000

const AINDA_GRAVANDO = 'O Prelúdio ainda está gravando as últimas mudanças.'

export function registrarSalvarAoFechar(salvar: SalvarAoFechar): void {
  salvarAoFechar = salvar
}

function depoisDe<T>(ms: number, valor: T): { promessa: Promise<T>; cancelar: () => void } {
  let relogio: ReturnType<typeof setTimeout> | undefined
  const promessa = new Promise<T>((resolve) => {
    relogio = setTimeout(() => resolve(valor), ms)
  })
  return { promessa, cancelar: () => clearTimeout(relogio) }
}

/** O texto da pergunta, a partir do motivo que veio da gravação. */
export function perguntaDoPreludio(motivo: string): string {
  return `${motivo.trim()} Se fechar o Labirinto agora, o que o Prelúdio não salvou se perde. Fechar mesmo assim?`
}

export interface OpcoesAoFechar {
  /** Se o diálogo não responder até aqui, fecha (a mesma regra do aviso do mapa). */
  esperaMaximaMs: number
  /** Diálogo nativo: `true` = fechar. */
  perguntar?: (texto: string) => Promise<boolean>
}

/**
 * `true` = pode fechar. Sem o Prelúdio aberto nesta sessão, responde na hora.
 * Diálogo que falha fecha, como no aviso do mapa: travar a janela é pior.
 */
export async function preludioDeixaFechar({ esperaMaximaMs, perguntar = (texto) => ask(texto, { title: 'Labirinto', kind: 'warning' }) }: OpcoesAoFechar): Promise<boolean> {
  if (salvarAoFechar === null) return true
  const prazo = depoisDe(ESPERA_PARA_GRAVAR_MS, AINDA_GRAVANDO)
  const motivo = await Promise.race([salvarAoFechar().catch((erro: unknown) => (erro instanceof Error ? erro.message : String(erro))), prazo.promessa])
  prazo.cancelar()
  if (motivo === null) return true
  const resposta = depoisDe(esperaMaximaMs, true)
  try {
    return await Promise.race([perguntar(perguntaDoPreludio(motivo)).catch(() => true), resposta.promessa])
  } finally {
    resposta.cancelar()
  }
}
