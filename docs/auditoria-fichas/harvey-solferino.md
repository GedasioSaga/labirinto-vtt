Não gravei o arquivo porque sou um agente só de leitura. O conteúdo abaixo está pronto para ser salvo em `C:/dev/labirinto/docs/auditoria-fichas/harvey-solferino.md`. Nada foi commitado.

---

# Ficha: Harvey Solferino (pasta One Piece), auditoria de 07/11/2026

Só leitura. Li a ficha no `rpg.json` da pasta One Piece no appData (gravado em 07/11 às 21:35). Não rodei o app nem testes, e não gravei nada.
Tudo abaixo foi conferido lendo o código, sem rodar. "Suspeita" é o que não deu para provar e virou pergunta. Os bugs gerais estão em `00-bugs-do-sistema.md` e aparecem aqui como "sistema #N".

## 1. Resumo
- Skypean (tem asas), 20 anos, médico. Luta de perto com uma Pá e usa ataque furtivo. HP 700, SP 60, Escudo 40. FOR 50, DET 40, AGI 33, INT 30, ESP 27, RES 20, PER 10, CAR 5.
- Na ficha: 4 técnicas (Giro de Pá, Pazada [+1], Golpe Baixo, Medicina), 1 arma (Pá), 4 perícias, 4 vantagens e 4 desvantagens. Nenhuma transformação. A mochila está vazia (a migração de 07/11 já achou vazia).
- O app já faz sozinho o dano, o custo e a recarga das 3 técnicas de luta. Estão quebrados: a Medicina (não cura e ainda pede reação), o atordoamento da Pazada (nunca acaba) e a Pá (o app não entende o dano dela).

