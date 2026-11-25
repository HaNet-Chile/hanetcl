import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { StudentPicker } from '@/components/organize/notice-ui';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { KeyboardScroll } from '@/components/ui/keyboard';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppRadii, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { deleteNoticeGroup, listNoticeGroups, peekNoticeGroups, saveNoticeGroup } from '@/services/notices-service';
import type { GroupMember, NoticeGroup } from '@/services/notices-service';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Grupos de estudiantes (Admin and HNT): students who get the same notices
// again and again, saved once ("Selección de fútbol", "Debate"). Only
// students of the institution stay in a group.

type Draft = { id?: string; name: string; members: Record<string, GroupMember> };

function membersOf(group: NoticeGroup) {
  return Object.fromEntries(group.members.map(member => [member.uid, member]));
}

function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Opened from "Enviar una notificación": that sheet is underneath, so no send button here.
  const fromNotify = useLocalSearchParams<{ from?: string }>().from === 'notify';
  const [groups, setGroups] = useState<NoticeGroup[] | undefined>(() => peekNoticeGroups());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let live = true;
    listNoticeGroups()
      .then(list => { if (live) setGroups(list); })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.groups.noPudimosCargarLosGrupos'))); });
    return () => { live = false; };
  }, []);
  useEffect(load, [load]);

  const count = draft ? Object.keys(draft.members).length : 0;
  const ready = !!draft && draft.name.trim().length > 0 && count > 0;

  const save = async () => {
    if (!draft || !ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await saveNoticeGroup({ id: draft.id, name: draft.name.trim(), uids: Object.keys(draft.members) });
      setDraft(null);
      load();
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(describeAuthError(err, t('organize.groups.noPudimosGuardarElGrupo')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteNoticeGroup(draft.id);
      setDeleting(false);
      setDraft(null);
      load();
    } catch (err) {
      setDeleting(false);
      setError(describeAuthError(err, t('organize.groups.noPudimosBorrarElGrupo')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardScroll style={styles.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.xl }]}>
      {draft ? (
        <>
          <ThemedText accessibilityRole="header" style={styles.title}>{draft.id ? t('organize.groups.editarElGrupo') : t('organize.groups.nuevoGrupo')}</ThemedText>
          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('common.nombre')}</ThemedText>
            <TextInput
              value={draft.name}
              onChangeText={name => setDraft({ ...draft, name })}
              placeholder={t('organize.groups.porEjemploSeleccionDeFutbol')}
              placeholderTextColor={AppColors.textSecondary}
              maxLength={40}
              autoCapitalize="sentences"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('organize.groups.estudiantes')}</ThemedText>
            <StudentPicker selected={draft.members} onChange={members => setDraft({ ...draft, members })} />
          </View>
          {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            disabled={!ready || busy}
            onPress={() => void save()}
            style={({ pressed }) => [styles.submit, local.submit, (!ready || busy) && styles.submitDisabled, pressed && styles.pressed]}
          >
            <ThemedText style={styles.submitText}>{busy ? t('common.guardando') : t('organize.groups.guardarElGrupo')}</ThemedText>
          </Pressable>
          {!!draft.id && <HanetButton label={t('organize.groups.borrarElGrupo')} variant="surface" onPress={() => setDeleting(true)} disabled={busy} />}
          <Pressable accessibilityRole="button" onPress={() => { setDraft(null); setError(''); }} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <ThemedText style={styles.cancelText}>{t('organize.groups.volverALosGrupos')}</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <View>
            <ThemedText accessibilityRole="header" style={styles.title}>{t('organize.groups.gruposDeEstudiantes')}</ThemedText>
            <ThemedText style={local.lead}>{t('organize.groups.paraEnviarleUnaNotificacionA')}</ThemedText>
          </View>
          {groups === undefined && !error && <ActivityIndicator color={AppColors.textSecondary} />}
          {!!groups?.length && (
            <View style={local.group}>
              {groups.map((group, index) => (
                <View key={group.id} style={[local.row, index > 0 && local.line]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('organize.groups.editarNameMemberscountEstudiantes', { name: group.name, membersCount: group.members.length })}
                    onPress={() => setDraft({ id: group.id, name: group.name, members: membersOf(group) })}
                    style={({ pressed }) => [local.rowMain, pressed && AppRowPressed]}
                  >
                    <ThemedText numberOfLines={1} style={local.name}>{group.name}</ThemedText>
                    <ThemedText style={local.count}>{t('classhall.hall.countEstudiantes', { count: group.members.length })}</ThemedText>
                  </Pressable>
                  {!fromNotify && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('organize.groups.enviarUnaNotificacionAName', { name: group.name })}
                    hitSlop={6}
                    onPress={() => router.push({ pathname: '/organize/notify', params: { group: group.id } })}
                    style={({ pressed }) => [local.send, pressed && styles.pressed]}
                  >
                    <Ionicons name="paper-plane-outline" size={20} color={AppColors.textPrimary} />
                  </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
          {groups?.length === 0 && <ThemedText style={styles.hint}>{t('organize.groups.todaviaNoHayGrupos')}</ThemedText>}
          {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
          <HanetButton label={t('organize.groups.nuevoGrupo')} variant="accent" onPress={() => { setDraft({ name: '', members: {} }); setError(''); }} />
          {Platform.OS !== 'ios' && (
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
              <ThemedText style={styles.cancelText}>{t('common.cerrar')}</ThemedText>
            </Pressable>
          )}
        </>
      )}

      <HanetDialog
        visible={deleting}
        onRequestClose={() => { if (!busy) setDeleting(false); }}
        title={t('organize.groups.borrarName', { name: draft?.name || 'el grupo' })}
        body={t('organize.groups.lasNotificacionesQueYaSe')}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" onPress={() => setDeleting(false)} disabled={busy} style={dialogStyles.action} />
          <HanetButton label={t('common.borrar')} variant="accent" onPress={() => void remove()} disabled={busy} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </KeyboardScroll>
  );
}

const local = StyleSheet.create({
  lead: { ...AppType.callout, color: AppColors.textSecondary, marginTop: 4 },
  submit: { backgroundColor: AppColors.accent },
  group: { borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: AppColors.canvas, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  rowMain: { flex: 1, minHeight: 60, justifyContent: 'center', gap: 2, paddingHorizontal: AppSpacing.lg, paddingVertical: AppSpacing.sm },
  name: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  count: { ...AppType.footnote, color: AppColors.textSecondary },
  send: { width: 52, minHeight: 60, alignItems: 'center', justifyContent: 'center' },
});

export default withSheetFrame(GroupsScreen, AppColors.surface);
