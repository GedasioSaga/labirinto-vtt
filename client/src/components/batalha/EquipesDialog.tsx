import { useRef, useState, type CSSProperties } from 'react'
import { EQUIPES_MAX, NOME_DA_EQUIPE_MAX, NOME_DA_EQUIPE_PADRAO, equipeDe, novoIdDeEquipe, type Equipe } from '../../lib/batalha/equipes'
import type { Personagem } from '../../lib/personagem'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoCor, type OpcaoDeCor } from '../grimorio/CampoCor'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Dialogo } from '../grimorio/Dialogo'
import './batalha.css'

/**
 * EQUIPES (decisão 1): nome, cor e quem está em cada uma. O membro é o
 * PERSONAGEM (Q2), gravado junto dos personagens, na aventura ou na pasta
 * (Q5). Jogadores da mesma equipe veem vida, SP e o perfil uns dos outros;
 * NPC nunca. O mestre troca alguém de lado a qualquer hora — com a batalha
 * ligada, a troca entra no registro e pode ser desfeita (quem monta decide
 * por onde a troca passa: `onTrocar`).
 */

/** As cores de equipe: dado gravado no arquivo (`#rrggbb`), não estilo da tela. */
export const CORES_DE_EQUIPE: readonly OpcaoDeCor[] = [
  { valor: '#e0a44a', nome: 'Latão' },
  { valor: '#e2645a', nome: 'Brasa' },
  { valor: '#79a9cc', nome: 'Maré' },
  { valor: '#7fb48a', nome: 'Musgo' },
  { valor: '#ab93d6', nome: 'Arcano' },
  { valor: '#d68fb0', nome: 'Rosa' },
  { valor: '#c9b458', nome: 'Ocre' },
  { valor: '#a2a09a', nome: 'Pergaminho' },
]

const SEM_EQUIPE = ''

export interface EquipesDialogProps {
  aberto: boolean
  equipes: readonly Equipe[]
  /** Os personagens do dono ativo (aventura ou pasta). */
  personagens: readonly Personagem[]
  /** Grava a lista inteira (criar, renomear, cor, apagar). */
  onSalvarEquipes: (equipes: Equipe[]) => void
  /** Põe o personagem numa equipe, ou em nenhuma. */
  onTrocar: (personagemId: string, equipeId: string | null) => void
  /** A batalha está ligada na cena aberta: a troca entra no registro. */
  emBatalha: boolean
  onFechar: () => void
}

function corLivre(equipes: readonly Equipe[]): string {
  const usadas = new Set(equipes.map((equipe) => equipe.cor))
  return (CORES_DE_EQUIPE.find((cor) => !usadas.has(cor.valor)) ?? CORES_DE_EQUIPE[0])?.valor ?? '#e0a44a'
}

