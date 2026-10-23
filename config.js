/* The only file you edit to switch between demo storage and a real database. */
window.TAP_CONFIG = {
  /* "demo"     = records are kept in this browser (localStorage). Good for trying things out.
     "supabase" = records are saved in your Supabase project (see supabase.sql). */
  MODE: "supabase",

  /* The address that gets written to each NFC tag. The client's slug is added at the end. */
  CARD_BASE: "https://tap-card.kyrellbangot9.workers.dev/card",

  /* Only used when MODE is "supabase". The anon key is safe to publish; row-level security protects writes. */
  SUPABASE_URL: "https://ykiicildyuailqvfxmoo.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_GFPhdIXvXOZ1cPZEa8sMmw_JIl9FTQa"
};
