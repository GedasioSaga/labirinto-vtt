import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ABA_DAS_TECNICAS } from '../../lib/batalha/leituraDaFicha'
import { CAMPO_DA_DESCRICAO } from '../../lib/batalha/mecanica/conversao/comum'
import { converterItemDoCatalogo } from '../../lib/batalha/mecanica/conversao/ficha'
import { quemUsaDeTreino } from '../../lib/batalha/ensaio/ensaioDoItem'
import { camposDoTipo, chaveDoNomeDaEntrada, DADOS_DO_TIPO, itemLimpo, novoIdDeEntrada, type ItemDoCatalogo } from '../../lib/livros/catalogo'
import { novoCartao, type CartaoDaFicha } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { useToastStore } from '../../stores/toastStore'
import type { AoAbrirOEditor } from '../batalha/editor/EditorDaHabilidade'
import { cartaoNovoNoEditor } from '../batalha/editor/emBranco'

const EditorDaHabilidade = lazy(() => import('../batalha/editor/EditorDaHabilidade').then((modulo) => ({ default: modulo.EditorDaHabilidade })))

/** O id do cartão de mentira que leva a entrada ao editor (nunca vai a ficha nenhuma). */
const ID_DO_CARTAO_DA_ENTRADA = 'regra-da-habilidade'
/** A nova abre com o foco no Nome, para já escrever. */
const AO_ABRIR_DA_NOVA: AoAbrirOEditor = 'nome'

export interface HabilidadeDoCatalogoProps {
  /** A entrada que se edita; `null` = a "Nova habilidade". */
  item: ItemDoCatalogo | null
  sistema: SistemaDeRpg
  onClose: () => void
  /** Gravou: a entrada como ficou no catálogo e se é nova. */
  onSalvou: (item: ItemDoCatalogo, nova: boolean) => void
}

/** A entrada como cartão do editor: a de antes já convertida na leitura (D11; nada é gravado só por abrir); a nova, montada em branco. */
function cartaoDaEntrada(item: ItemDoCatalogo | null, sistema: SistemaDeRpg): CartaoDaFicha {
  if (item === null) return cartaoNovoNoEditor({ ...novoCartao(''), id: ID_DO_CARTAO_DA_ENTRADA }, 'mestre', { personagem: quemUsaDeTreino(sistema), sistema })
  const lida = converterItemDoCatalogo(item, sistema).item
  return {
    ...novoCartao(lida.nome),
    id: ID_DO_CARTAO_DA_ENTRADA,
    campos: { ...lida.campos, [CAMPO_DA_DESCRICAO]: lida.texto },
    ...(lida.mecanica === undefined ? {} : { mecanica: lida.mecanica }),
    ...(lida.alcance === undefined ? {} : { alcance: lida.alcance }),
    ...(lida.requisitos === undefined ? {} : { requisitos: lida.requisitos }),
    ...(lida.marcas === undefined ? {} : { marcas: lida.marcas }),
    ...(lida.acumulador === undefined ? {} : { acumulador: lida.acumulador }),
  }
}

