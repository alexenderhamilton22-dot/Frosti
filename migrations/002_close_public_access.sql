-- Only AFTER V1.0 is deployed and its login/stock/cron work. Mealio service_role preserved.
BEGIN;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freezers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_routing_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users,public.freezers,public.items,public.user_settings,public.alert_rules,public.categories,public.product_templates,public.storage_defaults,public.storage_routing_rules FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_users,public.freezers,public.items,public.user_settings,public.alert_rules,public.categories,public.product_templates,public.storage_defaults,public.storage_routing_rules TO service_role;
COMMIT;
