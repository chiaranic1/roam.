const seedPlaces = [
  {
    id: "blue-hill",
    name: "Blue Hill at Stone Barns",
    shortName: "Blue Hill",
    city: "Tarrytown",
    subtitle: "Tarrytown, New York",
    country: "Stati Uniti",
    countryCode: "US",
    category: "cibo",
    coordinates: [41.1067, -73.8315],
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=720&q=85",
    images: [],
    imagePosition: "center",
  },
  {
    id: "hotel-k5",
    name: "Hotel K5",
    shortName: "Hotel K5",
    city: "Tokyo",
    subtitle: "Nihonbashi, Tokyo",
    country: "Giappone",
    countryCode: "JP",
    category: "hotel",
    coordinates: [35.6853, 139.7748],
    image:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=720&q=85",
    images: [],
    imagePosition: "center",
  },
  {
    id: "le-mary-celeste",
    name: "Le Mary Celeste",
    shortName: "Le Mary Celeste",
    city: "Parigi",
    subtitle: "Le Marais, Parigi",
    country: "Francia",
    countryCode: "FR",
    category: "cibo",
    coordinates: [48.8613, 2.3594],
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=720&q=85",
    images: [],
    imagePosition: "center 58%",
  },
  {
    id: "louisiana",
    name: "Louisiana Museum",
    shortName: "Louisiana Museum",
    city: "Humlebæk",
    subtitle: "Humlebæk, Copenhagen",
    country: "Danimarca",
    countryCode: "DK",
    category: "esperienze",
    coordinates: [55.9667, 12.5413],
    image:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=720&q=85",
    images: [],
    imagePosition: "center",
  },
  {
    id: "ace-kyoto",
    name: "Ace Hotel Kyoto",
    shortName: "Ace Hotel Kyoto",
    city: "Kyoto",
    subtitle: "Nakagyo, Kyoto",
    country: "Giappone",
    countryCode: "JP",
    category: "hotel",
    coordinates: [35.0102, 135.7595],
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=720&q=85",
    images: [],
    imagePosition: "center",
  },
  {
    id: "casa-bosques",
    name: "Casa Bosques",
    shortName: "Casa Bosques",
    city: "Città del Messico",
    subtitle: "Roma Norte, Città del Messico",
    country: "Messico",
    countryCode: "MX",
    category: "esperienze",
    coordinates: [19.4168, -99.1617],
    image:
      "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=720&q=85",
    images: [],
    imagePosition: "center",
  },
];

const STORAGE_KEY = "roam.places.v1";
const DATABASE_NAME = "roam.archive";
const DATABASE_VERSION = 2;
const PLACES_STORE = "places";
const META_STORE = "meta";
const PERSONAL_PHOTOS_STORE = "personal-photos";
const MIGRATION_KEY = "localstorage-migrated";
const PERSONAL_PHOTOS_MIGRATION_KEY = "personal-photos-migrated";
const placesList = document.querySelector("#places-list");
const countryList = document.querySelector("#country-list");
const searchInput = document.querySelector("#place-search");
const visibleCount = document.querySelector("#visible-count");
const emptyState = document.querySelector("#empty-state");
const previewCard = document.querySelector("#place-detail");
const toast = document.querySelector("#toast");
const globeContainer = document.querySelector("#world-map");
const addDialog = document.querySelector("#add-dialog");
const placeDialog = document.querySelector("#place-dialog");
const addForm = document.querySelector("#add-place-form");
const geoResults = document.querySelector("#geocode-results");
const geoStatus = document.querySelector("#geocode-status");
const detailGallery = document.querySelector("#detail-gallery");
const detailEditForm = document.querySelector("#place-edit-form");
const personalPhotoInput = document.querySelector("#personal-photo-input");
const personalPhotoDropzone = document.querySelector("#personal-photo-dropzone");
const personalPhotoStaging = document.querySelector("#personal-photo-staging");
const savePersonalPhotosButton = document.querySelector("#save-personal-photos");
const photoLightbox = document.querySelector("#photo-lightbox");
const photoLightboxImage = document.querySelector("#photo-lightbox-image");
const archiveInput = document.querySelector("#archive-input");
const categoryLabels = {
  cibo: "CIBO",
  hotel: "HOTEL",
  esperienze: "ESPERIENZE",
};

let activeFilter = "all";
let places = [];
let activePlaceId = null;
let toastTimeout;
let previewTimeout;
let markerRenderTimeout;
let lastMarkerAltitude = null;
let lastMarkerRenderKey = "";
let lastGeocodeRequest = 0;
let currentDetailId = null;
let personalPhotoRecords = new Map();
let personalPhotoUrls = new Map();
let pendingPersonalPhotos = [];

function showToast(message) {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(
    () => toast.classList.remove("is-visible"),
    3600,
  );
}

function loadLegacyPlaces() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new TypeError("Archivio ROAM non valido.");
    return parsed;
  } catch (error) {
    console.error("Impossibile leggere l'archivio locale ROAM.", error);
    return null;
  }
}

function openArchiveDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB non è disponibile in questo browser."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PLACES_STORE)) {
        database.createObjectStore(PLACES_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(PERSONAL_PHOTOS_STORE)) {
        const photosStore = database.createObjectStore(PERSONAL_PHOTOS_STORE, {
          keyPath: "id",
        });
        photosStore.createIndex("placeId", "placeId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Apertura dell'archivio ROAM bloccata."));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Operazione IndexedDB interrotta."));
  });
}

