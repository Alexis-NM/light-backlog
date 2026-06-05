const en = {
  // Tabs
  tab_library: "Library",
  tab_games: "Games",
  tab_lists: "Lists",
  tab_settings: "Settings",

  // Generic
  save: "Save",
  cancel: "Cancel",
  create: "Create",
  delete: "Delete",
  remove: "Remove",
  done: "Done",
  loading: "Loading…",
  retry: "Retry",
  error: "Error",
  network_error: "Network error. Check your connection.",

  // Statuses
  status_playing: "Playing",
  status_played: "Played",
  status_backlog: "Backlog",
  status_wishlist: "Wishlist",
  filter_all: "All",

  // Library
  library_title: "Library",
  library_empty: "Your library is empty",
  library_empty_hint: "Search for games to start tracking them.",
  library_count: "{count} games",

  // Search
  search_title: "Search",
  search_placeholder: "Search games…",
  search_empty: "Find a game to add it to your library.",
  search_searching: "Searching…",
  search_no_results: "No games found.",

  // Game detail
  game_unrated: "Not rated",
  game_platforms: "Platforms",
  game_set_status: "Status",
  game_rating: "Rating",
  game_description: "Description",
  game_images: "Screenshots",
  game_lists: "Lists",
  game_add_to_list: "Add to a list",
  game_remove: "Remove from library",
  game_remove_confirm: "Remove this game from your library?",
  game_not_in_library: "Not in your library yet.",

  // Games browse
  games_title: "Games",
  games_choose_console: "Browse by console",
  games_popular_on: "Popular on {platform}",
  games_no_creds: "IGDB credentials required",
  games_no_creds_hint:
    "Add your IGDB credentials in Settings to browse and search games.",
  games_set_up: "Set up credentials",

  // Lists
  lists_title: "Lists",
  lists_empty: "No lists yet",
  lists_empty_hint: "Create a list to group games your way.",
  list_new: "New list",
  list_name_placeholder: "List name…",
  list_delete_confirm: "Delete this list? The games stay in your library.",
  list_empty: "This list is empty.",
  list_count: "{count} games",
  list_add_to: "Add to a list",
  list_added: "Added",
  list_remove_from: "Remove from list",
  list_pick: "Pick a list",
  list_none: "You have no lists yet.",

  // Import
  list_import: "Import",
  import_title: "Import a list",
  import_source_label: "Backloggd URL, raw CSV/MD link, or pasted list",
  import_source_ph: "https://backloggd.com/u/…/list/…",
  import_name_label: "List name",
  import_name_ph: "Imported list",
  import_to_library: "Also add to my library",
  import_run: "Import",
  import_fetching: "Fetching the list…",
  import_matching: "Matching games… {done}/{total}",
  import_done: "Imported {imported} games ({notFound} not found)",
  import_empty: "No games found in the source.",
  import_error: "Could not read the list. Check the link or paste the text.",

  // Settings
  settings_title: "Settings",
  settings_credentials: "IGDB Credentials",
  settings_customise: "Customise",
  settings_interface: "Interface",
  settings_language: "Language",
  settings_invert_colours: "Invert Colours",
  settings_clear_library: "Clear Library",
  settings_clear_library_confirm:
    "Delete every game and list? This cannot be undone.",
  settings_creds_set: "Configured",
  settings_creds_not_set: "Not set",

  // Credentials
  creds_title: "IGDB Credentials",
  creds_intro:
    "Backlog uses the IGDB database (by Twitch). Create a Twitch application to get a Client ID and Client Secret.",
  creds_client_id: "Client ID",
  creds_client_secret: "Client Secret",
  creds_client_id_ph: "Twitch Client ID",
  creds_client_secret_ph: "Twitch Client Secret",
  creds_save: "Save credentials",
  creds_saved: "Credentials saved.",
  creds_clear: "Clear credentials",
  creds_help: "How to get credentials",
  creds_missing: "Enter both a Client ID and a Client Secret.",
  creds_invalid: "Could not authenticate. Check your credentials.",

  // Language
  language_title: "Language",
  language_en: "English",
  language_fr: "Français",

  // Console families
  family_playstation: "PlayStation",
  family_xbox: "Xbox",
  family_nintendo: "Nintendo",
  family_sega: "Sega",
  family_pc: "PC",
  family_mobile: "Mobile",
  family_retro: "Retro & Arcade",
  family_other: "Other",
} as const;

export type TranslationKey = keyof typeof en;

