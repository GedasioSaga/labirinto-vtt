import { useEffect } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoFaixa } from '../grimorio/CampoFaixa'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { Nota } from '../grimorio/Nota'
import { faltaNoLugar, pontoDoDesafio, textoDoLugar } from '../../lib/desafios'
import { papeisDoDocumento, papelComTamanho, papelDepois, papelDeVolta, tamanhoDoPapel } from '../../documentos/noMapa'
import { sumiuDoMapa } from '../../documentos/recorte'
import { TAMANHO_DO_PAPEL_MAX, TAMANHO_DO_PAPEL_MIN, type DocumentoNoMapa } from '../../documentos/tipos'
import { useAdventureStore } from '../../stores/adventureStore'
import { useDocumentosStore } from '../../stores/documentosStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import { useDocumentosDoMestreStore, type ModoDeMarcarPapel } from './documentosDoMestreStore'

/**
 * "NO MAPA" da ficha do documento: os papéis deste documento na cena aberta
 * (o mesmo texto pode estar em mais de um lugar), o "Depois de lido" de cada
 * um, e o "Marcar no mapa" (um ponto, ou um objeto). O clique no mapa é do
 * canvas (`marcarPapelNoClique`, `pixi/PixiCanvas.tsx`).
 */

/** O "Tamanho" da ficha anda de 10 em 10%, a régua da etiqueta da alça de canto no mapa. */
const PASSO_DO_TAMANHO_PCT = 10

const OPCOES_DO_DEPOIS: readonly OpcaoDoSeg<DocumentoNoMapa['depois']>[] = [
  { valor: 'fica', rotulo: 'Fica no mapa' },
  { valor: 'some', rotulo: 'Some depois de pego' },
]

/** Leva a câmera do editor ao papel (e ao piso dele). Sem lugar que dê para achar: nada. */
function irAoPapel(papel: DocumentoNoMapa): void {
  const store = useMapStore.getState()
  const ponto = pontoDoDesafio(papel, store.map.props)
  if (ponto === null) return
  const piso = ponto.piso ?? 0
  if (piso !== store.pisoAtivo) store.setPisoAtivo(piso)
  useAdventureStore.getState().goToPoint(null, { x: ponto.x, y: ponto.y })
}

function TextoDoPego({ papel }: { papel: DocumentoNoMapa }) {
  if (papel.pego === undefined) return null
  const quem = papel.pego.por.trim() === '' ? 'alguém' : papel.pego.por
  return <span className="mg-tag mg-tag--latao">{sumiuDoMapa(papel) ? `${quem} pegou: saiu do mapa` : `${quem} leu primeiro`}</span>
}

function LinhaDoPapel({ papel, indice, total, onSeparar }: { papel: DocumentoNoMapa; indice: number; total: number; onSeparar: () => void }) {
  const props = useMapStore((estado) => estado.map.props)
  const marcando = useDocumentosDoMestreStore((estado) => estado.marcando)
  const { marcar } = useDocumentosDoMestreStore.getState()
  const { mudarPapelNoMapa, removePapelNoMapa } = useMapStore.getState()
  const falta = faltaNoLugar(papel, props)
  const mudandoEste = marcando !== null && marcando.papelId === papel.id
  return (
    <li className="doc-papel-no-mapa">
      <p className="doc-papel-no-mapa__onde">
        <strong>{total > 1 ? `Papel ${indice + 1}` : 'O papel'}</strong> {textoDoLugar(papel, props)}
        {(papel.piso ?? 0) !== 0 && ` · piso ${papel.piso}`}
      </p>
      {(falta !== null || papel.pego !== undefined) && (
        <p className="doc-papel-no-mapa__tags">
          {falta !== null && <span className="mg-tag mg-tag--perigo">{falta}</span>}
          <TextoDoPego papel={papel} />
        </p>
      )}
      <CampoSeg rotulo="Depois de lido" opcoes={OPCOES_DO_DEPOIS} valor={papel.depois} onChange={(depois) => mudarPapelNoMapa(papel.id, (atual) => papelDepois(atual, depois))} />
      <CampoFaixa
        rotulo="Tamanho"
        valor={Math.round(tamanhoDoPapel(papel) * 100)}
        min={TAMANHO_DO_PAPEL_MIN * 100}
        max={TAMANHO_DO_PAPEL_MAX * 100}
        passo={PASSO_DO_TAMANHO_PCT}
        formatar={(pct) => `${pct}%`}
        // O deslizante inteiro é UM passo do Ctrl+Z (a chave junta as mudanças seguidas deste papel).
        onChange={(pct) => mudarPapelNoMapa(papel.id, (atual) => papelComTamanho(atual, pct / 100), `papel-tamanho:${papel.id}`)}
      />
      <Nota>{papel.depois === 'some' ? 'O primeiro que ler leva o papel: ele sai do mapa para todos e fica só na lista de quem leu.' : 'Cada jogador que encostar e ler guarda uma cópia; o papel continua lá.'}</Nota>
      <Acoes>
        <Botao variante="fantasma" tamanho="p" onClick={() => irAoPapel(papel)} disabled={falta !== null}>
          Ver no mapa
        </Botao>
        <Botao variante="fantasma" tamanho="p" aria-pressed={mudandoEste} onClick={() => marcar({ docId: papel.docId, papelId: papel.id, modo: papel.lugar.tipo })}>
          Mudar de lugar
        </Botao>
        {papel.pego !== undefined && (
          <Botao variante="fantasma" tamanho="p" onClick={() => mudarPapelNoMapa(papel.id, papelDeVolta)}>
            Pôr de volta no mapa
          </Botao>
        )}
        {total > 1 && (
          <Botao variante="fantasma" tamanho="p" title="Este papel passa a ter um documento só dele, começando com este mesmo texto" onClick={onSeparar}>
            Separar num documento novo
          </Botao>
        )}
        <Botao variante="perigo" tamanho="p" onClick={() => removePapelNoMapa(papel.id)}>
          Tirar do mapa
        </Botao>
      </Acoes>
    </li>
  )
}

