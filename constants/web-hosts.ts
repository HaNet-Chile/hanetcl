// Where HaNet lives on the web (muxp.art, since v0.16.0). The Firebase
// defaults still answer, so links already sent keep working.
//   id.hanet.muxp.art   site hanet-edu: sign-in with Google, the Auth email
//                       links, /terminos, /vincular and the emails' logos
//   app.hanet.muxp.art  site hanet-app: the web app
export const APP_HOST = 'app.hanet.muxp.art';

// The web app's old addresses: there HaNet only shows MovedScreen
// (components/errors/AppErrorScreens.tsx), which sends people to APP_HOST.
export const OLD_APP_HOSTS = ['hanet-app.web.app', 'hanet-app.firebaseapp.com'];
