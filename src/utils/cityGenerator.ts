import * as d3 from 'd3';
import type { POI } from '../types/world';

// Типы районов
export type DistrictType = 
  | 'CASTLE' | 'KEEP'        
  | 'NOBLE'  | 'TEMPLE'      
  | 'MARKET' | 'PLAZA'       
  | 'CRAFTSMAN' | 'MILITARY' 
  | 'SLUMS'  | 'COTTAGES'    
  | 'FARM'   | 'FIELDS'      
  | 'GATE'   | 'RUINS';

export interface CityDistrict {
  id: string;
  name: string; // Уникальное имя (напр. "Golden Market")
  polygon: [number, number][];
  center: [number, number];
  type: DistrictType;
  neighbors: string[];
  color: string;
}

export interface CityLayout {
  width: number;
  height: number;
  districts: CityDistrict[];
  walls: [number, number][]; 
  name: string;
  type: string;
}

// --- ГЕНЕРАТОР ИМЕН РАЙОНОВ (RUSSIAN) ---
const DISTRICT_NAMES: Record<DistrictType, string[]> = {
  CASTLE: ["Королевский Дворец", "Высокая Цитадель", "Драконий Пик", "Солнечный Замок", "Крепость Короны"],
  KEEP: ["Старый Донжон", "Башня Барона", "Железный Холд", "Каменный Бастион"],
  NOBLE: ["Золотой Квартал", "Серебряные Холмы", "Сады Знати", "Лазурный Район", "Венечный Холм"],
  TEMPLE: ["Собор Света", "Святилище Предков", "Круг Магов", "Храм Бурь", "Священная Роща"],
  MARKET: ["Большой Базар", "Монетная Аллея", "Рынок Специй", "Рыбный Ряд", "Купеческий Тракт"],
  PLAZA: ["Королевская Площадь", "Площадь Героев", "Двор Фонтанов", "Лобное Место"],
  CRAFTSMAN: ["Кузнечный Двор", "Гончарная Слобода", "Квартал Кожевников", "Цех Мастеров", "Железная Улица"],
  MILITARY: ["Казармы Стражи", "Тренировочный Плац", "Оружейная", "Бастион", "Осадный Двор"],
  SLUMS: ["Трущобы", "Теневая Аллея", "Грязные Ворота", "Крысиный Угол", "Нищий Край"],
  COTTAGES: ["Речной Вид", "Восточный Конец", "Тихий Угол", "Пастуший Холм", "Фруктовый Переулок"],
  FARM: ["Мельничная Ферма", "Зеленые Пастбища", "Старый Амбар", "Пшеничные Поля", "Яблоневый Сад"],
  FIELDS: ["Южные Поля", "Зерновые Террасы", "Дальние Угодья", "Холм Ветряков"],
  GATE: ["Северные Ворота", "Королевские Ворота", "Железная Решетка"],
  RUINS: ["Разрушенная Башня", "Выжженный Квартал", "Старые Камни", "Забытые Подвалы"]
};

