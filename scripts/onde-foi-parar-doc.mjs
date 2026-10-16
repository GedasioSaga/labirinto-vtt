// Gera docs/ui-onde-foi-parar.md a partir de client/e2e/helpers/ondeFoiParar.ts
// (a mesma lista que e2e/ui-onde-foi-parar.spec.ts alcança no app).
//
//   node --experimental-strip-types scripts/onde-foi-parar-doc.mjs
//
// Rode depois de mudar um caminho na lista: a tabela nunca é editada à mão.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCOS, FORA_DO_ESPECIFICADO } from '../client/e2e/helpers/ondeFoiParar.ts'

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const TELAS = { mestre: 'Mestre (editor, 1440x900)', 'mestre-sala-aberta': 'Mestre com a sala aberta', 'mestre-com-jogadores': 'Mestre com jogadores na sala', jogador: 'Jogador (celular, 390 px)' }
const ESCOPOS = { esquerda: 'livro do mestre', barra: 'barra de ferramentas', acoes: 'topo do livro do mestre', chip: 'chip da cena, no alto do mapa', direita: 'livro da mesa', pagina: 'tela' }

const celula = (texto) => String(texto).replaceAll('|', '\\|')
const alvo = ([papel, nome]) => `${papel} "${nome}"`
const caminho = (bloco, linha) => {
  const passos = linha.caminho.map((c) => `clicar ${alvo(c)}`)
  if (linha.tecla) passos.push(`tecla ${linha.tecla}`)
  return [`(${ESCOPOS[bloco.escopo]})`, ...passos].join(' > ')
}

const partes = [
  '# Onde foi parar cada controle',
  '',
  'Gerado por `scripts/onde-foi-parar-doc.mjs` a partir de `client/e2e/helpers/ondeFoiParar.ts`; não edite à mão.',
  'O spec `client/e2e/ui-onde-foi-parar.spec.ts` alcança cada linha no app pelo caminho anotado (fatia 0 do',
  '`docs/design/consolidado/PLANO.md`). A fatia que muda um controle de lugar troca o caminho na lista e roda o gerador.',
  '',
  '"Hoje" é o layout de 15/10/2026; "Vai para" vem do protótipo consolidado (ONDE do `app.js` + PLANO §1).',
  '',
]
let total = 0
for (const [tela, nomeDaTela] of Object.entries(TELAS)) {
  partes.push(`## ${nomeDaTela}`, '')
  for (const bloco of BLOCOS.filter((b) => b.tela === tela)) {
    partes.push(`### ${bloco.titulo}`, '', `Parte de: ${bloco.estado}. Vai para: ${bloco.vai}. Fatia: ${bloco.fatia}.`, '')
    partes.push('| Controle | Nome acessível | Caminho hoje | Vai para |', '|---|---|---|---|')
    for (const linha of bloco.linhas) {
      partes.push(`| ${celula(linha.controle)} | ${celula(alvo(linha.alvo))} | ${celula(caminho(bloco, linha))} | ${celula(linha.vai ?? '(do bloco)')} |`)
      total += 1
    }
    partes.push('')
  }
}
partes.push('## Fora do spec (e por quê)', '', '| Controle | Por que não está no spec |', '|---|---|')
for (const [controle, motivo] of FORA_DO_ESPECIFICADO) partes.push(`| ${celula(controle)} | ${celula(motivo)} |`)
partes.push('', `Total: ${total} controles em ${BLOCOS.length} blocos.`, '')

writeFileSync(join(RAIZ, 'docs', 'ui-onde-foi-parar.md'), partes.join('\n'))
console.log(`docs/ui-onde-foi-parar.md: ${total} controles em ${BLOCOS.length} blocos`)
