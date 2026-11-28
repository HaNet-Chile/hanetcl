import { SettingsLinkRow } from '@/components/settings/settings-list';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { describeAuthError, resetPassword, useSession } from '@/services/auth-service';
import { GoogleCancelled, googleAccountOf, hasPassword, linkGoogle, unlinkGoogle } from '@/services/google-sign-in';
import React, { useState } from 'react';
import { t } from '@/i18n';

type Dialog = null | 'linked' | 'confirm-unlink' | 'only-google' | 'message';

/**
 * Configuraciones → Cuenta → Google: adds Google as a quick way into the
 * HaNet ID, or removes it. It can only be removed while the account also has
 * a password, or nobody could get in.
 */
export function GoogleAccountSetting() {
  const { user } = useSession();
  // Linking reloads the user in place, so the row redraws by hand.
  const [, redraw] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null);

  if (!user) return null;
  const google = googleAccountOf(user);
  const withPassword = hasPassword(user);

  const tell = (title: string, body: string) => {
    setMessage({ title, body });
    setDialog('message');
  };

  const link = async () => {
    setBusy(true);
    try {
      await linkGoogle(user);
      redraw(value => value + 1);
      const email = googleAccountOf(user)?.email;
      tell(t('components.settings.googleAccountSetting.googleVinculado'), email ? t('components.settings.googleAccountSetting.desdeAhoraTambienPuedesEntrar', { email }) : t('components.settings.googleAccountSetting.desdeAhoraTambienPuedesEntrar2'));
    } catch (error) {
      if (!(error instanceof GoogleCancelled)) tell(t('components.settings.googleAccountSetting.noPudimosVincularGoogle'), describeAuthError(error, t('components.settings.googleAccountSetting.intentaloDeNuevoEnUn')));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await unlinkGoogle(user);
      redraw(value => value + 1);
      setDialog(null);
    } catch (error) {
      tell(t('components.settings.googleAccountSetting.noPudimosQuitarGoogle'), describeAuthError(error, t('components.settings.googleAccountSetting.intentaloDeNuevoEnUn')));
    } finally {
      setBusy(false);
    }
  };

  const createPassword = async () => {
    if (!user.email) return;
    setBusy(true);
    try {
      await resetPassword(user.email);
      tell(t('components.settings.googleAccountSetting.revisaTuCorreo'), t('components.settings.googleAccountSetting.teMandamosUnLinkA', { email: user.email }));
    } catch (error) {
      tell(t('components.settings.googleAccountSetting.noPudimosMandarElCorreo'), describeAuthError(error, t('components.settings.googleAccountSetting.intentaloDeNuevoEnUn')));
    } finally {
      setBusy(false);
    }
  };

  const close = () => { if (!busy) setDialog(null); };

  return (
    <>
      <SettingsLinkRow
        icon="logo-google"
        label={t('components.settings.googleAccountSetting.google')}
        detail={busy && !dialog ? t('components.settings.googleAccountSetting.conectando') : google ? t('components.settings.googleAccountSetting.vinculada') : t('components.settings.googleAccountSetting.vincular')}
        hint={google ? undefined : t('components.settings.googleAccountSetting.entraAHanetConTu')}
        onPress={() => {
          if (busy) return;
          if (google) setDialog('linked');
          else void link();
        }}
      />

      <HanetDialog
        visible={dialog === 'linked'}
        onRequestClose={close}
        dismissOnBackdrop
        title={t('components.settings.googleAccountSetting.google')}
        body={withPassword
          ? t('components.settings.googleAccountSetting.entrasAHanetConEmail', { email: google?.email ?? 'tu cuenta de Google' })
          : t('components.settings.googleAccountSetting.entrasAHanetConEmail2', { email: google?.email ?? 'tu cuenta de Google' })}
      >
        <HanetDialogActions>
          <HanetButton label={t('components.settings.googleAccountSetting.quitarGoogle')} variant="surface" onPress={() => setDialog(withPassword ? 'confirm-unlink' : 'only-google')} style={dialogStyles.action} />
          <HanetButton label={t('common.listo')} variant="accent" onPress={() => setDialog(null)} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>

      <HanetDialog
        visible={dialog === 'confirm-unlink'}
        onRequestClose={close}
        dismissOnBackdrop={!busy}
        title={t('components.settings.googleAccountSetting.quitarGoogle2')}
        body={t('components.settings.googleAccountSetting.yaNoPodrasEntrarCon', { email: google?.email ?? 'Google' })}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" disabled={busy} onPress={() => setDialog(null)} style={dialogStyles.action} />
          <HanetButton label={busy ? t('editProfile.quitando') : t('common.quitar')} variant="accent" disabled={busy} onPress={() => void unlink()} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>

      <HanetDialog
        visible={dialog === 'only-google'}
        onRequestClose={close}
        dismissOnBackdrop={!busy}
        title={t('components.settings.googleAccountSetting.googleEsTuUnicaForma')}
        body={t('components.settings.googleAccountSetting.paraQuitarloPrimeroCreaUna', { email: user.email ?? 'tu correo' })}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" disabled={busy} onPress={() => setDialog(null)} style={dialogStyles.action} />
          <HanetButton label={busy ? t('common.enviando') : t('components.settings.googleAccountSetting.crearContrasena')} variant="accent" disabled={busy || !user.email} onPress={() => void createPassword()} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>

      <HanetDialog
        visible={dialog === 'message'}
        onRequestClose={() => setDialog(null)}
        dismissOnBackdrop
        title={message?.title}
        body={message?.body}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.listo')} variant="accent" onPress={() => setDialog(null)} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </>
  );
}
