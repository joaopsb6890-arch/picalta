# Picalta 5

Evolução da v4.3. Mantém a arquitetura original (site estático em `public/`, Firebase Auth e Firestore, Cloudinary para fotografias, função serverless `api/picalai.js` na Vercel) e acrescenta uma camada nova de interface e dez sistemas novos. Não há passo de compilação.

## O que há de novo

### Dez sistemas novos

1. Carrosséis com até seis fotografias por publicação, com texto alternativo por imagem.
2. Editor de fotografias: filtros, enquadramento (1:1, 4:5, 16:9), rotação, luz, contraste, cor e aproximação.
3. Rascunhos automáticos, guardados enquanto escreves.
4. Agendamento de publicações.
5. Coleções privadas para guardar publicações.
6. Eventos com confirmação de presença e exportação para calendário (`.ics`).
7. Desafios diários com recompensa em XP (virtuais).
8. Estatísticas de criador no Estúdio.
9. Segurança: bloquear, silenciar, ocultar publicações e denunciar.
10. Pesquisa global (Ctrl/Cmd + K) e atalhos de teclado.

### Interface renovada

- Menu lateral agrupado, barra superior com pesquisa, barra inferior no telemóvel com botão central de criar e folha «Mais».
- Coluna direita no ecrã largo com desafio do dia, pessoas e próximo evento.
- Histórias: cartões em carrossel, visualizador em ecrã inteiro com barras de progresso, pausa, zonas de toque, reações, resposta por mensagem privada, criação de história de texto ou de fotografia, apagar.
- Comentários: gaveta lateral (folha inferior no telemóvel) com respostas, gostos, editar, apagar, ordenar e contador de caracteres.
- Fotografias: visualizador ampliado, gosto com duplo clique, carrossel, grelha de exploração e grelha do perfil.
- Tema claro e escuro, tamanho de texto, reduzir movimento.

### Novidades da versão 5.2

- **Tipo de letra e aparência** (Definições > Aparência): quatro tipos de letra (Padrão: Plus Jakarta Sans; Editorial: Newsreader; Legível: Atkinson Hyperlegible, pensada para leitura fácil; Suave: Nunito), seis cores de destaque e duas densidades (confortável e compacta). Tudo é guardado nas preferências privadas e funciona em modo claro e escuro. O tipo de letra por defeito mudou de Work Sans para Plus Jakarta Sans.
- **Notas de 24 horas**: uma frase curta (até 60 caracteres) acima das histórias, visível para as pessoas que aparecem no teu feed. Podes responder por mensagem a partir da nota. Guardada em `users/{uid}.note`.
- **Publicações fixadas**: até três no topo do teu perfil (menu da publicação > Fixar no perfil). Guardadas em `users/{uid}.pinned`.
- **Tempo e pausas**: contador de tempo diário (só no teu dispositivo), lembrete de pausa a cada 20, 30, 45 ou 60 minutos, meta diária opcional e uma pausa guiada de um minuto para respirar.
- **Pesquisa (Ctrl+K)**: pesquisas recentes e resultados de jogos que abrem o jogo diretamente.
- **Melhorias**: definições reorganizadas em cartões, sugestões rápidas na PicalAi, emojis substituídos por ícones nos menus, tipografia mais nítida.
- As regras do Firestore existentes já permitem ao próprio utilizador atualizar `note` e `pinned` no seu documento. Não é preciso mudar nada.

### Novidades da versão 5.1

- Reels: separador novo com vídeos verticais, deslize para o seguinte, reprodução automática, som, pausa com toque, gosto com duplo toque, comentários, guardar, partilhar, seguir e criação de reel (até 80 MB e 90 s). O vídeo vai para o Cloudinary: o preset não assinado tem de aceitar vídeo (em Settings > Upload > Upload presets, sem restrição de tipo de recurso). Atalhos: setas ou J/K para mudar, M som, Espaço pausa, L gosto.
- Jogos: botão Reiniciar no cabeçalho e ecrã de fim de ronda com Jogar de novo (atalhos R e Enter). Os cinco jogos que existiam no código mas não apareciam (Campo Minado, Breakout, Tetris, Pong, 4 em Linha) passam a estar no menu e foram refeitos. Jogos novos: Sequência, Toupeiras, Reflexos, Puzzle 15 e Palavra do Dia. Há filtros por categoria, Continuar o último jogo e Surpreende-me.
- Cada jogo novo usa a coleção `gameScores`, por isso precisa do mesmo índice composto dos outros jogos (`game` crescente, `score` decrescente). Se faltar, a consola do browser mostra uma ligação para o criar com um clique.
- PicalAi: diagnóstico claro no ecrã (indica que variáveis faltam) e aceita nomes alternativos de variáveis.

## Ficheiros

