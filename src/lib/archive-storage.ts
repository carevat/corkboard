import type { Investigation } from "./archive-types";

const DB_NAME = "the-black-archive";
const DB_VERSION = 1;
const CASE_STORE = "investigations";
const ASSET_STORE = "assets";
let opening: Promise<IDBDatabase> | null = null;

function openArchive(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser does not support local evidence storage."));
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CASE_STORE)) database.createObjectStore(CASE_STORE, { keyPath: "id" });
      if (!database.objectStoreNames.contains(ASSET_STORE)) database.createObjectStore(ASSET_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error ?? new Error("Could not open local storage.")); };
    request.onblocked = () => { opening = null; reject(new Error("Close other archive tabs and try again.")); };
  });
  return opening;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local storage request failed."));
  });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save to local storage."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local storage transaction was interrupted."));
  });
}

export async function listInvestigations(): Promise<Investigation[]> {
  const database = await openArchive();
  const result = await requestResult(database.transaction(CASE_STORE, "readonly").objectStore(CASE_STORE).getAll() as IDBRequest<Investigation[]>);
  return result.filter((item) => item && typeof item.id === "string" && Array.isArray(item.evidence)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getInvestigation(id: string): Promise<Investigation | undefined> {
  const database = await openArchive();
  return requestResult(database.transaction(CASE_STORE, "readonly").objectStore(CASE_STORE).get(id) as IDBRequest<Investigation | undefined>);
}
export async function saveInvestigation(investigation: Investigation): Promise<void> {
  const database = await openArchive();
  const transaction = database.transaction(CASE_STORE, "readwrite");
  transaction.objectStore(CASE_STORE).put(investigation);
  await transactionDone(transaction);
}
export async function deleteInvestigation(id: string): Promise<void> {
  const database = await openArchive();
  const transaction = database.transaction(CASE_STORE, "readwrite");
  transaction.objectStore(CASE_STORE).delete(id);
  await transactionDone(transaction);
}
export async function putAsset(id: string, blob: Blob): Promise<void> {
  const database = await openArchive();
  const transaction = database.transaction(ASSET_STORE, "readwrite");
  transaction.objectStore(ASSET_STORE).put({ id, blob });
  await transactionDone(transaction);
}
export async function getAsset(id: string): Promise<Blob | undefined> {
  const database = await openArchive();
  const value = await requestResult(database.transaction(ASSET_STORE, "readonly").objectStore(ASSET_STORE).get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>);
  return value?.blob;
}
