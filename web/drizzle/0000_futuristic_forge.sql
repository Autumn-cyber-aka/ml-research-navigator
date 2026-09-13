CREATE TABLE `authors` (
	`author_id` integer PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `list_votes` (
	`list_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`list_id`, `user_id`),
	FOREIGN KEY (`list_id`) REFERENCES `reading_lists`(`list_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reading_lists` (
	`list_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "list_visibility" CHECK("reading_lists"."is_public" IN (0,1)),
	CONSTRAINT "list_name" CHECK(length(trim("reading_lists"."name")) BETWEEN 1 AND 150)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_list_owner_name` ON `reading_lists` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `list_papers` (
	`list_id` integer NOT NULL,
	`paper_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`list_id`, `paper_id`),
	FOREIGN KEY (`list_id`) REFERENCES `reading_lists`(`list_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`paper_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `paper_authors` (
	`paper_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`author_order` integer NOT NULL,
	PRIMARY KEY(`paper_id`, `author_id`),
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`paper_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`author_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_author_order` ON `paper_authors` (`paper_id`,`author_order`);--> statement-breakpoint
CREATE INDEX `idx_author_papers` ON `paper_authors` (`author_id`,`paper_id`);--> statement-breakpoint
CREATE TABLE `papers` (
	`paper_id` integer PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`title` text NOT NULL,
	`abstract` text NOT NULL,
	`publication_year` integer NOT NULL,
	`topic` text NOT NULL,
	`provenance` text NOT NULL,
	CONSTRAINT "paper_year" CHECK("papers"."publication_year" BETWEEN 1900 AND 2100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `papers_source_key_unique` ON `papers` (`source_key`);--> statement-breakpoint
CREATE INDEX `idx_papers_year` ON `papers` (`publication_year`,`paper_id`);--> statement-breakpoint
CREATE TABLE `post_votes` (
	`post_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`post_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`paper_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "post_title" CHECK(length(trim("posts"."title")) BETWEEN 1 AND 200),
	CONSTRAINT "post_body" CHECK(length(trim("posts"."body")) BETWEEN 1 AND 8000)
);
--> statement-breakpoint
CREATE INDEX `idx_posts_paper` ON `posts` (`paper_id`);--> statement-breakpoint
CREATE TABLE `replies` (
	`reply_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reply_body" CHECK(length(trim("replies"."body")) BETWEEN 1 AND 4000)
);
--> statement-breakpoint
CREATE INDEX `idx_replies_post` ON `replies` (`post_id`);--> statement-breakpoint
CREATE TABLE `review_votes` (
	`review_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`review_id`, `user_id`),
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`review_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`review_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`paper_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`paper_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_rating" CHECK("reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "review_body" CHECK(length(trim("reviews"."body")) BETWEEN 1 AND 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_review` ON `reviews` (`user_id`,`paper_id`);--> statement-breakpoint
CREATE INDEX `idx_review_paper` ON `reviews` (`paper_id`);--> statement-breakpoint
CREATE TABLE `reading_states` (
	`user_id` text NOT NULL,
	`paper_id` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`user_id`, `paper_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paper_id`) REFERENCES `papers`(`paper_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "state_status" CHECK("reading_states"."status" IN ('want','reading','read'))
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
