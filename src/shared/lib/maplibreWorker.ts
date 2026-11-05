// MapLibre v6 + Vite: worker — отдельный .mjs рядом с бандлом.
// Без setWorkerUrl → "Worker failed to load" / пустая карта.
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
