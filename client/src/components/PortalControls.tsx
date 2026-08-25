export interface PortalControlsProps {
  linkedMapPath: string | null
  onCreateLinkedMap: () => void
  onLinkExistingMap: () => void
  onEnterLinkedMap: (path: string) => void
  onUnlink: () => void
}

/** Vira a peça selecionada em portal pra outro andar (outro map.json salvo em disco). */
export function PortalControls({ linkedMapPath, onCreateLinkedMap, onLinkExistingMap, onEnterLinkedMap, onUnlink }: PortalControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Andar</h2>
      {linkedMapPath === null ? (
        <div className="lb-section__row">
          <button type="button" className="lb-btn lb-btn--block" onClick={onCreateLinkedMap}>
            Novo andar em branco
          </button>
          <button type="button" className="lb-btn lb-btn--block" onClick={onLinkExistingMap}>
            Escolher mapa existente...
          </button>
        </div>
      ) : (
        <>
          <span className="lb-label">{linkedMapPath.split(/[\\/]/).pop()}</span>
          <button type="button" className="lb-btn lb-btn--block" onClick={() => onEnterLinkedMap(linkedMapPath)}>
            Entrar no andar
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onUnlink}>
            Desvincular
          </button>
        </>
      )}
    </section>
  )
}
