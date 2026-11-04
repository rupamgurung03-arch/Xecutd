const LEGACY_MIGRATION_OWNER_KEY = 'apextrade_legacy_migrated_to_user';
const LEGACY_STORAGE_KEYS = [
  'apextrade_settings',
  'apextrade_trades',
  'apextrade_playbooks',
  'apextrade_rules',
  'apextrade_analysis_pages',
  'apextrade_custom_mistakes',
  'apextrade_execution_qualities',
  'apextrade_custom_grades',
];

export const userStorageKey = (baseKey: string, userId: string) => `${baseKey}::user:${userId}`;

const dismissedKey = (userId: string) => `apextrade_legacy_import_dismissed:${userId}`;

export const needsLegacyImport = (userId: string) => {
  if (localStorage.getItem(LEGACY_MIGRATION_OWNER_KEY) || localStorage.getItem(dismissedKey(userId))) return false;
  return LEGACY_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
};

export const importLegacyDataForUser = (userId: string) => {
  if (localStorage.getItem(LEGACY_MIGRATION_OWNER_KEY)) return 0;

  let importedKeys = 0;
  for (const key of LEGACY_STORAGE_KEYS) {
    const legacyValue = localStorage.getItem(key);
    const accountKey = userStorageKey(key, userId);
    if (legacyValue !== null && localStorage.getItem(accountKey) === null) {
      localStorage.setItem(accountKey, legacyValue);
      importedKeys += 1;
    }
  }

  localStorage.setItem(LEGACY_MIGRATION_OWNER_KEY, userId);
  return importedKeys;
};

export const dismissLegacyImportForUser = (userId: string) => {
  localStorage.setItem(dismissedKey(userId), 'true');
};
