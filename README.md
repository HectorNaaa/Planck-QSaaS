# Planck-QSaaS — Internal Platform Documentation

> **Repositorio interno — Planck Technologies**
> Hybrid Quantum Digital Twins SaaS · Uso exclusivo interno del equipo

<img width="2669" height="585" alt="Planck QSaaS Banner" src="https://github.com/user-attachments/assets/beea1cff-1c81-481a-a95e-e47b2f834d85" />

---

## ¿Qué es este repositorio?

Este es el repositorio del producto principal de Planck Technologies. Contiene todo el código de la plataforma web, la API, la lógica de backend, y el SDK de Python que publicamos en PyPI. Es un monorepo: vive todo junto, no hay servicios separados.

El producto es una plataforma SaaS que permite a investigadores, ingenieros y empresas ejecutar circuitos cuánticos sobre sus propios datos sin necesidad de conocer QASM, sin gestionar hardware cuántico, y sin reescribir su stack tecnológico. El usuario sube un dataset, elige un algoritmo cuántico, y recibe resultados en segundos junto con un "digital twin" — un gemelo digital que modela el comportamiento cuántico de ese sistema a lo largo del tiempo.

---

## Índice

1. [Producto: qué hace el usuario](#1-producto-qué-hace-el-usuario)
2. [Arquitectura general](#2-arquitectura-general)
3. [La aplicación web](#3-la-aplicación-web)
4. [La API cuántica](#4-la-api-cuántica)
5. [El motor de lógica (lib/)](#5-el-motor-de-lógica-lib)
6. [La capa nativa en C++](#6-la-capa-nativa-en-c)
7. [Los Digital Twins](#7-los-digital-twins)
8. [El sistema de autenticación](#8-el-sistema-de-autenticación)
9. [La base de datos](#9-la-base-de-datos)
10. [El SDK de Python](#10-el-sdk-de-python)
11. [Dashboard en tiempo real](#11-dashboard-en-tiempo-real)
12. [El asistente de IA](#12-el-asistente-de-ia)
13. [Billing y planes](#13-billing-y-planes)
14. [Despliegue en Vercel](#14-despliegue-en-vercel)
15. [Desarrollo local](#15-desarrollo-local)
16. [Variables de entorno](#16-variables-de-entorno)
17. [Seguridad](#17-seguridad)

---

## 1. Producto: qué hace el usuario

El flujo completo desde el punto de vista del usuario es el siguiente:

El usuario se registra en la plataforma con su email. Opcionalmente puede generar una API key desde los ajustes si quiere usar el SDK de Python en lugar de la interfaz web.

Una vez dentro, accede al **Runner** — el núcleo del producto. Ahí sube un dataset: puede ser un CSV con datos de sensores, una tabla de optimización, datos de proteínas, datos financieros, o cualquier array numérico. La plataforma analiza automáticamente el dataset y deriva un perfil de datos: cuántos qubits necesita el circuito, qué profundidad tendrá, qué ángulos de rotación se usarán. No hay que configurar nada de esto a mano.

A continuación el usuario elige el algoritmo cuántico que más se adapta a su problema — VQE para optimización de energía, QAOA para optimización combinatoria, Grover para búsqueda, QFT para análisis de señales, Shor para factorización, o Bell como test de entrelazamiento. También puede ajustar parámetros avanzados como el número de shots (mediciones), la estrategia de mitigación de errores, o dar una pista sobre qué backend prefiere.

Al ejecutar, la plataforma genera el circuito cuántico parametrizado en QASM 2.0 a partir de los datos del usuario, lo optimiza, selecciona el backend más adecuado, y devuelve los resultados: distribución de probabilidades de los qubits, tasa de éxito, fidelidad, tiempo de ejecución, y el backend que se utilizó.

Si el usuario tiene activado el modo Digital Twin, la plataforma además genera un insight estructurado del gemelo digital: análisis de puertas cuánticas utilizadas, distribución detallada de resultados, recomendaciones para el siguiente run, y cómo ha evolucionado la fidelidad respecto a ejecuciones anteriores.

El **Dashboard** muestra toda esta historia en tiempo real: gráficas de latencia, distribución de backends usados, tasa de éxito a lo largo del tiempo, y una tabla de todas las ejecuciones. Se actualiza en vivo según llegan nuevos resultados sin necesidad de recargar la página.

Desde **Settings** el usuario puede gestionar su perfil, generar o revocar API keys, cambiar el idioma y tema de la interfaz, y borrar todo su historial de ejecuciones (o su cuenta entera, cumpliendo GDPR).

---

## 2. Arquitectura general

La plataforma es una aplicación Next.js desplegada en Vercel. No hay microservicios: todo corre dentro de la misma aplicación. Las API routes de Next.js actúan como el backend, y las páginas de React actúan como el frontend. La base de datos es SQLite a través de `better-sqlite3`, que en Vercel vive en el directorio temporal `/tmp`.

Esta elección de SQLite en lugar de Postgres es intencional para la fase actual: permite desplegar sin infraestructura de base de datos externa, abarata el coste, y el sistema de "self-healing" que construimos compensa la volatilidad del filesystem efímero de Vercel.

El sistema tiene tres capas de lógica que conviene entender:

**Capa de presentación** — Todo lo que vive en `app/` y `components/`. Las páginas de React que el usuario ve. Los formularios, gráficas, paneles de resultados, el asistente de IA. Esta capa nunca toca la base de datos directamente, solo llama a la API.

**Capa de API** — Todo lo que vive en `app/api/`. Son los route handlers de Next.js que reciben las peticiones HTTP, autentican al usuario, validan los inputs, coordinan la lógica de negocio, y devuelven respuestas JSON. Esta capa delega toda la lógica compleja a `lib/`.

**Capa de lógica de negocio** — Todo lo que vive en `lib/`. Aquí está el corazón de la plataforma: el generador de circuitos, el selector de backends, la autenticación JWT, los wrappers de la base de datos, el limitador de tasa, la validación de seguridad, y el motor de ML. Esta capa nunca es importada desde componentes del cliente — solo desde API routes y Server Components.

Adicionalmente existe una **capa nativa en C++** (`scripts/`) para las operaciones más intensivas computacionalmente, como la generación de circuitos para datasets masivos o la transpilación de puertas.

---

## 3. La aplicación web

### La landing page

La landing page pública (`app/page.tsx`) es el punto de entrada para visitantes. Contiene el hero animado con el fondo cuántico, la sección de features, los precios, las FAQs, y el footer. Fuerza el tema claro al cargar porque es la cara pública del producto.

El componente de **Quantum Assistant** también está disponible en la landing como un chat flotante — permite a visitantes explorar capacidades del producto sin registrarse.

### El shell autenticado

Todo lo que está bajo `/qsaas/` es la aplicación protegida. El layout de esta sección (`app/qsaas/layout.tsx`) envuelve todas las páginas en el shell principal: el sidebar en desktop con los enlaces de navegación, y la barra de pestañas inferior en móvil.

Cuando un usuario que no está autenticado intenta acceder a cualquier ruta bajo `/qsaas/`, el componente `ProtectedRoute` detecta la ausencia de la cookie `auth-token` y lo redirige al login automáticamente.

### El Runner

El Runner (`app/qsaas/runner/`) es la página más compleja del producto. Está construida como una secuencia de paneles que el usuario recorre:

El panel de **carga de datos** acepta archivos CSV y JSON por drag-and-drop. Valida el tamaño (máximo 1MB) y el formato antes de enviarlo al servidor. Una vez cargado, el **AutoParser** analiza la estructura del dataset y muestra al usuario cuántos qubits derivó, cuántas features encontró, qué escala de datos tiene (pequeño, medio, grande, masivo), y qué algoritmo recomienda.

El panel de **configuración** permite al usuario elegir el algoritmo, nombrar el circuito, ajustar el número de shots, seleccionar la estrategia de mitigación de errores, y elegir si quiere asociar esta ejecución a un Digital Twin específico.

Cuando el usuario ejecuta, los resultados aparecen en el panel de **resultados del circuito** (distribución de probabilidades como gráfico de barras, badges de fidelidad y tasa de éxito) y opcionalmente en el panel del **Digital Twin** con el insight completo.

El **Scenario Comparison** al final del runner permite comparar dos runs anteriores del mismo twin lado a lado — útil para validar mejoras entre versiones de un modelo.

### El Dashboard

El Dashboard (`app/qsaas/dashboard/`) muestra el historial de ejecuciones agrupado por Digital Twin. Cuatro tarjetas de resumen (total de runs, tasa de éxito media, tiempo de ejecución medio, qubits medios usados), y debajo una pestaña por cada digital twin que el usuario ha creado.

Cada pestaña renderiza el `DigitalTwinDashboard` con tres gráficas en tiempo real y una tabla de ejecuciones recientes. La actualización en tiempo real se consigue mediante SSE (Server-Sent Events): el cliente mantiene una conexión abierta con `/api/quantum/stream` y el servidor envía nuevas filas según se van completando ejecuciones.

### Settings

La página de ajustes gestiona todo el perfil del usuario: nombre, organización, país, ocupación. También es donde se gestionan las API keys: el usuario puede generar una nueva key (formato v0.9: 64 caracteres hexadecimales), copiarla al portapapeles, y revocarla. Una vez cerrada la ventana, la key no vuelve a mostrarse — está almacenada hasheada en la base de datos pero la plataforma hace un trick inteligente: guarda la key también en el JWT para poder mostrarla sin hacer una query de base de datos.

La opción de "Clear all execution history" borra las ejecuciones tanto del servidor como del caché local de `localStorage`. Si el usuario decide borrar su cuenta, todos sus datos desaparecen en cascada de la base de datos.

---

## 4. La API cuántica

Todos los endpoints cuánticos viven bajo `app/api/quantum/`. Cada uno es un route handler de Next.js que corre en un Lambda de Vercel.

**`/api/quantum/simulate`** es el endpoint principal. Recibe los datos del usuario, el algoritmo elegido, y los parámetros de ejecución. Por dentro: autentica la petición, valida los inputs, aplica rate limiting, genera el circuito QASM a partir de los datos, consulta al motor de ML para recomendaciones de parámetros, selecciona el backend óptimo, ejecuta la simulación, genera el insight del digital twin si procede, guarda la ejecución en la base de datos, y devuelve el resultado completo. Este endpoint hace mucho trabajo, pero cada responsabilidad está delegada a su módulo en `lib/`.

**`/api/quantum/stream`** es el endpoint SSE. Mantiene una conexión HTTP de larga duración (máximo 300 segundos) y cada 3 segundos comprueba si hay nuevas ejecuciones en la base de datos desde el timestamp que el cliente mandó. Si las hay, las serializa y las envía por el stream. El cliente las recibe y actualiza el dashboard en tiempo real sin reload.

**`/api/quantum/generate-circuit`** permite generar el QASM de un circuito sin ejecutarlo — útil para inspección o para exportar el circuito y ejecutarlo en otro sistema.

**`/api/quantum/transpile`** optimiza un circuito QASM existente. Cancela puertas inversas adyacentes, reduce la profundidad del circuito, y re-mapea qubits para mejorar la fidelidad. Para circuitos grandes usa el binario C++ compilado.

**`/api/quantum/visualize`** convierte un circuito QASM a un diagrama SVG renderizable en el navegador.

**`/api/quantum/ml-recommend`** expone las recomendaciones del motor de ML sin ejecutar el circuito: dado un perfil de datos, devuelve los shots recomendados, el backend sugerido, la estrategia de mitigación de errores, y la confianza de la recomendación.

**`/api/quantum/digital-twin`** genera el insight del gemelo digital para una ejecución completada. Analiza la distribución de resultados, el perfil de puertas, y el historial del twin para construir el JSON de insight.

**`/api/quantum/assistant`** es el endpoint del asistente de IA. Usa streaming (Vercel AI SDK + OpenAI) para responder preguntas sobre computación cuántica, sugerir algoritmos, o explicar resultados.

---

## 5. El motor de lógica (`lib/`)

### Generación de circuitos

El módulo `lib/circuit-builder.ts` es el corazón técnico de la plataforma. Su misión es convertir un dataset arbitrario en un circuito cuántico parametrizado determinista. "Determinista" es clave: el mismo dataset siempre produce el mismo circuito. No hay aleatoriedad.

El proceso tiene dos fases. Primero `analyzeInputData()` analiza el dataset y extrae un "perfil de datos": cuántos qubits necesita el circuito (derivado del número de features y la escala del dataset), cuántas capas tendrá el ansatz, qué ángulos de rotación usarán las puertas (derivados de las estadísticas normalizadas de los datos), y en qué rango de escala está el dataset.

La escala importa mucho porque determina la estrategia de construcción del circuito. Para datasets pequeños (menos de mil muestras) se usa embedding completo de features con un ansatz textbook estándar. Para datasets medianos (hasta 50K muestras) se usan estadísticas muestreadas con capas de entrelazamiento compactas. Para datasets grandes (hasta 10 millones) se usa compresión logarítmica de qubits con codificación de amplitud. Para datasets masivos (más de 10 millones) se aplica máxima compresión con capas de amplitud repetidas.

La segunda fase, `buildCircuit()`, toma el perfil y genera el QASM 2.0 completo. Para algoritmos como VQE y QAOA construye un ansatz variacional con las rotaciones derivadas de los datos. Para Grover construye el oráculo y el diffuser basándose en el espacio de búsqueda implícito en el dataset. Para QFT aplica las rotaciones de Fourier adaptadas a la escala de datos.

### Selección de backend

`lib/backend-policy.ts` implementa tres políticas de selección de backend: `latency_first` (la por defecto) que prioriza el backend más rápido disponible, `cost_first` que prioriza el más barato con capacidad suficiente, y `capacity_first` que prioriza el que tiene más headroom de qubits. La decisión es completamente auditable: la respuesta siempre incluye qué política se aplicó y por qué se eligió ese backend.

### Autenticación y JWT

`lib/auth-utils.ts` gestiona toda la lógica de tokens. Los JWT duran 7 días y se renuevan en cada login. Contienen toda la información del perfil del usuario para que la mayoría de las peticiones no necesiten ir a la base de datos.

Hay un mecanismo crítico llamado `selfHealFromJWT`: dado que SQLite en Vercel se borra en cada cold start, la plataforma reconstruye los registros del usuario en la base de datos desde el payload del JWT si detecta que no existen. Para que esto funcione, el JWT guarda un hash SHA-256 de la contraseña (no la contraseña en claro) — así se puede recrear el registro sin pedir la contraseña al usuario. Esto mantiene la sesión activa sin importar cuántas veces Vercel reinicie el Lambda.

### Rate limiting

`lib/rate-limiter.ts` implementa un token bucket en memoria: máximo 1 petición cada 3 segundos por usuario. Es per-Lambda (se resetea en cold starts), pero es suficiente para prevenir abusos accidentales. El SDK de Python cumple este límite automáticamente esperando 3 segundos entre llamadas.

### Seguridad y validación

`lib/security.ts` valida y sanitiza todos los inputs que llegan a la API. Detecta patrones de inyección en el QASM, limita el tamaño de los payloads, aplica encoding HTML a strings de usuario antes de persistirlos, y genera respuestas de error que no filtran información interna (stack traces, rutas del sistema, etc.). Todas las queries de SQLite usan prepared statements con parámetros, nunca interpolación de strings.

---

## 6. La capa nativa en C++

Para datasets muy grandes, el generador de circuitos TypeScript puede ser demasiado lento. Por eso existe una capa nativa en C++ (`scripts/`) que se invoca desde el servidor vía `child_process.spawn`.

`generate_circuit.cpp` lee un perfil de datos en JSON desde stdin y escribe el QASM 2.0 optimizado en stdout. Es funcionalmente equivalente al generador TypeScript pero entre 5 y 10 veces más rápido para datasets masivos. El módulo `lib/qasm-processor.ts` decide automáticamente cuándo usar la versión C++ y cuándo usar la versión TypeScript según la escala del dataset.

`transpile_circuit.cpp` aplica optimizaciones de puertas a un circuito QASM existente: cancela puertas inversas contiguas (como H seguido de H, que se anulan), reduce el recuento de puertas T (que son costosas en hardware cuántico real), y re-mapea qubits para minimizar errores de decoherencia.

En el despliegue en Vercel, estos binarios no se compilan — la plataforma detecta su ausencia y cae automáticamente al path TypeScript. Para despliegues on-premise donde se compilen los binarios, el sistema los usa automáticamente.

---

## 7. Los Digital Twins

Un Digital Twin en nuestra plataforma es una entidad nombrada que representa un sistema físico o computacional que el usuario quiere modelar con computación cuántica. Puede ser algo concreto como "optimizador-batería-v2", "simulación-proteína-BRCA1", o "flujo-logística-Q3".

La idea es que un digital twin no es un circuito único — es una colección de ejecuciones sobre ese sistema a lo largo del tiempo, con datasets que van cambiando. El twin acumula historia: fidelidad en cada run, éxito, qubits usados, qué backend se eligió, qué distribución de probabilidades salió. Con esa historia, el sistema ML puede sugerir mejoras para el siguiente run.

Técnicamente, cada ejecución en la base de datos lleva un `digital_twin_id` opcional. El campo `circuit_data` de esa ejecución almacena el JSON completo del insight del twin: distribución de probabilidades de los qubits, conteo de puertas por tipo, análisis de fidelidad, y recomendaciones generadas por el motor ML para la siguiente ejecución.

En el dashboard, cada twin aparece como una pestaña propia con sus tres gráficas históricas y su tabla de runs. El usuario puede comparar dos runs del mismo twin en el Scenario Comparison del runner para validar si un cambio en el dataset o los parámetros mejoró el resultado.

El contexto `DigitalTwinModeContext` gestiona globalmente si el modo twin está activo o no. Cuando está desactivado, las ejecuciones se guardan igualmente pero sin generar el insight del twin — útil cuando el usuario simplemente quiere ejecutar un circuito rápido sin overhead.

---

## 8. El sistema de autenticación

La autenticación funciona exclusivamente con JWT y cookies. No hay Supabase, no hay Auth0, no hay dependencia externa de autenticación.

Cuando un usuario se registra, se crea su registro en las tablas `users` y `profiles` de SQLite. Se genera un JWT que contiene toda la información del perfil y se almacena en una cookie `auth-token` con atributos `HttpOnly` y `Secure`. El usuario no tiene acceso directo al JWT desde JavaScript del cliente.

En cada petición autenticada, el servidor extrae y verifica el JWT. Si el usuario tiene un perfil en la base de datos (lo normal) la petición continúa. Si la base de datos fue borrada por un cold start de Vercel, la función `selfHealFromJWT` recrea los registros a partir del payload del JWT antes de continuar — el usuario ni se entera.

Para acceso programático (SDK de Python, llamadas directas a la API), el usuario usa una API key. Estas keys tienen el formato v0.9: 64 caracteres hexadecimales puros, sin prefijo. Se almacenan como texto plano en la tabla `api_keys` (la API key en sí no es un secreto que proteger en servidor, a diferencia de una contraseña — su función es identificar al usuario). En cada petición con `x-api-key`, el sistema busca la key en la tabla, recupera el `user_id` asociado, y trata la petición como autenticada para ese usuario.

Para usuarios no autenticados, la plataforma tiene un "modo guest": pueden ver la landing page, el asistente de IA, y páginas de marketing, pero no pueden ejecutar circuitos ni acceder al dashboard.

---

## 9. La base de datos

La plataforma usa SQLite a través de la librería `better-sqlite3`. Es una base de datos embebida, lo que significa que vive como un archivo en el filesystem, no como un proceso servidor separado. En Vercel, ese archivo vive en `/tmp` (efímero). En local, vive en `./.data/` (persistente).

El esquema tiene cinco tablas principales:

**users** es la tabla identidad central. Guarda email y hash de contraseña. Toda la demás información del usuario referencia esta tabla.

**profiles** extiende `users` con información de perfil: nombre completo, organización, preferencia de tema, idioma, teléfono, país, ocupación. Es una relación 1:1 con `users` y se borra en cascada si el usuario se elimina.

**circuits** guarda circuitos guardados por el usuario: el QASM, los metadatos, y el backend para el que fue diseñado. Un usuario puede guardar circuitos para reutilizarlos.

**executions** es la tabla más importante. Cada ejecución cuántica genera una fila aquí. Guarda todo: el algoritmo usado, el backend seleccionado, cuántos qubits, cuántos shots, la tasa de éxito, el tiempo de ejecución, el motivo de selección del backend, los resultados en JSON, el error si lo hubo, y el insight del digital twin en el campo `circuit_data`. Esta tabla es la fuente de verdad para el dashboard y las gráficas.

**api_keys** guarda las API keys de cada usuario. Se borran en cascada si el usuario se elimina.

La tabla `executions` tiene índices en `user_id` (para listar el historial de un usuario) y en `circuit_id` (para buscar ejecuciones de un circuito concreto). Todas las foreign keys tienen `ON DELETE CASCADE` excepto `executions.circuit_id` que usa `SET NULL` — si un circuito se borra, las ejecuciones que hizo siguen existiendo en el historial, solo sin el circuito asociado.

El módulo `lib/db/init.ts` crea todas las tablas al arrancar si no existen, y también ejecuta migraciones automáticas para añadir columnas nuevas a tablas existentes. Esto permite actualizar el esquema sin pérdida de datos incluso cuando el archivo SQLite de Vercel sobrevive entre deploys.

---

## 10. El SDK de Python

El SDK (`sdk/python/`) es una librería Python publicada en PyPI bajo el nombre `planck_sdk`. Tiene cero dependencias externas — usa solo la standard library de Python (`urllib`, `json`, `time`). Esto lo hace instalable en cualquier entorno sin conflictos de dependencias, incluyendo Google Colab y Jupyter Notebooks.

La clase central es `PlanckUser`. El usuario la instancia con su API key y a partir de ahí puede llamar a `run()` pasando su dataset como lista de números junto con el algoritmo y los parámetros de ejecución. El SDK construye el payload, espera el tiempo necesario entre llamadas para cumplir el rate limit, y devuelve un objeto `ExecutionResult` con todos los campos del resultado.

El SDK también expone `list_executions()` para recuperar el historial, y clases de error diferenciadas: `AuthError` si la API key es inválida, `RateLimitError` si se envían demasiadas peticiones, `APIError` para el resto de errores del servidor.

El objetivo del SDK es que un científico de datos pueda integrar Planck en su pipeline en pocas líneas, sin necesidad de saber nada de HTTP, JSON, o computación cuántica más allá de elegir el algoritmo.

---

## 11. Dashboard en tiempo real

La actualización en tiempo real del dashboard es uno de los aspectos técnicamente más interesantes de la plataforma. Funciona mediante SSE (Server-Sent Events).

Cuando el usuario abre el dashboard, el hook `useLiveExecutions` abre una conexión HTTP persistente con `/api/quantum/stream`. Esta conexión no se cierra: el servidor la mantiene abierta hasta 300 segundos. Cada 3 segundos, el servidor consulta la base de datos por nuevas ejecuciones desde el último timestamp que recibió del cliente. Si hay nuevas filas, las serializa y las envía por el stream como eventos. El cliente los recibe y los añade a la lista de ejecuciones sin recargar la página, actualizando las gráficas en tiempo real.

Cuando el runner completa una ejecución manual (no vía SDK), el hook `useLiveMode` llama a `broadcastExecution()` para añadir la nueva fila directamente al estado local del dashboard sin esperar al siguiente ciclo del SSE. Esto hace que la actualización parezca instantánea.

Hay un tercer mecanismo de persistencia: `localStorage`. El navegador guarda hasta 100 ejecuciones recientes en un caché local (`planck_exec_cache`). Cuando la base de datos de Vercel se borra por un cold start, el dashboard recupera estas filas del caché local y las mezcla con las filas que vengan del servidor (priorizando las del servidor). Esto da la ilusión de que el historial persiste indefinidamente aunque SQLite sea efímero.

---

## 12. El asistente de IA

La plataforma incluye un asistente de IA (`components/quantum-assistant.tsx`) powered por OpenAI a través del Vercel AI SDK. El asistente responde en streaming — las respuestas aparecen palabra a palabra como en ChatGPT.

El asistente está especializado en computación cuántica: puede explicar cómo funciona VQE, sugerir qué algoritmo usar para un problema concreto, interpretar los resultados de una ejecución, y guiar al usuario para sacar más partido a la plataforma. El endpoint backend es `/api/quantum/assistant`.

El asistente está disponible tanto en la landing page (para visitantes no registrados) como dentro de la aplicación (para usuarios autenticados).

---

## 13. Billing y planes

La página de billing (`app/qsaas/billing/`) muestra tres planes:

**Starter** ($29/mes) para investigadores individuales o empresas que están evaluando la plataforma. Incluye 1.000 runs al mes y soporte de hasta 8 qubits.

**Professional** ($99/mes) para equipos activos de investigación o ingeniería. 50.000 runs al mes y hasta 20 qubits.

**Enterprise** (precio personalizado) para grandes organizaciones. Runs ilimitados, hasta 100 qubits, soporte dedicado, SSO y controles de seguridad avanzados. El CTA para este plan abre un email pre-rellenado a `hello@plancktechnologies.xyz`.

Stripe está scaffoldeado en el código (las variables de entorno están comentadas en `.env.local`) pero no está conectado a flows de checkout reales todavía.

---

## 14. Despliegue en Vercel

La plataforma se despliega en Vercel. El archivo `vercel.json` configura el proyecto: usa pnpm como gestor de paquetes, el framework es Next.js, y la variable `DB_DIR` se sobrescribe a `/tmp` en producción (donde SQLite crea su archivo de base de datos).

Los despliegues automáticos desde Git están desactivados (`"deploymentEnabled": false` en `vercel.json`). Los deploys se hacen manualmente desde la CLI con `vercel deploy --prod`. Esto es intencional: queremos control sobre cuándo sube código nuevo a producción.

La URL de producción es `https://plancktechnologies.xyz`. El alias se configura automáticamente en Vercel.

El proceso de build usa Turbopack (el bundler nuevo de Vercel/Next.js) para compilaciones más rápidas. Las imágenes se sirven sin optimización de Vercel para no consumir cuota del plan.

**Punto importante sobre la base de datos en producción:** Vercel no garantiza que el filesystem `/tmp` sobreviva entre invocaciones de Lambdas o entre deploys. Esto significa que la base de datos SQLite puede borrarse en cualquier momento. El sistema está diseñado para sobrevivir esto: el mecanismo de self-healing reconstruye los usuarios desde el JWT, el caché de `localStorage` recupera el historial de ejecuciones, y el esquema se recrea automáticamente en el arranque. Para el futuro, cuando la plataforma crezca, migraremos a una base de datos persistente como Postgres en Neon o PlanetScale, pero por ahora SQLite es más que suficiente y simplifica enormemente el desarrollo.

---

## 15. Desarrollo local

Para arrancar el entorno de desarrollo:

```bash
# Instalar dependencias
pnpm install

# Crear el archivo de variables de entorno
cp .env.example .env.local   # y ajustar los valores

# Arrancar el servidor de desarrollo
pnpm dev
```

El servidor arranca en `http://localhost:3000`. La base de datos SQLite se crea automáticamente en `./.data/planck.db` en el primer request.

Para los tests:

```bash
pnpm test
```

Los tests en `__tests__/` validan el shape del JSON de resultados de ejecución y el comportamiento del caché de ejecuciones. Son tests de integración ligeros que pueden ejecutarse sin servidor.

Si se quiere usar la capa nativa C++ (opcional, solo para rendimiento con datasets grandes):

```bash
mkdir .dist
g++ -O3 -std=c++17 -o .dist/generate_circuit scripts/generate_circuit.cpp
g++ -O3 -std=c++17 -o .dist/transpile_circuit scripts/transpile_circuit.cpp
```

Sin los binarios compilados, la plataforma cae automáticamente a las implementaciones TypeScript. Para el desarrollo del día a día no son necesarios.

---

## 16. Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DB_DIR` | Sí | Directorio donde SQLite crea el archivo `.db`. `./.data` en local, `/tmp` en Vercel. |
| `JWT_SECRET` | Sí | Clave para firmar los JWTs. **En producción debe ser un string aleatorio de al menos 256 bits.** El valor en `.env.local` es solo para desarrollo. |
| `NODE_ENV` | Sí | `development` o `production`. Afecta al comportamiento de error handling y logs. |
| `OPENAI_API_KEY` | No | Necesario para el asistente de IA cuántico. Sin él, el chat no funciona. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Para cuando se active billing real con Stripe. Actualmente comentado. |
| `STRIPE_SECRET_KEY` | No | Idem. |
| `VERCEL_OIDC_TOKEN` | No | Lo inyecta Vercel automáticamente para verificación de identidad OIDC. No se configura manualmente. |

---

## 17. Seguridad

La seguridad de la plataforma se construye en capas:

**En la autenticación:** toda la autenticación usa JWTs firmados con una clave secreta o API keys de 64 caracteres hexadecimales. Las contraseñas nunca se almacenan en claro — se guardan como hash SHA-256. Las API keys se buscan en la base de datos con queries parametrizadas.

**En la validación de inputs:** todo lo que llega a la API pasa por `lib/security.ts` antes de procesarse. El QASM se analiza para detectar patrones de inyección. Los datos de usuario se limitan en tamaño (máximo 1MB para datos, 100KB para QASM). Cualquier string de usuario se sanitiza contra XSS antes de persistirse.

**En la base de datos:** todas las queries de SQLite usan prepared statements con parámetros. No hay interpolación de strings en ninguna query. Esto elimina la posibilidad de SQL injection.

**En el rate limiting:** cada usuario puede hacer máximo una ejecución cada 3 segundos. Las peticiones que superan este límite reciben un error 429. El SDK de Python respeta este límite automáticamente.

**En las respuestas de error:** ningún error devuelto al cliente contiene información interna: sin stack traces, sin rutas del filesystem, sin nombres de variables internas. `createSafeErrorResponse()` se usa en toda la API para garantizar esto.

**En el borrado de datos:** cuando un usuario borra su cuenta, todos sus datos se borran en cascada desde la base de datos. El historial borrado se marca en `localStorage` para que no "vuelva" desde el caché si el servidor aún tiene copias. Cumplimos GDPR: el usuario tiene control total sobre sus datos y puede eliminarlos en cualquier momento.

---

*Planck Technologies — hello@plancktechnologies.xyz*
*© 2024–2026 Planck Technologies. All rights reserved.*