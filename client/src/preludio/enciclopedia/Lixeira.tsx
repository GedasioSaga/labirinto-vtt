import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { ROTULO_DO_TIPO } from '../../lib/preparo/enciclopedia'
import { naLixeira } from '../../lib/preparo/lixeira'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { quandoFoiParaALixeira } from '../quadro/Quadros'
import { Retrato } from './Imagens'
import { apagarDeVez, restaurarDaLixeira } from './lixeiraDoPreludio'
import './lixeira.css'

/**
 * A LIXEIRA DOS VERBETES (17/11), como a dos Quadros: o que o mestre excluiu
 * fica aqui, inteiro, até ele restaurar ou apagar de vez. Abre pelo botão
 * "Lixeira (N)" das listas da Enciclopédia, que só aparece quando há algo dentro.
 *
 * "Apagar de vez" pergunta na própria linha (o foco vai para o Cancelar) e tira
 * o arquivo do disco: é a única coisa aqui que não tem volta.
 */

export function IconeLixeira() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h12M8 6V4.5h4V6M6 6l.7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6M8.7 9v4.5M11.3 9v4.5" />
    </svg>
  )
}

function nomeDe(verbete: Verbete): string {
  return verbete.titulo || 'Sem nome'
}

interface LinhaProps {
  readonly verbete: Verbete
  readonly campanha: string
  readonly travado: boolean
  readonly ocupado: boolean
  readonly perguntando: boolean
  readonly aoVer: () => void
  readonly aoRestaurar: () => void
  readonly aoPerguntar: (perguntar: boolean) => void
  readonly aoApagar: () => void
}

