import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { theme } from '../../theme'
import { Botao } from '../grimorio/Botao'
import { Balao, type PropsDoGatilho } from '../grimorio/Balao'
import { Marcadores, type PaginaDoMarcador } from '../grimorio/Marcador'
import { MenuItem, MenuRotulo, MenuSeparador, Pop } from '../grimorio/Pop'
import { classes, movimentoReduzido } from '../grimorio/comum'
import { ADICIONAR_TOKEN, ADICIONAR_TOKEN_DICA, BOTAO_NOVO_TOKEN_ID, NOVO_TOKEN_CAMPO_ID } from '../NovoTokenForm'
import { useLivroDoMestreStore, type PaginaDoMestre } from '../../stores/livroDoMestreStore'
import { IconeDoLivro, type NomeDoIcone } from './icones'
import '../grimorio/grimorio.css'
import './livro.css'

/** O que o menu Arquivo faz: o mesmo que os botões da antiga barra de ações. */
export interface AcoesDoArquivo {
  onAbrir: () => void
  onImportarPasta: () => void
  onExportarPasta: () => void
  onExportarImagem: () => void
  /** Sem imagem de fundo, o menu só oferece importar uma: as conversões precisam dela. */
  temImagemDeFundo: boolean
  onImportarFundo: () => void
  onChaoDoFundo: () => void
  onLinhasDoFundo: () => void
  onRecriarMinimapa: () => void
  onInicio: () => void
}

export interface LivroDoMestreProps {
  /** As páginas (`FolhaDoLivro`, uma por marcador); só a aberta fica à vista. */
  children: ReactNode
  /** Há algo selecionado no mapa: o marcador Ficha ganha o ponto quando outra página está aberta. */
  temSelecao: boolean
  onDesfazer: () => void
  onRefazer: () => void
  podeDesfazer: boolean
  podeRefazer: boolean
  onSalvar: () => void
  arquivo: AcoesDoArquivo
  onAtalhos: () => void
  atalhosAbertos: boolean
  /** "Procurar" e Ctrl+K: a página Cena com o cursor na busca. */
  onProcurar: () => void
  /** A engrenagem (Configurações do mapa), já montada com a janela dela. */
  configuracoes: ReactNode
  /** Voltar à cena anterior; até a fatia 3 (chip da cena) mora aqui. Ausente = não há para onde voltar. */
  onVoltarCena?: () => void
  /** "Ver todas as cenas"; até a fatia 3 mora aqui. */
  onVerTodasAsCenas?: () => void
  /** Recebe o que o livro tapa do mapa: o livro aberto, ou só a lombada quando a página está recolhida. */
  obstaculoRef?: RefObject<HTMLElement | null>
}

const PAGINAS: readonly { id: PaginaDoMestre; rotulo: string; icone: NomeDoIcone }[] = [
  { id: 'ficha', rotulo: 'Ficha', icone: 'ficha' },
  { id: 'cena', rotulo: 'Cena', icone: 'cena' },
  { id: 'aventura', rotulo: 'Aventura', icone: 'aventura' },
  { id: 'acervo', rotulo: 'Acervo', icone: 'acervo' },
]

/** A folha nova assenta de 4 px em 150 ms (o `.pagina__corpo.entra` do protótipo); com movimento reduzido, só aparece. */
function entrarFolha(folha: HTMLElement | null): void {
  if (folha === null || typeof folha.animate !== 'function') return
  const reduzido = movimentoReduzido()
  folha.animate(
    reduzido ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
    { duration: reduzido ? 120 : 150, easing: reduzido ? 'ease' : theme.gr.easeOut },
  )
}

/** Botão de ícone do topo com o balão que diz o nome e o atalho. */
function BotaoDoTopo({ nome, balao, atalho, icone, ...resto }: { nome: string; balao?: string; atalho?: string; icone: NomeDoIcone; onClick: () => void; disabled?: boolean; 'aria-haspopup'?: 'dialog' | 'menu'; 'aria-expanded'?: boolean; ref?: Ref<HTMLButtonElement> }) {
  const { ref, ...props } = resto
  return (
    <Balao texto={balao ?? nome} atalho={atalho}>
      {(gatilho: PropsDoGatilho) => (
        <Botao
          soIcone
          aria-label={nome}
          {...gatilho}
          {...props}
          ref={(no) => {
            gatilho.ref(no)
            if (typeof ref === 'function') ref(no)
            else if (ref) ref.current = no
          }}
        >
          <IconeDoLivro nome={icone} />
        </Botao>
      )}
    </Balao>
  )
}

/**
 * O LIVRO DO MESTRE (fatia 2 do design consolidado): lombada com os quatro
 * marcadores e a fita, a página que recolhe para dentro dela e o topo fixo com
 * as ações do mapa (Desfazer, Refazer, Salvar, o menu Arquivo, os atalhos, o
 * "+ Token", Procurar e a engrenagem). As páginas trazem os componentes de
 * sempre, sem mudar o que fazem.
 */
