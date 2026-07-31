-- ============ FOOD DATABASE ============
CREATE TABLE IF NOT EXISTS public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  food_type text NOT NULL DEFAULT 'ingredient', -- ingredient | recipe | packaged | restaurant
  category text NOT NULL DEFAULT 'Other',       -- Grains, Legumes, Dairy, Vegetables, Fruit, Meat, Snack...
  cuisine text,                                  -- Indian, South Indian, Punjabi, Italian, Mexican...
  region text,                                   -- India, Global, USA...
  serving_desc text NOT NULL DEFAULT '100 g',
  serving_grams numeric NOT NULL DEFAULT 100,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric NOT NULL DEFAULT 0,
  sugar numeric,
  sodium_mg numeric,
  micros jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {"iron_mg":2.1,"calcium_mg":180,...}
  allergens text[] NOT NULL DEFAULT '{}',
  diet_tags text[] NOT NULL DEFAULT '{}',        -- vegetarian, vegan, eggetarian, non-vegetarian, jain, gluten-free
  ingredients text[] NOT NULL DEFAULT '{}',
  recipe_steps text[] NOT NULL DEFAULT '{}',
  est_cost numeric,                              -- per serving, local currency
  barcode text,
  data_source text NOT NULL DEFAULT 'Unverified',
  source_url text,
  confidence text NOT NULL DEFAULT 'medium',     -- high | medium | low
  verified boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS foods_name_idx ON public.foods USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS foods_category_idx ON public.foods (category);
CREATE INDEX IF NOT EXISTS foods_cuisine_idx ON public.foods (cuisine);
CREATE INDEX IF NOT EXISTS foods_barcode_idx ON public.foods (barcode);

GRANT SELECT ON public.foods TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read foods" ON public.foods
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can add foods" ON public.foods
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can edit own foods" ON public.foods
  FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete own foods" ON public.foods
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_foods_updated_at BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TARGET ADJUSTMENT HISTORY ============
CREATE TABLE IF NOT EXISTS public.plan_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  applied_on date NOT NULL DEFAULT current_date,
  old_calories integer,
  new_calories integer,
  old_protein integer,
  new_protein integer,
  adherence_pct integer,
  trend_kg_per_week numeric,
  reason text NOT NULL,
  safety_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_adjustments TO authenticated;