/** A entrada que o cartão do editor dá, ou a frase do que falta (sem nome, nome repetido). */
function entradaDoCartao(cartao: CartaoDaFicha, item: ItemDoCatalogo | null, sistema: SistemaDeRpg): { item: ItemDoCatalogo } | { erro: string } {
  const ids = new Set(camposDoTipo(sistema, 'habilidade').map((campo) => campo.id))
  const campos = Object.fromEntries(Object.entries(cartao.campos).filter(([chave]) => ids.has(chave)))
  const limpo = itemLimpo({
    id: item?.id ?? novoIdDeEntrada(),
    tipo: 'habilidade',
    nome: cartao.nome,
    texto: cartao.campos[CAMPO_DA_DESCRICAO] ?? '',
    campos,
    mecanica: cartao.mecanica,
    alcance: cartao.alcance,
    requisitos: cartao.requisitos,
    marcas: cartao.marcas,
    acumulador: cartao.acumulador,
  })
  if (limpo === null) return { erro: 'Dê um nome à habilidade para guardar no catálogo.' }
  const chave = chaveDoNomeDaEntrada(limpo.nome)
  const repetida = useCatalogoStore.getState().itens.some((outro) => outro.id !== limpo.id && outro.tipo === 'habilidade' && chaveDoNomeDaEntrada(outro.nome) === chave)
  if (repetida) return { erro: `Já existe ${limpo.nome} em ${DADOS_DO_TIPO.habilidade.nome}. Use outro nome.` }
  return { item: limpo }
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * A HABILIDADE DO CATÁLOGO DO LIVRO (rework das habilidades, E7; decisão 1 do protótipo aprovado):
 * "Nova habilidade" e "Editar" abrem o MESMO editor da ficha direto, sem a janela de campos escritos
 * antes (Ação, Tipo, Efeito, Custo, Tempo e Dano moram só no editor). Fechar ou "Salvar no catálogo"
 * guardam a última versão completa; sem mudança, nada é gravado. Se não der para guardar (sem nome,
 * nome repetido, disco), uma janela pequena diz por quê: voltar ao editor ou descartar.
 */
export function HabilidadeDoCatalogo({ item, sistema, onClose, onSalvou }: HabilidadeDoCatalogoProps) {
  const inicial = useMemo(() => cartaoDaEntrada(item, sistema), [item, sistema])
  const treino = useMemo(() => ({ personagem: quemUsaDeTreino(sistema), sistema }), [sistema])
  const [cartao, setCartao] = useState(inicial)
  const [noEditor, setNoEditor] = useState(true)
  const [gravando, setGravando] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)

  const guardar = async () => {
    setNoEditor(false)
    if (JSON.stringify(cartao) === JSON.stringify(inicial)) {
      onClose()
      return
    }
    const montada = entradaDoCartao(cartao, item, sistema)
    if ('erro' in montada) {
      setProblema(montada.erro)
      return
    }
    setGravando(true)
    try {
      await useCatalogoStore.getState().salvarEntrada(montada.item)
    } catch (erro) {
      setGravando(false)
      setProblema(mensagemDoErro(erro))
      return
    }
    setGravando(false)
    onSalvou(montada.item, item === null)
    onClose()
  }

  const voltarAoEditor = () => {
    setProblema(null)
    setNoEditor(true)
  }
  const descartar = () => {
    useToastStore.getState().push('info', item === null ? 'A habilidade nova não foi guardada.' : `${item.nome} ficou como estava no catálogo.`)
    onClose()
  }

  return (
    <>
      {noEditor && (
        <Suspense fallback={null}>
          <EditorDaHabilidade
            cartao={cartao}
            ficha={treino}
            quemEdita="mestre"
            tecnicas={[]}
            podeOcultar={false}
            onChange={setCartao}
            onFechar={() => void guardar()}
            foraDaFicha
            trilha="vale no livro; o Trazer e o Juntar a levam às fichas"
            abaDoCartao={ABA_DAS_TECNICAS}
            {...(item === null ? { aoAbrir: AO_ABRIR_DA_NOVA } : {})}
          />
        </Suspense>
      )}
      {gravando && (
        <p className="lb-field__hint" role="status">
          Guardando no catálogo…
        </p>
      )}
      {problema !== null && <NaoGuardada motivo={problema} nova={item === null} onVoltar={voltarAoEditor} onDescartar={descartar} />}
    </>
  )
}

/** A janela pequena de quando o editor fechou e a habilidade não pôde ser guardada. Esc volta ao editor (nada se perde por engano). */
function NaoGuardada({ motivo, nova, onVoltar, onDescartar }: { motivo: string; nova: boolean; onVoltar: () => void; onDescartar: () => void }) {
  const tituloId = useId()
  const motivoId = useId()
  const voltar = useRef<HTMLButtonElement>(null)
  useEffect(() => voltar.current?.focus(), [])
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    evento.stopPropagation()
    if (evento.key === 'Escape') {
      evento.preventDefault()
      onVoltar()
    }
  }
  return createPortal(
    <div className="mu-modal-fundo">
      <div className="mu-modal" role="alertdialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={motivoId} onKeyDown={aoTeclar}>
        <div className="mu-modal__cab">
          <h2 className="mu-modal__tit" id={tituloId}>
            {nova ? 'A habilidade nova não foi guardada' : 'A habilidade não foi guardada'}
          </h2>
        </div>
        <div className="mu-modal__corpo">
          <p className="mu-campo__erro" id={motivoId}>
            {motivo}
          </p>
        </div>
        <div className="mu-modal__pe">
          <button type="button" className="mu-bt" onClick={onDescartar}>
            Descartar
          </button>
          <button ref={voltar} type="button" className="mu-bt mu-bt--primario" onClick={onVoltar}>
            Voltar ao editor
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
