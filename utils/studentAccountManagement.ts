import { getFirebaseAuth, getFirebaseDb, getSecondaryFirebaseAuth } from '../firebase';
import { createUserWithEmailAndPassword, deleteUser, signOut } from 'firebase/auth';

/** When creation with secondary Auth fails (e.g. 400), create with primary Auth and store password in user doc. */
const TEMPORARY_PASSWORD_FIELD = 'temporaryPassword';
import { doc, setDoc, deleteDoc, getDoc, collection, getDocs, deleteField } from 'firebase/firestore';
import { Student } from '../types';

export interface StudentAccount {
  uid: string;
  username: string;
  displayName: string;
  studentId: string;
  password: string; // Temporary password (only shown once)
}

const STUDENT_CREDENTIALS_DOC = 'studentCredentials';

interface CredentialVaultItem {
  uid: string;
  username: string;
  password: string;
  displayName: string;
  studentId: string;
  classId: string | null;
  updatedAt: string;
}

function credentialVaultKey(studentId: string, classId?: string): string {
  return classId ? `${classId}::${studentId}` : `default::${studentId}`;
}

async function upsertCredentialVaultItem(
  teacherUid: string,
  studentId: string,
  account: StudentAccount,
  classId?: string
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const item: CredentialVaultItem = {
    uid: account.uid,
    username: account.username,
    password: account.password,
    displayName: account.displayName,
    studentId: account.studentId,
    classId: classId ?? null,
    updatedAt: new Date().toISOString(),
  };
  const key = credentialVaultKey(studentId, classId);
  await setDoc(
    doc(db, 'users', teacherUid, 'data', STUDENT_CREDENTIALS_DOC),
    { items: { [key]: item }, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

async function removeCredentialVaultItem(
  teacherUid: string,
  studentId: string,
  classId?: string
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const key = credentialVaultKey(studentId, classId);
  await setDoc(
    doc(db, 'users', teacherUid, 'data', STUDENT_CREDENTIALS_DOC),
    { items: { [key]: deleteField() }, updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

async function getCredentialVaultMap(teacherUid: string): Promise<Record<string, CredentialVaultItem>> {
  const db = getFirebaseDb();
  if (!db) return {};
  const snap = await getDoc(doc(db, 'users', teacherUid, 'data', STUDENT_CREDENTIALS_DOC));
  if (!snap.exists() || typeof snap.data()?.items !== 'object') return {};
  const raw = snap.data()?.items as Record<string, unknown>;
  const result: Record<string, CredentialVaultItem> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    const item = v as Partial<CredentialVaultItem>;
    if (typeof item.studentId !== 'string') continue;
    result[k] = {
      uid: typeof item.uid === 'string' ? item.uid : '',
      username: typeof item.username === 'string' ? item.username : '',
      password: typeof item.password === 'string' ? item.password : '',
      displayName: typeof item.displayName === 'string' ? item.displayName : '',
      studentId: item.studentId,
      classId: typeof item.classId === 'string' ? item.classId : null,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
    };
  }
  return result;
}

/**
 * Generate a username from student name or ID
 */
export function generateUsername(student: Student): string {
  // Try to create username from name (firstname.lastname)
  if (student.name && student.name.trim()) {
    const parts = student.name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      const firstName = parts[parts.length - 1]; // Last name (Hebrew)
      const lastName = parts[0]; // First name (Hebrew)
      let username = `${firstName}.${lastName}`.toLowerCase()
        .replace(/[^\u0590-\u05FFa-z0-9.]/g, '') // Keep Hebrew and English letters, numbers, dots
        .replace(/[^\u0590-\u05FFa-z0-9]/g, '') // Remove dots if they cause issues
        .substring(0, 30); // Limit length
      
      // If we have Hebrew characters, transliterate or use ID
      if (/[\u0590-\u05FF]/.test(username)) {
        // Hebrew detected - use ID instead for better compatibility
        username = `student${student.id}`.replace(/[^a-z0-9]/g, '');
      }
      
      // Ensure username is not empty
      if (username.length === 0) {
        username = `student${student.id}`.replace(/[^a-z0-9]/g, '');
      }
      
      return username;
    }
    // Single name - use it if it's English
    if (parts.length === 1) {
      let username = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (username.length === 0 || /[\u0590-\u05FF]/.test(parts[0])) {
        // Hebrew or empty - use ID
        username = `student${student.id}`.replace(/[^a-z0-9]/g, '');
      }
      return username;
    }
  }
  // Fallback to student ID
  const username = `student${student.id}`.replace(/[^a-z0-9]/g, '');
  if (username.length === 0) {
    // Last resort - use timestamp
    return `student${Date.now()}`;
  }
  return username;
}

/**
 * Generate a temporary 6-digit password
 */
export function generateTemporaryPassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function sanitizeUsername(raw: string, fallbackStudentId: string): string {
  let username = (raw || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!username) {
    username = `student${fallbackStudentId}`.replace(/[^a-z0-9]/g, '') || `student${Date.now()}`;
  }
  return username.substring(0, 50);
}

/** Always returns a unique username to avoid auth/email-already-in-use (first attempt included). */
function withUsernameSuffix(base: string, attempt: number): string {
  const unique =
    attempt <= 0
      ? `${Date.now().toString(36).slice(-8)}_${Math.random().toString(36).slice(2, 8)}`
      : `${attempt}_${Date.now().toString(36).slice(-8)}_${Math.random().toString(36).slice(2, 8)}`;
  const maxBaseLength = Math.max(1, 45 - unique.length - 1);
  return `${base.substring(0, maxBaseLength)}_${unique}`;
}

/**
 * Create a student account
 */
export async function createStudentAccount(
  student: Student,
  username?: string,
  password?: string,
  options?: { classId?: string }
): Promise<StudentAccount> {
  const auth = getFirebaseAuth();
  const secondaryAuth = getSecondaryFirebaseAuth();
  const db = getFirebaseDb();

  if (!auth) {
    throw new Error('Firebase לא מוגדר. הגדר חיבור ל-Firebase בהגדרות.');
  }
  if (!db) {
    throw new Error('Firestore לא זמין. בדוק את הגדרות Firebase.');
  }
  if (!secondaryAuth) {
    throw new Error('יצירת חשבונות תלמידים דורשת חיבור Firebase תקין. וודא שהגדרת את Firebase (כולל Auth עם אימייל/סיסמה).');
  }
  if (!auth.currentUser) {
    throw new Error('צריך להתחבר כמורה לפני יצירת חשבון תלמיד.');
  }
  const teacherUid = auth.currentUser.uid;

  const baseUsername = sanitizeUsername(username || generateUsername(student), student.id);
  let finalUsername = baseUsername;
  const finalPassword = password || generateTemporaryPassword();

  // Create Firebase Auth account on a secondary auth instance so teacher session stays intact.
  let userCredential: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
  let lastCreateError: any = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    finalUsername = withUsernameSuffix(baseUsername, attempt);
    const email = `${finalUsername}@student.toledanoedtech.local`;
    if (!email.match(/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i)) {
      throw new Error(`שם משתמש לא תקין: ${finalUsername}. נסה שם אחר.`);
    }

    try {
      userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, finalPassword);
      lastCreateError = null;
      break;
    } catch (error: any) {
      lastCreateError = error;
      // Log full error for 400 / identitytoolkit debugging (F12 console)
      const errCode = error?.code ?? '';
      const errMsg = error?.message ?? String(error);
      console.error('[חשבון תלמיד] שגיאת Auth:', {
        code: errCode,
        message: errMsg,
        email: email.substring(0, 30) + '...',
        passwordLength: finalPassword?.length,
        serverResponse: (error as any)?.serverResponse,
      });

      if (error?.code === 'auth/email-already-in-use') {
        continue;
      }
      if (error?.code === 'auth/invalid-email') {
        throw new Error(`אימייל לא תקין: ${email}. שם המשתמש "${finalUsername}" לא תקין.`);
      }
      if (error?.code === 'auth/weak-password') {
        throw new Error('הסיסמה חלשה מדי (לפחות 6 תווים). נסה שוב.');
      }
      if (error?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'ב-Firebase Console: Authentication → Sign-in method → הפעל "Email/Password" (סמן את האפשרות הראשונה).'
        );
      }
      if (error?.code === 'auth/network-request-failed') {
        throw new Error('שגיאת רשת. בדוק חיבור לאינטרנט ונסה שוב.');
      }
      if (error?.code === 'auth/invalid-argument' || errMsg.includes('400') || errMsg.includes('BAD_REQUEST')) {
        throw new Error(
          `שגיאת Firebase Auth (400): ${errMsg}. וודא ש-Email/Password מופעל ב-Console והאימייל לא תפוס.`
        );
      }
      if (error?.code === 'auth/too-many-requests') {
        throw new Error('יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.');
      }
      throw error;
    }
  }

  if (!userCredential) {
    const errMsg = lastCreateError?.message ?? String(lastCreateError);
    const is400OrEmailExists =
      (lastCreateError?.message ?? '').includes('400') ||
      lastCreateError?.code === 'auth/invalid-argument' ||
      lastCreateError?.code === 'auth/email-already-in-use';
    if (is400OrEmailExists && auth && auth.currentUser) {
      try {
        const email = `${finalUsername}@student.toledanoedtech.local`;
        userCredential = await createUserWithEmailAndPassword(auth, email, finalPassword);
        console.warn('[חשבון תלמיד] נוצר עם Auth ראשי (המורה יתנתק – התחבר מחדש). שגיאת 400 עם Auth משני נעקפה.');
      } catch (primaryErr: any) {
        console.error('[חשבון תלמיד] גם יצירה עם Auth ראשי נכשלה:', primaryErr?.code, primaryErr?.message);
      }
    }
    if (!userCredential) {
      if (lastCreateError?.code === 'auth/email-already-in-use') {
        throw new Error('לא ניתן ליצור חשבון עם שם המשתמש המקורי כי הוא כבר קיים במערכת ההתחברות. נסה שוב או בחר שם משתמש אחר.');
      }
      if (lastCreateError?.code === 'auth/operation-not-allowed') {
        throw new Error('התחברות באימייל/סיסמה לא מופעלת ב-Firebase. ב-Console: Authentication > Sign-in method > הפעל Email/Password.');
      }
      throw lastCreateError instanceof Error ? lastCreateError : new Error('נכשל ביצירת חשבון תלמיד: ' + errMsg);
    }
  }
  const uid = userCredential.user.uid;
  const usedPrimaryAuth = userCredential.user.uid && getFirebaseAuth()?.currentUser?.uid === uid;

  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocData: Record<string, unknown> = {
      role: 'student',
      studentId: student.id,
      username: finalUsername,
      displayName: student.name,
      teacherUid,
      createdAt: new Date().toISOString(),
    };
    if (usedPrimaryAuth) {
      userDocData[TEMPORARY_PASSWORD_FIELD] = finalPassword;
    }
    await setDoc(userDocRef, userDocData);
  } catch (error: any) {
    try {
      await deleteUser(userCredential.user);
    } catch (rollbackError) {
      console.error('Failed rolling back student auth user after Firestore failure:', rollbackError);
    }
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error(
        'אין הרשאה ליצור מסמך ב-Firestore. ב-Console: Firestore → Rules – וודא שמורים יכולים ליצור מסמכים ב-users (isCurrentUserTeacher()).'
      );
    }
    throw new Error('שמירת פרטי התלמיד נכשלה: ' + (error?.message ?? String(error)));
  }

  const account: StudentAccount = {
    uid,
    username: finalUsername,
    displayName: student.name,
    studentId: student.id,
    password: finalPassword,
  };

  if (usedPrimaryAuth) {
    await signOut(auth).catch(() => undefined);
    return account;
  }

  try {
    await upsertCredentialVaultItem(teacherUid, student.id, account, options?.classId);
  } catch (error: any) {
    await signOut(secondaryAuth).catch(() => undefined);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('שמירת סיסמה בהגדרות נכשלה (הרשאות). עדכן כללי Firestore ל-users/{uid}/data.');
    }
    throw new Error('שמירת סיסמה בהגדרות נכשלה: ' + (error?.message ?? String(error)));
  }

  await signOut(secondaryAuth).catch(() => undefined);
  return account;
}