## 2. Habilidades e itens
| Item | O que diz | Hoje no app | Onde | Proposta |
|---|---|---|---|---|
| Giro de Pá | Simples, Tempo 1, dano "Força + Agilidade + 30"; giro de 360° "atingindo 1 quadrado adjacente" | AUTOMÁTICA no dano (50+33+30 = 113) e na ação. Os alvos são escolhidos à mão (até 12) e o app não confere se estão do lado. A recarga 1 some no começo da vez seguinte, então dá para usar toda vez | formula.ts:329-356; turnos.ts:463, :479 | A8, P5, P6 |
| Pazada [+1] | Simples, 15 SP, Tempo 2, Debuff, "Força + 45", "stun/paralisia de 1 turno" | PARCIAL: 95 de dano, cobra 15 SP, conta a recarga, o alvo sempre reage. O selo sugerido é "Atordoado" sem número de turnos (B2), e o Atordoado não tira a vez de ninguém (B8) | selos.ts:69, :73, :450; tiposDaHabilidade.ts:97-100 | A3, A5 |
| Golpe Baixo | Simples, 20 SP, Tempo 3, Debuff, dano 0, "cego por 2 turnos, mas pode atacar", alcance 2, só com terra/areia; extra "Para você: +8 em reação" | PARCIAL: custo, recarga e "Cego 2" certos. O +8 não entra (B6). Alcance e terreno ficam à mão. Cego não muda nenhum número (B8). O registro diz "recebeu 0" (B7) | selos.ts:44, :446; golpe.ts:532-552 | A4, A5, A6, A8 |
| Medicina | Completa, custo 0, Tempo 0, dano 0. Efeito "Recupera 100 de vida, 3 vezes" (a Descrição diz 50); opção "Cirugia, 1 vez" (extra "Efeito 2"); "concentrar 3 vezes: cura 350" | QUEBRADA: vira golpe comum de 0 de dano, a mira já abre num inimigo, o alvo tem de reagir, a cura não entra e os usos não contam (B1, B4, B5). Os botões "Efeito principal" e "Cirugia" funcionam, mas só põem o nome no registro | escolhaEEvolucao.ts:44, :146-156; golpe.ts:296 | A1, A2, A6 |
| Pá (arma) | Branca, dano "10 Força", Ação "Bateu com a Pá" | QUEBRADA: "10 Força" não é uma conta que o app entende, então todo Atacar pede o dano à mão (B3). A Ação é tratada como Simples | formula.ts:238, :373; dadosDoMenu.ts:525-526 | A7, P4 |
| Ataque furtivo 1,5x (Descrição) | usa a Invisibilidade para dar 1,5x de dano | PARCIAL: o botão Surpresa dá ×1,5 e tira a reação (o livro diz que golpe furtivo = crítico de 1,5x). Quem liga o botão é quem ataca; o app não sabe se ele está escondido | reacao.ts:61-65; combate.ts:633; livroOnePiece.ts:36 | P12 |
| Concentrar (regra geral) | 1,5x / 2x / 3,5x | AUTOMÁTICA, mas só multiplica dano, nunca cura | combate.ts:632 | A1 |
| Raça Skypean | asas, planar, menos dano de queda, sem penalidade de altitude, vantagem em Acrobacia, Mantra, "Cap maior AGI/PER" | NÃO SUPORTADA (só texto). Falta na ficha a "Herança Cultural" que o livro dá: 2 dials do dia a dia + 1 de combate | livroOnePiece.ts:78 | P14, P17 |
| Vantagens: Coragem, Frieza, Imunidade, Invisibilidade | vantagem em testes | NÃO SUPORTADA: a batalha não lê essa aba e o app não rola teste com vantagem | nenhuma leitura em lib/batalha | não há |
| Desvantagens: Má Fama, Audição Ruim, Sonâmbulo, Amaldiçoado | desvantagem em testes; Infâmia de 0 a 100 e ">300" | NÃO SUPORTADA: a Infâmia não tem número em lugar nenhum da ficha | não há | A9, P15 |
| Perícias: Toxicologia, Furtividade, Medicina, Cirurgia | atributos do teste | NÃO SUPORTADA (ficam fora da batalha) | não há | não há |
| HP 700, SP 60, Escudo 40 | não há | Sem máximo gravado: digitar o valor atual baixa o máximo junto (sistema #4, provado com ele). O Escudo é gasto antes do HP | ajusteDaFicha.ts:120-123; reacao.ts:104-121 | sistema #4 |

## 3. Bugs
- **B1 ALTA. A Medicina vira um golpe de 0 que espera reação, e não cura ninguém.**
  - Passo a passo: vez do Harvey → Técnicas → Medicina. Como o campo Tipo está vazio e a Ação é Completa, o app trata como técnica comum de ataque (tiposDaHabilidade.ts:78, :103-105), e a mira já abre marcando o primeiro inimigo (MiraDoGolpe.tsx:170-172, :190-196). Troca para o aliado → Lançar.
  - O que acontece: o Dano "0" conta como número; só "-" significa "sem dano" (formula.ts:526). Por isso o aliado recebe a caixa REAÇÃO (golpe.ts:296) e o golpe fica esperando resposta (batalhaFabrica.ts:824-827). Ele ainda entra no limite de 20 golpes esperando (golpe.ts:170-171; sistema #2).
  - O HP não sobe: o app só entende "recupera N de vida" em passiva que repete a cada turno (passivas.ts:215).
  - Se ele se cura, tem de "reagir" ao próprio golpe. O certo seria: aliado +100 de HP, sem reação.
- **B2 ALTA. A Pazada deixa o alvo "Atordoado" para sempre.** O Efeito diz "de 1 turno", mas o app só entende "por N turnos" ou "durante N turnos" (selos.ts:69). Sem número, o selo vai como "até tirar" (selos.ts:450; MiraDoGolpe.tsx:219, :306) e nunca diminui (selos.ts:164).
  - Passo a passo: Pazada num NPC sem mexer no selo → acertou → "Atordoado" fica na carta até o mestre tirar à mão.
  - O robô do treino do Lobby manda o mesmo selo (robo.ts:194-198). O certo seria "Atordoado 1".
- **B3 MÉDIA. Atacar com a Pá sempre pede o dano à mão.** "10 Força" é um número seguido de uma palavra, sem "+", e a conta para no meio (formula.ts:238, chamada em :373).
  - A tela diz `"Força + Dano da arma": digite o dano` (dadosDoMenu.ts:329-330), culpando a conta do Atacar e não a Pá.
  - Com uma arma na ficha, o "Ataque desarmado" some da lista (dadosDoMenu.ts:565), então nem a Força pura dá para escolher.
  - O robô do treino ignora a Pá e bate só com a Força, 50 (robo.ts:176-186).
  - A Saúde da ficha não olha a aba Armas (saude.ts:245-254), por isso nunca avisou do problema.
- **B4 MÉDIA. Concentrar antes da Medicina gasta a carga à toa.** Concentrar 3 vezes → Medicina: a carga zera (golpe.ts:371) e a conta mostra "0 × 3,5 concentração = 0" (dadosDoMenu.ts:637-644). Os 350 de cura da ficha não entram em lugar nenhum.
- **B5 MÉDIA. Os "3 vezes" da Medicina e o "1 vez" da Cirurgia não são contados.** Tempo "0" significa "livre" para o app (leituraDaFicha.ts:117), então o menu nunca apaga a Medicina.
- **B6 BAIXA. Golpe Baixo: o "+8 em reação" do extra "Para você" não entra.** O selo só lê Efeito e Descrição (selos.ts:44, :446) e nunca põe selo em quem usa a técnica. Hoje o mestre resolve à mão em "Pôr selo…" (FaixaDoMestre.tsx:110); a caixa de reação já soma esse selo sozinha (selos.ts:235-237).
- **B7 BAIXA. Golpe Baixo com Dano "0": o registro escreve "recebeu 0" ou "defendeu, recebeu 0" no lugar de "acertou"** (golpe.ts:532-552, :622). A Medicina também mostra "0 SP" na tira (dadosDoMenu.ts:293-294).
- **B8 BAIXA. Atordoado e Cego são só etiquetas.** Quem está atordoado ganha a vez com o menu inteiro, e quem está cego não perde nada. Nenhuma regra lê o nome do selo (procurei em lib/batalha e stores).
- **B9 BAIXA. A Saúde da ficha mede só 4 campos das técnicas (Custo, Dano, Ação, Tempo; saude.ts:29).** A cura, os usos, a duração do atordoamento, o +8 e a arma ficam de fora da conta. Pelo código, ela deve mostrar o Harvey perto de 100%, mas não abri a página.
- **Suspeita (vira P5): o Tempo 1 do Giro de Pá não faz esperar nada.** A recarga 1 some no começo da vez seguinte (turnos.ts:463, :479). Nas lutas automáticas do treino, o robô do Harvey só usa o Giro de Pá, que é o de maior dano (robo.ts:245-247), e nunca a Pazada nem o Golpe Baixo.
- **Bugs do sistema já provados com ele:** #4 (máximo de HP e SP), #6 (o Salvar do jogador desfaz o custo da Pazada que o mestre mudou), #3 (desfazer a Vez, com Vincent e Harvey).

## 4. Automações propostas (o que o app precisa aprender)
1. **Tipo "Cura"** (mais uma linha em tiposDaHabilidade.ts:30-40):
   - sem reação; a mira abre em quem usa, e dá para escolher um aliado;
   - lê "Recupera N de vida" com o leitor que já existe (passivas.ts:215) e soma no HP do alvo até o máximo;
   - multiplica pela concentração: 100 vira 350 com 3 cargas, exatamente como está na ficha;
   - depende do máximo gravado (sistema #4); sem ele, a cura trava no valor atual.
2. **Usos:** escrever "3 vezes por batalha" no Tempo da Medicina, que o app já entende (leituraDaFicha.ts:107). A Cirurgia, que tem o próprio "1 vez", vira um cartão separado (hoje o app não conta uso por opção), ou o app passa a contar uso por opção.
3. **Duração:** aceitar "de N turno(s)" e "N turno(s) de" em selos.ts:69. Já dá para resolver hoje sem mexer no código: trocar o Efeito da Pazada para "Atordoa o alvo por 1 turno".
4. **Selo em quem usa:** o extra "Para você" com número vira um segundo selo de Buff no próprio Harvey, com a duração da técnica. O app já entende "+8 em reação" como Reação +8.
5. **Atordoado e Cego com regra:**
   - Atordoado: no começo da vez de quem está atordoado, aparece "Atordoado: passar a vez?", sem passar sozinho;
   - Cego: um modificador (por exemplo, Percepção zerada, como diz o livro em livroOnePiece.ts:60);
   - depende das respostas P3 e P8.
6. **Dano "0" escrito = sem dano**, igual a "-": não pede reação nem escreve "recebeu 0". Já dá para resolver hoje: trocar "0" por "-" na Medicina e no Golpe Baixo.
7. **Pá:**
   - corrigir o dano para "10" (ou o que a P4 disser);
   - a Saúde passa a ler a aba Armas;
   - o aviso de "não entendi" passa a citar o campo da arma.
8. **Alcance:** ler "adjacente" e "alcance de N blocos" e mostrar um aviso na mira quando o alvo estiver longe. A mira já ordena os alvos por distância (dadosDoMenu.ts:259). É só aviso, não trava.
9. **Infâmia:** um número na ficha (só o mestre vê), com o nível calculado sozinho (de Marcado até Apocalipse).

## 5. Perguntas para o mestre (da mais importante para a menos)
- **P1. Quanto a Medicina cura e quantas vezes?**
  - (a) 100, 3 vezes por batalha **[recomendo: o Efeito e a Concentração (350 = 100 × 3,5) batem com 100]**
  - (b) 50, 3 vezes por batalha
  - (c) 100, 3 vezes por dia ou descanso (o app não conta dias)
- **P2. A Medicina deve curar sozinha?**
  - (a) sim, como Tipo "Cura": sem reação, nele mesmo ou num aliado **[recomendo]**
  - (b) não: só tira a reação (Dano "-") e a cura continua à mão
  - (c) deixar como está
- **P3. O que o atordoamento da Pazada tira do alvo?**
  - (a) a próxima vez inteira (ação e movimento), mas ele ainda pode reagir **[recomendo]**
  - (b) a vez e também a reação
  - (c) só as ações (ele ainda anda e reage)
- **P4. O que quer dizer o dano "10 Força" da Pá?**
  - (a) a Pá dá 10, então o Atacar = Força + 10 = 60 **[recomendo]**
  - (b) a Pá dá 10 + Força, então o Atacar = 110
  - (c) outra conta (diga qual)
- **P5. O que significa o "Tempo 1" do Giro de Pá?** Decidir junto com a P1 do sistema (hoje o Tempo 3 trava 2 vezes).
  - (a) pode usar toda vez, como hoje
  - (b) usa, espera 1 vez dele, usa de novo **[recomendo: do jeito de hoje o Tempo 1 não faz nada, e o robô dele no treino só usa o Giro de Pá]**
- **P6. Giro de Pá: quanto de dano e quantos alvos?**
  - (a) 113 (com o +30 do campo Dano) em todos que estiverem a 1 casa dele, porque é um giro de 360° **[recomendo]**
  - (b) 113 em um só alvo do lado
  - (c) 83 (sem o +30, como diz a Descrição)
  - E o tipo de dano: Cortante (Descrição) ou Impacto (Efeito)?
- **P7. Quanto tempo dura o "+8 em reação" do Golpe Baixo?**
  - (a) os mesmos 2 turnos do Cego **[recomendo]**
  - (b) só a próxima reação
  - (c) até o fim da batalha
- **P8. O que o alvo Cego (Golpe Baixo) perde?**
  - (a) a Percepção vai a zero, como diz o livro **[recomendo]**
  - (b) −N nos ataques e nas reações (diga quanto é N)
  - (c) nada, é só narrativa
- **P9. Concentração na Medicina:**
  - (a) vale a regra geral: 1 carga cura 150, 2 cargas curam 200, 3 cargas curam 350 **[recomendo]**
  - (b) só 3 cargas mudam algo (350); com 1 ou 2 cargas cura 100
- **P10. A Cirurgia (Efeito 2, 1 vez) faz o quê?** E posso corrigir "Cirugia" para "Cirurgia"?
  - (a) só serve fora da batalha, então sai do menu **[recomendo]**
  - (b) na batalha, cura N (diga quanto é N)
  - (c) tira uma condição (Sangrando, Envenenado)
- **P11. Como funciona o Kit Médico?**
  - (a) equipamento fixo: só precisa ter, vira item na ficha e não é contado **[recomendo]**
  - (b) gasta: cada uso consome 1 (quantos ele tem?)
  - (c) não precisa ter kit
- **P12. O ataque furtivo de 1,5x é o mesmo botão Surpresa do app (×1,5, alvo sem reação)?**
  - (a) sim **[recomendo: é a regra do livro]**
  - (b) é um extra só dele: ×1,5 por cima da Surpresa
  - (c) ×1,5, mas o alvo ainda reage
- **P13. Golpe Baixo: quem confere o terreno (terra/areia) e o alcance de 2?**
  - (a) o mestre confere, e o app só lembra na mira **[recomendo]**
  - (b) o app trava o golpe quando o alvo estiver longe
- **P14. Herança Cultural: o livro dá a todo Skypean 2 dials do dia a dia + 1 de combate.**
  - (a) ele tem: diga quais e eu ponho na ficha **[recomendo conferir]**
  - (b) não tem; a ficha está certa
  - (falta a regra na Descrição dele)
- **P15. Onde fica a Infâmia (Amaldiçoado)?** E o que vale entre 101 e 300? O texto pula de "76–100" direto para ">300".
  - (a) um número na ficha que só o mestre vê **[recomendo]**
  - (b) um número que o jogador também vê
  - (c) fica fora do app
- **P16. O que é o "[+1]" no nome da Pazada?**
  - (a) só o nível da técnica, faz parte do nome **[recomendo, até você dizer outra coisa]**
  - (b) +1 turno de atordoamento
  - (c) +1 de dano ou de alcance
- **P17. Asas, planar e "Cap maior em AGI e PER":**
  - (a) só narrativa **[recomendo]**
  - (b) o app ignora terreno e altura quando ele voa
  - (c) é um teto de atributo (diga o número)

## O que não cobri
- Não rodei nada: os bugs B1 a B9 foram provados lendo o código. B1, B2, B4 e B5 dão testes simples usando uma cópia da ficha do Harvey.
- Não abri as telas: os textos que cito vêm do código, não de print.
- Não comparei com a cópia publicada no Lobby; só li o `rpg.json` local. Também não li o duelo entre jogadores do Lobby (`duelo.ts`); do treino, só li o robô (`robo.ts`).
- Não segui o caminho completo do pedido do jogador (tela dele → conexão → mestre) para a Medicina. Se o mestre recusar o pedido, o sistema #1 (recusa sem aviso) pode piorar o B1.