function LinhaDaLixeira({ verbete, campanha, travado, ocupado, perguntando, aoVer, aoRestaurar, aoPerguntar, aoApagar }: LinhaProps) {
  const cancelar = useRef<HTMLButtonElement>(null)
  const apagar = useRef<HTMLButtonElement>(null)
  const nome = nomeDe(verbete)

  // A pergunta abre com o foco no Cancelar (o botão seguro); desistir devolve o foco ao "Apagar de vez".
  useEffect(() => {
    if (perguntando) cancelar.current?.focus()
  }, [perguntando])
  const desistir = () => {
    aoPerguntar(false)
    requestAnimationFrame(() => apagar.current?.focus())
  }

  return (
    <li className="pr-lixeira__item" aria-busy={ocupado}>
      <div className="pr-lixeira__linha">
        <Retrato nome={verbete.titulo} midia={(verbete.formas.find((forma) => forma.id === verbete.formaAtivaId) ?? verbete.formas[0])?.retrato} tamanho="p" />
        <div className="pr-lixeira__texto">
          <span className="pr-lixeira__nome">{nome}</span>
          <span className="pr-lixeira__meta">
            {[ROTULO_DO_TIPO[verbete.tipo].um, campanha, quandoFoiParaALixeira(verbete.lixeira ?? '')].filter((parte) => parte !== '').join(' · ')}
          </span>
        </div>
        {!perguntando && (
          <div className="pr-lixeira__acoes">
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoVer}>
              Ver
            </button>
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado || ocupado} aria-label={`Restaurar ${nome}`} onClick={aoRestaurar}>
              Restaurar
            </button>
            <button ref={apagar} type="button" className="gr-bt gr-bt--p gr-bt--perigo" disabled={travado || ocupado} aria-label={`Apagar ${nome} de vez`} onClick={() => aoPerguntar(true)}>
              Apagar de vez
            </button>
          </div>
        )}
      </div>
      {perguntando && (
        <div
          className="pr-lixeira__pergunta"
          role="group"
          aria-label={`Apagar ${nome} de vez`}
          onKeyDown={(evento) => {
            if (evento.key !== 'Escape') return
            evento.preventDefault()
            evento.stopPropagation()
            desistir()
          }}
        >
          <p className="pr-lixeira__pergunta-texto">
            Apagar <b>{nome}</b> de vez? O arquivo sai do computador e não dá para desfazer. Os textos e os quadros que citam {nome} ficam só com o nome.
          </p>
          <div className="pr-lixeira__acoes">
            <button ref={cancelar} type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={desistir}>
              Cancelar
            </button>
            <button type="button" className="gr-bt gr-bt--p gr-bt--perigo" disabled={travado || ocupado} onClick={aoApagar}>
              Apagar de vez
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

interface LixeiraProps {
  aberta: boolean
  aoFechar: () => void
}

export function Lixeira({ aberta, aoFechar }: LixeiraProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const jogados = useMemo(() => naLixeira(verbetes.values()), [verbetes])
  const [perguntando, setPerguntando] = useState<string | null>(null)
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(new Set())
  const [aviso, setAviso] = useState<{ readonly texto: string; readonly falhou: boolean } | null>(null)
  const avisoRef = useRef<HTMLParagraphElement>(null)

  // Restaurar e "Apagar de vez" tiram a linha clicada da lista, e o foco cairia no body:
  // fora da caixa, o Esc não fecha e o Tab escapa. O foco vai para o aviso, dentro da caixa.
  useEffect(() => {
    if (aviso !== null) avisoRef.current?.focus()
  }, [aviso])

  const campanhaDe = (verbete: Verbete) => verbete.campanhas.map((id) => campanhas.find((campanha) => campanha.id === id)?.nome).find((nome) => nome !== undefined) ?? ''

  const restaurar = (verbete: Verbete) => {
    const feito = restaurarDaLixeira([verbete.id])
    setAviso({ texto: feito.texto, falhou: feito.ids.length === 0 })
  }

  const apagar = async (verbete: Verbete) => {
    setOcupados((antes) => new Set(antes).add(verbete.id))
    const motivo = await apagarDeVez(verbete.id)
    setOcupados((antes) => {
      const depois = new Set(antes)
      depois.delete(verbete.id)
      return depois
    })
    setPerguntando(null)
    setAviso(motivo === null ? { texto: `${nomeDe(verbete)} foi apagado de vez.`, falhou: false } : { texto: `${nomeDe(verbete)} não foi apagado: ${motivo}`, falhou: true })
  }

  const fechar = () => {
    setPerguntando(null)
    setAviso(null)
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberta}
      titulo="Lixeira"
      onFechar={fechar}
      descricao="O que você excluiu fica aqui, inteiro. Não aparece nas listas, na busca nem para os jogadores, até você restaurar."
    >
      <div className="pr-lixeira">
        <p ref={avisoRef} tabIndex={-1} className={`pr-lixeira__aviso${aviso?.falhou === true ? ' pr-lixeira__aviso--falhou' : ''}`} role={aviso?.falhou === true ? 'alert' : 'status'}>
          {aviso?.texto ?? ''}
        </p>
        {jogados.length === 0 ? (
          <p className="pr-quieto">A Lixeira está vazia.</p>
        ) : (
          <ul className="pr-lixeira__lista" aria-label="Na Lixeira">
            {jogados.map((verbete) => (
              <LinhaDaLixeira
                key={verbete.id}
                verbete={verbete}
                campanha={campanhaDe(verbete)}
                travado={travado}
                ocupado={ocupados.has(verbete.id)}
                perguntando={perguntando === verbete.id}
                aoVer={() => {
                  fechar()
                  // Só verbete da Enciclopédia vai para a Lixeira: a página dele abre com o aviso e o Restaurar.
                  ir({ secao: 'enciclopedia', tipo: verbete.tipo, verbeteId: verbete.id })
                }}
                aoRestaurar={() => restaurar(verbete)}
                aoPerguntar={(perguntar) => setPerguntando(perguntar ? verbete.id : null)}
                aoApagar={() => void apagar(verbete)}
              />
            ))}
          </ul>
        )}
      </div>
    </Dialogo>
  )
}

/**
 * "Lixeira (N)", para o cabeçalho das listas da Enciclopédia: abre a Lixeira.
 * Só aparece quando há algo dentro (ou com a Lixeira aberta, para ela não sumir
 * debaixo do mestre quando ele restaura o último).
 *
 * `aoAbrir`: a lista tira o aviso "foi para a Lixeira · Desfazer" dela. Dentro
 * da Lixeira quem desfaz é o Restaurar, e o aviso ficaria falando de algo que
 * o mestre pode acabar de ter restaurado.
 */
export function BotaoDaLixeira({ aoAbrir }: { aoAbrir?: () => void }) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const quantos = useMemo(() => naLixeira(verbetes.values()).length, [verbetes])
  const [aberta, setAberta] = useState(false)
  const abrir = () => {
    aoAbrir?.()
    setAberta(true)
  }
  return (
    <>
      {(quantos > 0 || aberta) && (
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma pr-lixeira__botao" aria-haspopup="dialog" onClick={abrir}>
          <IconeLixeira />
          Lixeira ({quantos})
        </button>
      )}
      <Lixeira aberta={aberta} aoFechar={() => setAberta(false)} />
    </>
  )
}
