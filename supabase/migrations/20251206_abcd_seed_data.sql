-- ABCD Seed Data Migration
-- Generated from ABCD.xlsx
-- This script is idempotent and can be run multiple times

-- Transaction wrapper for atomic execution
BEGIN;

-- A-Scene Category (场景分类)
INSERT INTO a_scene_category (code, name_zh, ai_visual_prompt, sort_order)
VALUES
  ('01-Home', '居家及养老院', 'This category encompasses both private residences and professional nursing facilities. It represents the senior''s primary living environment. CRITICAL INSTRUCTION: You MUST refer to the specific ''A-Scene Detail'' input to determine the setting style. If Detail is 01-04, render a cozy, personal, warm private home. If Detail is 05-07, render a clean, organized, communal institutional facility.', 1),
  ('02-Community', '社区周边', 'Semi-public or outdoor neighborhood setting, lively but relaxed, bright daylight, social interaction, general public spaces with paved paths.', 2),
  ('03-Transit', '交通工具相关', 'Transportation hubs or vehicle-related settings. Focus on logistics, mobility, and temporary stay environments (parking lots, airports, stations).', 3),
  ('04-Travel', '旅行相关', 'Tourist destinations, leisure atmosphere, scenic landscapes, hotels, or famous landmarks. Vibe is exploration and enjoyment.', 4)
ON CONFLICT (code) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  ai_visual_prompt = EXCLUDED.ai_visual_prompt,
  sort_order = EXCLUDED.sort_order;

-- B-Action (动作)
INSERT INTO b_action (code, name_zh, ai_visual_prompt, sort_order)
VALUES
  ('01-Walk', '行走模式', 'State: UNFOLDED. User is walking through the [A-Scene] with good posture, hands on handles. AI Instruction: Depict the user engaging in the typical movement of this location (e.g., looking at scenery in a park, browsing shelves in a supermarket).', 1),
  ('02-Navigate', '操控模式', 'State: UNFOLDED. User is maneuvering the walker in a tight spot within the [A-Scene]. Focus on agility and wheels. Example: Turning between tables in a restaurant, or navigating a narrow home bathroom.', 2),
  ('03-Engage', '坐姿互动', 'State: UNFOLDED. User is sitting comfortably on the walker''s seat, brakes locked. CRITICAL: They are performing the primary activity of the [A-Scene] while seated. (e.g., If Scene=Lake, user is fishing while seated. If Scene=Museum, user is viewing art while seated).', 3),
  ('04-Beside', '旁置陪伴', 'State: FOLDED (mostly). User is standing or sitting on a regular chair/ground, engaged in the [A-Scene] activity (e.g., fishing by the lake, drinking coffee at a cafe table). The walker is folded and parked unobtrusively next to them, like a loyal companion.', 4),
  ('05-Transition', '收纳搬运', 'State: FOLDED. User is physically handling the walker for transport. Focus on the "Lift" or "Fold" action. Expression shows ease/lightweight. Context is usually a parking lot, car, or stairway.', 5),
  ('06-Detail', '细节特写', 'State: UNFOLDED. Extreme close-up on the user''s hands interacting with the product (brakes, buttons, storage bag). Background is blurred [A-Scene].', 6)
ON CONFLICT (code) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  ai_visual_prompt = EXCLUDED.ai_visual_prompt,
  sort_order = EXCLUDED.sort_order;

