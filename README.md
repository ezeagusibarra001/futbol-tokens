# Futbol Tokens

Backend (Node.js + TypeScript + Express + Mongoose) que modela un mercado de tokens de jugadores de fútbol de las 5 grandes ligas europeas. Implementa el TP "Valoración de mercado de Jugadores de fútbol".

## Stack

- Node.js + TypeScript (strict)
- Express 4
- MongoDB (mongoose) — requiere replica set para transacciones
- JWT auth + bcrypt
- Puppeteer (scraping de WhoScored) y axios (Football-Data.org)
- node-cron para jobs periódicos
- Jest + ts-jest

## Pre-requisitos

- Node.js >= 18
- npm
- Docker Desktop (para levantar Mongo en modo replica set, que necesitan las transacciones de orders)
- (Opcional) Token gratuito de [Football-Data.org](https://www.football-data.org/) si querés sincronizar el catálogo desde la API oficial. Sin token la app funciona igual con los datos sembrados por el script de demo.

## Setup

```bash
# 1. instalar dependencias
npm install

# 2. variables de entorno
cp .env.example .env
# editá .env si querés cambiar puertos, secrets, token de Football-Data, etc.

# 3. levantar Mongo (replica set rs0 single-node)
docker compose up -d
# esperá a que el container esté "healthy" (~10-20s)
docker compose ps
```

El `.env` por defecto apunta a `mongodb://localhost:27018/futbol-tokens?replicaSet=rs0&directConnection=true` para no chocar con otros Mongo que tengas en el 27017.

## Correr la app

```bash
npm run dev        # ts-node, hot reload manual
# o
npm run build && npm start
```

Servidor en `http://localhost:3000`. Swagger en `http://localhost:3000/api-docs`.

Flags útiles en `.env`:

| Variable | Default | Para qué |
|---|---|---|
| `SEED_ON_BOOT` | `true` | Crea el superusuario y los holdings iniciales al arrancar |
| `SCHEDULER_ENABLED` | `true` | Activa los cron jobs semanales de recálculo y sync |
| `SCHEDULER_CRON_RECALC` | `0 3 * * 1` | Cron del recálculo |
| `SCHEDULER_CRON_SYNC` | `0 4 * * 1` | Cron de sync con Football-Data |
| `FOOTBALL_DATA_TOKEN` | — | Token de la API oficial (opcional) |
| `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` | `superuser@futbol-tokens.local` / `change-me-now` | Credenciales del superuser |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## Script de demo

Reproduce los escenarios de prueba que pide el TP: construye una base de 5 jugadores (uno por liga), arma 4 usuarios, compra tokens al inicio del "campeonato", simula evolución de stats, recalcula cotizaciones y muestra los portfolios.

```bash
npm run demo
```

No requiere que el servidor esté corriendo — el script conecta directo a Mongo. Sí necesita el container de Mongo arriba (`docker compose up -d`).

## Probar la API a mano

Si querés ejercitar los endpoints uno por uno:

```bash
# 1. registrar un usuario
curl -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"u1@test.com","password":"secret"}'
# devuelve { accessToken, refreshToken }

# 2. catálogo (filtros opcionales)
curl http://localhost:3000/players \
  -H "authorization: Bearer <accessToken>"

# 3. recalcular cotizaciones manualmente
curl -X POST http://localhost:3000/quotes/recalculate \
  -H "authorization: Bearer <accessToken>" \
  -H 'content-type: application/json' \
  -d '{"strategy":"PerformanceWeighted"}'

# 4. ranking
curl 'http://localhost:3000/players/ranking?limit=10' \
  -H "authorization: Bearer <accessToken>"

# 5. historial de un jugador
curl http://localhost:3000/players/<playerId>/quotes \
  -H "authorization: Bearer <accessToken>"

# 6. comprar tokens
curl -X POST http://localhost:3000/orders/buy \
  -H "authorization: Bearer <accessToken>" \
  -H 'content-type: application/json' \
  -H 'idempotency-key: buy-001' \
  -d '{"playerId":"<id>","tokens":5}'

# 7. portfolio
curl http://localhost:3000/users/<userId>/portfolio \
  -H "authorization: Bearer <accessToken>"
```

## Endpoints

| Método | Path | Descripción |
|---|---|---|
| POST | `/auth/register` | Crear usuario |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refrescar access token |
| POST | `/auth/logout` | Invalidar refresh |
| GET | `/players` | Listar jugadores (filtros `league`, `team`, `position`) |
| GET | `/players/:id` | Detalle |
| GET | `/players/ranking` | Ranking por última cotización |
| GET | `/players/:id/quotes` | Historial de cotizaciones |
| POST | `/players/sync` | Sincronizar desde WhoScored (scraping) |
| POST | `/quotes/recalculate` | Recalcular cotizaciones con la estrategia indicada |
| POST | `/orders/buy` | Comprar tokens (header opcional `Idempotency-Key`) |
| POST | `/orders/sell` | Vender tokens |
| GET | `/users/:id/portfolio` | Portfolio del usuario (solo el dueño) |
| GET | `/users/:id/transactions` | Historial de orders del usuario |

## Estrategias de valuación

Dos estrategias configurables, registradas en `src/modules/quote/strategies/`:

- **PerformanceWeighted**: pesos fijos sobre métricas normalizadas (goals, assists, shots, keyPasses, dribbles, tackles, rating). Penalty por tarjetas. Fórmula: `valor = base + score * scale`.
- **PositionAware**: idem pero con matriz de pesos por grupo de posición (FW prioriza goals/shots, MF prioriza keyPasses/assists, DF prioriza tackles, GK prioriza rating).

Cada cotización guarda `strategyName` y `strategyVersion` para auditoría. Se elige con el query/body `strategy` en `/quotes/recalculate`.

## Tests y typecheck

```bash
npm test              # jest
npx tsc --noEmit      # typecheck
npm run lint          # eslint
```

110 tests cubren modelos, servicios, controllers, estrategias, scheduler, cache, logger y error handler.

## Estructura

```
src/
  app.ts                Express + middlewares + mount de routers + error handler
  index.ts              Bootstrap (connect Mongo → seed → scheduler → listen)
  config/
    db.ts               connectDB + helper withTx (transacciones)
    cache.ts            TtlCache + invalidación por prefijo
    logger.ts           Logger niveles + meta JSON
    error-handler.ts    Global error handler + request logger
    scheduler.ts        node-cron: jobs semanales de recalc + sync
    seed.ts             Crea superuser y emite 100 tokens/jugador
  docs/swagger.ts
  modules/
    auth/               JWT, register/login/refresh/logout
    player/             Modelo, scraper WhoScored, repo, service, routes
    quote/              Modelo, estrategias, recálculo, ranking, historial
    market/             Holding + Order, transacciones BUY/SELL, portfolio
    user/               Endpoints /users/:id/portfolio /transactions
    integrations/
      football-data/    Cliente API oficial
```

## Observabilidad y resiliencia

- **Logs**: cada request loguea método/path/status/ms. Errores 5xx loguean stack; 4xx loguean como warn.
- **Tolerancia a fallas externas**: Football-Data y WhoScored capturan errores y retornan vacío para que la app siga sirviendo desde la BD local.
- **Concurrencia**: orders usan `session.withTransaction()` y decremento atómico con `findOneAndUpdate({tokens:{$gte:n}})`.
- **Idempotency**: orders aceptan header `Idempotency-Key` (único por usuario).
- **Cache**: lectura de jugadores y ranking cacheada en memoria con TTL e invalidación al sincronizar/recalcular.
