import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { captureEditorWork } from '../stores/recoveryAutosave'
import { serializeRecoveryCopy, writeRecoveryCopy } from '../lib/recoveryCopy'

interface EditorErrorBoundaryProps {
  children: ReactNode
}

/** Onde está a cópia de emergência: ainda não pedida, gravando, guardada no app, baixada (navegador) ou perdida. */
type EstadoDaCopia = 'nada' | 'salvando' | 'no-disco' | 'baixada' | 'falhou'

interface EditorErrorBoundaryState {
  failed: boolean
  copia: EstadoDaCopia
}

const NOME_DO_ARQUIVO_BAIXADO = 'labirinto-copia-de-emergencia.json'

const AVISO_DA_COPIA: Record<EstadoDaCopia, string> = {
  nada: '',
  salvando: 'Guardando a cópia...',
  'no-disco': 'Cópia guardada. Em Voltar ao início, o botão Recuperar traz o mapa de volta.',
  baixada: 'Fora do app instalado não há onde guardar: a cópia foi baixada como arquivo.',
  falhou: 'Não deu para guardar a cópia. O mapa continua na memória enquanto esta janela ficar aberta.',
}

/** No navegador não há disco do app: a cópia sai como download, para o trabalho não sumir. */
function baixarCopia(texto: string): void {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = NOME_DO_ARQUIVO_BAIXADO
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Rede de segurança do app do mestre: um erro ao desenhar a tela apagava tudo
 * (página branca) e o trabalho não salvo sumia junto. Aqui vira uma tela com
 * saída. Os mapas moram nos stores, fora do React: o erro desmonta a tela, não
 * o trabalho. "Salvar uma cópia de emergência" grava a mesma cópia de
 * recuperação do salvamento automático (o menu oferece Recuperar); "Voltar ao
 * início" monta o App de novo, que abre na tela inicial.
 *
 * Mora fora do `App.tsx` porque precisa pegar o erro do próprio App.
 */
export class EditorErrorBoundary extends Component<EditorErrorBoundaryProps, EditorErrorBoundaryState> {
  state: EditorErrorBoundaryState = { failed: false, copia: 'nada' }

  static getDerivedStateFromError(): Partial<EditorErrorBoundaryState> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A tela do mestre parou de ser desenhada', error, info.componentStack)
  }

  private salvarCopia = async (): Promise<void> => {
    this.setState({ copia: 'salvando' })
    try {
      // Caminho do mapa solto: o App que sabia dele caiu. Mapa em aventura (o normal) leva a pasta na própria cópia.
      const copia = await captureEditorWork(() => null, Date.now())
      try {
        await writeRecoveryCopy(copia)
        this.setState({ copia: 'no-disco' })
      } catch {
        // Sem disco do app (navegador) ou disco recusou: o trabalho sai como download.
        baixarCopia(serializeRecoveryCopy(copia))
        this.setState({ copia: 'baixada' })
      }
    } catch {
      this.setState({ copia: 'falhou' })
    }
  }

  private voltarAoInicio = (): void => {
    this.setState({ failed: false, copia: 'nada' })
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    const { copia } = this.state
    return (
      <div className="lb-dialog-backdrop">
        <div className="lb-panel lb-dialog" role="alertdialog" aria-labelledby="erro-do-editor-titulo" aria-describedby="erro-do-editor-texto">
          <header className="lb-dialog__head">
            <h2 id="erro-do-editor-titulo" className="lb-dialog__title">
              A tela parou de ser desenhada
            </h2>
          </header>
          <div className="lb-dialog__body" style={{ padding: 'var(--lb-space-4)' }}>
            <p id="erro-do-editor-texto" style={{ margin: 0, lineHeight: 'var(--lb-font-leading-normal)' }}>
              Um erro interrompeu o editor. O mapa continua na memória: guarde uma cópia de emergência antes de voltar ao
              início.
            </p>
            <p role="status" style={{ margin: 'var(--lb-space-2) 0 0', minHeight: '1.5em' }}>
              {AVISO_DA_COPIA[copia]}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--lb-space-2)',
              justifyContent: 'flex-end',
              padding: 'var(--lb-space-4)',
              paddingTop: 0,
            }}
          >
            <button type="button" className="lb-btn lb-btn--ghost" onClick={this.voltarAoInicio}>
              Voltar ao início
            </button>
            <button
              type="button"
              className="lb-btn lb-btn--primary"
              disabled={copia === 'salvando'}
              onClick={() => void this.salvarCopia()}
            >
              Salvar uma cópia de emergência
            </button>
          </div>
        </div>
      </div>
    )
  }
}
