# HaNet UI

El catálogo de componentes de la app: qué hay, dónde vive y cuándo usar cada uno. Los componentes reales, con datos de ejemplo, se ven en **Sistema HaNet UI** (Panel HNT → Sistema HaNet UI, `app/ui-showcase.tsx`), con un índice de grupos arriba. El diseño fuente vive en Figma (archivo `16jIXkcIKhFJPnM38A7qUF`).

**Regla:** un componente compartido nuevo entra a este catálogo y a Sistema HaNet UI en el mismo PR. Si algo se repite en dos pantallas o más, se vuelve componente antes de copiarlo una tercera vez.

## Tokens (`constants/design-tokens.ts`, `constants/motion.ts`)

| Token | Para qué |
| --- | --- |
| `AppColors.canvas` `#282829` | Fondo de toda pantalla. |
| `AppColors.surface` `#3C3B3E` · `surfaceMuted` `#504F53` | Tarjetas, y lo que va sobre una tarjeta (íconos, divisores, la pista de un interruptor apagado). |
| `AppColors.surfaceSoft` / `controlActive` `#C7C6CF` con `controlOnActive` `#282829` | Control activo (chip seleccionado, ítem de la barra) y tiles claros. |
| `AppColors.accent` `#EF2274` | El único color fuerte de cada pantalla: acción principal, seleccionado, lo que pasa ahora. En la vista de escritorio, solo como acento sobre gris. |
| `AppColors.accentTint` | El acento al 18 %: el cuadrito detrás de un ícono rosado, un estado "listo". |
| `AppColors.stripe` | La raya oscura de las rayas de HaNet (ver `Stripes`). |
| `AppColors.hairline` | Borde casi invisible de una tarjeta, o entre columnas. |
| `AppColors.separator` | Divisor entre filas de una lista agrupada. |
| `AppColors.scrim` | Lo que oscurece el fondo detrás de un diálogo, una hoja o la barra lateral. |
| `AppColors.errorText` / `errorTextOnLight` | Texto de error legible (el acento es muy oscuro para letra chica). |
| `AppSpacing` (4 · 8 · 12 · 16 · 24 · 32) | Espacios. El margen lateral de una página es `lg` (16). |
| `AppRadii` (8 · 16 · 24 · 32 · píldora) | `lg` (24) para tarjetas; `pill` para botones y chips, siempre. Con `borderCurve: 'continuous'`. |
| `AppTouch.minimum` 44 | Todo lo que se toca mide 44 pt o más (con `hitSlop` si el dibujo es más chico). |
| `AppType` | Escala de DM Sans, con el tracking según el tamaño: `largeTitle`, `title1`–`3`, `headline`, `body`, `callout`, `footnote`, `caption`. |
| `AppDisplay` / `AppFlexFonts` | Google Sans Flex para textos grandes y expresivos (Aniversario, promedios grandes). |
| `AppPressed` | Al presionar una tarjeta o un botón: baja un poco la opacidad y se encoge a 97 %. |
| `AppRowPressed` | Al presionar una fila de una lista: se ilumina en su lugar (una fila que se encoge se separa de sus divisores). |
| `SPRING_SMOOTH` · `SPRING_MOMENTUM` · `EASE_OUT_CUBIC` | Resortes sin rebote para casi todo; con un poco de rebote solo después de un gesto con impulso. Ver `constants/motion.ts`. |
| `project()` · `rubberband()` | Dónde quedaría un lanzamiento y la resistencia pasado un borde. |

## Reglas que se repiten

- Botones y chips con forma de píldora. Selectores en diálogo (`HanetSelect`), nunca en línea. Formularios secundarios en hoja (`formSheet`; en Android y la web, `withSheetFrame`).
- Animaciones breves (unos 120 ms al abrir) e interrumpibles; con "Reducir movimiento" se cambian por un fundido o nada.
- La respuesta al tocar llega al presionar (no al soltar), con `AppPressed` o `AppRowPressed`.
- Nada de emojis en la interfaz (la mascota de cada alianza es la excepción) ni datos falsos: lo que no existe va como "Próximamente".
- Textos por `t()` (ver `i18n/README.md`). Sistema HaNet UI (`app/ui-showcase.tsx`, `components/showcase/`) es la excepción: solo lo ve el equipo.

