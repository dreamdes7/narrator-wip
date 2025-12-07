// Character Avatar Assets Management
// Файлы имеют формат: archetype_gender_class_attribute1_attribute2.png.jpeg

// Импорт всех аватаров
import powerFemalNoble from '../assets/character/power_female_noble_diplomat_gown_fan.png.jpeg';
import powerLordCommander from '../assets/character/power_lord_commander_male_veteran_armored.png.jpeg';
import powerMaleAdvisor from '../assets/character/power_male_advisor_noble_robes_scroll.png.jpeg';
import powerMaleBaron from '../assets/character/power_male_baron_tyrant_fur_wine.png.jpeg';
import powerWarriorQueen from '../assets/character/power_warrior_queen_female_regal_armored.png.jpeg';

import shadowAssassin from '../assets/character/shadow_andro_assassin_ninja_mask_blades.png.jpeg';
import shadowFemaleSpy from '../assets/character/shadow_female_spy_elegant_leather_dark.png.jpeg';
import shadowInformant from '../assets/character/shadow_male_informant_broker_plain_civilian.png.jpeg';
import shadowMercenary from '../assets/character/shadow_male_mercenary_brute_greatsword.png.jpeg';
import shadowRanger from '../assets/character/shadow_male_ranger_forest_traveler_weathered.png.jpeg';
import shadowRogue from '../assets/character/shadow_male_rogue_thief_hood_dagger.png.jpeg';

import outsiderOracle from '../assets/character/outsider_female_oracle_mystic_blindfold_magic.png.jpeg';
import outsiderBarbarian from '../assets/character/outsider_male_barbarian_tribal_furs_wild.png.jpeg';
import outsiderTraveler from '../assets/character/outsider_traveler_masked_mystery_neutral.png.jpeg';
import outsiderWitch from '../assets/character/outsider_witch_mystic_nature_female.png.jpeg';
import outsiderWizard from '../assets/character/outsider_wizard_elder_magic_robes.png.jpeg';

// Типы
export type CharacterArchetype = 'power' | 'shadow' | 'outsider';

export interface CharacterAvatar {
  id: string;
  archetype: CharacterArchetype;
  filename: string;
  tags: string[];        // Теги из имени файла
  imageSrc: string;      // Путь к изображению
  description: string;   // Описание для LLM
}

