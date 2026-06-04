CREATE TABLE IF NOT EXISTS token_blacklist (
  token_hash TEXT PRIMARY KEY,
  blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_blacklisted_at ON token_blacklist(blacklisted_at);

CREATE OR REPLACE FUNCTION clean_expired_blacklist()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM token_blacklist WHERE blacklisted_at < NOW() - INTERVAL '24 hours';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_expired_blacklist ON token_blacklist;
CREATE TRIGGER trg_clean_expired_blacklist
AFTER INSERT ON token_blacklist
FOR EACH STATEMENT EXECUTE FUNCTION clean_expired_blacklist();
