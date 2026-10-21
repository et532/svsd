import { rows } from './row'

// University of Michigan, 2015-2019: design major, the student newspaper, club ultimate, dorms and house-shares,
// a semester abroad in Copenhagen (fall 2018).
export const collegeRows = rows([
  // ---- Dorm and houses ----
  [
    "neil-banerjee", "Neil Banerjee", "social", "college", "Management consultant", "Manhattan, NY/Murray Hill", "Chicago", "Ann Arbor|East Quad, freshman hall", "2015-08-29", "2026-10-03", 3,
    "consulting, board games, running, cooking",
    "Lived across the hall freshman year and stayed up with me through every problem set. Now a consultant who flies out every Monday and lands back in Murray Hill on Thursday. Cooks elaborate dinners for six.",
    "Neil, from the hall. Offered me half a pizza at 2am and has not stopped since.",
    "eli-novak, julian-reyes, rosa-delgado",
    "Host the Friendsgiving potluck ; Borrow his dutch oven",
    [
      ["2026-10-03", "Dinner at his place", "Six courses, none of which he had made before. We played a board game until two and he won by cheating.", 14],
      ["2022-06-11", "Rooftop birthday", "He had just moved to New York himself. Ten of us from Ann Arbor on one roof."],
    ],
  ],
  [
    "tomas-herrera", "Tomas Herrera", "social", "college", "Vehicle systems engineer", "Detroit", "Houston", "Ann Arbor|East Quad, freshman hall", "2015-08-29", "2026-02-21", 2,
    "cars, engineering, football, cooking",
    "Down the hall from Neil and me. Studied mechanical engineering and now works on electric vehicles in Detroit. Hosts a tailgate for every Michigan home game and keeps a spare ticket for me.",
    "Tomas, the engineer on our floor. Had a poster of a car I could not name.",
    "neil-banerjee, cass-whitaker",
    "Go to the Ohio State tailgate ; Ask what the team is building",
    [
      ["2026-02-21", "Phone call", "He gave me the thirty-second version of his work on battery packs and then forty minutes on his chili recipe.", 11],
      ["2023-11-25", "Michigan football weekend", "We lost badly and ate chili in the parking lot anyway."],
    ],
  ],
  [
    "keisha-williams", "Keisha Williams", "work+social", "college", "Policy attorney", "Washington, DC", "Atlanta", "Ann Arbor|East Quad, resident advisor", "2015-08-27", "2026-07-30", 2,
    "law, policy, dancing, mentoring",
    "Our resident advisor freshman year. Gave me the first real talk about not skipping classes and the first real hug after a hard exam. Now writes tech policy in DC and still sends a calendar invite for my birthday.",
    "Keisha, our RA. She knocked on every door the first night and asked if we had eaten.",
    "sunita-rao, anna-kowalski",
    "Visit DC in the spring ; Ask for advice on an apartment lease dispute",
    [
      ["2026-07-30", "Phone call", "She is up for a promotion at the policy institute. Told me to apply for the design lead role I was nervous about.", 13],
      ["2022-12-17", "Holiday party in DC", "Danced with everyone on our old hall. She remembered every middle name."],
    ],
  ],
  [
    "eli-novak", "Eli Novak", "social", "college", "Restaurant general manager", "Brooklyn, NY/Bed-Stuy", "Cleveland", "Ann Arbor|House on Church Street", "2018-08-20", "2026-10-14", 3,
    "restaurants, hospitality, cooking, music",
    "Roommate in the house on Church Street senior year. Went from line cook to general manager of a restaurant group's flagship in Brooklyn. Cooks dinner for the whole building on Sundays.",
    "Eli, roommate. First thing he said: where do we keep the cast iron.",
    "neil-banerjee, dani-moreno, bryn-abbott, hiro-sato",
    "Sunday dinner at his place ; Ask about booking for my birthday",
    [
      ["2026-10-14", "Sunday dinner", "Nine people at his long table. He had put me next to a stylist who is now my friend.", 15],
      ["2023-04-22", "Restaurant opening", "He cried at the pass after the first service. I took the photo he later framed."],
    ],
  ],
  [
    "bryn-abbott", "Bryn Abbott", "social", "college", "Marine biologist", "Seattle", "Portland", "Ann Arbor|House on Church Street", "2018-08-20", "2026-05-05", 2,
    "science, ocean, kayaking, knitting",
    "Housemate who kept a tank of sea slugs in the kitchen. Now a marine biologist in Seattle who studies kelp. Knits hats for everyone she loves.",
    "Bryn, the housemate with the tank. Warned me about the slugs.",
    "eli-novak, hiro-sato, tina-chen",
    "Wear the hat she knit ; Visit when the kelp survey is done",
    [
      ["2026-05-05", "Video call", "She was on a boat with spotty signal and showed me a kelp forest through the phone. It looked like a cathedral.", 11],
      ["2021-02-10", "Care package", "A knit hat with a tiny slug on it arrived a week into my first New York winter."],
    ],
  ],
  [
    "hiro-sato", "Hiro Sato", "social", "college", "Product designer", "Toronto", "Tokyo", "Ann Arbor|House on Church Street", "2018-08-20", "2026-06-21", 2,
    "design, coffee, film cameras, ramen",
    "Housemate and fellow design student. Moved to Toronto for a design job and then never left. Takes photos on a film camera and will make you try every cup of coffee he roasts.",
    "Hiro, housemate. He had three monitors and one chair.",
    "eli-novak, bryn-abbott, noor-aziz",
    "Send him my redesigned portfolio ; Order the coffee beans",
    [
      ["2026-06-21", "Design crit over video", "He gave me four honest notes on my case study, three of which stung. All four were right.", 13],
      ["2022-09-17", "Visited Toronto", "He showed me three coffee shops and one very good noodle counter. I bought a film camera."],
    ],
  ],
  [
    "dani-moreno", "Dani Moreno", "social+community", "college", "High school art teacher", "Los Angeles/Silver Lake", "Phoenix", "Ann Arbor|House on Church Street", "2018-08-20", "2026-08-15", 2,
    "art, teaching, ceramics, thrifting",
    "Housemate with the best taste of anyone I know. Became a high school art teacher in Los Angeles, thrifts every Sunday and has dressed me for three weddings. Mails a care package of vintage patches once a year.",
    "Dani, housemate. She wore a different vintage jacket every day of our first month.",
    "eli-novak, jasper-quinn",
    "Ask her to shop for a jacket ; Visit LA in the winter",
    [
      ["2026-08-15", "Phone call", "She showed me a 1970s denim jacket she found for nine dollars. Sent me the link to the thrift store's tiny website.", 10],
      ["2023-01-14", "LA trip", "Spent a Sunday going through four thrift stores and a swap meet. I came home with a leather jacket."],
    ],
  ],

  // ---- The student newspaper ----
  [
    "alex-ferrante", "Alex Ferrante", "work+social", "college", "Reporter at a national paper", "Manhattan, NY/Upper West Side", "Rochester, NY", "Ann Arbor|Student newspaper", "2015-09-15", "2026-09-22", 3,
    "journalism, politics, running, writing",
    "Editor-in-chief when I joined as the staff illustrator. Now a national reporter who covers housing. Taught me that a good headline is a design problem.",
    "Alex, the editor who edited my first illustration into something readable.",
    "lena-fischer, sunita-rao, paul-everett",
    "Illustrate his housing story ; Grab dinner after his deadline",
    [
      ["2026-09-22", "Dinner after a deadline", "He had just filed a story on rent regulation. Asked me to make a chart that does not lie.", 12],
      ["2021-10-15", "Welcome to New York", "He took me for a very long walk through his old beats and bought me a slice."],
    ],
  ],
  [
    "sunita-rao", "Sunita Rao", "social", "college", "Data journalist", "Washington, DC", "Edison, NJ", "Ann Arbor|Student newspaper", "2015-09-15", "2026-04-12", 2,
    "journalism, data, sports, cooking",
    "Sports editor who made the whole section run on spreadsheets. Now a data journalist in DC and the only person I trust with a pivot table. Hosts an annual bracket pool.",
    "Sunita, sports. She argued with the editor over a comma and won.",
    "alex-ferrante, keisha-williams",
    "Join the bracket pool ; Ask her about a chart style guide",
    [
      ["2026-04-12", "Bracket pool", "She sent me the standings and a very kind email about my last-place finish.", 8],
      ["2020-03-12", "Video call", "The first remote hangout of the pandemic. We watched an empty arena on a stream together."],
    ],
  ],
  [
    "paul-everett", "Paul Everett", "work+social", "college", "Photo editor", "Chicago/Wicker Park", "Grand Rapids", "Ann Arbor|Student newspaper", "2015-09-15", "2026-03-04", 2,
    "photography, newsroom, jazz, biking",
    "The paper's photo editor and the reason my layouts looked decent. Photo editor at a Chicago daily now. Bikes everywhere and keeps every contact sheet.",
    "Paul, photo desk. He cropped my illustration into a better one.",
    "alex-ferrante, lena-fischer",
    "Send him my layout ; Visit when I am in Chicago",
    [
      ["2026-03-04", "Phone call", "He told me about covering a flood and not sleeping for two days. Said the best photo was the one he did not take.", 12],
      ["2019-04-27", "Last print issue party", "We all signed a copy of the final front page."],
    ],
  ],
  [
    "lena-fischer", "Lena Fischer", "social+work", "college", "Managing editor at a nonprofit newsroom", "Queens, NY/Astoria", "Milwaukee", "Ann Arbor|Student newspaper", "2015-09-22", "2026-10-01", 3,
    "editing, journalism, running, crosswords",
    "Copy chief who has never let a typo through. Moved to Astoria for a newsroom job the same summer I came to New York. We do the Sunday crossword over the phone.",
    "Lena, copy desk. Corrected my spelling on the welcome sheet.",
    "alex-ferrante, paul-everett, sunita-rao",
    "Finish the crossword ; Ask her to proofread the case study",
    [
      ["2026-10-01", "Crossword call", "We finished it in forty minutes. She told me about a funder pulling out and what it means for the newsroom.", 13],
      ["2021-09-02", "First New York dinner", "She met me at the subway with a map of the five best bagel places."],
    ],
  ],
  [
    "jasper-quinn", "Jasper Quinn", "social", "college", "Animator", "Los Angeles/Echo Park", "Portland", "Ann Arbor|Student newspaper", "2016-01-20", "2026-07-08", 2,
    "animation, comics, film, drawing",
    "Drew the paper's weekly comic strip and quietly became one of the best animators I know. Works on an animated series in Los Angeles. Still sends me hand-drawn birthday cards.",
    "Jasper, the cartoonist. His strip made the paper worth reading.",
    "dani-moreno",
    "Show him my motion test ; Send him a card",
    [
      ["2026-07-08", "Studio visit on video", "He showed me his storyboard wall. It stretched around a whole office.", 11],
      ["2019-12-14", "Graduation drawing", "He gave me a drawing of the newspaper staff as raccoons."],
    ],
  ],

  // ---- Club ultimate ----
  [
    "cass-whitaker", "Cass Whitaker", "social+community", "college", "Gym teacher and ultimate coach", "Ann Arbor", "Ann Arbor", "Ann Arbor|Club ultimate", "2015-09-05", "2026-09-14", 2,
    "ultimate frisbee, coaching, teaching, running",
    "Our club captain. Taught me the forehand and how to lose with a smile. Still lives in Ann Arbor, teaches PE and coaches the club.",
    "Cass, captain. Handed me a disc and said throw it to anyone but me.",
    "tomas-herrera, ty-nakamura, rosa-delgado, june-park",
    "Come to the alumni tournament ; Send her my old jersey",
    [
      ["2026-09-14", "Phone call", "She is coaching the club to a regional final. Wants me to come and cheer, wearing the old jersey.", 10],
      ["2022-04-30", "Alumni tournament", "I played for forty minutes, pulled a muscle, and loved every second."],
    ],
  ],
  [
    "ty-nakamura", "Ty Nakamura", "social", "college", "Software engineer", "San Francisco/SoMa", "Honolulu", "Ann Arbor|Club ultimate", "2015-09-05", "2026-07-02", 2,
    "software, ultimate frisbee, surfing, board games",
    "Fastest cutter on the team. Moved to the Bay Area for an engineering job and plays on a competitive league on weekends. Good at everything, annoying about it.",
    "Ty, the quiet one with the unreasonable vertical.",
    "cass-whitaker, finn-oliver",
    "Meet for coffee on my SF trip ; Ask him for a startup intro",
    [
      ["2026-07-02", "Phone call", "He is thinking about leaving his company for a smaller one. Wanted a second opinion on the design culture there.", 13],
      ["2023-08-19", "SF visit", "We watched his league game from the sidelines and he scored four times."],
    ],
  ],
  [
    "rosa-delgado", "Rosa Delgado", "social+community", "college", "Physician assistant", "Brooklyn, NY/Crown Heights", "San Antonio", "Ann Arbor|Club ultimate", "2016-09-04", "2026-10-11", 3,
    "ultimate frisbee, medicine, running, dancing",
    "Played defense like she was personally offended. A physician assistant at a Brooklyn hospital, plays in a co-ed league on Randall's Island and keeps the club's group chat alive from three states.",
    "Rosa, the best defender I have ever tried to get away from. She said hi after the game and I said I was sorry.",
    "neil-banerjee, cass-whitaker, eli-novak",
    "Play Saturday on Randall's Island ; Ask her to look at my sore shoulder",
    [
      ["2026-10-11", "League game", "Played the second half. We lost by two. Afterward she walked me to the train and quizzed me on my knee.", 12],
      ["2022-08-27", "Her housewarming", "Brought a plant. She gave it to the neighbor, the plant is thriving."],
    ],
  ],
  [
    "finn-oliver", "Finn Oliver", "social", "college", "Environmental consultant", "Portland", "Minneapolis", "Ann Arbor|Club ultimate", "2016-09-04", "2026-01-19", 1,
    "environment, ultimate frisbee, cycling, beer",
    "Handler on the team and the best passer I know. Does environmental assessments for developers in Portland. Plans the club's annual alumni camping weekend.",
    "Finn, the handler. Passed the disc so accurately I assumed he was a robot.",
    "ty-nakamura, june-park",
    "Reserve a campsite for the alumni weekend ; Call on his birthday",
    [
      ["2026-01-19", "Phone call", "He is cutting his work travel in half and is delighted about it. Plans to bike the entire coast.", 10],
      ["2021-07-17", "Camping weekend", "Eight of us in a field with one burner. Burned the pancakes and ate them anyway."],
    ],
  ],
  [
    "june-park", "June Park", "social", "college", "Architecture graduate student", "Boston/Cambridge", "Fairfax", "Ann Arbor|Club ultimate", "2016-09-04", "2026-06-06", 2,
    "architecture, ultimate frisbee, drawing, tea",
    "Played ultimate in a headband and drew buildings on the sidelines. Now a graduate student of architecture in Cambridge. Wants to design a school someday.",
    "June, the one drawing a building on a napkin during halftime.",
    "cass-whitaker, finn-oliver, grace-kim",
    "Visit her studio crit ; Send the napkin drawing back",
    [
      ["2026-06-06", "Studio visit", "She walked me through her model of a school. The windows were arranged by the angle of afternoon light.", 12],
      ["2019-05-09", "Last game of college", "We cried on the field. Someone brought orange slices."],
    ],
  ],

  // ---- Design school ----
  [
    "chloe-bernard", "Chloe Bernard", "social+work", "college", "Fashion designer", "Brooklyn, NY/Greenpoint", "Montreal", "Ann Arbor|Design school studio", "2016-01-18", "2026-10-15", 3,
    "fashion, design, sewing, vintage",
    "Studied fashion design a floor above me and we shared studio snacks for three years. After a few assistant jobs she is now a designer at a small Brooklyn label. Throws a studio sale twice a year and everyone dresses up for it.",
    "Chloe, fashion design. She pinned my sweater so it would fit and called it a mood.",
    "dev-malhotra, tamsin-okoro, imani-brooks, emily-chung",
    "Go to the autumn studio sale ; Help with the lookbook layout",
    [
      ["2026-10-15", "Studio sale planning", "She asked me to design the invitation. The theme is deconstructed tailoring and the dress code is tailoring that has been through a washing machine.", 14],
      ["2022-03-09", "Her first label job", "Celebrated at a bar in Greenpoint. She had her sketchbook on the table the whole night."],
      ["2024-09-14", "Fashion week show", "Stood at the back of her label's tiny show. She came out at the end and walked off the runway to hug me."],
    ],
  ],
  [
    "dev-malhotra", "Dev Malhotra", "work+social", "college", "Industrial designer", "Brooklyn, NY/Gowanus", "Pune", "Ann Arbor|Design school studio", "2016-01-18", "2026-09-26", 2,
    "industrial design, lighting, woodworking, running",
    "Industrial design classmate who made a lamp so good the professor kept it. Designs lighting for a small Brooklyn company and shares a studio space in Gowanus.",
    "Dev, industrial design. He fixed my model with a single clamp.",
    "chloe-bernard, theo-park",
    "Visit the Gowanus studio ; Ask about a desk lamp",
    [
      ["2026-09-26", "Studio visit", "A shared room full of lamps in various stages. He gave me a prototype to take home.", 11],
      ["2021-12-04", "Holiday sale", "I bought a lamp I still use every night."],
    ],
  ],
  [
    "isabel-correa", "Isabel Correa", "social+work", "college", "Brand designer", "Mexico City", "Mexico City", "Ann Arbor|Design school studio", "2016-01-18", "2026-05-22", 2,
    "typography, branding, design, books",
    "The typography nerd in our year, with a map of Mexico City's best hand-painted signs on her wall. Runs a small brand studio in her hometown. Always sends me type specimens.",
    "Isabel, the type person. She corrected my kerning in front of the class.",
    "wes-tran, hiro-sato",
    "Send my wordmark for her opinion ; Visit CDMX",
    [
      ["2026-05-22", "Video call", "She walked me through a rebrand she did for a taqueria. Every sign painted by hand.", 12],
      ["2023-11-05", "Visited Mexico City", "She took me to a letterpress shop and gave me a type specimen book."],
    ],
  ],
  [
    "wes-tran", "Wes Tran", "work+social", "college", "Design director", "San Francisco/SoMa", "San Jose", "Ann Arbor|Design school studio", "2016-01-18", "2026-08-09", 2,
    "design, mentoring, interaction design, coffee",
    "Interaction design classmate who was always a few years ahead. Now a design director at a Bay Area company. Gave me the push to leave Chicago for New York.",
    "Wes, interaction design. He asked what I was most afraid of in my project and made me start there.",
    "isabel-correa, ty-nakamura, daniel-okafor",
    "Meet him on my SF trip ; Ask him for a portfolio review",
    [
      ["2026-08-09", "Phone call", "He told me he is hiring a senior designer. I said I was happy where I am and he said ok but think about it.", 10],
      ["2021-05-20", "Call before the move", "He talked me out of two excuses for staying in Chicago. I moved in August."],
    ],
  ],
  [
    "noor-aziz", "Noor Aziz", "social", "college", "Motion designer", "London", "Dubai", "Ann Arbor|Design school studio", "2016-01-18", "2026-03-27", 1,
    "motion design, animation, music, film",
    "Illustration major who ended up doing motion graphics for a London studio. Her title sequences are the best part of any show. Sends me playlists when she is working late.",
    "Noor, the illustrator who drew on the studio wall and was never told off.",
    "hiro-sato",
    "Watch her new title sequence ; Send her a playlist back",
    [
      ["2026-03-27", "Video call", "She was in the middle of a deadline and shared her screen for a minute. A title sequence that looked like moving watercolor.", 9],
      ["2022-07-09", "London trip", "Dinner near her studio. She sketched the whole table on a napkin."],
    ],
  ],

  // ---- Mentors ----
  [
    "margaret-holloway", "Professor Margaret Holloway", "work+community", "college", "Design professor", "Ann Arbor", "Detroit", "Ann Arbor|Design studio class", "2016-09-06", "2026-04-30", 2,
    "design, teaching, mentoring, research",
    "My studio professor and the person who first said I could be a designer. Writes me a thoughtful reply to every email in the same afternoon. Retiring in two years.",
    "Professor Holloway. She wrote 'start again' on my first project and I still think she was right.",
    "anil-sethi",
    "Thank her in person ; Send her my new case study",
    [
      ["2026-04-30", "Coffee in Ann Arbor", "She gave me the best critique I have had in years. Told me I design for the room and not for the person.", 15],
      ["2021-06-14", "Reference call", "She vouched for me for the New York job. I got the offer the next day."],
    ],
  ],
  [
    "anil-sethi", "Anil Sethi", "work+community", "college", "Design history lecturer", "Ann Arbor", "Mumbai", "Ann Arbor|Design history seminar", "2017-09-05", "2025-12-08", 1,
    "design history, writing, teaching, tea",
    "Taught the design history seminar and made me read way too much. Now writing a book on the Bauhaus and its imitators. Still answers any email with a reading list.",
    "Professor Sethi, design history. Assigned forty pages a night.",
    "margaret-holloway",
    "Read his draft chapter ; Reply to his reading list",
    [
      ["2025-12-08", "Email", "He sent a list of eleven books after I asked one question. I read two and wrote him a thank you.", 8],
      ["2019-04-15", "Thesis feedback", "He wrote 'good, now delete half' on page one."],
    ],
  ],

  // ---- Copenhagen, fall 2018 ----
  [
    "astrid-nielsen", "Astrid Nielsen", "social", "college", "Furniture designer", "Copenhagen", "Aarhus", "Copenhagen|Study abroad, design school", "2018-09-03", "2026-06-14", 2,
    "furniture, design, cycling, baking",
    "My buddy from the Danish design school in my semester abroad. Taught me to bike in the rain and to say tak for everything. Designs chairs for a small Copenhagen furniture company.",
    "Astrid, my study abroad buddy. She laughed at my first attempt at a Danish word, kindly.",
    "liam-oconnor, caio-barbosa",
    "Visit her studio next time ; Ask about a chair for the apartment",
    [
      ["2026-06-14", "Video call", "She showed me a chair that took a year to design. Asked what I thought about the armrest.", 12],
      ["2023-05-27", "Visited Copenhagen", "She cycled us across the city, and we ate open sandwiches on the water."],
    ],
  ],
  [
    "caio-barbosa", "Caio Barbosa", "social", "college", "Architect", "São Paulo", "São Paulo", "Copenhagen|Study abroad, design school", "2018-09-03", "2025-10-30", 1,
    "architecture, football, music, cooking",
    "Another exchange student in Copenhagen, who taught the whole dorm to cook feijoada. Now an architect in São Paulo working on social housing.",
    "Caio, from Brazil. He turned our dorm kitchen into a restaurant on Sundays.",
    "astrid-nielsen",
    "Visit São Paulo ; Learn the feijoada recipe",
    [
      ["2025-10-30", "Phone call", "He sent photos of a social housing project he has been on for three years. The balconies looked like gardens.", 10],
      ["2019-01-18", "Last night in Copenhagen", "He made a huge pot of beans. We ate until midnight and then walked in the snow."],
    ],
  ],
  [
    "emily-chung", "Emily Chung", "social+work", "college", "Architect", "Queens, NY/Long Island City", "Vancouver", "Copenhagen|Study abroad, design school", "2018-09-03", "2026-10-09", 3,
    "architecture, design, cycling, cooking",
    "Studied abroad in the same semester and we stayed best friends. Now an architect at a firm in Long Island City and my frequent coffee partner. We trade apartment layouts like trading cards.",
    "Emily, from my program. We got lost together in Copenhagen on the first night.",
    "chloe-bernard, astrid-nielsen",
    "Coffee on Thursday ; Show her the apartment layout",
    [
      ["2026-10-09", "Coffee in LIC", "She is leading a small community center project. Asked if I would help with signage.", 13],
      ["2022-02-20", "Apartment tour", "She walked through my Bushwick place and suggested moving the bed. She was right."],
    ],
  ],

  // ---- More college friends ----
  [
    "malik-johnson", "Malik Johnson", "social", "college", "Music supervisor", "Los Angeles", "Detroit", "Ann Arbor|A cappella group", "2015-09-12", "2026-05-12", 1,
    "music, a cappella, film, vinyl",
    "Sang tenor in my friend group's a cappella group, which I was only allowed to attend as a fan. Now picks songs for TV shows in Los Angeles. Sends playlists and takes no requests.",
    "Malik, tenor. He told me I could only come if I clapped on the beat.",
    "jasper-quinn",
    "Ask for a playlist ; Hear about the show",
    [
      ["2026-05-12", "Phone call", "He got a song into a finale and called me from the sidewalk. We replayed the scene on speaker.", 9],
      ["2019-04-21", "Spring concert", "They sang a song I will never get out of my head."],
    ],
  ],
  [
    "gabriela-ruiz", "Gabriela Ruiz", "community+social", "college", "Public health researcher", "Manhattan, NY/Washington Heights", "El Paso", "Ann Arbor|Co-op house", "2017-08-28", "2026-09-30", 2,
    "public health, community, cooking, dancing",
    "Co-op housemate who ran the house garden. Now studies housing and health in Washington Heights. Organizes a neighborhood potluck on the last Saturday of every month.",
    "Gabi, the co-op manager. She handed me a chore chart on the first day.",
    "neil-banerjee, lena-fischer",
    "Bring a dish to the potluck ; Send the housing chart",
    [
      ["2026-09-30", "Potluck", "Forty people in a courtyard. She introduced me to a landlord who actually fixes things.", 12],
      ["2021-11-06", "My first New York potluck", "Brought store-bought cookies and was gently roasted."],
    ],
  ],
  [
    "declan-burke", "Declan Burke", "social", "college", "Pizza popup owner", "Chicago/Wicker Park", "Boston", "Ann Arbor|Late-night pizza", "2017-02-10", "2026-04-02", 1,
    "pizza, food, small business, music",
    "Sold slices out of the back of his house at 1am and it was the best part of junior year. Runs a weekly pizza popup in Chicago now with a loyal line out the door.",
    "Declan, the slice guy. He gave me a free one when I told him I was a design student.",
    "paul-everett",
    "Visit the popup in Chicago ; Design his menu",
    [
      ["2026-04-02", "Visited the popup", "A line around the block. He gave me a slice and put me to work for an hour.", 9],
      ["2018-10-12", "Late night", "Ate pizza on the porch and planned a business he went on to start."],
    ],
  ],
  [
    "anna-kowalski", "Anna Kowalski", "social+work", "college", "Product marketing manager", "Arlington", "Pittsburgh", "Ann Arbor|Intramural softball", "2016-04-10", "2026-02-08", 1,
    "marketing, softball, travel, cooking",
    "Played second base on the intramural softball team I joined for the snacks. Now a product marketing manager in Arlington, still planning trips two years ahead.",
    "Anna, second base. She told me where to stand and I stood there.",
    "keisha-williams",
    "Plan a weekend in DC ; Send her the softball team photo",
    [
      ["2026-02-08", "Phone call", "She is taking a sabbatical and wants to travel through Portugal. Asked for my restaurant list.", 10],
      ["2019-03-01", "Softball tournament", "We lost in the semifinals and still got ice cream."],
    ],
  ],
  [
    "julian-reyes", "Julian Reyes", "social+work", "college", "Investment banking associate", "Manhattan, NY/Financial District", "Miami", "Ann Arbor|Study group", "2016-09-05", "2026-08-20", 2,
    "finance, running, sneakers, cooking",
    "Statistics study group friend who ended up in finance. Collects sneakers, runs along the Hudson at 5am and cooks a mean paella. Always the first to say yes to a plan.",
    "Julian, the study group. He made flashcards that were actually funny.",
    "neil-banerjee, rosa-delgado",
    "Run the Hudson on Saturday ; Ask about his sneaker collection",
    [
      ["2026-08-20", "Rooftop dinner", "His paella for twelve. He had never cooked for twelve before and it was perfect.", 11],
      ["2021-09-25", "Moved to New York", "He met me with a spare key to his place for a week. I used it for two nights."],
    ],
  ],
])
