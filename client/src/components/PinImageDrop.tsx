import { useState } from 'react'

/**
 * Atributo que diz aos atalhos do mapa (`alvoDoAtalho` em `PixiCanvas`) que o
 * Ctrl+V aqui é da área, não do "colar perto do cursor" do mapa.
 */
export const ATRIBUTO_COLA_IMAGEM = 'data-cola-imagem'

/** Primeira imagem de um colar ou de um soltar; `null` quando não veio imagem. */
export function imagemDaTransferencia(data: DataTransfer | null): File | null {
  if (data === null) return null
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith('image/')) return file
  }
  // "Copiar imagem" do navegador chega como item, nem sempre em `files`.
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file !== null) return file
    }
  }
  return null
}

const SEM_IMAGEM = 'Não veio imagem. Copie uma imagem (ou o arquivo dela) e tente de novo.'

interface PinImageDropProps {
  onImage: (blob: Blob) => void
}

/**
 * Área do painel do pino que recebe imagem de dois jeitos: arrastando um
 * arquivo para cima dela, ou clicando nela e colando com Ctrl+V. O terceiro
 * jeito, o diálogo de arquivo, continua no botão logo abaixo.
 */
export function PinImageDrop({ onImage }: PinImageDropProps) {
  const [arrastando, setArrastando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const receber = (data: DataTransfer | null): boolean => {
    const file = imagemDaTransferencia(data)
    setAviso(file === null ? SEM_IMAGEM : null)
    if (file !== null) onImage(file)
    return file !== null
  }

  return (
    <div
      className={`lb-pin-image-drop${arrastando ? ' lb-pin-image-drop--over' : ''}`}
      tabIndex={0}
      role="region"
      aria-label="Colar ou soltar imagem do ponto de interesse"
      {...{ [ATRIBUTO_COLA_IMAGEM]: '' }}
      onPaste={(event) => {
        if (receber(event.clipboardData)) event.preventDefault()
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setArrastando(true)
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(event) => {
        event.preventDefault()
        setArrastando(false)
        receber(event.dataTransfer)
      }}
      onBlur={() => setAviso(null)}
    >
      <span className="lb-pin-image-drop__main">{arrastando ? 'Solte para usar a imagem' : 'Arraste uma imagem para cá'}</span>
      <span className="lb-pin-image-drop__sub">ou clique aqui e cole com Ctrl+V</span>
      {aviso !== null && (
        <span className="lb-pin-image-drop__aviso" role="status">
          {aviso}
        </span>
      )}
    </div>
  )
}
