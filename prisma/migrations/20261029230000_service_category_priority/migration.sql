WITH preferred(slug, position) AS (
  SELECT * FROM unnest(ARRAY[
    'svc_ac_repair','svc_electrician','svc_plumber','svc_fridge_repair','svc_washer_repair',
    'svc_stove_repair','svc_heating_repair','svc_cleaner','svc_house_painter','svc_cabinet_maker',
    'svc_mason','svc_plasterer','svc_tiler','svc_welder','svc_pc_repair','svc_phone_repair',
    'svc_elevator_service','svc_mover','svc_pest_control','svc_gardener','svc_tire_repair',
    'svc_auto_body','svc_motorcycle_repair','svc_tailor','svc_shoe_repair','svc_watch_repair',
    'svc_babysitter','svc_elder_care','svc_private_tutor','svc_photographer','svc_sign_maker',
    'svc_translator','svc_car_wash','svc_barber','svc_other'
  ]::text[]) WITH ORDINALITY
)
UPDATE "business_categories" AS category
SET "sort_order" = preferred.position
FROM preferred
WHERE category."slug" = preferred.slug AND category."is_service" = true;