-- C-Emotion (情绪)
INSERT INTO c_emotion (code, name_zh, ai_visual_prompt, sort_order)
VALUES
  ('01-Independence', '渴望独立 (Driver)：不想依赖别人，拿回生活掌控权。', 'Driver: Autonomy. Senior performing a task (walking, shopping) alone, with an expression of self-reliance and quiet pride. They look empowered, not lonely. Emphasis on choice and freedom.', 1),
  ('02-NoBurden', '拒做负担 (Barrier)：怕麻烦子女，因受伤而给子女添乱的愧疚感。', 'Barrier: Guilt/Safety for Family. Senior is using the walker securely while younger family members are visible in the background background (blurred) but not assisting. Senior has a satisfied, reassured expression. Vibe: I am safe, so they don''t have to worry.', 2),
  ('03-NotOld', '抗拒衰老 (Barrier)：怕显老，抗拒像病人，想要像配饰的产品。', 'Barrier: Stigma/Aesthetics. Senior is stylishly dressed (modern, vibrant clothing, glasses) in a non-medical setting (e.g., museum, cafe). Using the walker with a confident, upright posture, treating it like a premium fashion accessory.', 3),
  ('04-SocialFOMO', '害怕掉队 (Driver)：怕跟不上朋友的步伐，怕被社会隔离。', 'Driver: Belonging/Connection. Senior actively participating in a group event (e.g., watching a game, walking with peers). They are keeping up with the group. Expression is joyful, connected, and engaged.', 4),
  ('05-FallFear', '跌倒恐惧 (Barrier)：越怕摔越不动，需要强调“绝对的稳固感”。', 'Barrier: Anxiety/Instability. Senior firmly gripping handles, focused on the path, but with an expression of intense relief and rock-solid trust in the walker''s stability. A transition from fear to safety.', 5),
  ('06-Endurance', '体力续航 (Driver)：走不远需要坐，强调“随身的椅子”。', 'Driver: Stamina/Comfort. Senior resting comfortably on the seat mid-activity (e.g., at a scenic spot, waiting in line), looking relaxed and recharging energy. Visual: "I can go further because I can sit anytime."', 6),
  ('07-PainRelief', '缓解疼痛 (Driver)：腰背痛/关节痛，强调直立行走设计。', 'Driver: Physical Comfort. Senior walking with perfect, upright posture (spine straight, not hunched over), hands resting easily on the handles. Expression is serene, suggesting freedom from chronic back or wrist pain.', 7),
  ('08-SmallSpace', '空间焦虑 (Barrier)：担心家里转不开身，怕撞坏家具。', 'Barrier: Clutter/Maneuverability. Senior successfully navigating a very tight, narrow space (e.g., between a sofa and a table), looking surprised and delighted by how easily the walker fits.', 8),
  ('09-HeavyLift', '搬运沉重 (Barrier)：旧的太重提不动，导致不出门。', 'Barrier: Physical Strain. Senior (e.g., a petite woman) is easily, single-handedly lifting the folded walker into a car trunk or up a step, showing no physical strain or difficulty. Emphasis on lightness.', 9),
  ('10-Complexity', '安装恐惧 (Barrier)：怕买回来一堆零件拼不上，怕工具太复杂。', 'Barrier: Usability. Senior is shown effortlessly unfolding or setting up the walker out of the box, looking amazed by its simplicity (e.g., one-click action). No tools or messy parts visible.', 10)
ON CONFLICT (code) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  ai_visual_prompt = EXCLUDED.ai_visual_prompt,
  sort_order = EXCLUDED.sort_order;

-- D-Format (格式)
INSERT INTO d_format (code, name_zh, ai_visual_prompt, sort_order)
VALUES
  ('I01-Lifestyle', '图片-生活场景', 'Cinematic lifestyle shot, wide aperture (f/1.8), focus on the senior''s emotion and the environment, golden hour lighting, aspirational vibe.', 1),
  ('I02-Compare', '图片-对比图', 'SPLIT SCREEN COMPOSITION. Left side: Desaturated, grainy, senior struggling with a grey clunky medical walker (red X). Right side: Bright, sharp, senior happy with red Rolloy walker (green check).', 2)
ON CONFLICT (code) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  ai_visual_prompt = EXCLUDED.ai_visual_prompt,
  sort_order = EXCLUDED.sort_order;

