import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc, setDoc, onSnapshot, enableIndexedDbPersistence, setLogLevel } from "firebase/firestore";
import { ERPState } from "./types";

const firebaseConfig = {
  apiKey: "AIzaSyBn7f6PE_obKikeLWU-LhKj9mbKECYS1Yg",
  authDomain: "tuned-justice-9jlsj.firebaseapp.com",
  projectId: "tuned-justice-9jlsj",
  storageBucket: "tuned-justice-9jlsj.firebasestorage.app",
  messagingSenderId: "767235040214",
  appId: "1:767235040214:web:97f58913c652b040c43a77"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
}, "ai-studio-divinetraderserp-042fd883-246f-4907-bf2a-c852c909933f");

// Set log level to suppress non-critical warnings
setLogLevel("error");

// Enable offline persistence for seamless offline execution
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Firestore offline persistence: Multiple tabs open, persistence enabled in first tab only.");
    } else if (err.code === "unimplemented") {
      console.warn("Firestore offline persistence: Browser does not support persistent storage.");
    } else {
      console.warn("Firestore offline persistence failed to enable:", err);
    }
  });
}

const DEFAULT_DOC_ID = "divine_traders_state";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: "divine-user",
      email: "vishal291137@gmail.com",
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function loadStateFromFirestore(docId?: string | null): Promise<ERPState | null> {
  const id = docId || DEFAULT_DOC_ID;
  const path = `erp/${id}`;
  try {
    const docRef = doc(db, "erp", id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }

    const state = docSnap.data() as ERPState;

    // Attempt to load auxiliary logs and backups documents if present
    try {
      const logsRef = doc(db, "erp", `${id}_logs`);
      const logsSnap = await getDoc(logsRef);
      if (logsSnap.exists()) {
        const logsData = logsSnap.data();
        if (logsData.activityLogs) state.activityLogs = logsData.activityLogs;
        if (logsData.loginHistory) state.loginHistory = logsData.loginHistory;
      }
    } catch (e) {
      console.warn("Could not load auxiliary logs document, using core state fallback:", e);
    }

    try {
      const backupsRef = doc(db, "erp", `${id}_backups`);
      const backupsSnap = await getDoc(backupsRef);
      if (backupsSnap.exists()) {
        const backupsData = backupsSnap.data();
        if (backupsData.backups) state.backups = backupsData.backups;
      }
    } catch (e) {
      console.warn("Could not load auxiliary backups document, using core state fallback:", e);
    }

    return state;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
  return null;
}

export async function saveStateToFirestore(state: ERPState, docId?: string | null): Promise<void> {
  const id = docId || DEFAULT_DOC_ID;
  const path = `erp/${id}`;
  try {
    const { activityLogs, loginHistory, backups, ...coreState } = state;

    // 1. Save core operational state (keeping latest 50 logs/history in core for offline fallback)
    const trimmedLogs = (activityLogs || []).slice(0, 50);
    const trimmedHistory = (loginHistory || []).slice(0, 25);
    const stateToSave: ERPState = {
      ...coreState,
      activityLogs: trimmedLogs,
      loginHistory: trimmedHistory,
      backups: backups || []
    };

    const docRef = doc(db, "erp", id);
    await setDoc(docRef, stateToSave);

    // 2. Save full activity logs & login history into auxiliary document erp/${id}_logs
    if (activityLogs || loginHistory) {
      try {
        const logsRef = doc(db, "erp", `${id}_logs`);
        await setDoc(logsRef, {
          activityLogs: activityLogs || [],
          loginHistory: loginHistory || [],
          updatedAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn("Failed to write auxiliary logs document:", logErr);
      }
    }

    // 3. Save backups into auxiliary document erp/${id}_backups
    if (backups) {
      try {
        const backupsRef = doc(db, "erp", `${id}_backups`);
        await setDoc(backupsRef, {
          backups: backups || [],
          updatedAt: new Date().toISOString()
        });
      } catch (backupErr) {
        console.warn("Failed to write auxiliary backups document:", backupErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToStateChanges(
  callback: (state: ERPState | null) => void,
  docId?: string | null
): () => void {
  const id = docId || DEFAULT_DOC_ID;
  const path = `erp/${id}`;
  const docRef = doc(db, "erp", id);

  return onSnapshot(
    docRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const state = snapshot.data() as ERPState;

      // Silently augment state with auxiliary logs and backups if available
      try {
        const logsRef = doc(db, "erp", `${id}_logs`);
        const logsSnap = await getDoc(logsRef);
        if (logsSnap.exists()) {
          const logsData = logsSnap.data();
          if (logsData.activityLogs) state.activityLogs = logsData.activityLogs;
          if (logsData.loginHistory) state.loginHistory = logsData.loginHistory;
        }

        const backupsRef = doc(db, "erp", `${id}_backups`);
        const backupsSnap = await getDoc(backupsRef);
        if (backupsSnap.exists()) {
          const backupsData = backupsSnap.data();
          if (backupsData.backups) state.backups = backupsData.backups;
        }
      } catch (err) {
        // Fallback to core state snapshot seamlessly
      }

      callback(state);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        console.error("Firestore Subscription Error caught:", err);
      }
    }
  );
}