## Base (`components/ui/`)

| Componente | Archivo | Cuándo |
| --- | --- | --- |
| `HanetButton` | `hanet-button.tsx` | Toda acción. Variantes `primary` (azul pizarra), `accent` (rosado, la acción más importante de la pantalla) y `surface` (secundaria). Con `icon` opcional. |
| `HanetChip` | `hanet-chip.tsx` | Filtros y opciones cortas. `selected`, `compact`, `icon`; `accessibilityRole="checkbox"` cuando se pueden marcar varios. |
| `HanetSegmented` | `hanet-auth-fields.tsx` | Dos a cuatro opciones excluyentes en una barra (semestre en Notas, inicio de sesión). |
| `HanetField` | `hanet-auth-fields.tsx` | Campo de texto con etiqueta, de los formularios de cuenta. |
| `HanetSelect` · `HanetChoice` | `hanet-select.tsx` | `HanetChoice` muestra chips hasta 5 opciones y, con más, un campo que abre `HanetSelect` (lista en diálogo, con buscador desde 10). |
| `HanetDateTimePicker` · `HanetDateTimePickerModal` · `HanetTimeWheels` | `hanet-date-time-picker.tsx` | Fecha y hora en diálogo, con ruedas para la hora y "hoy" marcado. |
| `HanetDialog` · `HanetDialogActions` · `dialogStyles` | `hanet-dialog.tsx` | Diálogo tipo alerta con título, cuerpo y botones. Sobre `AlertModal`. |
| `AlertModal` | `alert-modal.tsx` | La capa de un diálogo: dibuja su propio fondo oscuro, abre en 120 ms y se va por donde vino. |
| `withSheetFrame` · `useSheetGuard` | `sheet-frame.tsx` | La hoja de HaNet en Android y la web (el `formSheet` nativo de Android se abre sin altura). `useSheetGuard` la retiene con cambios sin guardar. |
| `KeyboardScroll` · `useKeyboardOverlap` · `KeyboardDismissButton` | `keyboard.tsx` | Formularios en hojas y diálogos: el campo activo queda sobre el teclado y hay un botón para guardarlo. |
| `FrostedScreen` · `withTopInset` · `useFrostedInset` · `FrostedFill` | `frosted-screen.tsx` | Toda pantalla completa. De borde a borde bajo la barra de estado; con `header`, ese encabezado fijo flota con vidrio esmerilado (Calendar). |
| `SearchPill` | `search-pill.tsx` | Un buscador que en realidad es un botón: una píldora que abre la búsqueda y, mientras nadie la toca, va pasando lo que se puede encontrar (una línea cada 3 s; se detiene con la pantalla atrás y con "Reducir movimiento" solo funde). `tone="glass"` sobre una foto. El Inicio, en el teléfono y en escritorio. |
| `PageHeader` | `page-header.tsx` | Arriba de una página que se desplaza: `eyebrow` (dónde vive), `title` e `intro`. `above` para un chip de estado. `actions` van junto al título en una ventana ancha (y bajo la intro en el teléfono), donde el título crece a 40. Herramientas, Notas, Novedades, Licencias, Compartir. |
| `MessageCard` | `message-card.tsx` | En lugar de una sección: no cargó (`onRetry` agrega "Reintentar" y lo anuncia), no hay nada todavía, o el módulo está apagado. Gris, nunca rosado. |
| `Stripes` · `StripedBanner` · `StripedPill` | `stripes.tsx` | Las rayas de HaNet: solo para lo que apunta a una nota tapada. `StripedBanner` ("Tienes N notas nuevas · Destapar") y `StripedPill` ("2 nuevas") dentro de una fila. |
| `Skeleton` · `SkeletonGroup` · `SkeletonLines` | `skeleton.tsx` | Mientras carga algo que ya sabemos cómo se verá. Las pantallas armadas están en `components/skeletons.tsx`. |
| `HanetAvatar` | `hanet-avatar.tsx` | La foto de una persona o su blobatar (semilla en `accounts/{uid}.avatarSeed`). |
| `CustomIcon` · `AnimatedIcon` · `IconSymbol` | `custom-icon.tsx`, `AnimatedIcon.tsx`, `icon-symbol.tsx` | Íconos propios de HaNet, sus versiones con movimiento (pulso, flotar, aviso) y SF Symbols en iOS. |
| `Collapsible` | `collapsible.tsx` | Una sección que se abre y se cierra. |
| `GlassFill` · `AnimatedGlassView` · `liftGlass` · `LIQUID_GLASS` · `GlassPressed` · `glassClear` | `liquid-glass.tsx` | Liquid Glass en iPhone con iOS 26, solo para controles que flotan sobre el contenido (flechas del Calendar, buscador del Inicio y su campo, cerrar al destapar una nota) y para la selección que se desliza (días del Calendar, `HanetSegmented`), que se infla un poco al moverse. Nunca vidrio sobre vidrio ni en el contenido. El control pone `glassClear` y un `GlassFill` adentro con el radio de su forma (una píldora pasa la mitad de su alto); al presionar usa `GlassPressed` (solo se hunde: el vidrio con opacidad animada queda en blanco). En Android, la web y iPhones anteriores no cambia nada. |

