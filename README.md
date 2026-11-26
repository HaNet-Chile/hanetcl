<p align="center">
  <img src=".github/assets/readme-banner.png" alt="HaNet: todo tu liceo, en una sola app." width="100%">
</p>

# HaNet

Todo tu liceo, en una sola app. El curso, las clases, las notas, los eventos y los avisos del liceo, juntos y con el diseño de HaNet.

Está en **beta** (v0.16) y el piloto es el Liceo Camilo Henríquez de Temuco.

| | |
| --- | --- |
| App web | [app.hanet.muxp.art](https://app.hanet.muxp.art) |
| Sitio del proyecto | [hanet.muxp.art](https://hanet.muxp.art) |
| Documentación para liceos | [docs.hanet.muxp.art](https://docs.hanet.muxp.art) |
| Panel web | [panel.hanet.muxp.art](https://panel.hanet.muxp.art) · repo [HaNet-Chile/panel](https://github.com/HaNet-Chile/panel) |
| Contacto | muxp@muxp.art |

## Cómo se usa durante la beta

- **iPhone:** no hay app en la App Store todavía. Se usa la web, agregada a la pantalla de inicio desde Safari; así llegan las notificaciones (iOS 16.4 o más).
- **Android:** un APK que se instala a mano, o la web.
- **Computador:** la web, con su propia vista de escritorio.

La App Store y Google Play llegan cuando parta el piloto con el liceo.

## Qué trae

| Módulo | Qué hace |
| --- | --- |
| **Calendar** | La agenda del curso: horario, pruebas, tareas y entregas con su plazo. Avisa antes de cada prueba y entrega, y a las 7:00 manda el resumen del día. |
| **ClassHall y calificaciones** | Cada asignatura es un Hall: anuncios, material, tareas con entregas y evaluaciones. Las notas llegan tapadas y se destapan raspando. |
| **Feed y Comunidad** | Publicaciones del liceo, del CEE y de las directivas, con votaciones anónimas y reacciones. |
| **Eventos y entradas** | Eventos del liceo con inscripción, entradas con QR y "Pasar lista" en la puerta. También eventos de la ciudad. |
| **Organizar** | Para Admin, CEE y HNT: crear eventos y entradas, escanear en la puerta y mandar avisos a todo el liceo, una jornada o cursos. |
| **Aniversario** | Alianzas, actividades, puntajes y el marcador en vivo de la semana del aniversario. |
| **Herramientas** | HaNet Electividad (test de intereses para 2° medio), escala y calculadora de notas, y Verbos en inglés. |

Además: buscador en el Inicio, notificaciones, alertas de seguridad de la cuenta y widgets en iPhone y Android (estos necesitan una build nativa).

HaNet no tiene funciones sociales entre estudiantes: ni chats, ni seguidores, ni contenido propio.

## Tecnología

- **App:** Expo SDK 58, React Native 0.88, Expo Router, Reanimated 4. Una sola base de código para iOS, Android y web.
- **Backend:** Firebase (`hanet-edu`): Authentication, Cloud Functions en Node 22, Firestore, Storage y Hosting. Las funciones y las bases de datos están en Santiago (`southamerica-west1`); las programadas, en São Paulo.
- **Textos:** i18next, con el español como idioma fuente (`i18n/locales/es.json`).
- **Correos:** Resend, desde `hanet.muxp.art`.

## Cómo correrla

```bash
npm install
npx expo start
```

Se abre en Expo Go escaneando el código, o en el navegador con `w`. El teléfono tiene que estar en la misma red que el computador.

Antes de guardar cambios:

```bash
npx tsc --noEmit
npm run lint
npm run i18n:check      # que no quede texto sin pasar por t()
npm run desktop:check   # que cada pantalla tenga su vista de escritorio
```

Cada PR sube la versión: `npm run version:bump` y una entrada en `constants/changelog.json` (lo que se ve en Configuraciones → Novedades).

## Estructura

```
app/                 Pantallas (Expo Router)
  (tabs)/            Inicio, Calendar, Eventos y Feed
  classhall/         Halls, tareas y evaluaciones
  grades/            Notas y el raspe
  anniversary/       Aniversario
  organize/          Organizar (eventos, entradas, avisos)
  tickets/           Entradas
  tools/             Herramientas
  hnt-admin.tsx      Panel HNT dentro de la app
components/          Componentes compartidos (catálogo en components/README.md)
constants/           Tokens de diseño, catálogo de asignaturas, changelog
services/            Acceso a Firebase y lógica del teléfono
i18n/                Textos de la interfaz
widgets/             Widgets y Live Activity
plugins/             Config plugins de Expo
functions/           Cloud Functions
hosting/             Sitio id.hanet.muxp.art: términos y logos de los correos
docs/                Documentos de diseño y legales
```

## Datos

Firestore usa bases con nombre, no la base por defecto:

- `hn-enrollmentdata`: cuentas, perfiles, instituciones con sus nóminas y vínculos.
- `hn-calendar`: el Calendar de cada curso (`HNC-LCH.{curso}`), eventos y aniversarios.
- `hn-classhall`: Halls, tareas, evaluaciones y notas.

Las reglas están en `firestore.enrollment.rules`, `firestore.calendar.rules`, `firestore.classhall.rules` y `storage.rules`. Tres ideas las ordenan:

1. La app solo lee lo que es de la cuenta que inició sesión. Todo lo demás, y casi toda escritura, pasa por Cloud Functions.
2. El rol y el curso viajan en el token (custom claims), porque las reglas del Calendar no pueden leer la otra base. `syncMyClaims` los mantiene al día.
3. Los códigos (verificación e invitación) se guardan como huella, nunca en texto.

Roles: `Estudiante`, `Directiva`, `CEE`, `Profesor`, `Admin` y `HNT`. Se asignan en el Panel HNT o en el panel web.

Cada liceo activa solo los módulos que necesita. Un módulo apagado se apaga en el backend, no solo se esconde.

## Recorrido de una cuenta nueva

1. Crea su HaNet ID y acepta los términos.
2. Verifica su correo con un código.
3. Ingresa el código de invitación de su liceo (cuatro palabras).
4. Confirma su correo institucional desde un link y revisa los datos que el liceo tiene de ella.

Mientras no termine, la app la devuelve al paso que le falta.

## Publicar

Firebase se publica con GitHub Actions (`.github/workflows/firebase-deploy.yml`): una release con la etiqueta `firebase-deploy-<qué>-<n>`, por ejemplo `firebase-deploy-functions-12` o `firebase-deploy-web-8`. `firebase-deploy-all-<n>` publica todo.

Desde un computador con `firebase login`:

```bash
firebase deploy --only functions --project hanet-edu
firebase deploy --only firestore,storage --project hanet-edu
firebase deploy --only hosting:hanet-edu --project hanet-edu
npm run web:build && firebase deploy --only hosting:hanet-app --project hanet-edu
```

Agregar `--dry-run` compila y valida sin publicar. Las funciones que mandan correos leen el secreto `RESEND_API_KEY`.

### App web

Vive en el sitio de Hosting `hanet-app` ([app.hanet.muxp.art](https://app.hanet.muxp.art)), aparte de `hanet-edu` ([id.hanet.muxp.art](https://id.hanet.muxp.art): entrar con Google, links de los correos, términos y `/vincular`). En la dirección antigua, `hanet-app.web.app`, la app solo avisa que se cambió de casa.

`npm run web:build` la exporta a `dist-web/`, con un service worker para abrirla sin internet. Cada PR puede tener su preview temporal (`web-preview.yml`, con la variable `WEB_PREVIEWS=on`).

Los términos y condiciones se editan en `docs/legal/terminos-y-condiciones.md` y la página se regenera con `node scripts/build-legal.js`.

### iPhone sin cuenta de desarrollador

El flujo manual `Build LiveContainer IPA` genera una IPA sin firmar para probar en el teléfono.

- Lleva una firma ad-hoc con el App Group, para que la app y el widget compartan datos. `scripts/patch-expo-widgets.js` (en `postinstall`) usa el App Group que de verdad da la firma.
- Dentro de LiveContainer no hay widgets ni Live Activities. Instalada como app propia (SideStore, AltStore u otro certificado) sí funcionan, igual que los avisos locales de las pruebas.
- Las push del servidor solo llegan a builds firmadas con la cuenta de desarrollador de HaNet.

## Diseño

- Tema oscuro "Misty Rose", con `#EF2274` como acento. Tokens en `constants/design-tokens.ts`.
- DM Sans para el texto y Google Sans Flex para los títulos grandes.
- Botones y chips en píldora. Íconos, no emojis.
- Nada de datos inventados en pantalla: lo que no existe todavía va como "Próximamente".
- El diseño vive en Figma y los componentes se ven en Sistema HaNet UI (Panel HNT).
