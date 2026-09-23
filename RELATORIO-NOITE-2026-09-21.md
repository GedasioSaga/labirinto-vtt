# Relatório da noite — 21/09/2026

Leia com café. Resultado desta passada: **nada foi liberado**. Todas as peças saíram BLOQUEADAS — inclusive o portão, que é quem julga as outras. Por isso nenhuma das 5 features abaixo chegou a ser testada de verdade.

---

## Portão (o juiz que valida tudo antes de liberar uma feature)

**O que mudou:** o robô que checa se uma feature está pronta ganhou conserto em três frentes, mas continua com furos que impedem confiar 100% nele hoje.

**Por que:** esperava que o portão cobrisse toda jornada de teste declarada e que o ambiente de teste estivesse limpo antes de julgar; obteve duas jornadas de regressão (`jornadas-da-bar` e `regressao-em-dia`) faltando da lista de checagem havia 3 rodadas seguidas, e um servidor de teste de uma rodada anterior ainda ocupando a porta 1420, fazendo o portão achar que estava tudo limpo quando não estava.

**Prova:**
- Fotos antes/depois: não existem — esta peça é o próprio verificador, não uma tela para fotografar.
- Comando que ficou verde: `node scripts/portao.cjs --so=jornadas-da-bar` → "testes que passaram: 16, specs pedidos: 5"; `node scripts/portao.cjs --so=jornadas-e2e` → "testes que passaram: 61, specs pedidos: 18"; `node scripts/portao.cjs --so=regressao-em-dia` → "em dia: jornadas-e2e (18 spec(s)); jornadas-da-bar (5 spec(s))". Rodados manualmente após o conserto, num instantâneo isolado da peça (hash `bc386414`).
- Comando que ainda fica vermelho: `node scripts/portao.cjs --so=particao` — vermelho tanto na árvore principal quanto no instantâneo isolado, porque três branches diferentes (`portao`, `r3-portao`, `acervo`) declaram dono do mesmo arquivo `scripts/portao.cjs`.

**Onde:** branch `auto/r3-portao`, arquivo `C:/dev/labirinto/scripts/portao.cjs`.

### O que ainda falta neste juiz (por isso ele não libera nada)

- Faltam dois comandos de teste na lista de checagem: `--so=jornadas-da-bar` e `--so=regressao-em-dia`. Sem eles, o portão pode dizer "tudo verde" mesmo com uma feature antiga quebrada por engano.
- O comando `--so=particao` (que devia garantir que cada branch só edite os arquivos que é dele) já nasce vermelho, mesmo numa árvore limpa, porque três branches diferentes disputam o mesmo arquivo do próprio portão. Nenhuma feature de cliente consegue arrumar isso — é um problema de organização entre as branches.
- Um processo de teste de uma rodada anterior (PID 36740) ficou preso na porta 1420 e o portão não percebeu — achou que o ambiente estava limpo e não estava. Já foi encerrado manualmente.
- Quando um passo do portão diz "verde", ele nem sempre mostra o número que prova isso (por exemplo, quantos testes de fato rodaram) — essa contagem só aparece escondida numa pasta temporária do Windows, não na tela.
- A pasta onde o Rust compila (`desktop/src-tauri/target`) precisa de ~4 GB e o disco só tinha 3,61 GB de sobra medidos nesta passada — perto do limite, mas passou.
- 12 de 17 jornadas de teste do grupo "critério" não têm comando nenhum rodando nesta rodada — ninguém está checando essas 12 hoje.
- Um teste específico (`e2e/task-jornada-pincel-balde-caminhos.spec.ts`, linha 238) já falhou de forma instável (2 de 3 vezes) em rodadas anteriores. Rodou verde uma vez nesta passada, mas uma corrida só não garante nada.

---

## Linha pontilhada (ferramenta de desenho)

**O que mudou:** ainda não mudou nada visível — a feature está bloqueada antes de qualquer teste real.

**Por que:** esperava-se entregar a opção de traço pontilhado no painel da ferramenta Linha (junto com cor, espessura e ponta); obteve bloqueio geral da noite antes que essa peça fosse testada.

**Prova:** não existem fotos antes/depois nem resultado de jornada — a jornada `client/e2e/task-jornada-linha-pontilhada.spec.ts` existe no repositório, mas não foi executada com sucesso nesta passada porque o portão que validaria o resultado está bloqueado (ver seção Portão acima).