GRANT ALL ON public.plan_adjustments TO service_role;
ALTER TABLE public.plan_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan adjustments" ON public.plan_adjustments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SEED: starter verified-reference foods ============
INSERT INTO public.foods (name, food_type, category, cuisine, region, serving_desc, serving_grams, calories, protein, carbs, fat, fiber, micros, allergens, diet_tags, est_cost, data_source, confidence, verified) VALUES
-- Indian staples
('Roti (whole wheat chapati)','ingredient','Grains','North Indian','India','1 roti (40 g)',40,104,3.1,20.5,1.2,3.0,'{"iron_mg":1.2,"magnesium_mg":38}','{"Wheat/Gluten"}','{vegetarian,vegan,eggetarian,non-vegetarian}',5,'IFCT 2017 (NIN, ICMR)','high',true),
('Steamed white rice','ingredient','Grains','Indian','India','1 cup cooked (150 g)',150,195,4.0,43.0,0.4,0.6,'{"folate_ug":58}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',8,'IFCT 2017 (NIN, ICMR)','high',true),
('Brown rice, cooked','ingredient','Grains','Global','Global','1 cup cooked (150 g)',150,166,3.8,34.5,1.3,2.1,'{"magnesium_mg":63}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',12,'USDA FoodData Central','high',true),
('Toor dal (cooked)','recipe','Legumes','Indian','India','1 katori (150 g)',150,168,9.0,26.0,2.4,6.0,'{"iron_mg":1.9,"folate_ug":110}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain}',12,'IFCT 2017 (NIN, ICMR)','high',true),
('Rajma masala','recipe','Legumes','Punjabi','India','1 katori (200 g)',200,245,11.5,32.0,7.5,9.0,'{"iron_mg":3.1,"potassium_mg":620}','{}','{vegetarian,vegan,eggetarian,non-vegetarian}',30,'IFCT 2017 + recipe estimate','medium',false),
('Chole (chickpea curry)','recipe','Legumes','Punjabi','India','1 katori (200 g)',200,268,11.0,35.0,9.0,10.0,'{"iron_mg":3.4,"folate_ug":170}','{}','{vegetarian,vegan,eggetarian,non-vegetarian}',30,'IFCT 2017 + recipe estimate','medium',false),
('Idli','recipe','Grains','South Indian','India','2 idli (120 g)',120,142,4.6,29.0,0.5,1.4,'{"folate_ug":22}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',20,'IFCT 2017 (NIN, ICMR)','high',true),
('Masala dosa','recipe','Grains','South Indian','India','1 dosa (150 g)',150,285,6.0,42.0,10.0,3.2,'{"potassium_mg":330}','{}','{vegetarian,eggetarian,non-vegetarian}',45,'IFCT 2017 + recipe estimate','medium',false),
('Sambar','recipe','Legumes','South Indian','India','1 katori (200 g)',200,145,7.0,20.0,4.2,5.0,'{"iron_mg":1.8,"vitamin_c_mg":12}','{}','{vegetarian,vegan,eggetarian,non-vegetarian}',18,'IFCT 2017 + recipe estimate','medium',false),
('Poha (flattened rice, cooked)','recipe','Grains','Maharashtrian','India','1 plate (180 g)',180,270,5.0,48.0,7.0,2.5,'{"iron_mg":2.7}','{"Peanuts"}','{vegetarian,vegan,eggetarian,non-vegetarian}',20,'IFCT 2017 + recipe estimate','medium',false),
('Upma','recipe','Grains','South Indian','India','1 plate (200 g)',200,290,6.5,44.0,9.5,3.0,'{"magnesium_mg":45}','{"Wheat/Gluten"}','{vegetarian,eggetarian,non-vegetarian}',20,'IFCT 2017 + recipe estimate','medium',false),
('Paneer (fresh, whole milk)','ingredient','Dairy','Indian','India','100 g',100,296,18.3,3.6,23.0,0,'{"calcium_mg":420}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,jain}',40,'IFCT 2017 (NIN, ICMR)','high',true),
('Palak paneer','recipe','Vegetables','North Indian','India','1 katori (200 g)',200,290,14.0,10.0,22.0,4.0,'{"iron_mg":3.2,"calcium_mg":380,"vitamin_a_ug":520}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian}',60,'IFCT 2017 + recipe estimate','medium',false),
('Curd / dahi (whole milk)','ingredient','Dairy','Indian','India','1 katori (150 g)',150,90,5.3,7.0,4.8,0,'{"calcium_mg":225,"b12_ug":0.6}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,jain}',15,'IFCT 2017 (NIN, ICMR)','high',true),
('Buffalo milk (toned)','ingredient','Dairy','Indian','India','1 glass (250 ml)',250,148,8.0,12.0,7.5,0,'{"calcium_mg":300,"b12_ug":1.1}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,jain}',18,'IFCT 2017 (NIN, ICMR)','high',true),
('Tandoori chicken (leg)','recipe','Meat','Punjabi','India','1 leg (150 g)',150,246,31.0,3.0,12.0,0.4,'{"iron_mg":1.4,"b12_ug":0.5,"zinc_mg":2.2}','{"Dairy"}','{non-vegetarian}',90,'IFCT 2017 + recipe estimate','medium',false),
('Chicken breast, grilled','ingredient','Meat','Global','Global','100 g',100,165,31.0,0,3.6,0,'{"b12_ug":0.3,"zinc_mg":1.0,"selenium_ug":22}','{}','{non-vegetarian}',60,'USDA FoodData Central','high',true),
('Egg, boiled','ingredient','Eggs','Global','Global','1 large egg (50 g)',50,78,6.3,0.6,5.3,0,'{"b12_ug":0.6,"choline_mg":147,"vitamin_d_ug":1.1}','{"Eggs"}','{eggetarian,non-vegetarian,gluten-free}',7,'USDA FoodData Central','high',true),
('Rohu fish curry','recipe','Fish','Bengali','India','1 katori (200 g)',200,235,24.0,6.0,12.0,1.2,'{"omega3_mg":420,"b12_ug":1.4}','{"Fish"}','{non-vegetarian}',80,'IFCT 2017 + recipe estimate','medium',false),
('Moong dal khichdi','recipe','Grains','Indian','India','1 bowl (250 g)',250,310,12.0,52.0,6.0,6.5,'{"iron_mg":2.4}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain}',25,'IFCT 2017 + recipe estimate','medium',false),
('Sprouted moong salad','recipe','Legumes','Indian','India','1 katori (100 g)',100,120,8.0,18.0,0.6,7.0,'{"vitamin_c_mg":18,"folate_ug":95}','{}','{vegetarian,vegan,eggetarian,non-vegetarian}',15,'IFCT 2017','high',true),
('Ragi (finger millet) porridge','recipe','Grains','South Indian','India','1 bowl (250 g)',250,215,6.0,42.0,2.0,4.5,'{"calcium_mg":300,"iron_mg":3.0}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',18,'IFCT 2017 (NIN, ICMR)','high',true),
('Bajra roti','ingredient','Grains','Rajasthani','India','1 roti (50 g)',50,180,5.0,32.0,3.0,4.0,'{"iron_mg":2.2,"magnesium_mg":68}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',6,'IFCT 2017 (NIN, ICMR)','high',true),
('Aloo paratha','recipe','Grains','Punjabi','India','1 paratha (120 g)',120,330,7.0,45.0,13.0,4.0,'{"potassium_mg":420}','{"Wheat/Gluten","Dairy"}','{vegetarian,eggetarian,non-vegetarian}',30,'IFCT 2017 + recipe estimate','medium',false),
('Pav bhaji','recipe','Street food','Maharashtrian','India','1 plate (300 g)',300,480,11.0,62.0,20.0,8.0,'{"vitamin_c_mg":45,"sodium_mg":980}','{"Wheat/Gluten","Dairy"}','{vegetarian,eggetarian,non-vegetarian}',70,'Recipe estimate','low',false),
('Samosa','restaurant','Snack','Indian','India','1 piece (60 g)',60,205,3.5,24.0,10.5,2.0,'{"sodium_mg":300}','{"Wheat/Gluten"}','{vegetarian,eggetarian,non-vegetarian}',20,'Recipe estimate','low',false),
('Dhokla','recipe','Snack','Gujarati','India','2 pieces (100 g)',100,160,6.0,24.0,4.0,2.5,'{"folate_ug":45}','{}','{vegetarian,eggetarian,non-vegetarian,jain}',25,'IFCT 2017 + recipe estimate','medium',false),
('Banana','ingredient','Fruit','Global','Global','1 medium (118 g)',118,105,1.3,27.0,0.4,3.1,'{"potassium_mg":422,"vitamin_b6_mg":0.4}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',10,'USDA FoodData Central','high',true),
('Apple','ingredient','Fruit','Global','Global','1 medium (182 g)',182,95,0.5,25.0,0.3,4.4,'{"vitamin_c_mg":8.4}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',25,'USDA FoodData Central','high',true),
('Guava','ingredient','Fruit','Indian','India','1 medium (100 g)',100,68,2.6,14.3,1.0,5.4,'{"vitamin_c_mg":228}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',15,'IFCT 2017 (NIN, ICMR)','high',true),
('Spinach (palak), cooked','ingredient','Vegetables','Global','Global','1 katori (100 g)',100,41,2.9,4.0,0.5,2.4,'{"iron_mg":2.7,"vitamin_a_ug":470,"folate_ug":146}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',12,'IFCT 2017 (NIN, ICMR)','high',true),
('Almonds','ingredient','Nuts','Global','Global','10 pieces (12 g)',12,70,2.6,2.4,6.0,1.5,'{"vitamin_e_mg":3.1,"magnesium_mg":32}','{"Tree Nuts"}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',15,'USDA FoodData Central','high',true),
('Peanuts, roasted','ingredient','Nuts','Global','Global','30 g',30,170,7.3,4.8,14.0,2.6,'{"niacin_mg":3.8,"magnesium_mg":50}','{"Peanuts"}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',8,'USDA FoodData Central','high',true),
('Whey protein isolate','packaged','Supplement','Global','Global','1 scoop (30 g)',30,110,25.0,1.0,0.5,0,'{"calcium_mg":120}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,gluten-free}',70,'Typical label values — verify your product','medium',false),
('Oats, rolled (dry)','ingredient','Grains','Global','Global','40 g',40,150,5.3,27.0,2.6,4.0,'{"magnesium_mg":55,"iron_mg":1.7}','{"Wheat/Gluten"}','{vegetarian,vegan,eggetarian,non-vegetarian}',12,'USDA FoodData Central','high',true),
('Greek yogurt, plain low-fat','packaged','Dairy','Global','Global','1 cup (170 g)',170,100,17.0,6.0,0.7,0,'{"calcium_mg":187,"b12_ug":0.8}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,gluten-free}',60,'USDA FoodData Central','high',true),
('Tofu, firm','ingredient','Legumes','Global','Global','100 g',100,144,17.3,2.8,8.7,2.3,'{"calcium_mg":350,"iron_mg":2.7}','{"Soy"}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',45,'USDA FoodData Central','high',true),
('Soya chunks (dry)','packaged','Legumes','Indian','India','30 g',30,105,15.6,10.0,0.2,3.9,'{"iron_mg":6.0}','{"Soy"}','{vegetarian,vegan,eggetarian,non-vegetarian}',10,'Typical label values — verify your product','medium',false),
('Grilled salmon','ingredient','Fish','Global','Global','100 g',100,206,22.0,0,13.0,0,'{"omega3_mg":2300,"vitamin_d_ug":13,"b12_ug":2.8}','{"Fish"}','{non-vegetarian,gluten-free}',350,'USDA FoodData Central','high',true),
('Whole wheat pasta, cooked','ingredient','Grains','Italian','Global','1 cup (140 g)',140,174,7.5,37.0,0.8,4.5,'{"magnesium_mg":42}','{"Wheat/Gluten"}','{vegetarian,vegan,eggetarian,non-vegetarian}',40,'USDA FoodData Central','high',true),
('Margherita pizza slice','restaurant','Fast food','Italian','Global','1 slice (120 g)',120,285,12.0,36.0,10.0,2.0,'{"sodium_mg":640,"calcium_mg":200}','{"Wheat/Gluten","Dairy"}','{vegetarian,eggetarian,non-vegetarian}',120,'Restaurant estimate — verify with the outlet','low',false),
('Chicken burger (fast food)','restaurant','Fast food','American','Global','1 burger (200 g)',200,510,25.0,45.0,26.0,2.5,'{"sodium_mg":1050}','{"Wheat/Gluten","Eggs"}','{non-vegetarian}',180,'Restaurant estimate — verify with the outlet','low',false),
('Veg biryani','restaurant','Rice dish','Hyderabadi','India','1 plate (300 g)',300,480,10.0,72.0,16.0,6.0,'{"sodium_mg":820}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian}',150,'Restaurant estimate — verify with the outlet','low',false),
('Chicken biryani','restaurant','Rice dish','Hyderabadi','India','1 plate (350 g)',350,620,28.0,74.0,23.0,5.0,'{"sodium_mg":950,"zinc_mg":2.6}','{"Dairy"}','{non-vegetarian}',220,'Restaurant estimate — verify with the outlet','low',false),
('Instant noodles (masala)','packaged','Packaged','Indian','India','1 pack (70 g)',70,310,6.5,42.0,13.0,2.0,'{"sodium_mg":1200}','{"Wheat/Gluten"}','{vegetarian,eggetarian,non-vegetarian}',15,'Typical label values — verify your product','medium',false),
('Sweet lassi','recipe','Beverage','Punjabi','India','1 glass (250 ml)',250,220,7.0,32.0,6.5,0,'{"calcium_mg":260}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,jain}',40,'Recipe estimate','low',false),
('Coconut water','ingredient','Beverage','Global','Global','1 glass (240 ml)',240,46,1.7,8.9,0.5,2.6,'{"potassium_mg":600,"magnesium_mg":60}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',40,'USDA FoodData Central','high',true),
('Sweet potato, boiled','ingredient','Vegetables','Global','Global','150 g',150,135,2.5,31.0,0.2,4.5,'{"vitamin_a_ug":1100,"potassium_mg":500}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',20,'USDA FoodData Central','high',true),
('Quinoa, cooked','ingredient','Grains','South American','Global','1 cup (185 g)',185,222,8.1,39.0,3.6,5.2,'{"magnesium_mg":118,"iron_mg":2.8}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',70,'USDA FoodData Central','high',true),
('Chia seeds','ingredient','Seeds','Global','Global','15 g',15,73,2.5,6.3,4.6,5.2,'{"calcium_mg":95,"omega3_mg":2700}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',20,'USDA FoodData Central','high',true),
('Pumpkin seeds','ingredient','Seeds','Global','Global','20 g',20,113,5.9,3.0,9.8,1.3,'{"magnesium_mg":110,"zinc_mg":1.5,"iron_mg":1.7}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',18,'USDA FoodData Central','high',true),
('Jain aloo-free mix veg sabzi','recipe','Vegetables','Jain','India','1 katori (180 g)',180,165,4.0,18.0,8.5,5.0,'{"vitamin_c_mg":30}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain}',35,'Recipe estimate','low',false),
('Vegan chickpea buddha bowl','recipe','Bowl','Global','Global','1 bowl (400 g)',400,520,20.0,68.0,18.0,14.0,'{"iron_mg":5.2,"folate_ug":210}','{"Sesame"}','{vegetarian,vegan,eggetarian,non-vegetarian}',140,'Recipe estimate','medium',false),
('Grilled paneer tikka salad','recipe','Bowl','Indian','India','1 bowl (300 g)',300,395,24.0,18.0,26.0,5.0,'{"calcium_mg":480}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian}',110,'Recipe estimate','medium',false),
('Egg bhurji','recipe','Eggs','Indian','India','2 eggs (150 g)',150,245,14.0,6.0,18.0,1.2,'{"b12_ug":1.2,"vitamin_d_ug":2.2}','{"Eggs"}','{eggetarian,non-vegetarian,gluten-free}',35,'IFCT 2017 + recipe estimate','medium',false),
('Mutton curry','recipe','Meat','Indian','India','1 katori (200 g)',200,395,26.0,7.0,29.0,1.5,'{"iron_mg":3.4,"zinc_mg":4.5,"b12_ug":2.4}','{}','{non-vegetarian}',180,'IFCT 2017 + recipe estimate','medium',false),
('Prawn masala','recipe','Fish','Coastal Indian','India','1 katori (180 g)',180,240,26.0,8.0,11.0,1.0,'{"selenium_ug":45,"iodine_ug":35}','{"Shellfish"}','{non-vegetarian}',160,'IFCT 2017 + recipe estimate','medium',false),
('Fruit chaat','recipe','Fruit','Indian','India','1 bowl (200 g)',200,145,1.8,34.0,0.6,5.0,'{"vitamin_c_mg":65,"potassium_mg":480}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,jain,gluten-free}',45,'Recipe estimate','medium',false),
('Millet upma (foxtail)','recipe','Grains','South Indian','India','1 plate (200 g)',200,255,6.8,40.0,7.5,5.5,'{"iron_mg":2.5,"magnesium_mg":80}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',28,'IFCT 2017 + recipe estimate','medium',false),
('Peanut butter (natural)','packaged','Spread','Global','Global','1 tbsp (16 g)',16,95,3.6,3.2,8.0,1.0,'{"magnesium_mg":27,"niacin_mg":2.2}','{"Peanuts"}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',12,'Typical label values — verify your product','medium',false),
('Dark chocolate 70%','packaged','Snack','Global','Global','20 g',20,120,1.6,9.0,8.6,2.2,'{"iron_mg":2.4,"magnesium_mg":45}','{"Dairy","Soy"}','{vegetarian,eggetarian,non-vegetarian,gluten-free}',40,'Typical label values — verify your product','medium',false),
('Sourdough bread slice','packaged','Grains','Global','Global','1 slice (50 g)',50,130,5.0,25.0,0.8,1.5,'{"sodium_mg":320}','{"Wheat/Gluten"}','{vegetarian,vegan,eggetarian,non-vegetarian}',25,'Typical label values — verify your product','medium',false),
('Cottage cheese, low-fat','packaged','Dairy','Global','Global','100 g',100,72,12.4,2.7,1.0,0,'{"calcium_mg":83,"b12_ug":0.6}','{"Dairy"}','{vegetarian,eggetarian,non-vegetarian,gluten-free}',45,'USDA FoodData Central','high',true),
('Electrolyte drink (isotonic)','packaged','Beverage','Global','Global','500 ml',500,130,0,32.0,0,0,'{"sodium_mg":350,"potassium_mg":100}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',60,'Typical label values — verify your product','medium',false),
('Boiled corn (bhutta)','ingredient','Vegetables','Indian','India','1 cob (150 g)',150,155,5.0,33.0,2.0,3.6,'{"folate_ug":60}','{}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',25,'IFCT 2017 (NIN, ICMR)','high',true),
('Misal pav','restaurant','Street food','Maharashtrian','India','1 plate (350 g)',350,540,17.0,68.0,22.0,12.0,'{"iron_mg":4.2,"sodium_mg":1100}','{"Wheat/Gluten"}','{vegetarian,eggetarian,non-vegetarian}',80,'Restaurant estimate — verify with the outlet','low',false),
('Thepla','recipe','Grains','Gujarati','India','2 pieces (80 g)',80,215,5.5,30.0,8.0,4.2,'{"iron_mg":2.0}','{"Wheat/Gluten"}','{vegetarian,vegan,eggetarian,non-vegetarian}',20,'IFCT 2017 + recipe estimate','medium',false),
('Hummus','recipe','Spread','Middle Eastern','Global','2 tbsp (60 g)',60,100,3.0,8.0,6.0,3.0,'{"iron_mg":1.1}','{"Sesame"}','{vegetarian,vegan,eggetarian,non-vegetarian,gluten-free}',35,'USDA FoodData Central','high',true),
('Sushi roll (salmon avocado)','restaurant','Rice dish','Japanese','Global','6 pieces (180 g)',180,320,14.0,44.0,9.0,3.5,'{"omega3_mg":600,"sodium_mg":600}','{"Fish","Soy"}','{non-vegetarian}',300,'Restaurant estimate — verify with the outlet','low',false),
('Falafel wrap','restaurant','Wrap','Middle Eastern','Global','1 wrap (280 g)',280,520,16.0,62.0,23.0,10.0,'{"iron_mg":4.0,"sodium_mg":900}','{"Wheat/Gluten","Sesame"}','{vegetarian,vegan,eggetarian,non-vegetarian}',200,'Restaurant estimate — verify with the outlet','low',false);