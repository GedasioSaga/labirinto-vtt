'use strict'
/**
 * DE QUE CÓDIGO É A MEDIDA M9 DO APP (22/10/2026). O M9 do gerar-provas é
 * julgado pela medida que client/e2e/task-door-app-1440.spec.ts grava em
 * provas/desempenho-app.json (PROVA_PORTA_APP=1), e essa medida fica no
 * repositório: sem dizer de que código ela é, uma mudança que deixasse as
 * portas lentas seguiria aprovada pelo número velho. A impressão é o sha256 do
 * caminho e do conteúdo de cada fonte de porta que a medida exercita, mais o
 * próprio teste. O teste grava a impressão junto da medida e o gerar-provas
 * reprova o M9 quando a de agora não bate.
 *
 *   node docs/design/porta-animacoes/app/fontesDoDesempenho.cjs
 *
 * imprime a impressão em JSON: é assim que o teste do app a lê.
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..')
/** Arquivos e pastas, relativos à raiz do repositório. Pasta entra com o código dela, menos os testes. */
const FONTES = [
  'client/src/pixi/drawDoors.ts',
  'client/src/pixi/animadorDePortas.ts',
  'client/src/portas',
  'client/src/animacoes/porta',
  'client/src/lib/pacoteDeAnimacoes.ts',
  'client/src/lib/corDaPorta.ts',
  'client/e2e/task-door-app-1440.spec.ts',
]
const CODIGO = /\.(ts|tsx|json)$/
const TESTE = /\.test\.tsx?$/

/** Os arquivos de uma fonte. Fonte que sumiu lança: a lista acima precisa acompanhar o código. */
function arquivosDe(relativo) {
  if (!fs.statSync(path.join(RAIZ, relativo)).isDirectory()) return [relativo]
  return fs.readdirSync(path.join(RAIZ, relativo), { withFileTypes: true }).flatMap((entrada) => {
    const filho = `${relativo}/${entrada.name}`
    if (entrada.isDirectory()) return arquivosDe(filho)
    return CODIGO.test(entrada.name) && !TESTE.test(entrada.name) ? [filho] : []
  })
}

function impressaoDasFontes() {
  const arquivos = FONTES.flatMap(arquivosDe).sort()
  const hash = crypto.createHash('sha256')
  for (const arquivo of arquivos) {
    // Com fim de linha do Windows ou não, o mesmo código dá a mesma impressão.
    const texto = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8').replace(/\r\n/g, '\n')
    hash.update(`${arquivo}\0${texto}\0`)
  }
  return { sha256: hash.digest('hex'), arquivos: arquivos.length }
}

module.exports = { impressaoDasFontes }

if (require.main === module) process.stdout.write(`${JSON.stringify(impressaoDasFontes())}\n`)