**Onde:** branch `auto/r3-linha-pontilhada`, arquivos `client/src/types/map.ts`, `client/src/pixi/drawWalls.ts`, `client/src/components/PropertiesPanel.tsx`.

---

## Etiqueta em pílula (nome de sala legível)

**O que mudou:** ainda não mudou nada visível — a feature está bloqueada antes de qualquer teste real.

**Por que:** esperava-se um fundo em formato de pílula atrás do nome da sala, legível tanto em chão claro quanto em chão escuro; obteve bloqueio geral da noite antes que essa peça fosse testada.

**Prova:** não existem fotos antes/depois nem resultado de jornada — a jornada `client/e2e/task-jornada-etiqueta-pilula.spec.ts` existe no repositório, mas não foi executada com sucesso nesta passada porque o portão está bloqueado.

**Onde:** branch `auto/r3-etiqueta-pilula`, arquivos `client/src/pixi/screenLabel.ts`, `client/src/pixi/drawRegions.ts`.

---

## Marcador com ícone (bau, armadilha, chave, etc.)

**O que mudou:** ainda não mudou nada visível — a feature está bloqueada antes de qualquer teste real.

**Por que:** esperava-se poder escolher um ícone (baú, armadilha, chave, perigo, escada, água) por marcador no mapa, além dos atuais exclamação e interrogação; obteve bloqueio geral da noite antes que essa peça fosse testada.

**Prova:** não existem fotos antes/depois nem resultado de jornada — a jornada `client/e2e/task-jornada-marcador-com-icone.spec.ts` existe no repositório, mas não foi executada com sucesso nesta passada porque o portão está bloqueado.

**Onde:** branch `auto/r3-marcador-com-icone`, arquivos `client/src/types/map.ts`, `client/src/pixi/drawPins.ts`, `client/src/components/PinControls.tsx`.

---

## Vão sem parede (passagem aberta)

**O que mudou:** ainda não mudou nada visível — a feature está bloqueada antes de qualquer teste real.

**Por que:** esperava-se que uma sala pudesse ter um vão totalmente aberto (nem parede, nem porta) para corredor ou arco, com a ficha atravessando por ali mas continuando barrada onde ainda há parede; obteve bloqueio geral da noite antes que essa peça fosse testada.

**Prova:** não existem fotos antes/depois nem resultado de jornada — a jornada `client/e2e/task-jornada-saida-sem-parede.spec.ts` existe no repositório, mas não foi executada com sucesso nesta passada porque o portão está bloqueado.

**Onde:** branch `auto/r3-saida-sem-parede`, arquivos `client/src/types/map.ts`, `client/src/lib/collision.ts`, `client/src/pixi/drawWalls.ts`, `client/src/components/PropertiesPanel.tsx`.

---

## Caminho com cor própria (ferramenta Caminho)

**O que mudou:** ainda não mudou nada visível — a feature está bloqueada antes de qualquer teste real.

**Por que:** esperava-se uma ferramenta "Caminho" nova, separada do chão pintado, que traça ponto a ponto com a cor escolhida no painel antes de traçar (para poder ter dois caminhos de cores diferentes); obteve bloqueio geral da noite antes que essa peça fosse testada.

**Prova:** não existem fotos antes/depois nem resultado de jornada — a jornada `client/e2e/task-jornada-caminho-com-cor-propria.spec.ts` existe no repositório, mas não foi executada com sucesso nesta passada porque o portão está bloqueado.

**Onde:** branch `auto/r3-caminho-com-cor-propria`, arquivos `client/src/types/map.ts`, `client/src/lib/drawingFactory.ts`, `client/src/pixi/drawRegions.ts`, `client/src/components/PropertiesPanel.tsx`, `client/src/App.tsx`.

---

## Resumo para quem só tem tempo de ler isto

Nenhuma das 5 features de desenho foi de fato testada esta noite — o robô que faria esse teste (o portão) está com furos e vermelho em pelo menos um dos seus próprios testes internos (`--so=particao`), então nada foi liberado com segurança. O trabalho de hoje foi consertar o próprio robô de checagem; as 5 features continuam esperando a próxima rodada, quando o portão estiver de fato verde ponta a ponta.