const fr: Record<TranslationKey, string> = {
  // Tabs
  tab_library: "Biblio",
  tab_games: "Jeux",
  tab_lists: "Listes",
  tab_settings: "Réglages",

  // Generic
  save: "Enregistrer",
  cancel: "Annuler",
  create: "Créer",
  delete: "Supprimer",
  remove: "Retirer",
  done: "OK",
  loading: "Chargement…",
  retry: "Réessayer",
  error: "Erreur",
  network_error: "Erreur réseau. Vérifie ta connexion.",

  // Statuses
  status_playing: "En cours",
  status_played: "Terminé",
  status_backlog: "À jouer",
  status_wishlist: "Envies",
  filter_all: "Tous",

  // Library
  library_title: "Bibliothèque",
  library_empty: "Ta bibliothèque est vide",
  library_empty_hint: "Cherche des jeux pour commencer à les suivre.",
  library_count: "{count} jeux",

  // Search
  search_title: "Recherche",
  search_placeholder: "Chercher un jeu…",
  search_empty: "Trouve un jeu pour l'ajouter à ta bibliothèque.",
  search_searching: "Recherche…",
  search_no_results: "Aucun jeu trouvé.",

  // Game detail
  game_unrated: "Non noté",
  game_platforms: "Plateformes",
  game_set_status: "Statut",
  game_rating: "Note",
  game_description: "Description",
  game_images: "Images",
  game_lists: "Listes",
  game_add_to_list: "Ajouter à une liste",
  game_remove: "Retirer de la bibliothèque",
  game_remove_confirm: "Retirer ce jeu de ta bibliothèque ?",
  game_not_in_library: "Pas encore dans ta bibliothèque.",

  // Games browse
  games_title: "Jeux",
  games_choose_console: "Parcourir par console",
  games_popular_on: "Populaires sur {platform}",
  games_no_creds: "Identifiants IGDB requis",
  games_no_creds_hint:
    "Ajoute tes identifiants IGDB dans les Réglages pour parcourir et chercher des jeux.",
  games_set_up: "Configurer les identifiants",

  // Lists
  lists_title: "Listes",
  lists_empty: "Aucune liste",
  lists_empty_hint: "Crée une liste pour regrouper les jeux à ta façon.",
  list_new: "Nouvelle liste",
  list_name_placeholder: "Nom de la liste…",
  list_delete_confirm:
    "Supprimer cette liste ? Les jeux restent dans ta bibliothèque.",
  list_empty: "Cette liste est vide.",
  list_count: "{count} jeux",
  list_add_to: "Ajouter à une liste",
  list_added: "Ajouté",
  list_remove_from: "Retirer de la liste",
  list_pick: "Choisis une liste",
  list_none: "Tu n'as pas encore de liste.",

  // Import
  list_import: "Importer",
  import_title: "Importer une liste",
  import_source_label: "URL Backloggd, lien CSV/MD brut, ou liste collée",
  import_source_ph: "https://backloggd.com/u/…/list/…",
  import_name_label: "Nom de la liste",
  import_name_ph: "Liste importée",
  import_to_library: "Ajouter aussi à ma bibliothèque",
  import_run: "Importer",
  import_fetching: "Récupération de la liste…",
  import_matching: "Recherche des jeux… {done}/{total}",
  import_done: "{imported} jeux importés ({notFound} introuvables)",
  import_empty: "Aucun jeu trouvé dans la source.",
  import_error:
    "Impossible de lire la liste. Vérifie le lien ou colle le texte.",

  // Settings
  settings_title: "Réglages",
  settings_credentials: "Identifiants IGDB",
  settings_customise: "Personnaliser",
  settings_interface: "Interface",
  settings_language: "Langue",
  settings_invert_colours: "Inverser les couleurs",
  settings_clear_library: "Vider la bibliothèque",
  settings_clear_library_confirm:
    "Supprimer tous les jeux et listes ? Action irréversible.",
  settings_creds_set: "Configurés",
  settings_creds_not_set: "Non définis",

  // Credentials
  creds_title: "Identifiants IGDB",
  creds_intro:
    "Backlog utilise la base IGDB (par Twitch). Crée une application Twitch pour obtenir un Client ID et un Client Secret.",
  creds_client_id: "Client ID",
  creds_client_secret: "Client Secret",
  creds_client_id_ph: "Client ID Twitch",
  creds_client_secret_ph: "Client Secret Twitch",
  creds_save: "Enregistrer les identifiants",
  creds_saved: "Identifiants enregistrés.",
  creds_clear: "Effacer les identifiants",
  creds_help: "Comment obtenir des identifiants",
  creds_missing: "Saisis un Client ID et un Client Secret.",
  creds_invalid: "Authentification impossible. Vérifie tes identifiants.",

  // Language
  language_title: "Langue",
  language_en: "English",
  language_fr: "Français",

  // Console families
  family_playstation: "PlayStation",
  family_xbox: "Xbox",
  family_nintendo: "Nintendo",
  family_sega: "Sega",
  family_pc: "PC",
  family_mobile: "Mobile",
  family_retro: "Rétro & Arcade",
  family_other: "Autres",
};

export const translations = { en, fr } as const;

export type Language = keyof typeof translations;