## Estructura y navegación

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `GlobalTabBar` | `AppTabBar.tsx` | La única barra inferior, en la raíz. Sus botones se transforman entre pantallas (Inicio ⇄ Volver). Separación de 46 pt en iPhone, a propósito. |
| `SideNav` | `SideNav.tsx` | La navegación de una ventana ancha de la web: con textos desde 1024 px, solo íconos entre 768 y 1024. Se oscurece con `AppColors.scrim` cuando hay una hoja abierta. |
| `WideColumns` · `WideGrid` · `widePageStyle` · `useWide` · `useWideLayout` · `WIDE_PAGE` | `ui/wide-page.tsx` | La vista de escritorio de una página (web ancha, junto a `SideNav`). En el teléfono todo devuelve lo mismo de antes, así que la pantalla escribe su diseño una vez. `widePageStyle(wide, 'wide' \| 'reading')`: página centrada de 1180 px (o 760 para leer) con márgenes de escritorio. `WideColumns`: columna principal y una angosta (`aside`, 340 px, a la izquierda con `asideLeft`, fija con `stickyAside`); se apilan en el teléfono y bajo 900 px de contenido. `WideGrid`: tarjetas en filas de columnas iguales. Qué pantalla usa qué: `constants/desktop-screens.ts` (`npm run desktop:check`). |
| `EntryAside` · `useEntryAsideWidth` | `EntryAside.tsx` | El panel izquierdo de la entrada (registro, código, vínculo) en la web ancha, con los pasos y el actual en rosado. |
| `TopHeader` · `HomeTitle` | `TopHeader.tsx` | El encabezado del Inicio: "HaNet Beta" con los números de la versión arriba (tocarlos abre Novedades) y el buscador (`SearchPill`). La pantalla de búsqueda (`app/search.tsx`) parte dibujada igual, para que la píldora parezca crecer hasta ser el campo. |
| `SearchRow` | `search/search-row.tsx` | Un resultado o una sugerencia de la búsqueda, dentro de un `SettingsGroup`: título con lo que coincide en negrita y una línea de contexto. `top` (ícono rosado) para la mejor respuesta o lo que viene. Lo del Calendar que ya pasó va tachado (`item.past`). El índice y el orden están en `services/search.ts`. |
| `GridMenu` | `GridMenu.tsx` | La grilla de tiles del Inicio en el teléfono. |
| `DesktopHome` (y sus tarjetas) | `home/desktop-home.tsx` | El Inicio de escritorio: foto de la institución, la fila de lo urgente y el tablero. Gris, rosado solo para lo de ahora. |
| `WhatsNewDialog` · `WhatsNewPrompt` | `system/whats-new-dialog.tsx` | El primer Inicio después de actualizar (build, update o "Actualizar" en la web): lo más importante de la versión, una vez. Sale de `highlights` de `constants/changelog.json` (o las primeras 3 novedades). Se apaga en Configuraciones → Acerca de HaNet (`services/whats-new-prompt.ts`, por dispositivo). `WhatsNewPrompt` es solo el diálogo. |
| `TopNotice` | `system/top-notice.tsx` | Píldora flotante arriba de todo, que no tapa la pantalla: "Sin conexión" y "Hay una versión nueva". |
| `UpdatePrompt` | `system/update-prompt.tsx` | Web: registra el service worker y ofrece la versión nueva con un `TopNotice`. |
| `SettingsGroup` · `SettingsLinkRow` · `SettingsToggleRow` · `SettingsNote` | `settings/settings-list.tsx` | Listas agrupadas tipo ajustes del teléfono. Toda la fila cambia el interruptor. |
| `DeviceRow` | `settings/device-row.tsx` | Un dispositivo donde está abierta la cuenta (Configuraciones → Seguridad), dentro de un `SettingsGroup`: ícono según teléfono, tablet o computador, sistema y app, y la última actividad. El que tienes en la mano dice "Este dispositivo" en rosado. |
| `useQuickActions` | `quick-actions.tsx` | Los atajos al mantener el ícono de la app (Calendar, ClassHall, Eventos, Notificaciones). |
| `AppErrorLayer` · `ErrorScreen` y pantallas | `errors/` | Cuenta bloqueada, servidores, sin conexión, error fatal y pantalla no encontrada (`NotFoundScreen`, la de `app/+not-found.tsx` para links que no llevan a ninguna parte). |
| `LaunchSplash` · `WelcomeCelebration` · `InstitutionSync` · `OnboardingProgress` | raíz de `components/` | La entrada: splash, bienvenida al unirse, vínculo con la institución y el avance del registro. |