function newPhotoId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `photo-${uuid || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match) throw new TypeError("Formato della fotografia personale non valido.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: match[1].toLowerCase() });
}

function legacyPersonalImage(image) {
  return (
    image?.url?.startsWith("data:image/") &&
    (image.credit === "Foto personale" || image.license === "Foto personale")
  );
}

function migrateLegacyPersonalPhotos(placesToMigrate) {
  const photosToSave = [];

  placesToMigrate.forEach((place) => {
    const migratedByUrl = new Map();
    const migrateImage = (image) => {
      if (!legacyPersonalImage(image)) return image;
      if (!migratedByUrl.has(image.url)) {
        const blob = dataUrlToBlob(image.url);
        const id = newPhotoId();
        const extension = blob.type.split("/")[1].replace("jpeg", "jpg");
        photosToSave.push({
          id,
          placeId: place.id,
          fileName: image.name || `fotografia-personale.${extension}`,
          mimeType: blob.type,
          originalBlob: blob,
          previewBlob: null,
          addedAt: new Date().toISOString(),
        });
        migratedByUrl.set(image.url, id);
      }
      const { url, ...metadata } = image;
      return {
        ...metadata,
        id: migratedByUrl.get(image.url),
        kind: "personal",
        mimeType:
          image.mimeType ||
          image.url.match(/^data:(image\/[^;,]+)/i)?.[1]?.toLowerCase(),
      };
    };

    place.images = (place.images || []).map(migrateImage);
    if (place.image?.startsWith("data:image/")) {
      const cover = migrateImage({
        url: place.image,
        credit: "Foto personale",
        license: "Foto personale",
      });
      place.image = `personal:${cover.id}`;
    }
  });

  return { photosToSave };
}

function getPersonalPhotoUrl(photoId, original = false) {
  const record = personalPhotoRecords.get(photoId);
  const blob = original ? record?.originalBlob : record?.previewBlob || record?.originalBlob;
  if (!blob) return "";
  const key = `${photoId}:${original ? "original" : "preview"}`;
  if (!personalPhotoUrls.has(key)) {
    personalPhotoUrls.set(key, URL.createObjectURL(blob));
  }
  return personalPhotoUrls.get(key);
}

function revokePersonalPhotoUrls(photoId) {
  for (const variant of ["original", "preview"]) {
    const key = `${photoId}:${variant}`;
    const url = personalPhotoUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    personalPhotoUrls.delete(key);
  }
}

async function loadPlaces() {
  const database = await openArchiveDatabase();
  try {
    const transaction = database.transaction(
      [PLACES_STORE, META_STORE, PERSONAL_PHOTOS_STORE],
      "readonly",
    );
    const completed = transactionComplete(transaction);
    const placesStore = transaction.objectStore(PLACES_STORE);
    const metaStore = transaction.objectStore(META_STORE);
    const photosStore = transaction.objectStore(PERSONAL_PHOTOS_STORE);
    const [storedPlaces, migration, photoMigration, storedPhotos] = await Promise.all([
      new Promise((resolve, reject) => {
        const request = placesStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = metaStore.get(MIGRATION_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = metaStore.get(PERSONAL_PHOTOS_MIGRATION_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = photosStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    ]);
    await completed;

    let placesToLoad = storedPlaces;
    if (!migration) {
      const legacyPlaces = loadLegacyPlaces();
      const storedIds = new Set(storedPlaces.map((place) => place.id));
      placesToLoad =
        storedPlaces.length || legacyPlaces?.length
          ? [
              ...storedPlaces,
              ...(legacyPlaces || []).filter((place) => !storedIds.has(place.id)),
            ]
          : structuredClone(seedPlaces);
    }

    const personalMigration = photoMigration
      ? { photosToSave: [] }
      : migrateLegacyPersonalPhotos(placesToLoad);
    if (!migration || !photoMigration) {
      const migrationTransaction = database.transaction(
        [PLACES_STORE, META_STORE, PERSONAL_PHOTOS_STORE],
        "readwrite",
      );
      const migrationComplete = transactionComplete(migrationTransaction);
      const migrationStore = migrationTransaction.objectStore(PLACES_STORE);
      const migrationMetaStore = migrationTransaction.objectStore(META_STORE);
      const migrationPhotosStore =
        migrationTransaction.objectStore(PERSONAL_PHOTOS_STORE);
      placesToLoad.forEach((place) => migrationStore.put(place));
      personalMigration.photosToSave.forEach((photo) =>
        migrationPhotosStore.put(photo),
      );
      if (!migration) {
        migrationMetaStore.put({
          key: MIGRATION_KEY,
          completedAt: new Date().toISOString(),
        });
      }
      if (!photoMigration) {
        migrationMetaStore.put({
          key: PERSONAL_PHOTOS_MIGRATION_KEY,
          completedAt: new Date().toISOString(),
        });
      }
      await migrationComplete;
    }

    personalPhotoRecords = new Map(
      [...storedPhotos, ...personalMigration.photosToSave].map((photo) => [
        photo.id,
        photo,
      ]),
    );
    return placesToLoad;
  } finally {
    database.close();
  }
}

async function savePlaces({ photosToPut = [], photosToDelete = [] } = {}) {
  let database;
  try {
    database = await openArchiveDatabase();
    const transaction = database.transaction(
      [PLACES_STORE, PERSONAL_PHOTOS_STORE],
      "readwrite",
    );
    const store = transaction.objectStore(PLACES_STORE);
    const photosStore = transaction.objectStore(PERSONAL_PHOTOS_STORE);
    const completed = transactionComplete(transaction);
    const placeWrite = new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const currentIds = new Set(places.map((place) => place.id));
        request.result.forEach((place) => {
          if (!currentIds.has(place.id)) store.delete(place.id);
        });
        places.forEach((place) => store.put(place));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    const photoWrite = new Promise((resolve, reject) => {
      const request = photosStore.getAll();
      request.onsuccess = () => {
        const currentIds = new Set(places.map((place) => place.id));
        const deletedPhotoIds = new Set(photosToDelete);
        request.result.forEach((photo) => {
          if (!currentIds.has(photo.placeId) || deletedPhotoIds.has(photo.id)) {
            photosStore.delete(photo.id);
          }
        });
        photosToPut.forEach((photo) => photosStore.put(photo));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    await Promise.all([placeWrite, photoWrite, completed]);
    photosToPut.forEach((photo) => personalPhotoRecords.set(photo.id, photo));
    photosToDelete.forEach((photoId) => {
      personalPhotoRecords.delete(photoId);
      revokePersonalPhotoUrls(photoId);
    });
    return true;
  } catch (error) {
    console.error("Impossibile salvare l'archivio locale ROAM in IndexedDB.", error);
    showToast("Salvataggio non riuscito. Verifica lo spazio disponibile nel browser.");
    return false;
  } finally {
    database?.close();
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function imageUrl(place) {
  const source = place.image || imageReference(place.images?.[0]) || "";
  return resolveImageReference(source);
}

function imageReference(image) {
  if (image?.kind === "personal" && image.id) return `personal:${image.id}`;
  return image?.url || "";
}

function resolveImageReference(reference, original = false) {
  if (typeof reference !== "string") return "";
  if (reference.startsWith("personal:")) {
    return getPersonalPhotoUrl(reference.slice("personal:".length), original);
  }
  return /^https:\/\/|^http:\/\/|^data:image\/(?:jpeg|png|webp);/i.test(reference)
    ? reference
    : "";
}

function galleryImages(place) {
  const images = [...(place.images || [])];
  const cover = place.image || "";
  if (cover && !images.some((image) => imageReference(image) === cover)) {
    if (cover.startsWith("personal:")) {
      const id = cover.slice("personal:".length);
      const record = personalPhotoRecords.get(id);
      images.unshift({
        kind: "personal",
        id,
        name: record?.fileName || "Foto personale",
        credit: "Foto personale",
      });
    } else {
      images.unshift({ url: cover, credit: "" });
    }
  }
  return images;
}

function setImage(element, place) {
  const source = imageUrl(place);
  if (source) {
    element.style.backgroundImage = `url("${source.replaceAll('"', "%22")}")`;
  } else {
    element.classList.add("has-no-image");
  }
}

function getVisiblePlaces() {
  const search = searchInput.value.trim().toLocaleLowerCase("it");
  return places.filter((place) => {
    const matchesCategory =
      activeFilter === "all" || place.category === activeFilter;
    const matchesSearch =
      !search ||
      `${place.name} ${place.subtitle} ${place.city} ${place.country}`
        .toLocaleLowerCase("it")
        .includes(search);
    return matchesCategory && matchesSearch;
  });
}

function renderPlaces() {
  const visiblePlaces = getVisiblePlaces();
  placesList.replaceChildren();
  visibleCount.textContent = String(visiblePlaces.length).padStart(2, "0");
  emptyState.hidden = visiblePlaces.length > 0;

  visiblePlaces.forEach((place, index) => {
    const button = makeElement("button", "place-row");
    button.type = "button";
    button.classList.toggle("is-selected", place.id === activePlaceId);
    button.setAttribute("aria-label", `${place.name}, ${place.subtitle}`);
    const thumb = makeElement("span", "place-thumb");
    thumb.setAttribute("aria-hidden", "true");
    setImage(thumb, place);
    if (place.imagePosition) thumb.style.backgroundPosition = place.imagePosition;
    const info = makeElement("span", "place-info");
    info.append(
      makeElement("span", "place-name", place.shortName || place.name),
      makeElement(
        "span",
        "place-subtitle",
        place.subtitle || [place.city, place.country].filter(Boolean).join(", "),
      ),
    );
    button.append(
      thumb,
      info,
      makeElement(
        "span",
        "place-category",
        categoryLabels[place.category] || "LUOGO",
      ),
      makeElement("span", "place-number", String(index + 1).padStart(2, "0")),
    );
    button.addEventListener("pointerenter", () => showPreview(place));
    button.addEventListener("pointerleave", schedulePreviewClose);
    button.addEventListener("focus", () => showPreview(place));
    button.addEventListener("blur", schedulePreviewClose);
    button.addEventListener("click", () => selectPlace(place.id, true, true));
    placesList.append(button);
  });

  renderFolders();
  renderGlobeMarkers();
}

