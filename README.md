# My Service Template

Production-ready шаблон HTTP-сервиса на Node.js + TypeScript. Он задуман как разумная
стартовая точка для нового микросервиса и как пример инженерного подхода: строгие типы,
валидация на границах, наблюдаемость, безопасные defaults, тесты и воспроизводимая сборка.

## Что внутри

- Fastify и TypeScript в строгом режиме;
- проверка переменных окружения через Zod до запуска приложения;
- OpenAPI и Swagger UI по адресу `/docs`;
- liveness `/health`, readiness `/ready` и Prometheus-метрики `/metrics`;
- JSON-логи, request ID, редактирование секретных заголовков;
- Helmet, CORS, rate limiting и единый контракт ошибок;
- graceful shutdown по `SIGINT`/`SIGTERM`;
- Vitest с порогами покрытия, ESLint и Prettier;
- multi-stage Docker image с непривилегированным пользователем;
- GitHub Actions, Dependabot, issue forms и PR template.

## Быстрый старт

Требуются Node.js 22.13+ и npm 10+.

```bash
cp .env.example .env
npm ci
npm run dev
```

Проверить сервис:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/hello/World
```

Полная локальная проверка перед pull request:

```bash
npm run check
```

Запуск контейнера:

```bash
docker compose up --build
```

## Структура

```text
src/
├── config/          # типизированная конфигурация
├── lib/             # общие примитивы приложения
├── modules/         # бизнес-модули: routes + service + domain
├── plugins/         # cross-cutting HTTP-инфраструктура
├── routes/          # operational endpoints
├── app.ts           # composition root, удобный для тестов
└── server.ts        # transport bootstrap и lifecycle процесса
```

Пример `greeting` намеренно небольшой. При создании реального сервиса замените его своим
модулем, сохраняя направление зависимостей: HTTP route вызывает application/domain service,
а инфраструктура подключается снаружи в `app.ts`.

## Конфигурация

Все параметры перечислены в `.env.example`. В production особенно проверьте:

| Переменная            | Назначение                           | Default               |
| --------------------- | ------------------------------------ | --------------------- |
| `PORT`                | HTTP-порт                            | `3000`                |
| `LOG_LEVEL`           | уровень JSON-логов                   | `info`                |
| `CORS_ORIGINS`        | `*` или список origins через запятую | отключён              |
| `TRUST_PROXY`         | доверять proxy headers               | `false`               |
| `DOCS_ENABLED`        | публиковать Swagger UI               | `true` вне production |
| `METRICS_ENABLED`     | публиковать Prometheus metrics       | `true`                |
| `RATE_LIMIT_MAX`      | запросов на клиента в минуту         | `100`                 |
| `SHUTDOWN_TIMEOUT_MS` | таймаут корректной остановки         | `10000`               |

Для production обычно задают явный список `CORS_ORIGINS`, отключают публичную документацию
и ограничивают доступ к `/metrics` на уровне ingress или внутренней сети.

## Расширение readiness

Передайте проверки внешних зависимостей в composition root. Endpoint вернёт `503`, если хотя
бы одна зависимость недоступна:

```ts
const app = await buildApp({
  config,
  readinessChecks: {
    database: () => database.ping(),
    broker: () => broker.ping(),
  },
});
```

Liveness намеренно не проверяет внешние системы: оркестратор не должен перезапускать здоровый
процесс из-за временной недоступности базы.

## Использование как GitHub Template

1. Откройте **Settings → General** репозитория и включите **Template repository**.
2. Создавайте сервисы кнопкой **Use this template**.
3. Сразу замените имя пакета, `SERVICE_NAME`, описание и владельца лицензии.
4. Включите branch protection для `main` и сделайте job `quality` обязательной.
5. Настройте private vulnerability reporting и CODEOWNERS под вашу команду.

## Принятые решения

- Node.js 22 — зрелый runtime с современным API и длительным циклом поддержки.
- Fastify — небольшой overhead, schema-based validation и удобный `inject` для тестов.
- Конфигурация загружается один раз, а приложение создаётся фабрикой — это упрощает тесты и
  не прячет глобальное состояние.
- В шаблон не включена конкретная БД или брокер: это архитектурное решение сервиса, а не
  универсальный default.

Лицензия: [MIT](LICENSE).