export function LivroDoMestre(props: LivroDoMestreProps) {
  const { children, temSelecao, arquivo, obstaculoRef } = props
  const pagina = useLivroDoMestreStore((state) => state.pagina)
  const recolhido = useLivroDoMestreStore((state) => state.recolhido)
  const novoTokenAberto = useLivroDoMestreStore((state) => state.novoTokenAberto)
  const trocaAnimada = useLivroDoMestreStore((state) => state.trocaAnimada)
  const corpoId = useId()
  const [arquivoAberto, setArquivoAberto] = useState(false)
  const gatilhoDoArquivo = useRef<HTMLButtonElement>(null)
  const corpo = useRef<HTMLDivElement>(null)
  const livro = useRef<HTMLElement>(null)
  const lombada = useRef<HTMLDivElement>(null)
  // Trocar de página com o ponteiro anima a fita e a folha nova; pelo teclado, troca na hora.
  const peloPonteiro = useRef(false)

  useLayoutEffect(() => {
    if (obstaculoRef !== undefined) obstaculoRef.current = recolhido ? lombada.current : livro.current
  }, [obstaculoRef, recolhido])

  useLayoutEffect(() => {
    if (!useLivroDoMestreStore.getState().trocaAnimada) return
    entrarFolha(corpo.current?.querySelector<HTMLElement>(`[data-pagina="${pagina}"]`) ?? null)
  }, [pagina])

  const trocarPagina = (destino: PaginaDoMestre) => {
    const livro = useLivroDoMestreStore.getState()
    if (destino === livro.pagina) {
      if (livro.recolhido) livro.setRecolhido(false)
      return
    }
    livro.abrirPagina(destino, peloPonteiro.current)
  }

  // Pedido de foco no campo do nome, cumprido depois do commit: a Ficha pode
  // ter acabado de sair do `hidden` e o livro, do `inert` da lombada.
  const [focoNoCampo, setFocoNoCampo] = useState(0)
  useLayoutEffect(() => {
    if (focoNoCampo > 0) document.getElementById(NOVO_TOKEN_CAMPO_ID)?.focus()
  }, [focoNoCampo])

  const abrirNovoToken = () => {
    const livro = useLivroDoMestreStore.getState()
    if (!novoTokenAberto) {
      livro.abrirNovoToken()
      return
    }
    // Já aberto: o "+ Token" leva de volta ao campo, com o que já foi escrito,
    // também de outra página ou com o livro recolhido (o `autoFocus` do campo
    // só vale quando ele nasce).
    if (livro.pagina !== 'ficha' || livro.recolhido) livro.abrirPagina('ficha')
    setFocoNoCampo((n) => n + 1)
  }

  // Memorizado: o App renderiza a cada mudança do mapa (arrastar token,
  // pincelada) e um array novo faria a fita reler o layout em todo quadro.
  const marcadores = useMemo<PaginaDoMarcador<PaginaDoMestre>[]>(
    () =>
      PAGINAS.map((p) => ({
        id: p.id,
        rotulo: p.rotulo,
        icone: <IconeDoLivro nome={p.icone} />,
        ...(p.id === 'ficha' ? { ponto: temSelecao && pagina !== 'ficha' } : {}),
      })),
    [temSelecao, pagina],
  )

  const rotuloDoRecolher = recolhido ? 'Abrir a página' : 'Recolher a página'

  return (
    <aside
      className={classes('gr-livro gr-livro--esq', recolhido && 'gr-e-recolhido')}
      aria-label="Livro do mestre"
      ref={livro}
    >
      <div className="gr-lombada" ref={lombada}>
        <span className="gr-lombada__selo" aria-hidden="true">
          <IconeDoLivro nome="selo" />
        </span>
        <div
          className="gr-lombada__marcadores"
          onPointerDownCapture={() => {
            peloPonteiro.current = true
          }}
          onKeyDownCapture={() => {
            peloPonteiro.current = false
          }}
        >
          <Marcadores
            rotulo="Páginas do livro do mestre"
            paginas={marcadores}
            atual={pagina}
            onTrocar={trocarPagina}
            controla={corpoId}
            recolhido={recolhido}
            animar={trocaAnimada}
          />
        </div>
        <div className="gr-lombada__pe">
          <Balao texto={rotuloDoRecolher}>
            {(gatilho) => (
              <button
                type="button"
                className="gr-lombada__recolher"
                aria-expanded={!recolhido}
                aria-label={rotuloDoRecolher}
                {...gatilho}
                onClick={() => useLivroDoMestreStore.getState().setRecolhido(!recolhido)}
              >
                <IconeDoLivro nome="recolherEsq" />
              </button>
            )}
          </Balao>
        </div>
      </div>
      <div className="gr-pagina-trilho" inert={recolhido}>
        <div className="gr-pagina lb-inspector">
          <div className="gr-pagina__topo">
            <div className="gr-linha">
              <h1 className="gr-marca-app">Labirinto</h1>
              <BotaoDoTopo nome="Desfazer" atalho="Ctrl Z" icone="desfazer" onClick={props.onDesfazer} disabled={!props.podeDesfazer} />
              <BotaoDoTopo nome="Refazer" atalho="Ctrl Y" icone="refazer" onClick={props.onRefazer} disabled={!props.podeRefazer} />
              <BotaoDoTopo nome="Salvar" atalho="Ctrl S" icone="salvar" onClick={props.onSalvar} />
              <BotaoDoTopo
                ref={gatilhoDoArquivo}
                nome="Arquivo"
                balao="Arquivo: abrir, importar, exportar"
                icone="arquivo"
                aria-haspopup="menu"
                aria-expanded={arquivoAberto}
                onClick={() => setArquivoAberto((aberto) => !aberto)}
              />
              <BotaoDoTopo
                nome="Atalhos do teclado"
                atalho="?"
                icone="ajuda"
                aria-haspopup="dialog"
                aria-expanded={props.atalhosAbertos}
                onClick={props.onAtalhos}
              />
            </div>
            <div className="gr-linha">
              <Balao texto={ADICIONAR_TOKEN_DICA}>
                {(gatilho) => (
                  <Botao variante="latao" tamanho="p" id={BOTAO_NOVO_TOKEN_ID} aria-label={ADICIONAR_TOKEN} {...gatilho} onClick={abrirNovoToken}>
                    <IconeDoLivro nome="mais" />
                    Token
                  </Botao>
                )}
              </Balao>
              <Balao texto="Procurar no mapa" atalho="Ctrl K">
                {(gatilho) => (
                  <Botao variante="fantasma" tamanho="p" {...gatilho} onClick={props.onProcurar}>
                    <IconeDoLivro nome="busca" />
                    Procurar
                  </Botao>
                )}
              </Balao>
              <span className="gr-empurra" />
              {/* Até a fatia 3 (chip da cena), Voltar e "Ver todas as cenas" moram aqui. */}
              {props.onVoltarCena !== undefined && <BotaoDoTopo nome="Voltar" balao="Voltar à cena anterior" icone="voltar" onClick={props.onVoltarCena} />}
              {props.onVerTodasAsCenas !== undefined && (
                <BotaoDoTopo nome="Ver todas as cenas" icone="cenas" aria-haspopup="dialog" onClick={props.onVerTodasAsCenas} />
              )}
              {props.configuracoes}
            </div>
          </div>
          <div ref={corpo} className="gr-pagina__corpo" id={corpoId} role="tabpanel" aria-label="Página aberta">
            {children}
          </div>
        </div>
      </div>
      <Pop aberto={arquivoAberto} gatilho={gatilhoDoArquivo} onFechar={() => setArquivoAberto(false)} lado="dir" rotulo="Arquivo">
        <MenuItem icone={<IconeDoLivro nome="pasta" />} onClick={arquivo.onAbrir}>
          Abrir…
        </MenuItem>
        <MenuItem icone={<IconeDoLivro nome="importar" />} onClick={arquivo.onImportarPasta}>
          Importar mapa (pasta)…
        </MenuItem>
        <MenuItem icone={<IconeDoLivro nome="exportar" />} onClick={arquivo.onExportarPasta}>
          Exportar mapa (pasta)…
        </MenuItem>
        <MenuItem icone={<IconeDoLivro nome="imagem" />} onClick={arquivo.onExportarImagem}>
          Exportar imagem (PNG)…
        </MenuItem>
        <MenuSeparador />
        <MenuRotulo>Imagem de fundo e conversão</MenuRotulo>
        {arquivo.temImagemDeFundo ? (
          <>
            <MenuItem icone={<IconeDoLivro nome="imagem" />} onClick={arquivo.onImportarFundo}>
              Trocar imagem de fundo…
            </MenuItem>
            <MenuItem icone={<IconeDoLivro nome="varinha" />} onClick={arquivo.onChaoDoFundo}>
              Chão a partir da imagem
            </MenuItem>
            <MenuItem icone={<IconeDoLivro nome="varinha" />} onClick={arquivo.onLinhasDoFundo}>
              Linhas e portas a partir da imagem
            </MenuItem>
            <MenuItem icone={<IconeDoLivro nome="varinha" />} onClick={arquivo.onRecriarMinimapa}>
              Recriar minimapa completo
            </MenuItem>
          </>
        ) : (
          <MenuItem icone={<IconeDoLivro nome="imagem" />} onClick={arquivo.onImportarFundo}>
            Importar imagem de fundo…
          </MenuItem>
        )}
        <MenuSeparador />
        <MenuItem icone={<IconeDoLivro nome="casa" />} onClick={arquivo.onInicio}>
          Voltar ao início
        </MenuItem>
      </Pop>
    </aside>
  )
}
