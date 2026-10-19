-- Migration 017: expanded user preferences
alter table users add column if not exists daily_goal_minutes integer not null default 60;
alter table users add column if not exists tutor_mode text not null default 'direct';
alter table users add column if not exists difficulty_preference text not null default 'adaptive';
alter table users add column if not exists reduced_motion boolean not null default false;
alter table users add column if not exists font_size integer not null default 14;
alter table users add column if not exists high_contrast boolean not null default false;