## Notas (módulo `grades`)

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `ScratchCard` | `classhall/scratch-card.tsx` (Skia), `scratch-card.web.tsx` (canvas) | El raspe de una nota. Tapada es igual para cualquier nota; un 6,0 o más, ya visible, suma un estallido (`celebrate`). Solo táctil, sin sonido. Partículas en `scratch-particles.ts`, cobertura en `scratch-coverage.ts`. |
| `GradesTile` · `GradesTileView` · `useGradesBadge` | `grades/grades-tile.tsx` | El tile de Notas arriba de ClassHall: cuántas faltan por destapar, nunca notas ni promedios. `GradesTileView` es solo el dibujo. |
| `NewGradesBanner` · `StudentGrades` | `classhall/grades-ui.tsx` | Las notas del estudiante dentro de un Hall: el banner rayado y la lista con promedio aproximado. |
| `GradesLocked` | `grades/grades-lock.tsx` | En lugar de las notas mientras "Proteger Notas" las tiene bloqueadas. `auto` pide Face ID al abrir; `onUnlock` para la vista previa. |

## Entradas (módulo `tickets`)

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `TicketView` · `ticketPath` · `ticketWhen` | `tickets/ticket.tsx` | La entrada: rectángulo corto con dos muescas, información a la izquierda sobre la luz de la portada que viene desde la izquierda y el QR en el talón (variante A, talón oscuro). Estados `active`, `pending` (QR de relleno borroso con "Por aceptar"), `link`, `shared`, `printed`, `used`. Normal y `large`. Sin cuenta regresiva. |
| `ProfileTickets` · `TicketPile` | `tickets/profile-tickets.tsx` | La sección Entradas de Perfil (solo con entradas para un evento que viene) y la pila de varias entradas con ×N. |
| `TicketShareModal` · `PrintedTicket` | `tickets/ticket-share.tsx` | La entrada fuera de la app: imagen oscura para compartir o papel blanco para imprimir, con código fijo y código escrito. |
| `TicketGlow` | `tickets/ticket-glow.tsx` | La luz del color de la portada detrás de una entrada (Llegada, Entrada válida, Recibir): las manchas difusas de `EventGlow` reunidas alrededor de la entrada, que se mueven lento. Llena a su padre; `style` la hace aparecer. |
| `Tilt` | `tickets/tilt.tsx` (`.web.tsx` quieto) | Inclina su contenido con el teléfono (al recibir una entrada). |
| `ScreenshotGuard` · `ScreenshotWarning` | `system/screenshot-guard.tsx` | Avisa que una captura no sirve cuando alguien saca una con un QR de HaNet en pantalla (HN-QR y entradas). iPhone y Android 14+. `ScreenshotWarning` es solo el diálogo. |