// Каталог аватаров
export const CHARACTER_AVATARS: CharacterAvatar[] = [
  // POWER - связаны с властью
  {
    id: 'power_female_noble',
    archetype: 'power',
    filename: 'power_female_noble_diplomat_gown_fan.png.jpeg',
    tags: ['female', 'noble', 'diplomat', 'gown', 'fan'],
    imageSrc: powerFemalNoble,
    description: 'Женщина-дипломат из знати, в изысканном платье с веером'
  },
  {
    id: 'power_lord_commander',
    archetype: 'power',
    filename: 'power_lord_commander_male_veteran_armored.png.jpeg',
    tags: ['male', 'lord', 'commander', 'veteran', 'armored'],
    imageSrc: powerLordCommander,
    description: 'Мужчина-командир в доспехах, ветеран войн'
  },
  {
    id: 'power_male_advisor',
    archetype: 'power',
    filename: 'power_male_advisor_noble_robes_scroll.png.jpeg',
    tags: ['male', 'advisor', 'noble', 'robes', 'scroll'],
    imageSrc: powerMaleAdvisor,
    description: 'Мужчина-советник в благородных одеждах со свитком'
  },
  {
    id: 'power_male_baron',
    archetype: 'power',
    filename: 'power_male_baron_tyrant_fur_wine.png.jpeg',
    tags: ['male', 'baron', 'tyrant', 'fur', 'wine'],
    imageSrc: powerMaleBaron,
    description: 'Мужчина-барон в мехах с бокалом вина, властный вид'
  },
  {
    id: 'power_warrior_queen',
    archetype: 'power',
    filename: 'power_warrior_queen_female_regal_armored.png.jpeg',
    tags: ['female', 'warrior', 'queen', 'regal', 'armored'],
    imageSrc: powerWarriorQueen,
    description: 'Женщина-воительница королевских кровей в доспехах'
  },

  // SHADOW - из теней
  {
    id: 'shadow_assassin',
    archetype: 'shadow',
    filename: 'shadow_andro_assassin_ninja_mask_blades.png.jpeg',
    tags: ['androgynous', 'assassin', 'ninja', 'mask', 'blades'],
    imageSrc: shadowAssassin,
    description: 'Ассасин в маске с клинками, андрогинный облик'
  },
  {
    id: 'shadow_female_spy',
    archetype: 'shadow',
    filename: 'shadow_female_spy_elegant_leather_dark.png.jpeg',
    tags: ['female', 'spy', 'elegant', 'leather', 'dark'],
    imageSrc: shadowFemaleSpy,
    description: 'Женщина-шпионка, элегантная в тёмной коже'
  },
  {
    id: 'shadow_informant',
    archetype: 'shadow',
    filename: 'shadow_male_informant_broker_plain_civilian.png.jpeg',
    tags: ['male', 'informant', 'broker', 'plain', 'civilian'],
    imageSrc: shadowInformant,
    description: 'Мужчина-информатор, неприметный в гражданской одежде'
  },
  {
    id: 'shadow_mercenary',
    archetype: 'shadow',
    filename: 'shadow_male_mercenary_brute_greatsword.png.jpeg',
    tags: ['male', 'mercenary', 'brute', 'greatsword'],
    imageSrc: shadowMercenary,
    description: 'Мужчина-наёмник с двуручным мечом, брутальный вид'
  },
  {
    id: 'shadow_ranger',
    archetype: 'shadow',
    filename: 'shadow_male_ranger_forest_traveler_weathered.png.jpeg',
    tags: ['male', 'ranger', 'forest', 'traveler', 'weathered'],
    imageSrc: shadowRanger,
    description: 'Мужчина-следопыт, потрёпанный лесной путник'
  },
  {
    id: 'shadow_rogue',
    archetype: 'shadow',
    filename: 'shadow_male_rogue_thief_hood_dagger.png.jpeg',
    tags: ['male', 'rogue', 'thief', 'hood', 'dagger'],
    imageSrc: shadowRogue,
    description: 'Мужчина-разбойник в капюшоне с кинжалом'
  },

  // OUTSIDER - аутсайдеры
  {
    id: 'outsider_oracle',
    archetype: 'outsider',
    filename: 'outsider_female_oracle_mystic_blindfold_magic.png.jpeg',
    tags: ['female', 'oracle', 'mystic', 'blindfold', 'magic'],
    imageSrc: outsiderOracle,
    description: 'Женщина-оракул с повязкой на глазах, мистический облик'
  },
  {
    id: 'outsider_barbarian',
    archetype: 'outsider',
    filename: 'outsider_male_barbarian_tribal_furs_wild.png.jpeg',
    tags: ['male', 'barbarian', 'tribal', 'furs', 'wild'],
    imageSrc: outsiderBarbarian,
    description: 'Мужчина-варвар из племени, в мехах, дикий вид'
  },
  {
    id: 'outsider_traveler',
    archetype: 'outsider',
    filename: 'outsider_traveler_masked_mystery_neutral.png.jpeg',
    tags: ['neutral', 'traveler', 'masked', 'mystery'],
    imageSrc: outsiderTraveler,
    description: 'Таинственный путник в маске, пол неопределён'
  },
  {
    id: 'outsider_witch',
    archetype: 'outsider',
    filename: 'outsider_witch_mystic_nature_female.png.jpeg',
    tags: ['female', 'witch', 'mystic', 'nature'],
    imageSrc: outsiderWitch,
    description: 'Женщина-ведьма, связана с природой'
  },
  {
    id: 'outsider_wizard',
    archetype: 'outsider',
    filename: 'outsider_wizard_elder_magic_robes.png.jpeg',
    tags: ['elder', 'wizard', 'magic', 'robes'],
    imageSrc: outsiderWizard,
    description: 'Пожилой маг в мантии'
  }
];

// Получить аватары по архетипу
export const getAvatarsByArchetype = (archetype: CharacterArchetype): CharacterAvatar[] => {
  return CHARACTER_AVATARS.filter(a => a.archetype === archetype);
};

// Получить аватар по ID
export const getAvatarById = (id: string): CharacterAvatar | undefined => {
  return CHARACTER_AVATARS.find(a => a.id === id);
};

// Получить описание доступных аватаров для промпта LLM
export const getAvatarsPromptDescription = (): string => {
  const powerAvatars = getAvatarsByArchetype('power');
  const shadowAvatars = getAvatarsByArchetype('shadow');
  const outsiderAvatars = getAvatarsByArchetype('outsider');

  return `
ДОСТУПНЫЕ АВАТАРЫ ПЕРСОНАЖЕЙ:

▸ POWER (власть) - выбери для персонажа #1:
${powerAvatars.map(a => `  • "${a.id}": ${a.description} [${a.tags.join(', ')}]`).join('\n')}

▸ SHADOW (тени) - выбери для персонажа #2:
${shadowAvatars.map(a => `  • "${a.id}": ${a.description} [${a.tags.join(', ')}]`).join('\n')}

▸ OUTSIDER (аутсайдер) - выбери для персонажа #3:
${outsiderAvatars.map(a => `  • "${a.id}": ${a.description} [${a.tags.join(', ')}]`).join('\n')}
`.trim();
};

// Получить список ID аватаров по архетипу
export const getAvatarIdsByArchetype = (archetype: CharacterArchetype): string[] => {
  return getAvatarsByArchetype(archetype).map(a => a.id);
};


