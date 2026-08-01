CREATE TABLE public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  category text NOT NULL DEFAULT 'Other',
  disciplines text[] NOT NULL DEFAULT '{}',
  events text[] NOT NULL DEFAULT '{}',
  positions text[] NOT NULL DEFAULT '{}',
  aliases text[] NOT NULL DEFAULT '{}',
  energy_aerobic integer NOT NULL DEFAULT 40,
  energy_glycolytic integer NOT NULL DEFAULT 30,
  energy_alactic integer NOT NULL DEFAULT 30,
  primary_qualities text[] NOT NULL DEFAULT '{}',
  typical_season text,
  contact_level text NOT NULL DEFAULT 'non-contact',
  weight_sensitive boolean NOT NULL DEFAULT false,
  popularity integer NOT NULL DEFAULT 100,
  data_source text NOT NULL DEFAULT 'Curated (general sports-science guidance)',
  confidence text NOT NULL DEFAULT 'medium',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports TO authenticated;
GRANT ALL ON public.sports TO service_role;

ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sports" ON public.sports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users can add sports" ON public.sports FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can edit own sports" ON public.sports FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete own sports" ON public.sports FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_sports_updated_at BEFORE UPDATE ON public.sports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX sports_name_idx ON public.sports (lower(name));
CREATE INDEX sports_category_idx ON public.sports (category);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sport_discipline text,
  ADD COLUMN IF NOT EXISTS sport_event text,
  ADD COLUMN IF NOT EXISTS season_phase text,
  ADD COLUMN IF NOT EXISTS training_schedule jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.sports (name, slug, category, disciplines, events, positions, aliases, energy_aerobic, energy_glycolytic, energy_alactic, primary_qualities, typical_season, contact_level, weight_sensitive, popularity) VALUES
