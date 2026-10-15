# Modelo de dados (Picalta 5)

Campos novos são sempre opcionais, por isso os dados da v4.3 continuam válidos.

## Publicações `posts/{postId}`

Existentes: `uid`, `imageUrl`, `caption`, `text`, `hashtags`, `likes[]`, `createdAt`, `mood`.

Novos:
- `images`: lista `[{ url, alt }]`, até 6. `imageUrl` mantém a primeira imagem para compatibilidade.
- `location`: texto até 100 caracteres.

Reels (mesma coleção, mesmas regras):
- `type: 'reel'`, `videoUrl` (URL do Cloudinary), `imageUrl` e `posterUrl` (fotograma de capa), `duration` (segundos), `aspect` (largura / altura, por exemplo 0.5625).
- `images` fica vazio. O feed ignora publicações com `type: 'reel'`; aparecem no separador Reels, no explorar e no perfil.

Publicações agendadas não vivem em `posts` até à hora. Ver `users/{uid}/scheduled`.

## Comentários `posts/{postId}/comments/{commentId}`

Existentes: `uid`, `text`, `createdAt`.
Novos: `replyTo` (id do comentário raiz), `likes[]` (uids), `editedAt`.

## Histórias `stories/{storyId}`

Existentes: `uid`, `imageUrl`, `createdAt`.
Novos: `text`, `color`, `caption` (histórias de texto ou com legenda).
Subcoleção `stories/{storyId}/reactions/{uid}`: `{ uid, reaction, createdAt }`. Uma reação por pessoa.

## Dados privados `users/{uid}/...`

- `picaltaData/preferences`: `{ blocked[], muted[], hiddenPosts[], autoplay, fontScale, reduceMotion }`.
- `picaltaData/collections`: `{ items: [{ id, name, postIds[] }] }`.
- `picaltaData/challenges`: `{ date: 'AAAA-MM-DD', counts: { photo, comment, discover, story }, claimed[] }`. A data usa a hora local do dispositivo. O contador reinicia quando a data muda.
- `drafts/{draftId}`: `{ type, caption, location, images: [{ dataUrl, alt }], updatedAt }`. As imagens são cópias comprimidas (data URL). Ver nota abaixo.
- `scheduled/{id}`: `{ post, dueAt, status: 'pending', createdAt }`. O campo `post` já tem as imagens carregadas (URLs do Cloudinary).

Publicação de agendados: quando a app está aberta, uma transação cria `posts/scheduled_{uid}_{id}` e apaga o documento em `scheduled`. O id determinístico impede duplicados se houver dois separadores abertos.

## Eventos `events/{eventId}`

`{ uid, title, description, location, startsAt (ms), cover?, createdAt }`.
Subcoleção `events/{eventId}/attendees/{uid}`: `{ uid, createdAt }`. Confirmar presença cria o documento, cancelar apaga-o.

## Denúncias `reports/{id}`

`{ uid, postId, targetUid, reason, createdAt }`. Só criação por utilizadores autenticados. A leitura é para quem administra o projeto na consola.

## Restantes coleções (inalteradas)

`users`, `follows`, `chats/{id}/messages`, `players`, `favorites`, `polls` (+ votos), `songs`, `groups` (+ membros e publicações), `gameScores`.

## Nota sobre rascunhos

Cada rascunho guarda até 6 imagens comprimidas a 640 px de lado maior, em JPEG a qualidade 0,65. A app recusa gravar um rascunho cujo conteúdo ultrapasse cerca de 800 KB, para ficar abaixo do limite de 1 MiB do Firestore. Nesse caso mostra «Rascunho não guardado» e pede para remover uma fotografia. A publicação normal não é afetada.
