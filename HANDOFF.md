# HANDOFF — futbol-tokens

Estado del TP "Valoración de mercado de Jugadores de fútbol". Actualizá este archivo después de cada tarea completada o cuando cambien decisiones de diseño. Al empezar una sesión, leelo primero para saber qué sigue.

> **Convención**: marcar `[x]` cuando se completa, dejar `[ ]` si está pendiente, `[~]` si está en progreso. Incluir una línea de "Notas" debajo de cada paso si hay decisiones tomadas o cosas a revisar.

## Última actualización
- **Fecha**: 2026-05-18
- **Última sesión hizo**: `/orders/buy` y `/orders/sell` con transacciones Mongo + idempotency (paso 6). Tests 69/69 verdes.

## Decisiones tomadas (no re-debatir salvo pedido del usuario)
- **Estrategias de valuación**: `PerformanceWeighted` (pesos fijos sobre métricas) + `PositionAware` (pesos según posición — FW prioriza goals/shots, DF prioriza tackles).
- **Tokens**: 100 emitidos por jugador, valor inicial 1 crédito. Superusuario concentra la tenencia inicial.
- **Concurrencia**: transacciones de Mongo con `session.withTransaction()`. Requiere replica set local; en tests usar `mongodb-memory-server`.
- **Football-Data.org**: catálogo primario (jugadores/equipos/ligas). WhoScored solo aporta stats de performance.
- **DB**: Mongo local con replica set para dev; `mongodb-memory-server` en tests.
- **Player model**: persistido en Mongoose con `league`, `team`, `externalId`, `position`, stats + `minutesPlayed`, `yellowCards`, `redCards`. Índice único `(name, team, league)`.

## Plan (10 pasos)

- [x] **1. Migrar `Player` a Mongoose** con `league/team/externalId/cards/minutes`.
  - Hecho: schema en `src/modules/player/player.model.ts`, nuevo `player.repository.ts`, service refactorizado (`listPlayers`, `getPlayerById`, `syncPlayersFromScrapper`), controller con filtros opcionales + `GET /:id` + `POST /sync`, scrapper devuelve `IPlayer[]` con `league/team` seteados. Tests actualizados (6/6) y typecheck limpio.
  - Bonus: fix de bug `User.findOne({ safeEmail })` → `{ email: safeEmail }` en `auth.service.ts` (login y register).

- [x] **2. Adapter Football-Data.org como fuente primaria del catálogo**.
  - Hecho: `src/modules/integrations/football-data/football-data.client.ts` con axios + `X-Auth-Token`, DTOs en `dto/football-data.dto.ts` con mapa `COMPETITION_CODES` (PL/BL1/PD/SA/FL1).
  - `fetchPlayersByCompetition(code)` aplana squads, setea `externalId="fd:<id>"`, `league` y `team`. Si el competition endpoint no trae squad, hace fallback a `/teams/{id}`.
  - Tolerancia a fallas: todos los `fetch*` capturan, loguean `warn` y devuelven `null` o `[]`. Nunca propagan.
  - `FOOTBALL_DATA_TOKEN` agregado a `.env.example`.
  - Nuevo método en service: `syncCatalogFromFootballData(code)`.
  - Tests: 7 nuevos cubriendo URL/headers, success, fallback de squad, branches de error.

- [x] **3. Modelo `Quote` + estrategias `PerformanceWeighted` y `PositionAware` + servicio de recálculo**.
  - Hecho: `src/modules/quote/quote.model.ts` con `playerId/value/score/strategyName/strategyVersion/at`, índice `(playerId, at desc)`.
  - Estrategias en `strategies/`: interface `ValuationStrategy`, `PerformanceWeighted` (pesos fijos) y `PositionAware` (pesos según grupo FW/MF/DF/GK). Normalización con caps por métrica + penalty por tarjetas. Precio: `base + score * SCALE_FACTOR` (base=1, scale=100).
  - Repository con `insertManyQuotes`, `findQuotesByPlayer(from,to)`, `findLatestQuoteForPlayer`, `findLatestQuotesForPlayers` (aggregation por player).
  - Service: `recalculateAll(strategy?)`, `getPlayerQuotes`, `getLatestQuoteForPlayer`, `getRanking(limit)`, `computeOnDemand`.
  - Tests: 13 nuevos cubriendo penalty, especialización por posición, registry, ranking sort, error 404 y 400.