('Football (Soccer)','football-soccer','Team',ARRAY['11-a-side','Futsal','Beach soccer'],ARRAY['League','Cup','Tournament'],ARRAY['Goalkeeper','Centre-back','Full-back','Defensive midfielder','Central midfielder','Winger','Striker'],ARRAY['soccer','futbol'],60,25,15,ARRAY['endurance','speed','agility','power'],'Aug–May','contact',false,1),
('Cricket','cricket','Team',ARRAY['Test','ODI','T20'],ARRAY['Domestic','International'],ARRAY['Fast bowler','Spin bowler','Opening batter','Middle-order batter','All-rounder','Wicketkeeper'],ARRAY[]::text[],45,25,30,ARRAY['power','speed','skill','repeat-sprint'],'Year-round','limited-contact',false,2),
('Basketball','basketball','Team',ARRAY['5x5','3x3'],ARRAY['League','Tournament'],ARRAY['Point guard','Shooting guard','Small forward','Power forward','Centre'],ARRAY[]::text[],50,30,20,ARRAY['power','agility','repeat-sprint'],'Oct–Apr','contact',false,3),
('Volleyball','volleyball','Team',ARRAY['Indoor','Beach'],ARRAY['League','Tournament'],ARRAY['Setter','Outside hitter','Opposite','Middle blocker','Libero'],ARRAY[]::text[],35,25,40,ARRAY['power','jump','reactive strength'],'Sep–Apr','non-contact',false,8),
('Field Hockey','field-hockey','Team',ARRAY['Outdoor','Indoor'],ARRAY['League','Tournament'],ARRAY['Goalkeeper','Defender','Midfielder','Forward'],ARRAY['hockey'],60,25,15,ARRAY['endurance','speed','agility'],'Sep–Apr','contact',false,14),
('Rugby Union','rugby-union','Team',ARRAY['15s','7s'],ARRAY['League','Tournament'],ARRAY['Prop','Hooker','Lock','Flanker','Number 8','Scrum-half','Fly-half','Centre','Wing','Full-back'],ARRAY['rugby'],50,30,20,ARRAY['strength','power','collision','endurance'],'Sep–May','collision',false,12),
('American Football','american-football','Team',ARRAY['Tackle','Flag'],ARRAY['Season','Playoffs'],ARRAY['Quarterback','Running back','Wide receiver','Tight end','Offensive line','Defensive line','Linebacker','Cornerback','Safety'],ARRAY['gridiron','nfl'],30,25,45,ARRAY['power','speed','strength'],'Sep–Jan','collision',false,11),
('Baseball','baseball','Team',ARRAY['Baseball','Softball'],ARRAY['Season','Playoffs'],ARRAY['Pitcher','Catcher','Infielder','Outfielder','Designated hitter'],ARRAY[]::text[],30,20,50,ARRAY['power','rotational speed','skill'],'Apr–Oct','limited-contact',false,13),
('Handball','handball','Team',ARRAY['Indoor','Beach'],ARRAY['League','Tournament'],ARRAY['Goalkeeper','Wing','Back','Pivot'],ARRAY[]::text[],50,30,20,ARRAY['power','agility','endurance'],'Sep–May','contact',false,20),
('Kabaddi','kabaddi','Team',ARRAY['Standard style','Circle style'],ARRAY['League','Tournament'],ARRAY['Raider','Left corner','Right corner','Cover','All-rounder'],ARRAY[]::text[],35,40,25,ARRAY['power','anaerobic capacity','grappling strength'],'Year-round','collision',true,15),
('Ice Hockey','ice-hockey','Team',ARRAY['Ice hockey'],ARRAY['Season','Playoffs'],ARRAY['Goaltender','Defenceman','Centre','Winger'],ARRAY[]::text[],40,35,25,ARRAY['power','repeat-sprint','strength'],'Oct–Apr','collision',false,21),
('Netball','netball','Team',ARRAY['Indoor'],ARRAY['League','Tournament'],ARRAY['Goal shooter','Goal attack','Wing attack','Centre','Wing defence','Goal defence','Goal keeper'],ARRAY[]::text[],45,30,25,ARRAY['agility','power','endurance'],'Apr–Sep','limited-contact',false,30),
('Water Polo','water-polo','Team',ARRAY['Pool'],ARRAY['League','Tournament'],ARRAY['Goalkeeper','Driver','Wing','Centre forward','Centre back'],ARRAY[]::text[],55,30,15,ARRAY['endurance','upper-body power','treading strength'],'Year-round','contact',false,40),
('Ultimate Frisbee','ultimate-frisbee','Team',ARRAY['Grass','Beach'],ARRAY['Tournament'],ARRAY['Handler','Cutter','Deep defender'],ARRAY['ultimate'],60,25,15,ARRAY['endurance','agility'],'Year-round','non-contact',false,60),
('Tennis','tennis','Racket',ARRAY['Singles','Doubles'],ARRAY['Hard court','Clay','Grass'],ARRAY['Baseliner','Serve-and-volley','All-court'],ARRAY[]::text[],45,25,30,ARRAY['repeat-sprint','power','agility'],'Year-round','non-contact',false,5),
('Badminton','badminton','Racket',ARRAY['Singles','Doubles','Mixed doubles'],ARRAY['Tournament'],ARRAY['Front court','Rear court','All-round'],ARRAY[]::text[],40,30,30,ARRAY['reactive speed','agility','endurance'],'Year-round','non-contact',false,6),
('Table Tennis','table-tennis','Racket',ARRAY['Singles','Doubles'],ARRAY['Tournament'],ARRAY['Attacker','Chopper','All-round'],ARRAY['ping pong'],35,25,40,ARRAY['reaction speed','coordination'],'Year-round','non-contact',false,18),
('Squash','squash','Racket',ARRAY['Singles','Doubles'],ARRAY['Tournament'],ARRAY['Attacking','Retriever'],ARRAY[]::text[],55,30,15,ARRAY['endurance','agility','lunge strength'],'Year-round','non-contact',false,35),
('Padel','padel','Racket',ARRAY['Doubles'],ARRAY['Tournament'],ARRAY['Right side','Left side'],ARRAY[]::text[],45,30,25,ARRAY['agility','endurance'],'Year-round','non-contact',false,45),
('Pickleball','pickleball','Racket',ARRAY['Singles','Doubles'],ARRAY['Tournament'],ARRAY['Baseline','Net player'],ARRAY[]::text[],40,25,35,ARRAY['agility','reaction'],'Year-round','non-contact',false,55),
('Athletics — Sprints','athletics-sprints','Athletics',ARRAY['Track'],ARRAY['60m','100m','200m','400m','4x100m relay'],ARRAY['Sprinter','Relay runner'],ARRAY['track and field','sprinting'],10,30,60,ARRAY['max speed','power','acceleration'],'Apr–Sep','non-contact',false,4),
('Athletics — Middle Distance','athletics-middle-distance','Athletics',ARRAY['Track'],ARRAY['800m','1500m','Mile','3000m steeplechase'],ARRAY['Middle-distance runner'],ARRAY['800m','1500m'],55,35,10,ARRAY['aerobic power','lactate tolerance'],'Apr–Sep','non-contact',true,9),
('Athletics — Long Distance','athletics-long-distance','Athletics',ARRAY['Track','Road','Cross country'],ARRAY['5000m','10000m','Half marathon','Marathon'],ARRAY['Distance runner'],ARRAY['running','marathon'],85,12,3,ARRAY['aerobic endurance','running economy'],'Year-round','non-contact',true,7),
('Athletics — Jumps','athletics-jumps','Athletics',ARRAY['Field'],ARRAY['Long jump','Triple jump','High jump','Pole vault'],ARRAY['Jumper'],ARRAY[]::text[],10,20,70,ARRAY['reactive strength','power','speed'],'Apr–Sep','non-contact',false,25),
('Athletics — Throws','athletics-throws','Athletics',ARRAY['Field'],ARRAY['Shot put','Discus','Javelin','Hammer'],ARRAY['Thrower'],ARRAY[]::text[],10,15,75,ARRAY['max strength','rate of force','rotational power'],'Apr–Sep','non-contact',false,26),
('Athletics — Hurdles','athletics-hurdles','Athletics',ARRAY['Track'],ARRAY['110m hurdles','100m hurdles','400m hurdles'],ARRAY['Hurdler'],ARRAY[]::text[],15,35,50,ARRAY['speed','mobility','rhythm'],'Apr–Sep','non-contact',false,27),
('Athletics — Combined Events','athletics-combined','Athletics',ARRAY['Field & track'],ARRAY['Decathlon','Heptathlon'],ARRAY['Multi-eventer'],ARRAY[]::text[],35,30,35,ARRAY['all-round power','endurance'],'Apr–Sep','non-contact',false,50),
('Swimming','swimming','Water',ARRAY['Pool','Open water'],ARRAY['50m','100m','200m','400m','1500m','Open water 10km'],ARRAY['Sprinter','Middle-distance','Distance','Individual medley'],ARRAY[]::text[],55,25,20,ARRAY['aerobic power','upper-body endurance','technique'],'Year-round','non-contact',false,10),
('Rowing','rowing','Water',ARRAY['Sweep','Sculling','Indoor'],ARRAY['2000m','Head race'],ARRAY['Bow','Stroke','Coxswain'],ARRAY['crew','erg'],70,25,5,ARRAY['aerobic power','strength endurance'],'Year-round','non-contact',true,28),
('Kayaking / Canoeing','kayaking-canoeing','Water',ARRAY['Sprint','Slalom','Marathon'],ARRAY['200m','500m','1000m'],ARRAY['Paddler'],ARRAY['canoe','kayak'],55,30,15,ARRAY['upper-body power','core stability'],'Apr–Sep','non-contact',false,52),
('Surfing','surfing','Water',ARRAY['Shortboard','Longboard'],ARRAY['Heats'],ARRAY['Surfer'],ARRAY[]::text[],50,25,25,ARRAY['paddling endurance','balance','pop-up power'],'Year-round','non-contact',false,58),
('Sailing','sailing','Water',ARRAY['Dinghy','Keelboat','Windsurf'],ARRAY['Regatta'],ARRAY['Helm','Crew','Trimmer'],ARRAY[]::text[],50,30,20,ARRAY['isometric strength','balance','heat tolerance'],'Apr–Oct','non-contact',false,70),
('Cycling — Road','cycling-road','Endurance',ARRAY['Road'],ARRAY['Criterium','Road race','Time trial','Gran fondo'],ARRAY['Sprinter','Climber','Time trialist','Domestique'],ARRAY['bike','biking'],80,15,5,ARRAY['aerobic endurance','threshold power'],'Mar–Oct','non-contact',true,16),
('Cycling — Track','cycling-track','Endurance',ARRAY['Track'],ARRAY['Sprint','Keirin','Pursuit','Omnium'],ARRAY['Sprinter','Endurance rider'],ARRAY[]::text[],35,35,30,ARRAY['peak power','anaerobic capacity'],'Year-round','non-contact',false,48),
('Mountain Biking','mountain-biking','Endurance',ARRAY['Cross-country','Downhill','Enduro'],ARRAY['XCO','DH'],ARRAY['Rider'],ARRAY['mtb'],70,20,10,ARRAY['endurance','handling','core strength'],'Apr–Oct','non-contact',false,54),
('Triathlon','triathlon','Endurance',ARRAY['Sprint','Olympic','Half Ironman','Ironman'],ARRAY['Race day'],ARRAY['Triathlete'],ARRAY['ironman'],85,12,3,ARRAY['multi-sport endurance','durability'],'Apr–Sep','non-contact',true,22),
('Trail Running','trail-running','Endurance',ARRAY['Trail','Ultra'],ARRAY['10k','50k','100k'],ARRAY['Trail runner'],ARRAY['ultrarunning'],88,9,3,ARRAY['aerobic endurance','eccentric strength'],'Year-round','non-contact',true,44),
('Race Walking','race-walking','Endurance',ARRAY['Road'],ARRAY['20km','35km'],ARRAY['Walker'],ARRAY[]::text[],88,10,2,ARRAY['aerobic endurance','hip mobility'],'Apr–Sep','non-contact',true,80),
('Boxing','boxing','Combat',ARRAY['Amateur','Professional'],ARRAY['Bout'],ARRAY['Orthodox','Southpaw','Pressure fighter','Counter puncher'],ARRAY[]::text[],45,35,20,ARRAY['anaerobic capacity','power endurance'],'Year-round','collision',true,17),
('Wrestling','wrestling','Combat',ARRAY['Freestyle','Greco-Roman','Folkstyle'],ARRAY['Bout'],ARRAY['Wrestler'],ARRAY[]::text[],35,45,20,ARRAY['grip strength','anaerobic capacity'],'Year-round','collision',true,19),
('Judo','judo','Combat',ARRAY['Judo'],ARRAY['Bout'],ARRAY['Tachi-waza specialist','Ne-waza specialist'],ARRAY[]::text[],35,45,20,ARRAY['grip strength','explosive pulling'],'Year-round','collision',true,29),
('Brazilian Jiu-Jitsu','brazilian-jiu-jitsu','Combat',ARRAY['Gi','No-gi'],ARRAY['Bout'],ARRAY['Guard player','Passer'],ARRAY['bjj'],45,35,20,ARRAY['grip endurance','isometric strength'],'Year-round','collision',true,33),
('Mixed Martial Arts','mixed-martial-arts','Combat',ARRAY['Amateur','Professional'],ARRAY['Bout'],ARRAY['Striker','Grappler','Wrestler'],ARRAY['mma'],40,40,20,ARRAY['mixed energy systems','power endurance'],'Year-round','collision',true,31),
('Karate','karate','Combat',ARRAY['Kumite','Kata'],ARRAY['Bout'],ARRAY['Kumite fighter','Kata competitor'],ARRAY[]::text[],30,30,40,ARRAY['speed','reaction','mobility'],'Year-round','contact',true,37),
('Taekwondo','taekwondo','Combat',ARRAY['Kyorugi','Poomsae'],ARRAY['Bout'],ARRAY['Fighter','Poomsae competitor'],ARRAY[]::text[],35,35,30,ARRAY['kicking speed','hip mobility'],'Year-round','contact',true,38),
('Fencing','fencing','Combat',ARRAY['Foil','Epee','Sabre'],ARRAY['Bout'],ARRAY['Attacker','Defender'],ARRAY[]::text[],35,25,40,ARRAY['lunge power','reaction speed'],'Year-round','limited-contact',false,49),
('Muay Thai','muay-thai','Combat',ARRAY['Amateur','Professional'],ARRAY['Bout'],ARRAY['Clinch fighter','Striker'],ARRAY[]::text[],40,40,20,ARRAY['power endurance','conditioning'],'Year-round','collision',true,53),
('Weightlifting','weightlifting','Strength',ARRAY['Olympic weightlifting'],ARRAY['Snatch','Clean & jerk','Total'],ARRAY['Lifter'],ARRAY['olympic lifting'],5,15,80,ARRAY['max strength','rate of force','mobility'],'Year-round','non-contact',true,23),
('Powerlifting','powerlifting','Strength',ARRAY['Raw','Equipped'],ARRAY['Squat','Bench press','Deadlift','Total'],ARRAY['Lifter'],ARRAY[]::text[],5,15,80,ARRAY['max strength','bracing'],'Year-round','non-contact',true,24),
('CrossFit / Functional Fitness','crossfit','Strength',ARRAY['Competitive','Recreational'],ARRAY['WOD','Competition'],ARRAY['Athlete'],ARRAY['functional fitness'],40,40,20,ARRAY['mixed-modal capacity','strength endurance'],'Year-round','non-contact',false,32),
('Strongman','strongman','Strength',ARRAY['Competitive'],ARRAY['Events'],ARRAY['Athlete'],ARRAY[]::text[],15,35,50,ARRAY['max strength','strength endurance'],'Year-round','non-contact',true,66),
('Bodybuilding','bodybuilding','Strength',ARRAY['Classic','Mens physique','Bikini'],ARRAY['Show'],ARRAY['Competitor'],ARRAY[]::text[],20,40,40,ARRAY['hypertrophy','work capacity'],'Year-round','non-contact',true,34),
('Gymnastics','gymnastics','Skill',ARRAY['Artistic','Rhythmic','Trampoline'],ARRAY['All-around','Apparatus final'],ARRAY['Gymnast'],ARRAY[]::text[],20,30,50,ARRAY['relative strength','mobility','body control'],'Year-round','non-contact',true,36),
('Dance','dance','Skill',ARRAY['Classical','Contemporary','Hip hop','Ballroom'],ARRAY['Performance','Competition'],ARRAY['Dancer'],ARRAY[]::text[],45,30,25,ARRAY['mobility','endurance','control'],'Year-round','non-contact',true,42),
('Cheerleading','cheerleading','Skill',ARRAY['All-star','Sideline'],ARRAY['Routine'],ARRAY['Base','Flyer','Backspot','Tumbler'],ARRAY[]::text[],35,35,30,ARRAY['power','stability','body control'],'Year-round','limited-contact',false,68),
('Skateboarding','skateboarding','Skill',ARRAY['Street','Park','Vert'],ARRAY['Contest'],ARRAY['Skater'],ARRAY[]::text[],25,25,50,ARRAY['power','balance','landing control'],'Year-round','non-contact',false,62),
('Climbing','climbing','Skill',ARRAY['Bouldering','Lead','Speed'],ARRAY['Competition'],ARRAY['Boulderer','Route climber','Speed climber'],ARRAY['bouldering'],30,35,35,ARRAY['grip strength','relative strength','mobility'],'Year-round','non-contact',true,39),
('Golf','golf','Precision',ARRAY['Stroke play','Match play'],ARRAY['Round','Tournament'],ARRAY['Golfer'],ARRAY[]::text[],35,15,50,ARRAY['rotational power','stability','focus'],'Mar–Oct','non-contact',false,41),
('Archery','archery','Precision',ARRAY['Recurve','Compound'],ARRAY['Ranking round','Elimination'],ARRAY['Archer'],ARRAY[]::text[],40,20,40,ARRAY['isometric strength','stability','focus'],'Year-round','non-contact',false,64),
('Shooting','shooting','Precision',ARRAY['Rifle','Pistol','Shotgun'],ARRAY['Qualification','Final'],ARRAY['Shooter'],ARRAY[]::text[],45,15,40,ARRAY['postural stability','breath control'],'Year-round','non-contact',false,65),
('Equestrian','equestrian','Precision',ARRAY['Dressage','Show jumping','Eventing'],ARRAY['Competition'],ARRAY['Rider'],ARRAY[]::text[],45,25,30,ARRAY['core stability','isometric strength'],'Apr–Oct','non-contact',true,72),
('Motorsport','motorsport','Precision',ARRAY['Karting','Circuit racing','Rally'],ARRAY['Race'],ARRAY['Driver'],ARRAY[]::text[],50,25,25,ARRAY['neck strength','heat tolerance','reaction'],'Mar–Nov','non-contact',true,74),
('Esports','esports','Precision',ARRAY['FPS','MOBA','Fighting','Sports sim'],ARRAY['Match','Tournament'],ARRAY['Player','Support','Carry','In-game leader'],ARRAY['gaming'],60,20,20,ARRAY['reaction time','posture','eye health'],'Year-round','non-contact',false,46),
('Skiing','skiing','Winter',ARRAY['Alpine','Cross-country','Freestyle'],ARRAY['Slalom','Giant slalom','Downhill','Distance race'],ARRAY['Skier'],ARRAY[]::text[],50,30,20,ARRAY['eccentric strength','endurance','balance'],'Dec–Mar','non-contact',false,47),
('Snowboarding','snowboarding','Winter',ARRAY['Freestyle','Alpine','Boardercross'],ARRAY['Slopestyle','Halfpipe'],ARRAY['Rider'],ARRAY[]::text[],40,30,30,ARRAY['landing control','power','balance'],'Dec–Mar','non-contact',false,63),
('Figure Skating','figure-skating','Winter',ARRAY['Singles','Pairs','Ice dance'],ARRAY['Short program','Free skate'],ARRAY['Skater'],ARRAY[]::text[],35,30,35,ARRAY['jump power','mobility','balance'],'Sep–Mar','non-contact',true,67),
('Speed Skating','speed-skating','Winter',ARRAY['Long track','Short track'],ARRAY['500m','1000m','5000m'],ARRAY['Sprinter','Distance skater'],ARRAY[]::text[],55,30,15,ARRAY['leg power','lactate tolerance'],'Nov–Mar','non-contact',false,76),
('Yoga','yoga','Mind-body',ARRAY['Hatha','Vinyasa','Ashtanga'],ARRAY['Practice'],ARRAY['Practitioner'],ARRAY[]::text[],55,20,25,ARRAY['mobility','stability','breathing'],'Year-round','non-contact',false,43),
('Pilates','pilates','Mind-body',ARRAY['Mat','Reformer'],ARRAY['Practice'],ARRAY['Practitioner'],ARRAY[]::text[],50,25,25,ARRAY['core stability','control'],'Year-round','non-contact',false,57),
('Martial Arts (general)','martial-arts-general','Combat',ARRAY['Traditional','Modern'],ARRAY['Grading','Bout'],ARRAY['Student','Instructor'],ARRAY[]::text[],40,35,25,ARRAY['mobility','power','conditioning'],'Year-round','contact',false,59),
('Recreational Fitness','recreational-fitness','General',ARRAY['Gym','Home','Outdoor'],ARRAY['None'],ARRAY['General athlete'],ARRAY['general fitness'],55,25,20,ARRAY['general fitness','health'],'Year-round','non-contact',false,99);