function countryInitials(place) {
  if (place.countryCode) return place.countryCode.slice(0, 2).toUpperCase();
  return (place.country || "XX")
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function renderFolders() {
  const countries = new Map();
  places.forEach((place) => {
    const country = place.country || "Paese non specificato";
    const city = place.city || "Città non specificata";
    if (!countries.has(country)) countries.set(country, new Map());
    const cities = countries.get(country);
    if (!cities.has(city)) cities.set(city, []);
    cities.get(city).push(place);
  });
  countryList.replaceChildren();
  document.querySelector("#country-count").textContent = String(
    countries.size,
  ).padStart(2, "0");
  document.querySelector("#country-total-summary").textContent = String(
    countries.size,
  ).padStart(2, "0");

  for (const [country, cities] of countries) {
    const total = [...cities.values()].reduce(
      (count, cityPlaces) => count + cityPlaces.length,
      0,
    );
    const countryFolder = makeElement("details", "folder-country");
    const countrySummary = makeElement("summary", "country-row");
    countrySummary.append(
      makeElement(
        "span",
        "country-code",
        countryInitials([...cities.values()][0][0]),
      ),
      makeElement("span", "folder-name", country),
      makeElement("span", "country-total", String(total).padStart(2, "0")),
    );
    countryFolder.append(countrySummary);

    for (const [city, cityPlaces] of cities) {
      const cityFolder = makeElement("details", "folder-city");
      const citySummary = makeElement("summary", "city-row");
      citySummary.append(
        makeElement("span", "folder-chevron", "↳"),
        makeElement("span", "folder-name", city),
        makeElement(
          "span",
          "country-total",
          String(cityPlaces.length).padStart(2, "0"),
        ),
      );
      const nestedPlaces = makeElement("div", "folder-places");
      cityPlaces.forEach((place) => {
        const button = makeElement(
          "button",
          "folder-place",
          place.shortName || place.name,
        );
        button.type = "button";
        button.addEventListener("click", () =>
          selectPlace(place.id, true, false),
        );
        nestedPlaces.append(button);
      });
      cityFolder.append(citySummary, nestedPlaces);
      countryFolder.append(cityFolder);
    }
    countryList.append(countryFolder);
  }
}

function groupMarkers(visiblePlaces, altitude) {
  if (altitude <= 1.35) {
    return visiblePlaces.map((place) => ({ ...place, members: [place] }));
  }

  const field = altitude > 1.8 ? "country" : "city";
  const groups = new Map();
  visiblePlaces.forEach((place) => {
    const name = place[field] || place.country || place.city || place.id;
    const key =
      field === "city"
        ? JSON.stringify([place.country || "", name])
        : name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(place);
  });

  return [...groups.entries()].map(([key, members]) => {
    if (members.length === 1) return { ...members[0], members };
    const centroid = members.reduce(
      (sum, place) => {
        const [latitude, longitude] = place.coordinates.map(
          (coordinate) => (coordinate * Math.PI) / 180,
        );
        return [
          sum[0] + Math.cos(latitude) * Math.cos(longitude),
          sum[1] + Math.cos(latitude) * Math.sin(longitude),
          sum[2] + Math.sin(latitude),
        ];
      },
      [0, 0, 0],
    );
    const [x, y, z] = centroid;
    const coordinates =
      Math.hypot(x, y, z) < 1e-12
        ? members[0].coordinates
        : [
            (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
            (Math.atan2(y, x) * 180) / Math.PI,
          ];
    return {
      id: `cluster-${field}-${key}`,
      name: members[0][field] || members[0].country || members[0].city,
      city: members[0].city,
      country: members[0].country,
      coordinates,
      count: members.length,
      cluster: true,
      members,
    };
  });
}

function renderGlobeMarkers() {
  if (!globe) return;
  const altitude = globe.pointOfView().altitude;
  const markers = groupMarkers(getVisiblePlaces(), altitude);
  lastMarkerAltitude = altitude;
  const markerRenderKey = JSON.stringify([
    altitude.toFixed(2),
    activePlaceId,
    markers.map((marker) => [
      marker.id,
      marker.name,
      marker.shortName,
      marker.city,
      marker.country,
      marker.count || 0,
      marker.coordinates.map((coordinate) => coordinate.toFixed(4)),
    ]),
  ]);
  if (markerRenderKey === lastMarkerRenderKey) return;
  lastMarkerRenderKey = markerRenderKey;
  globe
    .htmlElementsData(markers)
    .htmlElement((marker) => {
      const pin = makeElement(
        "button",
        `globe-pin${marker.cluster ? " is-cluster" : ""}${marker.id === activePlaceId ? " is-active" : ""}${altitude < 0.78 && !marker.cluster ? " is-labeled" : ""}`,
      );
      pin.type = "button";
      pin.style.setProperty(
        "--pin-scale",
        String(Math.max(0.9, Math.min(1.55, 1.2 / altitude))),
      );
      pin.setAttribute(
        "aria-label",
        marker.cluster
          ? `${marker.count} luoghi in ${marker.name}`
          : `${marker.name}, ${marker.city || ""}, ${marker.country || ""}`,
      );
      const visual = makeElement("span", "pin-visual");
      if (marker.cluster) {
        visual.append(makeElement("span", "cluster-count", String(marker.count)));
      } else {
        visual.append(makeElement("span", "pin-dot"));
        pin.append(
          makeElement("span", "marker-label", marker.shortName || marker.name),
        );
      }
      pin.append(visual);

      pin.addEventListener("pointerenter", (event) => {
        if (!marker.cluster && event.pointerType !== "touch") {
          showPreview(marker, event.currentTarget);
        }
      });
      pin.addEventListener("pointerleave", () => {
        if (!window.matchMedia("(hover: none)").matches) {
          schedulePreviewClose();
        }
      });
      pin.addEventListener("click", (event) => {
        event.stopPropagation();
        if (marker.cluster) {
          const current = globe.pointOfView();
          globe.pointOfView(
            {
              lat: marker.coordinates[0],
              lng: marker.coordinates[1],
              altitude: Math.max(0.8, current.altitude * 0.58),
            },
            850,
          );
          return;
        }

        const touch = window.matchMedia("(hover: none)").matches;
        const previewIsOpen =
          activePlaceId === marker.id && previewCard.classList.contains("is-visible");
        selectPlace(marker.id, true, !touch || previewIsOpen);
      });
      return pin;
    });
}

function scheduleMarkerRender() {
  window.clearTimeout(markerRenderTimeout);
  markerRenderTimeout = window.setTimeout(() => {
    markerRenderTimeout = null;
    renderGlobeMarkers();
  }, 140);
}

function renderPreview(place) {
  previewCard.replaceChildren();
  const image = makeElement("div", "detail-image");
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", `Fotografia di ${place.name}`);
  setImage(image, place);
  const content = makeElement("div", "detail-text");
  content.append(
    makeElement("span", "detail-category", categoryLabels[place.category] || "LUOGO"),
    makeElement("span", "detail-name", place.name),
    makeElement(
      "span",
      "detail-location",
      [place.city, place.country].filter(Boolean).join(" · "),
    ),
  );
  const extra = [];
  if (place.rating) extra.push(`★ ${place.rating}`);
  if (place.reviewCount) extra.push(`${place.reviewCount} recensioni`);
  if (place.priceRange) extra.push(place.priceRange);
  if (extra.length) content.append(makeElement("span", "detail-extra", extra.join(" · ")));
  previewCard.append(image, content);
  previewCard.setAttribute("aria-label", `Apri dettagli di ${place.name}`);
  previewCard.setAttribute("role", "button");
  previewCard.tabIndex = 0;
}

function showPreview(place, sourceElement) {
  window.clearTimeout(previewTimeout);
  activePlaceId = place.id;
  renderPreview(place);
  previewCard.classList.add("is-visible");
  sourceElement?.classList.add("is-active");
  placesList.querySelectorAll(".place-row").forEach((row) => {
    row.classList.toggle("is-selected", row.getAttribute("aria-label") === `${place.name}, ${place.subtitle}`);
  });
}

function schedulePreviewClose() {
  window.clearTimeout(previewTimeout);
  previewTimeout = window.setTimeout(
    () => previewCard.classList.remove("is-visible"),
    280,
  );
}

previewCard.addEventListener("pointerenter", () => window.clearTimeout(previewTimeout));
previewCard.addEventListener("pointerleave", schedulePreviewClose);
previewCard.addEventListener("click", () => {
  if (activePlaceId) openPlaceDialog(activePlaceId);
});
previewCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (activePlaceId) openPlaceDialog(activePlaceId);
  }
});

