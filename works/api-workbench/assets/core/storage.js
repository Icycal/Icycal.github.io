const DATABASE_NAME = "api-workbench";
const STORE_NAME = "projects";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return resolve(null);
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project) {
  const database = await openDatabase();
  if (!database) {
    localStorage.setItem(`${DATABASE_NAME}:${project.id}`, JSON.stringify(project));
    localStorage.setItem(`${DATABASE_NAME}:last`, project.id);
    return;
  }
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(project);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  localStorage.setItem(`${DATABASE_NAME}:last`, project.id);
}

export async function loadLastProject() {
  const id = localStorage.getItem(`${DATABASE_NAME}:last`);
  if (!id) return null;
  const database = await openDatabase();
  if (!database) {
    const value = localStorage.getItem(`${DATABASE_NAME}:${id}`);
    return value ? JSON.parse(value) : null;
  }
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