```
picalta/
├── api/picalai.js
├── public/
│   ├── index.html        (entrada real, com Firebase)
│   ├── demo.html         (demonstração isolada, sem Firebase)
│   ├── v5.css            (interface nova)
│   ├── v5.js             (interface e sistemas novos)
│   ├── data-v5.js        (acesso ao Firestore dos sistemas novos)
│   ├── icons.js          (ícones Lucide embebidos, sem pedidos externos)
│   ├── demo.js           (Firebase simulado em memória + dados fictícios)
│   ├── demo/             (fotografias ilustrativas da demonstração)
│   ├── app.js, auth.js, data.js, firebase.js, progress.js, games.js,
│   │   groups.js, music-player.js, picalai.js, loading.css, config*.js
├── firestore.rules       (PROPOSTA de regras, ver abaixo)
├── MODELO-DADOS.md
├── scripts/build-config.mjs  (gera public/env-config.js a partir do .env)
├── vercel.json, package.json, .env.example
```

## Modo demonstração

`demo.html` (botão «Explorar demonstração» no ecrã de entrada) corre a app inteira contra uma base de dados simulada em memória, com sete perfis e fotografias ilustrativas geradas para o efeito. Não toca no teu Firebase. As alterações desaparecem ao recarregar. A PicalAi não é simulada: mostra que precisa de ligação real. Uploads de fotografia ficam em memória (data URL).

## Configuração com .env

1. Copia `.env.example` para `.env` e preenche (o `.env` não vai para o Git).
2. Corre `npm run build` (gera `public/env-config.js`) ou `npm run dev` (gera e serve em http://localhost:3000).
3. Na Vercel, define as mesmas variáveis em Project Settings > Environment Variables. O `vercel.json` já corre o build.

| Variável | Para quê | Pública? |
|---|---|---|
| `FIREBASE_*` (6 valores) | Ligação ao teu projeto Firebase. Se faltar algum, usa os valores que já estão em `firebase.js` | Sim, por desenho |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UNSIGNED_PRESET` | Envio de fotografias (preset não assinado) | Sim |
| `OVERCONTROL_API_KEY`, `OVERCONTROL_BASE_URL`, `OVERCONTROL_MODEL` | PicalAi (também aceita `AI_*`, ou só `OPENAI_API_KEY`) | NÃO. Só o servidor (`api/picalai.js`) as lê |

Atenção: tudo o que o browser usa é visível a quem abrir o site. Nunca ponhas no `.env` o API Secret do Cloudinary nem outras chaves privadas, a não ser que só o servidor as use.

## Se a PicalAi não responde

A causa mais comum: a Vercel não lê o ficheiro `.env`. As três variáveis da IA têm de ser criadas em Project Settings > Environment Variables (Production e Preview) e depois é preciso fazer Redeploy. O estado no topo da página PicalAi diz o que falta.

- «falta configurar: ...»: as variáveis indicadas não existem no servidor.
- «sem servidor de IA neste endereço»: o site está num alojamento sem funções (por exemplo, uma pré-visualização estática). A IA só existe na Vercel ou com `npm run dev` (usa `vercel dev`).
- Erro 401/403: a chave foi recusada. Erro 404: endereço base ou modelo errados. O endereço tem de terminar em `/v1` e o serviço tem de ser compatível com OpenAI.
- «Não foi possível validar a tua sessão»: termina sessão e entra de novo. O servidor valida o token do Firebase com os certificados públicos da Google (projeto em `FIREBASE_PROJECT_ID`, por defeito `picala-a212f`).

## Para pôr em produção

1. Preencher o `.env` (ou as variáveis da Vercel), sobretudo o Cloudinary. Sem isso, publicar fotografias falha.
2. Em Firebase > Authentication > Settings > Authorized domains, adicionar o domínio onde publicares. Sem isto o login falha com `auth/unauthorized-domain` (acontece, por exemplo, em pré-visualizações noutro domínio).
3. Rever e publicar as regras em `firestore.rules` na consola Firebase. Não foram aplicadas à tua conta. Sem elas, rascunhos, coleções, eventos, reações e denúncias falham com «permission-denied».

## Limites conhecidos

- O agendamento só é processado enquanto a app está aberta (não há servidor a correr tarefas). Publicações vencidas são enviadas quando o autor volta a abrir a app.
- Bloquear e silenciar são filtros do lado do cliente. Não impedem acesso no servidor nem tornam publicações privadas.
- As estatísticas são calculadas sobre as publicações carregadas no feed (até 60). Não há impressões nem alcance.
- As recompensas dos desafios são validadas no cliente (transação no Firestore), não são infalíveis contra utilizadores mal-intencionados.
- Denúncias ficam registadas na coleção `reports`. Não há painel de moderação nem moderação automática.
- Reels: os vídeos são publicações com `type: 'reel'` e entram no mesmo limite de 60 publicações carregadas. O som começa desligado por regra dos browsers. Não há conversão nem compressão: o ficheiro vai tal como está para o Cloudinary.
- Jogos: as pontuações e o XP são calculados no cliente, tal como nos jogos anteriores.
- O painel de notificações continua a ser o original (em memória, não persistente).
- Dados do Firestore existentes (publicações, comentários, histórias) continuam compatíveis. Os campos novos são opcionais.

## Notas da v4.3 (mantidas)

A reorganização para a Vercel (`public/` como `outputDirectory`) e as correções em `games.js`, `data.js` e `api/picalai.js` da v4.3 mantêm-se. Os detalhes estão no histórico do Git (commit «Base Picalta v4.3 original»).