-- A-Scene Detail (场景详情)
-- Note: category_id will be resolved via JOIN with a_scene_category
INSERT INTO a_scene_detail (code, name_zh, category_id, ai_visual_prompt, sort_order)
VALUES
  ('01-Bedroom', '普通居家-卧室', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Private Home] A cozy bedroom with a bed, nightstand, and soft morning light. Tight spaces between furniture. Personal photos on the dresser. Warm, lived-in atmosphere.', 1),
  ('02-LivingRoom', '普通居家-客厅', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Private Home] A comfortable living room with a sofa, TV, and coffee table. Wooden floor or carpet. Family environment.', 2),
  ('03-Kitchen', '普通居家-厨房/餐厅', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Private Home] A domestic kitchen with counters, dining table, and chairs. Narrow passage between table and counter.', 3),
  ('04-Washroom', '普通居家-卫生间', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Private Home] A tiled bathroom with a sink, toilet, and shower. Small and narrow space, bright white lighting, clean surfaces.', 4),
  ('05-Nursing-Dining', '养老院-食堂', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Institution] A spacious communal dining hall with multiple tables, bright overhead lighting, clean and organized. Assisted living facility vibe, not a private kitchen.', 5),
  ('06-Nursing-Media', '养老院-影音室', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Institution] A recreational room with rows of comfortable armchairs, large TV or screen, soft carpet. Social gathering space for seniors.', 6),
  ('07-Nursing-Hallway', '养老院-走廊', (SELECT id FROM a_scene_category WHERE code = '01-Home'), '[Institution] A long, clean, wide hallway with handrails mounted on the walls. Bright clinical or facility lighting. Safety signage visible.', 7),
  ('01-Garden', '庭院及园艺', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'A backyard garden with flowers, plants, and grass. Outdoor sunlight, gardening tools, peaceful nature setting.', 8),
  ('02-Supermarket', '超市', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Grocery store aisles with shelves full of products. Artificial bright lighting, shopping environment, smooth floor.', 9),
  ('03-Bank', '银行', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Inside a bank branch, counter service area, clean and professional atmosphere, waiting area with chairs.', 10),
  ('04-Hospital', '医院', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Hospital corridor or waiting room, medical signage, sterile and clean environment, bright clinical lighting.', 11),
  ('05-Therapy', '理疗中心', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Physical therapy room with exercise equipment, mats, spacious area, supportive environment for rehabilitation.', 12),
  ('06-Park', '公园', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Public park with paved paths, benches, trees, and green grass. Sunny weather, people walking in background.', 13),
  ('07-Barber', '理发', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Barbershop or salon interior, mirrors, styling chairs, bright lighting, grooming environment.', 14),
  ('08-NailSalon', '美甲', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Nail salon setting with manicure tables, comfortable chairs, relaxing atmosphere.', 15),
  ('09-Restaurant', '餐厅', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Dining tables in a restaurant, menu, tableware, social dining atmosphere, warm lighting.', 16),
  ('10-Cafe', '咖啡厅', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Coffee shop interior or patio, small tables, coffee cups, relaxed social vibe, casual setting.', 17),
  ('11-Library', '图书馆', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Quiet library setting with bookshelves, reading tables, carpeted floor, studious atmosphere.', 18),
  ('12-Church', '教堂', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Church interior with pews, stained glass windows, peaceful and spiritual atmosphere.', 19),
  ('13-Market', '周末农场/市集', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Outdoor farmers market stalls, fresh produce, crowded and lively, weekend vibe.', 20),
  ('14-BallGame', '球赛', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Spectator area of a sports field, bleachers or sidelines, grassy field in background, active atmosphere.', 21),
  ('15-Fishing', '钓鱼', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'By a lake or river, pier or grassy bank, fishing gear, calm water, outdoor nature.', 22),
  ('16-Pharmacy', '药房', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Pharmacy counter or aisles with medicine shelves, clean and organized.', 23),
  ('17-Mailbox', '信箱', (SELECT id FROM a_scene_category WHERE code = '02-Community'), 'Outdoor curbside mailbox or community mail center, standing on sidewalk.', 24),
  ('01-Car-Parking', '私家车-停车场', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Outdoor parking lot with asphalt ground, parked cars, open trunk of a vehicle.', 25),
  ('02-Car-SUV', '私家车-SUV', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Close-up near a modern SUV, focus on the trunk or door area, outdoor setting.', 26),
  ('03-Car-Sedan', '私家车-轿车', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Close-up near a sedan car, focus on the trunk storage, outdoor driveway or street.', 27),
  ('04-Car-RV', '私家车-房车', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Near a recreational vehicle (RV), camping or road trip setting, outdoor nature background.', 28),
  ('05-Taxi', '网约车/出租车', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Curbside city street, waiting for a taxi or Uber, urban background.', 29),
  ('06-Plane-CheckIn', '飞机-取票托运', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Airport check-in counter area, luggage, busy terminal atmosphere, signage.', 30),
  ('07-Plane-Security', '飞机-安检', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Airport security checkpoint area, bins and conveyors, modern terminal interior.', 31),
  ('08-Plane-Cabin', '飞机-机舱', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Inside an airplane cabin, narrow aisle between seats, overhead bins.', 32),
  ('09-Plane-Baggage', '飞机-行李提取', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Airport baggage claim area, carousel, waiting passengers.', 33),
  ('10-Cruise-Dock', '邮轮-码头', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Cruise ship terminal or dock, water and large ship in background, vacation start vibe.', 34),
  ('11-Cruise-Room', '邮轮-舱房(卧室)', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Small cruise ship cabin bedroom, ocean view window or balcony, compact space.', 35),
  ('12-Cruise-Buffet', '邮轮-餐厅(自助餐)', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Cruise ship buffet area, food stations, ocean view, dining tables.', 36),
  ('13-Cruise-Pool', '邮轮-泳池', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Cruise ship deck with pool, lounge chairs, sunny blue sky, vacation vibe.', 37),
  ('14-Cruise-Deck', '邮轮-甲板', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Open deck of a cruise ship, railing, ocean horizon view, walking track.', 38),
  ('15-Cruise-Casino', '邮轮-娱乐室', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Cruise ship casino or game room, carpeted floor, entertainment machines.', 39),
  ('16-Train-Station', '火车-车站', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Train station platform or hall, tracks, waiting benches, high ceilings.', 40),
  ('17-Train-Carriage', '火车-车厢', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Inside a train carriage, seats and aisle, window view of passing landscape.', 41),
  ('18-Train-Platform', '火车-站台', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Outdoor or covered train platform, waiting for arrival, yellow safety lines.', 42),
  ('19-Metro', '地铁', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Underground subway station or inside subway car, handrails, urban commute vibe.', 43),
  ('20-Bus', '公交车', (SELECT id FROM a_scene_category WHERE code = '03-Transit'), 'Bus stop with shelter or inside a city bus, urban street view.', 44),
  ('01-Hotel-Room', '酒店-房间', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Hotel bedroom, clean white linens, luggage stand, carpet, neutral decor.', 45),
  ('02-Hotel-Elevator', '酒店-电梯', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Hotel elevator lobby or inside elevator, mirrored walls, buttons.', 46),
  ('03-Hotel-Lobby', '酒店-大堂', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Spacious hotel lobby, reception desk, lounge seating, decorative lighting.', 47),
  ('04-Museum', '博物馆', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Museum exhibit hall, artwork or artifacts, quiet atmosphere, gallery lighting.', 48),
  ('05-ArtGallery', '美术馆', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Art gallery space, paintings on walls, open floor plan, contemplative mood.', 49),
  ('06-Casino', '赌场', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Las Vegas style casino floor, slot machines, colorful lights, busy carpet patterns.', 50),
  ('07-University', '大学', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'University campus, brick buildings, green lawns, walking paths, academic vibe.', 51),
  ('08-GrandCanyon', '美国-大峡谷', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Grand Canyon scenic overlook, vast red rock canyons, blue sky, outdoor tourism.', 52),
  ('09-Yellowstone', '美国-黄石公园', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Yellowstone national park, nature trails, geysers or forests, wilderness vibe.', 53),
  ('10-LasVegas', '美国-拉斯维加斯', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'The Strip street view, neon lights (evening) or bright hotels (day), busy tourist spot.', 54),
  ('11-Disney', '美国-迪士尼', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Theme park setting, crowds, castle or rides in background, happy vacation atmosphere.', 55),
  ('12-Intl-Paris', '国际-法国巴黎', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Paris street scene, Eiffel Tower in background, sidewalk cafe, cobblestone streets.', 56),
  ('13-Intl-Rome', '国际-意大利罗马', (SELECT id FROM a_scene_category WHERE code = '04-Travel'), 'Rome historic streets, Colosseum or ancient ruins in background, Italian architecture.', 57)
ON CONFLICT (code) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  category_id = EXCLUDED.category_id,
  ai_visual_prompt = EXCLUDED.ai_visual_prompt,
  sort_order = EXCLUDED.sort_order;

COMMIT;

-- End of migration