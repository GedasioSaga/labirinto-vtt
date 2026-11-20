import { useEffect, useRef, useState } from 'react'
import type { Documento } from '../../documentos/tipos'
import { useDocumentosStore } from '../../stores/documentosStore'
import { useToastStore } from '../../stores/toastStore'

/** Quanto o disco espera a mão parar de escrever. A tela muda na hora; só a gravação espera. */
const ESPERA_PARA_GRAVAR_MS = 400

/**
 * O RASCUNHO da ficha do documento: a tela (e a prévia) mudam a cada tecla, e
 * a biblioteca grava quando a mão para, e ao fechar a ficha. Enquanto a ficha
 * está aberta, quem manda no que se vê é o rascunho: a volta do disco (o
 * título aparado) não passa por cima do que ele está digitando.
 */
export function useRascunhoDoDocumento(original: Documento): {
  rascunho: Documento
  mudar: (mudanca: (atual: Documento) => Documento) => void
  /** Grava já o que falta (antes de entregar, para a ficha do jogador sair com o título de agora). */
  gravarJa: () => void
} {
  const [rascunho, setRascunho] = useState(original)
  const atual = useRef(original)
  const pendente = useRef<Documento | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)

  const gravarJa = () => {
    if (relogio.current !== null) clearTimeout(relogio.current)
    relogio.current = null
    const documento = pendente.current
    pendente.current = null
    if (documento === null) return
    useDocumentosStore
      .getState()
      .salvar(documento)
      .catch((erro: unknown) => useToastStore.getState().push('error', erro instanceof Error ? erro.message : String(erro)))
  }

  // Fechar a ficha (voltar, outra página, outro documento) grava o que ficou.
  useEffect(() => () => gravarJa(), [])

  const mudar = (mudanca: (atual: Documento) => Documento) => {
    const proximo = mudanca(atual.current)
    if (proximo === atual.current) return
    atual.current = proximo
    pendente.current = proximo
    setRascunho(proximo)
    if (relogio.current !== null) clearTimeout(relogio.current)
    relogio.current = setTimeout(gravarJa, ESPERA_PARA_GRAVAR_MS)
  }

  return { rascunho, mudar, gravarJa }
}