- [x] **4. Endpoints de cotización**.
  - `GET /players/:id/quotes?from&to` → historial ordenado desc.
  - `GET /players/ranking?limit` (default 50, clamp 1..500).
  - `POST /quotes/recalculate` con body `{ strategy?: 'PerformanceWeighted'|'PositionAware' }`.
  - Routes de quote montadas en `/quotes`; `/players/ranking` declarado antes de `/:id` para evitar colisión. Swagger JSDoc por endpoint. 6 tests de controller.

- [x] **5. Seed del superusuario + modelos `Holding` y `Order`**.
  - Hecho: `isSuperuser` flag en `User` schema. Seed (`src/config/seed.ts`) crea superuser desde `SUPERUSER_EMAIL/PASSWORD` y emite 100 tokens por cada player vía `ensureInitialHoldingsForAllPlayers`. Corre en boot si `SEED_ON_BOOT=true`.
  - `holding.model.ts` con índice único `(userId, playerId)`, `tokens` y `avgBuyPrice`.
  - `order.model.ts` con `side enum [BUY,SELL]`, `idempotencyKey` (sparse unique por user).
  - `market.service.ts` expone `getSuperuser`, `ensureInitialHoldingsForPlayers`, `ensureInitialHoldingsForAllPlayers`. `player.service.sync*` lo llama después del upsert (autogenera holdings para jugadores nuevos).
  - Tests: 8 nuevos (validations + service flow). `INITIAL_TOKENS_PER_PLAYER=100`.

- [x] **6. `/orders/buy` y `/orders/sell` con transacciones**.
  - Helper `withTx` en `src/config/db.ts` envolviendo `mongoose.startSession()` + `session.withTransaction()`.
  - `order.service.ts` expone `buy`/`sell` (delegan en `execute({side})`). Validan inputs, resuelven precio vía `getEffectivePrice` (paso 3: usa última quote o `computeOnDemand` y la persiste), bloquean autotrade del superuser, hacen decremento atómico con `findOneAndUpdate({ tokens: {$gte: n} })` para evitar overdraw bajo concurrencia.
  - `BUY`: decrementa superuser → upsert holding del comprador con recálculo de `avgBuyPrice`. `SELL`: decrementa holding del usuario → incrementa superuser.
  - Idempotency: `Idempotency-Key` header → `Order.findOne({userId, idempotencyKey})` dentro de la txn devuelve la previa.
  - Cada Order persiste `strategyName/Version` para auditoría.
  - Routes en `/orders/buy` y `/orders/sell` con Swagger.
  - Tests: 10 nuevos (validación, BUY new/existing holding, SELL, idempotency, 409 stock/saldo). Mock de `withTx` para no requerir replica set en tests.

- [ ] **7. `/users/:id/portfolio` y `/users/:id/transactions`**.
  - Portfolio: tokens por jugador, precio promedio, valor actual, P&L.
  - Transactions: historial de orders.

- [ ] **8. Scheduler semanal** (node-cron o setInterval) para recalcular cotizaciones + sync de catálogo.

- [ ] **9. Cache TTL** para `/players`, `/players/:id`, `/players/ranking` (in-memory por ahora, abstraído por si después se mueve a Redis).

- [ ] **10. Refinar tests, logger y manejo de errores**.
  - Logger en `src/config/logger.ts`.
  - Tests de integración para los flujos de orders (con `mongodb-memory-server`).
  - Cobertura mínima de service en cada módulo nuevo.

## Bloqueos conocidos
- (ninguno por ahora)

## Notas para próxima sesión
- Antes de cualquier paso: `npx tsc --noEmit && npx jest` para confirmar base verde.
- Cuando arranque el paso 6, levantar Mongo en modo replica set local (`docker-compose` propuesto, todavía no escrito).
