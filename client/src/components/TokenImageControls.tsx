export interface TokenImageControlsProps {
  image: string | null
  onChangeImage: () => void
  onClearImage: () => void
}

/**
 * Troca a imagem do Token selecionado — mesmo pipeline visual de
 * PortalControls (peça): "Escolher imagem..." quando não há uma ainda,
 * "Trocar imagem..." + "Remover imagem" quando já há. `image: null` volta o
 * token ao círculo genérico de sempre (drawTokenCircle em pixi/drawTokens.ts).
 *
 * Checagem por veracidade (`!image`), não `=== null`: o tipo `Token.image` é
 * obrigatório (`string | null`), mas um token construído fora do
 * type-checker (spec e2e via `page.evaluate`, ou mapa legado antes da
 * migração) pode chegar com o campo `undefined` — `undefined === null` é
 * `false`, o que cairia no branch "tem imagem" e quebraria em
 * `image.split(...)`. Mesma classe de bug corrigida em tokensRenderer.ts.
 */
export function TokenImageControls({ image, onChangeImage, onClearImage }: TokenImageControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Imagem do token</h2>
      {!image ? (
        <button type="button" className="lb-btn lb-btn--block" onClick={onChangeImage}>
          Escolher imagem...
        </button>
      ) : (
        <>
          <span className="lb-label">{image.split(/[\\/]/).pop()}</span>
          <button type="button" className="lb-btn lb-btn--block" onClick={onChangeImage}>
            Trocar imagem...
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onClearImage}>
            Remover imagem (voltar ao círculo)
          </button>
        </>
      )}
    </section>
  )
}
