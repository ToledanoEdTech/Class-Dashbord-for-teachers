import { getFirebaseDb } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Student } from '../types';
import { fromPersistedStudent, type PersistedStudent } from './storage';
import LZString from 'lz-string';

function decompress(compressed: string): unknown {
  const json = LZString.decompressFromUTF16(compressed);
  if (!json) throw new Error('Failed to decompress');
  return JSON.parse(json);
}

/** Load a specific student data from a specific teacher scope. */
export async function loadStudentDataForStudent(studentId: string, teacherUid: string): Promise<Student | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const classesRef = collection(db, 'users', teacherUid, 'classes');
    const classesSnapshot = await getDocs(classesRef);

    for (const classDoc of classesSnapshot.docs) {
      const classData = classDoc.data();

      // Single-doc class format
      if (typeof classData?.d === 'string') {
        try {
          const parsed = decompress(classData.d) as { students: PersistedStudent[] };
          const student = parsed.students?.find((s) => s.id === studentId);
          if (student) {
            return fromPersistedStudent(student);
          }
        } catch (e) {
          console.warn('Failed to parse class', classDoc.id, e);
        }
      }

      // Chunked class format
      if (classData?.meta && typeof classData?.chunkCount === 'number') {
        const chunksRef = collection(db, 'users', teacherUid, 'classes', classDoc.id, 'chunks');
        const chunksSnapshot = await getDocs(chunksRef);
        const sorted = chunksSnapshot.docs.sort((a, b) => Number(a.id) - Number(b.id));

        for (const chunkDoc of sorted) {
          const chunkData = chunkDoc.data();
          if (typeof chunkData?.d === 'string') {
            try {
              const chunk = decompress(chunkData.d) as { students: PersistedStudent[] };
              const student = chunk.students?.find((s) => s.id === studentId);
              if (student) {
                return fromPersistedStudent(student);
              }
            } catch (e) {
              console.warn('Failed to parse chunk', chunkDoc.id, e);
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error loading student data:', error);
    return null;
  }
}
