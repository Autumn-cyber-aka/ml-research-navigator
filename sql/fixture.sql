-- AI-authored fictional metadata v2. NOT real publications or researchers.
-- Run once after schema.sql in an empty dedicated database; runner rolls back on error.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
START TRANSACTION;
INSERT INTO papers (paper_id,source_key,title,abstract,publication_year,topic,provenance) VALUES
(1,'fixture:001','Tiny Forest Classifiers','A fictional study of compact tree ensembles. Use this sample to practice comparing assumptions, evaluation methods, and model size.',2025,'Learning theory','AI-authored fictional fixture v2; 2026-09-13'),
(2,'fixture:002','Reading Graph Representations','A fictional introduction to graph representations and message passing. The example is designed for author and year filtering.',2024,'Graph learning','AI-authored fictional fixture v2; 2026-09-13'),
(3,'fixture:003','Evaluating Small Predictors','A fictional evaluation protocol for small predictors, illustrating held-out splits and robustness checks. No experiment was conducted.',2025,'Evaluation','AI-authored fictional fixture v2; 2026-09-13'),
(4,'fixture:004','When Embeddings Forget Structure','A fictional exploration of the structure lost during embedding compression, with questions for a reading group.',2026,'Representation learning','AI-authored fictional fixture v2; 2026-09-13'),
(5,'fixture:005','A Map of Efficient Attention','An invented comparison of attention mechanisms under limited memory. This is teaching metadata, not a published survey.',2026,'Language models','AI-authored fictional fixture v2; 2026-09-13'),
(6,'fixture:006','Learning from Noisy Labels','An invented paper about training with unreliable labels and checking sensitivity to annotation errors.',2025,'Learning theory','AI-authored fictional fixture v2; 2026-09-13'),
(7,'fixture:007','Retrieval in Small Research Collections','A fictional comparison of retrieval approaches for a small collection of scientific documents.',2026,'Information retrieval','AI-authored fictional fixture v2; 2026-09-13'),
(8,'fixture:008','Measuring Dataset Drift','A fictional framework for inspecting distribution changes between training and evaluation datasets.',2024,'Evaluation','AI-authored fictional fixture v2; 2026-09-13'),
(9,'fixture:009','Sparse Routes through Large Models','An invented overview of conditional computation and sparse routing, prepared for database exercises.',2025,'Language models','AI-authored fictional fixture v2; 2026-09-13'),
(10,'fixture:010','Calibrating Confidence under Shift','A fictional discussion of confidence calibration when the evaluation distribution changes.',2026,'Evaluation','AI-authored fictional fixture v2; 2026-09-13'),
(11,'fixture:011','Graph Sampling on a Budget','An invented analysis of graph sampling tradeoffs under a fixed memory budget.',2023,'Graph learning','AI-authored fictional fixture v2; 2026-09-13'),
(12,'fixture:012','Auditing Synthetic Training Data','A fictional checklist for examining duplication, coverage, and provenance in synthetic datasets.',2026,'Data quality','AI-authored fictional fixture v2; 2026-09-13'),
(13,'fixture:013','The Cost of Repeated Features','An invented study of duplicate features and their effects on data processing and evaluation.',2024,'Data quality','AI-authored fictional fixture v2; 2026-09-13'),
(14,'fixture:014','Compact Representations for Time Series','A fictional exploration of compact representations for sequential observations.',2025,'Representation learning','AI-authored fictional fixture v2; 2026-09-13'),
(15,'fixture:015','Reproducible Baselines for Small Data','A fictional comparison of baseline protocols for small datasets; no measured results are claimed.',2023,'Evaluation','AI-authored fictional fixture v2; 2026-09-13'),
(16,'fixture:016','Incremental Evaluation without Leakage','An invented proposal for keeping train and evaluation data separate as records arrive.',2026,'Data quality','AI-authored fictional fixture v2; 2026-09-13');
INSERT INTO authors(author_id,display_name) VALUES (1,'Sample Researcher A'),(2,'Sample Researcher B'),(3,'Sample Researcher C'),(4,'Sample Researcher D'),(5,'Sample Researcher E'),(6,'Sample Researcher F'),(7,'Sample Researcher G'),(8,'Sample Researcher H');
INSERT INTO paper_authors(paper_id,author_id,author_order) VALUES (1, 1, 1),(1, 2, 2),(2, 2, 1),(3, 3, 1),(4, 4, 1),(4, 5, 2),(5, 5, 1),(5, 6, 2),(6, 6, 1),(6, 7, 2),(7, 7, 1),(7, 8, 2),(8, 8, 1),(8, 1, 2),(9, 1, 1),(9, 2, 2),(10, 2, 1),(10, 3, 2),(11, 3, 1),(11, 4, 2),(12, 4, 1),(12, 5, 2),(13, 5, 1),(13, 6, 2),(14, 6, 1),(14, 7, 2),(15, 7, 1),(15, 8, 2),(16, 8, 1),(16, 1, 2);
-- No fabricated accounts, comments, ratings, or reading activity.
COMMIT;
