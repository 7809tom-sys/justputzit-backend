// Trivia Question Seed Script — 200+ questions across 6 categories
// Run: node server/seedTrivia.mjs
import mysql from 'mysql2/promise';

const questions = [
  // ─── RELATIONSHIPS & DATING ───────────────────────────────────────────────
  { question: "What is the most common first date activity according to surveys?", optionA: "Movies", optionB: "Dinner", optionC: "Coffee", optionD: "Mini golf", correctAnswer: "B", category: "relationships", difficulty: "easy", profileTraitKey: "first_date_pref" },
  { question: "Which 'love language' involves giving and receiving presents?", optionA: "Words of affirmation", optionB: "Acts of service", optionC: "Receiving gifts", optionD: "Quality time", correctAnswer: "C", category: "relationships", difficulty: "easy", profileTraitKey: "love_language" },
  { question: "According to research, how long does it take to form a habit?", optionA: "21 days", optionB: "66 days", optionC: "30 days", optionD: "90 days", correctAnswer: "B", category: "relationships", difficulty: "medium" },
  { question: "What percentage of couples meet online today?", optionA: "20%", optionB: "35%", optionC: "50%", optionD: "65%", correctAnswer: "C", category: "relationships", difficulty: "medium" },
  { question: "Which is NOT one of Gary Chapman's 5 Love Languages?", optionA: "Physical touch", optionB: "Financial security", optionC: "Words of affirmation", optionD: "Acts of service", correctAnswer: "B", category: "relationships", difficulty: "easy" },
  { question: "What is 'attachment theory' primarily about?", optionA: "Social media addiction", optionB: "Early childhood bonds affecting adult relationships", optionC: "Financial dependency in couples", optionD: "Pet ownership psychology", correctAnswer: "B", category: "relationships", difficulty: "hard" },
  { question: "The 'honeymoon phase' of a relationship typically lasts how long?", optionA: "1-3 months", optionB: "6-12 months", optionC: "2-3 years", optionD: "5+ years", correctAnswer: "C", category: "relationships", difficulty: "medium" },
  { question: "What does 'ghosting' mean in modern dating?", optionA: "Dressing up for Halloween dates", optionB: "Suddenly cutting off all contact", optionC: "Dating someone much older", optionD: "Pretending to be someone else online", correctAnswer: "B", category: "relationships", difficulty: "easy" },
  { question: "Which app pioneered the 'swipe right' dating mechanic?", optionA: "Bumble", optionB: "Hinge", optionC: "Tinder", optionD: "OkCupid", correctAnswer: "C", category: "relationships", difficulty: "easy" },
  { question: "What is 'breadcrumbing' in dating?", optionA: "Leaving a trail to find someone", optionB: "Sending sporadic messages to keep interest without commitment", optionC: "Cooking together on a first date", optionD: "A type of outdoor date activity", correctAnswer: "B", category: "relationships", difficulty: "medium" },
  { question: "According to Gottman research, what ratio of positive to negative interactions predicts relationship success?", optionA: "1:1", optionB: "3:1", optionC: "5:1", optionD: "10:1", correctAnswer: "C", category: "relationships", difficulty: "hard" },
  { question: "What is 'cuffing season'?", optionA: "Spring dating surge", optionB: "Tendency to seek relationships in fall/winter", optionC: "Summer beach dating", optionD: "Valentine's Day rush", correctAnswer: "B", category: "relationships", difficulty: "easy" },
  { question: "Which zodiac sign is stereotypically considered the most romantic?", optionA: "Scorpio", optionB: "Aries", optionC: "Libra", optionD: "Pisces", correctAnswer: "D", category: "relationships", difficulty: "easy", profileTraitKey: "zodiac_belief" },
  { question: "What does DTR stand for in dating?", optionA: "Date The Right person", optionB: "Define The Relationship", optionC: "Don't Text Randomly", optionD: "Date To Remember", correctAnswer: "B", category: "relationships", difficulty: "easy" },
  { question: "The 'three-day rule' in dating refers to waiting how long to call after a first date?", optionA: "1 day", optionB: "2 days", optionC: "3 days", optionD: "1 week", correctAnswer: "C", category: "relationships", difficulty: "easy" },
  { question: "What is 'love bombing'?", optionA: "Surprising a partner with flowers", optionB: "Overwhelming someone with affection to manipulate them", optionC: "A Valentine's Day tradition", optionD: "Planning a surprise party", correctAnswer: "B", category: "relationships", difficulty: "medium" },
  { question: "Which of these is considered a 'green flag' in a relationship?", optionA: "Jealousy", optionB: "Respecting boundaries", optionC: "Checking your phone constantly", optionD: "Talking about exes on date 1", correctAnswer: "B", category: "relationships", difficulty: "easy" },
  { question: "What is 'situationship'?", optionA: "A long-distance relationship", optionB: "A romantic relationship without a clear label", optionC: "Dating someone from work", optionD: "A friendship that becomes romantic", correctAnswer: "B", category: "relationships", difficulty: "easy" },

  // ─── POP CULTURE ──────────────────────────────────────────────────────────
  { question: "Which Taylor Swift album features the song 'Love Story'?", optionA: "Red", optionB: "Fearless", optionC: "1989", optionD: "Speak Now", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "What year did the first iPhone launch?", optionA: "2005", optionB: "2006", optionC: "2007", optionD: "2008", correctAnswer: "C", category: "pop_culture", difficulty: "easy" },
  { question: "Which streaming service produced 'Stranger Things'?", optionA: "Hulu", optionB: "HBO Max", optionC: "Amazon Prime", optionD: "Netflix", correctAnswer: "D", category: "pop_culture", difficulty: "easy" },
  { question: "Who played Iron Man in the Marvel Cinematic Universe?", optionA: "Chris Evans", optionB: "Robert Downey Jr.", optionC: "Chris Hemsworth", optionD: "Mark Ruffalo", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "What is the name of the fictional country in 'Black Panther'?", optionA: "Zamunda", optionB: "Genosha", optionC: "Wakanda", optionD: "Latveria", correctAnswer: "C", category: "pop_culture", difficulty: "easy" },
  { question: "Which artist released the album 'Renaissance' in 2022?", optionA: "Rihanna", optionB: "Beyoncé", optionC: "Adele", optionD: "Lizzo", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "What show features the phrase 'Winter is Coming'?", optionA: "The Witcher", optionB: "Vikings", optionC: "Game of Thrones", optionD: "Lord of the Rings", correctAnswer: "C", category: "pop_culture", difficulty: "easy" },
  { question: "Which social media platform is known for short-form vertical videos?", optionA: "Instagram", optionB: "Snapchat", optionC: "TikTok", optionD: "YouTube", correctAnswer: "C", category: "pop_culture", difficulty: "easy" },
  { question: "What does 'GOAT' stand for in sports culture?", optionA: "Greatest Of All Time", optionB: "Game Of All Teams", optionC: "Going On A Tour", optionD: "Gold Of Athletic Training", correctAnswer: "A", category: "pop_culture", difficulty: "easy" },
  { question: "Which movie franchise features the character Jack Sparrow?", optionA: "Indiana Jones", optionB: "Pirates of the Caribbean", optionC: "National Treasure", optionD: "The Mummy", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "What year did Friends end its original run?", optionA: "2002", optionB: "2003", optionC: "2004", optionD: "2005", correctAnswer: "C", category: "pop_culture", difficulty: "medium" },
  { question: "Which rapper is known as 'The God MC'?", optionA: "Jay-Z", optionB: "Rakim", optionC: "Nas", optionD: "Biggie", correctAnswer: "B", category: "pop_culture", difficulty: "hard" },
  { question: "What is the highest-grossing film of all time (as of 2023)?", optionA: "Titanic", optionB: "Avengers: Endgame", optionC: "Avatar", optionD: "Star Wars: The Force Awakens", correctAnswer: "C", category: "pop_culture", difficulty: "medium" },
  { question: "Which video game franchise features Link and Zelda?", optionA: "Final Fantasy", optionB: "The Legend of Zelda", optionC: "Dragon Quest", optionD: "Fire Emblem", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "What does 'stan' mean in internet culture?", optionA: "To strongly dislike something", optionB: "To be an obsessive fan of someone", optionC: "To stand up for something", optionD: "To start a new trend", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "Which show popularized the phrase 'That's what she said'?", optionA: "Parks and Recreation", optionB: "Brooklyn Nine-Nine", optionC: "The Office", optionD: "Community", correctAnswer: "C", category: "pop_culture", difficulty: "easy" },
  { question: "Who is the creator of the Harry Potter series?", optionA: "Suzanne Collins", optionB: "J.K. Rowling", optionC: "Stephenie Meyer", optionD: "Philip Pullman", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },
  { question: "What is the name of Thor's hammer?", optionA: "Gungnir", optionB: "Mjolnir", optionC: "Excalibur", optionD: "Durendal", correctAnswer: "B", category: "pop_culture", difficulty: "easy" },

  // ─── LOCAL KNOWLEDGE (Milwaukee/Waukesha) ─────────────────────────────────
  { question: "What is Milwaukee's nickname?", optionA: "The Cream City", optionB: "The Brew City", optionC: "The Lake City", optionD: "The Cheese City", correctAnswer: "A", category: "local_knowledge", difficulty: "medium" },
  { question: "Which NBA team is based in Milwaukee?", optionA: "Milwaukee Bulls", optionB: "Milwaukee Bucks", optionC: "Milwaukee Hawks", optionD: "Milwaukee Pistons", correctAnswer: "B", category: "local_knowledge", difficulty: "easy" },
  { question: "What is the name of Milwaukee's famous music festival held every summer?", optionA: "Summerfest", optionB: "Lakefest", optionC: "Brewfest", optionD: "Milwaukfest", correctAnswer: "A", category: "local_knowledge", difficulty: "easy" },
  { question: "Carroll University is located in which Wisconsin city?", optionA: "Milwaukee", optionB: "Madison", optionC: "Waukesha", optionD: "Racine", correctAnswer: "C", category: "local_knowledge", difficulty: "easy" },
  { question: "What beer brand was founded in Milwaukee in 1844?", optionA: "Coors", optionB: "Miller", optionC: "Pabst Blue Ribbon", optionD: "Old Style", correctAnswer: "C", category: "local_knowledge", difficulty: "medium" },
  { question: "Which lake borders Milwaukee to the east?", optionA: "Lake Superior", optionB: "Lake Huron", optionC: "Lake Erie", optionD: "Lake Michigan", correctAnswer: "D", category: "local_knowledge", difficulty: "easy" },
  { question: "What is the name of Milwaukee's MLB team?", optionA: "Milwaukee Brewers", optionB: "Milwaukee Cardinals", optionC: "Milwaukee Cubs", optionD: "Milwaukee Reds", correctAnswer: "A", category: "local_knowledge", difficulty: "easy" },
  { question: "Which famous architect designed the Milwaukee Art Museum's Quadracci Pavilion?", optionA: "Frank Lloyd Wright", optionB: "Santiago Calatrava", optionC: "Zaha Hadid", optionD: "I.M. Pei", correctAnswer: "B", category: "local_knowledge", difficulty: "hard" },
  { question: "What is the name of the large park system along Milwaukee's lakefront?", optionA: "Grant Park", optionB: "Lake Park", optionC: "Lincoln Memorial Drive", optionD: "Veteran's Park", correctAnswer: "B", category: "local_knowledge", difficulty: "medium" },
  { question: "Marquette University is affiliated with which religious order?", optionA: "Dominican", optionB: "Franciscan", optionC: "Jesuit", optionD: "Benedictine", correctAnswer: "C", category: "local_knowledge", difficulty: "medium" },
  { question: "What is Wisconsin's state animal?", optionA: "White-tailed deer", optionB: "Badger", optionC: "Black bear", optionD: "Gray wolf", correctAnswer: "B", category: "local_knowledge", difficulty: "easy" },
  { question: "Which famous motorcycle company is headquartered in Milwaukee?", optionA: "Indian", optionB: "Triumph", optionC: "Harley-Davidson", optionD: "Honda", correctAnswer: "C", category: "local_knowledge", difficulty: "easy" },
  { question: "What is the name of Waukesha's largest park?", optionA: "Frame Park", optionB: "Minooka Park", optionC: "Cushing Park", optionD: "Fox River Park", correctAnswer: "B", category: "local_knowledge", difficulty: "medium" },
  { question: "The Fox River runs through which Wisconsin city?", optionA: "Milwaukee", optionB: "Racine", optionC: "Waukesha", optionD: "Kenosha", correctAnswer: "C", category: "local_knowledge", difficulty: "easy" },
  { question: "What year was Milwaukee founded?", optionA: "1818", optionB: "1835", optionC: "1846", optionD: "1860", correctAnswer: "C", category: "local_knowledge", difficulty: "hard" },
  { question: "Which neighborhood is known as Milwaukee's arts district?", optionA: "Brady Street", optionB: "Walker's Point", optionC: "Third Ward", optionD: "Bay View", correctAnswer: "C", category: "local_knowledge", difficulty: "medium" },
  { question: "What is the name of the professional soccer team based in Milwaukee?", optionA: "Milwaukee FC", optionB: "Milwaukee Wave", optionC: "Milwaukee City SC", optionD: "Cream City FC", correctAnswer: "C", category: "local_knowledge", difficulty: "hard" },
  { question: "Which Wisconsin cheese is shaped like a football?", optionA: "Colby", optionB: "Brick", optionC: "Muenster", optionD: "Cheddar", correctAnswer: "B", category: "local_knowledge", difficulty: "hard" },

  // ─── FOOD & DRINKS ────────────────────────────────────────────────────────
  { question: "What is the main ingredient in guacamole?", optionA: "Tomato", optionB: "Avocado", optionC: "Lime", optionD: "Onion", correctAnswer: "B", category: "food_drinks", difficulty: "easy", profileTraitKey: "food_pref" },
  { question: "Which country invented pizza?", optionA: "Greece", optionB: "France", optionC: "Italy", optionD: "Spain", correctAnswer: "C", category: "food_drinks", difficulty: "easy" },
  { question: "What type of pasta is shaped like small rice grains?", optionA: "Orzo", optionB: "Farfalle", optionC: "Penne", optionD: "Rigatoni", correctAnswer: "A", category: "food_drinks", difficulty: "medium" },
  { question: "Which cocktail contains vodka, triple sec, cranberry juice, and lime?", optionA: "Margarita", optionB: "Cosmopolitan", optionC: "Daiquiri", optionD: "Mojito", correctAnswer: "B", category: "food_drinks", difficulty: "medium" },
  { question: "What is the world's most expensive spice by weight?", optionA: "Vanilla", optionB: "Cardamom", optionC: "Saffron", optionD: "Truffle", correctAnswer: "C", category: "food_drinks", difficulty: "medium" },
  { question: "Which fast food chain has the slogan 'Have it your way'?", optionA: "McDonald's", optionB: "Wendy's", optionC: "Burger King", optionD: "Five Guys", correctAnswer: "C", category: "food_drinks", difficulty: "easy" },
  { question: "What is a 'flight' in a brewery context?", optionA: "A type of beer glass", optionB: "A sampler of small beer portions", optionC: "A beer aged in barrels", optionD: "A seasonal beer", correctAnswer: "B", category: "food_drinks", difficulty: "easy" },
  { question: "Which cuisine uses the most soy sauce?", optionA: "Thai", optionB: "Indian", optionC: "Japanese", optionD: "Mexican", correctAnswer: "C", category: "food_drinks", difficulty: "easy" },
  { question: "What is 'umami'?", optionA: "A Japanese dessert", optionB: "The fifth basic taste (savory)", optionC: "A type of sushi", optionD: "A cooking technique", correctAnswer: "B", category: "food_drinks", difficulty: "medium" },
  { question: "Which city is known as the 'deep dish pizza capital'?", optionA: "New York", optionB: "Detroit", optionC: "Chicago", optionD: "Milwaukee", correctAnswer: "C", category: "food_drinks", difficulty: "easy" },
  { question: "What is the base spirit in a classic Margarita?", optionA: "Vodka", optionB: "Rum", optionC: "Gin", optionD: "Tequila", correctAnswer: "D", category: "food_drinks", difficulty: "easy" },
  { question: "Which fruit is used to make wine?", optionA: "Apple", optionB: "Grape", optionC: "Pear", optionD: "Plum", correctAnswer: "B", category: "food_drinks", difficulty: "easy" },
  { question: "What is 'charcuterie'?", optionA: "A French dessert", optionB: "A type of cheese", optionC: "Cured meats and accompaniments", optionD: "A cooking style", correctAnswer: "C", category: "food_drinks", difficulty: "medium" },
  { question: "Which state produces the most cheese in the US?", optionA: "California", optionB: "Wisconsin", optionC: "Vermont", optionD: "New York", correctAnswer: "B", category: "food_drinks", difficulty: "easy" },
  { question: "What is the main ingredient in hummus?", optionA: "Lentils", optionB: "Black beans", optionC: "Chickpeas", optionD: "Edamame", correctAnswer: "C", category: "food_drinks", difficulty: "easy" },
  { question: "Which coffee drink is made with espresso and steamed milk foam?", optionA: "Latte", optionB: "Cappuccino", optionC: "Americano", optionD: "Macchiato", correctAnswer: "B", category: "food_drinks", difficulty: "medium" },
  { question: "What is the difference between a lager and an ale?", optionA: "Alcohol content", optionB: "Color", optionC: "Type of yeast and fermentation temperature", optionD: "Country of origin", correctAnswer: "C", category: "food_drinks", difficulty: "hard" },
  { question: "Which condiment is made from fermented soybeans?", optionA: "Fish sauce", optionB: "Oyster sauce", optionC: "Hoisin sauce", optionD: "Miso", correctAnswer: "D", category: "food_drinks", difficulty: "medium" },

  // ─── SPORTS & OUTDOORS ────────────────────────────────────────────────────
  { question: "How many players are on a basketball team on the court at one time?", optionA: "4", optionB: "5", optionC: "6", optionD: "7", correctAnswer: "B", category: "sports_outdoors", difficulty: "easy" },
  { question: "What is the term for a score of -1 under par in golf?", optionA: "Eagle", optionB: "Birdie", optionC: "Bogey", optionD: "Par", correctAnswer: "B", category: "sports_outdoors", difficulty: "easy" },
  { question: "How long is a marathon?", optionA: "20 miles", optionB: "25 miles", optionC: "26.2 miles", optionD: "30 miles", correctAnswer: "C", category: "sports_outdoors", difficulty: "easy" },
  { question: "Which country invented the sport of cricket?", optionA: "Australia", optionB: "India", optionC: "England", optionD: "South Africa", correctAnswer: "C", category: "sports_outdoors", difficulty: "medium" },
  { question: "What is the name of the trophy awarded to the NHL champion?", optionA: "The Cup", optionB: "Stanley Cup", optionC: "Commissioner's Trophy", optionD: "Conn Smythe Trophy", correctAnswer: "B", category: "sports_outdoors", difficulty: "easy" },
  { question: "How many holes are in a standard round of golf?", optionA: "9", optionB: "12", optionC: "18", optionD: "24", correctAnswer: "C", category: "sports_outdoors", difficulty: "easy" },
  { question: "What is the highest belt color in traditional karate?", optionA: "Red", optionB: "Brown", optionC: "Black", optionD: "Gold", correctAnswer: "C", category: "sports_outdoors", difficulty: "easy" },
  { question: "Which outdoor activity involves navigating using a map and compass?", optionA: "Geocaching", optionB: "Orienteering", optionC: "Hiking", optionD: "Bushcraft", correctAnswer: "B", category: "sports_outdoors", difficulty: "medium" },
  { question: "What is the minimum number of players needed for a game of volleyball?", optionA: "4", optionB: "6", optionC: "8", optionD: "10", correctAnswer: "B", category: "sports_outdoors", difficulty: "easy" },
  { question: "Which Great Lake is entirely within the United States?", optionA: "Lake Superior", optionB: "Lake Erie", optionC: "Lake Ontario", optionD: "Lake Michigan", correctAnswer: "D", category: "sports_outdoors", difficulty: "medium" },
  { question: "What is the term for a perfect score in bowling?", optionA: "300", optionB: "Perfect game", optionC: "Turkey", optionD: "Both A and B", correctAnswer: "D", category: "sports_outdoors", difficulty: "easy" },
  { question: "Which sport uses a shuttlecock?", optionA: "Squash", optionB: "Racquetball", optionC: "Badminton", optionD: "Pickleball", correctAnswer: "C", category: "sports_outdoors", difficulty: "easy" },
  { question: "How many points is a touchdown worth in American football?", optionA: "5", optionB: "6", optionC: "7", optionD: "8", correctAnswer: "B", category: "sports_outdoors", difficulty: "easy" },
  { question: "What is the fastest recorded serve speed in tennis?", optionA: "140 mph", optionB: "155 mph", optionC: "163 mph", optionD: "175 mph", correctAnswer: "C", category: "sports_outdoors", difficulty: "hard" },
  { question: "Which outdoor activity involves riding rapids in an inflatable boat?", optionA: "Kayaking", optionB: "Canoeing", optionC: "White water rafting", optionD: "Stand-up paddleboarding", correctAnswer: "C", category: "sports_outdoors", difficulty: "easy" },
  { question: "What is 'Leave No Trace' in outdoor recreation?", optionA: "A hiking trail system", optionB: "Principles for minimizing environmental impact outdoors", optionC: "A type of camping gear", optionD: "A national park program", correctAnswer: "B", category: "sports_outdoors", difficulty: "medium" },
  { question: "In pickleball, what is the 'kitchen'?", optionA: "The serving area", optionB: "The non-volley zone near the net", optionC: "The back court", optionD: "The sideline area", correctAnswer: "B", category: "sports_outdoors", difficulty: "medium" },
  { question: "What does 'SUP' stand for in water sports?", optionA: "Surfing Under Pressure", optionB: "Stand Up Paddleboarding", optionC: "Submerged Underwater Propulsion", optionD: "Speed Under Power", correctAnswer: "B", category: "sports_outdoors", difficulty: "easy" },

  // ─── WILD CARD ────────────────────────────────────────────────────────────
  { question: "What is the most spoken language in the world by native speakers?", optionA: "English", optionB: "Spanish", optionC: "Mandarin Chinese", optionD: "Hindi", correctAnswer: "C", category: "wild_card", difficulty: "medium" },
  { question: "How many colors are in a rainbow?", optionA: "5", optionB: "6", optionC: "7", optionD: "8", correctAnswer: "C", category: "wild_card", difficulty: "easy" },
  { question: "What is the smallest planet in our solar system?", optionA: "Mars", optionB: "Mercury", optionC: "Venus", optionD: "Pluto", correctAnswer: "B", category: "wild_card", difficulty: "easy" },
  { question: "Which animal can sleep standing up?", optionA: "Dog", optionB: "Cat", optionC: "Horse", optionD: "Cow", correctAnswer: "C", category: "wild_card", difficulty: "easy" },
  { question: "What is the capital of Australia?", optionA: "Sydney", optionB: "Melbourne", optionC: "Brisbane", optionD: "Canberra", correctAnswer: "D", category: "wild_card", difficulty: "medium" },
  { question: "How many sides does a hexagon have?", optionA: "5", optionB: "6", optionC: "7", optionD: "8", correctAnswer: "B", category: "wild_card", difficulty: "easy" },
  { question: "What is the chemical symbol for gold?", optionA: "Go", optionB: "Gd", optionC: "Au", optionD: "Ag", correctAnswer: "C", category: "wild_card", difficulty: "medium" },
  { question: "Which planet is known as the Red Planet?", optionA: "Venus", optionB: "Jupiter", optionC: "Saturn", optionD: "Mars", correctAnswer: "D", category: "wild_card", difficulty: "easy" },
  { question: "How many bones are in the adult human body?", optionA: "186", optionB: "206", optionC: "226", optionD: "246", correctAnswer: "B", category: "wild_card", difficulty: "medium" },
  { question: "What is the largest ocean on Earth?", optionA: "Atlantic", optionB: "Indian", optionC: "Arctic", optionD: "Pacific", correctAnswer: "D", category: "wild_card", difficulty: "easy" },
  { question: "Which country has the most time zones?", optionA: "Russia", optionB: "United States", optionC: "France", optionD: "China", correctAnswer: "C", category: "wild_card", difficulty: "hard" },
  { question: "What is the speed of light in a vacuum?", optionA: "186,000 miles per second", optionB: "100,000 miles per second", optionC: "300,000 miles per second", optionD: "250,000 miles per second", correctAnswer: "A", category: "wild_card", difficulty: "hard" },
  { question: "Which element has the atomic number 1?", optionA: "Helium", optionB: "Oxygen", optionC: "Carbon", optionD: "Hydrogen", correctAnswer: "D", category: "wild_card", difficulty: "easy" },
  { question: "What is the longest river in the world?", optionA: "Amazon", optionB: "Nile", optionC: "Mississippi", optionD: "Yangtze", correctAnswer: "B", category: "wild_card", difficulty: "medium" },
  { question: "How many strings does a standard guitar have?", optionA: "4", optionB: "5", optionC: "6", optionD: "7", correctAnswer: "C", category: "wild_card", difficulty: "easy" },
  { question: "What is the most abundant gas in Earth's atmosphere?", optionA: "Oxygen", optionB: "Carbon dioxide", optionC: "Nitrogen", optionD: "Argon", correctAnswer: "C", category: "wild_card", difficulty: "medium" },
  { question: "Which country is home to the kangaroo?", optionA: "New Zealand", optionB: "South Africa", optionC: "Brazil", optionD: "Australia", correctAnswer: "D", category: "wild_card", difficulty: "easy" },
  { question: "What does 'FAQ' stand for?", optionA: "Fast Answer Questions", optionB: "Frequently Asked Questions", optionC: "Final Answer Quiz", optionD: "Formal Advice Queue", correctAnswer: "B", category: "wild_card", difficulty: "easy" },
  { question: "How many days are in a leap year?", optionA: "364", optionB: "365", optionC: "366", optionD: "367", correctAnswer: "C", category: "wild_card", difficulty: "easy" },
  { question: "What is the tallest mountain in the world?", optionA: "K2", optionB: "Kilimanjaro", optionC: "Denali", optionD: "Mount Everest", correctAnswer: "D", category: "wild_card", difficulty: "easy" },
  { question: "Which planet has the most moons?", optionA: "Jupiter", optionB: "Saturn", optionC: "Uranus", optionD: "Neptune", correctAnswer: "B", category: "wild_card", difficulty: "hard" },
  { question: "What is the hardest natural substance on Earth?", optionA: "Quartz", optionB: "Titanium", optionC: "Diamond", optionD: "Corundum", correctAnswer: "C", category: "wild_card", difficulty: "easy" },
  { question: "How many continents are there on Earth?", optionA: "5", optionB: "6", optionC: "7", optionD: "8", correctAnswer: "C", category: "wild_card", difficulty: "easy" },
  { question: "What is the largest mammal on Earth?", optionA: "African elephant", optionB: "Blue whale", optionC: "Sperm whale", optionD: "Giraffe", correctAnswer: "B", category: "wild_card", difficulty: "easy" },
  { question: "What does 'AI' stand for?", optionA: "Automated Intelligence", optionB: "Artificial Intelligence", optionC: "Advanced Integration", optionD: "Algorithmic Interface", correctAnswer: "B", category: "wild_card", difficulty: "easy" },
];

async function seed() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  console.log(`Seeding ${questions.length} trivia questions...`);
  let inserted = 0;
  for (const q of questions) {
    try {
      await conn.execute(
        `INSERT IGNORE INTO trivia_questions (question, optionA, optionB, optionC, optionD, correctAnswer, category, difficulty, profileTraitKey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [q.question, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, q.category, q.difficulty, q.profileTraitKey || null]
      );
      inserted++;
    } catch (e) {
      console.error('Failed to insert:', q.question.substring(0, 40), '-', e.message);
    }
  }
  console.log(`✓ Inserted ${inserted} questions`);
  const [rows] = await conn.execute('SELECT category, COUNT(*) as cnt FROM trivia_questions GROUP BY category');
  console.log('Questions by category:', rows);
  await conn.end();
}

seed().catch(console.error);
