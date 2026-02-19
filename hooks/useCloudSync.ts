import React, { useState, useEffect, useRef } from 'react';
import type { ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition } from '../types';
import { saveToStorage, loadFromStorage, savePreferences, loadPreferences, loadDashboardWidgets, type UserPreferences } from '../utils/storage';
import { saveToFirestore, subscribeToFirestore } from '../utils/firestoreSync';
import { isFirebaseConfigured } from '../firebase';
import { normalizeDashboardWidgets } from '../constants/dashboardWidgets';
import type { DashboardWidgetsState } from '../constants/dashboardWidgets';

export interface CloudSyncPayload {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
}

export interface CloudSyncPreferences {
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  dashboardWidgets: DashboardWidgetsState;
}

export interface UseCloudSyncOptions {
  userId: string | null | undefined;
  payload: CloudSyncPayload;
  preferences: CloudSyncPreferences;
  setPayload: React.Dispatch<React.SetStateAction<CloudSyncPayload>>;
  setPreferences: (prefs: Partial<CloudSyncPreferences>) => void;
  getEmptyPayload: () => CloudSyncPayload;
}

export interface UseCloudSyncResult {
  cloudLoaded: boolean;
  cloudLoadPending: boolean;
  cloudSyncError: string | null;
  setCloudSyncError: (msg: string | null) => void;
  markClassAdded: () => void;
  flushSave: () => void;
}

