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
  manualSaveToCloud: () => Promise<boolean>;
}

function mergeClassesByLatest(localClasses: ClassGroup[], cloudClasses: ClassGroup[]): ClassGroup[] {
  const merged = new Map<string, ClassGroup>();
  for (const c of cloudClasses) merged.set(c.id, c);
  for (const c of localClasses) {
    const existing = merged.get(c.id);
    if (!existing) {
      merged.set(c.id, c);
      continue;
    }
    const existingTs = existing.lastUpdated?.getTime?.() ?? 0;
    const currentTs = c.lastUpdated?.getTime?.() ?? 0;
    if (currentTs >= existingTs) merged.set(c.id, c);
  }
  return Array.from(merged.values()).sort((a, b) => a.lastUpdated.getTime() - b.lastUpdated.getTime());
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
  const pendingFirestorePayloadRef = useRef<CloudSyncPayload & { preferences?: UserPreferences } | null>(null);
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
    
    // Timeout to ensure loading always completes
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn('Cloud sync timeout - marking as loaded');
        setCloudLoaded(true);
        setCloudLoadPending(false);
        // Load from local storage as fallback
        const fromLocal = loadFromStorage(userId);
        if (fromLocal.classes.length > 0) {
          setPayload((prev) => ({ ...prev, ...fromLocal }));
        }
      }
    }, 10000); // 10 second timeout
    
    const unsubscribe = subscribeToFirestore(
      userId,
      (data, updatedAt) => {
        if (cancelled) return;
        clearTimeout(timeoutId); // Clear timeout on successful load
        if (data) {
          lastCloudHadDataRef.current = data.classes.length > 0;
          lastCloudUpdatedAtRef.current = updatedAt;
          setPayload((prev) => {
            const recentlyAdded = Date.now() - lastAddClassAtRef.current < 3000;
            const mergedClasses = mergeClassesByLatest(prev.classes, data.classes);
            const weHaveMoreClasses = mergedClasses.length > data.classes.length;
            if (recentlyAdded && weHaveMoreClasses) {
              return { ...prev, classes: mergedClasses };
            }
            return {
              ...prev,
              classes: mergedClasses,
              activeClassId:
                data.activeClassId && mergedClasses.some((c) => c.id === data.activeClassId)
                  ? data.activeClassId
                  : prev.activeClassId && mergedClasses.some((c) => c.id === prev.activeClassId)
                    ? prev.activeClassId
                    : mergedClasses[0]?.id ?? null,
              riskSettings: data.riskSettings ?? prev.riskSettings,
              perClassRiskSettings: data.perClassRiskSettings ?? prev.perClassRiskSettings ?? {},
              periodDefinitions: data.periodDefinitions ?? prev.periodDefinitions ?? [],
            };
          });
          // Try to save to localStorage, but don't block if it fails
          try {
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
          } catch (e) {
            // localStorage quota exceeded - continue anyway, data is in Firestore
            console.warn('Could not save to localStorage (quota exceeded), continuing with cloud data', e);
          }
          if (data.preferences) {
            setPreferences({
              darkMode: data.preferences.darkMode,
              fontSize: data.preferences.fontSize,
              dashboardWidgets: data.preferences.dashboardWidgets
                ? normalizeDashboardWidgets(data.preferences.dashboardWidgets)
                : loadDashboardWidgets(),
            });
            try {
              savePreferences(data.preferences);
            } catch (e) {
              console.warn('Could not save preferences to localStorage', e);
            }
          }
          setCloudSyncError(null);
        } else {
          // Keep current state; if local has data, periodic/debounced save will push it to cloud.
          lastCloudHadDataRef.current = false;
        }
        // Always mark as loaded, even if localStorage save failed
        setCloudLoaded(true);
        setCloudLoadPending(false);
      },
      (err) => {
        if (cancelled) return;
        clearTimeout(timeoutId); // Clear timeout on error
        setCloudLoaded(true);
        setCloudLoadPending(false);
        const msg = err?.message ?? String(err);
        setCloudSyncError(msg.includes('permission') ? 'אין הרשאה לקרוא מהענן. עדכן את כללי Firestore.' : msg);
        // Load from local storage as fallback
        const fromLocal = loadFromStorage(userId);
        if (fromLocal.classes.length > 0) {
          setPayload((prev) => ({ ...prev, ...fromLocal }));
        }
      }
    );
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [userId, cloudLoaded, getEmptyPayload, setPayload, setPreferences]);

  // Reset cloudLoaded when user changes
  useEffect(() => {
    if (!userId || !isFirebaseConfigured()) {
      // If no user or Firebase not configured, mark as loaded immediately
      setCloudLoaded(true);
      setCloudLoadPending(false);
      previousUserIdRef.current = null;
      lastCloudHadDataRef.current = false;
      // Load from local storage if available
      if (userId) {
        const fromLocal = loadFromStorage(userId);
        if (fromLocal.classes.length > 0) {
          setPayload((prev) => ({ ...prev, ...fromLocal }));
        }
      }
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
    // Try to save to localStorage, but don't block if it fails
    try {
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
    } catch (e) {
      // localStorage quota exceeded - continue anyway, data is in Firestore
      console.warn('Could not save to localStorage (quota exceeded), continuing', e);
    }
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

  // Periodic cloud persistence as additional safety net (multi-tab/device reliability).
  useEffect(() => {
    if (!userId || !isFirebaseConfigured() || !cloudLoaded) return;
    const intervalId = setInterval(() => {
      const prefs = loadPreferences();
      const periodicPayload = pendingFirestorePayloadRef.current || {
        ...payload,
        preferences: {
          darkMode,
          fontSize,
          dashboardViewMode: (prefs.dashboardViewMode ?? 'table') as 'table' | 'cards',
          dashboardWidgets,
        } as UserPreferences,
      };
      const allowEmpty = lastCloudHadDataRef.current;
      saveToFirestore(userId, periodicPayload, allowEmpty)
        .then(() => setCloudSyncError(null))
        .catch((err) => {
          const msg = err?.message ?? String(err);
          setCloudSyncError(msg.includes('permission') ? 'שמירה לענן נכשלה (הרשאות).' : `שמירה לענן נכשלה: ${msg}`);
        });
    }, 15000);

    return () => clearInterval(intervalId);
  }, [userId, cloudLoaded, payload, darkMode, fontSize, dashboardWidgets]);

  const markClassAdded = () => {
    lastAddClassAtRef.current = Date.now();
    lastCloudHadDataRef.current = true;
  };

  const flushSave = () => {
    flushFirestoreSaveRef.current();
  };

  const manualSaveToCloud = async (): Promise<boolean> => {
    if (!userId || !isFirebaseConfigured() || !cloudLoaded) return false;
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
    try {
      const allowEmpty = lastCloudHadDataRef.current;
      type FirestorePayload = Parameters<typeof saveToFirestore>[1];
      await saveToFirestore(userId, fullPayload as FirestorePayload, allowEmpty);
      setCloudSyncError(null);
      return true;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setCloudSyncError(msg.includes('permission') ? 'שמירה לענן נכשלה (הרשאות).' : `שמירה לענן נכשלה: ${msg}`);
      return false;
    }
  };

  return {
    cloudLoaded,
    cloudLoadPending,
    cloudSyncError,
    setCloudSyncError,
    markClassAdded,
    flushSave,
    manualSaveToCloud,
  };
}