function selectPlace(placeId, moveMap = false, openDetails = false) {
  const place = places.find((item) => item.id === placeId);
  if (!place) return;
  activePlaceId = placeId;
  renderPreview(place);
  previewCard.classList.add("is-visible");
  renderPlaces();
  if (moveMap) {
    if (
      !openDetails &&
      window.matchMedia("(max-width: 700px)").matches
    ) {
      setMapOpen(true);
    }
    globe.pointOfView(
      {
        lat: place.coordinates[0],
        lng: place.coordinates[1],
        altitude: 0.92,
      },
      900,
    );
  }
  if (openDetails) openPlaceDialog(placeId);
}

function appendFact(list, label, value, link) {
  if (!value) return;
  const row = makeElement("div", "fact-row");
  row.append(makeElement("dt", "", label));
  const valueElement = link
    ? makeElement("a", "", value)
    : makeElement("dd", "", value);
  if (link) {
    valueElement.href = link;
    valueElement.target = "_blank";
    valueElement.rel = "noreferrer";
  }
  row.append(valueElement);
  list.append(row);
}

function openPlaceDialog(placeId) {
  const place = places.find((item) => item.id === placeId);
  if (!place) return;
  currentDetailId = placeId;
  clearPendingPersonalPhotos();
  detailEditForm.hidden = true;
  detailEditForm.reset();
  document.querySelector("#edit-place").hidden = false;
  document.querySelector("#delete-place").hidden = false;
  document.querySelector("#save-notes").hidden = false;
  document.querySelector("#detail-title").textContent = place.name;
  document.querySelector("#detail-category").textContent =
    categoryLabels[place.category] || "LUOGO";
  document.querySelector("#detail-folder-breadcrumb").textContent = [
    place.country,
    place.city,
  ]
    .filter(Boolean)
    .join(" / ");
  document.querySelector("#detail-address").textContent =
    place.address || [place.city, place.country].filter(Boolean).join(", ");

  const description = document.querySelector("#detail-description");
  description.textContent = place.description || "";
  description.hidden = !place.description;
  const descriptionSource = document.querySelector("#description-source");
  const descriptionUrl = safeExternalUrl(place.descriptionSource);
  descriptionSource.hidden = !descriptionUrl;
  if (descriptionUrl) {
    descriptionSource.href = descriptionUrl;
  }

  const facts = document.querySelector("#detail-facts");
  facts.replaceChildren();
  appendFact(facts, "CITTÀ", place.city);
  appendFact(facts, "PAESE", place.country);
  appendFact(facts, "INDIRIZZO", place.address);
  appendFact(facts, "ORARI", place.openingHours);
  appendFact(facts, "TELEFONO", place.phone);
  appendFact(facts, "PREZZO", place.priceRange);
  if (place.rating) {
    appendFact(facts, "VALUTAZIONE", `★ ${place.rating}`);
  }
  if (place.reviewCount) {
    appendFact(facts, "RECENSIONI", String(place.reviewCount));
  }

  const googleLink = document.querySelector("#google-maps-link");
  googleLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    place.coordinates.join(","),
  )}`;
  const officialLink = document.querySelector("#official-link");
  const officialUrl = safeExternalUrl(place.website);
  officialLink.hidden = !officialUrl;
  if (officialUrl) {
    officialLink.href = officialUrl;
    officialLink.textContent = "SITO UFFICIALE ↗";
  }
  const tripadvisorLink = document.querySelector("#tripadvisor-link");
  const tripadvisorUrl = safeExternalUrl(place.tripadvisorUrl);
  tripadvisorLink.hidden = !tripadvisorUrl;
  if (tripadvisorUrl) tripadvisorLink.href = tripadvisorUrl;
  const osmLink = document.querySelector("#osm-link");
  const osmUrl = safeExternalUrl(place.osm?.url);
  osmLink.hidden = !osmUrl;
  if (osmUrl) osmLink.href = osmUrl;
  document.querySelector("#personal-notes").value = place.notes || "";
  renderGallery(place);

  if (!placeDialog.open) placeDialog.showModal();
}

function safeExternalUrl(value) {
  try {
    if (typeof value !== "string" || !value.trim()) return "";
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
      ? value
      : `https://${value}`;
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderGallery(place) {
  detailGallery.replaceChildren();
  const gallery = galleryImages(place).filter((image) =>
    resolveImageReference(imageReference(image)),
  );
  if (!gallery.length) {
    setPhotoCredit(null);
    const empty = makeElement("div", "gallery-empty");
    empty.append(
      makeElement("img", "", ""),
      makeElement("span", "", "FOTO NON ANCORA DISPONIBILI"),
    );
    empty.querySelector("img").src = "assets/Logo_Simbolo.svg";
    empty.querySelector("img").alt = "";
    detailGallery.append(empty);
    return;
  }

  const coverReference = place.image || "";
  const initialReference = gallery.some(
    (image) => imageReference(image) === coverReference,
  )
    ? coverReference
    : imageReference(gallery[0]);
  const initialImage =
    gallery.find((image) => imageReference(image) === initialReference) || gallery[0];
  setPhotoCredit(initialImage);
  let selectedReference = initialReference;
  const mainImage = makeElement("img", "gallery-main-image");
  mainImage.src = resolveImageReference(initialReference);
  mainImage.alt = `Fotografia di ${place.name}`;
  const mainFrame = makeElement("button", "gallery-main gallery-main-button");
  mainFrame.type = "button";
  mainFrame.setAttribute("aria-label", "Apri fotografia a dimensione maggiore");
  mainFrame.append(mainImage);
  mainFrame.addEventListener("click", () =>
    openPhotoLightbox(selectedReference, mainImage.alt),
  );
  const thumbnails = makeElement("div", "gallery-thumbnails");
  gallery.forEach((image, index) => {
    const reference = imageReference(image);
    const thumbnailItem = makeElement("div", "gallery-thumb-item");
    const thumbnail = makeElement("button", "gallery-thumbnail");
    thumbnail.type = "button";
    thumbnail.setAttribute("aria-label", `Mostra fotografia ${index + 1}`);
    const thumbnailImage = makeElement("img");
    thumbnailImage.src = resolveImageReference(reference);
    thumbnailImage.alt = "";
    thumbnail.append(thumbnailImage);
    thumbnail.addEventListener("click", () => {
      selectedReference = reference;
      mainImage.src = resolveImageReference(reference);
      setPhotoCredit(image);
      thumbnails.querySelectorAll("button").forEach((button) => {
        if (button.classList.contains("gallery-thumbnail")) {
          button.classList.toggle("is-current", button === thumbnail);
        }
      });
    });
    if (index === 0) thumbnail.classList.add("is-current");
    thumbnailItem.append(thumbnail);
    const controls = makeElement("div", "gallery-thumb-controls");
    const coverButton = makeElement(
      "button",
      `gallery-cover-button${place.image === reference ? " is-cover" : ""}`,
      "COPERTINA",
    );
    coverButton.type = "button";
    coverButton.setAttribute("aria-label", `Imposta fotografia ${index + 1} come copertina`);
    coverButton.addEventListener("click", () => updateGalleryCover(place, gallery, reference));
    controls.append(coverButton);

    const upButton = makeElement("button", "", "↑");
    upButton.type = "button";
    upButton.disabled = index === 0;
    upButton.setAttribute("aria-label", `Sposta fotografia ${index + 1} prima`);
    upButton.addEventListener("click", () => moveGalleryPhoto(place, gallery, index, -1));
    controls.append(upButton);
    const downButton = makeElement("button", "", "↓");
    downButton.type = "button";
    downButton.disabled = index === gallery.length - 1;
    downButton.setAttribute("aria-label", `Sposta fotografia ${index + 1} dopo`);
    downButton.addEventListener("click", () => moveGalleryPhoto(place, gallery, index, 1));
    controls.append(downButton);
    if (image.kind === "personal") {
      const deleteButton = makeElement("button", "", "×");
      deleteButton.type = "button";
      deleteButton.setAttribute("aria-label", `Elimina ${image.name || "foto personale"}`);
      deleteButton.addEventListener("click", () => deletePersonalPhoto(place, gallery, image));
      controls.append(deleteButton);
    }
    thumbnailItem.append(controls);
    thumbnails.append(thumbnailItem);
  });
  detailGallery.append(mainFrame, thumbnails);
}

