# Firebase – מה לעשות (פעם אחת)

## 1. הדבק את ה-Config בפרויקט

1. ב-**Firebase Console** (https://console.firebase.google.com) בחר את הפרויקט **dashboard**.
2. **Project Settings** (גלגל) → **Your apps** → בחר את אפליקציית ה-Web שיצרת.
3. תחת **SDK setup and configuration** תראה אובייקט `firebaseConfig` – **העתק את כל האובייקט** (מ־`apiKey` עד `appId`).
4. בפרויקט פתח את הקובץ **`firebase-config.paste.ts`**.
5. **החלף** את `null` באובייקט שהעתקת.  
   כלומר: מחק את `null` והדבק במקום את האובייקט, כך שיהיה למשל:
   ```ts
   } | null = {
     apiKey: "AIza...",
     authDomain: "dashboard-xxxxx.firebaseapp.com",
     projectId: "dashboard-xxxxx",
     storageBucket: "dashboard-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:..."
   };
   ```
   (וודא שיש `};` בסוף השורה.)

שמור את הקובץ. מכאן האתר משתמש ב-Firebase אוטומטית.

---

## 2. הפעלת התחברות עם Google (אופציונלי)

כדי שהכפתור **"התחבר עם Google"** יופיע ויעבוד:

1. ב-**Firebase Console** → **Authentication** → **Sign-in method**.
2. לחץ על **Google**.
3. הפעל **Enable** ובחר את כתובת האימייל לתמיכה.
4. **Save**.

---

## 2.1 דומיין מורשה (כשהאתר על Vercel / דומיין חיצוני)

אם האתר רץ בכתובת כמו `xxx.vercel.app` או דומיין משלך – **חובה** להוסיף את הדומיין ב-Firebase, אחרת "התחבר עם Google" ייכשל:

1. **Firebase Console** → **Authentication** → לשונית **Settings** (או התפריט ⋮) → **Authorized domains**.
2. **Add domain**.
3. הזן את הדומיין בדיוק, למשל: `class-dashboard-for-teachers.vercel.app`.
4. **Add**.

בלי שלב זה ההתחברות עם Google תציג "לא הצלחנו להתחבר עם Google".

---

## 3. כללי אבטחה ב-Firestore (חשוב)

ב-**Firebase Console** → **Firestore Database** → **Rules** – החלף את כל התוכן ב-**הטקסט הזה** (העתק והדבק):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/data/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

לחץ **Publish**. בלי כללים אלה הנתונים לא יישמרו/יטענו בין מכשירים.

---

## סיכום

- **הדבקה 1**: אובייקט ה-config ב-`firebase-config.paste.ts`.
- **הדבקה 2**: כללי Firestore ב-Console.
- **אופציונלי**: הפעלת Google ב-Authentication → Sign-in method.

אחרי זה – הרץ `npm run dev`. תוכל להיכנס עם אימייל וסיסמה או עם Google; הנתונים יישמרו ויטענו מהענן אוטומטית.
