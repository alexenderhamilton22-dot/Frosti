export interface Equipment {
  id: string;
  user_id: string;
  name: string;
  is_fridge: boolean;
  archived_at: string | null;
}
export interface Item {
  id: string;
  user_id: string;
  congelo_id: string;
  produit: string;
  categorie: string;
  qte: number;
  unite: string;
  date_entree: string | null;
  date_peremption: string | null;
  date_kind?: "declared" | "estimated";
  notes: string | null;
  version: number;
}
export interface Category {
  id: string;
  name: string;
}
export interface Template {
  id: string;
  category_id: string;
  name: string;
}
export interface Rule {
  categorie: string;
  fridge_days: number | null;
  freezer_days: number | null;
  fridge_default_days?: number | null;
  freezer_default_days?: number | null;
}
export interface Settings {
  ntfy_topic: string | null;
  dlc_warning_days: number;
}
export interface Bootstrap {
  archive_enabled: boolean;
  username: string;
  items: Item[];
  equipments: Equipment[];
  categories: Category[];
  templates: Template[];
  rules: Rule[];
  settings: Settings;
  synchronizedAt: string;
}
export interface Movement {
  id: string;
  operation_id: string;
  kind: string;
  origin: string;
  item_id: string;
  before_row: Item | null;
  after_row: Item | null;
  undone_by: string | null;
  created_at: string;
}