function setPhotoCredit(image) {
  const photoCredit = document.querySelector("#photo-credit");
  const photoSource = safeExternalUrl(image?.sourceUrl);
  photoCredit.hidden = !image?.credit && !image?.license;
  if (photoSource) {
    photoCredit.href = photoSource;
  } else {
    photoCredit.removeAttribute("href");
  }
  photoCredit.textContent = [image?.credit, image?.license].filter(Boolean).join(" · ");
}

function openPhotoLightbox(reference, alt) {
  const source = resolveImageReference(reference, true);
  if (!source) return;
  photoLightboxImage.src = source;
  photoLightboxImage.alt = alt;
  if (!photoLightbox.open) photoLightbox.showModal();
}

async function updateGalleryCover(place, gallery, reference) {
  const previous = structuredClone(place);
  place.images = [...gallery];
  place.image = reference;
  if (!(await savePlaces())) {
    places = places.map((item) => item.id === previous.id ? previous : item);
    return;
  }
  renderPlaces();
  renderGallery(place);
  showToast("Copertina aggiornata.");
}

async function moveGalleryPhoto(place, gallery, index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= gallery.length) return;
  const previous = structuredClone(place);
  const reordered = [...gallery];
  [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
  place.images = reordered;
  if (!(await savePlaces())) {
    places = places.map((item) => item.id === previous.id ? previous : item);
    return;
  }
  renderPlaces();
  renderGallery(place);
  showToast("Ordine della galleria aggiornato.");
}

async function deletePersonalPhoto(place, gallery, image) {
  if (image.kind !== "personal") return;
  const previous = structuredClone(place);
  const remaining = gallery.filter((item) => imageReference(item) !== imageReference(image));
  place.images = remaining;
  if (place.image === imageReference(image)) {
    place.image = imageReference(remaining[0]) || "";
  }
  if (!(await savePlaces({ photosToDelete: [image.id] }))) {
    places = places.map((item) => item.id === previous.id ? previous : item);
    return;
  }
  renderPlaces();
  renderGallery(place);
  showToast("Fotografia personale eliminata.");
}

function renderDialogAfterUpdate() {
  const place = places.find((item) => item.id === currentDetailId);
  if (place) openPlaceDialog(place.id);
}

function setupFilterButtons() {
  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-chip").forEach((chip) => {
        const selected = chip === button;
        chip.classList.toggle("is-active", selected);
        chip.setAttribute("aria-pressed", String(selected));
      });
      renderPlaces();
    });
  });
}

function renderCategoryCounts() {
  const counts = places.reduce((map, place) => {
    map[place.category] = (map[place.category] || 0) + 1;
    return map;
  }, {});
  document.querySelector('[data-filter="all"] span').textContent = String(
    places.length,
  ).padStart(2, "0");
  document.querySelectorAll(".filter-chip[data-filter]").forEach((button) => {
    if (button.dataset.filter !== "all") {
      button.querySelector("span").textContent = String(
        counts[button.dataset.filter] || 0,
      ).padStart(2, "0");
    }
  });
  document.querySelector("#place-count").textContent = String(places.length).padStart(2, "0");
}

const globe = Globe()(globeContainer)
  .backgroundColor("#e4eae6")
  .showAtmosphere(true)
  .atmosphereColor("#dce1de")
  .atmosphereAltitude(0.075)
  .polygonsData([])
  // Lift tessellated country caps clear of the globe surface.
  .polygonAltitude(0.005)
  .polygonCapColor(() => "#e6eae7")
  .polygonSideColor(() => "rgba(0, 0, 0, 0)")
  .polygonStrokeColor(() => "rgba(125, 133, 128, 0.48)")
  .polygonLabel((feature) => feature.properties?.NAME || "")
  .polygonsTransitionDuration(0)
  .htmlElementsData([])
  .htmlLat((place) => place.coordinates[0])
  .htmlLng((place) => place.coordinates[1])
  .htmlAltitude(0.025)
  .enablePointerInteraction(true)
  .pointOfView({ lat: 27, lng: 8, altitude: 2.3 }, 0);

const globeMaterial = globe.globeMaterial();
globeMaterial.map = null;
globeMaterial.color.set("#f8f9f7");
globeMaterial.specular.set("#e5e9e6");
globeMaterial.shininess = 4;
globeMaterial.needsUpdate = true;
globe.globeMaterial(globeMaterial);

const countryBoundaryUrls = {
  overview:
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson",
  detail:
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson",
};
const detailedBoundaryAltitude = isLowPowerDevice() ? 1.1 : 1.35;
let overviewCountryFeatures = null;
let detailedCountryFeatures = null;
let activeCountryFeatures = null;
let detailedCountryRequest = null;
let detailedCountryLoadFailed = false;

function isLowPowerDevice() {
  return (
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) ||
    window.matchMedia("(max-width: 700px)").matches
  );
}

function preferredGlobePixelRatio() {
  const maximum = isLowPowerDevice() ? 1.5 : 2;
  return Math.min(window.devicePixelRatio || 1, maximum);
}

function requestDetailedCountryFeatures() {
  if (detailedCountryFeatures || detailedCountryRequest || detailedCountryLoadFailed) {
    return detailedCountryRequest;
  }
  detailedCountryRequest = fetch(countryBoundaryUrls.detail)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Natural Earth ha risposto ${response.status}.`);
      }
      return response.json();
    })
    .then((geoJson) => {
      detailedCountryFeatures = geoJson.features;
      updateCountryBoundaryLevel(globe.pointOfView().altitude);
      return detailedCountryFeatures;
    })
    .catch((error) => {
      detailedCountryLoadFailed = true;
      console.warn("Confini geografici Natural Earth dettagliati non disponibili.", error);
      return null;
    });
  return detailedCountryRequest;
}

function updateCountryBoundaryLevel(altitude) {
  const needsDetail = altitude <= detailedBoundaryAltitude;
  if (needsDetail && !detailedCountryFeatures) {
    requestDetailedCountryFeatures();
  }
  const targetFeatures = needsDetail
    ? detailedCountryFeatures || overviewCountryFeatures
    : overviewCountryFeatures || detailedCountryFeatures;
  if (!targetFeatures || targetFeatures === activeCountryFeatures) return;
  activeCountryFeatures = targetFeatures;
  globe.polygonsData(targetFeatures);
}

function scheduleDetailedCountryFeatures() {
  const load = () => requestDetailedCountryFeatures();
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(load, { timeout: 2500 });
  } else {
    window.setTimeout(load, 1200);
  }
}

fetch(countryBoundaryUrls.overview)
  .then((response) => {
    if (!response.ok) throw new Error(`Natural Earth ha risposto ${response.status}.`);
    return response.json();
  })
  .then((geoJson) => {
    overviewCountryFeatures = geoJson.features;
    updateCountryBoundaryLevel(globe.pointOfView().altitude);
    scheduleDetailedCountryFeatures();
  })
  .catch((error) => {
    console.warn("Confini geografici Natural Earth panoramici non disponibili.", error);
    requestDetailedCountryFeatures();
  });

globe.controls().autoRotate = false;
globe.controls().enableDamping = true;
globe.controls().dampingFactor = 0.08;
globe.controls().addEventListener("change", () => {
  const altitude = globe.pointOfView().altitude;
  updateCountryBoundaryLevel(altitude);
  if (lastMarkerAltitude === null || Math.abs(altitude - lastMarkerAltitude) >= 0.01) {
    scheduleMarkerRender();
  }
});

const resizeObserver = new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  if (width > 0 && height > 0) {
    const renderer = globe.renderer();
    const pixelRatio = preferredGlobePixelRatio();
    if (renderer.getPixelRatio() !== pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
    }
    globe.width(width).height(height);
  }
});
resizeObserver.observe(globeContainer);

document.querySelector("#map-reset").addEventListener("click", () => {
  activePlaceId = null;
  previewCard.classList.remove("is-visible");
  globe.pointOfView({ lat: 27, lng: 8, altitude: 2.3 }, 900);
});

function setMapOpen(isOpen) {
  document.body.classList.toggle("map-open", isOpen);
  if (isOpen) {
    window.setTimeout(() => {
      const { width, height } = globeContainer.getBoundingClientRect();
      if (width > 0 && height > 0) globe.width(width).height(height);
    }, 180);
  }
}

document
  .querySelector("#mobile-map-toggle")
  .addEventListener("click", () => setMapOpen(true));
document
  .querySelector("#map-close")
  .addEventListener("click", () => setMapOpen(false));

document.querySelector("#add-place").addEventListener("click", () => {
  geoResults.replaceChildren();
  geoStatus.textContent = "";
  addForm.reset();
  addDialog.showModal();
  document.querySelector("#location-query").focus();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

for (const dialog of [addDialog, placeDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function chooseCity(address = {}) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.county ||
    address.state ||
    ""
  );
}

async function fetchNominatim(query) {
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeRequest));
  if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
  lastGeocodeRequest = Date.now();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    limit: "5",
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nominatim ha risposto ${response.status}.`);
  return response.json();
}