**Probar las animaciones:** las pantallas `tickets/detail`, `validated`, `arrival` y `receive` abren con `?demo=1` (`arrival` acepta cuántas, `?demo=5`) con una entrada inventada (`showcase/ticket-demo.ts`) que no toca el servidor. Sistema HaNet UI → Entradas → "Probar las animaciones" tiene un botón para cada una.

## Notificaciones

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `NotificationRow` | `notifications/notification-row.tsx` | Una notificación: ícono según el tipo, punto rosado si es nueva; una nota nueva lleva rayas y nunca la nota. Las alertas de la cuenta (`signIn`, `account`, `role`) usan la misma fila, también en la Actividad reciente de Seguridad. |
| `HomeNotificationsPreview` · `NotificationsPeek` | `notifications/home-notifications.tsx` | El final del Inicio: "Tienes N notificaciones nuevas" y las 2 más recientes. |
| `NotificationsPanel` | `notifications/notifications-panel.tsx` | La sección que sube pegada al Inicio. |
| `usePullDown` | `notifications/pull-down.ts` | Tirar pasado un borde para abrir o cerrar: umbral con vibración, resistencia y resorte. iOS lee el rebote del scroll; Android y la web miden el dedo. |
| `PullHint` | `notifications/pull-hint.tsx` | La flecha y el texto que se dan vuelta al pasar el umbral ("Desliza…" → "Suelta…"). |
| `PushPermissionDialog` · `PushPermissionPrompt` | `notifications/push-permission-dialog.tsx` | La pregunta de HaNet antes del permiso del sistema. `PushPermissionPrompt` es solo el diálogo. |

## Calendar, Horario y ClassHall

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `DayChangeBanner` · `DayChangeList` · `DismissalLine` | `calendar/day-change-banner.tsx` | Días sin clases y salidas anticipadas: tarjeta rosada sólida, la lista del Horario y la línea de salida. |
| `CalendarViewPill` · `CalendarViewMenu` | `calendar/view-menu.tsx` | El selector de vistas que crece desde la barra. |
| `MonthView` · `WeekView` · `YearView` | `calendar/MonthYearViews.tsx` | Las vistas de mes, semana y año. |
| `NowNextCard` · `ScheduleView` · `BlockEditor` | `schedule/` | El Horario: ahora y después, la semana y el editor de bloques. |
| `HallHero` · `HallBanner` · `HallTile` · `HallPill` · `DocumentTile` · `TopBarButton` | `classhall/hall-ui.tsx` | Las piezas del interior de un Hall. |
| `WideHallCard` · `WeekPanel` | `classhall/hall-grid.tsx` | Mis clases en la web ancha: tarjetas en grilla y la semana de todos los Halls. |
| `TaskRow` · `SubmissionItemRow` · `StatusPill` | `classhall/task-ui.tsx` | Tareas y entregas: la fila de una tarea, un archivo entregado y su estado. |

