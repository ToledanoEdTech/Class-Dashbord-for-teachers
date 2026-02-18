# תיקון התחברות Google + שמירת נתונים – עשה עכשיו

## 1. התחברות עם Google לא עובדת

**סיבה:** הדומיין של האתר לא ברשימת הדומיינים המורשים ב-Firebase.

**פתרון (פעם אחת):**

1. היכנס ל-**https://console.firebase.google.com**
2. בחר את הפרויקט **dashboard**
3. בתפריט השמאלי: **Authentication**
4. למעלה: לחץ על **Settings** (או על גלגל השיניים)
5. גלול ל-**Authorized domains**
6. לחץ **Add domain**
7. הזן **בדיוק** (העתק-הדבק):  
   **`class-dashboard-for-teachers.vercel.app`**
8. **Save**

אם יש לך דומיין נוסף (למשל custom domain) – הוסף גם אותו.

---

## 2. הנתונים לא נשמרים בין מכשירים

**סיבה:** כללי אבטחה ב-Firestore חוסמים קריאה/כתיבה.

**פתרון (פעם אחת):**

1. ב-**Firebase Console** → **Firestore Database** → **Rules**
2. **מחק** את כל התוכן שיש שם
3. **הדבק** את זה בלבד:

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

4. לחץ **Publish**

---

## אחרי שעשית את שני השלבים

- **רענן** את האתר (F5)
- נסה **התחבר עם Google** – אמור לעבוד
- היכנס, הוסף כיתה, **סגור את הדף**. במחשב/טאב אחר היכנס עם אותו חשבון – הנתונים אמורים להופיע

אם אחרי זה עדיין מופיעה שגיאה (בצהוב) על "שמירה לענן" – העתק את טקסט השגיאה וכתוב לי.
