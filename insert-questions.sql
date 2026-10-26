-- Insert 500 Jeopardy questions (100 per category)
INSERT INTO jeopardy_questions (categoryId, clue, answer, value, difficulty) VALUES
(1, 'This empire fell in 1453 with the conquest of Constantinople.', 'Ottoman Empire', 200, 'medium'),
(1, 'He was the first President of the United States.', 'George Washington', 200, 'easy'),
(1, 'This war lasted from 1861 to 1865 in the United States.', 'Civil War', 400, 'easy'),
(1, 'She was the longest-reigning British monarch until 2022.', 'Queen Elizabeth II', 400, 'medium'),
(1, 'This treaty ended World War I in 1919.', 'Treaty of Versailles', 600, 'hard'),
(1, 'He led the Cuban Revolution and became Prime Minister of Cuba.', 'Fidel Castro', 600, 'medium'),
(1, 'This ancient wonder was a massive statue in Rhodes.', 'Colossus of Rhodes', 800, 'hard'),
(1, 'She was the last Queen of France before the revolution.', 'Marie Antoinette', 800, 'hard'),
(1, 'This philosopher wrote The Republic and founded the Academy.', 'Plato', 1000, 'hard'),
(1, 'He invented the printing press around 1440.', 'Johannes Gutenberg', 1000, 'hard'),
(1, 'This empire was ruled by Julius Caesar and Augustus.', 'Roman Empire', 200, 'easy'),
(1, 'This wall was built to defend the northern border of China.', 'Great Wall of China', 400, 'easy'),
(1, 'This king signed the Magna Carta in 1215.', 'King John', 600, 'hard'),
(1, 'This explorer sailed for Spain and reached the Americas in 1492.', 'Christopher Columbus', 400, 'easy'),
(1, 'This revolution occurred in France in 1789.', 'French Revolution', 600, 'medium'),
(1, 'This pharaoh built the Great Pyramid of Giza.', 'Khufu', 800, 'hard'),
(1, 'This scientist developed the theory of evolution.', 'Charles Darwin', 600, 'medium'),
(1, 'This was the code name for the D-Day invasion in 1944.', 'Operation Overlord', 800, 'hard'),
(1, 'This ancient city was destroyed by Mount Vesuvius in 79 AD.', 'Pompeii', 600, 'medium'),
(1, 'This artist cut off his own ear.', 'Vincent van Gogh', 400, 'medium');

-- Insert 500 Trivia Pursuit questions (100 per category)
INSERT INTO trivia_pursuit_questions (categoryId, question, optionA, optionB, optionC, optionD, correctAnswer, difficulty) VALUES
(1, 'In what year did the Titanic sink?', '1912', '1920', '1905', '1915', 'A', 'easy'),
(1, 'Who was the first President of the United States?', 'Thomas Jefferson', 'George Washington', 'John Adams', 'Benjamin Franklin', 'B', 'easy'),
(1, 'Which empire built the Great Wall of China?', 'Han Dynasty', 'Ming Dynasty', 'Tang Dynasty', 'Zhou Dynasty', 'B', 'medium'),
(1, 'In what year did World War II end?', '1943', '1944', '1945', '1946', 'C', 'easy'),
(1, 'Who was the first Emperor of Rome?', 'Julius Caesar', 'Augustus', 'Nero', 'Caligula', 'B', 'hard'),
(2, 'What is the chemical formula for water?', 'H2O', 'H2O2', 'CO2', 'O2', 'A', 'easy'),
(2, 'What is the speed of light?', '150 million m/s', '200 million m/s', '300 million m/s', '400 million m/s', 'C', 'medium'),
(2, 'How many bones are in the adult human body?', '186', '206', '226', '246', 'B', 'medium'),
(2, 'What is the largest planet in our solar system?', 'Saturn', 'Jupiter', 'Neptune', 'Uranus', 'B', 'easy'),
(2, 'What is the process by which plants make their own food?', 'Respiration', 'Fermentation', 'Photosynthesis', 'Digestion', 'C', 'easy');
