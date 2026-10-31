import { useEffect, useState, type ReactNode } from 'react'
import { buildTokenPhotoData } from '../lib/tokenPhoto'
import { ATRIBUTO_COLA_IMAGEM, imagemDaTransferencia } from './PinImageDrop'

/** Os formatos que colar aceita: os mesmos que o "Escolher imagem…" oferece no diálogo. */
const TIPOS_ACEITOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export const SEM_IMAGEM_PARA_COLAR = 'A área de transferência não tem imagem. Copie uma imagem (PNG, JPG, WebP ou GIF) e cole de novo com Ctrl+V.'
export const TIPO_QUE_NAO_COLA = 'essa imagem não é PNG, JPG, WebP nem GIF — copie a imagem num desses formatos'

/**
 * A imagem colada vira a MESMA cópia que o "Escolher imagem…" da ficha grava
 * (`buildTokenPhotoData`: até 256 px, embutida, cabe numa mensagem da mesa) —
 * no mestre (`escolherImagemDaFicha`) e no jogador (`escolherImagemNoAparelho`)
 * o caminho do arquivo acaba nela também. Lança com a mensagem para a tela.
 */
export async function imagemColadaDaFicha(data: DataTransfer | null): Promise<string> {
  const arquivo = imagemDaTransferencia(data)
  if (arquivo === null) throw new Error(SEM_IMAGEM_PARA_COLAR)
  if (!TIPOS_ACEITOS.has(arquivo.type)) throw new Error(TIPO_QUE_NAO_COLA)
  return buildTokenPhotoData(arquivo)
}

/** Apaga o aviso anterior e entrega a imagem pronta, ou o aviso do que deu errado. */
function colar(data: DataTransfer | null, onImagem: (imagem: string) => void, onAviso: (aviso: string | null) => void): void {
  onAviso(null)
  imagemColadaDaFicha(data).then(onImagem, (erro: unknown) => onAviso(erro instanceof Error ? erro.message : String(erro)))
}

/** Colar dentro de um campo de texto é colar texto: nunca vira imagem. */
function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || alvo.closest('input, textarea, select') !== null)
}

interface CampoQueColaImagemProps {
  className: string
  /** Nome do campo para leitor de tela: de quem é a imagem. */
  rotulo: string
  onImagem: (imagem: string) => void
  /** Aviso para a tela (sem imagem, formato errado, pesada demais); `null` apaga o anterior. */
  onAviso: (aviso: string | null) => void
  children: ReactNode
}

/**
 * Campo de imagem da ficha (retrato e imagem do cartão) que aceita Ctrl+V:
 * com o foco nele (clicar no quadrado foca o campo; Tab chega nos botões
 * dele) ou com o mouse em cima. O mouse em cima não rouba o colar de um campo
 * de texto focado em outro lugar, nem o de outra área de colar imagem.
 */
export function CampoQueColaImagem({ className, rotulo, onImagem, onAviso, children }: CampoQueColaImagemProps) {
  const [campo, setCampo] = useState<HTMLDivElement | null>(null)
  const [sobre, setSobre] = useState(false)

  useEffect(() => {
    if (!sobre || campo === null) return
    const colarComOMouseEmCima = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return
      const alvo = event.target
      // Dentro do campo quem responde é o `onPaste` dele.
      if (alvo instanceof Node && campo.contains(alvo)) return
      if (ehCampoDeTexto(alvo)) return
      if (alvo instanceof Element && alvo.closest(`[${ATRIBUTO_COLA_IMAGEM}]`) !== null) return
      event.preventDefault()
      colar(event.clipboardData, onImagem, onAviso)
    }
    document.addEventListener('paste', colarComOMouseEmCima)
    return () => document.removeEventListener('paste', colarComOMouseEmCima)
  }, [sobre, campo, onImagem, onAviso])

  return (
    <div
      ref={setCampo}
      className={`lb-cola-imagem ${className}`}
      role="group"
      aria-label={rotulo}
      tabIndex={0}
      // Atalhos do mapa (`alvoDoAtalho` em PixiCanvas): o Ctrl+V aqui é da imagem, não dos itens do mapa.
      {...{ [ATRIBUTO_COLA_IMAGEM]: '' }}
      onPaste={(event) => {
        event.preventDefault()
        colar(event.clipboardData, onImagem, onAviso)
      }}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
    >
      {children}
      <span className="lb-cola-imagem__dica">ou cole com Ctrl+V</span>
    </div>
  )
}