async function fetchCommonsImages(place) {
  const term = [place.name, place.city, place.country].filter(Boolean).join(" ");
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: term,
    gsrnamespace: "6",
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "1280",
    format: "json",
    origin: "*",
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Wikimedia Commons ha risposto ${response.status}.`);
  const data = await response.json();
  return Object.values(data.query?.pages || {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata || {};
      if (!info?.thumburl || !metadata.LicenseShortName?.value) return null;
      return {
        url: info.thumburl,
        sourceUrl: info.descriptionurl || page.fullurl || "",
        license: metadata.LicenseShortName.value.replace(/<[^>]*>/g, ""),
        credit: (metadata.Attribution?.value || metadata.Artist?.value || "")
          .replace(/<[^>]*>/g, "")
          .trim(),
      };
    })
    .filter(Boolean);
}

async function fetchWikipediaSummary(place) {
  const title = place.name.replaceAll(" ", "_");
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wikipedia ha risposto ${response.status}.`);
  const data = await response.json();
  if (!data.extract || data.type === "disambiguation") return null;
  return {
    text: data.extract,
    url: data.content_urls?.desktop?.page || "",
  };
}

function osmPlace(result, category) {
  const address = result.address || {};
  const city = chooseCity(address);
  const country = address.country || "";
  const tags = result.extratags || {};
  const name = result.name || result.namedetails?.name || result.display_name;
  const website = tags.website || tags["contact:website"] || "";
  return {
    id: `place-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`,
    name,
    shortName: name,
    city,
    country,
    countryCode: address.country_code?.toUpperCase() || "",
    address: result.display_name || "",
    subtitle: [city, country].filter(Boolean).join(", "),
    category,
    coordinates: [Number(result.lat), Number(result.lon)],
    image: "",
    images: [],
    description: "",
    website,
    phone: tags.phone || tags["contact:phone"] || "",
    openingHours: tags.opening_hours || "",
    osm: {
      type: result.osm_type,
      id: result.osm_id,
      url: result.osm_id
        ? `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`
        : "",
    },
  };
}

function renderGeocodeResults(results, category) {
  geoResults.replaceChildren();
  if (!results.length) {
    geoStatus.textContent = "Nessun risultato. Prova con un indirizzo più preciso.";
    return;
  }
  geoStatus.textContent = "Scegli il risultato corretto per aggiungerlo all’archivio.";
  results.forEach((result) => {
    const button = makeElement("button", "geocode-result");
    button.type = "button";
    button.append(
      makeElement("span", "geocode-result-name", result.name || result.display_name),
      makeElement("span", "geocode-result-address", result.display_name),
      makeElement("span", "geocode-result-arrow", "↗"),
    );
    button.addEventListener("click", () => addGeocodedPlace(result, category, button));
    geoResults.append(button);
  });
}

async function addGeocodedPlace(result, category, resultButton) {
  const place = osmPlace(result, category);
  if (!Number.isFinite(place.coordinates[0]) || !Number.isFinite(place.coordinates[1])) {
    showToast("Il risultato non include coordinate valide.");
    return;
  }
  geoResults.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
  geoStatus.textContent = "Cerco immagini e informazioni disponibili...";
  resultButton.classList.add("is-loading");

  const [imagesResult, summaryResult] = await Promise.allSettled([
    fetchCommonsImages(place),
    fetchWikipediaSummary(place),
  ]);
  if (imagesResult.status === "fulfilled") {
    place.images = imagesResult.value;
    place.image = place.images[0]?.url || "";
  } else {
    console.warn("Ricerca immagini Wikimedia non disponibile.", imagesResult.reason);
  }
  if (summaryResult.status === "fulfilled" && summaryResult.value) {
    place.description = summaryResult.value.text;
    place.descriptionSource = summaryResult.value.url;
  } else if (summaryResult.status === "rejected") {
    console.warn("Descrizione Wikipedia non disponibile.", summaryResult.reason);
  }

  places.unshift(place);
  if (!(await savePlaces())) {
    places.shift();
    geoResults.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
    geoStatus.textContent = "Impossibile salvare il luogo in questo browser.";
    return;
  }
  activeFilter = "all";
  searchInput.value = "";
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    const selected = chip.dataset.filter === "all";
    chip.classList.toggle("is-active", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
  renderCategoryCounts();
  renderPlaces();
  addDialog.close();
  setMapOpen(false);
  selectPlace(place.id, true, false);
  const optionalFailed =
    imagesResult.status === "rejected" || summaryResult.status === "rejected";
  showToast(
    optionalFailed
      ? "Luogo aggiunto; una fonte opzionale non era disponibile."
      : "Luogo aggiunto e organizzato nella cartella Paese / Città.",
  );
}

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = document.querySelector("#location-query").value.trim();
  if (!query) return;
  const submitButton = addForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  geoStatus.textContent = "Cerco il luogo su OpenStreetMap...";
  geoResults.replaceChildren();
  try {
    const results = await fetchNominatim(query);
    renderGeocodeResults(results, document.querySelector("#new-category").value);
  } catch (error) {
    console.error("Ricerca Nominatim non riuscita.", error);
    geoStatus.textContent =
      "Ricerca non disponibile. Riprova tra poco o usa l’indirizzo completo.";
    showToast("Non riesco a contattare Nominatim. Verifica la connessione.");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#save-notes").addEventListener("click", async () => {
  const place = places.find((item) => item.id === currentDetailId);
  if (!place) return;
  const previousNotes = place.notes || "";
  place.notes = document.querySelector("#personal-notes").value.trim();
  if (await savePlaces()) {
    showToast("Nota personale salvata su questo dispositivo.");
  } else {
    place.notes = previousNotes;
    document.querySelector("#personal-notes").value = previousNotes;
  }
});

document.querySelector("#edit-place").addEventListener("click", () => {
  const place = places.find((item) => item.id === currentDetailId);
  if (!place) return;
  for (const key of ["name", "city", "country", "address", "description", "website", "tripadvisorUrl", "phone", "openingHours"]) {
    detailEditForm.elements[key].value = place[key] || "";
  }
  detailEditForm.elements.category.value = place.category;
  detailEditForm.hidden = false;
  document.querySelector("#edit-place").hidden = true;
  document.querySelector("#delete-place").hidden = true;
  document.querySelector("#save-notes").hidden = true;
  detailEditForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelector("#cancel-edit").addEventListener("click", () => {
  detailEditForm.hidden = true;
  document.querySelector("#edit-place").hidden = false;
  document.querySelector("#delete-place").hidden = false;
  document.querySelector("#save-notes").hidden = false;
});

const supportedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function clearPendingPersonalPhotos() {
  pendingPersonalPhotos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  pendingPersonalPhotos = [];
  renderPendingPersonalPhotos();
}

function renderPendingPersonalPhotos() {
  personalPhotoStaging.replaceChildren();
  pendingPersonalPhotos.forEach((photo, index) => {
    const preview = makeElement("div", "staged-photo");
    const image = makeElement("img");
    image.src = photo.previewUrl;
    image.alt = `Anteprima di ${photo.fileName}`;
    preview.title = photo.fileName;
    const removeButton = makeElement("button", "", "×");
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Rimuovi ${photo.fileName} dall'anteprima`);
    removeButton.addEventListener("click", () => {
      URL.revokeObjectURL(photo.previewUrl);
      pendingPersonalPhotos.splice(index, 1);
      renderPendingPersonalPhotos();
    });
    preview.append(image, removeButton);
    personalPhotoStaging.append(preview);
  });
  savePersonalPhotosButton.hidden = pendingPersonalPhotos.length === 0;
  savePersonalPhotosButton.textContent = `AGGIUNGI ${pendingPersonalPhotos.length} ${pendingPersonalPhotos.length === 1 ? "FOTOGRAFIA" : "FOTOGRAFIE"} ALLA GALLERIA`;
}

function inferPhotoType(file) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }[extension] || "";
}

