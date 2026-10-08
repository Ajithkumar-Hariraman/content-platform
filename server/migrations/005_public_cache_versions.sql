CREATE TABLE public_cache_versions (
  domain text PRIMARY KEY CHECK (domain IN ('PRODUCT', 'CONTENT')),
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0)
);
INSERT INTO public_cache_versions (domain) VALUES ('PRODUCT'), ('CONTENT');

CREATE FUNCTION advance_public_cache_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public_cache_versions SET generation = generation + 1 WHERE domain = TG_ARGV[0];
  RETURN NULL;
END;
$$;

CREATE TRIGGER products_cache_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON products
  FOR EACH STATEMENT EXECUTE FUNCTION advance_public_cache_version('PRODUCT');
CREATE TRIGGER categories_cache_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON categories
  FOR EACH STATEMENT EXECUTE FUNCTION advance_public_cache_version('PRODUCT');
CREATE TRIGGER contents_cache_version AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON contents
  FOR EACH STATEMENT EXECUTE FUNCTION advance_public_cache_version('CONTENT');