## Herramientas

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `AreaIcon` · `KnowledgeIcon` | `tools/area-icon.tsx` | Íconos de trazo (24 × 24, 2 px) de las 9 áreas de HaNet Electividad y de las áreas de carreras de mifuturo.cl. |
| `VerbTag` · `VerbAnswerField` · `VerbTimeBar` | `tools/verb-ui.tsx` | Verbos en inglés: la etiqueta de lo que se pregunta (`strong`, rosada) o del tipo de verbo; el campo de respuesta, sin autocorrector ni mayúsculas, con marca de bien o mal (`state`); y el reloj de Infinito, que se vacía de corrido y se pone rosado al final. |
| `SoloGame` · `InfiniteGame` · `VerbCountdown` | `tools/verb-games.tsx` | Los dos juegos de Verbos en inglés y su cuenta regresiva, dentro de `app/tools/verbs/play.tsx`. Solo esa pantalla los usa. |

## Eventos, Feed y Aniversario

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `EventCard` · `FeaturedEventCard` · `MarqueeBanner` · `EventsMarquee` · `PageDots` | `events/event-ui.tsx` | Tarjetas de eventos y la franja inclinada ("¡HOY!"). |
| `EventGlow` | `events/event-glow.tsx` | El brillo de colores de la portada en el detalle de un evento. |
| `CheckInResultCard` | `events/checkin-result.tsx` | Lo que ve quien pasa lista con HN-QR. |
| `FeedPostView` · `SpaceAvatar` · `SpaceTile` · `ReactionChips` · `ReactionPicker` · `FeedCarousel` · `OfficialSeal` | `feed/feed-ui.tsx` | El Feed. |
| `FeedEventCard` · `FeedPollView` | `feed/feed-attachments.tsx` | Un evento y una votación anónima dentro de una publicación. |
| `StoryShareSheet` | `share/story-share.tsx` | Compartir como historia (9:16). |
| `GradientCard` · `FlagSurface` · `FlagGlow` | `anniversary/gradient-card.tsx`, `flag-surface.tsx` (y `.web.tsx`) | Los colores de las alianzas ondeando como bandera, solo en tarjetas de puntos y resultados. Se detienen fuera de pantalla y con "Reducir movimiento". |
| `FlexText` | `anniversary/flex-text.tsx` (+ `.web.tsx`, `flex-axes.ts`) | Texto en Google Sans Flex que desliza peso y ancho con la fuente variable (`fontVariationSettings`). Con `fit` queda en una línea: achica el tamaño para que quepa su forma más ancha (el padre le da el ancho). |
| `AllianceBadge` · `AlliancePill` · `AllianceCard` · `Scoreboard` · `LeaderCard` · `ActivityList` · `SectionTitle` | `anniversary/anniversary-ui.tsx` | El Aniversario. |
| `CelebrationTile` | `anniversary/celebration-tile.tsx` | El tile del Inicio mientras no se ve la bienvenida del aniversario. |

## Organizar (`app/organize/`)

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `ArrivalCounter` | `organize/organize-ui.tsx` | "Llegaron 212 de 300" con su barra; `size="large"` en la página del evento. |
| `TodayEventCard` | `organize/organize-ui.tsx` | El evento con la puerta abierta. `compact` en el Inicio ("Hoy organizas", con Escanear); `door` para el docente que solo escanea (sin conteos, abre el escáner). |
| `OrganizedEventRow` | `organize/organize-ui.tsx` | Un evento en las listas de Organizar: portada, cuándo, tipo y estado. |
| `ScanPill` · `CreatePill` · `CreateMenu` · `organizeCenter` | `organize/organize-bar.tsx` | El centro de la barra en Organizar: "Escanear" mientras una puerta está abierta, si no "Crear" con su menú (aviso, evento, votación; Admin y HNT también suspender clases). `scanHref` elige el escáner de entradas o Pasar lista. |
| `OrganizeHeaderButton` · `HomeOrganizeToday` · `useOrganizeToday` | `organize/organize-entry.tsx` | Organizar fuera de sí: el botón del encabezado del Inicio (punto rosado con una puerta abierta) y "Hoy organizas". |

## Web

| Componente | Archivo | Qué es |
| --- | --- | --- |
| `InstallGuideDialog` · `HomeInstallGuide` | `web/install-guide.tsx` | "Agregar a inicio" con los pasos del navegador, o "Instalar" si el navegador da su aviso. `preview` muestra la guía de otro navegador sin guardar nada. |