function createOptimizedPreview(blob, mimeType) {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error("Immagine non valida."));
    };
    image.onload = () => {
      URL.revokeObjectURL(sourceUrl);
      const maxDimension = 1920;
      if (Math.max(image.width, image.height) <= maxDimension) {
        resolve(blob);
        return;
      }
      const scale = maxDimension / Math.max(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Impossibile creare l'anteprima ottimizzata."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (previewBlob) => resolve(previewBlob || blob),
        mimeType,
        mimeType === "image/jpeg" ? 0.88 : undefined,
      );
    };
    image.src = sourceUrl;
  });
}

async function queuePersonalPhotos(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  const validFiles = files.filter((file) => supportedPhotoTypes.has(inferPhotoType(file)));
  if (validFiles.length !== files.length) {
    showToast("Sono supportate solo immagini JPG, PNG e WebP.");
  }
  try {
    const preparedPhotos = await Promise.all(
      validFiles.map(async (file) => {
        const mimeType = inferPhotoType(file);
        const originalBlob = file.slice(0, file.size, mimeType);
        const previewBlob = await createOptimizedPreview(originalBlob, mimeType);
        return {
          fileName: file.name || `fotografia.${mimeType.split("/")[1]}`,
          mimeType,
          originalBlob,
          previewBlob: previewBlob === originalBlob ? null : previewBlob,
          previewUrl: URL.createObjectURL(previewBlob || originalBlob),
        };
      }),
    );
    pendingPersonalPhotos.push(...preparedPhotos);
    renderPendingPersonalPhotos();
  } catch (error) {
    console.error("Impossibile preparare le immagini selezionate.", error);
    showToast("Non riesco a leggere una o più immagini. Verifica i file e riprova.");
  }
}

personalPhotoInput.addEventListener("change", () => {
  queuePersonalPhotos(personalPhotoInput.files);
  personalPhotoInput.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  personalPhotoDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    personalPhotoDropzone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  personalPhotoDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    personalPhotoDropzone.classList.remove("is-dragging");
  });
}
personalPhotoDropzone.addEventListener("drop", (event) => {
  if (event.dataTransfer?.files) queuePersonalPhotos(event.dataTransfer.files);
});

savePersonalPhotosButton.addEventListener("click", async () => {
  const place = places.find((item) => item.id === currentDetailId);
  if (!place || !pendingPersonalPhotos.length) return;
  const previous = structuredClone(place);
  const photosToPut = pendingPersonalPhotos.map((photo) => {
    const id = newPhotoId();
    return {
      id,
      placeId: place.id,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      originalBlob: photo.originalBlob,
      previewBlob: photo.previewBlob,
      addedAt: new Date().toISOString(),
    };
  });
  const imageMetadata = photosToPut.map((photo) => ({
    kind: "personal",
    id: photo.id,
    name: photo.fileName,
    mimeType: photo.mimeType,
    credit: "Foto personale",
    license: "Foto personale",
  }));
  place.images = [...(place.images || []), ...imageMetadata];
  if (!place.image) place.image = `personal:${imageMetadata[0].id}`;
  savePersonalPhotosButton.disabled = true;
  if (!(await savePlaces({ photosToPut }))) {
    places = places.map((item) => item.id === previous.id ? previous : item);
    savePersonalPhotosButton.disabled = false;
    return;
  }
  clearPendingPersonalPhotos();
  renderPlaces();
  renderGallery(place);
  showToast(`${imageMetadata.length} ${imageMetadata.length === 1 ? "fotografia aggiunta" : "fotografie aggiunte"} alla galleria.`);
  savePersonalPhotosButton.disabled = false;
});

detailEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const place = places.find((item) => item.id === currentDetailId);
  if (!place) return;
  const previousPlace = structuredClone(place);
  const saveButton = detailEditForm.querySelector('[type="submit"]');
  saveButton.disabled = true;
  for (const key of ["name", "city", "country", "address", "description", "website", "tripadvisorUrl", "phone", "openingHours"]) {
    place[key] = detailEditForm.elements[key].value.trim();
  }
  place.shortName = place.name;
  place.subtitle = [place.city, place.country].filter(Boolean).join(", ");
  place.category = detailEditForm.elements.category.value;
  if (!(await savePlaces())) {
    places = places.map((item) =>
      item.id === previousPlace.id ? previousPlace : item,
    );
    saveButton.disabled = false;
    return;
  }
  renderCategoryCounts();
  renderPlaces();
  renderDialogAfterUpdate();
  showToast("Luogo aggiornato.");
  saveButton.disabled = false;
});