export function EquipesDialog({ aberto, equipes, personagens, onSalvarEquipes, onTrocar, emBatalha, onFechar }: EquipesDialogProps) {
  const [apagando, setApagando] = useState<Equipe | null>(null)
  const cancelar = useRef<HTMLButtonElement>(null)
  const cheia = equipes.length >= EQUIPES_MAX
  const nomeDe = new Map(personagens.map((personagem) => [personagem.id, personagem.nome || 'Sem nome']))

  const mudar = (id: string, mudanca: Partial<Pick<Equipe, 'nome' | 'cor'>>) => onSalvarEquipes(equipes.map((equipe) => (equipe.id === id ? { ...equipe, ...mudanca } : equipe)))
  const criar = () => {
    if (cheia) return
    onSalvarEquipes([...equipes, { id: novoIdDeEquipe(), nome: `Equipe ${equipes.length + 1}`, cor: corLivre(equipes), membros: [] }])
  }

  return (
    <>
      <Dialogo
        aberto={aberto}
        titulo="Equipes"
        descricao={emBatalha ? 'Com a batalha ligada, trocar alguém de equipe entra no registro e pode ser desfeito.' : 'Jogadores da mesma equipe veem vida, SP e o perfil uns dos outros. NPC nunca.'}
        onFechar={onFechar}
      >
        <div className="bt-equipes" data-gr-foco="">
          {equipes.length === 0 ? (
            <p className="bt-texto">Nenhuma equipe: todo jogador é aliado de todo jogador. Crie equipes para separar lados (por exemplo, dois grupos rivais).</p>
          ) : (
            <ul className="bt-equipes__lista" aria-label="Equipes">
              {equipes.map((equipe) => (
                <li key={equipe.id} className="bt-equipe" style={{ '--lado': equipe.cor } as CSSProperties}>
                  <CampoTexto rotulo="Nome" valor={equipe.nome} maxLength={NOME_DA_EQUIPE_MAX} placeholder={NOME_DA_EQUIPE_PADRAO} onChange={(nome) => mudar(equipe.id, { nome })} />
                  <CampoCor rotulo="Cor" opcoes={CORES_DE_EQUIPE} valor={equipe.cor} onChange={(cor) => mudar(equipe.id, { cor })} />
                  {equipe.membros.length === 0 ? (
                    <p className="bt-texto">Ninguém nesta equipe ainda. Escolha a equipe de cada personagem na lista abaixo.</p>
                  ) : (
                    <ul className="bt-equipe__membros" aria-label={`Membros de ${equipe.nome}`}>
                      {equipe.membros.map((id) => (
                        <li key={id} className="bt-chip">
                          {nomeDe.get(id) ?? 'Personagem apagado'}
                          <Botao variante="fantasma" tamanho="p" soIcone aria-label={`Tirar ${nomeDe.get(id) ?? 'o personagem'} da equipe`} onClick={() => onTrocar(id, null)}>
                            <span aria-hidden="true">×</span>
                          </Botao>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Acoes>
                    <Botao variante="fantasma" tamanho="p" onClick={() => setApagando(equipe)}>
                      Apagar equipe
                    </Botao>
                  </Acoes>
                </li>
              ))}
            </ul>
          )}
          <Acoes>
            <Botao tamanho="p" aria-disabled={cheia} title={cheia ? `No máximo ${EQUIPES_MAX} equipes` : undefined} onClick={criar}>
              Nova equipe
            </Botao>
          </Acoes>
          <section aria-labelledby="bt-equipes-pessoas">
            <h3 className="bt-secao__titulo" id="bt-equipes-pessoas">
              Personagens
            </h3>
            {personagens.length === 0 ? (
              <p className="bt-texto">Nenhum personagem nesta aventura (nem na pasta).</p>
            ) : (
              <ul className="bt-pessoas">
                {personagens.map((personagem) => {
                  const atual = equipeDe(personagem.id, equipes)
                  return (
                    <li key={personagem.id} className="bt-pessoa">
                      <span className="bt-pessoa__nome">
                        {personagem.nome || 'Sem nome'}
                        <small>{personagem.tipo === 'npc' ? 'NPC' : 'Jogador'}</small>
                      </span>
                      <select
                        aria-label={`Equipe de ${personagem.nome || 'Sem nome'}`}
                        value={atual?.id ?? SEM_EQUIPE}
                        disabled={equipes.length === 0}
                        title={equipes.length === 0 ? 'Crie uma equipe primeiro' : undefined}
                        onChange={(evento) => onTrocar(personagem.id, evento.currentTarget.value === SEM_EQUIPE ? null : evento.currentTarget.value)}
                      >
                        <option value={SEM_EQUIPE}>Sem equipe</option>
                        {equipes.map((equipe) => (
                          <option key={equipe.id} value={equipe.id}>
                            {equipe.nome}
                          </option>
                        ))}
                      </select>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </Dialogo>
      <Dialogo
        aberto={apagando !== null}
        alerta
        pequeno
        titulo="Apagar equipe?"
        focoInicial={cancelar}
        onFechar={() => setApagando(null)}
        descricao={apagando !== null && apagando.membros.length > 0 ? `${apagando.membros.length === 1 ? 'O membro fica' : `Os ${apagando.membros.length} membros ficam`} sem equipe.` : 'A equipe está vazia.'}
      >
        <Acoes>
          <Botao
            variante="perigo"
            onClick={() => {
              if (apagando !== null) onSalvarEquipes(equipes.filter((equipe) => equipe.id !== apagando.id))
              setApagando(null)
            }}
          >
            Apagar {apagando?.nome ?? ''}
          </Botao>
          <Botao ref={cancelar} variante="fantasma" onClick={() => setApagando(null)}>
            Cancelar
          </Botao>
        </Acoes>
      </Dialogo>
    </>
  )
}