/**
 * Delete a student account
 */
export async function deleteStudentAccount(
  uid: string,
  options?: { studentId?: string; classId?: string }
): Promise<void> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  
  if (!auth || !db) {
    throw new Error('Firebase לא מוגדר');
  }

  // Delete Firestore document
  const userDocRef = doc(db, 'users', uid);
  await deleteDoc(userDocRef);
  if (auth.currentUser?.uid && options?.studentId) {
    await removeCredentialVaultItem(auth.currentUser.uid, options.studentId, options.classId);
  }

  // Note: We cannot delete the Firebase Auth user from client-side
  // The user will remain in Auth but won't have access to Firestore
  // For full deletion, you'd need a backend function
}

/**
 * Reset student credentials by creating a fresh login account
 * and switching Firestore mapping to the new uid.
 * Note: old Firebase Auth user cannot be deleted from client SDK.
 */
export async function resetStudentAccountCredentials(
  student: Student,
  existingAccount: StudentAccount,
  options?: { username?: string; password?: string; classId?: string }
): Promise<StudentAccount> {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase לא מוגדר. בדוק את הגדרות Firebase.');
  }

  let nextAccount: StudentAccount;
  try {
    nextAccount = await createStudentAccount(student, options?.username, options?.password, {
      classId: options?.classId,
    });
  } catch (error: any) {
    throw new Error('איפוס סיסמה נכשל: ' + (error?.message ?? String(error)));
  }

  // Remove previous Firestore mapping doc so the class points to one active account.
  try {
    await deleteDoc(doc(db, 'users', existingAccount.uid));
  } catch (error) {
    console.warn('Could not delete previous student mapping document:', error);
  }

  return nextAccount;
}

