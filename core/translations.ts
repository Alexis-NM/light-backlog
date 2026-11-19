const en = {
  // Tabs

  // Generic
  delete: "Delete",
  remove: "Remove",
  done: "Done",
  loading: "Loading…",
  error: "Error",
  network_error: "Network error. Check your connection.",
  storage_unreadable_hint:
    "Nothing was erased. Restart the app; if it stays this way, restore a backup.",
  storage_save_failed:
    "A change could not be saved. Export a backup from Settings before closing the app.",

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
  library_unreadable: "Your library could not be read",
  library_selected: "{count} selected",
  library_remove_confirm: "Remove the selected games from your library?",

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
  game_rating: "My rating",
  game_rating_users: "Users",
  game_rating_critics: "Critics",
  game_description: "Description",
  game_images: "Screenshots",
  game_add_to_list: "Add to a list",
  game_remove: "Remove from library",
  game_remove_confirm: "Remove this game from your library?",

  // Games browse
  games_title: "Games",
  games_choose_console: "Browse by console",
  games_no_creds: "IGDB credentials required",
  games_no_creds_hint:
    "Add your IGDB credentials in Settings to browse and search games, or set up sync with a server that has its own.",
  games_set_up: "Set up credentials",

  // Lists
  lists_title: "Lists",
  lists_empty: "No lists yet",
  lists_empty_hint: "Create a list to group games your way.",
  lists_unreadable: "Your lists could not be read",
  list_new: "New list",
  list_name_placeholder: "List name…",
  list_delete_confirm: "Delete this list? The games stay in your library.",
  list_remove_confirm: "Remove the selected games from this list?",
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
  import_source_label: "Paste the list (CSV / Markdown / one per line)",
  import_source_ph: "One game per line…",
  import_pick_file: "Pick a CSV/MD file",
  import_name_label: "List name",
  import_name_ph: "Imported list",
  import_to_library: "Also add to my library",
  import_run: "Import",
  import_matching: "Matching games… {done}/{total}",
  import_done: "Imported {imported} games ({notFound} not found)",
  import_interrupted:
    "Import interrupted: {imported} games imported, {remaining} titles not looked up.",
  import_unsearched: "Not looked up ({count})",
  import_empty: "No games found in the source.",
  import_error: "Could not read the list. Check the link or paste the text.",
  import_not_found: "Not found ({count})",
  import_check: "Worth checking ({count})",
  import_off_console: "not on the selected consoles",
  import_more: "+{count} more",
  list_consoles: "Consoles",
  list_sort: "Sort",
  list_add_all: "Add all to library",
  list_add_to_library: "Add to library",
  list_rename: "Rename list",
  list_options: "List options",
  list_move_up: "Move up",
  list_move_down: "Move down",

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
  settings_clear_library_confirm_synced:
    "Delete every game and list, here and on the sync server? This cannot be undone.",
  settings_creds_set: "Configured",
  settings_creds_not_set: "Not set",
  settings_creds_relay: "Via the server",
  settings_sort_library: "Library sort",
  settings_sort_lists: "List sort",
  settings_backup: "Backup",
  settings_sync: "Sync",
  settings_sync_off: "Off",
  settings_sync_on: "On",
  settings_sync_error: "Error",
  settings_sync_offline: "Offline",

  // Backup
  backup_title: "Backup",
  backup_intro:
    "Save your library, lists and settings to a single file, or restore them from a previous backup.",
  backup_include_credentials: "Include IGDB credentials",
  backup_export: "Export a backup",
  backup_import: "Restore a backup",
  backup_export_done: "Saved as {name}.",
  backup_export_error: "Could not save the backup.",
  backup_read_error: "Could not read the file.",
  backup_invalid: "This file is not a Backlog backup.",
  backup_restore_confirm:
    "Replace everything with this backup ({games} games, {lists} lists)? Current data will be lost.",
  backup_restore_confirm_synced:
    "Replace everything with this backup ({games} games, {lists} lists)? Current data will be lost, and sync will be turned off.",
  backup_restore: "Restore",
  backup_restore_done: "Backup restored.",
  backup_restore_error: "Could not restore the backup.",

  // Sync
  sync_title: "Sync",
  sync_intro:
    "Keep the same library and lists on several devices, through your own server. Without one, everything stays on this phone: there is no public server.",
  sync_address: "Server address",
  sync_address_ph: "https://…",
  sync_token: "Token",
  sync_token_ph: "Server token",
  sync_missing: "Enter the server address and the token.",
  sync_check: "Check the connection",
  sync_checking: "Checking…",
  sync_check_ok: "Connection OK.",
  sync_connect: "Connect",
  sync_connecting: "Connecting…",
  sync_connected_to: "Connected to {address}",
  sync_now: "Sync now",
  sync_syncing: "Syncing…",
  sync_last: "Last sync: {date}",
  sync_never: "Not synced yet.",
  sync_skipped: "{count} invalid items were not sent.",
  sync_disconnect: "Disconnect",
  sync_disconnect_confirm:
    "Stop syncing? Your library and lists stay on this phone.",
  sync_copy_restore: "Restore the copy",
  sync_copy_restore_confirm:
    "Replace everything with the copy made before the first sync? Sync will be turned off.",
  sync_copy_restored: "Copy restored.",
  sync_err_address: "The address must start with https://",
  sync_err_network: "Server unreachable. Changes will wait for the next sync.",
  sync_err_token: "The server refused the token.",
  sync_err_version: "The server expects another version of the app: update it.",
  sync_err_rejected: "The server refused the data.",
  sync_err_server: "The server returned an error.",
  sync_err_copy: "Could not save a copy of the data: nothing was sent.",

  // Sorting
  sort_alpha: "A-Z",
  sort_alpha_desc: "Z-A",
  sort_recent: "Recently added",
  sort_rating: "My rating",
  sort_igdb: "IGDB rating",

  // Credentials
  creds_title: "IGDB Credentials",
  creds_intro:
    "Backlog uses the IGDB database (by Twitch). Create a Twitch application to get a Client ID and Client Secret.",
  creds_client_id: "Client ID",
  creds_client_secret: "Client Secret",
  creds_client_id_ph: "Twitch Client ID",
  creds_client_secret_ph: "Twitch Client Secret",
  creds_save: "Save credentials",
  creds_clear: "Clear credentials",
  creds_help: "How to get credentials",
  creds_missing: "Enter both a Client ID and a Client Secret.",
  creds_invalid: "Could not authenticate. Check your credentials.",
  creds_order:
    "Without keys, Backlog goes through your sync server, if one is set: the server queries IGDB with its own keys. Keys entered here always come first.",
  creds_using_keys: "IGDB is queried directly, with these keys.",
  creds_using_relay: "IGDB is queried through {address}.",
  igdb_relay_refused: "The sync server refused the token.",

  // Language
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

  // Generic
  delete: "Supprimer",
  remove: "Retirer",
  done: "OK",
  loading: "Chargement…",
  error: "Erreur",
  network_error: "Erreur réseau. Vérifie ta connexion.",
  storage_unreadable_hint:
    "Rien n'a été effacé. Relance l'appli ; si rien ne change, restaure une sauvegarde.",
  storage_save_failed:
    "Un changement n'a pas pu être enregistré. Exporte une sauvegarde depuis les réglages avant de fermer l'appli.",

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
  library_unreadable: "Ta bibliothèque n'a pas pu être lue",
  library_selected: "{count} sélectionnés",
  library_remove_confirm: "Retirer les jeux sélectionnés de ta bibliothèque ?",

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
  game_rating: "Ma note",
  game_rating_users: "Joueurs",
  game_rating_critics: "Presse",
  game_description: "Description",
  game_images: "Images",
  game_add_to_list: "Ajouter à une liste",
  game_remove: "Retirer de la bibliothèque",
  game_remove_confirm: "Retirer ce jeu de ta bibliothèque ?",

  // Games browse
  games_title: "Jeux",
  games_choose_console: "Parcourir par console",
  games_no_creds: "Identifiants IGDB requis",
  games_no_creds_hint:
    "Ajoute tes identifiants IGDB dans les Réglages pour parcourir et chercher des jeux, ou configure la synchro avec un serveur qui a les siens.",
  games_set_up: "Configurer les identifiants",

  // Lists
  lists_title: "Listes",
  lists_empty: "Aucune liste",
  lists_empty_hint: "Crée une liste pour regrouper les jeux à ta façon.",
  lists_unreadable: "Tes listes n'ont pas pu être lues",
  list_new: "Nouvelle liste",
  list_name_placeholder: "Nom de la liste…",
  list_delete_confirm:
    "Supprimer cette liste ? Les jeux restent dans ta bibliothèque.",
  list_remove_confirm: "Retirer les jeux sélectionnés de cette liste ?",
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
  import_source_label: "Colle la liste (CSV / Markdown / un par ligne)",
  import_source_ph: "Un jeu par ligne…",
  import_pick_file: "Choisir un fichier CSV/MD",
  import_name_label: "Nom de la liste",
  import_name_ph: "Liste importée",
  import_to_library: "Ajouter aussi à ma bibliothèque",
  import_run: "Importer",
  import_matching: "Recherche des jeux… {done}/{total}",
  import_done: "{imported} jeux importés ({notFound} introuvables)",
  import_interrupted:
    "Import interrompu : {imported} jeux importés, {remaining} titres non cherchés.",
  import_unsearched: "Non cherchés ({count})",
  import_empty: "Aucun jeu trouvé dans la source.",
  import_error:
    "Impossible de lire la liste. Vérifie le lien ou colle le texte.",
  import_not_found: "Introuvables ({count})",
  import_check: "À vérifier ({count})",
  import_off_console: "pas sur les consoles choisies",
  import_more: "+{count} de plus",
  list_consoles: "Consoles",
  list_sort: "Tri",
  list_add_all: "Tout ajouter à la bibliothèque",
  list_add_to_library: "Ajouter à la bibliothèque",
  list_rename: "Renommer la liste",
  list_options: "Options de la liste",
  list_move_up: "Monter",
  list_move_down: "Descendre",

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
  settings_clear_library_confirm_synced:
    "Supprimer tous les jeux et listes, ici et sur le serveur de synchro ? Action irréversible.",
  settings_creds_set: "Configurés",
  settings_creds_not_set: "Non définis",
  settings_creds_relay: "Via le serveur",
  settings_sort_library: "Tri biblio",
  settings_sort_lists: "Tri listes",
  settings_backup: "Sauvegarde",
  settings_sync: "Synchronisation",
  settings_sync_off: "Désactivée",
  settings_sync_on: "Activée",
  settings_sync_error: "Erreur",
  settings_sync_offline: "Hors ligne",

  // Backup
  backup_title: "Sauvegarde",
  backup_intro:
    "Enregistre ta bibliothèque, tes listes et tes réglages dans un fichier unique, ou restaure-les depuis une sauvegarde précédente.",
  backup_include_credentials: "Inclure les identifiants IGDB",
  backup_export: "Exporter une sauvegarde",
  backup_import: "Restaurer une sauvegarde",
  backup_export_done: "Enregistré sous {name}.",
  backup_export_error: "Impossible d'enregistrer la sauvegarde.",
  backup_read_error: "Impossible de lire le fichier.",
  backup_invalid: "Ce fichier n'est pas une sauvegarde Backlog.",
  backup_restore_confirm:
    "Tout remplacer par cette sauvegarde ({games} jeux, {lists} listes) ? Les données actuelles seront perdues.",
  backup_restore_confirm_synced:
    "Tout remplacer par cette sauvegarde ({games} jeux, {lists} listes) ? Les données actuelles seront perdues, et la synchro sera coupée.",
  backup_restore: "Restaurer",
  backup_restore_done: "Sauvegarde restaurée.",
  backup_restore_error: "Impossible de restaurer la sauvegarde.",

  // Sync
  sync_title: "Synchronisation",
  sync_intro:
    "Garde la même bibliothèque et les mêmes listes sur plusieurs appareils, à travers ton propre serveur. Sans serveur, tout reste sur ce téléphone : il n'existe pas de serveur public.",
  sync_address: "Adresse du serveur",
  sync_address_ph: "https://…",
  sync_token: "Jeton",
  sync_token_ph: "Jeton du serveur",
  sync_missing: "Saisis l'adresse du serveur et le jeton.",
  sync_check: "Vérifier la connexion",
  sync_checking: "Vérification…",
  sync_check_ok: "Connexion réussie.",
  sync_connect: "Connecter",
  sync_connecting: "Connexion…",
  sync_connected_to: "Connecté à {address}",
  sync_now: "Synchroniser",
  sync_syncing: "Synchronisation…",
  sync_last: "Dernière synchro : {date}",
  sync_never: "Pas encore synchronisé.",
  sync_skipped: "{count} éléments invalides n'ont pas été envoyés.",
  sync_disconnect: "Déconnecter",
  sync_disconnect_confirm:
    "Arrêter la synchro ? Ta bibliothèque et tes listes restent sur ce téléphone.",
  sync_copy_restore: "Restaurer la copie",
  sync_copy_restore_confirm:
    "Tout remplacer par la copie faite avant la première synchro ? La synchro sera coupée.",
  sync_copy_restored: "Copie restaurée.",
  sync_err_address: "L'adresse doit commencer par https://",
  sync_err_network:
    "Serveur injoignable. Les changements attendront la prochaine synchro.",
  sync_err_token: "Le serveur refuse le jeton.",
  sync_err_version:
    "Le serveur attend une autre version de l'appli : mets-la à jour.",
  sync_err_rejected: "Le serveur a refusé les données.",
  sync_err_server: "Le serveur a renvoyé une erreur.",
  sync_err_copy:
    "Impossible d'enregistrer une copie des données : rien n'a été envoyé.",

  // Sorting
  sort_alpha: "A-Z",
  sort_alpha_desc: "Z-A",
  sort_recent: "Récemment ajouté",
  sort_rating: "Ma note",
  sort_igdb: "Note IGDB",

  // Credentials
  creds_title: "Identifiants IGDB",
  creds_intro:
    "Backlog utilise la base IGDB (par Twitch). Crée une application Twitch pour obtenir un Client ID et un Client Secret.",
  creds_client_id: "Client ID",
  creds_client_secret: "Client Secret",
  creds_client_id_ph: "Client ID Twitch",
  creds_client_secret_ph: "Client Secret Twitch",
  creds_save: "Enregistrer les identifiants",
  creds_clear: "Effacer les identifiants",
  creds_help: "Comment obtenir des identifiants",
  creds_missing: "Saisis un Client ID et un Client Secret.",
  creds_invalid: "Authentification impossible. Vérifie tes identifiants.",
  creds_order:
    "Sans clés, Backlog passe par ton serveur de synchro s'il est configuré : c'est lui qui interroge IGDB, avec ses propres clés. Les clés saisies ici passent toujours en premier.",
  creds_using_keys: "IGDB est interrogé directement, avec ces clés.",
  creds_using_relay: "IGDB est interrogé via {address}.",
  igdb_relay_refused: "Le serveur de synchro refuse le jeton.",

  // Language
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