/**
 * "Separar num documento novo": a biblioteca ganha uma cópia deste documento,
 * o papel passa a apontar para ela, e a ficha abre a cópia. `antes` grava o
 * rascunho, para a cópia sair com o que acabou de ser escrito.
 */
function separarPapel(papel: DocumentoNoMapa, antes: () => void): void {
  antes()
  useDocumentosStore
    .getState()
    .copiar(papel.docId)
    .then((copia) => {
      useMapStore.getState().mudarPapelNoMapa(papel.id, (atual) => ({ ...atual, docId: copia.id }))
      useDocumentosDoMestreStore.getState().abrir(copia.id)
    })
    .catch((erro: unknown) => useToastStore.getState().push('error', erro instanceof Error ? erro.message : String(erro)))
}

export function SecaoNoMapa({ docId, antesDeSeparar }: { docId: string; antesDeSeparar: () => void }) {
  const documentos = useMapStore((estado) => estado.map.documentos)
  const marcando = useDocumentosDoMestreStore((estado) => estado.marcando)
  const { marcar, pararDeMarcar } = useDocumentosDoMestreStore.getState()
  const papeis = papeisDoDocumento({ documentos }, docId)
  const marcandoEste = marcando !== null && marcando.docId === docId ? marcando : null

  // Esc cancela a marcação em curso (como o "Marcar no mapa" da página Jogos).
  useEffect(() => {
    if (marcandoEste === null) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') useDocumentosDoMestreStore.getState().pararDeMarcar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [marcandoEste])

  const comecar = (modo: ModoDeMarcarPapel) => marcar({ docId, papelId: null, modo })

  return (
    <section className="doc-secao" aria-labelledby={`doc-mapa-${docId}`}>
      <h3 className="mg-secao" id={`doc-mapa-${docId}`}>
        No mapa <small>{papeis.length === 0 ? 'fora desta cena' : papeis.length === 1 ? '1 papel nesta cena' : `${papeis.length} papéis nesta cena`}</small>
      </h3>
      {papeis.length > 1 && <Nota>Estes papéis são o MESMO documento: mudar o texto ou o papel aqui muda todos eles. Para um deles ter texto próprio, use "Separar num documento novo".</Nota>}
      {papeis.length > 0 && (
        <ul className="doc-papeis-no-mapa">
          {papeis.map((papel, indice) => (
            <LinhaDoPapel key={papel.id} papel={papel} indice={indice} total={papeis.length} onSeparar={() => separarPapel(papel, antesDeSeparar)} />
          ))}
        </ul>
      )}
      {marcandoEste !== null ? (
        <div className="doc-marcando" role="status">
          <Nota>
            {marcandoEste.modo === 'ponto' ? 'Clique no mapa onde o papel fica.' : 'Clique no objeto do mapa onde o papel fica (a mesa, o baú, a estante).'} Esc cancela.
          </Nota>
          <Acoes>
            <Botao variante="fantasma" tamanho="p" onClick={pararDeMarcar}>
              Cancelar
            </Botao>
          </Acoes>
        </div>
      ) : (
        <>
          <Nota>{papeis.length === 0 ? 'Ponha o papel no chão: quem encostar nele lê e guarda nos Documentos.' : 'Marcar de novo põe OUTRO papel com este mesmo texto (mudar um muda todos). Para um texto diferente, volte e crie um Novo documento.'}</Nota>
          <Acoes>
            <Botao variante="latao" tamanho="p" onClick={() => comecar('ponto')}>
              Marcar no mapa
            </Botao>
            <Botao variante="fantasma" tamanho="p" onClick={() => comecar('objeto')}>
              Num objeto
            </Botao>
          </Acoes>
        </>
      )}
    </section>
  )
}