// Helper to get unique name
const getUniqueName = (type: DistrictType, usedNames: Set<string>, rng: () => number): string => {
  const pool = DISTRICT_NAMES[type] || [type];
  // Shuffle pool based on rng
  const shuffled = [...pool].sort(() => rng() - 0.5);
  
  for (const name of shuffled) {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Fallback if all used
  return `${type} ${Math.floor(rng() * 100)}`;
};

// Конфигурация
interface CityGenConfig {
  numDistricts: number;
  wallChance: number;
  districtsPool: {
    center: DistrictType;
    inner: DistrictType[];
    mid: DistrictType[];
    outer: DistrictType[];
  };
  radiusMod: number;
}

const CONFIGS: Record<string, CityGenConfig> = {
  capital: {
    numDistricts: 12, // Reduced
    wallChance: 1.0,
    districtsPool: {
      center: 'CASTLE',
      inner: ['NOBLE', 'TEMPLE', 'MILITARY', 'NOBLE'],
      mid: ['MARKET', 'CRAFTSMAN', 'MARKET', 'PLAZA'],
      outer: ['SLUMS', 'SLUMS', 'CRAFTSMAN']
    },
    radiusMod: 1.0
  },
  city: {
    numDistricts: 8, // Reduced
    wallChance: 0.8,
    districtsPool: {
      center: 'KEEP',
      inner: ['NOBLE', 'MARKET', 'TEMPLE'],
      mid: ['CRAFTSMAN', 'CRAFTSMAN', 'MARKET'],
      outer: ['SLUMS', 'COTTAGES']
    },
    radiusMod: 0.9
  },
  fortress: {
    numDistricts: 7, // Reduced
    wallChance: 1.0,
    districtsPool: {
      center: 'KEEP',
      inner: ['MILITARY', 'MILITARY'],
      mid: ['CRAFTSMAN', 'MILITARY'],
      outer: ['SLUMS', 'MILITARY']
    },
    radiusMod: 0.7
  },
  village: {
    numDistricts: 4, // Reduced
    wallChance: 0.1,
    districtsPool: {
      center: 'PLAZA',
      inner: ['COTTAGES', 'MARKET'],
      mid: ['COTTAGES', 'FARM'],
      outer: ['FARM', 'FIELDS']
    },
    radiusMod: 0.6
  },
  ruin: {
    numDistricts: 5, // Reduced
    wallChance: 0.3,
    districtsPool: {
      center: 'RUINS',
      inner: ['RUINS', 'SLUMS'],
      mid: ['RUINS', 'SLUMS'],
      outer: ['RUINS']
    },
    radiusMod: 0.8
  }
};

const DISTRICT_COLORS: Record<DistrictType, string> = {
  CASTLE: '#f1c40f', KEEP: '#f39c12',
  NOBLE: '#9b59b6', TEMPLE: '#8e44ad',
  MARKET: '#e67e22', PLAZA: '#ecf0f1',
  CRAFTSMAN: '#3498db', MILITARY: '#c0392b',
  SLUMS: '#5d4037', COTTAGES: '#795548',
  FARM: '#27ae60', FIELDS: '#2ecc71',
  GATE: '#95a5a6', RUINS: '#7f8c8d'
};

export function generateCityLayout(
  seed: number, 
  cityName: string, 
  poiType: string = 'city'
): CityLayout {
  let configKey = 'city';
  if (poiType === 'capital') configKey = 'capital';
  else if (poiType === 'fortress') configKey = 'fortress';
  else if (poiType === 'ruin') configKey = 'ruin';
  else if (cityName.toLowerCase().includes('village') || cityName.toLowerCase().includes('town')) configKey = 'village';
  
  const config = CONFIGS[configKey] || CONFIGS['city'];

  const rng = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const width = 1000;
  const height = 1000;
  const center: [number, number] = [width / 2, height / 2];
  
  // 1. Генерация точек
  let points: [number, number][] = [];
  points.push(center);

  const numDistricts = Math.floor(config.numDistricts * (0.8 + rng() * 0.4));

  for (let i = 0; i < numDistricts; i++) {
    const angle = rng() * Math.PI * 2;
    const r = (Math.sqrt(rng()) * 0.4 * width * config.radiusMod) + (width * 0.05); 
    const flatten = 0.8 + rng() * 0.4;
    const x = center[0] + Math.cos(angle) * r;
    const y = center[1] + Math.sin(angle) * r * flatten;
    points.push([x, y]);
  }

  // "GHOST" POINTS for boundary shaping
  // Instead of a rigid box, we create a ring of ghost points that cut off the city in organic ways.
  const ghostCount = 12;
  const ghostRadiusBase = width * 0.55 * config.radiusMod; // Just outside the city
  
  for(let i = 0; i < ghostCount; i++) {
     const angle = (i / ghostCount) * Math.PI * 2 + (rng() * 0.2);
     const r = ghostRadiusBase + (rng() * width * 0.1); // Add randomness to radius
     const x = center[0] + Math.cos(angle) * r;
     const y = center[1] + Math.sin(angle) * r;
     points.push([x, y]);
  }
  
  // Keep the far corners just in case to close very large open polygons
  points.push([-500, -500], [width + 500, -500], [width + 500, height + 500], [-500, height + 500]);

  // Total "real" points is numDistricts + 1 (center)
  // Ghost points start after that.
  const realPointsCount = numDistricts + 1;

  // 2. Релаксация
  let voronoi: d3.Voronoi<unknown> | null = null;
  for (let iter = 0; iter < 2; iter++) {
    const delaunay = d3.Delaunay.from(points);
    voronoi = delaunay.voronoi([0, 0, width, height]);
    points = points.map((p, i) => {
        // Fix ghost points and boundary points, only relax real points
        if (i >= realPointsCount) return p; 
        const polygon = voronoi!.cellPolygon(i);
        return polygon ? d3.polygonCentroid(polygon) : p;
    });
  }

  const finalDelaunay = d3.Delaunay.from(points);
  voronoi = finalDelaunay.voronoi([0, 0, width, height]);

  // 3. Создание районов
  const districts: CityDistrict[] = [];
  const usedNames = new Set<string>();
  
  // Only process real points
  const realPoints = points.slice(0, realPointsCount);

  const indicesByDist = realPoints
    .map((p, i) => ({ i, dist: Math.sqrt((p[0]-center[0])**2 + (p[1]-center[1])**2) }))
    .sort((a, b) => a.dist - b.dist);

  const indexMap = new Map(indicesByDist.map((item, order) => [item.i, order]));

  for (let i = 0; i < realPointsCount; i++) {
    const polygon = voronoi.cellPolygon(i);
    if (!polygon) continue;
    
    const cx = points[i][0];
    const cy = points[i][1];
    
    const order = indexMap.get(i) || 0;
    const total = realPointsCount;
    const ratio = order / total;

    let type: DistrictType;
    
    if (order === 0) {
      type = config.districtsPool.center;
    } else if (ratio < 0.3) {
      type = config.districtsPool.inner[Math.floor(rng() * config.districtsPool.inner.length)];
    } else if (ratio < 0.6) {
      type = config.districtsPool.mid[Math.floor(rng() * config.districtsPool.mid.length)];
    } else {
      type = config.districtsPool.outer[Math.floor(rng() * config.districtsPool.outer.length)];
    }

    const roadScale = configKey === 'village' ? 0.88 : 0.92;
    const shrunkPolygon = polygon.map(p => {
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        return [cx + dx * roadScale, cy + dy * roadScale] as [number, number];
    });

    const districtName = getUniqueName(type, usedNames, rng);

    districts.push({
      id: `district-${i}`,
      name: districtName,
      polygon: shrunkPolygon,
      center: [cx, cy],
      type,
      neighbors: [],
      color: DISTRICT_COLORS[type]
    });
  }

  // 4. Стена
  let wallPolygon: [number, number][] = [];
  if (rng() < config.wallChance) {
    const corePoints = districts
      .filter(d => {
         if (configKey === 'village') return true; 
         return !['SLUMS', 'FARM', 'FIELDS', 'RUINS'].includes(d.type);
      })
      .map(d => d.center);
      
    if (corePoints.length > 2) {
        const hullIndices = d3.polygonHull(corePoints);
        if (hullIndices) {
            const hullCentroid = d3.polygonCentroid(hullIndices);
            wallPolygon = hullIndices.map(p => {
                const dx = p[0] - hullCentroid[0];
                const dy = p[1] - hullCentroid[1];
                return [hullCentroid[0] + dx * 1.3, hullCentroid[1] + dy * 1.3];
            });
            wallPolygon.push(wallPolygon[0]);
        }
    }
  }

  return {
    width,
    height,
    districts,
    walls: wallPolygon,
    roads: [],
    gates: [],
    name: cityName,
    type: configKey
  };
}