/**
 * Find user by username
 * Note: This may not work if teacher doesn't have permission to read all user docs
 * In that case, we'll rely on the createUserWithEmailAndPassword error to detect duplicates
 */
export async function findUserByUsername(username: string): Promise<{ uid: string; studentId: string } | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    // Search through all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.username === username && userData.role === 'student') {
        return {
          uid: userDoc.id,
          studentId: userData.studentId,
        };
      }
    }
  } catch (error) {
    // If we can't read all users (permission issue), return null
    // The createUserWithEmailAndPassword will catch duplicates anyway
    console.warn('Could not search for existing username (permission issue), will rely on Auth error', error);
    return null;
  }

  return null;
}

/**
 * Get all student accounts for a class
 */
export async function getStudentAccountsForClass(
  students: Student[],
  classId?: string
): Promise<Map<string, StudentAccount>> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();
  if (!auth || !db) return new Map();

  const accounts = new Map<string, StudentAccount>();
  const studentIds = new Set(students.map((s) => s.id));
  const teacherUid = auth.currentUser?.uid ?? null;

  try {
    // Search through all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    const vaultMap = teacherUid ? await getCredentialVaultMap(teacherUid) : {};
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.role === 'student' && studentIds.has(userData.studentId)) {
        if (teacherUid && userData.teacherUid && userData.teacherUid !== teacherUid) {
          continue;
        }
        // Backfill legacy student users created before teacherUid was tracked.
        if (teacherUid && !userData.teacherUid) {
          await setDoc(
            doc(db, 'users', userDoc.id),
            { teacherUid, updatedAt: new Date().toISOString() },
            { merge: true }
          );
        }
        const classScopedVaultItem = classId
          ? vaultMap[credentialVaultKey(userData.studentId, classId)] ?? null
          : null;
        const fallbackVaultItem = vaultMap[credentialVaultKey(userData.studentId, undefined)] ?? null;
        const latestVaultItem = Object.values(vaultMap)
          .filter((item) => item.studentId === userData.studentId && (!classId || item.classId === classId))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
        const vaultItem = classScopedVaultItem ?? latestVaultItem ?? fallbackVaultItem;
        const storedPassword =
          vaultItem?.password ||
          (typeof userData[TEMPORARY_PASSWORD_FIELD] === 'string' ? userData[TEMPORARY_PASSWORD_FIELD] : '');
        accounts.set(userData.studentId, {
          uid: userDoc.id,
          username: userData.username || vaultItem?.username || '',
          displayName: userData.displayName || vaultItem?.displayName || '',
          studentId: userData.studentId,
          password: storedPassword as string,
        });
      }
    }
  } catch (error: any) {
    console.error('Error loading student accounts:', error);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('אין הרשאה לקרוא חשבונות תלמידים מהענן. עדכן את כללי Firestore ב-Console.');
    }
    // Return empty map if error (don't throw, just show no accounts)
    return new Map();
  }

  return accounts;
}

/**
 * Export student accounts to Excel format (returns data for Excel export)
 */
export function exportStudentAccountsToExcel(accounts: StudentAccount[]): Array<{
  'שם תלמיד': string;
  'ת.ז': string;
  'שם משתמש': string;
  'סיסמה זמנית': string;
}> {
  return accounts.map((acc) => ({
    'שם תלמיד': acc.displayName,
    'ת.ז': acc.studentId,
    'שם משתמש': acc.username,
    'סיסמה זמנית': acc.password || '(לא זמין)',
  }));
}