const zipEncoder = new TextEncoder();
const zipDecoder = new TextDecoder();
const zipCrcTable = new Uint32Array(256);
for (let index = 0; index < zipCrcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  zipCrcTable[index] = value >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ zipCrcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(({ name, bytes }) => {
    const nameBytes = zipEncoder.encode(name);
    const checksum = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, bytes.length, true);
    localView.setUint32(22, bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    localParts.push(local, bytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + bytes.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  if (
    entries.length > 0xffff ||
    offset > 0xffffffff ||
    centralSize > 0xffffffff
  ) {
    throw new Error("Archivio troppo grande per il formato ZIP supportato.");
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end], {
    type: "application/zip",
  });
}

async function readStoredZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchStart = Math.max(0, bytes.length - 22 - 0xffff);
  let endOffset = -1;
  for (let index = bytes.length - 22; index >= searchStart; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Il file selezionato non è un archivio ZIP valido.");
  const count = view.getUint16(endOffset + 10, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (count === 0xffff || directoryOffset === 0xffffffff) {
    throw new Error("Gli archivi ZIP64 non sono supportati.");
  }

  const entries = new Map();
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("Indice ZIP non valido.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = zipDecoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor += 46 + nameLength + extraLength + commentLength;
    if ((flags & 1) || method !== 0 || compressedSize !== uncompressedSize) {
      throw new Error("L'archivio deve contenere file ZIP non cifrati e non compressi.");
    }
    if (name.startsWith("/") || name.split("/").includes("..") || entries.has(name)) {
      throw new Error("Il contenuto dell'archivio ZIP non è valido.");
    }
    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error("File ZIP danneggiato.");
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    if (
      data.length !== uncompressedSize ||
      crc32(data) !== checksum
    ) {
      throw new Error(`Verifica di integrità fallita per ${name}.`);
    }
    entries.set(name, data);
  }
  return entries;
}

function zipPhotoExtension(mimeType) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[mimeType] || "bin";
}

async function exportArchive() {
  const button = document.querySelector("#export-archive");
  button.disabled = true;
  try {
    const placeSnapshot = structuredClone(places);
    const placeIds = new Set(placeSnapshot.map((place) => place.id));
    const photos = [...personalPhotoRecords.values()].filter((photo) =>
      placeIds.has(photo.placeId),
    );
    const entries = [];
    const manifestPhotos = [];
    for (const photo of photos) {
      const extension = zipPhotoExtension(photo.mimeType);
      const originalEntry = `photos/${photo.id}.${extension}`;
      const previewEntry = photo.previewBlob
        ? `previews/${photo.id}.${extension}`
        : null;
      entries.push({
        name: originalEntry,
        bytes: new Uint8Array(await photo.originalBlob.arrayBuffer()),
      });
      if (previewEntry) {
        entries.push({
          name: previewEntry,
          bytes: new Uint8Array(await photo.previewBlob.arrayBuffer()),
        });
      }
      manifestPhotos.push({
        id: photo.id,
        placeId: photo.placeId,
        fileName: photo.fileName,
        mimeType: photo.mimeType,
        originalEntry,
        previewEntry,
        addedAt: photo.addedAt,
      });
    }
    const manifest = {
      format: "roam-archive",
      version: 1,
      exportedAt: new Date().toISOString(),
      places: placeSnapshot,
      personalPhotos: manifestPhotos,
    };
    entries.unshift({
      name: "manifest.json",
      bytes: zipEncoder.encode(JSON.stringify(manifest, null, 2)),
    });
    const url = URL.createObjectURL(makeZip(entries));
    const download = document.createElement("a");
    download.href = url;
    download.download = `roam-archive-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup ZIP esportato.");
  } catch (error) {
    console.error("Impossibile esportare il backup ROAM.", error);
    showToast(error.message || "Esportazione del backup non riuscita.");
  } finally {
    button.disabled = false;
  }
}

function rewritePlacePhotoIds(place, photoIdMap) {
  const rewritten = structuredClone(place);
  rewritten.images = (rewritten.images || []).map((image) => {
    if (image.kind !== "personal") return image;
    const id = photoIdMap.get(image.id);
    if (!id) throw new Error(`Manca il file della fotografia ${image.name || ""}.`);
    return { ...image, id };
  });
  if (rewritten.image?.startsWith("personal:")) {
    const id = photoIdMap.get(rewritten.image.slice("personal:".length));
    if (!id) throw new Error("La copertina personale non è inclusa nel backup.");
    rewritten.image = `personal:${id}`;
  }
  return rewritten;
}

async function importArchive(file) {
  const zipEntries = await readStoredZip(file);
  const manifestBytes = zipEntries.get("manifest.json");
  if (!manifestBytes) throw new Error("Il backup non contiene manifest.json.");
  let manifest;
  try {
    manifest = JSON.parse(zipDecoder.decode(manifestBytes));
  } catch {
    throw new Error("Il manifest del backup non è leggibile.");
  }
  if (
    manifest.format !== "roam-archive" ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.places) ||
    !Array.isArray(manifest.personalPhotos)
  ) {
    throw new Error("Formato del backup ROAM non riconosciuto.");
  }

  const oldPlaces = structuredClone(places);
  const incomingPlaces = manifest.places;
  const incomingPlaceIds = new Set();
  incomingPlaces.forEach((place) => {
    if (!place?.id || !place.name || incomingPlaceIds.has(place.id)) {
      throw new Error("Il backup contiene luoghi non validi o duplicati.");
    }
    incomingPlaceIds.add(place.id);
  });
  const photoIdMap = new Map();
  const photosToPut = [];
  const incomingPhotoIds = new Set();

  for (const photo of manifest.personalPhotos) {
    if (
      !photo?.id ||
      !photo.placeId ||
      !supportedPhotoTypes.has(photo.mimeType) ||
      incomingPhotoIds.has(photo.id)
    ) {
      throw new Error("Il backup contiene metadati fotografici non validi.");
    }
    incomingPhotoIds.add(photo.id);
    if (
      !incomingPlaceIds.has(photo.placeId) &&
      !places.some((place) => place.id === photo.placeId)
    ) {
      throw new Error(`La fotografia ${photo.fileName || ""} non è associata a un luogo.`);
    }
    const existing = personalPhotoRecords.get(photo.id);
    if (existing?.placeId === photo.placeId) {
      photoIdMap.set(photo.id, photo.id);
      continue;
    }
    const id = existing ? newPhotoId() : photo.id;
    const originalBytes = zipEntries.get(photo.originalEntry);
    const previewBytes = photo.previewEntry
      ? zipEntries.get(photo.previewEntry)
      : originalBytes;
    if (!originalBytes || !previewBytes) {
      throw new Error(`File della fotografia ${photo.fileName || ""} mancante nel backup.`);
    }
    photoIdMap.set(photo.id, id);
    photosToPut.push({
      id,
      placeId: photo.placeId,
      fileName: photo.fileName || `fotografia.${zipPhotoExtension(photo.mimeType)}`,
      mimeType: photo.mimeType,
      originalBlob: new Blob([originalBytes], { type: photo.mimeType }),
      previewBlob: photo.previewEntry
        ? new Blob([previewBytes], { type: photo.mimeType })
        : null,
      addedAt: photo.addedAt || new Date().toISOString(),
    });
  }

  const imported = incomingPlaces.map((place) =>
    rewritePlacePhotoIds(place, photoIdMap),
  );
  for (const incoming of imported) {
    const current = places.find((place) => place.id === incoming.id);
    if (!current) {
      places.push(incoming);
      continue;
    }
    const currentImageIds = new Set(
      (current.images || [])
        .filter((image) => image.kind === "personal")
        .map((image) => image.id),
    );
    const newImages = (incoming.images || []).filter(
      (image) =>
        image.kind === "personal" &&
        !currentImageIds.has(image.id),
    );
    current.images = [...(current.images || []), ...newImages];
    if (!current.image && incoming.image) current.image = incoming.image;
  }

  const button = document.querySelector("#import-archive");
  button.disabled = true;
  if (!(await savePlaces({ photosToPut }))) {
    places = oldPlaces;
    button.disabled = false;
    return;
  }
  renderCategoryCounts();
  renderPlaces();
  showToast(`Backup importato: ${incomingPlaces.length} luoghi elaborati.`);
  button.disabled = false;
}

document.querySelector("#export-archive").addEventListener("click", exportArchive);
document.querySelector("#import-archive").addEventListener("click", () => archiveInput.click());
archiveInput.addEventListener("change", async () => {
  const [file] = archiveInput.files || [];
  archiveInput.value = "";
  if (!file) return;
  const button = document.querySelector("#import-archive");
  button.disabled = true;
  try {
    await importArchive(file);
  } catch (error) {
    console.error("Impossibile importare il backup ROAM.", error);
    showToast(error.message || "Importazione del backup non riuscita.");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#close-photo-lightbox").addEventListener("click", () => {
  photoLightbox.close();
});
placeDialog.addEventListener("close", clearPendingPersonalPhotos);
photoLightbox.addEventListener("click", (event) => {
  if (event.target === photoLightbox) photoLightbox.close();
});

document.querySelector("#delete-place").addEventListener("click", async () => {
  const place = places.find((item) => item.id === currentDetailId);
  if (!place || !window.confirm(`Eliminare “${place.name}” dal tuo archivio?`)) return;
  const placeIndex = places.indexOf(place);
  places = places.filter((item) => item.id !== currentDetailId);
  activePlaceId = null;
  if (!(await savePlaces())) {
    places.splice(placeIndex, 0, place);
    renderPlaces();
    return;
  }
  for (const photo of personalPhotoRecords.values()) {
    if (photo.placeId === place.id) {
      personalPhotoRecords.delete(photo.id);
      revokePersonalPhotoUrls(photo.id);
    }
  }
  placeDialog.close();
  previewCard.classList.remove("is-visible");
  renderCategoryCounts();
  renderPlaces();
  showToast("Luogo eliminato dal tuo archivio.");
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.body.classList.contains("map-open")) {
    setMapOpen(false);
  }
});

async function initializeApp() {
  try {
    places = await loadPlaces();
  } catch (error) {
    console.error("Impossibile inizializzare l'archivio IndexedDB ROAM.", error);
    places = loadLegacyPlaces() || structuredClone(seedPlaces);
    showToast("Archivio permanente non disponibile: le modifiche non potranno essere salvate.");
  }
  setupFilterButtons();
  searchInput.addEventListener("input", renderPlaces);
  document.querySelector("#place-count").textContent = String(places.length).padStart(2, "0");
  renderCategoryCounts();
  renderPlaces();
}

initializeApp();