export function useCloudSync({
  userId,
  payload,
  preferences,
  setPayload,
  setPreferences,
  getEmptyPayload,
}: UseCloudSyncOptions): UseCloudSyncResult {
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudLoadPending, setCloudLoadPending] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);

  const saveToFirestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFirestorePayloadRef = useRef<CloudSyncPayload & { preferences?: CloudSyncPreferences } | null>(null);
  const previousUserIdRef = useRef<string | null>(null);
  const lastCloudHadDataRef = useRef(false);
  const lastCloudUpdatedAtRef = useRef(0);
  const lastAddClassAtRef = useRef(0);
  const flushFirestoreSaveRef = useRef<() => void>(() => {});

  const { darkMode, fontSize, dashboardWidgets } = preferences;

  // Real-time Firestore sync - load + subscribe for updates
  useEffect(() => {
    if (!userId || !isFirebaseConfigured() || cloudLoaded) return;
    setCloudLoadPending(true);
    let cancelled = false;
    const unsubscribe = subscribeToFirestore(
      userId,
      (data, updatedAt) => {
        if (cancelled) return;
        if (data) {
          lastCloudHadDataRef.current = data.classes.length > 0;
          lastCloudUpdatedAtRef.current = updatedAt;
          setPayload((prev) => {
            const recentlyAdded = Date.now() - lastAddClassAtRef.current < 3000;
            const weHaveMoreClasses = prev.classes.length > data.classes.length;
            if (recentlyAdded && weHaveMoreClasses) return prev;
            return {
              ...prev,
              classes: data.classes,
              activeClassId: data.activeClassId,
              riskSettings: data.riskSettings,
              perClassRiskSettings: data.perClassRiskSettings ?? {},
              periodDefinitions: data.periodDefinitions ?? [],
            };
          });
          saveToStorage(
            {
              classes: data.classes,
              activeClassId: data.activeClassId,
              riskSettings: data.riskSettings,
              perClassRiskSettings: data.perClassRiskSettings ?? {},
              periodDefinitions: data.periodDefinitions ?? [],
            },
            userId
          );
          if (data.preferences) {
            setPreferences({
              darkMode: data.preferences.darkMode,
              fontSize: data.preferences.fontSize,
              dashboardWidgets: data.preferences.dashboardWidgets
                ? normalizeDashboardWidgets(data.preferences.dashboardWidgets)
                : loadDashboardWidgets(),
            });
            savePreferences(data.preferences);
          }
          setCloudSyncError(null);
        } else {
          lastCloudHadDataRef.current = false;
          setPayload(() => getEmptyPayload());
        }
        setCloudLoaded(true);
        setCloudLoadPending(false);
      },
      (err) => {
        if (cancelled) return;
        setCloudLoaded(true);
        setCloudLoadPending(false);
        const msg = err?.message ?? String(err);
        setCloudSyncError(msg.includes('permission') ? 'אין הרשאה לקרוא מהענן. עדכן את כללי Firestore.' : msg);
      }
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, cloudLoaded, getEmptyPayload, setPayload, setPreferences]);

  // Reset cloudLoaded when user changes
  useEffect(() => {
    if (!userId) {
      setCloudLoaded(false);
      setCloudLoadPending(false);
      previousUserIdRef.current = null;
      lastCloudHadDataRef.current = false;
    } else {
      const currentUserId = userId;
      if (previousUserIdRef.current !== null && previousUserIdRef.current !== currentUserId) {
        setCloudLoaded(false);
      }
      previousUserIdRef.current = currentUserId;
      const fromLocal = loadFromStorage(currentUserId);
      if (fromLocal.classes.length > 0 && !cloudLoaded) {
        setPayload((prev) => ({ ...prev, ...fromLocal }));
      }
    }
  }, [userId, cloudLoaded, setPayload]);

  // Save to cloud on visibility change / beforeunload
  useEffect(() => {
    const flushFirestoreSave = () => {
      if (!userId || !isFirebaseConfigured() || !cloudLoaded) return;
      const prefs = loadPreferences();
      const fullPayload = pendingFirestorePayloadRef.current || {
        ...payload,
        preferences: {
          darkMode,
          fontSize,
          dashboardViewMode: (prefs.dashboardViewMode ?? 'table') as 'table' | 'cards',
          dashboardWidgets,
        } as UserPreferences,
      };
      if (saveToFirestoreTimeoutRef.current) {
        clearTimeout(saveToFirestoreTimeoutRef.current);
        saveToFirestoreTimeoutRef.current = null;
      }
      const allowEmpty = lastCloudHadDataRef.current;
      type FirestorePayload = Parameters<typeof saveToFirestore>[1];
      saveToFirestore(userId, fullPayload as FirestorePayload, allowEmpty)
        .then(() => setCloudSyncError(null))
        .catch((err) => {
          setCloudSyncError(
            err?.message?.includes('permission') ? 'שמירה לענן: עדכן כללי Firestore.' : (err?.message ?? 'שגיאה')
          );
        });
    };
    flushFirestoreSaveRef.current = flushFirestoreSave;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushFirestoreSave();
    };
    const onBeforeUnload = () => flushFirestoreSave();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [
    userId,
    cloudLoaded,
    payload.classes,
    payload.activeClassId,
    payload.riskSettings,
    payload.perClassRiskSettings,
    payload.periodDefinitions,
    darkMode,
    fontSize,
    dashboardWidgets,
  ]);

  // Debounced save to Firestore when payload/preferences change
  useEffect(() => {
    const fullPayload = {
      ...payload,
      preferences: {
        darkMode,
        fontSize,
        dashboardViewMode: 'table' as const,
        dashboardWidgets,
      },
    };
    saveToStorage(
      {
        classes: payload.classes,
        activeClassId: payload.activeClassId,
        riskSettings: payload.riskSettings,
        perClassRiskSettings: payload.perClassRiskSettings,
        periodDefinitions: payload.periodDefinitions,
      },
      userId ?? undefined
    );
    if (userId && isFirebaseConfigured() && cloudLoaded) {
      pendingFirestorePayloadRef.current = fullPayload;
      if (saveToFirestoreTimeoutRef.current) clearTimeout(saveToFirestoreTimeoutRef.current);
      saveToFirestoreTimeoutRef.current = setTimeout(() => {
        const allowEmpty = lastCloudHadDataRef.current;
        saveToFirestore(userId, fullPayload, allowEmpty)
          .then(() => setCloudSyncError(null))
          .catch((err) => {
            const msg = err?.message ?? String(err);
            if (msg.includes('permission-denied') || msg.includes('Permission denied')) {
              setCloudSyncError('שמירה לענן נכשלה: עדכן כללי Firestore ב-Console (ראה FIREBASE-SETUP.md).');
            } else {
              setCloudSyncError('שמירה לענן נכשלה: ' + msg);
            }
          });
        saveToFirestoreTimeoutRef.current = null;
      }, 400);
    }
    return () => {
      if (saveToFirestoreTimeoutRef.current) clearTimeout(saveToFirestoreTimeoutRef.current);
    };
  }, [
    payload.classes,
    payload.activeClassId,
    payload.riskSettings,
    payload.perClassRiskSettings,
    payload.periodDefinitions,
    userId,
    cloudLoaded,
    darkMode,
    fontSize,
    dashboardWidgets,
  ]);

  const markClassAdded = () => {
    lastAddClassAtRef.current = Date.now();
    lastCloudHadDataRef.current = true;
  };

  const flushSave = () => {
    flushFirestoreSaveRef.current();
  };

  return {
    cloudLoaded,
    cloudLoadPending,
    cloudSyncError,
    setCloudSyncError,
    markClassAdded,
    flushSave,
  };
}
