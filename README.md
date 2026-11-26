<p align="center">
  <img src=".github/assets/readme-banner.png" alt="HaNet: todo tu liceo, en una sola app." width="100%">
</p>

# HaNet

Tu calendario, clases, horarios y todo tu liceo, en una sola app.

En **Beta** piloto sin institución actual.

| | |
| --- | --- |
| App web | [app.hanet.muxp.art](https://app.hanet.muxp.art) |
| Web del proyecto | [hanet.muxp.art](https://hanet.muxp.art) |
| Documentación | [docs.hanet.muxp.art](https://docs.hanet.muxp.art) |
| Panel web | [panel.hanet.muxp.art](https://panel.hanet.muxp.art) · repo [HaNet-Chile/panel](https://github.com/HaNet-Chile/panel) |
| Contacto | muxp@muxp.art |

## Probar HaNet

- **iPhone:** Web app o ipa (no firmada) de github.
- **PC:** Web en vista de escritorio.
- **Android:** Web app o APK (no firmada) de github.

*Versiones estables (App Store/Play store) llegaran mas adelante.*

## Funcionando

| Módulo | Función |
| --- | --- |
| **Calendar** | Agenda de curso: horario, pruebas, tareas y entregas con su plazo. Avisa antes de cada prueba y entrega, y a las 7:00 manda el resumen del día. |
| **ClassHall y calificaciones** | Hall (espacio) de cada asignatura: anuncios, material, tareas con entregas y evaluaciones. |
| **Feed y Comunidad** | Publicaciones del liceo, del CEE y de las directivas, con votaciones anónimas y reacciones. |
| **Eventos y entradas** | Eventos del liceo con inscripción, entradas con QR y "Pasar lista" en la puerta. También eventos de la ciudad. |
| **Organizar** | Para Admin, Centros de Estudiantes y HaNet Team: crear eventos y entradas, escanear en la puerta y mandar avisos a todo el liceo, una jornada o cursos. |
| **Aniversario** | Alianzas, actividades, puntajes y el marcador en vivo de la semana del aniversario. |
| **Herramientas** | HaNet Electividad (test de intereses para 2° medio), escala de notas, calculadora de notas y Verbos en inglés basado en [martinuxp/VerbosByMuxp](https://github.com/martinuxp/VerbosByMuxp) |

Basicos y extras funcionando: buscador en el Inicio, notificaciones, alertas de seguridad de la cuenta y widgets en iPhone y Android (build nativa).

## Stack

- **App:** Expo SDK 58, React Native 0.88, Expo Router, Reanimated 4.
- **Backend:** Firebase: Authentication, Cloud Functions, Firestore, Storage y Hosting.
- **Traducciones:** i18next, español como idioma fuente (`i18n/locales/es.json`).
- **Emails:** Resend.

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

## Contribuir a HaNet

```bash
npm install
npx expo start
```

Antes de guardar cambios:

```bash
npx tsc --noEmit
npm run lint
npm run i18n:check      # que no quede texto sin pasar por t()
npm run desktop:check   # que cada pantalla tenga su vista de escritorio
```